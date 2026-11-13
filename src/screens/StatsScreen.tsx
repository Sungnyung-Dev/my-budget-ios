import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  CategoryBars,
  Header,
  PeriodNav,
  Section,
  SegmentedControl,
  Summary,
} from '../components/Common';
import { YearChart } from '../components/YearChart';
import { ui } from '../components/theme';
import { dateParts } from '../domain/dates';
import {
  forMonth,
  forYear,
  formatMoney,
  getTotals,
  spendingMetrics,
} from '../domain/selectors';
import { useLedger } from '../state/LedgerProvider';
export function StatsScreen({
  date,
  onShift,
  onYearShift,
}: {
  date: string;
  onShift: (delta: number) => void;
  onYearShift: (delta: number) => void;
}) {
  const { data } = useLedger();
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const { year, month } = dateParts(date);
  const rows =
    mode === 'month'
      ? forMonth(data.transactions, date)
      : forYear(data.transactions, year);
  const metrics = spendingMetrics(rows);
  const activeMonths = new Set(rows.map(row => row.date.slice(0, 7))).size;
  const info: [string, string][] =
    mode === 'month'
      ? [
          ['지출 건수', `${metrics.count}건`],
          ['지출한 날짜', `${metrics.days}일`],
          ['지출일 평균', `${formatMoney(metrics.dailyAverage)}원`],
        ]
      : [
          ['기록된 월', `${activeMonths}개월`],
          [
            '기록된 월 평균 지출',
            `${formatMoney(
              activeMonths
                ? Math.round(getTotals(rows).expense / activeMonths)
                : 0,
            )}원`,
          ],
        ];
  return (
    <>
      <Header title="통계" subtitle="수입과 소비 흐름을 분석하세요" />
      <SegmentedControl
        value={mode}
        options={[
          { value: 'month', label: '월간' },
          { value: 'year', label: '연간' },
        ]}
        onChange={setMode}
      />
      <PeriodNav
        date={date}
        yearOnly={mode === 'year'}
        onShift={mode === 'year' ? onYearShift : onShift}
      />
      <Summary rows={rows} />
      {mode === 'year' && (
        <YearChart key={year} rows={rows} year={year} initialMonth={month} />
      )}
      {mode === 'month' && (
        <>
          <Section title="카테고리별 지출" />
          <CategoryBars rows={rows} categories={data.categories} />
        </>
      )}
      <Section title={mode === 'month' ? '이달의 소비 정보' : '연간 요약'} />
      {info.map(([label, value]) => (
        <View key={label} style={ui.row}>
          <Text style={ui.rowLabel}>{label}</Text>
          <Text style={ui.rowValue}>{value}</Text>
        </View>
      ))}
      {mode === 'year' && (
        <>
          <Section title="연간 카테고리별 지출" />
          <CategoryBars rows={rows} categories={data.categories} />
        </>
      )}
    </>
  );
}
