import { createMockData } from '../src/data/mockData';
import {
  validateLedger,
  localLedgerRepository,
} from '../src/data/ledgerRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateKey, isValidDate, shiftMonth } from '../src/domain/dates';
import {
  deleteCategory,
  deleteTransaction,
  parseAmount,
  saveCategory,
  saveTransaction,
} from '../src/domain/ledger';
import {
  categorySpending,
  forMonth,
  forYear,
  getTotals,
  spendingMetrics,
  yearlyMonths,
} from '../src/domain/selectors';
import { LedgerData, TransactionInput } from '../src/domain/types';

const data = () => createMockData(new Date(2026, 10, 12));
const input: TransactionInput = {
  date: '2026-11-12',
  type: 'expense',
  amount: 15000,
  categoryId: 'food',
  memo: '저녁 식사',
};
test('monthly, annual, category totals and spending-day average agree', () => {
  const ledger = data(),
    rows = forMonth(ledger.transactions, '2026-11-12');
  expect(getTotals(rows)).toEqual({
    income: 1500000,
    expense: 842500,
    balance: 657500,
  });
  expect(spendingMetrics(rows)).toEqual({
    count: 10,
    days: 9,
    dailyAverage: 93611,
  });
  const categories = categorySpending(rows, ledger.categories);
  expect(categories.reduce((sum, item) => sum + item.amount, 0)).toBe(842500);
  expect(categories.reduce((sum, item) => sum + item.ratio, 0)).toBeCloseTo(1);
  const year = forYear(ledger.transactions, 2026),
    months = yearlyMonths(ledger.transactions, 2026);
  expect(months).toHaveLength(12);
  expect(months[10].expense).toBe(842500);
  expect(months[11].count).toBe(0);
  expect(months.reduce((sum, month) => sum + month.expense, 0)).toBe(
    getTotals(year).expense,
  );
});
test('transaction create, edit, type change and delete recompute shared totals', () => {
  const original = data();
  let next = saveTransaction(original, input);
  const id = next.transactions.at(-1)!.id;
  expect(getTotals(forMonth(next.transactions, input.date)).expense).toBe(
    857500,
  );
  next = saveTransaction(
    next,
    { ...input, type: 'income', categoryId: 'salary', amount: 25000 },
    id,
  );
  expect(getTotals(forMonth(next.transactions, input.date))).toEqual({
    income: 1525000,
    expense: 842500,
    balance: 682500,
  });
  next = deleteTransaction(next, id);
  expect(next.transactions).toEqual(original.transactions);
  expect(() =>
    saveTransaction(next, { ...input, categoryId: 'salary' }),
  ).toThrow();
  expect(() =>
    saveTransaction(next, { ...input, date: '2026-02-30' }),
  ).toThrow();
});
test.each([
  '',
  '0',
  '-1',
  '1.5',
  '1e4',
  'abc',
  '9999999999999',
  'Infinity',
  '1,,2',
  '1,2',
  '1 000',
])('rejects invalid won amount %s', value =>
  expect(() => parseAmount(value)).toThrow(),
);
test('accepts integer won including grouping separators', () => {
  expect(parseAmount('1,500')).toBe(1500);
  expect(parseAmount('999999999999')).toBe(999999999999);
});
test('categories retain ID on rename, prohibit deletion when used, support same name across types', () => {
  let next = saveCategory(data(), 'expense', '외식', 'food');
  expect(
    next.transactions.find(row => row.categoryId === 'food'),
  ).toBeDefined();
  expect(
    categorySpending(
      forMonth(next.transactions, input.date),
      next.categories,
    ).find(item => item.category.id === 'food')?.category.name,
  ).toBe('외식');
  expect(() => deleteCategory(next, 'food')).toThrow('사용 중');
  expect(() => saveCategory(next, 'expense', ' 외식 ')).toThrow('이미');
  expect(() => saveCategory(next, 'expense', '   ')).toThrow();
  next = saveCategory(next, 'income', '외식');
  const id = next.categories.at(-1)!.id;
  next = deleteCategory(next, id);
  expect(next.categories.some(category => category.id === id)).toBe(false);
});
test('date navigation clamps end of month and handles leap years without UTC conversion', () => {
  expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
  expect(shiftMonth('2024-01-31', 1)).toBe('2024-02-29');
  expect(shiftMonth('2026-12-31', 1)).toBe('2027-01-31');
  expect(shiftMonth('2026-01-31', -1)).toBe('2025-12-31');
  expect(isValidDate('2026-02-29')).toBe(false);
  expect(isValidDate('2024-02-29')).toBe(true);
  expect(dateKey(2026, 1, 2)).toBe('2026-01-02');
});
test('storage seeds only once, persists changes and never replaces corrupt data', async () => {
  await AsyncStorage.clear();
  const initial = await localLedgerRepository.load();
  const changed = saveCategory(initial, 'expense', '도서');
  await localLedgerRepository.save(changed);
  expect(await localLedgerRepository.load()).toEqual(changed);
  await AsyncStorage.setItem('@my-ledger/data-v1', 'broken');
  await expect(localLedgerRepository.load()).rejects.toThrow();
  expect(await AsyncStorage.getItem('@my-ledger/data-v1')).toBe('broken');
});
test('snapshot validation rejects orphan categories, duplicate IDs and fractional amounts', () => {
  expect(validateLedger(data())).toEqual(data());
  const invalid = (edit: (snapshot: LedgerData) => void) => {
    const snapshot = data();
    edit(snapshot);
    expect(() => validateLedger(snapshot)).toThrow();
  };
  invalid(snapshot => {
    snapshot.transactions[0].categoryId = 'missing';
  });
  invalid(snapshot => {
    snapshot.transactions.push(snapshot.transactions[0]);
  });
  invalid(snapshot => {
    snapshot.transactions[0].amount = 1.5;
  });
});
