import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, TextInput } from 'react-native';
import Renderer, { act, ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerApp } from '../src/LedgerApp';
import { LedgerProvider, useLedger } from '../src/state/LedgerProvider';
import { LedgerData } from '../src/domain/types';
import { todayKey } from '../src/domain/dates';
import { jsonResponse, mockLedgerServer } from '../testUtils/mockLedgerServer';

jest.mock('../src/config/env', () => ({
  env: { apiBaseUrl: 'https://api.example.test' },
}));
const initial: LedgerData = {
  version: 1,
  categories: [
    { id: 'food', name: '식비', type: 'expense', symbol: 'food' },
    { id: 'salary', name: '급여', type: 'income', symbol: 'income' },
    { id: 'coffee', name: '카페', type: 'expense', symbol: 'coffee' },
  ],
  transactions: [],
};
let server: ReturnType<typeof mockLedgerServer>;
let tree: Renderer.ReactTestRenderer | undefined;
let ledger: ReturnType<typeof useLedger>;
const originalFetch = globalThis.fetch;
function Probe() {
  ledger = useLedger();
  return null;
}
const textOf = (node: ReactTestInstance): string =>
  node.children
    .map(child => (typeof child === 'string' ? child : textOf(child)))
    .join('');
const hasText = (text: string) =>
  tree!.root.findAllByType(Text).some(node => textOf(node).includes(text));
const button = (label: string) =>
  tree!.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(
      node => node.props.accessibilityLabel === label || textOf(node) === label,
    )!;
const field = (label: string) =>
  tree!.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
const press = async (label: string) => {
  expect(button(label)).toBeDefined();
  await act(async () => {
    await button(label).props.onPress();
  });
};
const change = async (label: string, value: string) => {
  await act(async () => field(label).props.onChangeText(value));
};
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      <SafeAreaProvider>
        <LedgerProvider>
          <LedgerApp />
          <Probe />
        </LedgerProvider>
      </SafeAreaProvider>,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  server = mockLedgerServer(initial);
  globalThis.fetch = server.fetch;
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(AsyncStorage.clear).not.toHaveBeenCalled();
  globalThis.fetch = originalFetch;
});

test('initial loading waits for the server and does not show a usable empty ledger early', async () => {
  let finish!: (reply: Response) => void;
  server.fetch.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  await mount();
  expect(hasText('가계부를 불러오는 중')).toBe(true);
  expect(button('선택한 날짜에 거래 추가')).toBeUndefined();
  await act(async () => {
    finish(jsonResponse(initial));
  });
  expect(hasText('선택한 날짜에 거래가 없습니다')).toBe(true);
});

test('first-load failure offers GET retry and then shows the server empty state', async () => {
  server.fetch.mockRejectedValueOnce(new TypeError('private network details'));
  await mount();
  expect(hasText('인터넷 연결을 확인')).toBe(true);
  expect(hasText('private network details')).toBe(false);
  expect(button('홈')).toBeUndefined();
  expect(button('선택한 날짜에 거래 추가')).toBeUndefined();
  await press('다시 시도');
  expect(hasText('선택한 날짜에 거래가 없습니다')).toBe(true);
  expect(ledger.data).toEqual(initial);
  expect(server.fetch.mock.calls.map(([, options]) => options?.method)).toEqual(
    ['GET', 'GET'],
  );
  await press('홈');
  await press('통계');
  await press('설정');
  expect(hasText('서버 저장')).toBe(true);
  expect(button('JSON 백업 내보내기')).toBeUndefined();
  expect(button('서버 데이터와 비교')).toBeUndefined();
  expect(hasText('로컬 데모')).toBe(false);
});

