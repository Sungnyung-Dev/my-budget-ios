# 나의 가계부 · React Native iOS

React Native CLI + TypeScript 개인용 가계부입니다. 가계부의 단일 저장소는 HTTPS API를 통해 사용하는 서버 MySQL이며, 운영 주소는 `https://budget-api.ecoma.kro.kr`입니다.

## 현재 동작

- 최초 실행 시 `GET /api/v1/ledger`로 카테고리와 거래를 함께 불러옵니다. 기본 카테고리는 서버가 제공하는 데이터를 사용합니다.
- 홈·달력 내역·월간/연간 통계·설정이 동일한 Provider의 데이터를 사용합니다.
- 거래 생성·수정·삭제 및 카테고리 생성·이름 수정·삭제를 서버 API로 처리합니다. 생성 ID는 서버가 발급하며 응답으로 받은 최종 데이터를 성공 후 공유 상태에 반영합니다.
- 서버 모드에서는 AsyncStorage Ledger를 읽거나 저장하지 않습니다. 기존 개발용 로컬 데이터는 삭제하지 않고 그대로 두며, 이전·병합·데모 거래 생성·업로드는 수행하지 않습니다.
- 조회 실패 시 로컬 데이터나 데모로 대체하지 않습니다. 최초 조회가 실패하면 오류·재시도 화면을 표시하고 가계부 편집을 열지 않습니다.
- 인증, 자동 동기화, 오프라인 저장·캐시, 로컬 데이터 이전은 포함하지 않습니다. 다른 기기에서 바뀐 내용은 설정의 **서버 데이터 새로고침**으로 확인합니다.

날짜는 `YYYY-MM-DD` 문자열이며 별도의 시간 필드는 없습니다. 금액은 1~999,999,999,999원의 정수, 메모는 100자, 카테고리 이름은 20자까지 지원합니다. 기존 흰색·검정·회색 UI, 달력 날짜 선택, 편집·삭제 확인, 통계와 차트 구성을 유지합니다.

## 실행과 환경 설정

Node.js 22.11 이상, Ruby/Bundler, Xcode와 iOS SDK·시뮬레이터 런타임이 필요합니다.

```sh
npm ci
cp .env.example .env # 처음 설정할 때만 실행
bundle install
cd ios
bundle exec pod install
cd ..
npm start
```

별도 터미널에서 `npm run ios`를 실행하거나 `ios/MyBudgetIOS.xcworkspace`를 Xcode에서 엽니다. 실기기는 본인의 서명 설정이 필요합니다.

| 설정 | 용도 |
| --- | --- |
| `API_BASE_URL` | 기본 예제 값은 `https://budget-api.ecoma.kro.kr`. 초기 조회와 모든 서버 CRUD에 사용합니다. HTTPS 주소가 필요합니다. |
| `SEED_DEMO_DATA` | 보존된 로컬 개발 저장소에만 해당합니다. 서버 앱에서는 읽거나 사용하지 않습니다. |

`.env`는 Git에서 제외하고 `.env.example`만 공유합니다. `react-native-dotenv`가 값을 번들에 포함하므로 비밀 키를 넣지 않습니다. 환경변수를 수정하면 Metro를 `npm start -- --reset-cache`로 다시 시작하고 배포 앱은 다시 빌드합니다.

## Provider와 저장소 구조

```text
App → LedgerProvider → serverLedgerRepository → 기존 HTTPS API 클라이언트
         ↓ 서버가 확인한 LedgerData
     홈 / 내역 / 통계 / 설정 / 편집 시트
```

`LedgerRepository`는 전체 스냅샷 `save()` 대신 다음 계약을 가집니다.

- `load(): Promise<LedgerData>`
- `createTransaction(input)`, `updateTransaction(id, input)`, `deleteTransaction(id)`
- `createCategory(input)`, `updateCategory(id, { name })`, `deleteCategory(id)`

생성·수정은 저장된 `Transaction` 또는 `Category`, 삭제는 `void`를 반환합니다. 거래 수정 계약은 부분 업데이트를 지원하며 현재 편집 화면은 입력된 다섯 필드를 전달합니다. 카테고리 생성에는 `name`, `type`, `symbol`을 보내고 기존 UI의 기본 아이콘 규칙(수입 `income`, 지출 `other`)을 유지합니다. 카테고리 수정은 이름만 보냅니다.

Provider는 API 응답으로 다음 전체 Ledger를 구성하고 기존 `validateLedger()`로 참조·중복 ID·합계까지 검증한 뒤 상태를 교체합니다. 요청 전에 화면의 가계부 데이터를 낙관적으로 변경하지 않습니다. 생성 응답의 ID와 정규화된 최종 필드를 사용하며 수정 응답의 ID가 요청 대상과 다르면 적용하지 않고 재조회를 요구합니다.

