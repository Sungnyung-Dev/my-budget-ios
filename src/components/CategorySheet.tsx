import React, { useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Category, TransactionType } from '../domain/types';
import { useLedger } from '../state/LedgerProvider';
import { BottomSheet } from './BottomSheet';
import { colors, ui } from './theme';
export function CategorySheet({
  category,
  type,
  onClose,
}: {
  category?: Category;
  type: TransactionType;
  onClose: () => void;
}) {
  const ledger = useLedger();
  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const uses = ledger.data.transactions.filter(
    row => row.categoryId === category?.id,
  ).length;
  const save = async () => {
    try {
      await ledger.saveCategory(type, name, category?.id);
      Keyboard.dismiss();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async () => {
    if (!category) {
      return;
    }
    try {
      await ledger.deleteCategory(category.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <BottomSheet
      title={category ? '카테고리 수정' : '카테고리 추가'}
      onClose={onClose}
      busy={ledger.saving}
    >
      <Text style={ui.label}>유형</Text>
      <View style={styles.type}>
        <Text style={styles.typeText}>
          {type === 'income' ? '수입' : '지출'} 카테고리
        </Text>
      </View>
      <Text style={ui.label}>카테고리 이름</Text>
      <TextInput
        accessibilityLabel="카테고리 이름"
        value={name}
        onChangeText={setName}
        style={ui.input}
        placeholder="카테고리 이름 입력"
        placeholderTextColor="#aaa"
        maxLength={20}
        editable={!ledger.saving}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={save}
        disabled={ledger.saving}
        style={[ui.primary, ledger.saving && ui.disabled]}
      >
        <Text style={ui.primaryText}>
          {ledger.saving
            ? '저장 중…'
            : category
            ? '이름 변경 저장'
            : '카테고리 추가'}
        </Text>
      </Pressable>
      {category && !confirm && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: uses > 0 || ledger.saving }}
          onPress={() => setConfirm(true)}
          disabled={uses > 0 || ledger.saving}
          style={[ui.secondary, (uses > 0 || ledger.saving) && ui.disabled]}
        >
          <Text style={ui.secondaryText}>카테고리 삭제</Text>
        </Pressable>
      )}
      {uses > 0 && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            거래 {uses}건에서 사용 중이므로 삭제할 수 없습니다. 이름 변경은 기존
            거래에도 적용됩니다.
          </Text>
        </View>
      )}
      {confirm && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>이 카테고리를 삭제할까요?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={remove}
            disabled={ledger.saving}
            style={[ui.primary, styles.confirm]}
          >
            <Text style={ui.primaryText}>삭제 확인</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirm(false)}
            disabled={ledger.saving}
            style={ui.secondary}
          >
            <Text style={ui.secondaryText}>삭제 취소</Text>
          </Pressable>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        disabled={ledger.saving}
        style={ui.secondary}
      >
        <Text style={ui.secondaryText}>취소</Text>
      </Pressable>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  type: {
    backgroundColor: '#f7f7f7',
    padding: 13,
    borderRadius: 10,
    marginBottom: 20,
  },
  typeText: { fontSize: 13, fontWeight: '600', color: colors.text },
  warning: {
    backgroundColor: '#f7f7f7',
    borderRadius: 9,
    padding: 12,
    marginTop: 10,
  },
  warningText: { fontSize: 11, lineHeight: 18, color: '#888' },
  confirm: { marginTop: 12 },
});