test('a lost create response keeps the draft, blocks duplicate writes, and can reconcile via GET inside the editor', async () => {
  await mount();
  await press('선택한 날짜에 거래 추가');
  await change('거래 금액', '12345');
  await change('거래 내용 또는 메모', '서버 응답 확인');
  const processRequest = server.fetch.getMockImplementation()!;
  server.fetch.mockImplementationOnce(async (...args) => {
    await processRequest(...args);
    throw new TypeError('lost response');
  });
  await press('거래 저장');
  expect(field('거래 금액').props.value).toBe('12345');
  expect(field('거래 내용 또는 메모').props.value).toBe('서버 응답 확인');
  expect(ledger.data.transactions).toHaveLength(0);
  expect(button('거래 저장').props.disabled).toBe(true);
  expect(button('취소').props.disabled).toBe(false);
  expect(hasText('이미 반영되었을 수')).toBe(true);
  await press('서버 데이터 다시 조회');
  expect(field('거래 금액').props.value).toBe('12345');
  expect(field('거래 내용 또는 메모').props.value).toBe('서버 응답 확인');
  expect(hasText('목록에서 처리 결과를 확인')).toBe(true);
  expect(ledger.data.transactions[0].id).toBe('server-transaction-1');
  expect(server.fetch.mock.calls.map(([, options]) => options?.method)).toEqual(
    ['GET', 'POST', 'GET'],
  );
  await press('취소');
  await press('홈');
  expect(hasText('서버 응답 확인')).toBe(true);
  await press('전체 내역 보기');
  await press('통계');
  expect(hasText('12,345')).toBe(true);
});

test('category creation preserves its draft through an uncertain result and uses the server ID after rechecking', async () => {
  await mount();
  await press('설정');
  await press('카테고리 관리');
  await press('지출 카테고리 추가');
  await change('카테고리 이름', '도서');
  const processRequest = server.fetch.getMockImplementation()!;
  server.fetch.mockImplementationOnce(async (...args) => {
    await processRequest(...args);
    throw new TypeError('lost response');
  });
  await press('카테고리 추가');
  expect(field('카테고리 이름').props.value).toBe('도서');
  expect(button('카테고리 추가').props.disabled).toBe(true);
  await press('서버 데이터 다시 조회');
  expect(field('카테고리 이름').props.value).toBe('도서');
  expect(ledger.data.categories.at(-1)?.id).toBe('server-category-1');
  const post = JSON.parse(String(server.fetch.mock.calls[1][1]?.body));
  expect(post).toEqual({ name: '도서', type: 'expense', symbol: 'other' });
  await press('취소');
  expect(button('도서, 카테고리 수정')).toBeDefined();
  expect(server.fetch.mock.calls.map(([, options]) => options?.method)).toEqual(
    ['GET', 'POST', 'GET'],
  );
});

test('a rejected category rename keeps the entered name and the old shared category', async () => {
  await mount();
  await press('설정');
  await press('카테고리 관리');
  await press('식비, 카테고리 수정');
  await change('카테고리 이름', '외식');
  server.fetch.mockResolvedValueOnce(jsonResponse({}, 409));
  await press('이름 변경 저장');
  expect(field('카테고리 이름').props.value).toBe('외식');
  expect(ledger.data.categories.find(row => row.id === 'food')?.name).toBe(
    '식비',
  );
  expect(hasText('충돌')).toBe(true);
  await press('이름 변경 저장');
  expect(ledger.data.categories.find(row => row.id === 'food')?.name).toBe(
    '외식',
  );
  expect(JSON.parse(String(server.fetch.mock.calls[2][1]?.body))).toEqual({
    name: '외식',
  });
});