| 상태 | 동작 |
| --- | --- |
| `status: loading / error / ready` | 최초 로딩, 최초 조회 실패·재시도, 정상 화면 구분 |
| `saving` | 쓰기 중 입력·저장·삭제·닫기 비활성화 |
| `refreshing` | 기존 화면을 유지하며 서버를 재조회. 쓰기는 일시 차단 |
| `needsRefresh` | 쓰기 결과가 불확실해 재조회가 필요한 상태. 다시 저장·삭제하지 못하게 차단 |
| `loadError`, `syncMessage` | 안전한 오류 안내 및 재조회 후 결과 확인 안내 |

초기 GET과 쓰기·재조회는 동기적인 요청 잠금으로 중복 실행 및 응답 경합을 막습니다. 저장소 주입이 바뀌면 이전 요청이 새 상태를 덮어쓰지 않도록 구분합니다. 실제 앱은 기본 `serverLedgerRepository`를 사용하며 테스트에서 저장소나 `fetch`를 모의 처리할 수 있습니다.

## 실패와 재조회

- HTTP 4xx 등 확정된 거절에서는 기존 가계부·편집 입력·삭제 확인 화면을 유지합니다. 사용자가 수정 후 직접 다시 저장할 수 있습니다. 카테고리 중복 이름과 사용 중 삭제는 클라이언트에서도 차단하고 서버가 최종 검증합니다.
- 네트워크 오류·타임아웃·5xx·잘못된 성공 응답은 서버에서 이미 처리되었을 수 있습니다. 쓰기는 자동 재시도하지 않으며 **서버 데이터 다시 조회**를 먼저 실행하도록 합니다.
- 재조회는 GET만 수행합니다. 성공하면 서버 스냅샷을 반영하고 입력값은 유지합니다. 편집을 닫고 목록에서 처리 결과를 확인한 뒤 다음 작업을 진행해야 합니다. 중복 생성 여부를 자동으로 추측하거나 같은 쓰기를 재전송하지 않습니다.
- 재조회도 실패하면 기존 데이터와 입력을 유지하고 쓰기 차단도 유지합니다. 이미 정상 로드한 화면에서 새로고침이 실패해도 빈 화면이나 초기 로딩 화면으로 바꾸지 않습니다.
- 서버의 빈 거래 배열은 정상 데이터입니다. 로컬 거래나 데모를 보충하지 않고 빈 내역과 0원 통계를 표시합니다.

공통 API 클라이언트는 `fetch`·`AbortController`, 기본 10초 타임아웃(본문 수신 포함), JSON 검증, 삭제의 204 처리를 사용합니다. `ApiError.code`는 `CONFIGURATION`, `INVALID_REQUEST`, `HTTP`, `NETWORK`, `TIMEOUT`, `INVALID_RESPONSE`이며 HTTP 상태는 `status`로 확인합니다. 사용자에게 서버의 원문 오류나 내부 문자열을 노출하지 않습니다. 쿠키·인증은 사용하지 않습니다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `src/state/LedgerProvider.tsx` | 서버 로드·CRUD·최종 상태 반영, 요청 잠금과 재조회 상태 |
| `src/data/ledgerRepository.ts` | 서버 CRUD에 맞춘 저장소 계약 |
| `src/data/serverLedgerRepository.ts` | 기존 Ledger·거래·카테고리 API 연결 |
| `src/api/client.ts`, `ledgerApi.ts`, `transactionApi.ts`, `categoryApi.ts` | 기존 공통 통신 및 요청·응답 검증 |
| `src/components/ServerSyncNotice.tsx` | 화면·편집 시트의 오류와 수동 재조회 안내 |
| `src/components/TransactionSheet.tsx`, `CategorySheet.tsx` | 기존 입력·삭제 확인 유지, 저장·재조회 중 제어 |
| `src/LedgerApp.tsx`, `src/screens/SettingsScreen.tsx` | 최초 오류·재시도, 공통 안내, 서버 저장·새로고침 표시 |
| `src/config/env.ts`, `.env.example` | 서버 주소 설정. 공유 환경 설정에서 로컬 데모 옵션 분리 |
| `src/data/localLedgerRepository.ts` | 기존 AsyncStorage 구현·읽기 전용 스냅샷을 보존한 개발용 코드 |
| `src/data/ledgerTransfer.ts`, `src/domain/ledgerComparison.ts`, `src/components/LedgerDataTools.tsx` | 기존 로컬 백업·비교 코드. 일반 화면에서는 접근하지 않음 |
| `src/native/ledgerBackup.ts`, `ios/MyBudgetIOS/LedgerBackup.m` | 기존 iOS JSON 파일 공유 모듈 보존 |
| `testUtils/mockLedgerServer.ts` | 운영 서버로 전달하지 않는 메모리 HTTP 테스트 서버 |
| `__tests__/LedgerProvider.test.tsx`, `ServerApp.integration.test.tsx` | 서버 전환·실패 복구·ID·화면 일관성 검증 |

