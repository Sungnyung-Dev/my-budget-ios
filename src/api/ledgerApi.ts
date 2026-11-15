import { LedgerData } from '../domain/types';
import { validateLedger } from '../domain/validateLedger';
import { apiClient } from './client';

// 조회 결과만 반환합니다. 로컬 저장소와 Provider 상태에는 적용하지 않습니다.
export function getLedger(client = apiClient): Promise<LedgerData> {
  return client.get('/api/v1/ledger', validateLedger);
}
