import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import {
  compareLocalAndServerLedger,
  exportLocalLedger,
  LedgerTransferError,
} from '../data/ledgerTransfer';
import { IdComparison, LedgerComparison } from '../domain/ledgerComparison';
import { formatMoney } from '../domain/selectors';
import { useLedger } from '../state/LedgerProvider';
import { colors, ui } from './theme';

type Operation = 'backup' | 'compare';
const fieldLabels: Record<string, string> = {
  name: '이름',
  type: '유형',
  symbol: '아이콘',
  date: '날짜',
  amount: '금액',
  categoryId: '카테고리',
  memo: '메모',
};

export function LedgerDataTools() {
  const { saving, status } = useLedger();
  const [busy, setBusy] = useState<Operation | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    preview: LedgerComparison;
    checkedAt: string;
  } | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const disabled = busy !== null || saving || status !== 'ready';

  const run = async (operation: Operation) => {
    if (pending.current || saving || status !== 'ready') return;
    pending.current = true;
    setBusy(operation);
    setError('');
    setMessage('');
    if (operation === 'compare') setResult(null);
    try {
      if (operation === 'backup') {
        const outcome = await exportLocalLedger();
        if (mounted.current) {
          setMessage(
            outcome === 'shared'
              ? '공유 작업을 완료했습니다. 파일에 저장을 선택했다면 저장 위치에서 JSON 파일을 확인해 주세요.'
              : '백업 내보내기를 취소했습니다.',
          );
        }
      } else {
        const preview = await compareLocalAndServerLedger();
        if (mounted.current)
          setResult({ preview, checkedAt: new Date().toLocaleString('ko-KR') });
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof ApiError || cause instanceof LedgerTransferError
            ? cause.message
            : '데이터를 확인하지 못했습니다. 기존 데이터는 변경하지 않았습니다. 다시 시도해 주세요.',
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="JSON 백업 내보내기"
        accessibilityState={{ disabled, busy: busy === 'backup' }}
        disabled={disabled}
        onPress={() => run('backup')}
        style={[ui.row, disabled && ui.disabled]}
      >
        <Text style={ui.rowLabel}>JSON 백업 내보내기</Text>
        {busy === 'backup' ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.hint}>파일 저장·공유</Text>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="서버 데이터와 비교"
        accessibilityState={{ disabled, busy: busy === 'compare' }}
        disabled={disabled}
        onPress={() => run('compare')}
        style={[ui.row, disabled && ui.disabled]}
      >
        <Text style={ui.rowLabel}>서버 데이터와 비교</Text>
        {busy === 'compare' ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.hint}>조회·미리보기</Text>
        )}
      </Pressable>
      <Text style={ui.note}>
        백업은 공유 시트에서 파일에 저장할 수 있습니다. 비교는 조회만 하며
        업로드하거나 기기의 데이터를 바꾸지 않습니다.
      </Text>
      <Text style={ui.note}>
        데모 거래가 포함될 수 있습니다. demo- ID도 수정된 거래일 수 있어 실제
        거래 여부를 확정할 수 없습니다. 자동 이전은 하지 않습니다.
      </Text>
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={ui.note}>
          {message}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={[ui.error, styles.feedback]}>
          {error}
        </Text>
      )}
      {result && (
        <ComparisonPreview
          preview={result.preview}
          checkedAt={result.checkedAt}
        />
      )}
    </>
  );
}

