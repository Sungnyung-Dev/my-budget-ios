import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { CategorySymbol } from '../domain/types';
export type IconName =
  | CategorySymbol
  | 'history'
  | 'stats'
  | 'settings'
  | 'chevronLeft'
  | 'chevronRight'
  | 'plus'
  | 'close'
  | 'back';
const paths: Partial<Record<IconName, string>> = {
  home: 'M3 10 12 3 21 10v10h-6v-7H9v7H3z',
  history: 'M7 3v4m10-4v4M3 10h18',
  stats: 'M21 12a9 9 0 1 1-9-9v9z M15 3.5A9 9 0 0 1 20.5 9H15z',
  settings: 'M4 6h16M4 12h16M4 18h16',
  food: 'M5 3v6c0 3 5 3 5 0V3M7.5 3v18M18 21V3c-4 2-4 9 0 9',
  coffee:
    'M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 9h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2',
  transport:
    'M5 17h14V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2zM5 10h14M8 17v3m8-3v3M8 14h1m6 0h1',
  shopping: 'M5 7h14l1 14H4zM8 7V6a4 4 0 0 1 8 0v1',
  living: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4',
  income: 'M12 3v14m-5-5 5 5 5-5M5 21h14',
  chevronLeft: 'm14 6-6 6 6 6',
  chevronRight: 'm10 6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  back: 'm10 5-7 7 7 7M3 12h18',
};
export function Icon({
  name,
  size = 21,
  color = '#171717',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
    >
      {name === 'history' && <Rect x={3} y={5} width={18} height={16} rx={2} />}
      {paths[name] && <Path d={paths[name]} />}
      {name === 'settings' && (
        <>
          {[6, 12, 18].map((y, i) => (
            <Circle key={y} cx={i === 1 ? 15 : 9} cy={y} r={2} fill="white" />
          ))}
        </>
      )}
      {name === 'other' && (
        <>
          {[6, 12, 18].map(cx => (
            <Circle key={cx} cx={cx} cy={12} r={1} fill={color} />
          ))}
        </>
      )}
    </Svg>
  );
}
