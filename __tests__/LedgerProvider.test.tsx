import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Renderer, { act } from 'react-test-renderer';
import * as demo from '../src/data/mockData';
import { LedgerProvider, useLedger } from '../src/state/LedgerProvider';
import { LedgerData, TransactionInput } from '../src/domain/types';
import { DEFAULT_TIMEOUT_MS } from '../src/api/client';
import { jsonResponse, mockLedgerServer } from '../testUtils/mockLedgerServer';

jest.mock('../src/config/env', () => ({
  env: { apiBaseUrl: 'https://api.example.test' },
}));

const input: TransactionInput = {
  date: '2026-11-16',
  type: 'expense',
  categoryId: 'food',
  amount: 9000,
  memo: ' 식사 ',
};
const initial: LedgerData = {
  version: 1,
  categories: [
    { id: 'food', name: '식비', type: 'expense', symbol: 'food' },
    { id: 'coffee', name: '카페', type: 'expense', symbol: 'coffee' },
    { id: 'transport', name: '교통', type: 'expense', symbol: 'transport' },
    { id: 'shopping', name: '쇼핑', type: 'expense', symbol: 'shopping' },
    { id: 'living', name: '생활', type: 'expense', symbol: 'living' },
    { id: 'housing', name: '주거', type: 'expense', symbol: 'home' },
    { id: 'expense-other', name: '기타', type: 'expense', symbol: 'other' },
    { id: 'salary', name: '급여', type: 'income', symbol: 'income' },
    { id: 'allowance', name: '용돈', type: 'income', symbol: 'income' },
    { id: 'income-other', name: '기타', type: 'income', symbol: 'other' },
  ],
  transactions: [{ ...input, id: 'existing', memo: '이전 식사' }],
};

type Context = ReturnType<typeof useLedger>;
let ledger: Context;
let tree: Renderer.ReactTestRenderer | undefined;
let server: ReturnType<typeof mockLedgerServer>;
const originalFetch = globalThis.fetch;
function Probe() {
  ledger = useLedger();
  return null;
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      <LedgerProvider>
        <Probe />
      </LedgerProvider>,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  server = mockLedgerServer(initial);
  globalThis.fetch = server.fetch;
  jest.spyOn(demo, 'createMockData');
});

afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(AsyncStorage.clear).not.toHaveBeenCalled();
  expect(demo.createMockData).not.toHaveBeenCalled();
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const writes: {
  name: string;
  method: string;
  run(context: Context): Promise<void>;
}[] = [
  {
    name: 'create transaction',
    method: 'POST',
    run: context => context.saveTransaction(input),
  },
  {
    name: 'update transaction',
    method: 'PATCH',
    run: context =>
      context.saveTransaction({ ...input, amount: 10000 }, 'existing'),
  },
  {
    name: 'delete transaction',
    method: 'DELETE',
    run: context => context.deleteTransaction('existing'),
  },
  {
    name: 'create category',
    method: 'POST',
    run: context => context.saveCategory('expense', ' 도서 '),
  },
  {
    name: 'rename category',
    method: 'PATCH',
    run: context => context.saveCategory('expense', '외식', 'food'),
  },
  {
    name: 'delete category',
    method: 'DELETE',
    run: context => context.deleteCategory('coffee'),
  },
];

test('default provider loads one server ledger with ten categories and an empty transaction list', async () => {
  server = mockLedgerServer({ ...initial, transactions: [] });
  globalThis.fetch = server.fetch;
  await mount();
  expect(ledger.status).toBe('ready');
  expect(ledger.data).toEqual(server.data);
  expect(ledger.data.categories).toHaveLength(10);
  expect(ledger.data.transactions).toEqual([]);
  expect(server.fetch).toHaveBeenCalledTimes(1);
  expect(server.fetch.mock.calls[0][0]).toBe(
    'https://api.example.test/api/v1/ledger',
  );
  expect(server.fetch.mock.calls[0][1]?.method).toBe('GET');
});

