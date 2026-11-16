import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategorySheet } from './components/CategorySheet';
import { Icon, IconName } from './components/Icon';
import { ServerSyncNotice } from './components/ServerSyncNotice';
import { TransactionSheet } from './components/TransactionSheet';
import { colors, ui } from './components/theme';
import {
  dateKey,
  dateParts,
  daysInMonth,
  shiftMonth,
  todayKey,
} from './domain/dates';
import { Category, Transaction, TransactionType } from './domain/types';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { CategoriesScreen, SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { useLedger } from './state/LedgerProvider';
type Tab = 'home' | 'history' | 'stats' | 'settings';
const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'history', label: '내역', icon: 'history' },
  { id: 'stats', label: '통계', icon: 'stats' },
  { id: 'settings', label: '설정', icon: 'settings' },
];
type Sheet =
  | { kind: 'transaction'; transaction?: Transaction; date: string }
  | { kind: 'category'; category?: Category; type: TransactionType }
  | null;
export function LedgerApp() {
  const { status, loadError, reload, saving, refreshing, needsRefresh } =
    useLedger();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('history');
  const [categories, setCategories] = useState(false);
  const [date, setDate] = useState(todayKey);
  const [sheet, setSheet] = useState<Sheet>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    opacity.setValue(0.5);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [tab, categories, opacity]);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (categories) {
        setCategories(false);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [tab, categories]);
  const changeTab = (next: Tab) => {
    setTab(next);
    setCategories(false);
  };
  const moveMonth = (delta: number) =>
    setDate(current => shiftMonth(current, delta));
  const moveYear = (delta: number) =>
    setDate(current => {
      const { year, month, day } = dateParts(current),
        next = year + delta;
      return dateKey(next, month, Math.min(day, daysInMonth(next, month)));
    });
  const editTransaction = (transaction: Transaction) => {
    setDate(transaction.date);
    setSheet({ kind: 'transaction', transaction, date: transaction.date });
  };
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {status !== 'ready' ? (
        <View style={styles.loading}>
          {status === 'loading' ? (
            <>
              <ActivityIndicator color={colors.text} />
              <Text style={styles.loadingText}>가계부를 불러오는 중</Text>
            </>
          ) : (
            <>
              <Text accessibilityRole="alert" style={styles.error}>
                {loadError}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={reload}
                style={ui.primary}
              >
                <Text style={ui.primaryText}>다시 시도</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <>
          {!sheet && (
            <View style={styles.syncNotice}>
              <ServerSyncNotice />
            </View>
          )}
          <View style={styles.body}>
            <Animated.View style={[styles.content, { opacity }]}>
              <ScrollView
                key={`${tab}-${categories}`}
                contentContainerStyle={ui.page}
                showsVerticalScrollIndicator={false}
                contentInsetAdjustmentBehavior="never"
                keyboardShouldPersistTaps="handled"
              >
                {tab === 'home' && (
                  <HomeScreen
                    date={date}
                    onShift={moveMonth}
                    onHistory={() => changeTab('history')}
                    onTransaction={editTransaction}
                  />
                )}
                {tab === 'history' && (
                  <HistoryScreen
                    date={date}
                    onShift={moveMonth}
                    onSelect={setDate}
                    onTransaction={editTransaction}
                  />
                )}
                {tab === 'stats' && (
                  <StatsScreen
                    date={date}
                    onShift={moveMonth}
                    onYearShift={moveYear}
                  />
                )}
                {tab === 'settings' &&
                  (categories ? (
                    <CategoriesScreen
                      onBack={() => setCategories(false)}
                      onEdit={category =>
                        setSheet({
                          kind: 'category',
                          category,
                          type: category.type,
                        })
                      }
                      onAdd={type => setSheet({ kind: 'category', type })}
                    />
                  ) : (
                    <SettingsScreen onCategories={() => setCategories(true)} />
                  ))}
              </ScrollView>
            </Animated.View>
            {tab === 'history' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="선택한 날짜에 거래 추가"
                testID="add-transaction"
                disabled={saving || refreshing || needsRefresh}
                onPress={() => setSheet({ kind: 'transaction', date })}
                style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
              >
                <Icon name="plus" size={26} color="white" />
              </Pressable>
            )}
          </View>
          <View
            style={[
              styles.tabBar,
              { paddingBottom: Math.max(insets.bottom, 10) },
            ]}
          >
            {tabs.map(item => (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: tab === item.id }}
                onPress={() => changeTab(item.id)}
                style={styles.tab}
              >
                <Icon
                  name={item.icon}
                  color={tab === item.id ? '#111' : '#a0a0a0'}
                />
                <Text
                  maxFontSizeMultiplier={1.5}
                  style={[styles.tabLabel, tab === item.id && styles.activeTab]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {sheet?.kind === 'transaction' && (
        <TransactionSheet
          transaction={sheet.transaction}
          date={sheet.date}
          onClose={() => setSheet(null)}
          onManageCategories={() => {
            setSheet(null);
            setTab('settings');
            setCategories(true);
          }}
        />
      )}
      {sheet?.kind === 'category' && (
        <CategorySheet
          category={sheet.category}
          type={sheet.type}
          onClose={() => setSheet(null)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  syncNotice: { paddingHorizontal: 22 },
  root: { flex: 1, backgroundColor: colors.white },
  body: { flex: 1 },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 9,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  tab: {
    flex: 1,
    minHeight: 45,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabLabel: { fontSize: 10, color: '#a0a0a0' },
  activeTab: { color: '#111', fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 18,
    right: 22,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.65 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    gap: 16,
  },
  loadingText: { fontSize: 12, color: colors.muted },
  error: {
    fontSize: 13,
    color: colors.secondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 10,
  },
});
