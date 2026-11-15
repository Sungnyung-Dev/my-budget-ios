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
| `API_BASE_URL` | 미설정 시 API 호출에서 설정 오류 | HTTPS API 주소. `.env.example`은 `https://budget-api.ecoma.kro.kr`로 설정합니다. 명시적인 API 조회에서만 사용합니다. |
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
| `src/domain/validateLedger.ts` | 로컬 저장소와 API가 공유하는 Ledger 응답·스냅샷 검증 |
| `src/domain/selectors.ts` | 월별·연간·카테고리 통계 계산 |
| `src/data/mockData.ts` | 최초 실행 데모 데이터 |
| `src/data/ledgerRepository.ts` | 저장소 인터페이스, AsyncStorage 구현, 기존 검증 함수 재내보내기 |
| `src/api/client.ts` | 공통 HTTPS GET 클라이언트, 타임아웃, JSON 검증, 사용자용 오류 |
| `src/api/ledgerApi.ts` | `GET /api/v1/ledger` 조회. 로컬 저장·상태 변경 없음 |
| `src/state/LedgerProvider.tsx` | 공유 상태, 저장 성공 후 상태 반영, 실패 처리 |
| `__tests__/ledger.test.ts` | 통계·CRUD·날짜·검증·영속성 테스트 |
| `__tests__/App.integration.test.tsx` | 화면 이동과 거래·카테고리 편집 통합 테스트 |
| `__tests__/api.test.ts` | API 조회·HTTP/네트워크/타임아웃·응답 검증·로컬 데이터 보존 테스트 |

`package.json`, `package-lock.json`, `jest.config.js`, `jest.setup.js`도 변경했습니다. CocoaPods 설치 결과인 `ios/Podfile.lock`, workspace와 Xcode 프로젝트 연결, privacy manifest를 포함했습니다. `Info.plist`에는 앱 표시 이름과 밝은 테마를 설정했습니다.

## 추가 라이브러리

- `@react-native-async-storage/async-storage` 2.2.0: 가벼운 로컬 영속성.
- `react-native-svg` 15.16.1: 네이티브 SVG 아이콘과 수입선·지출 막대 차트. 별도 차트 라이브러리는 사용하지 않습니다.
- `react-native-dotenv` 3.4.11 (개발 의존성): `.env` 값을 Babel에서 앱 번들에 주입합니다. 별도 네이티브 설치는 필요하지 않습니다.

탭 이동은 현재 앱 규모에 맞게 React 상태로 구성했습니다. 기존 `react-native-safe-area-context`와 기본 `fetch` / `AbortController`를 재사용하며, API 통신을 위해 추가한 라이브러리는 없습니다. 인증·WebView는 포함하지 않습니다.

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

백업·복원과 데이터 내보내기는 설정에 미지원으로 표시하는 정보 행입니다. 서버 동기화·데이터 이전·서버 CRUD·로그인·인증·계좌 관리·앱 잠금은 구현하지 않았습니다. API 조회 함수는 구현했지만 화면에 연결하지 않았습니다.

## API 조회 사용법

`.env`의 `API_BASE_URL=https://budget-api.ecoma.kro.kr`을 확인하고 Metro 캐시를 초기화한 뒤 사용합니다. API 설정이 없거나 잘못되어도 기존 로컬 앱은 실행할 수 있으며, API를 호출할 때만 `CONFIGURATION` 오류가 발생합니다.

```ts
import { getLedger } from './src/api/ledgerApi';
import { ApiError } from './src/api/client';

async function readServerLedger() {
  try {
    const remoteLedger = await getLedger(); // Promise<LedgerData>
    return remoteLedger; // 비교·미리보기용. 로컬 저장소에 자동 적용하지 않습니다.
  } catch (error) {
    if (error instanceof ApiError) {
      // 향후 알림 UI에는 error.message를 표시할 수 있습니다.
      // error.code로 오류를 구분하고 error.status로 HTTP 상태를 확인합니다.
    }
    throw error;
  }
}
```

`getLedger()`는 `GET /api/v1/ledger`의 최상위 `{ version: 1, categories, transactions }` JSON을 검증해 기존 `LedgerData` 타입으로 반환합니다. 별도의 DTO나 변환을 추가하지 않으며 `Category`와 `Transaction`의 ID·날짜 문자열·금액을 그대로 유지합니다. 잘못된 JSON, 필수 필드 누락, 지원하지 않는 버전, 잘못된 날짜·금액·카테고리 참조·중복 ID 등은 오류로 처리합니다. 빈 배열은 유효한 조회 결과이며, 누락되거나 잘못된 응답을 빈 가계부로 바꾸지 않습니다.

