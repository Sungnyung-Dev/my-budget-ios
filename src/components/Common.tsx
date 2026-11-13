import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dateParts } from '../domain/dates';
import {
  categorySpending,
  formatMoney,
  getTotals,
  signedMoney,
} from '../domain/selectors';
import { Category, Transaction } from '../domain/types';
import { Icon } from './Icon';
import { colors, ui } from './theme';

export function Header({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={ui.header}>
      <Text style={ui.eyebrow}>MY LEDGER</Text>
      <Text accessibilityRole="header" style={ui.title}>
        {title}
      </Text>
      <Text style={ui.subtitle}>{subtitle}</Text>
    </View>
  );
}
export function PeriodNav({
  date,
  yearOnly = false,
  onShift,
}: {
  date: string;
  yearOnly?: boolean;
  onShift: (delta: number) => void;
}) {
  const { year, month } = dateParts(date);
  return (
    <View style={styles.period}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`이전 ${yearOnly ? '연도' : '월'}`}
        disabled={yearOnly ? year <= 1900 : year <= 1900 && month === 1}
        onPress={() => onShift(-1)}
        style={styles.chevronTouch}
      >
        <View style={styles.chevron}>
          <Icon name="chevronLeft" size={18} color="#555" />
        </View>
      </Pressable>
      <Text accessibilityRole="header" style={styles.periodTitle}>
        {year}년{!yearOnly && ` ${month}월`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`다음 ${yearOnly ? '연도' : '월'}`}
        disabled={yearOnly ? year >= 9999 : year >= 9999 && month === 12}
        onPress={() => onShift(1)}
        style={styles.chevronTouch}
      >
        <View style={styles.chevron}>
          <Icon name="chevronRight" size={18} color="#555" />
        </View>
      </Pressable>
    </View>
  );
}
export function Summary({ rows }: { rows: Transaction[] }) {
  const totals = getTotals(rows);
  return (
    <View style={styles.summary}>
      {[
        ['수입', totals.income],
        ['지출', totals.expense],
        ['수입 − 지출', totals.balance],
      ].map(([label, value], i) => (
        <View
          key={label}
          style={[styles.sumCell, i > 0 && styles.sumBorder]}
          accessible
          accessibilityLabel={`${label} ${
            Number(value) < 0 ? '마이너스 ' : ''
          }${formatMoney(Number(value))}원`}
        >
          <Text style={styles.sumLabel}>{label}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            style={styles.sumValue}
          >
            {Number(value) < 0 ? '−' : ''}
            {formatMoney(Number(value))}
          </Text>
        </View>
      ))}
    </View>
  );
}
export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}
export function Section({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={ui.section}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>
        {title}
      </Text>
      {right}
    </View>
  );
}
export function CategoryBars({
  rows,
  categories,
}: {
  rows: Transaction[];
  categories: Category[];
}) {
  const spending = categorySpending(rows, categories);
  return spending.length ? (
    <View>
      {spending.map(({ category, amount, ratio }, index) => (
        <View
          key={category.id}
          style={styles.barRow}
          accessible
          accessibilityLabel={`${category.name} ${formatMoney(amount)}원, ${(
            ratio * 100
          ).toFixed(1)}퍼센트`}
        >
          <View style={styles.barText}>
            <Text numberOfLines={1} style={styles.barName}>
              {category.name}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.barAmount}
            >
              {formatMoney(amount)}원 · {Math.round(ratio * 100)}%
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${ratio * 100}%`,
                  backgroundColor: ['#444', '#666', '#888', '#a0a0a0'][
                    Math.min(index, 3)
                  ],
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  ) : (
    <EmptyState text="이 기간의 지출 내역이 없습니다." />
  );
}
export function TransactionRow({
  transaction,
  category,
  onPress,
  showDate = false,
}: {
  transaction: Transaction;
  category?: Category;
  onPress: () => void;
  showDate?: boolean;
}) {
  const name = transaction.memo || category?.name || '거래';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${
        transaction.type === 'income' ? '수입' : '지출'
      } ${formatMoney(transaction.amount)}원, ${
        transaction.date
      }, 상세 및 수정`}
      onPress={onPress}
      style={({ pressed }) => [styles.transaction, pressed && styles.pressed]}
    >
      <View style={styles.txLeft}>
        <View style={styles.txIcon}>
          <Icon name={category?.symbol ?? 'other'} size={18} color="#606060" />
        </View>
        <View style={styles.txText}>
          <Text numberOfLines={1} style={styles.txName}>
            {name}
          </Text>
          <Text numberOfLines={1} style={styles.txCategory}>
            {category?.name ?? '카테고리 없음'}
            {showDate && ` · ${transaction.date.slice(5).replace('-', '.')}`}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        style={[
          styles.txAmount,
          transaction.type === 'income' && styles.income,
        ]}
      >
        {signedMoney(
          transaction.type === 'income'
            ? transaction.amount
            : -transaction.amount,
        )}
        원
      </Text>
    </Pressable>
  );
}
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map(option => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[
            styles.segmentItem,
            value === option.value && styles.segmentActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              value === option.value && styles.segmentSelected,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  period: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
    marginHorizontal: -6,
  },
  periodTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.text,
  },
  chevronTouch: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#f6f6f6',
    borderRadius: 15,
    paddingVertical: 17,
    paddingHorizontal: 5,
    marginBottom: 22,
  },
  sumCell: {
    flex: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sumBorder: { borderLeftWidth: 1, borderLeftColor: '#e3e3e3' },
  sumLabel: { fontSize: 10, color: '#888', marginBottom: 8 },
  sumValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.55,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderStyle: 'dashed',
    borderRadius: 13,
    paddingVertical: 23,
    paddingHorizontal: 11,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    lineHeight: 22,
  },
  barRow: { marginVertical: 9 },
  barText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  barName: { fontSize: 11, color: colors.text, flex: 1 },
  barAmount: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 7,
    borderRadius: 5,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  barFill: { height: 7, borderRadius: 5 },
  transaction: {
    minHeight: 63,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pressed: { opacity: 0.55 },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  txIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txText: { flex: 1 },
  txName: { fontSize: 13, fontWeight: '600', color: colors.text },
  txCategory: { fontSize: 11, color: colors.muted, marginTop: 4 },
  txAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    maxWidth: '48%',
  },
  income: { color: '#666' },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#f4f4f4',
    borderRadius: 11,
    padding: 4,
    gap: 3,
    marginBottom: 20,
  },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { fontSize: 12, color: '#888' },
  segmentSelected: { fontWeight: '700', color: colors.text },
});
