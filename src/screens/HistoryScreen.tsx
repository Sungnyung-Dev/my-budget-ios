import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar } from '../components/Calendar';
import {
  EmptyState,
  Header,
  PeriodNav,
  Section,
  Summary,
  TransactionRow,
} from '../components/Common';
import { ui } from '../components/theme';
import { dateParts, weekday } from '../domain/dates';
import {
  forMonth,
  formatMoney,
  getTotals,
  recentTransactions,
} from '../domain/selectors';
import { Transaction } from '../domain/types';
import { useLedger } from '../state/LedgerProvider';
export function HistoryScreen({
  date,
  onShift,
  onSelect,
  onTransaction,
}: {
  date: string;
  onShift: (delta: number) => void;
  onSelect: (date: string) => void;
  onTransaction: (row: Transaction) => void;
}) {
  const { data } = useLedger();
  const rows = forMonth(data.transactions, date),
    daily = recentTransactions(rows.filter(row => row.date === date));
  const totals = getTotals(daily),
    { month, day } = dateParts(date);
  return (
    <>
      <Header
        title="내역"
        subtitle="달력에서 날짜를 선택해 기록을 확인하세요"
      />
      <PeriodNav date={date} onShift={onShift} />
      <Summary rows={rows} />
      <Calendar date={date} rows={rows} onSelect={onSelect} />
      <View style={ui.divider} />
      <Section
        title={`${month}월 ${day}일 · ${weekday(date)}요일`}
        right={<Text style={ui.muted}>{daily.length}건</Text>}
      />
      <View style={styles.meta}>
        <Text style={ui.small}>수입 +{formatMoney(totals.income)}</Text>
        <Text style={ui.small}>지출 −{formatMoney(totals.expense)}</Text>
      </View>
      {daily.length ? (
        daily.map(row => (
          <TransactionRow
            key={row.id}
            transaction={row}
            category={data.categories.find(
              category => category.id === row.categoryId,
            )}
            onPress={() => onTransaction(row)}
          />
        ))
      ) : (
        <EmptyState
          text={
            '선택한 날짜에 거래가 없습니다.\n+ 버튼으로 새 거래를 추가해 보세요.'
          }
        />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  meta: { flexDirection: 'row', gap: 12, marginTop: -5, marginBottom: 13 },
});
