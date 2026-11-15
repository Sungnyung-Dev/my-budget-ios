import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient } from '../src/api/client';
import {
  CategoriesQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '../src/api/categoryApi';
import {
  TransactionsQuery,
  UpdateTransactionInput,
  createTransaction,
  deleteTransaction,
  getTransaction,
  getTransactions,
  updateTransaction,
} from '../src/api/transactionApi';
import { MAX_AMOUNT } from '../src/domain/ledger';
import { Category, Transaction, TransactionInput } from '../src/domain/types';

type Client = ReturnType<typeof createApiClient>;
const baseUrl = 'https://api.example.test';
const client = createApiClient({ baseUrl, timeoutMs: 100 });
const category: Category = {
  id: 'server-category',
  name: '식비',
  type: 'expense',
  symbol: 'food',
};
const categoryInput: CreateCategoryInput = {
  name: '식비',
  type: 'expense',
  symbol: 'food',
};
const transactionInput: TransactionInput = {
  type: 'expense',
  amount: 9000,
  categoryId: category.id,
  date: '2026-11-15',
  memo: '점심',
};
const transaction: Transaction = {
  ...transactionInput,
  id: 'server-transaction',
};
const response = (payload: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: jest
      .fn()
      .mockResolvedValue(status === 204 ? '' : JSON.stringify(payload)),
  } as unknown as Response);
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});

interface Operation {
  name: string;
  run(client: Client): Promise<unknown>;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: object;
  payload?: unknown;
  status: number;
}

const operations: Operation[] = [
  {
    name: 'getCategories',
    run: api => getCategories({}, api),
    method: 'GET',
    path: '/api/v1/categories',
    payload: [category],
    status: 200,
  },
  {
    name: 'createCategory',
    run: api => createCategory({ ...categoryInput, name: '  식비  ' }, api),
    method: 'POST',
    path: '/api/v1/categories',
    body: categoryInput,
    payload: category,
    status: 201,
  },
  {
    name: 'updateCategory',
    run: api => updateCategory(category.id, { name: '  외식  ' }, api),
    method: 'PATCH',
    path: `/api/v1/categories/${category.id}`,
    body: { name: '외식' },
    payload: { ...category, name: '외식' },
    status: 200,
  },
  {
    name: 'deleteCategory',
    run: api => deleteCategory(category.id, api),
    method: 'DELETE',
    path: `/api/v1/categories/${category.id}`,
    status: 204,
  },
  {
    name: 'getTransactions',
    run: api => getTransactions({}, api),
    method: 'GET',
    path: '/api/v1/transactions',
    payload: [transaction],
    status: 200,
  },
  {
    name: 'getTransaction',
    run: api => getTransaction(transaction.id, api),
    method: 'GET',
    path: `/api/v1/transactions/${transaction.id}`,
    payload: transaction,
    status: 200,
  },
  {
    name: 'createTransaction',
    run: api =>
      createTransaction({ ...transactionInput, memo: '  점심  ' }, api),
    method: 'POST',
    path: '/api/v1/transactions',
    body: transactionInput,
    payload: transaction,
    status: 201,
  },
  {
    name: 'updateTransaction',
    run: api =>
      updateTransaction(
        transaction.id,
        { amount: 10000, memo: '  수정  ' },
        api,
      ),
    method: 'PATCH',
    path: `/api/v1/transactions/${transaction.id}`,
    body: { amount: 10000, memo: '수정' },
    payload: { ...transaction, amount: 10000, memo: '수정' },
    status: 200,
  },
  {
    name: 'deleteTransaction',
    run: api => deleteTransaction(transaction.id, api),
    method: 'DELETE',
    path: `/api/v1/transactions/${transaction.id}`,
    status: 204,
  },
];
const jsonOperations = operations.filter(
  operation => operation.method !== 'DELETE',
);
const writes = operations.filter(operation => operation.method !== 'GET');

