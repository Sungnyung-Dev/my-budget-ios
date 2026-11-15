import { Category, TransactionType } from '../domain/types';
import { validateCategories, validateCategory } from '../domain/validateLedger';
import { apiClient } from './client';
import {
  requestFields,
  requestName,
  requestSymbol,
  requestType,
  resourcePath,
} from './validation';

export type CreateCategoryInput = Omit<Category, 'id'>;
export type UpdateCategoryInput = Pick<Category, 'name'>;
export interface CategoriesQuery {
  type?: TransactionType;
}

const path = '/api/v1/categories';

export async function getCategories(
  query: CategoriesQuery = {},
  client = apiClient,
): Promise<Category[]> {
  const fields = requestFields(query, ['type']);
  const suffix =
    fields.type === undefined ? '' : `?type=${requestType(fields.type)}`;
  return client.get(`${path}${suffix}`, validateCategories);
}

export async function createCategory(
  input: CreateCategoryInput,
  client = apiClient,
): Promise<Category> {
  const fields = requestFields(input, ['name', 'type', 'symbol']);
  const body: CreateCategoryInput = {
    name: requestName(fields.name),
    type: requestType(fields.type),
    symbol: requestSymbol(fields.symbol),
  };
  return client.post(path, body, validateCategory);
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  client = apiClient,
): Promise<Category> {
  const target = resourcePath(path, id);
  const fields = requestFields(input, ['name']);
  return client.patch(
    target,
    { name: requestName(fields.name) },
    validateCategory,
  );
}

export async function deleteCategory(
  id: string,
  client = apiClient,
): Promise<void> {
  return client.delete(resourcePath(path, id));
}
