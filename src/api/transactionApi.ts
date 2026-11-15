import { Transaction, TransactionInput } from '../domain/types';
import {
  validateTransaction,
  validateTransactions,
} from '../domain/validateLedger';
import { apiClient } from './client';
import {
  invalidRequest,
  requestAmount,
  requestDate,
  requestFields,
  requestId,
  requestMemo,
  requestType,
  resourcePath,
} from './validation';

export type CreateTransactionInput = TransactionInput;
export type UpdateTransactionInput = Partial<TransactionInput>;
export interface TransactionsQuery {
  from?: string;
  to?: string;
}

const path = '/api/v1/transactions';
const inputFields = ['type', 'amount', 'categoryId', 'date', 'memo'] as const;

export async function getTransactions(
  query: TransactionsQuery = {},
  client = apiClient,
): Promise<Transaction[]> {
  const fields = requestFields(query, ['from', 'to']);
  const from = fields.from === undefined ? undefined : requestDate(fields.from);
  const to = fields.to === undefined ? undefined : requestDate(fields.to);
  if (from && to && from > to) {
    return invalidRequest('시작일은 종료일보다 늦을 수 없습니다.');
  }
  const params: string[] = [];
  if (from) params.push(`from=${from}`);
  if (to) params.push(`to=${to}`);
  return client.get(
    `${path}${params.length ? `?${params.join('&')}` : ''}`,
    validateTransactions,
  );
}

export async function getTransaction(
  id: string,
  client = apiClient,
): Promise<Transaction> {
  return client.get(resourcePath(path, id), validateTransaction);
}

export async function createTransaction(
  input: CreateTransactionInput,
  client = apiClient,
): Promise<Transaction> {
  const fields = requestFields(input, inputFields);
  const body: CreateTransactionInput = {
    type: requestType(fields.type),
    amount: requestAmount(fields.amount),
    categoryId: requestId(fields.categoryId),
    date: requestDate(fields.date),
    memo: requestMemo(fields.memo),
  };
  return client.post(path, body, validateTransaction);
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
  client = apiClient,
): Promise<Transaction> {
  const target = resourcePath(path, id);
  const fields = requestFields(input, inputFields);
  const body: UpdateTransactionInput = {};
  if (fields.type !== undefined) body.type = requestType(fields.type);
  if (fields.amount !== undefined) body.amount = requestAmount(fields.amount);
  if (fields.categoryId !== undefined)
    body.categoryId = requestId(fields.categoryId);
  if (fields.date !== undefined) body.date = requestDate(fields.date);
  if (fields.memo !== undefined) body.memo = requestMemo(fields.memo);
  if (Object.keys(body).length === 0) {
    return invalidRequest('수정할 필드를 하나 이상 지정해 주세요.');
  }
  // 카테고리의 존재·유형과 현재 거래를 합친 정합성은 서버가 최종 검증합니다.
  return client.patch(target, body, validateTransaction);
}

export async function deleteTransaction(
  id: string,
  client = apiClient,
): Promise<void> {
  return client.delete(resourcePath(path, id));
}
