import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from '../config/env';
import { LedgerData } from '../domain/types';
import { validateLedger } from '../domain/validateLedger';
import { createMockData } from './mockData';

export { validateLedger } from '../domain/validateLedger';
export interface LedgerRepository {
  load(): Promise<LedgerData>;
  save(data: LedgerData): Promise<void>;
}
const STORAGE_KEY = '@my-ledger/data-v1';
// 서버 전환은 데이터 이전 정책을 마련한 뒤 별도 저장소로 연결합니다.
export const localLedgerRepository: LedgerRepository = {
  async load() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      return validateLedger(JSON.parse(raw));
    }
    const initial = createMockData();
    if (!env.seedDemoData) {
      initial.transactions = [];
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  },
  async save(data) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};
