import React from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Renderer, { act, ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerApp } from '../src/LedgerApp';
import { LedgerProvider } from '../src/state/LedgerProvider';
import { createMockData } from '../src/data/mockData';
import { LedgerRepository } from '../src/data/ledgerRepository';
import { LedgerData } from '../src/domain/types';
import { getTotals, forMonth } from '../src/domain/selectors';
import { todayKey } from '../src/domain/dates';

const textOf = (node: ReactTestInstance): string =>
  node.children
    .map(child => (typeof child === 'string' ? child : textOf(child)))
    .join('');
let tree: Renderer.ReactTestRenderer;
let stored: LedgerData;
let repository: LedgerRepository;
const button = (label: string) =>
  tree.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(
      node => node.props.accessibilityLabel === label || textOf(node) === label,
    )!;
const press = async (label: string) => {
  const node = button(label);
  expect(node).toBeDefined();
  await act(async () => {
    await node.props.onPress();
  });
};
const change = async (label: string, value: string) => {
  await act(async () => {
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === label)!
      .props.onChangeText(value);
  });
};
const hasText = (text: string) =>
  tree.root.findAllByType(Text).some(node => textOf(node).includes(text));

beforeEach(async () => {
  stored = createMockData();
  repository = {
    load: async () => stored,
    save: jest.fn(async (next: LedgerData) => {
      stored = next;
    }),
  };
  await act(async () => {
    tree = Renderer.create(
      <SafeAreaProvider>
        <LedgerProvider repository={repository}>
          <LedgerApp />
        </LedgerProvider>
      </SafeAreaProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => {
    tree.unmount();
  });
});

test('calendar navigation, selected date, transaction CRUD and totals stay consistent across tabs', async () => {
  expect(hasText('달력에서 날짜를 선택')).toBe(true);
  await press('이전 월');
  await press('다음 월');
  const selected = `${todayKey().slice(0, 7)}-12`;
  const { year, month } = {
    year: Number(selected.slice(0, 4)),
    month: Number(selected.slice(5, 7)),
  };
  const day = tree.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(node =>
      node.props.accessibilityLabel?.startsWith(`${year}년 ${month}월 12일`),
    )!;
  await act(async () => day.props.onPress());
  const before = getTotals(forMonth(stored.transactions, selected));
  await press('선택한 날짜에 거래 추가');
  expect(hasText('기록 날짜')).toBe(true);
  await press('거래 저장');
  expect(hasText('금액은 소수점 없이')).toBe(true);
  await change('거래 금액', '12345');
  await change('거래 내용 또는 메모', '테스트 저녁');
  await press('거래 저장');
  const added = stored.transactions.at(-1)!;
  expect(added.date).toBe(selected);
  expect(getTotals(forMonth(stored.transactions, selected)).expense).toBe(
    before.expense + 12345,
  );
  await press('홈');
  expect(hasText('테스트 저녁')).toBe(true);
  await press('전체 내역 보기');
  await press(`테스트 저녁, 지출 12,345원, ${selected}, 상세 및 수정`);
  await change('거래 금액', '15000');
  await press('변경사항 저장');
  expect(stored.transactions.find(row => row.id === added.id)?.amount).toBe(
    15000,
  );
  await press('통계');
  expect(hasText('이달의 소비 정보')).toBe(true);
  await press('연간');
  expect(hasText('월별 수입·지출 추이')).toBe(true);
  const chartContainer = tree.root
    .findAllByType(View)
    .find(node => !!node.props.onLayout)!;
  for (const width of [276, 536, 346]) {
    await act(async () => {
      chartContainer.props.onLayout({ nativeEvent: { layout: { width } } });
    });
    expect(
      tree.root.findAllByType(ScrollView).find(node => node.props.horizontal)!
        .props.snapToInterval,
    ).toBe(width);
  }
  const chart = tree.root
    .findAllByType(ScrollView)
    .find(node => node.props.horizontal)!;
  expect(chart.props.snapToInterval).toBe(346);
  await act(async () =>
    chart.props.onScroll({ nativeEvent: { contentOffset: { x: 346 } } }),
  );
  expect(hasText('5–8월')).toBe(true);
  const january = tree.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(node => node.props.accessibilityLabel?.startsWith('1월,'))!;
  await act(async () => january.props.onPress());
  expect(hasText('1월 상세')).toBe(true);
  await press('이전 연도');
  await press('다음 연도');
  await press('월간');
  await press('내역');
  await press(`테스트 저녁, 지출 15,000원, ${selected}, 상세 및 수정`);
  await press('거래 삭제');
  await press('삭제 확인');
  expect(stored.transactions.some(row => row.id === added.id)).toBe(false);
  expect(getTotals(forMonth(stored.transactions, selected))).toEqual(before);
});
test('failed storage keeps editor open and totals intact, then allows retry and income selection', async () => {
  const before = stored.transactions.length;
  jest.spyOn(repository, 'save').mockRejectedValueOnce(new Error('disk full'));
  await press('선택한 날짜에 거래 추가');
  await press('수입');
  await change('거래 금액', '50000');
  await press('거래 저장');
  expect(hasText('변경사항을 저장하지 못했습니다')).toBe(true);
  expect(stored.transactions).toHaveLength(before);
  await press('거래 저장');
  expect(stored.transactions).toHaveLength(before + 1);
  expect(stored.transactions.at(-1)?.type).toBe('income');
  expect(stored.transactions.at(-1)?.categoryId).toBe('salary');
});
test('cancelling an entry does not create a transaction', async () => {
  const before = stored.transactions.length;
  await press('선택한 날짜에 거래 추가');
  await change('거래 금액', '9999');
  await press('취소');
  expect(stored.transactions).toHaveLength(before);
  expect(hasText('거래 저장')).toBe(false);
});
test('category CRUD, duplicate checks, used-category guard and rename in existing transactions', async () => {
  await press('설정');
  await press('카테고리 관리');
  await press('지출 카테고리 추가');
  await change('카테고리 이름', '식비');
  await press('카테고리 추가');
  expect(hasText('이미 있는')).toBe(true);
  await change('카테고리 이름', '반려동물');
  await press('카테고리 추가');
  const added = stored.categories.at(-1)!;
  expect(added.name).toBe('반려동물');
  await press('반려동물, 카테고리 수정');
  await change('카테고리 이름', '취미');
  await press('이름 변경 저장');
  await press('취미, 카테고리 수정');
  await press('카테고리 삭제');
  await press('삭제 확인');
  expect(stored.categories.some(category => category.id === added.id)).toBe(
    false,
  );
  await press('식비, 카테고리 수정');
  expect(button('카테고리 삭제').props.disabled).toBe(true);
  await change('카테고리 이름', '식사');
  await press('이름 변경 저장');
  expect(stored.categories.find(category => category.id === 'food')?.name).toBe(
    '식사',
  );
  await press('홈');
  expect(hasText('식사')).toBe(true);
});
