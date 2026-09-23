# 필수동의·탈퇴유예 사용자 문서 확인 게이트

## 기준과 범위

- 2026-09-23 `git fetch origin main` / 전용 브랜치 `git pull --ff-only origin main` 결과: `aea3cc5f6e300b26e7dcc38e56b9c6bb95d233cc`. 제시된 감사 기준과 동일하다.
- 브랜치: `fix/auth-user-document-gate`.
- 웹 사용자 문서 진입 판정, 공개 법적 문서 경계, 회귀 테스트, 그리고 실제 검증에서 확인된 `cancelAccountDeletion` Callable의 Admin Firestore sentinel 사용 오류만 변경한다. 로그인 성능 개선 작업을 재개하지 않는다.
- 운영 계정·데이터·설정 조회/변경, Rules·Hosting 배포, main 병합을 수행하지 않는다. 단, 실제 Callable 검증에서 확인된 복구 실패를 운영에 남기지 않기 위해 `requestAccountDeletion`, `cancelAccountDeletion`, `executeScheduledDeletion` 세 Functions는 별도 확인 후 선배포 대상으로 둔다.
- PR 워크플로는 pull_request에서 Hosting preview를 자동 배포한다. Preview 확인이 허용된 `a0b3e14b2c0b199f6bffcac89d4742bce6a2bba2`에서는 실행했고, Hosting 배포가 금지된 후속 문서/리뷰 보정 커밋은 `[skip ci]`로 실행을 생략한다. 워크플로와 저장소 설정은 변경하지 않는다. [GitHub의 skip 안내](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)에 따른 처리다. PR 생성 후 해당 SHA의 실행 유무를 확인한다.

## 원인과 변경

`App.tsx`의 `AuthProvider`는 `LoadingProvider`, `AppInitializer`, `BrowserRouter`, 전체 화면을 감싼다. 이전에는 Firebase Auth의 `loading`만 먼저 해제되고 사용자 문서 구독이 별도 effect에서 시작되었다. `HomeOrLanding`은 `user`가 있으면 홈을 렌더하고, `ProtectedRoute`도 Auth의 `loading`과 `user`만 검사한다. 문서 판정 전에 children이 마운트될 수 있었다. 문서 조회 오류는 두 제한 상태를 모두 해제했다.

이제 `AuthProvider`가 Auth 확인 중이거나 현재 UID/세션의 문서 확인이 끝나지 않았으면 children 전체를 대체한다. 따라서 하위 화면의 렌더와 effect도 시작되지 않는다. 서버 확인 응답의 탈퇴유예/동의 여부를 하나의 상태로 저장한다. 오류는 차단을 유지하고 재시도와 로그아웃을 제공한다. 15초 동안 서버 확인이 없으면 동일한 오류/복구 화면을 제공하며, 늦은 정상 서버 응답으로도 회복할 수 있다.

문서 리스너는 `includeMetadataChanges`를 사용한다. `fromCache` 또는 `hasPendingWrites` 응답으로 새 진입 판정을 만들지 않는다. 동의의 로컬 쓰기가 실패할 수 있으므로 서버 확인 전에 게이트를 열지 않는다. 이미 서버에서 확인된 세션은 이후 캐시 이벤트만으로 판정을 바꾸지 않으며, 리스너 오류가 오면 다시 차단한다. 연결 단절 시 즉시 모든 진행 중 화면을 잠그는 기능은 이번 범위가 아니다.

Auth 변경과 재시도마다 세대 번호를 증가시킨다. UID, 세대, 현재 Firebase 사용자, 구독 정리 여부를 검사하여 이전 구독의 늦은 응답을 무시한다. 같은 UID 재로그인도 다시 확인한다. 동의 체크박스 및 작업 중 상태는 새 계정에 이월하지 않는다. 늦은 redirect 결과는 Auth 판정을 덮어쓰지 않는다. 동의 저장/탈퇴 취소의 늦은 완료도 다른 세션의 상태를 바꾸지 않는다.

실제 Functions 에뮬레이터에서 `cancelAccountDeletion`을 호출했을 때 `admin.firestore.FieldValue.delete()`가 런타임에서 `undefined`가 되어 500 INTERNAL로 실패했다. `functions/src/accountDeletion.ts`는 `firebase-admin/firestore`의 `FieldValue`, `Timestamp` export를 사용하도록 수정했다. 이 변경은 탈퇴 신청·취소·예약 삭제 파일 안의 Firestore sentinel 사용을 같은 방식으로 맞춘 것이며, 동의·탈퇴유예 권한 정책 자체를 확대하지 않는다.

## 상태별 전후 동작

