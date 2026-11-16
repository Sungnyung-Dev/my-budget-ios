import {
  Category,
  LedgerData,
  Transaction,
  TransactionInput,
} from '../domain/types';

export interface LedgerRepository {
  load(): Promise<LedgerData>;
  createTransaction(input: TransactionInput): Promise<Transaction>;
  updateTransaction(
    id: string,
    input: Partial<TransactionInput>,
  ): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  createCategory(input: Omit<Category, 'id'>): Promise<Category>;
  updateCategory(id: string, input: Pick<Category, 'name'>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
}
