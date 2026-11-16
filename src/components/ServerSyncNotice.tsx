import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLedger } from '../state/LedgerProvider';
import { colors, ui } from './theme';

export function ServerSyncNotice({
  showReload = false,
  onReloaded,
}: {
  showReload?: boolean;
  onReloaded?: () => void;
}) {
  const { loadError, needsRefresh, syncMessage, refreshing, saving, reload } =
    useLedger();
  const canReload = showReload || needsRefresh || !!loadError;
  if (!canReload && !refreshing && !syncMessage) return null;
  return (
    <View>
      {needsRefresh && (
        <Text accessibilityRole="alert" style={ui.error}>
          이전 요청이 서버에서 처리되었을 수 있습니다. 다시 저장하기 전에 서버
          데이터를 조회하고 목록에서 결과를 확인해 주세요.
        </Text>
      )}
      {!!loadError && (
        <Text accessibilityRole="alert" style={ui.error}>
          {loadError}
        </Text>
      )}
      {!!syncMessage && (
        <Text accessibilityLiveRegion="polite" style={ui.note}>
          {syncMessage}
        </Text>
      )}
      {refreshing && (
        <ActivityIndicator
          accessibilityLabel="서버 데이터 조회 중"
          color={colors.text}
        />
      )}
      {canReload && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="서버 데이터 다시 조회"
          disabled={saving || refreshing}
          style={[ui.secondary, (saving || refreshing) && ui.disabled]}
          onPress={async () => {
            if (await reload()) onReloaded?.();
          }}
        >
          <Text style={ui.secondaryText}>
            {refreshing ? '서버 확인 중…' : '서버 데이터 다시 조회'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
