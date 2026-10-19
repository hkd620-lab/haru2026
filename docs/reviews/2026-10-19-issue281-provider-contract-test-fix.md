# #281 로그인 제공자 시험의 실제 계약 검증

## 사용자 지시·기준

PR270·PR282·#280 완료 유지. #281 **시험만** 실제 캡처UID·제공자 우선순위·정규화·폴백 계약을 검증하도록 수정. 단순 문자열 치환으로 종료하지 않음. 앱 코드·Rules·인증 정책 수정과 PR생성·병합·배포 금지.

- 최신 원격 main `75a6d8490262babe98e5d67fd2c7800b43548894`에서 별도 `/private/tmp/haru-issue281-test-fix-20261019`, 브랜치 `codex-issue281-provider-contract-20261019` 생성.
- 원본 `$HOME/Developer/HARU2026`, codex-question-input-three-lines/9fa88ead 깨끗하게 보존.
- [기존 원인 점검](https://github.com/hkd620-lab/haru2026/blob/a7457b67/docs/reviews/2026-10-19-issue281-login-provider-existing-failure-audit.md): 897313a2의 UID 캡처 도입 이후18행 구형 문자열 단언만 실패. 당시 원본 시험 exit1은 이번 수정 후 결과와 구분한다.

## 수정

코드 커밋 **5640e0d7e3381eec6c00e11408b6f3864356b4a8**. 코드 변경은 **frontend/test/loginProviderStorage.policy.test.cjs 한 파일(+183/−20)**.

- Babel AST로 onSnapshot을 포함한 실제 useEffect를 유일하게 찾고 **전체 effect·cleanup**을 추출해 실행한다. 선택식이나 세션 가드를 시험 안에 복사해 구현하지 않는다. 실제 mapUser/rememberLoginProvider도 추출하고 loginProvider.ts를 메모리 변환해 실행한다. 구조가 사라지거나 여러 개면 실패한다.
- 기존 정책 단언15개 중 낡은 exact-string1개를 동작 검증으로 대체했다. 나머지14개는 그대로 별도 시험에 유지했다. 서버/Rules에 제공자를 쓰지 않는 기존 소스 제약을 지웠거나 완화하지 않았다. 이 소스 단언은 Rules 권한 행렬 검증이 아니다.
- 외부 IO 없는 fixture window/localStorage/구독을 주입한다. 실제 SDK 로그인/Firestore 요청/계정 정보는 사용하지 않는다. 새 의존성 추가나 package/lock 변경 없음. 기존 @vitejs/plugin-react 계열의 @babel/parser 및 Vite/tsx 계열 esbuild를 사용했다.

## 검증한 계약 — 9개 시험

1. 기존 로컬 저장/콜백/Rules 소스 제약 유지.
2. 허용 제공자·별칭의 trim/소문자 정규화, 미지원·비문자열 null.
3. 실제 remember 함수의 UID별 key 분리, 읽기 정규화.
4. 초기 mapUser: Firebase 기본 제공자 우선, custom은 기억한 값으로 폴백, providerIds 병합/중복 제거, 원래 providerId/custom 폴백 유지.
5. 실제 서버 스냅샷: 유효 로컬값 우선, 로컬 없음·무효면 정규화한 서버값, 둘 다 무효/없음이면 provider 변경 없음. 일곱 조합 확인.
6. effect 시작 후 원본 user 객체의 UID를 다른 값으로 바꿔도 **캡처한 UID**의 저장 키·구독 문서·사용자 문서만 사용.
7. 인증 UID 불일치/로그아웃/세대 변경/cleanup/캐시/대기 중 쓰기의 여섯 경우에 저장소 읽기·상태 반영 차단.
8. setter가 다른 UID의 사용자를 받으면 그 객체를 덮어쓰지 않음.
9. localStorage 접근 거부: 쓰기 오류 흡수, 읽기 null, 서버값으로 안전 폴백.

초기 mapUser와 서버 스냅샷의 순서를 같다고 가정하지 않는다. uid가 달라지지 않은 단순 fixture만으로 캡처 계약을 증명하지 않는다.

## 실행 결과

- `cd frontend && node test/loginProviderStorage.policy.test.cjs`: **9통과/0실패/0skip**, 취소0. 전역 preload/변이 없이 실제 수정 시험을 실행.
- `node --import tsx --test test/authCallbackDiagnostics.test.mjs test/snsThumbnailAuthCache.test.mjs`: **2파일 통과/0실패**.
- `node test/authCallbackAndHomePersonalization.policy.test.cjs`: 통과.
- `node test/socialLoginReturnOrigin.policy.test.cjs`: 통과.
- `npm run build`: **exit0, 75.95초**. 더미 Firebase12변수, Node v26.8.2. 실제 운영 환경이나 Node20 CI 증거가 아니다. 기존 Browserslist/번들/동적 import 경고는 수정하지 않음.
- `git diff --check` 및 코드 변경 파일 확인 통과. 앱/Functions/Rules/워크플로/package/lock diff 없음.
- [실행 명령·로그·빌드 요약](2026-10-19-issue281-provider-contract-evidence/).

## 회귀 검출력 — 앱 디스크 수정 없음

별도 프로세스에서 실제 소스의 readFileSync 반환 문자열에만 조건을 바꿔 원본 수정 시험을 그대로 실행했다. **유효 변이12종 모두 exit1, fail>0, 취소0, skip0**. 처음 setter 실행기 앵커가 중복돼 중단된 진단1회는 검출로 세지 않고 로그 보존 후 앵커를 좁혀 다시 실행했다.

| 변이 | 결과 |
| --- | --- |
| 캡처uid 대신 최신user.uid 읽기 | 8통과/1실패 |
| 스냅샷 서버 우선으로 역전 | 6통과/3실패 |
| 서버 폴백 제거 | 7통과/2실패 |
| 초기mapUser 로컬 우선으로 역전 | 8통과/1실패 |
| 인증UID/세대/cleanup/캐시/대기쓰기 가드 각각 제거 | 각각8통과/1실패 |
| setter UID 가드 제거(정정 실행) | 8통과/1실패 |
| trim/소문자 정규화 각각 제거 | 각각5통과/4실패 |

실행기 원문/유효12종 로그/최초 앵커 오류/명령별 결과를 모두 위 evidence에 보존했다. 로그는 최초 보존 전 줄끝 공백만 정리했다. 실행 메모리 변이 검출을 전체 인증 결함 부재로 확대하지 않는다.

## 현재 판정·금지 범위

**✅ 승인된 시험 수정·로컬 검증 완료, 미병합.** #281은 OPEN 유지. PR270·PR282 및 #280 완료 상태 유지.

실제 React DOM/StrictMode의 hook 마운트·OAuth·브라우저 새로고침·세션 교체 E2E·Firebase SDK/Rules 권한 검증을 수행한 것이 아니다. 추출한 실제 effect·함수에 합성 이벤트를 주는 시험이다. 타임아웃은 fake이며 실제 시간 경과는 검증하지 않는다.

사용자가 PR 생성을 금지했으므로 작업 브랜치 push까지만 한다. PR CI·Codex 자동 PR 리뷰·독립 완료 검토·판정①을 이번에 실행/선언하지 않는다. 프리뷰·main 병합·운영 Hosting·Functions·Rules 배포 없음. 앱 코드·Rules·인증/결제 정책·Firestore users/{uid}/records/{date}·Functions asia-northeast3·환경변수 정의·AI 호출 변경 없음.

작업 난이도: **5.5 중간**.
