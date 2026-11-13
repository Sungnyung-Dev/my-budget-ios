import { API_BASE_URL, SEED_DEMO_DATA } from '@env';

const seedDemoData = SEED_DEMO_DATA?.trim() ?? 'true';
if (seedDemoData !== 'true' && seedDemoData !== 'false') {
  throw new Error('SEED_DEMO_DATA 환경변수는 true 또는 false로 설정해 주세요.');
}

export const env = {
  apiBaseUrl: API_BASE_URL?.trim().replace(/\/+$/, '') || undefined,
  seedDemoData: seedDemoData === 'true',
} as const;
