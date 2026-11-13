import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from '../config/env';
import { isValidDate } from '../domain/dates';
import { MAX_AMOUNT } from '../domain/ledger';
import { LedgerData } from '../domain/types';
import { createMockData } from './mockData';
export interface LedgerRepository {
  load(): Promise<LedgerData>;
  save(data: LedgerData): Promise<void>;
}
const STORAGE_KEY = '@my-ledger/data-v1';
export function validateLedger(value: unknown): LedgerData {
  const data = value as LedgerData;
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.transactions)
  ) {
    throw new Error('저장 데이터 형식을 확인할 수 없습니다.');
  }
  const categoryIds = new Set<string>(),
    categoryNames = new Set<string>();
  for (const category of data.categories) {
    if (
      !category ||
      typeof category.id !== 'string' ||
      !category.id ||
      categoryIds.has(category.id) ||
      !['expense', 'income'].includes(category.type) ||
      typeof category.name !== 'string' ||
      !category.name.trim() ||
      category.name.length > 20 ||
      ![
        'food',
        'coffee',
        'transport',
        'shopping',
        'living',
        'home',
        'income',
        'other',
      ].includes(category.symbol)
    ) {
      throw new Error('저장된 카테고리를 확인할 수 없습니다.');
    }
    const key = `${category.type}:${category.name.toLocaleLowerCase()}`;
    if (categoryNames.has(key)) {
      throw new Error('중복된 카테고리가 있습니다.');
    }
    categoryNames.add(key);
    categoryIds.add(category.id);
  }
  const transactionIds = new Set<string>();
  for (const row of data.transactions) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      !row.id ||
      transactionIds.has(row.id) ||
      typeof row.date !== 'string' ||
      !isValidDate(row.date) ||
      !Number.isSafeInteger(row.amount) ||
      row.amount < 1 ||
      row.amount > MAX_AMOUNT ||
      typeof row.memo !== 'string' ||
      row.memo.length > 100 ||
      !data.categories.some(
        category =>
          category.id === row.categoryId && category.type === row.type,
      )
    ) {
      throw new Error('저장된 거래를 확인할 수 없습니다.');
    }
    transactionIds.add(row.id);
  }
  if (
    !Number.isSafeInteger(
      data.transactions.reduce((total, row) => total + row.amount, 0),
    )
  ) {
    throw new Error('저장 금액의 한도를 초과했습니다.');
  }
  return data;
}
// REST 연결 시 이 구현을 교체하고 Provider와 화면은 그대로 유지합니다.
export const localLedgerRepository: LedgerRepository = {
  async load() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      return validateLedger(JSON.parse(raw));
    }
    const initial = createMockData();
    if (!env.seedDemoData) {
      initial.transactions = [];
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  },
  async save(data) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};
