import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dateKey, dateParts, daysInMonth, todayKey } from '../domain/dates';
import { Transaction } from '../domain/types';
import { colors } from './theme';
export function Calendar({
  date,
  rows,
  onSelect,
}: {
  date: string;
  rows: Transaction[];
  onSelect: (date: string) => void;
}) {
  const { year, month, day } = dateParts(date);
  const start = new Date(year, month - 1, 1).getDay();
  const days = daysInMonth(year, month);
  const today = todayKey();
  return (
    <View>
      <View style={styles.weekdays}>
        {[...'일월화수목금토'].map(label => (
          <Text key={label} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: Math.ceil((start + days) / 7) * 7 }, (_, i) => {
          const d = i - start + 1;
          if (d < 1 || d > days) {
            return <View key={i} style={styles.day} />;
          }
          const key = dateKey(year, month, d),
            records = rows.filter(row => row.date === key),
            selected = d === day;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${year}년 ${month}월 ${d}일${
                today === key ? ', 오늘' : ''
              }, 거래 ${records.length}건`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(key)}
              style={styles.day}
            >
              <View
                style={[
                  styles.dayNumber,
                  today === key && styles.today,
                  selected && styles.selected,
                ]}
              >
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={[styles.dayText, selected && styles.selectedText]}
                >
                  {d}
                </Text>
              </View>
              <View style={styles.dots}>
                {records.some(row => row.type === 'expense') && (
                  <View style={styles.dot} />
                )}
                {records.some(row => row.type === 'income') && (
                  <View style={[styles.dot, styles.incomeDot]} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.dot} />
        <Text style={styles.legendText}>지출</Text>
        <View style={[styles.dot, styles.incomeDot]} />
        <Text style={styles.legendText}>수입 · 거래가 있는 날짜</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  weekdays: { flexDirection: 'row', marginBottom: 5 },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: `${100 / 7}%`,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dayNumber: {
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  today: { borderColor: '#d5d5d5' },
  selected: { backgroundColor: '#1b1b1b', borderColor: '#1b1b1b' },
  dayText: { fontSize: 13, color: colors.text },
  selectedText: { color: 'white', fontWeight: '700' },
  dots: { height: 4, flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#555' },
  incomeDot: { backgroundColor: '#bdbdbd' },
  legend: {
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 3,
  },
  legendText: { fontSize: 10, color: '#aaa', marginRight: 3 },
});
