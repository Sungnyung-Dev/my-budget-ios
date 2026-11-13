import { Category, Totals, Transaction } from './types';
export const formatMoney = (value: number) =>
  Math.abs(value).toLocaleString('ko-KR');
export const signedMoney = (value: number) =>
  `${value < 0 ? '−' : '+'}${formatMoney(value)}`;
export function getTotals(rows: Transaction[]): Totals {
  const income = rows
    .filter(row => row.type === 'income')
    .reduce((sum, row) => sum + row.amount, 0);
  const expense = rows
    .filter(row => row.type === 'expense')
    .reduce((sum, row) => sum + row.amount, 0);
  return { income, expense, balance: income - expense };
}
export const forMonth = (rows: Transaction[], date: string) =>
  rows.filter(row => row.date.slice(0, 7) === date.slice(0, 7));
export const forYear = (rows: Transaction[], year: number) =>
  rows.filter(row => row.date.startsWith(`${year}-`));
export const recentTransactions = (rows: Transaction[]) =>
  [...rows].reverse().sort((a, b) => b.date.localeCompare(a.date));
export function categorySpending(rows: Transaction[], categories: Category[]) {
  const total = getTotals(rows).expense;
  return categories
    .filter(category => category.type === 'expense')
    .map(category => {
      const amount = rows
        .filter(row => row.categoryId === category.id)
        .reduce((sum, row) => sum + row.amount, 0);
      return { category, amount, ratio: total ? amount / total : 0 };
    })
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
export function spendingMetrics(rows: Transaction[]) {
  const expenses = rows.filter(row => row.type === 'expense');
  const days = new Set(expenses.map(row => row.date)).size;
  return {
    count: expenses.length,
    days,
    dailyAverage: days ? Math.round(getTotals(expenses).expense / days) : 0,
  };
}
export function yearlyMonths(rows: Transaction[], year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const transactions = rows.filter(row =>
      row.date.startsWith(`${year}-${String(index + 1).padStart(2, '0')}-`),
    );
    return {
      month: index + 1,
      count: transactions.length,
      ...getTotals(transactions),
    };
  });
}
