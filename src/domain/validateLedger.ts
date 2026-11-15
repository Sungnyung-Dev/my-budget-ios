import { isValidDate } from './dates';
import { MAX_AMOUNT } from './ledger';
import { LedgerData } from './types';

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