function ComparisonPreview({
  preview,
  checkedAt,
}: {
  preview: LedgerComparison;
  checkedAt: string;
}) {
  const rows = [
    [
      '카테고리',
      `${preview.local.categories}개`,
      `${preview.server.categories}개`,
    ],
    [
      '거래',
      `${preview.local.transactions}건`,
      `${preview.server.transactions}건`,
    ],
    [
      '수입 합계',
      `${formatMoney(preview.local.income)}원`,
      `${formatMoney(preview.server.income)}원`,
    ],
    [
      '지출 합계',
      `${formatMoney(preview.local.expense)}원`,
      `${formatMoney(preview.server.expense)}원`,
    ],
  ];
  return (
    <View style={styles.preview}>
      <Text accessibilityRole="header" style={styles.title}>
        로컬·서버 비교
      </Text>
      <Text style={styles.hint}>비교 시각: {checkedAt}</Text>
      <Text style={ui.note}>
        실행 시점에 저장된 전체 데이터 기준입니다. 합계에는 데모 거래가 포함될
        수 있습니다. 다시 비교하면 갱신됩니다.
      </Text>
      <View style={styles.tableRow}>
        <Text style={styles.metric}>항목</Text>
        <Text style={styles.value}>로컬</Text>
        <Text style={styles.value}>서버</Text>
      </View>
      {rows.map(([label, local, server]) => (
        <View
          key={label}
          accessible
          accessibilityLabel={`${label}, 로컬 ${local}, 서버 ${server}`}
          style={styles.tableRow}
        >
          <Text style={styles.metric}>{label}</Text>
          <Text style={styles.value}>{local}</Text>
          <Text style={styles.value}>{server}</Text>
        </View>
      ))}
      {preview.server.transactions === 0 && (
        <Text style={ui.note}>
          {preview.server.categories === 0
            ? '서버 가계부가 비어 있습니다.'
            : '서버에 거래가 없습니다.'}{' '}
          로컬 데이터는 그대로 유지됩니다.
        </Text>
      )}
      <Text style={ui.note}>
        demo- ID 거래: 로컬 {preview.local.possibleDemoTransactions}건 · 서버{' '}
        {preview.server.possibleDemoTransactions}건. 이 수치는 실제 거래와
        데모를 판별하는 기준이 아닙니다.
      </Text>
      <IdDetails title="카테고리" result={preview.categories} />
      <IdDetails title="거래" result={preview.transactions} />
      <Text style={styles.detailTitle}>
        같은 유형·이름, 다른 카테고리 ID: {preview.categoryNameConflicts.length}
        건
      </Text>
      {preview.categoryNameConflicts.slice(0, 5).map(row => (
        <Text selectable key={row.localId} style={styles.detail}>
          {row.name}: 로컬 {row.localId} / 서버 {row.serverId}
        </Text>
      ))}
      {preview.categoryNameConflicts.length > 5 && (
        <Text style={styles.detail}>
          외 {preview.categoryNameConflicts.length - 5}건
        </Text>
      )}
      <Text style={ui.note}>
        같은 ID의 내용이 다르거나 이름만 같은 카테고리는 이전 시 별도 확인이
        필요합니다. 겹침이 없어도 중복 거래가 없다는 뜻은 아닙니다.
      </Text>
    </View>
  );
}

function IdDetails({ title, result }: { title: string; result: IdComparison }) {
  return (
    <View>
      <Text style={styles.detailTitle}>
        {title} ID 겹침: 동일 내용 {result.identical}건 · 내용 다름{' '}
        {result.conflicts.length}건
      </Text>
      <Text style={styles.detail}>
        로컬에만 {result.localOnly}건 · 서버에만 {result.serverOnly}건
      </Text>
      {result.conflicts.slice(0, 5).map(row => (
        <Text selectable key={row.id} style={styles.detail}>
          {row.id}:{' '}
          {row.fields.map(field => fieldLabels[field] ?? field).join(', ')} 다름
        </Text>
      ))}
      {result.conflicts.length > 5 && (
        <Text style={styles.detail}>외 {result.conflicts.length - 5}건</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 11, color: colors.secondary, flexShrink: 1 },
  feedback: { marginTop: 12 },
  preview: {
    marginTop: 20,
    padding: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e4',
    alignItems: 'flex-start',
  },
  metric: { flex: 0.8, fontSize: 11, color: colors.secondary },
  value: {
    flex: 1.2,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  detailTitle: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  detail: {
    fontSize: 11,
    color: colors.secondary,
    marginTop: 6,
    lineHeight: 17,
  },
});
