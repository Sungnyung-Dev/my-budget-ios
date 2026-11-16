import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEED_DEMO_DATA } from '@env';
import { LedgerData } from '../domain/types';
import { validateLedger } from '../domain/validateLedger';
import { createMockData } from './mockData';

export { validateLedger } from '../domain/validateLedger';
export interface LocalLedgerRepository {
  load(): Promise<LedgerData>;
  save(data: LedgerData): Promise<void>;
}
const STORAGE_KEY = '@my-ledger/data-v1';

// 백업·비교는 저장 데이터가 없더라도 초기 데이터를 생성하거나 저장하지 않습니다.
export async function readStoredLedger(): Promise<LedgerData | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw === null ? null : validateLedger(JSON.parse(raw));
}

// 이전 개발용 데이터와 백업 도구를 위해 보존합니다. 서버 앱에서는 사용하지 않습니다.
export const localLedgerRepository: LocalLedgerRepository = {
  async load() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      return validateLedger(JSON.parse(raw));
    }
    const seedDemoData = SEED_DEMO_DATA?.trim() ?? 'true';
    if (seedDemoData !== 'true' && seedDemoData !== 'false') {
      throw new Error(
        'SEED_DEMO_DATA 환경변수는 true 또는 false로 설정해 주세요.',
      );
    }
    const initial = createMockData();
    if (seedDemoData === 'false') {
      initial.transactions = [];
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  },
  async save(data) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};
