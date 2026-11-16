import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform, Share } from 'react-native';
import { ApiError } from '../src/api/client';
import { readStoredLedger } from '../src/data/ledgerRepository';
import {
  compareLocalAndServerLedger,
  exportLocalLedger,
  LedgerTransferError,
} from '../src/data/ledgerTransfer';
import { compareLedgers } from '../src/domain/ledgerComparison';
import { LedgerData } from '../src/domain/types';
import { validateLedger } from '../src/domain/validateLedger';

jest.mock('../src/config/env', () => ({
  env: { apiBaseUrl: 'https://api.example.test', seedDemoData: true },
}));

const key = '@my-ledger/data-v1';
const local: LedgerData = {
  version: 1,
  categories: [
    { id: 'food', name: '식비', type: 'expense', symbol: 'food' },
    { id: 'salary', name: '급여', type: 'income', symbol: 'income' },
    { id: 'local-category', name: '기타', type: 'expense', symbol: 'other' },
  ],
  transactions: [
    {
      id: 'shared',
      type: 'expense',
      amount: 1000,
      categoryId: 'food',
      date: '2026-11-15',
      memo: '식사',
    },
    {
      id: 'local-income',
      type: 'income',
      amount: 2000,
      categoryId: 'salary',
      date: '2025-01-01',
      memo: '수입',
    },
    {
      id: 'demo-1',
      type: 'expense',
      amount: 300,
      categoryId: 'food',
      date: '2026-11-14',
      memo: '수정된 거래일 수도 있음',
    },
  ],
};
const server: LedgerData = {
  version: 1,
  categories: [
    { ...local.categories[0], name: '외식' },
    local.categories[1],
    { ...local.categories[2], id: 'server-category' },
  ],
  transactions: [
    { ...local.transactions[0], amount: 1200 },
    { ...local.transactions[1], id: 'server-income', amount: 4000 },
    local.transactions[2],
  ],
};
const empty: LedgerData = { version: 1, categories: [], transactions: [] };
const rawLocal = JSON.stringify(local);
const fileUrl = 'file:///tmp/MyBudgetBackups/test/my-budget-backup.json';
const nativeBackup = {
  writeBackup: jest.fn().mockResolvedValue(fileUrl),
  removeBackup: jest.fn().mockResolvedValue(undefined),
};
const previousModule = NativeModules.LedgerBackup;
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const response = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
  } as Response);

beforeEach(async () => {
  await AsyncStorage.setItem(key, rawLocal);
  jest.clearAllMocks();
  NativeModules.LedgerBackup = nativeBackup;
  nativeBackup.writeBackup.mockReset().mockResolvedValue(fileUrl);
  nativeBackup.removeBackup.mockReset().mockResolvedValue(undefined);
  jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(AsyncStorage.clear).not.toHaveBeenCalled();
  globalThis.fetch = originalFetch;
  NativeModules.LedgerBackup = previousModule;
  jest.restoreAllMocks();
});

test('comparison includes all dates, totals, same-ID differences and name matches with different IDs', () => {
  const originalServer = JSON.stringify(server);
  expect(compareLedgers(local, server)).toEqual({
    local: {
      categories: 3,
      transactions: 3,
      income: 2000,
      expense: 1300,
      possibleDemoTransactions: 1,
    },
    server: {
      categories: 3,
      transactions: 3,
      income: 4000,
      expense: 1500,
      possibleDemoTransactions: 1,
    },
    categories: {
      identical: 1,
      localOnly: 1,
      serverOnly: 1,
      conflicts: [{ id: 'food', fields: ['name'] }],
    },
    transactions: {
      identical: 1,
      localOnly: 1,
      serverOnly: 1,
      conflicts: [{ id: 'shared', fields: ['amount'] }],
    },
    categoryNameConflicts: [
      { name: '기타', localId: 'local-category', serverId: 'server-category' },
    ],
  });
  expect(JSON.stringify(local)).toBe(rawLocal);
  expect(JSON.stringify(server)).toBe(originalServer);
});

test('comparison treats a different array order as identical data', () => {
  const remote = {
    ...local,
    categories: [...local.categories].reverse(),
    transactions: [...local.transactions].reverse(),
  };
  const preview = compareLedgers(local, remote);
  expect(preview.categories).toEqual({
    identical: 3,
    localOnly: 0,
    serverOnly: 0,
    conflicts: [],
  });
  expect(preview.transactions).toEqual({
    identical: 3,
    localOnly: 0,
    serverOnly: 0,
    conflicts: [],
  });
});

test('empty server data is summarized without changing either ledger', () => {
  const preview = compareLedgers(local, empty);
  expect(preview.local.transactions).toBe(3);
  expect(preview.server).toEqual({
    categories: 0,
    transactions: 0,
    income: 0,
    expense: 0,
    possibleDemoTransactions: 0,
  });
  expect(preview.categories.localOnly).toBe(3);
  expect(preview.transactions.localOnly).toBe(3);
  expect(JSON.stringify(local)).toBe(rawLocal);
  expect(empty).toEqual({ version: 1, categories: [], transactions: [] });
});

test('same category name matches only within the same type', () => {
  const remote = {
    ...empty,
    categories: [
      {
        id: 'remote',
        name: '식비',
        type: 'income' as const,
        symbol: 'income' as const,
      },
    ],
  };
  expect(compareLedgers(local, remote).categoryNameConflicts).toEqual([]);
});

test('all differing transaction fields are reported', () => {
  const remote: LedgerData = {
    ...local,
    transactions: [
      {
        ...local.transactions[0],
        type: 'income',
        amount: 9,
        categoryId: 'salary',
        date: '2026-11-13',
        memo: '다른 메모',
      },
    ],
  };
  expect(compareLedgers(local, remote).transactions.conflicts).toEqual([
    { id: 'shared', fields: ['date', 'type', 'amount', 'categoryId', 'memo'] },
  ]);
});