test.each(writes)(
  '$name applies only the server-confirmed result to shared state',
  async operation => {
    await mount();
    await act(async () => {
      await operation.run(ledger);
    });
    expect(ledger.data).toEqual(server.data);
    expect(server.fetch).toHaveBeenCalledTimes(2);
    const request = server.fetch.mock.calls[1][1]!;
    expect(request.method).toBe(operation.method);
    if (operation.method === 'POST') {
      expect(JSON.parse(String(request.body))).not.toHaveProperty('id');
      const rows = operation.name.includes('transaction')
        ? ledger.data.transactions
        : ledger.data.categories;
      expect(rows.at(-1)!.id).toMatch(/^server-/);
    }
    if (operation.name === 'rename category') {
      expect(JSON.parse(String(request.body))).toEqual({ name: '외식' });
      expect(ledger.data.transactions[0].categoryId).toBe('food');
    }
    expect(ledger.saving).toBe(false);
    expect(ledger.needsRefresh).toBe(false);
  },
);

test.each(writes)(
  '$name preserves state after a definite rejection and allows a manual retry',
  async operation => {
    await mount();
    const before = ledger.data;
    server.fetch.mockResolvedValueOnce(jsonResponse({}, 409));
    await act(async () => {
      await expect(operation.run(ledger)).rejects.toMatchObject({
        code: 'HTTP',
        status: 409,
      });
    });
    expect(ledger.data).toBe(before);
    expect(ledger.needsRefresh).toBe(false);
    expect(server.fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      await operation.run(ledger);
    });
    expect(ledger.data).toEqual(server.data);
    expect(server.fetch).toHaveBeenCalledTimes(3);
  },
);

test.each(writes)(
  '$name can reconcile a committed write whose response was lost, without resending it',
  async operation => {
    await mount();
    const before = ledger.data;
    const processRequest = server.fetch.getMockImplementation()!;
    server.fetch.mockImplementationOnce(async (...args) => {
      await processRequest(...args);
      throw new TypeError('response lost after commit');
    });
    await act(async () => {
      await expect(operation.run(ledger)).rejects.toThrow('이미 반영되었을 수');
    });
    expect(ledger.data).toBe(before);
    expect(ledger.needsRefresh).toBe(true);
    await act(async () => {
      await expect(operation.run(ledger)).rejects.toThrow(
        '먼저 서버에서 다시 조회',
      );
    });
    expect(server.fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      expect(await ledger.reload()).toBe(true);
    });
    expect(server.fetch).toHaveBeenCalledTimes(3);
    expect(server.fetch.mock.calls[2][1]?.method).toBe('GET');
    expect(ledger.data).toEqual(server.data);
    expect(ledger.needsRefresh).toBe(false);
    expect(ledger.syncMessage).toContain('목록에서 처리 결과를 확인');
  },
);

test('the server ID and final entity are used instead of locally constructing a transaction', async () => {
  await mount();
  const row = { ...input, id: 'mysql-generated-uuid', memo: '서버 최종 메모' };
  server.fetch.mockResolvedValueOnce(jsonResponse(row, 201));
  await act(async () => {
    await ledger.saveTransaction(input);
  });
  expect(ledger.data.transactions.at(-1)).toEqual(row);
});

test('initial failure stays in error state, blocks writes, and retries only the GET', async () => {
  server.fetch.mockRejectedValueOnce(new TypeError('Offline'));
  await mount();
  expect(ledger.status).toBe('error');
  expect(ledger.loadError).toContain('인터넷 연결');
  await act(async () => {
    await expect(ledger.saveTransaction(input)).rejects.toThrow('처리 중');
  });
  expect(server.fetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    expect(await ledger.reload()).toBe(true);
  });
  expect(ledger.status).toBe('ready');
  expect(ledger.data).toEqual(server.data);
  expect(
    server.fetch.mock.calls.every(([, options]) => options?.method === 'GET'),
  ).toBe(true);
});

test('invalid initial data never becomes a ready empty ledger', async () => {
  server.fetch.mockResolvedValueOnce(
    jsonResponse({ version: 1, categories: [], transactions: [{}] }),
  );
  await mount();
  expect(ledger.status).toBe('error');
  expect(ledger.loadError).toContain('데이터 형식');
});

test('a background refresh failure preserves ready state and the existing snapshot', async () => {
  await mount();
  const before = ledger.data;
  server.fetch.mockRejectedValueOnce(new TypeError('Offline'));
  await act(async () => {
    expect(await ledger.reload()).toBe(false);
  });
  expect(ledger.status).toBe('ready');
  expect(ledger.data).toBe(before);
  expect(ledger.loadError).toContain('인터넷 연결');
  await act(async () => {
    await ledger.reload();
  });
  expect(ledger.loadError).toBe('');
});

