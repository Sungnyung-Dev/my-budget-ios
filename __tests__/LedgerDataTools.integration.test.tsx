import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Share, Text, TextInput } from 'react-native';
import Renderer, { act, ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerApp } from '../src/LedgerApp';
import { LedgerData } from '../src/domain/types';
import { LedgerProvider, useLedger } from '../src/state/LedgerProvider';

jest.mock('../src/config/env', () => ({
  env: { apiBaseUrl: 'https://api.example.test', seedDemoData: true },
}));

const key = '@my-ledger/data-v1';
const local: LedgerData = {
  version: 1,
  categories: [
    { id: 'food', name: '식비', type: 'expense', symbol: 'food' },
    { id: 'salary', name: '급여', type: 'income', symbol: 'income' },
  ],
  transactions: [
    {
      id: 'demo-1',
      date: '2026-11-15',
      type: 'expense',
      amount: 1000,
      categoryId: 'food',
      memo: '식사',
    },
    {
      id: 'income-1',
      date: '2026-11-15',
      type: 'income',
      amount: 2000,
      categoryId: 'salary',
      memo: '급여',
    },
  ],
};
const empty: LedgerData = { version: 1, categories: [], transactions: [] };
const rawLocal = JSON.stringify(local);
const nativeBackup = { writeBackup: jest.fn(), removeBackup: jest.fn() };
const originalModule = NativeModules.LedgerBackup;
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const response = (value: unknown) =>
  ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(value),
  } as Response);
let tree: Renderer.ReactTestRenderer;
let observed: LedgerData;
function Probe() {
  observed = useLedger().data;
  return null;
}
const textOf = (node: ReactTestInstance): string =>
  node.children
    .map(child => (typeof child === 'string' ? child : textOf(child)))
    .join('');
const hasText = (text: string) =>
  tree.root.findAllByType(Text).some(node => textOf(node).includes(text));
const button = (label: string) =>
  tree.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(
      node => node.props.accessibilityLabel === label || textOf(node) === label,
    )!;
const press = async (label: string) => {
  expect(button(label)).toBeDefined();
  await act(async () => {
    await button(label).props.onPress();
  });
};

beforeEach(async () => {
  await AsyncStorage.setItem(key, rawLocal);
  jest.clearAllMocks();
  NativeModules.LedgerBackup = nativeBackup;
  nativeBackup.writeBackup
    .mockReset()
    .mockResolvedValue('file:///tmp/test-backup.json');
  nativeBackup.removeBackup.mockReset().mockResolvedValue(undefined);
  jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
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
});

afterEach(async () => {
  await act(async () => tree.unmount());
  globalThis.fetch = originalFetch;
  NativeModules.LedgerBackup = originalModule;
  jest.restoreAllMocks();
});