| 상태 | 수정 전 | 수정 후 |
|---|---|---|
| Auth 확인 전 | children 마운트 가능. 홈/ProtectedRoute 자체는 loading 검사, 다른 화면/effect는 별도 | 확인 안내, children 미마운트 |
| 비로그인 확인 | 공개 랜딩/로그인, ProtectedRoute는 로그인 이동 | 기존 동작 유지 |
| 로그인 후 문서 확인 중 | user + loading=false로 홈/보호 화면 가능 | 확인 안내 + 로그아웃, 보호 화면 미마운트 |
| 서버 확인 성공, 기존 동의 있음 | 정상 화면 | 정상 화면. 기존 이메일 인증 조건 등 유지 |
| 캐시 응답/미확정 로컬 쓰기 | 문서 판정으로 채택 가능 | 새 진입 근거로 사용하지 않음 |
| 서버에서 문서 없음 | 응답 전 잠깐 진입 가능, 응답 후 동의 화면 | 확인 전 차단, 확인 후 기존 동의 화면 |
| 동의 없음/null | 응답 전 잠깐 진입 가능, 응답 후 동의 화면 | 동의 화면; 저장의 서버 확인 후에만 진입 |
| 탈퇴유예 | 응답 전 잠깐 진입 가능, 응답 후 복구 화면 | 동의보다 우선하여 복구 화면; 취소 후 서버 확인 시 진입/동의 화면 |
| 조회 오류 | pendingDeletion/needsConsent 해제, 진입 허용 | 오류 안내 + 다시 시도/로그아웃, 진입 차단 |
| 서버 응답 지연/오프라인 초기 진입 | 인증 완료만으로 진입 가능 | 최대 15초 후 오류/복구 화면, 확인 전에는 진입 불가 |
| 계정 전환 | 이전 판정이 다음 응답 전까지 남을 수 있음 | 즉시 판정 무효화, 새 계정 확인, 이전 콜백 무시 |
| 로그아웃 | user 초기화와 문서 상태 초기화가 분리 | Auth 이벤트에서 판정 함께 초기화, 늦은 응답 무시 |

## 동의 호환성

- 현재 `LoginPage.tsx`와 게이트의 저장 항목은 `age14`, `age19`, `terms`, `privacy`, `overseasTransfer`, 선택 `marketing`, `agreedAt`, 두 버전이다. 현재 저장 버전은 둘 다 `2026-08-20`이다.
- UI는 만 19세 이상을 필수 항목으로 표시하며, 이전 호환 필드 age14도 함께 저장한다.
- 진입 판정은 기존 `!data?.consents`를 유지한다. 기존 버전, 부분 필드 또는 빈 객체의 유효성을 새로 강제하지 않는다. 이 PR이 동의 데이터의 정책 적합성을 보증하는 것은 아니다.
- 실제 기존 사용자 필드 분포/약관 재동의 대상 정책은 확인하지 않았다. 운영 사용자 조회 없이 임의 마이그레이션/버전 강제는 하지 않는다.
- 동의의 `setDoc(..., { merge: true })`, 선택 마케팅 값, 탈퇴 취소 `cancelAccountDeletion` 및 리전 `asia-northeast3`를 유지한다.

## 로컬 검증

실행 준비와 명령:

```sh
npm ci --prefix frontend
npm ci --prefix tests
# Chromium이 없는 환경에서만: cd tests && npx playwright install chromium
node --test --test-reporter=spec --test-timeout=60000 tests/auth-user-document-gate.test.cjs
node frontend/test/authCallbackAndHomePersonalization.policy.test.cjs
node frontend/test/snsThumbnailAuthCache.test.mjs
cd frontend && npm run build
```

