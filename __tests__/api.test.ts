import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ApiError,
  createApiClient,
  DEFAULT_TIMEOUT_MS,
} from '../src/api/client';
import { getLedger } from '../src/api/ledgerApi';
import { localLedgerRepository } from '../src/data/ledgerRepository';
import { MAX_AMOUNT } from '../src/domain/ledger';
import { LedgerData } from '../src/domain/types';

const baseUrl = 'https://budget-api.ecoma.kro.kr';
const client = createApiClient({ baseUrl });
const ledger: LedgerData = {
  version: 1,
  categories: [
    { id: 'food', name: '식비', type: 'expense', symbol: 'food' },
    { id: 'salary', name: '급여', type: 'income', symbol: 'income' },
  ],
  transactions: [
    {
      id: 'expense-1',
      date: '2026-11-15',
      type: 'expense',
      amount: 15000,
      categoryId: 'food',
      memo: '점심',
    },
  ],
};
const emptyLedger: LedgerData = {
  version: 1,
  categories: [],
  transactions: [],
};
const response = (body: string, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});

test('GET ledger returns existing domain types without changing IDs or date strings', async () => {
  fetchMock.mockResolvedValue(response(JSON.stringify(ledger)));
  const result = await getLedger(client);
  expect(result).toEqual(ledger);
  expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/v1/ledger`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    signal: expect.any(AbortSignal),
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
});

test('common client validates other JSON endpoints and normalizes the base URL', async () => {
  fetchMock.mockResolvedValue(response('{"ok":true}'));
  const validate = (value: unknown) => {
    if (!value || typeof value !== 'object' || !('ok' in value)) {
      throw new Error('Invalid status');
    }
    return value.ok === true;
  };
  await expect(
    createApiClient({ baseUrl: ` ${baseUrl}/// ` }).get('/health', validate),
  ).resolves.toBe(true);
  expect(fetchMock.mock.calls[0][0]).toBe(`${baseUrl}/health`);
});