test.each(['transaction', 'category'])(
  'a rejected %s delete leaves the editor open and the shared record intact',
  async kind => {
    const existing = {
      id: 'existing',
      date: todayKey(),
      type: 'expense' as const,
      categoryId: 'food',
      amount: 1000,
      memo: '삭제 검증',
    };
    server = mockLedgerServer({ ...initial, transactions: [existing] });
    globalThis.fetch = server.fetch;
    await mount();
    if (kind === 'transaction') {
      await press('홈');
      await press(`삭제 검증, 지출 1,000원, ${existing.date}, 상세 및 수정`);
      await press('거래 삭제');
    } else {
      await press('설정');
      await press('카테고리 관리');
      await press('카페, 카테고리 수정');
      await press('카테고리 삭제');
    }
    const before = ledger.data;
    server.fetch.mockResolvedValueOnce(jsonResponse({}, 409));
    await press('삭제 확인');
    expect(ledger.data).toBe(before);
    expect(button('삭제 확인')).toBeDefined();
    expect(hasText('충돌')).toBe(true);
    await press('삭제 확인');
    expect(ledger.data).toEqual(server.data);
    expect(
      server.fetch.mock.calls
        .slice(1)
        .every(([, options]) => options?.method === 'DELETE'),
    ).toBe(true);
  },
);

test('rapid save presses result in one POST and keep controls busy until the result arrives', async () => {
  await mount();
  await press('선택한 날짜에 거래 추가');
  await change('거래 금액', '500');
  let finish!: (reply: Response) => void;
  server.fetch.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const save = button('거래 저장').props.onPress;
  let first!: Promise<void>;
  await act(async () => {
    first = save();
    await save();
  });
  expect(field('거래 금액').props.editable).toBe(false);
  expect(button('저장 중…').props.disabled).toBe(true);
  expect(button('취소').props.disabled).toBe(true);
  expect(server.fetch).toHaveBeenCalledTimes(2);
  await act(async () => {
    const submitted = JSON.parse(String(server.fetch.mock.calls[1][1]?.body));
    finish(jsonResponse({ ...submitted, id: 'server-once' }, 201));
    await first;
  });
  expect(ledger.data.transactions).toHaveLength(1);
  expect(ledger.data.transactions[0].id).toBe('server-once');
});

test('refresh failure and recovery retain the current screen and statistics mode', async () => {
  await mount();
  await press('설정');
  server.fetch.mockRejectedValueOnce(new TypeError('Offline'));
  await press('서버 데이터 새로고침');
  expect(ledger.status).toBe('ready');
  expect(hasText('인터넷 연결을 확인')).toBe(true);
  await press('통계');
  await press('연간');
  expect(hasText('월별 수입·지출 추이')).toBe(true);
  await press('서버 데이터 다시 조회');
  expect(hasText('월별 수입·지출 추이')).toBe(true);
  expect(hasText('인터넷 연결을 확인')).toBe(false);
});

test('a new server category ID is used by transactions and a rename stays consistent across screens', async () => {
  await mount();
  await press('설정');
  await press('카테고리 관리');
  await press('수입 카테고리 추가');
  await change('카테고리 이름', '성과급');
  await press('카테고리 추가');
  expect(ledger.data.categories.at(-1)).toEqual({
    id: 'server-category-1',
    name: '성과급',
    type: 'income',
    symbol: 'income',
  });
  await press('내역');
  await press('선택한 날짜에 거래 추가');
  await press('수입');
  await press('성과급');
  await change('거래 금액', '50000');
  await change('거래 내용 또는 메모', '성과급 입금');
  await press('거래 저장');
  const request = JSON.parse(String(server.fetch.mock.calls[2][1]?.body));
  expect(request.categoryId).toBe('server-category-1');
  expect(request).not.toHaveProperty('id');
  expect(ledger.data.transactions[0].id).toBe('server-transaction-2');
  await press('홈');
  expect(hasText('성과급 입금')).toBe(true);
  await press('통계');
  expect(hasText('50,000')).toBe(true);
  await press('설정');
  await press('카테고리 관리');
  await press('성과급, 카테고리 수정');
  expect(button('카테고리 삭제').props.disabled).toBe(true);
  await change('카테고리 이름', '보너스');
  await press('이름 변경 저장');
  await press('홈');
  expect(hasText('보너스')).toBe(true);
  expect(ledger.data).toEqual(server.data);
  expect(ledger.data.transactions[0].categoryId).toBe('server-category-1');
});
