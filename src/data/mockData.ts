import { dateKey } from '../domain/dates';
import {
  Category,
  LedgerData,
  Transaction,
  TransactionType,
} from '../domain/types';
const categories: Category[] = [
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
];
export function createMockData(now = new Date()): LedgerData {
  const year = now.getFullYear(),
    month = now.getMonth() + 1;
  const transactions: Transaction[] = [];
  const add = (
    y: number,
    m: number,
    day: number,
    memo: string,
    categoryId: string,
    type: TransactionType,
    amount: number,
  ) => {
    transactions.push({
      id: `demo-${transactions.length + 1}`,
      date: dateKey(y, m, day),
      memo,
      categoryId,
      type,
      amount,
    });
  };
  for (let y = year - 1; y <= year; y++) {
    for (let m = 1; m <= (y === year ? month - 1 : 12); m++) {
      add(y, m, 3, '월급', 'salary', 'income', 1_320_000 + (m % 4) * 80_000);
      add(y, m, 4, '월세', 'housing', 'expense', 450_000);
      add(y, m, 9, '식비', 'food', 'expense', 195_000 + (m % 5) * 17_000);
      add(y, m, 15, '쇼핑', 'shopping', 'expense', 134_000 + (m % 3) * 19_000);
      add(y, m, 23, '교통비', 'transport', 'expense', 42_000 + (m % 4) * 7_000);
    }
  }
  const current: [number, string, string, TransactionType, number][] = [
    [1, '월세', 'housing', 'expense', 450000],
    [2, '점심 식사', 'food', 'expense', 12000],
    [3, '월급', 'salary', 'income', 1000000],
    [3, '교통비', 'transport', 'expense', 30000],
    [5, '배달 음식', 'food', 'expense', 24000],
    [6, '장보기', 'living', 'expense', 78900],
    [7, '생필품', 'living', 'expense', 100300],
    [8, '옷 구매', 'shopping', 'expense', 128000],
    [10, '카페', 'coffee', 'expense', 5800],
    [10, '아르바이트 급여', 'salary', 'income', 450000],
    [11, '점심 식사', 'food', 'expense', 9000],
    [11, '편의점', 'living', 'expense', 4500],
    [11, '용돈', 'allowance', 'income', 50000],
  ];
  current
    .filter(row => row[0] <= now.getDate())
    .forEach(row => add(year, month, ...row));
  return {
    version: 1,
    categories: categories.map(category => ({ ...category })),
    transactions,
  };
}