- 새 브라우저 회귀 테스트: **19/19 통과**. 실제 `AuthProvider` 및 `ProtectedRoute`, React StrictMode, Chromium, 모바일 390×844 뷰포트 사용. Firebase 경계만 모의 구현으로 대체하고 외부 네트워크를 차단한다.
- 초기 홈/보호 경로, 비로그인, 서버 지연, 캐시/로컬 쓰기, 조회 오류, 구독 교체 재시도, 기존 허용 뒤 오류, 15초 타임아웃, 문서 없음/동의 누락/null, 필수 체크 및 선택 마케팅, 저장 실패, 탈퇴유예 우선순위/복구 실패·성공, 계정 전환, 같은 UID 재로그인, 늦은 redirect/구독/저장 응답, 로그아웃 실패·회복, 언마운트 정리를 검증한다.
- 이메일 가입 호출 뒤 화면이 언마운트되어도 기존 비동기 동의 저장 후속 처리가 계속될 수 있음을 별도 harness로 검증했다. 실제 LoginPage와 실제 메일 발송을 수행한 운영 E2E는 아니다.
- 기존 로그인 콜백/홈 개인화 및 SNS 인증 캐시 테스트 각각 통과.
- 웹 production build 통과. 실제 운영 설정/비밀값 대신 로컬 테스트용 Firebase 환경값 사용. 기존과 동일한 package-lock의 설치 의존성을 로컬에서 재사용했다. 독립 TypeScript 전체 검사는 실행하지 않았다(Vite 빌드/테스트 번들 변환 검증).
- 기존 대형 청크, 동적/정적 import 혼용, Browserslist 갱신 경고는 남아 있다. 관련 성능 변경은 하지 않았다.
- `d54832d30d280958c11ba42e50c6c4a5777cd26d` 기준 실제 Firebase Auth·Firestore JS SDK 에뮬레이터 검증 7/7 통과 결과를 이어받았다.
- `a0b3e14b2c0b199f6bffcac89d4742bce6a2bba2` 기준 Auth·Firestore·Functions 에뮬레이터에서 실제 `cancelAccountDeletion` Callable과 실제 `HomePageV2`/`RecordPage`/`SettingsPage`/`TermsPage`/`PrivacyPage`를 포함한 브라우저 검증 6/6 통과. 실패 주입 케이스의 예상 복구 실패 로그를 제외한 unexpected browser error는 0건이다.
- Functions temp build, PR worktree `tsc -p functions/tsconfig.json --noEmit`, `node functions/test/accountDeletionCompleteness.policy.test.js`, `git diff --check` 통과.
- GitHub Actions PR workflow `Deploy to Firebase Hosting on PR`은 `a0b3e14b2c0b199f6bffcac89d4742bce6a2bba2`에서 성공했고, Hosting preview만 배포했다. 이 preview 성공은 Functions 수정의 운영 반영을 의미하지 않는다.

## 서버 권한: 별도 정책 결정

**동의 완료 전/탈퇴유예 중 데이터 이용 자체를 막겠다는 정책이라면 서버 보완도 필요하다.** 이 PR은 웹 화면의 진입 안전장치이며, 기존 클라이언트나 직접 API 호출 권한을 제한하지 않는다. 타인 UID의 기록을 읽을 수 있다는 결론이 아니다.

기준 소스의 `firestore.rules`에서 검토한 영향 경로:

| 경로군 | 현재 코드의 조건 / 후속 정책 영향 |
|---|---|
| `users/{uid}` | 본인 읽기, 제한된 attribution/consents 필드 생성·수정. 문서 확인과 동의 저장을 막으면 가입/복구 교착 가능 |
| `users/{uid}/records/{date}` 및 resultThreads/messages | 본인 UID 기록 읽기/쓰기, 결과 하위 문서는 읽기만. 서비스 이용 제한을 도입할 때 핵심 대상 |
| growthSubjects/entries, library, assets, plants, settings, readProgress, novelSettings | 본인 UID 권한. 사용 중인 기능과 알림 설정 영향 검토 필요 |
| bibleProgress, bibleWordbook, vocabulary, snsRecords, savedSearches, timelines | 본인 UID 권한. 구버전/모바일/오프라인 클라이언트 함께 검토 |
| legalCases/documents, health 하위, petHealthLogs | 본인 UID 권한. 기존 데이터 조회/내보내기 예외 여부 결정 필요 |
| vaultItems | 본인 UID 외 개발자 이메일 조건도 있음. 기존 조건을 유지하며 별도 검토 |
| subscription 경로들, refundRequests, prophecyUsage | 본인/관리자 읽기 등 각각 다른 조건. 청구·환불·해지 정보 열람을 일괄 차단하지 않도록 검토 |
| shared_records/comments, books/chapters/characters, sharedHaruLawCards, 공용 컬렉션 | 로그인/소유자/공개상태/관리자 등 경로별 조건. 공개 열람과 기여 기능의 구분 필요 |

Functions Admin SDK 경로는 Firestore Rules 수정만으로 제한되지 않는다. 예를 들어 `polishContent`는 인증, rate limit, 월간 quota를 확인하지만 이 경로에 공통 동의/탈퇴유예 검사는 없다(`index.ts`, `utils/monthlyAiQuota.ts`, 관련 권한 helper 검토). Functions 전체와 Storage/공개 공유 URL의 권한을 전수 검증한 것은 아니다.

후속 결정 및 선행 확인:

