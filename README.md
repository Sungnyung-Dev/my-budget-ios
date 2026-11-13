# 나의 가계부 · React Native iOS

첨부된 `ios_ledger_final_ui.html`을 기준으로 만든 개인용 가계부 프론트엔드입니다. 기존 React Native 0.88.1 / React 19.3 / TypeScript 구성을 유지하고 네이티브 컴포넌트로 구현했습니다.

## 구현 기능

- **홈**: 선택 월의 수입·지출·차액, 카테고리별 지출, 최근 거래 3건, 내역 탭 이동.
- **내역**: 월 이동, 실제 달력과 거래 점, 날짜별 목록·빈 상태, 고정 + 버튼.
- **거래 시트**: 지출/수입, 정수 원화 검증, 카테고리, 메모, 저장·취소·수정·삭제 확인. 선택 날짜를 읽기 전용으로 표시하며 별도의 날짜/시간 선택은 없습니다.
- **월간 통계**: 합계, 카테고리 비율·막대, 지출 건수·지출일 수·지출일 평균.
- **연간 통계**: 연도 이동, 동일 금액 축의 지출 막대와 수입선, 4개월 단위 가로 스크롤·스냅, 월 선택 상세, 연간 요약.
- **설정**: 수입/지출 카테고리 CRUD, 중복 이름 검증, 사용 중인 카테고리 삭제 차단. 이름 변경 시 고유 ID 연결을 통해 거래와 통계에 반영됩니다.
- **공유 상태·저장**: 모든 화면은 동일한 거래·카테고리를 사용합니다. 최초 실행에만 현재 연도와 전년도 데모 거래를 생성합니다. 현재 월에는 오늘까지의 데모 거래를 넣고, 이후 변경사항은 기기에 저장합니다.
- **iOS UI**: 흰색·검정·회색, 시스템 폰트, Safe Area, 스크롤, 키보드 회피와 숫자 키보드 완료 버튼, 접근성 레이블, 삭제 확인, 저장 중 중복 요청 방지.

거래 날짜는 로컬 달력 기준 `YYYY-MM-DD` 문자열입니다. 거래에 시간 필드는 저장하지 않습니다. 금액은 1~999,999,999,999원의 정수이며, 메모는 100자, 카테고리 이름은 20자까지 지원합니다. 저장 실패 시 편집 화면과 기존 상태를 유지합니다. 손상된 저장 데이터를 데모 데이터로 덮어쓰지 않습니다.

## 실행

Node.js 22.11 이상, Ruby/Bundler, Xcode 및 iOS 플랫폼·시뮬레이터 런타임이 필요합니다.

```sh
npm ci
cp .env.example .env # 처음 설정할 때만 실행
bundle install
cd ios
bundle exec pod install
cd ..
npm start
```

별도 터미널에서 실행합니다.

```sh
npm run ios
```

또는 `ios/MyBudgetIOS.xcworkspace`를 Xcode에서 열어 설치된 시뮬레이터를 선택합니다. 실기기는 본인의 서명 설정이 필요합니다. 한글 프로젝트 경로에서도 CocoaPods가 Node의 경로 출력을 UTF-8로 처리하도록 `ios/Podfile`을 보완했습니다.

```sh
npm run typecheck
npm run lint
npm test -- --runInBand --watchman=false
```

## 환경변수

루트의 `.env`를 `react-native-dotenv` Babel 플러그인으로 읽습니다. `.env`와 환경별 로컬 파일은 Git에서 제외하고 `.env.example`만 공유합니다. 설정은 `src/config/env.ts`에서 타입을 갖춰 제공하며, 앱 코드에서는 `process.env` 대신 이 모듈을 사용합니다.

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `API_BASE_URL` | 비어 있음 | 향후 REST API 주소. 현재는 예약 항목이며 네트워크 요청에 사용하지 않습니다. |
| `SEED_DEMO_DATA` | `true` | 저장 데이터가 없는 최초 실행에서 데모 거래 생성. `false`면 기본 카테고리만 생성합니다. 기존 거래는 변경하거나 삭제하지 않습니다. |

`.env`를 수정한 뒤 Metro를 종료하고 `npm start -- --reset-cache`로 다시 시작합니다. 배포 앱에는 다시 번들링·빌드해야 반영됩니다. 값은 앱 번들에 포함되므로 서버 비밀번호나 비밀 키를 넣지 않습니다. 이 설정은 JavaScript용이며 `Info.plist`나 Gradle의 네이티브 환경변수를 설정하지 않습니다.

## 파일 구성

