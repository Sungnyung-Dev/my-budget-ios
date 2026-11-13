import { isValidDate } from './dates';
import {
  Category,
  LedgerData,
  TransactionInput,
  TransactionType,
} from './types';
export const MAX_AMOUNT = 999_999_999_999;
const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(trimmed)) {
    throw new Error('금액은 소수점 없이 원 단위 정수로 입력해 주세요.');
  }
  const amount = Number(trimmed.replace(/,/g, ''));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    throw new Error('금액은 1원부터 999,999,999,999원까지 입력할 수 있습니다.');
  }
  return amount;
}
export function saveTransaction(
  data: LedgerData,
  input: TransactionInput,
  id?: string,
): LedgerData {
  parseAmount(String(input.amount));
  if (!isValidDate(input.date)) {
    throw new Error('올바른 거래 날짜가 아닙니다.');
  }
  if (
    !data.categories.some(
      category =>
        category.id === input.categoryId && category.type === input.type,
    )
  ) {
    throw new Error('거래 유형에 맞는 카테고리를 선택해 주세요.');
  }
  if (input.memo.trim().length > 100) {
    throw new Error('메모는 100자까지 입력할 수 있습니다.');
  }
  if (id && !data.transactions.some(row => row.id === id)) {
    throw new Error('거래를 찾을 수 없습니다.');
  }
  const transaction = { ...input, memo: input.memo.trim(), id: id ?? newId() };
  const transactions = id
    ? data.transactions.map(row => (row.id === id ? transaction : row))
    : [...data.transactions, transaction];
  if (
    !Number.isSafeInteger(
      transactions.reduce((total, row) => total + row.amount, 0),
    )
  ) {
    throw new Error('전체 거래 금액의 저장 한도를 초과했습니다.');
  }
  return { ...data, transactions };
}
export const deleteTransaction = (
  data: LedgerData,
  id: string,
): LedgerData => ({
  ...data,
  transactions: data.transactions.filter(row => row.id !== id),
});
export function saveCategory(
  data: LedgerData,
  type: TransactionType,
  rawName: string,
  id?: string,
): LedgerData {
  const name = rawName.trim();
  if (!name || name.length > 20) {
    throw new Error('카테고리 이름을 1~20자로 입력해 주세요.');
  }
  if (
    data.categories.some(
      category =>
        category.type === type &&
        category.id !== id &&
        category.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  ) {
    throw new Error('같은 유형에 이미 있는 카테고리 이름입니다.');
  }
  if (
    id &&
    !data.categories.some(
      category => category.id === id && category.type === type,
    )
  ) {
    throw new Error('카테고리를 찾을 수 없습니다.');
  }
  const category: Category = {
    id: id ?? newId(),
    name,
    type,
    symbol: type === 'income' ? 'income' : 'other',
  };
  return {
    ...data,
    categories: id
      ? data.categories.map(item => (item.id === id ? { ...item, name } : item))
      : [...data.categories, category],
  };
}
export function deleteCategory(data: LedgerData, id: string): LedgerData {
  if (data.transactions.some(row => row.categoryId === id)) {
    throw new Error('거래에서 사용 중인 카테고리는 삭제할 수 없습니다.');
  }
  return {
    ...data,
    categories: data.categories.filter(category => category.id !== id),
  };
}
