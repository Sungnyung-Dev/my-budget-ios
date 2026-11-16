# iPhone 실행·서버 연결 점검

점검일: 2026-11-16. 사용자 확인: **현재 USB 연결 불가**.

## 실제 검증 결과

| 항목 | 결과 | 근거와 한계 |
| --- | --- | --- |
| Xcode / SDK | 확인 | Xcode 26.5 (17F42), iPhoneOS 26.5 SDK |
| 실행 대상 | 확인 | arm64, 최소 iOS 15.1. 설치된 React Native의 최소 iOS 기준과 일치 |
| CocoaPods | 통과 | Bundler 의존성 충족, CocoaPods 1.15.2, `Podfile.lock`과 `Pods/Manifest.lock` 일치 |
| 네이티브 Debug 빌드 | 통과 | `generic/platform=iOS`, `CODE_SIGNING_ALLOWED=NO` |
| 네이티브 Release 빌드 | 통과 | 동일한 iPhone 대상 서명 없는 빌드. arm64 실행 파일·`main.jsbundle` 생성 및 운영 API 주소 포함 확인 |
| 실제 서명 빌드 | 실패 | `Signing for "MyBudgetIOS" requires a development team.` |
| 유효한 로컬 코드 서명 ID | 없음 | 키체인 조회 결과 `0 valid identities found`. Apple 계정 등록 여부를 확인하거나 인증서를 새로 만들지는 않음 |
| 연결·페어링된 iPhone | 없음 | `devicectl`의 기기 배열이 비어 있고 `xctrace`에는 Mac·시뮬레이터만 표시 |
| Mac → 운영 HTTPS | 통과 | curl 인증서 검증 성공, HTTP 200. Apple URLSession으로도 HTTP 200 |
| 현재 Ledger 형식 | 통과 | 기존 `validateLedger()` 검증 통과. 조회 시점 버전 1, 카테고리 10개, 거래 0개 |
| TypeScript / ESLint / Jest | 통과 | 타입·Lint 오류 없음, 8개 스위트 278개 테스트 통과 |
| iPhone 설치·실행·앱 내 초기 조회 | **미검증** | 기기 미연결 및 서명 준비 미완료. Mac 요청·서명 없는 빌드를 실기기 성공으로 간주하지 않음 |
| 실기기 CRUD·재실행·네트워크 오류 | **미검증** | 아래 체크리스트로 사용자가 직접 확인 필요 |

빌드의 RNSVG·Hermes·기존 스크립트 단계 관련 경고는 남아 있지만 Debug/Release 빌드 실패 원인은 아니었습니다. 앱 코드·디자인·CRUD, Pods 버전, 서버 API·DB·Nginx·ATS 설정은 변경하지 않았습니다. Team·인증서·프로비저닝을 임의로 생성하거나 지정하지 않았습니다.

서명 없는 `.app`은 컴파일·링크 검증용이며, 개발 서명이 없으므로 이 결과물만으로 iPhone 설치가 가능한 것은 아닙니다.

## 현재 서명·실행 설정

- 워크스페이스: `ios/MyBudgetIOS.xcworkspace` (앱 프로젝트와 Pods 포함).
- Scheme / Target: `MyBudgetIOS`. 기본 Run 구성은 **Debug**입니다.
- Bundle Identifier: `org.reactjs.native.example.MyBudgetIOS` (템플릿 값). 본인 Team에서 등록 가능한 고유 값인지 확인해야 합니다. 충돌 여부를 Apple 계정에서 조회한 것은 아닙니다.
- `DEVELOPMENT_TEAM`은 미설정입니다. 현재 설정 그대로의 서명 빌드는 Team 선택 단계에서 실패합니다.
- `.xcode.env.local`의 Node 실행 파일은 존재하며 v24.11.0으로 확인했습니다.
- `Info.plist`는 `NSAllowsArbitraryLoads = false`, `NSAllowsLocalNetworking = true`입니다. 운영 HTTPS 요청을 위해 ATS를 완화할 필요가 발견되지 않았습니다.
- Release는 `SceneDelegate.bundleURL()`에서 앱 내부 `main.jsbundle`을 사용합니다. Debug는 Metro 개발 서버를 사용합니다.

## iPhone을 설치 대상으로 준비하기

### 연결·페어링