| 경로 | 역할 |
| --- | --- |
| `App.tsx` | Safe Area와 공유 상태 Provider 구성 |
| `src/LedgerApp.tsx` | 4개 탭, 선택 날짜, 시트 및 카테고리 페이지 이동 |
| `src/screens/HomeScreen.tsx` | 월별 홈 |
| `src/screens/HistoryScreen.tsx` | 달력과 날짜별 거래 |
| `src/screens/StatsScreen.tsx` | 월간·연간 통계 |
| `src/screens/SettingsScreen.tsx` | 설정 및 카테고리 관리 |
| `src/components/Common.tsx` | 요약, 기간 이동, 거래 행, 카테고리 막대, 공통 UI |
| `src/components/Calendar.tsx` | 달력과 날짜별 점 |
| `src/components/YearChart.tsx` | 수입·지출 차트, 스냅, 월 선택 |
| `src/components/BottomSheet.tsx` | 모달, Safe Area, 키보드 및 스크롤 처리 |
| `src/components/TransactionSheet.tsx` | 거래 추가·수정·삭제 |
| `src/components/CategorySheet.tsx` | 카테고리 추가·수정·삭제 |
| `src/components/Icon.tsx`, `theme.ts` | SVG 아이콘과 공통 디자인 값 |
| `src/domain/types.ts` | Transaction, Category, LedgerData 타입 |
| `src/domain/ledger.ts` | CRUD 규칙과 금액 검증 |
| `src/domain/dates.ts` | 날짜 형식, 윤년, 월 이동 |
| `src/domain/selectors.ts` | 월별·연간·카테고리 통계 계산 |
| `src/data/mockData.ts` | 최초 실행 데모 데이터 |
| `src/data/ledgerRepository.ts` | 저장소 인터페이스, AsyncStorage 구현, 데이터 검증 |
| `src/state/LedgerProvider.tsx` | 공유 상태, 저장 성공 후 상태 반영, 실패 처리 |
| `__tests__/ledger.test.ts` | 통계·CRUD·날짜·검증·영속성 테스트 |
| `__tests__/App.integration.test.tsx` | 화면 이동과 거래·카테고리 편집 통합 테스트 |

`package.json`, `package-lock.json`, `jest.config.js`, `jest.setup.js`도 변경했습니다. CocoaPods 설치 결과인 `ios/Podfile.lock`, workspace와 Xcode 프로젝트 연결, privacy manifest를 포함했습니다. `Info.plist`에는 앱 표시 이름과 밝은 테마를 설정했습니다.

## 추가 라이브러리

- `@react-native-async-storage/async-storage` 2.2.0: 가벼운 로컬 영속성.
- `react-native-svg` 15.16.1: 네이티브 SVG 아이콘과 수입선·지출 막대 차트. 별도 차트 라이브러리는 사용하지 않습니다.
- `react-native-dotenv` 3.4.11 (개발 의존성): `.env` 값을 Babel에서 앱 번들에 주입합니다. 별도 네이티브 설치는 필요하지 않습니다.

탭 이동은 현재 앱 규모에 맞게 React 상태로 구성했습니다. 기존 `react-native-safe-area-context`를 재사용하며, 백엔드·인증·WebView는 포함하지 않습니다.

## 검증 결과

2026-11-12 기준:

- TypeScript 검사 통과.
- ESLint 오류·경고 없이 통과.
- Jest **22개 테스트 통과**: 4개 탭, 달력 선택·월 이동, 거래 CRUD·취소·수입 전환, 화면 간 합계, 카테고리 CRUD·이름 변경·삭제 차단, 월간/연간 전환·연도 이동, 월 선택과 스크롤 이벤트, 금액 검증, 윤년, 저장 재로딩·손상 데이터 보호·저장 실패 재시도.
- 차트 가용 너비 276 / 346 / 536을 `onLayout`에 전달하여 스냅 간격이 너비에 맞게 갱신되는 것을 테스트했습니다.
- Metro iOS **Release JavaScript 번들 생성 성공**.
- CocoaPods 네이티브 의존성 설치 성공.
- iOS 실기기·시뮬레이터 Release 빌드를 시도했으나, Xcode가 `iOS 26.5 is not installed`로 대상 선택 단계에서 중단했습니다. `simctl`에도 설치된 런타임과 기기가 없습니다.

네이티브 최종 빌드와 앱 실행, 실제 기기에서의 화면 배치·키보드·터치·스와이프·스냅 감각은 검증하지 못했습니다. 위 차트 테스트는 이벤트와 속성 검증이며 시뮬레이터 동작 검증을 대체하지 않습니다. Xcode → Settings → Components에서 iOS 플랫폼과 런타임을 설치한 뒤 `npm run ios`로 확인해야 합니다. Android 실행은 검증 범위에 포함하지 않았습니다.

## 미지원 기능

백업·복원과 데이터 내보내기는 설정에 미지원으로 표시하는 정보 행입니다. 서버 동기화, API, MySQL, 로그인·인증, 계좌 관리, 앱 잠금은 구현하지 않았습니다.

## 향후 REST API 연결

1. `LedgerRepository`의 `load()` / `save()` 계약을 구현하는 API 저장소를 만들고 `LedgerProvider`에 주입합니다. 화면과 통계 계산은 그대로 사용할 수 있습니다.
2. 서버가 전체 가계부 GET/PUT을 제공하면 기존 계약으로 연결할 수 있습니다. 거래·카테고리별 CRUD 엔드포인트를 제공한다면 저장소 계약과 Provider의 mutation 호출만 해당 방식으로 확장합니다.
3. 서버에서도 카테고리 ID 참조, 사용 중인 카테고리 삭제 제한, 금액 정수, 날짜 형식과 입력 길이를 검증합니다. 서버가 발급한 ID 및 최종 데이터를 Provider에 반영하도록 조정합니다.
4. 네트워크 오류와 로딩·재시도 처리를 저장소/Provider에서 연결합니다. 기존 로컬 데이터 이전은 별도 마이그레이션으로 처리합니다.