기존 도메인 계산·검증, 거래·카테고리 CRUD 규칙 테스트와 로컬 백업·비교 테스트도 유지합니다. 로컬 저장소를 참조하던 테스트·백업 서비스의 import 경로는 보존된 `localLedgerRepository.ts`로 이동했습니다.

## 보존된 로컬 백업·비교 코드

일반 설정 화면의 로컬 백업·비교 버튼과 로컬 데모 안내는 제거했습니다. 서버 데이터에 로컬 전용 도구를 적용하는 혼동을 피하기 위한 것이며, 기존 AsyncStorage 데이터나 관련 구현을 삭제하지 않았습니다. 백업·비교 서비스를 개발자가 명시적으로 호출하지 않는 한 실행하지 않습니다.

기존 JSON 백업 형식은 `backupVersion`, `exportedAt`, `source: local`, `transactionOrigin: unverified`, `ledger`를 포함합니다. 데모 가능 거래도 원본 그대로 보존합니다. 읽기 전용 백업은 저장 데이터가 없으면 초기화하지 않으며, iOS 임시 파일·공유·정리 구현도 남겨 두었습니다. 현재 서버 전환에는 이 데이터를 이전하거나 병합하는 단계가 없습니다.

## 검증

```sh
npm run typecheck
npm run lint
npm test -- --runInBand --watchman=false
```

2026-11-16 서버 전환 검증:

- TypeScript 검사 및 ESLint 오류·경고 없이 통과.
- Jest **8개 스위트 278개 테스트 통과**. 초기 로딩·빈 거래·최초 오류·재시도, 여섯 가지 쓰기의 성공·거절·응답 유실, 서버 ID·정규화된 응답 반영, 타임아웃, 중복 저장·조회 경합, 편집 입력 유지, 화면 간 일관성을 검증했습니다.
- iOS Release JavaScript 번들·소스 맵 생성 성공. 번들에 서버 Provider와 기존 API 모듈이 포함되며, AsyncStorage 패키지·로컬 저장소·데모 생성·로컬 백업·비교 UI 모듈이 포함되지 않는 것을 소스 맵으로 확인했습니다.
- 서버 Provider·화면 테스트에서 AsyncStorage 읽기·쓰기·삭제가 호출되지 않는 것을 확인했습니다. 기존 도메인 및 분리된 로컬 도구 테스트도 통과했습니다.
- 이번 서버 전환에서는 실제 iPhone 실행이나 운영 CRUD를 검증하지 않았습니다. 아래 항목은 실기기에서 확인해야 합니다.

테스트의 서버 쓰기 요청은 모두 모의 처리합니다. 기존 화면 통합 테스트도 서버 HTTP 모의 응답을 사용하며 실제 운영 API에 POST·PATCH·DELETE를 보내지 않습니다. 보존된 로컬 도구 테스트는 일반 설정과 분리해 해당 컴포넌트만 명시적으로 마운트합니다.

## 실제 iPhone 확인 항목

1. 운영 HTTPS 주소가 반영된 앱으로 첫 실행·재실행 시 서버 카테고리와 거래를 조회하는지 확인합니다. 서버 거래가 비어 있으면 데모가 생기지 않아야 합니다.
2. 거래·카테고리 생성·수정·삭제 후 홈·내역·월간/연간 통계·설정과 재실행 결과가 일치하는지 확인합니다. 생성된 카테고리의 서버 ID가 새 거래에 연결되고 이름 변경 후 연결이 유지되어야 합니다.
3. Wi-Fi/셀룰러 전환, 최초 오프라인, 편집 중 연결 끊김·타임아웃을 확인합니다. 입력값이 남고, 처리 결과가 불확실한 경우 재조회 후 목록에서 결과를 확인할 수 있어야 합니다.
4. 빠른 연속 저장·삭제, 저장 중 키보드·닫기·취소, 긴 오류 안내와 재조회 버튼 배치를 확인합니다. 재조회가 같은 쓰기를 다시 보내지 않아야 합니다.
5. 기기에 남은 개발용 AsyncStorage 데이터가 정상 앱에서 표시되거나 업로드되지 않고, 설정에는 서버 저장 안내와 새로고침만 표시되는지 확인합니다.

실기기에서 운영 데이터의 CRUD를 검증하는 작업은 이번 자동 테스트에서 실행하지 않았습니다. Git commit·push, 데이터 이전·병합, 인증 및 새 라이브러리 추가도 수행하지 않습니다.