공통 클라이언트의 `get(path, validate)`는 다른 JSON 조회에도 사용할 수 있고, `validate` 콜백은 `unknown`을 검사해 결과 타입을 반환해야 합니다. 필요하면 별도의 클라이언트를 만들어 주소와 대기 시간을 지정합니다.

```ts
import { createApiClient } from './src/api/client';

const client = createApiClient({
  baseUrl: 'https://budget-api.ecoma.kro.kr',
  timeoutMs: 15_000,
});
const remoteLedger = await getLedger(client);
```

기본 타임아웃은 **10초**이며 응답 본문 수신까지 포함합니다. 제한 시간이 지나면 요청을 취소하고 오류를 반환하며 완료된 요청의 타이머는 정리합니다. `Accept: application/json`을 보내고 쿠키·인증 정보는 보내지 않습니다. 자동 재시도는 수행하지 않습니다.

| `ApiError.code` | 의미 |
| --- | --- |
| `CONFIGURATION` | HTTPS 주소 또는 대기 시간 설정 오류. 요청하지 않음 |
| `HTTP` | 2xx가 아닌 응답. `status` 보존, 404·429·5xx 메시지 구분 |
| `NETWORK` | 연결 실패 또는 응답 본문 수신 실패 |
| `TIMEOUT` | 대기 시간 초과 |
| `INVALID_RESPONSE` | JSON 파싱 또는 Ledger 검증 실패. `status` 보존 |

모든 오류의 `message`는 사용자에게 표시할 수 있는 한국어 문구입니다. 서버의 원문 오류 본문이나 내부 오류 문자열은 노출하지 않습니다. `LedgerProvider`는 계속 `localLedgerRepository`를 사용하며 앱 시작·화면 이동·거래·카테고리 CRUD에서 API를 자동 호출하지 않습니다.

2026-11-15 검증: TypeScript·ESLint 통과, Jest 3개 스위트 **79개 테스트 통과**(기존 22개 포함). 배포 API의 읽기 전용 GET은 HTTP 200을 반환했고, 구현한 `getLedger()`도 Node에서 실행해 버전 1, 카테고리 10개, 거래 0개의 실제 응답을 검증했습니다. 네이티브 기기에서의 API 통신은 별도 확인이 필요합니다.

## 로컬 데이터의 안전한 이전과 다음 변경 범위

이번 변경은 이전을 실행하지 않습니다. `@my-ledger/data-v1` 키와 저장·초기화 규칙을 유지하며 서버 조회 결과를 저장하거나 기존 데이터를 삭제하지 않습니다. 서버가 빈 Ledger를 반환하거나 요청에 실패해도 로컬 데이터는 유지됩니다.

향후 이전은 아래 순서로 별도 구현합니다.

1. 로컬 원본을 수정하지 않고 읽어서 검증하고, 별도 백업·내보내기를 제공합니다. 이전 중에는 로컬 변경을 잠시 제한하거나 원본 리비전을 확인해 새 거래가 누락되지 않도록 합니다.
2. 서버 데이터를 별도로 조회해 카테고리·거래 수, ID 충돌, 금액 합계를 비교하고 이전 미리보기를 제공합니다. 빈 서버 응답도 자동으로 로컬에 적용하지 않습니다.
3. 사용자가 선택한 업로드·병합 정책에 따라 처리합니다. 원자적 가져오기 또는 단계별 복구, 재시도 시 중복 방지, 카테고리 ID 매핑을 지원할 서버 계약이 먼저 필요합니다. 거래가 없는 서버에도 기본 카테고리가 있을 수 있으므로 카테고리만 보고 이전 완료를 판단하지 않습니다.
4. 서버 저장 후 다시 조회·검증해 거래 및 카테고리 연결·건수·금액이 일치하는지 확인한 뒤 이전 완료 상태를 별도 기록합니다. 실패·취소 시 로컬 원본과 백업을 유지하며, 서버 전환과 원본 정리는 분리합니다.

다음 단계의 구현 범위는 서버 쓰기 API 계약 확인, 이전·충돌 정책과 사용자 선택 UI, `LedgerRepository`/`LedgerProvider` 연결, 서버 ID 및 저장 결과 반영, 로딩·오류·재시도 UI입니다. 현재 `load()`/`save()` 전체 스냅샷 계약에 맞는 서버 저장 API가 없고 개별 CRUD만 있다면 저장소와 Provider의 mutation 계약도 함께 조정해야 합니다. 조회만 서버로 바꾸고 저장은 로컬로 남겨 두는 혼합 전환은 피합니다.
