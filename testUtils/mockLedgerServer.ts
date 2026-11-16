import { Category, LedgerData, Transaction } from '../src/domain/types';

export function jsonResponse(value: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => (status === 204 ? '' : JSON.stringify(value))),
  } as unknown as Response;
}

// 모든 요청을 메모리에서 처리합니다. 실제 fetch로 넘기는 경로는 없습니다.
export function mockLedgerServer(initial: LedgerData) {
  const data: LedgerData = JSON.parse(JSON.stringify(initial));
  let nextId = 1;
  const fetch = jest.fn<
    ReturnType<typeof globalThis.fetch>,
    Parameters<typeof globalThis.fetch>
  >(async (url, options) => {
    const path = new URL(String(url)).pathname;
    const method = options?.method ?? 'GET';
    if (path === '/api/v1/ledger' && method === 'GET')
      return jsonResponse(data);
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    if (path === '/api/v1/transactions' && method === 'POST') {
      const row: Transaction = {
        ...body,
        memo: body.memo.trim(),
        id: `server-transaction-${nextId++}`,
      };
      data.transactions = [...data.transactions, row];
      return jsonResponse(row, 201);
    }
    if (path.startsWith('/api/v1/transactions/')) {
      const id = decodeURIComponent(path.slice('/api/v1/transactions/'.length));
      const existing = data.transactions.find(row => row.id === id);
      if (!existing) return jsonResponse({}, 404);
      if (method === 'PATCH') {
        const row = {
          ...existing,
          ...body,
          memo: (body.memo ?? existing.memo).trim(),
        };
        data.transactions = data.transactions.map(item =>
          item.id === id ? row : item,
        );
        return jsonResponse(row);
      }
      if (method === 'DELETE') {
        data.transactions = data.transactions.filter(row => row.id !== id);
        return jsonResponse(undefined, 204);
      }
    }
    if (path === '/api/v1/categories' && method === 'POST') {
      const row: Category = {
        ...body,
        name: body.name.trim(),
        id: `server-category-${nextId++}`,
      };
      data.categories = [...data.categories, row];
      return jsonResponse(row, 201);
    }
    if (path.startsWith('/api/v1/categories/')) {
      const id = decodeURIComponent(path.slice('/api/v1/categories/'.length));
      const existing = data.categories.find(row => row.id === id);
      if (!existing) return jsonResponse({}, 404);
      if (method === 'PATCH') {
        const row = { ...existing, name: body.name.trim() };
        data.categories = data.categories.map(item =>
          item.id === id ? row : item,
        );
        return jsonResponse(row);
      }
      if (method === 'DELETE') {
        if (data.transactions.some(row => row.categoryId === id))
          return jsonResponse({}, 409);
        data.categories = data.categories.filter(row => row.id !== id);
        return jsonResponse(undefined, 204);
      }
    }
    return jsonResponse({}, 404);
  });
  return { data, fetch };
}