test.each(operations)(
  '$name follows the HTTP contract and leaves local storage untouched',
  async operation => {
    const reply = response(operation.payload, operation.status);
    fetchMock.mockResolvedValue(reply);
    await expect(operation.run(client)).resolves.toEqual(operation.payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}${operation.path}`, {
      method: operation.method,
      headers: {
        Accept: 'application/json',
        ...(operation.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(operation.body ? { body: JSON.stringify(operation.body) } : {}),
      credentials: 'omit',
      signal: expect.any(AbortSignal),
    });
    if (operation.method === 'DELETE') {
      expect(reply.text).not.toHaveBeenCalled();
    }
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(AsyncStorage.clear).not.toHaveBeenCalled();
  },
);

test.each(jsonOperations)(
  '$name rejects 204 when an entity or list is required',
  async operation => {
    fetchMock.mockResolvedValue(response(undefined, 204));
    await expect(operation.run(client)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 204,
    });
  },
);

test.each(jsonOperations)(
  '$name validates its response rather than trusting its TypeScript type',
  async operation => {
    fetchMock.mockResolvedValue(response(null, operation.status));
    await expect(operation.run(client)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: operation.status,
    });
  },
);

test.each(writes)(
  '$name preserves HTTP conflict status without retrying',
  async operation => {
    fetchMock.mockResolvedValue(
      response(
        { error: { code: 'CONFLICT', message: 'internal details' } },
        409,
      ),
    );
    await expect(operation.run(client)).rejects.toMatchObject({
      code: 'HTTP',
      status: 409,
      message: expect.stringContaining('충돌'),
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  },
);

test.each(writes)(
  '$name reports network failure without retrying',
  async operation => {
    fetchMock.mockRejectedValue(new TypeError('Offline'));
    await expect(operation.run(client)).rejects.toMatchObject({
      code: 'NETWORK',
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

test.each(writes)(
  '$name times out, aborts and never automatically retries',
  async operation => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    await Promise.all([
      expect(operation.run(client)).rejects.toMatchObject({ code: 'TIMEOUT' }),
      jest.advanceTimersByTimeAsync(1000),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  },
);

test('write timeout covers response body reception', async () => {
  const reply = response(transaction, 201);
  jest.spyOn(reply, 'text').mockReturnValue(new Promise(() => {}));
  fetchMock.mockResolvedValue(reply);
  await Promise.all([
    expect(createTransaction(transactionInput, client)).rejects.toMatchObject({
      code: 'TIMEOUT',
    }),
    jest.advanceTimersByTimeAsync(100),
  ]);
  expect(reply.text).toHaveBeenCalled();
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('deletion rejects a successful response with an unexpected contract', async () => {
  fetchMock.mockResolvedValue(response({}, 200));
  await expect(deleteTransaction(transaction.id, client)).rejects.toMatchObject(
    { code: 'INVALID_RESPONSE', status: 200 },
  );
});

test.each([400, 404, 500])(
  'writes preserve HTTP %s and do not parse error bodies',
  async status => {
    const reply = response({}, status);
    fetchMock.mockResolvedValue(reply);
    await expect(createCategory(categoryInput, client)).rejects.toMatchObject({
      code: 'HTTP',
      status,
    });
    expect(reply.text).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

test('common client rejects a non-serializable request before fetching', async () => {
  const cyclic: { self?: object } = {};
  cyclic.self = cyclic;
  await expect(
    client.post('/resource', cyclic, value => value),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(['expense', 'income'] as const)(
  'category type filter %s is sent once',
  async type => {
    fetchMock.mockResolvedValue(response([]));
    await expect(getCategories({ type }, client)).resolves.toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${baseUrl}/api/v1/categories?type=${type}`,
    );
  },
);