현재 환경은 Xcode 26.5이며 사용할 수 있는 iPhone이 없습니다. 이미 이 Mac과 페어링한 기기가 있다면 동일한 Wi-Fi에서 Xcode의 **Window → Devices and Simulators**에 표시되는지 확인할 수 있습니다. 아직 페어링하지 않은 기기는 연결 가능한 시점에 케이블로 연결하고 잠금 해제·이 컴퓨터 신뢰를 사용자가 완료합니다. React Native의 [실기기 실행 안내](https://reactnative.dev/docs/running-on-device)가 이 경로를 설명합니다.

새 Apple 문서의 무선 초기 페어링 기능은 **Xcode 27 및 iOS/iPadOS 27 이상**에서 추가된 기능입니다. 현재 설치된 26.5에서 그 절차를 바로 사용할 수 있다고 가정하지 않았으며, 도구나 OS 업데이트도 수행하지 않았습니다. 관련 조건은 [Xcode 27 릴리스 노트](https://developer.apple.com/documentation/xcode-release-notes/xcode-27-release-notes)와 [Device Hub 페어링 안내](https://developer.apple.com/documentation/xcode/managing-your-simulated-and-physical-devices-in-device-hub)를 확인합니다.

### 서명과 실행

1. `ios/MyBudgetIOS.xcworkspace`를 Xcode로 엽니다. `.xcodeproj`만 열면 Pods 연결을 빠뜨릴 수 있습니다.
2. Xcode의 Settings → Accounts(버전에 따라 Apple Accounts)에 본인의 Apple 계정을 등록합니다. 인증·약관·기기 신뢰·기기 암호 입력은 사용자가 직접 완료합니다.
3. `MyBudgetIOS` Target → Signing & Capabilities에서 **Automatically manage signing**, 본인의 **Team**, 등록 가능한 **Bundle Identifier**를 설정합니다. Xcode가 개발 인증서와 프로비저닝을 준비하게 합니다. [Apple의 실기기 서명 안내](https://developer.apple.com/documentation/xcode/building-and-running-an-app)를 참고합니다.
4. 기기를 연결·페어링한 뒤 요청이 나타나면 iPhone의 Settings → Privacy & Security → Developer Mode를 켜고 재시작·확인을 직접 완료합니다. 설정이 보이지 않으면 먼저 Xcode에서 페어링을 시작합니다. [Apple Developer Mode 안내](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)가 절차와 보안 영향을 설명합니다.
5. Xcode 실행 대상에서 실제 iPhone을 선택하고 Product → Run을 실행합니다. 서명 오류가 남아 있으면 Signing & Capabilities의 메시지를 먼저 해결합니다. 앱 삭제나 ATS 해제로 우회하지 않습니다.

### 서버 검증에는 Release 실행 사용

오프라인·셀룰러 테스트에서는 Metro 연결 실패와 API 실패를 구분해야 합니다. Scheme → Edit Scheme → Run → Info에서 Build Configuration을 **Release**로 선택해 설치·실행하면 JavaScript 번들이 앱에 포함되어 Metro 없이 실행됩니다. 기본 Run 구성을 유지하려면 확인 후 Debug로 되돌립니다.

Debug 개발 중에는 Mac에서 `npm start -- --reset-cache`를 실행하고 iPhone이 Mac의 Metro(기본 8081)에 접근할 수 있어야 합니다. React Native 안내대로 동일 Wi-Fi와 Mac의 올바른 IP를 확인합니다. iPhone에서 `localhost`는 Mac이 아닙니다. Metro는 JavaScript 제공 경로이고 `https://budget-api.ecoma.kro.kr`은 가계부 API 경로이므로 각각 진단합니다. [React Native 네트워크 점검 안내](https://reactnative.dev/docs/running-on-device)

## iPhone HTTPS 초기 조회 확인 절차

아래 항목은 아직 수행하지 않았습니다.

1. iPhone Safari에서 `https://budget-api.ecoma.kro.kr/api/v1/ledger`를 열어 JSON이 보이는지 확인합니다. 이는 기기의 DNS·TLS·인터넷 확인이며 앱의 초기 조회 검증을 대신하지 않습니다.
2. 위 절차로 설치한 Release 앱을 실행합니다. 초기 로딩 후 서버 카테고리와 거래가 표시되는지 확인합니다. 이번 Mac 조회에서는 카테고리 10개·거래 0개였으며, 수동 확인 시점에는 그 시점의 서버 데이터와 비교합니다.
3. 거래가 없다면 빈 내역·0원 통계와 설정의 ‘서버 저장’ 표시가 정상입니다. 이전 로컬 데모가 나타나면 설치한 앱·번들·API 환경변수를 확인합니다.
4. 실패하면 화면의 오류와 재시도 결과를 기록합니다. 최초 GET 실패는 오류·재시도 화면을 보여야 하며, 빈 가계부로 정상 진입하거나 데모를 보충하면 안 됩니다.

## 수동 검증 체크리스트

모든 체크박스는 **실기기 미실행**입니다. 운영 데이터의 생성·변경·삭제는 사용자가 직접 결정해 수행하며, 자동 검사에서는 GET만 사용했습니다.

- [ ] **초기 조회:** Release 첫 실행에서 서버 데이터가 표시되고 로컬 개발용 데이터는 표시되지 않는다.
- [ ] **카테고리 생성:** 직접 확인용 카테고리(예: ‘실기기 확인’)를 만들고 목록·거래 선택 항목에 나타나는지 확인한다. 필요하면 읽기 전용 GET JSON에서 서버 ID를 확인한다.
- [ ] **거래 생성:** 선택한 날짜에 해당 카테고리로 확인용 거래를 직접 기록한다. 홈·내역·월간/연간 통계의 건수·수입·지출이 일치하고 빠른 연속 저장에도 중복이 생기지 않는다.
- [ ] **거래 수정:** 금액·메모·유형과 그에 맞는 카테고리를 변경해 서버 결과와 화면 합계가 일치하는지 확인한다. 거래 날짜는 현재 UI에서 읽기 전용이다.
- [ ] **카테고리 이름 수정:** 사용 중인 카테고리의 이름을 바꿔 기존 거래에도 반영되고 ID 연결은 유지되는지 확인한다. 사용 중인 카테고리 삭제는 차단되어야 한다.
- [ ] **재실행:** 저장이 완료된 후 앱을 완전히 종료하고 다시 열어 서버의 저장 결과가 유지되는지 확인한다. 미저장 초안의 앱 종료 후 복원은 구현 범위가 아니다.
- [ ] **최초 오프라인:** Release 앱을 인터넷 없이 새로 실행하면 오류·재시도 화면을 표시한다. 연결 복구 후 재시도로 서버 데이터를 읽는다.
- [ ] **편집 중 네트워크 오류:** Wi-Fi/셀룰러 전환·연결 끊김 또는 지연으로 저장이 실패해도 현재 시트의 입력과 기존 데이터가 유지된다. 결과가 불확실하면 쓰기가 차단되고 ‘서버 데이터 다시 조회’를 사용할 수 있어야 한다.
- [ ] **불확실한 결과:** 같은 쓰기를 곧바로 다시 보내지 말고 GET으로 확인한 뒤 시트를 닫고 목록을 확인한다. 이미 처리되었다면 중복 생성하지 않는다. 약 10초 요청 제한과 수동 재조회 실패·회복도 실제 환경에서 확인한다.
- [ ] **삭제와 정리:** 직접 만든 확인용 거래를 삭제한 뒤 그 확인용 카테고리를 삭제한다. 삭제 실패 시 편집·확인 화면을 유지하며, 서버가 확인한 삭제만 반영되어야 한다. 기본 카테고리 10개나 기존 사용 데이터는 검증용 정리 대상으로 삼지 않는다.
- [ ] **입력·화면:** 키보드 완료·취소·닫기, 저장 중 비활성화, 긴 오류와 재조회 버튼, 작은 화면의 Safe Area·스크롤 배치를 확인한다.

## 재현 명령과 로그

프로젝트 루트에서 실행합니다. 현재 Pods는 동기화되어 재설치하지 않았습니다. 의존성 상태가 달라지면 `bundle check` 및 `Podfile.lock`/`Pods/Manifest.lock`을 확인하고 필요한 경우에만 `ios`에서 `bundle exec pod install`을 실행합니다.

```sh
npm run typecheck
npm run lint
npm test -- --runInBand --watchman=false

xcrun devicectl list devices
security find-identity -v -p codesigning

# 컴파일·링크 점검용이며 설치 가능한 서명 빌드가 아닙니다.
xcodebuild -workspace ios/MyBudgetIOS.xcworkspace \
  -scheme MyBudgetIOS -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/my-budget-iphone-release \
  CODE_SIGNING_ALLOWED=NO build
```

이번 세션의 로컬 로그:

- `/tmp/my-budget-iphone-release.log`: Release 서명 없는 빌드 성공.
- `/tmp/my-budget-iphone-debug.log`: Debug 서명 없는 빌드 성공.
- `/tmp/my-budget-iphone-signing.log`: 현재 설정의 서명 빌드 실패(Team 미설정).
- `/tmp/my-budget-device-build-settings.txt`: 적용된 Release 빌드 설정.
- `/tmp/my-budget-device-inventory.json`: 기기 조회 성공, 빈 iPhone 목록.

로그·임시 빌드 결과는 Git에 포함하지 않았습니다. 서버 API·DB·Nginx 설정 변경, 운영 POST·PATCH·DELETE, 인증·기능 추가, Git commit·push는 수행하지 않았습니다.