1. 탈퇴유예 중 금지할 행위: 읽기/쓰기/AI/공유/내보내기 중 어디까지인지 결정.
2. 동의의 필수 항목·버전·레거시 인정 범위와 재동의/이행 기간 결정. 문서 없는 기존 계정 및 구버전 모바일을 포함해 승인된 데이터 분포 확인 필요.
3. 예외: 본인 사용자 문서 읽기, 동의 저장, 탈퇴 취소, 로그아웃, 약관 열람, 결제·환불·해지에 필요한 경로.
4. Rules 문서 조회 비용/한도, 쿼리 호환성, 클라이언트 쓰기가 허용된 consents 데이터의 신뢰 수준, Admin SDK 공통 검사와 정책 데이터 마이그레이션 검토.
5. 에뮬레이터와 테스트 계정으로 Rules/Functions/모바일/구버전 영향 검증 후 별도 PR·배포 승인.

이번 PR에서 Rules와 Storage 정책은 수정하지 않는다. Functions 권한 정책도 확대하지 않는다. 다만 운영의 탈퇴유예 복구 버튼이 같은 런타임 오류로 실패하지 않게 하려면 `requestAccountDeletion`, `cancelAccountDeletion`, `executeScheduledDeletion` 세 Functions의 제한 선배포가 필요하다. 게이트 내부의 기존 FCM 중복 토큰 정리(`users/{uid}/settings/settings`)도 사용자 문서 확인 전 실행될 수 있으며 이번 화면 진입 보완과 별개의 서버 접근 정책 검토 대상이다.

## 운영 미검증과 적용 상태

운영 사용자 문서 분포, 실제 소셜/이메일 로그인·동의 쓰기, 느린 네트워크/PWA의 실제 SDK 이벤트는 검증하지 않았다. 캐시만 가능한 초기 오프라인 이용은 차단되는 의도적 변화다. 서버 확인이 끝난 세션의 통신 중단을 즉시 감지해 잠그는 변경은 아니다.

승인 후 별도 환경에서 정상 기존 계정, 신규 가입, 동의 누락, 탈퇴유예, 네트워크 실패·재시도, A→B 전환, 로그아웃을 실제 SDK로 검증해야 한다.

## 후속 보완: 약관·개인정보 열람 경계

- 기존 동의 화면의 `/terms`, `/privacy` 링크는 새 탭에서 앱을 다시 열지만, 두 경로가 `AuthProvider`의 하위에 있어 동의가 없는 계정에서는 문서 대신 동의 화면을 다시 렌더하는 코드 경로가 있었다. 운영 브라우저 재현은 아직 확인하지 않았다.
- `BrowserRouter` 바깥에 있던 인증 공급자를 라우터 안으로 옮기고, `PublicLegalBoundary`가 **정확한 두 법적 문서 경로만** 원래의 `TermsPage`/`PrivacyPage`로 렌더한다. 이때 인증 공급자·앱 초기화·보호 화면은 마운트하지 않는다. 다른 경로는 종전과 같이 인증 공급자를 통과한다. 법적 문서의 닫기 버튼으로 `/settings`에 가면 다시 인증 공급자가 적용된다.
- 실제 법적 문서 컴포넌트를 사용하는 독립 서버 렌더 검사 6/6 통과, 기존 브라우저 회귀 하네스 번들 변환 통과. 동의 화면 링크를 여는 새 브라우저 테스트 2건도 추가했지만 이 환경은 Chromium 다운로드 실패로 실행하지 못했다. 전체 웹 빌드와 실제 Firebase SDK E2E도 아직 실행하지 못했다. 따라서 병합·배포 판정은 보류한다.

## 운영 반영 순서

이 PR은 Draft로 유지한다. 운영 반영은 다음 순서로만 진행한다.

1. `requestAccountDeletion`, `cancelAccountDeletion`, `executeScheduledDeletion` 세 Functions만 선배포한다.
2. 세 함수의 ACTIVE 상태, 리전, 런타임, revision과 최근 ERROR 로그를 확인한다.
3. `config/accountDeletion.enabled` kill switch 상태를 읽기만 하고 변경하지 않는다.
4. 이후에만 Draft 해제와 main 병합을 검토한다.
5. 병합 후 Hosting 자동 배포가 진행된다.
6. 정상 로그인 운영 E2E를 확인한다.
7. 문제가 발생하면 이전 Hosting 버전으로 복구한다.

PR 작성과 Functions 선배포는 운영 Hosting 적용 완료를 의미하지 않는다. 판정: 로컬 구현·검증 완료, Functions 제한 선배포 필요, 운영 로그인 E2E 미확인. main 병합 및 Hosting 배포 미수행.
