import React, { useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { dateLabel } from '../domain/dates';
import { parseAmount } from '../domain/ledger';
import { Transaction, TransactionType } from '../domain/types';
import { useLedger } from '../state/LedgerProvider';
import { BottomSheet } from './BottomSheet';
import { ServerSyncNotice } from './ServerSyncNotice';
import { EmptyState, SegmentedControl } from './Common';
import { colors, ui } from './theme';
export function TransactionSheet({
  transaction,
  date,
  onClose,
  onManageCategories,
}: {
  transaction?: Transaction;
  date: string;
  onClose: () => void;
  onManageCategories: () => void;
}) {
  const ledger = useLedger();
  const busy = ledger.saving || ledger.refreshing;
  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? 'expense',
  );
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : '',
  );
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ??
      ledger.data.categories.find(category => category.type === 'expense')
        ?.id ??
      '',
  );
  const [memo, setMemo] = useState(transaction?.memo ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const categories = ledger.data.categories.filter(
    category => category.type === type,
  );
  const fixedDate = transaction?.date ?? date;
  const save = async () => {
    try {
      const value = parseAmount(amount);
      await ledger.saveTransaction(
        { date: fixedDate, type, amount: value, categoryId, memo },
        transaction?.id,
      );
      Keyboard.dismiss();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async () => {
    if (!transaction) {
      return;
    }
    try {
      await ledger.deleteTransaction(transaction.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <BottomSheet
      title={transaction ? '거래 상세 · 수정' : '거래 추가'}
      onClose={onClose}
      busy={busy}
    >
      <SegmentedControl
        value={type}
        options={[
          { value: 'expense', label: '지출' },
          { value: 'income', label: '수입' },
        ]}
        onChange={next => {
          if (busy) {
            return;
          }
          setType(next);
          setCategoryId(
            ledger.data.categories.find(category => category.type === next)
              ?.id ?? '',
          );
          setError('');
        }}
      />
      <Text style={ui.label}>금액</Text>
      <View style={styles.amountLine}>
        <Text style={styles.won}>₩</Text>
        <TextInput
          accessibilityLabel="거래 금액"
          testID="transaction-amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#bbb"
          maxLength={16}
          style={styles.amountInput}
          editable={!busy}
          returnKeyType="done"
          inputAccessoryViewButtonLabel="완료"
          onSubmitEditing={Keyboard.dismiss}
          selectTextOnFocus
        />
      </View>
      <Text style={ui.label}>카테고리</Text>
      {categories.length ? (
        <View style={styles.chips}>
          {categories.map(category => (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityState={{ selected: categoryId === category.id }}
              disabled={busy || ledger.needsRefresh}
              onPress={() => setCategoryId(category.id)}
              style={[
                styles.chip,
                categoryId === category.id && styles.selectedChip,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryId === category.id && styles.selectedChipText,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.noCategories}>
          <EmptyState text="사용할 카테고리가 없습니다." />
          <Pressable
            accessibilityRole="button"
            onPress={onManageCategories}
            style={ui.secondary}
          >
            <Text style={ui.secondaryText}>설정에서 카테고리 추가</Text>
          </Pressable>
        </View>
      )}
      <Text style={ui.label}>기록 날짜</Text>
      <View style={styles.fixedDate}>
        <Text style={styles.dateText}>{dateLabel(fixedDate)}</Text>
      </View>
      <Text style={ui.label}>내용 / 메모 (선택)</Text>
      <TextInput
        accessibilityLabel="거래 내용 또는 메모"
        testID="transaction-memo"
        value={memo}
        onChangeText={setMemo}
        placeholder="예: 점심 식사"
        placeholderTextColor="#aaa"
        maxLength={100}
        style={ui.input}
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
      <ServerSyncNotice showReload={!!error} onReloaded={() => setError('')} />
      {!!error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy || ledger.needsRefresh || !categories.length}
        onPress={save}
        style={[
          ui.primary,
          (busy || ledger.needsRefresh || !categories.length) && ui.disabled,
        ]}
      >
        <Text style={ui.primaryText}>
          {ledger.refreshing
            ? '서버 확인 중…'
            : ledger.saving
            ? '저장 중…'
            : transaction
            ? '변경사항 저장'
            : '거래 저장'}
        </Text>
      </Pressable>
      {transaction && !confirmDelete && (
        <Pressable
          accessibilityRole="button"
          disabled={busy || ledger.needsRefresh}
          onPress={() => setConfirmDelete(true)}
          style={ui.secondary}
        >
          <Text style={ui.secondaryText}>거래 삭제</Text>
        </Pressable>
      )}
      {confirmDelete && (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            이 거래를 삭제할까요? 삭제 후 되돌릴 수 없습니다.
          </Text>
          <View style={styles.confirmButtons}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setConfirmDelete(false)}
              style={[ui.secondary, styles.confirmButton]}
            >
              <Text style={ui.secondaryText}>삭제 취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy || ledger.needsRefresh}
              onPress={remove}
              style={[ui.primary, styles.confirmButton]}
            >
              <Text style={ui.primaryText}>삭제 확인</Text>
            </Pressable>
          </View>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onClose}
        style={styles.cancel}
      >
        <Text style={ui.secondaryText}>취소</Text>
      </Pressable>
      <Text style={styles.footer}>캘린더에서 선택한 날짜로 기록합니다.</Text>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  amountLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 10,
    marginBottom: 22,
  },
  won: { fontSize: 26, color: '#777' },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    paddingVertical: 5,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 20 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  selectedChip: { backgroundColor: '#1a1a1a' },
  chipText: { fontSize: 12, color: '#666' },
  selectedChipText: { color: 'white' },
  fixedDate: {
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    padding: 13,
    marginBottom: 20,
  },
  dateText: { fontSize: 13, fontWeight: '600', color: colors.text },
  footer: { fontSize: 10, textAlign: 'center', color: '#aaa', marginTop: 5 },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  confirm: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 12,
    marginTop: 10,
  },
  confirmText: { fontSize: 12, lineHeight: 18, color: colors.secondary },
  confirmButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  confirmButton: { flex: 1, marginTop: 0 },
  noCategories: { marginBottom: 20 },
});
