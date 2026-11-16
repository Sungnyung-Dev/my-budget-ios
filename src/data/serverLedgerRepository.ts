import * as categories from '../api/categoryApi';
import { getLedger } from '../api/ledgerApi';
import * as transactions from '../api/transactionApi';
import { LedgerRepository } from './ledgerRepository';

export const serverLedgerRepository: LedgerRepository = {
  load: () => getLedger(),
  createTransaction: input => transactions.createTransaction(input),
  updateTransaction: (id, input) => transactions.updateTransaction(id, input),
  deleteTransaction: id => transactions.deleteTransaction(id),
  createCategory: input => categories.createCategory(input),
  updateCategory: (id, input) => categories.updateCategory(id, input),
  deleteCategory: id => categories.deleteCategory(id),
};
