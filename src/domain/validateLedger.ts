import { isValidDate } from './dates';
import { MAX_AMOUNT } from './ledger';
import {
  Category,
  CategorySymbol,
  LedgerData,
  Transaction,
  TransactionType,
} from './types';

export function isTransactionType(value: unknown): value is TransactionType {
  return value === 'expense' || value === 'income';
}

export function isCategorySymbol(value: unknown): value is CategorySymbol {
  return (
    typeof value === 'string' &&
    [
      'food',
      'coffee',
      'transport',
      'shopping',
      'living',
      'home',
      'income',
      'other',
    ].includes(value)
  );
}

export function validateCategory(value: unknown): Category {
  const category = value as Category;
  if (
    !category ||
    typeof category.id !== 'string' ||
    !category.id ||
    !isTransactionType(category.type) ||
    typeof category.name !== 'string' ||
    !category.name.trim() ||
    category.name.length > 20 ||
    !isCategorySymbol(category.symbol)
  ) {
    throw new Error('저장된 카테고리를 확인할 수 없습니다.');
  }
  return category;
}

export function validateCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) {
    throw new Error('카테고리 목록 형식을 확인할 수 없습니다.');
  }
  const categories = value.map(validateCategory);
  const categoryIds = new Set<string>(),
    categoryNames = new Set<string>();
  for (const category of categories) {
    if (categoryIds.has(category.id)) {
      throw new Error('저장된 카테고리를 확인할 수 없습니다.');
    }
    const key = `${category.type}:${category.name.toLocaleLowerCase()}`;
    if (categoryNames.has(key)) {
      throw new Error('중복된 카테고리가 있습니다.');
    }
    categoryNames.add(key);
    categoryIds.add(category.id);
  }
  return categories;
}

export function validateTransaction(value: unknown): Transaction {
  const row = value as Transaction;
  if (
    !row ||
    typeof row.id !== 'string' ||
    !row.id ||
    !isTransactionType(row.type) ||
    typeof row.categoryId !== 'string' ||
    !row.categoryId ||
    typeof row.date !== 'string' ||
    !isValidDate(row.date) ||
    !Number.isSafeInteger(row.amount) ||
    row.amount < 1 ||
    row.amount > MAX_AMOUNT ||
    typeof row.memo !== 'string' ||
    row.memo.length > 100
  ) {
    throw new Error('저장된 거래를 확인할 수 없습니다.');
  }
  return row;
}

export function validateTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) {
    throw new Error('거래 목록 형식을 확인할 수 없습니다.');
  }
  const transactions = value.map(validateTransaction);
  const transactionIds = new Set<string>();
  for (const row of transactions) {
    if (transactionIds.has(row.id)) {
      throw new Error('저장된 거래를 확인할 수 없습니다.');
    }
    transactionIds.add(row.id);
  }
  if (
    !Number.isSafeInteger(
      transactions.reduce((total, row) => total + row.amount, 0),
    )
  ) {
    throw new Error('저장 금액의 한도를 초과했습니다.');
  }
  return transactions;
}

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
  validateCategories(data.categories);
  validateTransactions(data.transactions);
  // 개별 거래 응답에는 카테고리 목록이 없어 참조 검증은 전체 Ledger에서 합니다.
  for (const row of data.transactions) {
    if (
      !data.categories.some(
        category =>
          category.id === row.categoryId && category.type === row.type,
      )
    ) {
      throw new Error('저장된 거래를 확인할 수 없습니다.');
    }
  }
  return data;
}
