import { NativeModules, Platform, Share } from 'react-native';

interface LedgerBackupModule {
  writeBackup(json: string, filename: string): Promise<string>;
  removeBackup(url: string): Promise<void>;
}

export async function shareBackupFile(
  json: string,
  filename: string,
): Promise<'shared' | 'cancelled'> {
  const backup = NativeModules.LedgerBackup as LedgerBackupModule | undefined;
  if (Platform.OS !== 'ios' || !backup) {
    throw new Error('iOS backup module is unavailable');
  }
  const url = await backup.writeBackup(json, filename);
  try {
    if (typeof url !== 'string' || !url.startsWith('file://')) {
      throw new Error('Invalid backup file URL');
    }
    const result = await Share.share(
      { url },
      { subject: '나의 가계부 JSON 백업' },
    );
    return result.action === Share.sharedAction ? 'shared' : 'cancelled';
  } finally {
    // 공유 완료·취소 후 이번 작업의 임시 파일만 정리합니다.
    await backup.removeBackup(url).catch(() => {});
  }
}
