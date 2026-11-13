import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  LedgerRepository,
  localLedgerRepository,
} from '../data/ledgerRepository';
import * as ledger from '../domain/ledger';
import { LedgerData, TransactionInput, TransactionType } from '../domain/types';
interface LedgerContextValue {
  data: LedgerData;
  status: 'loading' | 'ready' | 'error';
  loadError: string;
  saving: boolean;
  reload(): Promise<void>;
  saveTransaction(input: TransactionInput, id?: string): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  saveCategory(type: TransactionType, name: string, id?: string): Promise<void>;
  deleteCategory(id: string): Promise<void>;
}
const LedgerContext = createContext<LedgerContextValue | null>(null);
const emptyData: LedgerData = { version: 1, transactions: [], categories: [] };
export function LedgerProvider({
  children,
  repository = localLedgerRepository,
}: React.PropsWithChildren<{ repository?: LedgerRepository }>) {
  const [data, setData] = useState(emptyData);
  const [status, setStatus] = useState<LedgerContextValue['status']>('loading');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const latest = useRef(data),
    pending = useRef(false),
    ready = useRef(false);
  const reload = useCallback(async () => {
    setStatus('loading');
    ready.current = false;
    try {
      const loaded = await repository.load();
      latest.current = loaded;
      setData(loaded);
      ready.current = true;
      setStatus('ready');
    } catch {
      setLoadError(
        '가계부 데이터를 불러오지 못했습니다. 기존 데이터는 덮어쓰지 않았습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.',
      );
      setStatus('error');
    }
  }, [repository]);
  useEffect(() => {
    reload();
  }, [reload]);
  const mutate = async (update: (current: LedgerData) => LedgerData) => {
    if (!ready.current || pending.current) {
      throw new Error('데이터를 처리 중입니다. 잠시 후 다시 시도해 주세요.');
    }
    const next = update(latest.current);
    pending.current = true;
    setSaving(true);
    try {
      await repository.save(next);
      latest.current = next;
      setData(next);
    } catch {
      throw new Error(
        '변경사항을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.',
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return (
    <LedgerContext.Provider
      value={{
        data,
        status,
        loadError,
        saving,
        reload,
        saveTransaction: (input, id) =>
          mutate(current => ledger.saveTransaction(current, input, id)),
        deleteTransaction: id =>
          mutate(current => ledger.deleteTransaction(current, id)),
        saveCategory: (type, name, id) =>
          mutate(current => ledger.saveCategory(current, type, name, id)),
        deleteCategory: id =>
          mutate(current => ledger.deleteCategory(current, id)),
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
}
export function useLedger() {
  const value = useContext(LedgerContext);
  if (!value) {
    throw new Error('LedgerProvider가 필요합니다.');
  }
  return value;
}