test('settings exposes manual export without making automatic API or storage writes', async () => {
  await press('설정');
  expect(button('JSON 백업 내보내기')).toBeDefined();
  expect(button('서버 데이터와 비교')).toBeDefined();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(nativeBackup.writeBackup).not.toHaveBeenCalled();
  await press('JSON 백업 내보내기');
  expect(JSON.parse(nativeBackup.writeBackup.mock.calls[0][0]).ledger).toEqual(
    local,
  );
  expect(hasText('공유 작업을 완료했습니다')).toBe(true);
  expect(hasText('자동 이전은 하지 않습니다')).toBe(true);
  expect(observed!).toEqual(local);
  expect(await AsyncStorage.getItem(key)).toBe(rawLocal);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(AsyncStorage.clear).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('empty server preview displays counts and totals while the provider and disk retain local data', async () => {
  fetchMock.mockResolvedValue(response(empty));
  await press('설정');
  await press('서버 데이터와 비교');
  expect(
    tree.root.findByProps({
      accessibilityLabel: '카테고리, 로컬 2개, 서버 0개',
    }),
  ).toBeDefined();
  expect(
    tree.root.findByProps({ accessibilityLabel: '거래, 로컬 2건, 서버 0건' }),
  ).toBeDefined();
  expect(
    tree.root.findByProps({
      accessibilityLabel: '수입 합계, 로컬 2,000원, 서버 0원',
    }),
  ).toBeDefined();
  expect(
    tree.root.findByProps({
      accessibilityLabel: '지출 합계, 로컬 1,000원, 서버 0원',
    }),
  ).toBeDefined();
  expect(hasText('서버 가계부가 비어 있습니다')).toBe(true);
  expect(hasText('로컬 데이터는 그대로 유지됩니다')).toBe(true);
  expect(hasText('로컬 1건 · 서버 0건')).toBe(true);
  expect(observed!).toEqual(local);
  expect(await AsyncStorage.getItem(key)).toBe(rawLocal);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.method).toBe('GET');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await press('홈');
  expect(observed!).toEqual(local);
});

test('preview displays conflicting IDs and the fields that differ', async () => {
  fetchMock.mockResolvedValue(
    response({
      ...local,
      categories: [
        { ...local.categories[0], name: '외식' },
        local.categories[1],
      ],
      transactions: [
        { ...local.transactions[0], amount: 1500 },
        local.transactions[1],
      ],
    }),
  );
  await press('설정');
  await press('서버 데이터와 비교');
  expect(hasText('카테고리 ID 겹침: 동일 내용 1건 · 내용 다름 1건')).toBe(true);
  expect(hasText('food: 이름 다름')).toBe(true);
  expect(hasText('거래 ID 겹침: 동일 내용 1건 · 내용 다름 1건')).toBe(true);
  expect(hasText('demo-1: 금액 다름')).toBe(true);
  expect(observed!).toEqual(local);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('network failure shows a safe message and manual retry can produce a preview', async () => {
  fetchMock
    .mockRejectedValueOnce(new TypeError('private network error'))
    .mockResolvedValueOnce(response(empty));
  await press('설정');
  await press('서버 데이터와 비교');
  expect(hasText('인터넷 연결을 확인')).toBe(true);
  expect(hasText('private network error')).toBe(false);
  expect(button('서버 데이터와 비교').props.disabled).toBe(false);
  await press('서버 데이터와 비교');
  expect(hasText('로컬·서버 비교')).toBe(true);
  expect(observed!).toEqual(local);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('invalid server response clears a previous preview and leaves local state intact', async () => {
  fetchMock
    .mockResolvedValueOnce(response(empty))
    .mockResolvedValueOnce(
      response({ version: 1, categories: null, transactions: [] }),
    );
  await press('설정');
  await press('서버 데이터와 비교');
  expect(hasText('로컬·서버 비교')).toBe(true);
  await press('서버 데이터와 비교');
  expect(hasText('로컬·서버 비교')).toBe(false);
  expect(hasText('데이터 형식을 확인할 수 없습니다')).toBe(true);
  expect(observed!).toEqual(local);
  expect(await AsyncStorage.getItem(key)).toBe(rawLocal);
});

test('invalid local data blocks both export and server comparison without overwriting it', async () => {
  await press('설정');
  jest
    .mocked(AsyncStorage.getItem)
    .mockResolvedValueOnce('broken')
    .mockResolvedValueOnce('broken');
  await press('JSON 백업 내보내기');
  expect(hasText('읽거나 검증하지 못했습니다')).toBe(true);
  await press('서버 데이터와 비교');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(nativeBackup.writeBackup).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(observed!).toEqual(local);
});

test('cancelled export is distinguished from completion', async () => {
  jest.mocked(Share.share).mockResolvedValue({
    action: Share.dismissedAction,
    activityType: undefined,
  });
  await press('설정');
  await press('JSON 백업 내보내기');
  expect(hasText('백업 내보내기를 취소했습니다')).toBe(true);
  expect(hasText('공유 작업을 완료했습니다')).toBe(false);
  expect(nativeBackup.removeBackup).toHaveBeenCalled();
});

test('pending comparison disables both actions and ignores duplicate presses', async () => {
  let resolve!: (value: Response) => void;
  fetchMock.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  await press('설정');
  let work!: Promise<void>;
  await act(async () => {
    work = button('서버 데이터와 비교').props.onPress();
  });
  expect(button('서버 데이터와 비교').props.disabled).toBe(true);
  expect(button('JSON 백업 내보내기').props.disabled).toBe(true);
  await press('서버 데이터와 비교');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(response(empty));
    await work;
  });
  expect(button('JSON 백업 내보내기').props.disabled).toBe(false);
  expect(hasText('로컬·서버 비교')).toBe(true);
});

test('normal transaction editing after comparison continues to save locally', async () => {
  fetchMock.mockResolvedValue(response(empty));
  await press('설정');
  await press('서버 데이터와 비교');
  await press('내역');
  await press('선택한 날짜에 거래 추가');
  await act(async () => {
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === '거래 금액')!
      .props.onChangeText('500');
  });
  await press('거래 저장');
  expect(observed!.transactions).toHaveLength(3);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse((await AsyncStorage.getItem(key)) as string).transactions,
  ).toHaveLength(3);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.method).toBe('GET');
});
