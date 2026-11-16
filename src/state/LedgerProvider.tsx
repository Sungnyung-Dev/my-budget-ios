import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ApiError } from '../api/client';
import { requestName } from '../api/validation';
import { LedgerRepository } from '../data/ledgerRepository';
import { serverLedgerRepository } from '../data/serverLedgerRepository';
import { LedgerData, TransactionInput, TransactionType } from '../domain/types';
import { validateLedger } from '../domain/validateLedger';

interface LedgerContextValue {
  data: LedgerData;
  status: 'loading' | 'ready' | 'error';
  loadError: string;
  saving: boolean;
  refreshing: boolean;
  needsRefresh: boolean;
  syncMessage: string;
  reload(): Promise<boolean>;
  saveTransaction(input: TransactionInput, id?: string): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  saveCategory(type: TransactionType, name: string, id?: string): Promise<void>;
  deleteCategory(id: string): Promise<void>;
}
const LedgerContext = createContext<LedgerContextValue | null>(null);
const emptyData: LedgerData = { version: 1, transactions: [], categories: [] };

function uncertainResult(error: unknown): boolean {
  return (
    !(error instanceof ApiError) ||
    ['NETWORK', 'TIMEOUT', 'INVALID_RESPONSE'].includes(error.code) ||
    (error.code === 'HTTP' && (error.status ?? 0) >= 500)
  );
}

function invalidInput(message: string): never {
  throw new ApiError('INVALID_REQUEST', message);
}