test('both sides are validated before comparison', () => {
  const invalid = {
    ...local,
    transactions: [{ ...local.transactions[0], categoryId: 'missing' }],
  };
  expect(() => compareLedgers(invalid, server)).toThrow();
  expect(() => compareLedgers(local, invalid)).toThrow();
});

test('export shares a JSON file containing the full validated ledger, including possible demo data', async () => {
  await expect(exportLocalLedger()).resolves.toBe('shared');
  const [json, filename] = nativeBackup.writeBackup.mock.calls[0];
  const backup = JSON.parse(json);
  expect(backup).toEqual({
    backupVersion: 1,
    exportedAt: expect.any(String),
    source: 'local',
    transactionOrigin: 'unverified',
    ledger: local,
  });
  expect(new Date(backup.exportedAt).toISOString()).toBe(backup.exportedAt);
  expect(validateLedger(backup.ledger)).toEqual(local);
  expect(backup.ledger.transactions).toHaveLength(3);
  expect(filename).toMatch(
    /^my-budget-backup-\d{4}-\d{2}-\d{2}T[\dZ-]+\.json$/,
  );
  expect(Share.share).toHaveBeenCalledWith(
    { url: fileUrl },
    { subject: '나의 가계부 JSON 백업' },
  );
  expect(nativeBackup.removeBackup).toHaveBeenCalledWith(fileUrl);
  expect(await AsyncStorage.getItem(key)).toBe(rawLocal);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('cancelling the share sheet still cleans the temporary file and preserves the original', async () => {
  jest.mocked(Share.share).mockResolvedValue({
    action: Share.dismissedAction,
    activityType: undefined,
  });
  await expect(exportLocalLedger()).resolves.toBe('cancelled');
  expect(nativeBackup.removeBackup).toHaveBeenCalledWith(fileUrl);
  expect(await AsyncStorage.getItem(key)).toBe(rawLocal);
});

test('share failure shows a safe error and still cleans the temporary file', async () => {
  jest
    .mocked(Share.share)
    .mockRejectedValue(new Error('private native failure'));
  await expect(exportLocalLedger()).rejects.toMatchObject({
    name: 'LedgerTransferError',
    message: expect.stringContaining(
      '백업 파일을 만들거나 공유하지 못했습니다',
    ),
  });
  expect(nativeBackup.removeBackup).toHaveBeenCalledWith(fileUrl);
  expect(await AsyncStorage.getItem(key)).toBe(rawLocal);
});

test('file write failure does not open the share sheet or change storage', async () => {
  nativeBackup.writeBackup.mockRejectedValue(
    new Error('disk full with private path'),
  );
  await expect(exportLocalLedger()).rejects.toBeInstanceOf(LedgerTransferError);
  expect(Share.share).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(key)).toBe(rawLocal);
});

test('best-effort temporary cleanup failure does not misreport a completed share as failed', async () => {
  nativeBackup.removeBackup.mockRejectedValue(
    new Error('temporary cleanup failed'),
  );
  await expect(exportLocalLedger()).resolves.toBe('shared');
  expect(nativeBackup.removeBackup).toHaveBeenCalledWith(fileUrl);
});

test('missing native module returns an actionable error without falling back to text export', async () => {
  NativeModules.LedgerBackup = undefined;
  await expect(exportLocalLedger()).rejects.toMatchObject({
    message: expect.stringContaining('최신 빌드'),
  });
  expect(Share.share).not.toHaveBeenCalled();
});

test('other platforms do not try to share an unsupported file URL', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await expect(exportLocalLedger()).rejects.toBeInstanceOf(LedgerTransferError);
  expect(nativeBackup.writeBackup).not.toHaveBeenCalled();
});

test.each([null, 'broken', JSON.stringify({ ...local, version: 2 })])(
  'missing or invalid stored data (%s) never seeds, exports or contacts the server',
  async raw => {
    jest
      .mocked(AsyncStorage.getItem)
      .mockResolvedValueOnce(raw)
      .mockResolvedValueOnce(raw);
    await expect(exportLocalLedger()).rejects.toBeInstanceOf(
      LedgerTransferError,
    );
    await expect(compareLocalAndServerLedger()).rejects.toBeInstanceOf(
      LedgerTransferError,
    );
    expect(nativeBackup.writeBackup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test('storage read failure never falls back to demo data', async () => {
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('private storage failure'));
  await expect(compareLocalAndServerLedger()).rejects.toMatchObject({
    message: expect.stringContaining('읽거나 검증하지 못했습니다'),
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('read-only storage access returns null without initialization when no ledger exists', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce(null);
  await expect(readStoredLedger()).resolves.toBeNull();
});

test.each([server, empty])(
  'comparison reads a separate server snapshot with one GET and preserves the raw local value',
  async remote => {
    fetchMock.mockResolvedValue(response(remote));
    await expect(compareLocalAndServerLedger()).resolves.toEqual(
      compareLedgers(local, remote),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/ledger$/),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(await AsyncStorage.getItem(key)).toBe(rawLocal);
    expect(Share.share).not.toHaveBeenCalled();
  },
);

test('server network and response errors preserve the local value', async () => {
  fetchMock
    .mockRejectedValueOnce(new TypeError('Offline'))
    .mockResolvedValueOnce(response({ invalid: true }));
  const error = await compareLocalAndServerLedger().catch(
    (cause: unknown) => cause,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ code: 'NETWORK' });
  await expect(compareLocalAndServerLedger()).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  expect(await AsyncStorage.getItem(key)).toBe(rawLocal);
  expect(fetchMock.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(
    true,
  );
});