test('the synchronous request guard prevents duplicate saves and racing refreshes', async () => {
  await mount();
  let finish!: (reply: Response) => void;
  server.fetch.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  let first!: Promise<void>;
  await act(async () => {
    first = ledger.saveTransaction(input);
    await expect(ledger.saveTransaction(input)).rejects.toThrow('처리 중');
    expect(await ledger.reload()).toBe(false);
  });
  expect(ledger.saving).toBe(true);
  expect(server.fetch).toHaveBeenCalledTimes(2);
  await act(async () => {
    finish(jsonResponse({ ...input, id: 'server-one' }, 201));
    await first;
  });
  expect(
    ledger.data.transactions.filter(row => row.id === 'server-one'),
  ).toHaveLength(1);
  expect(ledger.saving).toBe(false);
});

test('pending refresh keeps ready state, deduplicates GETs and blocks writes until it completes', async () => {
  await mount();
  let finish!: (reply: Response) => void;
  server.fetch.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  let refresh!: Promise<boolean>;
  await act(async () => {
    refresh = ledger.reload();
    expect(await ledger.reload()).toBe(false);
    await expect(ledger.saveTransaction(input)).rejects.toThrow('처리 중');
  });
  expect(ledger.status).toBe('ready');
  expect(ledger.refreshing).toBe(true);
  expect(server.fetch).toHaveBeenCalledTimes(2);
  await act(async () => {
    finish(jsonResponse(server.data));
    await refresh;
  });
  expect(ledger.refreshing).toBe(false);
});

test('initial timeout exposes an error and a manual GET retry can recover', async () => {
  jest.useFakeTimers();
  server.fetch.mockReturnValueOnce(new Promise(() => {}));
  await mount();
  expect(ledger.status).toBe('loading');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS);
  });
  expect(ledger.status).toBe('error');
  expect(ledger.loadError).toContain('지연');
  await act(async () => {
    await ledger.reload();
  });
  expect(ledger.status).toBe('ready');
});

test('write timeout remains uncertain through a failed recheck and only clears after successful GET', async () => {
  jest.useFakeTimers();
  await mount();
  const before = ledger.data;
  server.fetch.mockReturnValueOnce(new Promise(() => {}));
  await act(async () => {
    await Promise.all([
      expect(ledger.saveTransaction(input)).rejects.toThrow(
        '이미 반영되었을 수',
      ),
      jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS),
    ]);
  });
  expect(ledger.data).toBe(before);
  expect(ledger.needsRefresh).toBe(true);
  expect(server.fetch).toHaveBeenCalledTimes(2);
  server.fetch.mockRejectedValueOnce(new TypeError('Offline'));
  await act(async () => {
    expect(await ledger.reload()).toBe(false);
  });
  expect(ledger.needsRefresh).toBe(true);
  expect(ledger.data).toBe(before);
  await act(async () => {
    expect(await ledger.reload()).toBe(true);
  });
  expect(ledger.needsRefresh).toBe(false);
  expect(
    server.fetch.mock.calls
      .slice(2)
      .every(([, options]) => options?.method === 'GET'),
  ).toBe(true);
});

test.each([503, 204])(
  'unexpected write result HTTP %s requires a recheck rather than a blind retry',
  async status => {
    await mount();
    const before = ledger.data;
    server.fetch.mockResolvedValueOnce(jsonResponse(undefined, status));
    await act(async () => {
      await expect(ledger.saveTransaction(input)).rejects.toThrow('다시 조회');
    });
    expect(ledger.data).toBe(before);
    expect(ledger.needsRefresh).toBe(true);
  },
);

test('a response that cannot form a consistent ledger is not applied', async () => {
  await mount();
  const before = ledger.data;
  server.fetch.mockResolvedValueOnce(
    jsonResponse({ ...input, id: 'new-id', categoryId: 'missing' }, 201),
  );
  await act(async () => {
    await expect(ledger.saveTransaction(input)).rejects.toThrow('다시 조회');
  });
  expect(ledger.data).toBe(before);
  expect(ledger.needsRefresh).toBe(true);
});
