import { getLedger } from '../api/ledgerApi';
import { compareLedgers, LedgerComparison } from '../domain/ledgerComparison';
import { LedgerData } from '../domain/types';
import { shareBackupFile } from '../native/ledgerBackup';
import { readStoredLedger } from './ledgerRepository';

export class LedgerTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerTransferError';
  }
}

async function readLocalSnapshot(): Promise<LedgerData> {
  let local: LedgerData | null;
  try {
    local = await readStoredLedger();
  } catch {
    throw new LedgerTransferError(
      '기기에 저장된 가계부를 읽거나 검증하지 못했습니다. 기존 데이터는 변경하지 않았습니다.',
    );
  }
  if (!local) {
    throw new LedgerTransferError(
      '기기에 저장된 가계부가 없습니다. 새 데이터를 만들지 않았습니다.',
    );
  }
  return local;
}

export async function exportLocalLedger(): Promise<'shared' | 'cancelled'> {
  const ledger = await readLocalSnapshot();
  const exportedAt = new Date().toISOString();
  const json = JSON.stringify(
    {
      backupVersion: 1,
      exportedAt,
      source: 'local',
      transactionOrigin: 'unverified',
      ledger,
    },
    null,
    2,
  );
  const filename = `my-budget-backup-${exportedAt.replace(/[:.]/g, '-')}.json`;
  try {
    return await shareBackupFile(json, filename);
  } catch {
    throw new LedgerTransferError(
      '백업 파일을 만들거나 공유하지 못했습니다. 저장 공간을 확인하고, iOS 앱을 최신 빌드로 실행해 다시 시도해 주세요.',
    );
  }
}

export async function compareLocalAndServerLedger(): Promise<LedgerComparison> {
  const local = await readLocalSnapshot();
  const server = await getLedger();
  return compareLedgers(local, server);
}