export function LedgerProvider({
  children,
  repository = serverLedgerRepository,
}: React.PropsWithChildren<{ repository?: LedgerRepository }>) {
  const [data, setData] = useState(emptyData);
  const [status, setStatus] = useState<LedgerContextValue['status']>('loading');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const latest = useRef(data);
  const ready = useRef(false);
  const pending = useRef(false);
  const uncertain = useRef(false);
  const mounted = useRef(true);
  const epoch = useRef(0);
  const source = useRef(repository);

  const reload = useCallback(async (): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    const requestEpoch = epoch.current;
    const wasUncertain = uncertain.current;
    if (!ready.current) setStatus('loading');
    else setRefreshing(true);
    setLoadError('');
    setSyncMessage('');
    try {
      const loaded = validateLedger(await repository.load());
      if (!mounted.current || requestEpoch !== epoch.current) return false;
      latest.current = loaded;
      ready.current = true;
      uncertain.current = false;
      setData(loaded);
      setNeedsRefresh(false);
      setStatus('ready');
      if (wasUncertain) {
        setSyncMessage(
          '서버 데이터를 다시 불러왔습니다. 편집을 닫고 목록에서 처리 결과를 확인한 뒤 추가 작업을 진행해 주세요.',
        );
      }
      return true;
    } catch (error) {
      if (mounted.current && requestEpoch === epoch.current) {
        setLoadError(
          error instanceof ApiError
            ? error.message
            : '서버의 가계부를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
        );
        if (!ready.current) setStatus('error');
      }
      return false;
    } finally {
      if (requestEpoch === epoch.current) {
        pending.current = false;
        if (mounted.current) setRefreshing(false);
      }
    }
  }, [repository]);

  useEffect(() => {
    mounted.current = true;
    if (source.current !== repository) {
      // 저장소가 바뀐 경우 이전 요청의 응답이 새 상태를 덮어쓰지 않게 합니다.
      epoch.current++;
      source.current = repository;
      ready.current = false;
      pending.current = false;
      uncertain.current = false;
      setSaving(false);
      setNeedsRefresh(false);
    }
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload, repository]);

  const mutate = async (
    update: (current: LedgerData) => Promise<LedgerData>,
  ) => {
    if (!ready.current || pending.current) {
      throw new Error('데이터를 처리 중입니다. 잠시 후 다시 시도해 주세요.');
    }
    if (uncertain.current) {
      throw new Error(
        '이전 요청의 처리 결과를 먼저 서버에서 다시 조회해 주세요.',
      );
    }
    pending.current = true;
    const requestEpoch = epoch.current;
    setSaving(true);
    setSyncMessage('');
    setLoadError('');
    try {
      const next = validateLedger(await update(latest.current));
      if (mounted.current && requestEpoch === epoch.current) {
        latest.current = next;
        setData(next);
      }
    } catch (error) {
      if (uncertainResult(error)) {
        if (mounted.current && requestEpoch === epoch.current) {
          uncertain.current = true;
          setNeedsRefresh(true);
        }
        throw new Error(
          '서버의 처리 결과를 확인하지 못했습니다. 이미 반영되었을 수 있으므로 서버 데이터를 다시 조회해 목록에서 확인해 주세요.',
        );
      }
      throw error;
    } finally {
      if (requestEpoch === epoch.current) {
        pending.current = false;
        if (mounted.current) setSaving(false);
      }
    }
  };

  return (
    <LedgerContext.Provider
      value={{
        data,
        status,
        loadError,
        saving,
        refreshing,
        needsRefresh,
        syncMessage,
        reload,
        saveTransaction: (input, id) =>
          mutate(async current => {
            if (
              id !== undefined &&
              !current.transactions.some(row => row.id === id)
            ) {
              invalidInput(
                '거래를 찾을 수 없습니다. 서버 데이터를 다시 조회해 주세요.',
              );
            }
            if (
              !current.categories.some(
                category =>
                  category.id === input.categoryId &&
                  category.type === input.type,
              )
            ) {
              invalidInput('거래 유형에 맞는 카테고리를 선택해 주세요.');
            }
            const row =
              id === undefined
                ? await repository.createTransaction(input)
                : await repository.updateTransaction(id, input);
            if (id !== undefined && row.id !== id)
              throw new Error('Unexpected transaction ID');
            return {
              ...current,
              transactions:
                id === undefined
                  ? [...current.transactions, row]
                  : current.transactions.map(item =>
                      item.id === id ? row : item,
                    ),
            };
          }),
        deleteTransaction: id =>
          mutate(async current => {
            await repository.deleteTransaction(id);
            return {
              ...current,
              transactions: current.transactions.filter(row => row.id !== id),
            };
          }),
        saveCategory: (type, rawName, id) =>
          mutate(async current => {
            const name = requestName(rawName);
            if (
              current.categories.some(
                category =>
                  category.id !== id &&
                  category.type === type &&
                  category.name.toLocaleLowerCase() ===
                    name.toLocaleLowerCase(),
              )
            ) {
              invalidInput('같은 유형에 이미 있는 카테고리 이름입니다.');
            }
            if (
              id !== undefined &&
              !current.categories.some(
                category => category.id === id && category.type === type,
              )
            ) {
              invalidInput(
                '카테고리를 찾을 수 없습니다. 서버 데이터를 다시 조회해 주세요.',
              );
            }
            const category =
              id === undefined
                ? await repository.createCategory({
                    name,
                    type,
                    symbol: type === 'income' ? 'income' : 'other',
                  })
                : await repository.updateCategory(id, { name });
            if (id !== undefined && category.id !== id)
              throw new Error('Unexpected category ID');
            return {
              ...current,
              categories:
                id === undefined
                  ? [...current.categories, category]
                  : current.categories.map(item =>
                      item.id === id ? category : item,
                    ),
            };
          }),
        deleteCategory: id =>
          mutate(async current => {
            if (current.transactions.some(row => row.categoryId === id)) {
              invalidInput('거래에서 사용 중인 카테고리는 삭제할 수 없습니다.');
            }
            await repository.deleteCategory(id);
            return {
              ...current,
              categories: current.categories.filter(
                category => category.id !== id,
              ),
            };
          }),
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('LedgerProvider가 필요합니다.');
  return value;
}