test.each([
  [400, '서버 요청을 처리하지 못했습니다'],
  [401, '서버 요청을 처리하지 못했습니다'],
  [403, '서버 요청을 처리하지 못했습니다'],
  [404, '요청한 데이터를 찾을 수 없습니다'],
  [429, '요청이 너무 많습니다'],
  [500, '서버에 일시적인 문제가 있습니다'],
  [503, '서버에 일시적인 문제가 있습니다'],
])(
  'HTTP %s preserves status and exposes a safe message',
  async (status, message) => {
    const reply = response(
      '<html>internal server details</html>',
      Number(status),
    );
    fetchMock.mockResolvedValue(reply);
    await expect(getLedger(client)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'HTTP',
      status,
      message: expect.stringContaining(String(message)),
    });
    expect(reply.text).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

test('network failures become ApiError with a user-facing message', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  const error = await getLedger(client).catch((value: unknown) => value);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({
    code: 'NETWORK',
    message: expect.stringContaining('인터넷 연결을 확인'),
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('an interrupted response body is a network failure', async () => {
  const reply = response('');
  jest.spyOn(reply, 'text').mockRejectedValue(new TypeError('Connection lost'));
  fetchMock.mockResolvedValue(reply);
  await expect(getLedger(client)).rejects.toMatchObject({ code: 'NETWORK' });
});

test.each(['', '<html>bad gateway</html>', '{"version":'])(
  'rejects an empty or malformed JSON body: %s',
  async body => {
    fetchMock.mockResolvedValue(response(body));
    await expect(getLedger(client)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 200,
      message: expect.stringContaining('데이터 형식을 확인할 수 없습니다'),
    });
  },
);

test('a 204 response is not silently converted into an empty ledger', async () => {
  fetchMock.mockResolvedValue(response('', 204));
  await expect(getLedger(client)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    status: 204,
  });
});

const category = ledger.categories[0];
const transaction = ledger.transactions[0];
test.each<[string, unknown]>([
  ['null', null],
  ['array', []],
  ['unexpected envelope', { data: ledger }],
  ['missing version', { categories: [], transactions: [] }],
  ['unsupported version', { ...ledger, version: 2 }],
  ['non-array categories', { ...ledger, categories: {} }],
  ['non-array transactions', { ...ledger, transactions: null }],
  ['null category', { ...ledger, categories: [null] }],
  [
    'unknown category symbol',
    { ...ledger, categories: [{ ...category, symbol: 'unknown' }] },
  ],
  [
    'blank category name',
    { ...ledger, categories: [{ ...category, name: ' ' }] },
  ],
  ['duplicate category IDs', { ...ledger, categories: [category, category] }],
  [
    'duplicate category names',
    { ...ledger, categories: [category, { ...category, id: 'another' }] },
  ],
  [
    'orphan transaction',
    { ...ledger, transactions: [{ ...transaction, categoryId: 'missing' }] },
  ],
  [
    'mismatched transaction type',
    { ...ledger, transactions: [{ ...transaction, type: 'income' }] },
  ],
  [
    'invalid calendar date',
    { ...ledger, transactions: [{ ...transaction, date: '2026-02-30' }] },
  ],
  [
    'fractional amount',
    { ...ledger, transactions: [{ ...transaction, amount: 1.5 }] },
  ],
  [
    'string amount',
    { ...ledger, transactions: [{ ...transaction, amount: '15000' }] },
  ],
  ['zero amount', { ...ledger, transactions: [{ ...transaction, amount: 0 }] }],
  [
    'excessive amount',
    { ...ledger, transactions: [{ ...transaction, amount: MAX_AMOUNT + 1 }] },
  ],
  [
    'missing memo',
    { ...ledger, transactions: [{ ...transaction, memo: undefined }] },
  ],
  [
    'duplicate transaction IDs',
    { ...ledger, transactions: [transaction, transaction] },
  ],
])('rejects invalid ledger data: %s', async (_, payload) => {
  fetchMock.mockResolvedValue(response(JSON.stringify(payload)));
  await expect(getLedger(client)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});

test('default timeout rejects and aborts even when fetch ignores cancellation', async () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  const pending = getLedger(client);
  await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
  await Promise.all([
    expect(pending).rejects.toMatchObject({
      code: 'TIMEOUT',
      message: expect.stringContaining('서버 응답이 지연'),
    }),
    jest.advanceTimersByTimeAsync(1),
  ]);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

test('timeout remains a TIMEOUT error when abort also rejects fetch', async () => {
  fetchMock.mockImplementation(
    (_input, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
      }),
  );
  await Promise.all([
    expect(
      getLedger(createApiClient({ baseUrl, timeoutMs: 50 })),
    ).rejects.toMatchObject({ code: 'TIMEOUT' }),
    jest.advanceTimersByTimeAsync(50),
  ]);
});

test('timeout covers reading the response body as well as receiving headers', async () => {
  const reply = response('');
  jest.spyOn(reply, 'text').mockReturnValue(new Promise(() => {}));
  fetchMock.mockResolvedValue(reply);
  await Promise.all([
    expect(
      getLedger(createApiClient({ baseUrl, timeoutMs: 50 })),
    ).rejects.toMatchObject({ code: 'TIMEOUT' }),
    jest.advanceTimersByTimeAsync(50),
  ]);
  expect(reply.text).toHaveBeenCalled();
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

test('concurrent requests have independent timeouts and abort signals', async () => {
  fetchMock
    .mockReturnValueOnce(new Promise(() => {}))
    .mockResolvedValueOnce(response(JSON.stringify(ledger)));
  const pending = getLedger(client);
  await expect(getLedger(client)).resolves.toEqual(ledger);
  await Promise.all([
    expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' }),
    jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS),
  ]);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(false);
});

test.each([
  '',
  'http://budget-api.ecoma.kro.kr',
  'invalid-url',
  `${baseUrl}?query=1`,
  `${baseUrl}#fragment`,
  'https://user:secret@example.com',
])(
  'rejects invalid API configuration without making a request: %s',
  async invalidUrl => {
    await expect(
      getLedger(createApiClient({ baseUrl: invalidUrl })),
    ).rejects.toMatchObject({ code: 'CONFIGURATION' });
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test.each([0, -1, NaN, Infinity, 2_147_483_648])(
  'rejects invalid timeout %s before making a request',
  async timeoutMs => {
    await expect(
      getLedger(createApiClient({ baseUrl, timeoutMs })),
    ).rejects.toMatchObject({ code: 'CONFIGURATION' });
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test.each(['https://other.example.com/ledger', '//other.example.com/ledger'])(
  'common client rejects a path that changes the API host: %s',
  async path => {
    await expect(client.get(path, value => value)).rejects.toMatchObject({
      code: 'CONFIGURATION',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test.each([
  ['a populated ledger', ledger],
  ['a ledger with no transactions', { ...ledger, transactions: [] }],
  ['an entirely empty ledger', emptyLedger],
])('GET of %s never reads or writes local storage', async (_, remote) => {
  const localRaw = JSON.stringify(ledger);
  await AsyncStorage.setItem('@my-ledger/data-v1', localRaw);
  jest.clearAllMocks();
  fetchMock.mockResolvedValue(response(JSON.stringify(remote)));
  await expect(getLedger(client)).resolves.toEqual(remote);
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(AsyncStorage.clear).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@my-ledger/data-v1')).toBe(localRaw);
  expect(await localLedgerRepository.load()).toEqual(ledger);
});

test('failed API requests never reset or overwrite corrupt local data', async () => {
  await AsyncStorage.setItem('@my-ledger/data-v1', 'broken');
  jest.clearAllMocks();
  fetchMock.mockRejectedValue(new TypeError('Offline'));
  await expect(getLedger(client)).rejects.toMatchObject({ code: 'NETWORK' });
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(AsyncStorage.clear).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@my-ledger/data-v1')).toBe('broken');
});