test.each([
  [{ from: '2026-11-01' }, '?from=2026-11-01'],
  [{ to: '2026-12-01' }, '?to=2026-12-01'],
  [{ from: '2026-11-01', to: '2026-12-01' }, '?from=2026-11-01&to=2026-12-01'],
  [{ from: '2026-11-01', to: '2026-11-01' }, '?from=2026-11-01&to=2026-11-01'],
])(
  'transaction date filters follow the server contract: %j',
  async (query, suffix) => {
    fetchMock.mockResolvedValue(response([]));
    await expect(
      getTransactions(query as TransactionsQuery, client),
    ).resolves.toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${baseUrl}/api/v1/transactions${suffix}`,
    );
  },
);

test.each<UpdateTransactionInput>([
  { amount: 1 },
  { memo: '' },
  { date: '2024-02-29' },
  { type: 'expense' },
  { categoryId: 'other-expense' },
  { type: 'income', categoryId: 'salary' },
  { memo: '수정', amount: undefined },
])('transaction patch sends only supplied fields: %j', async patch => {
  const original = { ...patch };
  const updated = { ...transaction, ...patch };
  if (updated.amount === undefined) updated.amount = transaction.amount;
  fetchMock.mockResolvedValue(response(updated));
  await expect(
    updateTransaction(transaction.id, patch, client),
  ).resolves.toEqual(updated);
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(
    JSON.parse(JSON.stringify(patch)),
  );
  expect(patch).toEqual(original);
});

test.each([1, MAX_AMOUNT])(
  'transaction creation accepts amount boundary %s and an empty memo',
  async amount => {
    const input = { ...transactionInput, amount, memo: '' };
    fetchMock.mockResolvedValue(response({ ...input, id: 'server-uuid' }, 201));
    await expect(createTransaction(input, client)).resolves.toEqual({
      ...input,
      id: 'server-uuid',
    });
    expect(
      JSON.parse(fetchMock.mock.calls[0][1]?.body as string),
    ).not.toHaveProperty('id');
  },
);

test('names and memo limits are checked after trimming, matching server normalization', async () => {
  fetchMock
    .mockResolvedValueOnce(
      response({ ...category, name: '가'.repeat(20) }, 201),
    )
    .mockResolvedValueOnce(
      response({ ...transaction, memo: '가'.repeat(100) }, 201),
    );
  await createCategory(
    { ...categoryInput, name: ` ${'가'.repeat(20)} ` },
    client,
  );
  await createTransaction(
    { ...transactionInput, memo: ` ${'가'.repeat(100)} ` },
    client,
  );
  expect(
    JSON.parse(fetchMock.mock.calls[0][1]?.body as string).name,
  ).toHaveLength(20);
  expect(
    JSON.parse(fetchMock.mock.calls[1][1]?.body as string).memo,
  ).toHaveLength(100);
});

test.each<unknown>([
  null,
  [],
  {},
  { ...categoryInput, name: '' },
  { ...categoryInput, name: '가'.repeat(21) },
  { ...categoryInput, name: 1 },
  { ...categoryInput, type: 'transfer' },
  { ...categoryInput, symbol: 'unknown' },
  { ...categoryInput, symbol: undefined },
  { ...categoryInput, id: 'client-id' },
  { ...categoryInput, createdAt: 'today' },
])('category creation rejects invalid or extra fields: %j', async input => {
  await expect(
    createCategory(input as CreateCategoryInput, client),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each<unknown>([
  {},
  { name: '' },
  { name: '수정', type: 'income' },
  { name: '수정', symbol: 'home' },
  { name: '수정', id: 'other-id' },
])('category patch permits only a valid name: %j', async input => {
  await expect(
    updateCategory(category.id, input as UpdateCategoryInput, client),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each<unknown>([
  { amount: 0 },
  { amount: -1 },
  { amount: 1.5 },
  { amount: MAX_AMOUNT + 1 },
  { amount: NaN },
  { amount: Infinity },
  { amount: '9000' },
  { amount: null },
  { date: '2026-02-29' },
  { date: '2026-04-31' },
  { date: '1899-12-31' },
  { date: '2026-11-15T00:00:00Z' },
  { categoryId: '' },
  { categoryId: 'a'.repeat(192) },
  { type: 'transfer' },
  { memo: null },
  { memo: '가'.repeat(101) },
  { id: 'client-id' },
  { updatedAt: 'today' },
])('transaction create and patch reject invalid fields: %j', async patch => {
  await expect(
    createTransaction({ ...transactionInput, ...(patch as object) }, client),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  await expect(
    updateTransaction(transaction.id, patch as UpdateTransactionInput, client),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each<unknown>([null, [], {}, { memo: undefined }])(
  'transaction patch requires at least one supplied field: %j',
  async patch => {
    await expect(
      updateTransaction(
        transaction.id,
        patch as UpdateTransactionInput,
        client,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test.each(['type', 'amount', 'categoryId', 'date', 'memo'] as const)(
  'transaction creation requires %s',
  async field => {
    const input: Partial<TransactionInput> = { ...transactionInput };
    delete input[field];
    await expect(
      createTransaction(input as TransactionInput, client),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test('invalid filters are rejected before sending a request', async () => {
  await expect(
    getCategories({ type: 'transfer' } as unknown as CategoriesQuery, client),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  for (const query of [
    { from: '2026-02-30' },
    { to: '' },
    { from: '2026-12-01', to: '2026-11-01' },
    { limit: 10 },
  ]) {
    await expect(
      getTransactions(query as TransactionsQuery, client),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

test('resource IDs are encoded as a single path segment', async () => {
  const id = '한글/id?x=1#name%';
  fetchMock
    .mockResolvedValueOnce(response({ ...transaction, id }))
    .mockResolvedValueOnce(response(undefined, 204));
  await getTransaction(id, client);
  await deleteCategory(id, client);
  expect(fetchMock.mock.calls[0][0]).toBe(
    `${baseUrl}/api/v1/transactions/${encodeURIComponent(id)}`,
  );
  expect(fetchMock.mock.calls[1][0]).toBe(
    `${baseUrl}/api/v1/categories/${encodeURIComponent(id)}`,
  );
});

test.each(['', 'a'.repeat(192), '.', '..', '\uD800'])(
  'invalid resource ID %j never reaches fetch',
  async id => {
    await expect(getTransaction(id, client)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    await expect(deleteCategory(id, client)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test.each<unknown>([
  { ...category, id: 1 },
  { ...category, symbol: 'unknown' },
  { ...category, name: '가'.repeat(21) },
  { ...category, type: 'transfer' },
])('rejects malformed category entities: %j', async payload => {
  fetchMock.mockResolvedValue(response(payload, 201));
  await expect(createCategory(categoryInput, client)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});

test.each<unknown>([
  { ...transaction, id: null },
  { ...transaction, type: 'transfer' },
  { ...transaction, categoryId: '' },
  { ...transaction, amount: '9000' },
  { ...transaction, amount: 0 },
  { ...transaction, amount: 1.5 },
  { ...transaction, amount: MAX_AMOUNT + 1 },
  { ...transaction, date: '2026-02-30' },
  { ...transaction, memo: undefined },
  { ...transaction, memo: '가'.repeat(101) },
])('rejects malformed transaction entities: %j', async payload => {
  fetchMock.mockResolvedValue(response(payload));
  await expect(getTransaction(transaction.id, client)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});

test('list validation rejects envelopes and duplicate IDs without inventing categories', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ data: [category] }))
    .mockResolvedValueOnce(response([category, category]))
    .mockResolvedValueOnce(response({ data: [transaction] }))
    .mockResolvedValueOnce(response([transaction, transaction]))
    .mockResolvedValueOnce(response([transaction]));
  await expect(getCategories({}, client)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  await expect(getCategories({}, client)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  await expect(getTransactions({}, client)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  await expect(getTransactions({}, client)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  await expect(getTransactions({}, client)).resolves.toEqual([transaction]);
  expect(fetchMock).toHaveBeenCalledTimes(5);
});
