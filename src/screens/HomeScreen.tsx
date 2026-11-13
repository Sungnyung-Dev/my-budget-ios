import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CategoryBars,
  EmptyState,
  Header,
  PeriodNav,
  Section,
  TransactionRow,
} from '../components/Common';
import { colors, ui } from '../components/theme';
import {
  forMonth,
  formatMoney,
  getTotals,
  recentTransactions,
  signedMoney,
} from '../domain/selectors';
import { Transaction } from '../domain/types';
import { useLedger } from '../state/LedgerProvider';
export function HomeScreen({
  date,
  onShift,
  onHistory,
  onTransaction,
}: {
  date: string;
  onShift: (delta: number) => void;
  onHistory: () => void;
  onTransaction: (row: Transaction) => void;
}) {
  const { data } = useLedger();
  const rows = forMonth(data.transactions, date),
    totals = getTotals(rows);
  const recent = recentTransactions(rows).slice(0, 3);
  return (
    <>
      <Header title="홈" subtitle="이번 달 가계부를 한눈에" />
      <PeriodNav date={date} onShift={onShift} />
      <View style={styles.hero}>
        <Text style={ui.small}>이번 달 지출</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={styles.money}
        >
          ₩ {formatMoney(totals.expense)}
        </Text>
        <View style={styles.balance}>
          <Text style={ui.small}>수입 − 지출</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.balanceValue}
          >
            {signedMoney(totals.balance)}원
          </Text>
        </View>
      </View>
      <View style={styles.miniStats}>
        <View style={styles.statBox}>
          <Text style={ui.small}>이번 달 수입</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={styles.statValue}
          >
            {formatMoney(totals.income)}원
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={ui.small}>거래 건수</Text>
          <Text style={styles.statValue}>{rows.length}건</Text>
        </View>
      </View>
      <Section title="카테고리별 지출" />
      <CategoryBars rows={rows} categories={data.categories} />
      <Section
        title="최근 거래"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="전체 내역 보기"
            onPress={onHistory}
            style={styles.link}
          >
            <Text style={ui.muted}>전체 보기 ›</Text>
          </Pressable>
        }
      />
      {recent.length ? (
        recent.map(row => (
          <TransactionRow
            key={row.id}
            transaction={row}
            category={data.categories.find(
              category => category.id === row.categoryId,
            )}
            onPress={() => onTransaction(row)}
            showDate
          />
        ))
      ) : (
        <EmptyState text="최근 거래가 없습니다." />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.card,
    borderRadius: 17,
    paddingVertical: 23,
    paddingHorizontal: 21,
    marginBottom: 11,
  },
  money: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginTop: 9,
    marginBottom: 20,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  balance: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  balanceValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  miniStats: { flexDirection: 'row', gap: 9 },
  statBox: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.text,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  link: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
});
