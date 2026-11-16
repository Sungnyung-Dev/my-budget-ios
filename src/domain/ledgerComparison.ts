import { getTotals } from './selectors';
import { Category, LedgerData } from './types';
import { validateLedger } from './validateLedger';

export interface LedgerSummary {
  categories: number;
  transactions: number;
  income: number;
  expense: number;
  possibleDemoTransactions: number;
}

export interface IdComparison {
  identical: number;
  localOnly: number;
  serverOnly: number;
  conflicts: { id: string; fields: string[] }[];
}

export interface LedgerComparison {
  local: LedgerSummary;
  server: LedgerSummary;
  categories: IdComparison;
  transactions: IdComparison;
  categoryNameConflicts: { name: string; localId: string; serverId: string }[];
}

function summarize(data: LedgerData): LedgerSummary {
  const { income, expense } = getTotals(data.transactions);
  return {
    categories: data.categories.length,
    transactions: data.transactions.length,
    income,
    expense,
    possibleDemoTransactions: data.transactions.filter(row =>
      row.id.startsWith('demo-'),
    ).length,
  };
}

function compareIds<T extends { id: string }>(
  local: T[],
  server: T[],
  fields: (keyof T & string)[],
): IdComparison {
  const serverById = new Map(server.map(row => [row.id, row]));
  const localIds = new Set(local.map(row => row.id));
  const result: IdComparison = {
    identical: 0,
    localOnly: 0,
    serverOnly: 0,
    conflicts: [],
  };
  for (const row of local) {
    const remote = serverById.get(row.id);
    if (!remote) {
      result.localOnly++;
      continue;
    }
    const different = fields.filter(field => row[field] !== remote[field]);
    if (different.length)
      result.conflicts.push({ id: row.id, fields: different });
    else result.identical++;
  }
  result.serverOnly = server.filter(row => !localIds.has(row.id)).length;
  return result;
}

const categoryNameKey = (category: Category) =>
  `${category.type}:${category.name.trim().toLocaleLowerCase()}`;

export function compareLedgers(
  localValue: unknown,
  serverValue: unknown,
): LedgerComparison {
  const local = validateLedger(localValue);
  const server = validateLedger(serverValue);
  const serverNames = new Map(
    server.categories.map(row => [categoryNameKey(row), row]),
  );
  return {
    local: summarize(local),
    server: summarize(server),
    categories: compareIds(local.categories, server.categories, [
      'name',
      'type',
      'symbol',
    ]),
    transactions: compareIds(local.transactions, server.transactions, [
      'date',
      'type',
      'amount',
      'categoryId',
      'memo',
    ]),
    categoryNameConflicts: local.categories.flatMap(row => {
      const remote = serverNames.get(categoryNameKey(row));
      return remote && remote.id !== row.id
        ? [{ name: row.name, localId: row.id, serverId: remote.id }]
        : [];
    }),
  };
}
