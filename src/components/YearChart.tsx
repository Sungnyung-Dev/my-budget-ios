import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { formatMoney, yearlyMonths } from '../domain/selectors';
import { Transaction } from '../domain/types';
import { Section, Summary } from './Common';
import { Icon } from './Icon';
import { colors, ui } from './theme';
export function YearChart({
  rows,
  year,
  initialMonth,
}: {
  rows: Transaction[];
  year: number;
  initialMonth: number;
}) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(initialMonth);
  const [page, setPage] = useState(Math.floor((initialMonth - 1) / 4));
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const values = yearlyMonths(rows, year);
  const maximum = Math.max(
    1,
    ...values.flatMap(value => [value.income, value.expense]),
  );
  const step = width / 4,
    height = 160,
    bottom = 176,
    chartWidth = step * 12;
  const y = (amount: number) => bottom - (amount / maximum) * height;
  let path = '';
  values.forEach((value, i) => {
    if (value.count) {
      path += `${i > 0 && values[i - 1].count ? ' L' : ' M'}${
        (i + 0.5) * step
      },${y(value.income)}`;
    }
  });
  useEffect(() => {
    if (width) {
      scroll.current?.scrollTo({
        x: Math.floor((initialMonth - 1) / 4) * width,
        animated: false,
      });
    }
  }, [width, initialMonth]);
  const jump = (delta: number) => {
    const next = Math.max(0, Math.min(2, page + delta));
    setPage(next);
    scroll.current?.scrollTo({ x: next * width, animated: true });
  };
  const detailRows = rows.filter(
    row => Number(row.date.slice(5, 7)) === selected,
  );
  return (
    <>
      <Section title="월별 수입·지출 추이" />
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.barLegend} />
          <Text style={styles.legendText}>지출 · 막대</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.lineLegend}>
            <View style={styles.dotLegend} />
          </View>
          <Text style={styles.legendText}>수입 · 선</Text>
        </View>
      </View>
      <Text style={styles.axis}>
        단위: 원 · 최대 {maximum === 1 ? '0' : formatMoney(maximum)}
      </Text>
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <ScrollView
            ref={scroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width}
            decelerationRate="fast"
            disableIntervalMomentum
            directionalLockEnabled
            nestedScrollEnabled
            bounces={false}
            onScroll={event =>
              setPage(
                Math.max(
                  0,
                  Math.min(
                    2,
                    Math.round(event.nativeEvent.contentOffset.x / width),
                  ),
                ),
              )
            }
            scrollEventThrottle={32}
            accessibilityLabel="연간 수입 지출 차트, 좌우로 밀어 월 이동"
          >
            <View style={[styles.canvas, { width: chartWidth }]}>
              <Svg
                width={chartWidth}
                height={190}
                style={StyleSheet.absoluteFill}
                accessible={false}
              >
                <Rect
                  x={(selected - 1) * step + 4}
                  y={5}
                  width={Math.max(1, step - 8)}
                  height={181}
                  rx={8}
                  fill="#f8f8f8"
                />
                {[0, 0.333, 0.666, 1].map(fraction => (
                  <Line
                    key={fraction}
                    x1={0}
                    x2={chartWidth}
                    y1={bottom - height * fraction}
                    y2={bottom - height * fraction}
                    stroke="#eaeaea"
                    strokeWidth={1}
                  />
                ))}
                {values.map((value, i) => (
                  <Rect
                    key={value.month}
                    x={(i + 0.5) * step - 13}
                    y={y(value.expense)}
                    width={26}
                    height={(value.expense / maximum) * height}
                    rx={4}
                    fill={selected === value.month ? '#777' : '#aaa'}
                  />
                ))}
                {!!path && (
                  <Path
                    d={path}
                    stroke="#181818"
                    strokeWidth={2.3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
                {values
                  .filter(value => value.count)
                  .map(value => (
                    <Circle
                      key={value.month}
                      cx={(value.month - 0.5) * step}
                      cy={y(value.income)}
                      r={3.5}
                      fill="white"
                      stroke="#181818"
                      strokeWidth={2}
                    />
                  ))}
              </Svg>
              <View style={styles.months}>
                {values.map(value => (
                  <Pressable
                    key={value.month}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selected === value.month }}
                    accessibilityLabel={`${value.month}월, ${
                      value.count
                        ? `수입 ${formatMoney(
                            value.income,
                          )}원, 지출 ${formatMoney(value.expense)}원`
                        : '거래 없음'
                    }, 상세 금액 확인`}
                    onPress={() => setSelected(value.month)}
                    style={[styles.monthButton, { width: step }]}
                  >
                    <Text
                      style={[
                        styles.monthLabel,
                        !value.count && styles.missing,
                        selected === value.month && styles.chosen,
                      ]}
                    >
                      {value.month}월
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </View>
      <View style={styles.pageNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 4개월"
          disabled={page === 0}
          onPress={() => jump(-1)}
          style={[styles.pageButton, page === 0 && ui.disabled]}
        >
          <Icon name="chevronLeft" size={14} />
          <Text style={styles.pageButtonText}>이전</Text>
        </Pressable>
        <Text style={styles.pageText}>
          {page * 4 + 1}–{page * 4 + 4}월 · 좌우로 밀어보세요
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 4개월"
          disabled={page === 2}
          onPress={() => jump(1)}
          style={[styles.pageButton, page === 2 && ui.disabled]}
        >
          <Text style={styles.pageButtonText}>다음</Text>
          <Icon name="chevronRight" size={14} />
        </Pressable>
      </View>
      <Text style={ui.note}>
        선과 막대는 같은 금액 축을 사용합니다. 월을 누르면 상세 금액을 확인할 수
        있습니다.
      </Text>
      <Section
        title={`${selected}월 상세`}
        right={
          <Text style={ui.muted}>
            {detailRows.length ? `${detailRows.length}건` : '거래 없음'}
          </Text>
        }
      />
      <Summary rows={detailRows} />
    </>
  );
}
const styles = StyleSheet.create({
  canvas: { height: 222 },
  monthButton: {
    height: 222,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 12,
  },
  legend: { flexDirection: 'row', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 11, color: '#777' },
  barLegend: { width: 12, height: 9, backgroundColor: '#888', borderRadius: 2 },
  lineLegend: {
    width: 17,
    height: 2,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLegend: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
  },
  axis: { fontSize: 10, color: '#aaa', marginTop: 14, marginBottom: 4 },
  months: { flexDirection: 'row' },
  monthLabel: { fontSize: 11, color: '#777' },
  missing: { color: '#bbb' },
  chosen: { color: colors.text, fontWeight: '800' },
  pageNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 5,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 44,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  pageButtonText: { fontSize: 12, color: '#555' },
  pageText: { fontSize: 10, color: '#aaa', flexShrink: 1, textAlign: 'center' },
});
