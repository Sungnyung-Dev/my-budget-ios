import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Header } from '../components/Common';
import { Icon } from '../components/Icon';
import { LedgerDataTools } from '../components/LedgerDataTools';
import { colors, ui } from '../components/theme';
import { Category, TransactionType } from '../domain/types';
import { useLedger } from '../state/LedgerProvider';
export function SettingsScreen({ onCategories }: { onCategories: () => void }) {
  return (
    <>
      <Header title="설정" subtitle="가계부를 내 방식대로 관리하세요" />
      <Text style={styles.label}>관리</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onCategories}
        style={ui.row}
      >
        <Text style={ui.rowLabel}>카테고리 관리</Text>
        <Icon name="chevronRight" size={17} color="#aaa" />
      </Pressable>
      <Text style={styles.label}>기본 설정</Text>
      <SettingRow label="통화 단위" value="대한민국 원 (KRW)" />
      <SettingRow label="날짜 형식" value="YYYY-MM-DD" />
      <Text style={styles.label}>데이터</Text>
      <LedgerDataTools />
      <SettingRow label="데이터 복원" value="미지원 · 추후 제공" />
      <Text style={styles.label}>정보</Text>
      <SettingRow label="앱 버전" value="1.0 · 로컬 데모" />
      <Text style={ui.note}>
        데모 거래로 시작하며 변경사항은 이 기기에 저장됩니다. 앱을 삭제하면
        저장된 데이터도 삭제됩니다.
      </Text>
    </>
  );
}
function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={ui.row}>
      <Text style={ui.rowLabel}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
export function CategoriesScreen({
  onBack,
  onEdit,
  onAdd,
}: {
  onBack: () => void;
  onEdit: (category: Category) => void;
  onAdd: (type: TransactionType) => void;
}) {
  const { data } = useLedger();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="설정으로 돌아가기"
        onPress={onBack}
        style={styles.back}
      >
        <Icon name="chevronLeft" size={16} color="#666" />
        <Text style={styles.backText}>설정으로</Text>
      </Pressable>
      <Header
        title="카테고리 관리"
        subtitle="카테고리를 추가하거나 이름을 변경하세요"
      />
      {(['expense', 'income'] as const).map(type => (
        <View key={type}>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>
              {type === 'expense' ? '지출' : '수입'} 카테고리
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${
                type === 'expense' ? '지출' : '수입'
              } 카테고리 추가`}
              onPress={() => onAdd(type)}
              style={styles.add}
            >
              <Text style={styles.addText}>+ 추가</Text>
            </Pressable>
          </View>
          {data.categories
            .filter(category => category.type === type)
            .map(category => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={`${category.name}, 카테고리 수정`}
                onPress={() => onEdit(category)}
                style={ui.row}
              >
                <View style={styles.categoryInfo}>
                  <Text numberOfLines={1} style={styles.categoryName}>
                    {category.name}
                  </Text>
                  <Text style={styles.count}>
                    {
                      data.transactions.filter(
                        row => row.categoryId === category.id,
                      ).length
                    }
                    건 사용
                  </Text>
                </View>
                <Icon name="chevronRight" size={16} color="#aaa" />
              </Pressable>
            ))}
          {!data.categories.some(category => category.type === type) && (
            <EmptyState text="카테고리를 추가해 주세요." />
          )}
        </View>
      ))}
      <Text style={ui.note}>
        사용 중인 카테고리는 삭제할 수 없습니다. 이름을 변경하면 연결된 모든
        거래와 통계에도 반영됩니다.
      </Text>
    </>
  );
}
const styles = StyleSheet.create({
  label: {
    color: '#999',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 24,
    marginBottom: 6,
  },
  value: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'right',
    flexShrink: 1,
  },
  back: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: -7,
    marginBottom: 10,
  },
  backText: { fontSize: 12, color: '#666' },
  group: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 6,
  },
  groupTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  add: {
    minHeight: 44,
    paddingHorizontal: 13,
    backgroundColor: colors.card,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addText: { fontSize: 11, color: '#333' },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  count: { fontSize: 10, color: '#999' },
});
