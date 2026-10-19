# #281 기존 loginProviderStorage 시험 실패 원인 점검

## 범위와 작업 위치

허대표님 지시: PR282·#280은 완료 정리, 후속 #281의 기존 실패 원인만 점검. 추가 코드 수정·병합·배포 금지. PR270 완료 유지.

- 원본 `/Users/heogyeongdae/Developer/HARU2026`, 브랜치 codex-question-input-three-lines, 미커밋 변경 없음. 원본 작업본은 보존했다.
- 최신 원격 main **75a6d8490262babe98e5d67fd2c7800b43548894** 확인.
- 격리 검증본 `/private/tmp/haru-issue281-audit-20261019`를 main75a6d849 detached 상태로 만들어 재현했다. 증거 저장 시에만 codex-issue281-login-test-audit-20261019 브랜치를 생성했다.
- 수정 파일은 새 docs/reviews 기록·로그뿐이다. 앱·원본 시험·Rules·인증 정책 변경 없음. PR 생성/병합/배포 없음.

## PR282·#280 완료 정리

- PR282 MERGED, main75a6d849, Hosting39187940247 SUCCESS, live version f564be7d06bd75d5, 2026-10-19 11:02:45 KST.
- [병합·배포 원문 근거](https://github.com/hkd620-lab/haru2026/blob/9d649857/docs/reviews/2026-10-19-pr282-main-merge-and-hosting-deployment.md).
- [#280 완료 댓글](https://github.com/hkd620-lab/haru2026/issues/280#issuecomment-6260590994) 후 **CLOSED / completed**, 2026-10-19T05:47:03Z. 이는 기존 하네스 실패 해소 범위의 완료이며 Rules/실기기 저장 검증 완료로 확대하지 않는다.
- 기존 시험12통과/0실패/1Rules skip, 독립 Claude 승인, Codex 해결·최신 검토, 운영 HTTP200 근거 유지. PR270 완료 유지.

## 재현과 직접 원인

`cd frontend && node test/loginProviderStorage.policy.test.cjs`, Node v26.8.2, **exit1**. [원본 출력](2026-10-19-issue281-login-provider-audit-evidence/original-test.log).

frontend/test/loginProviderStorage.policy.test.cjs **18행**은 아래 정확한 문자열을 요구한다.

```ts
readRememberedLoginProvider(user.uid) ?? normalizeLoginProvider(data?.loginProvider)
```

하지만 최신 AuthContext.tsx의 사용자 문서 effect에는 아래 구현이 있다.

```ts
// 516행부터: 현재 effect가 시작한 사용자와 세션을 캡처한다.
const uid = user.uid;
let active = true;
const isCurrent = () => active && generationRef.current === generation && auth.currentUser?.uid === uid;
// ... 536행: 오래된 세션·캐시·미확정 쓰기는 반영하지 않는다.
if (!isCurrent() || snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
// 539행
const loginProvider = readRememberedLoginProvider(uid) ?? normalizeLoginProvider(data?.loginProvider);
```

즉 **우선순위 표현의 user.uid 인자가 캡처된 uid로 바뀌었는데 시험이 예전 소스 문자열에 결합된 것**이 직접 원인이다. 스냅샷의 로컬 우선·정규화된 서버값 폴백 순서는 유지된다. 문자열을 맞추기 위해 앱의 UID 캡처나 세션 가드를 되돌릴 사유는 없다.

원본의15개 assert를 별도 진단 VM에서 실패를 수집하는 방식으로 관측했을 때 **14참/1거짓**, 거짓은18행(7번째 단언)뿐이었다. 이는 뒤쪽 단언의 상태를 보기 위한 진단이며 원본 시험을 통과·수정한 것이 아니다. 원본은 여전히18행에서 중단/exit1이다. Rules 문자열 단언이 참이어도 Rules 권한 동작을 검증한 것은 아니다.

## 원인 도입 이력

- 6fba80d13d4c57e0eef95898b69830d829cf0a12 (2026-09-12): 로그인 제공자 스냅샷 선택을 서버 우선에서 **로컬 우선**으로 바꾸면서 해당 시험도 함께 갱신했다.
- **897313a2ee97e29c4d0ca4914126cc6d3f725703 (2026-09-23)**: 사용자 문서 확인 전 보호 화면 진입 차단 작업에서 uid 캡처·generation/현재세션/active 가드를 도입했고 `readRememberedLoginProvider(user.uid)`를 `readRememberedLoginProvider(uid)`로 변경했다. **해당 커밋의 이 시험 diff는 없음**.
- 원본 시험의 마지막 변경은 여전히6fba80d1이다. PR270·PR282가 원인을 도입한 것이 아니다.
- git show로 각 커밋의 시험·AuthContext·유틸·Rules 원문을 읽어 VM에서 동일 시험을 실행한 결과: **897313a2 부모 통과 → 897313a2 같은18행 실패 → 최신75a6d849 같은18행 실패**. 역사 소스만 사용한 오프라인 진단이며 과거 운영 로그인 E2E는 아니다. [역사 진단](2026-10-19-issue281-login-provider-audit-evidence/history-diagnosis.json).

## 실제 구현 계약과 로컬 진단

최신 실제 loginProvider.ts를 esbuild로 메모리에서 변환하고, 실제 AuthContext의 선택식·mapUser를 추출해 합성 fixture로 실행했다. 앱·시험 파일에 대입하거나 전역 preload를 적용하지 않았다.

[진단10건 결과](2026-10-19-issue281-login-provider-audit-evidence/diagnosis.json), [진단 실행 원문](2026-10-19-issue281-login-provider-audit-evidence/diagnostic-source.md).

1. google.com/공백/대소문자 등 허용 별칭 정규화.
2. 미지원 문자열·비문자열은 null.
3. `haru.loginProvider.v1:{uid}` 저장 및 UID별 분리.
4. 스냅샷: 유효 로컬값이 서버값보다 우선.
5. 스냅샷: 로컬값 없음 → 정규화된 서버값.
6. 스냅샷: 유효하지 않은 로컬값 → 유효 서버값.
7. 스냅샷: 둘 다 없거나 유효하지 않으면 null.
8. localStorage 접근 거부 시 read=null·서버 폴백, write 오류는 throw하지 않음.
9. 초기 mapUser: 정규화된 Firebase 기본 제공자가 로컬값보다 우선하고 로컬값은 providerIds에 병합.
10. 초기 mapUser: 기본 제공자가 없는 custom 사용자는 기억된 로컬값으로 폴백.

**10건 통과**, 네트워크·실제 계정·로그인·토큰·개인정보·운영 데이터 사용 없음. 초기 mapUser와 서버 스냅샷의 선택 순서는 다르므로 “모든 단계에서 무조건 로컬 우선”으로 단순화하지 않는다.

AuthCallbackPage.tsx117행은 제공자가 있을 때 UID별 로컬 기억을 저장하고 Firestore 직접 import/쓰기나 loginProviderUpdatedAt 기록이 없다. AuthContext의 스냅샷 반영도 currentUser.uid===uid일 때만 적용한다. 이번 점검은 이 코드 대조와 추출 로직 진단까지이며 실제 OAuth 순서·세션 교체·브라우저 복원·Rules 권한 행렬의 통합 동작은 실행하지 않았다.

## 판정과 다음 범위

**✅ 기존 실패 원인 점검 완료 / #281 수정은 미착수·OPEN 유지.** 직접 원인은 이전 문자열을 고정한 시험과 UID 캡처 구현의 불일치다. 이 실패만으로 운영 인증 장애나 제공자 우선순위 회귀를 선언하지 않는다. 로컬 진단 통과를 원본 시험 복구로 표현하지 않는다.

이번에는 원본 시험·앱·Rules·의존성·워크플로·인증/결제 정책·환경변수·AI 호출을 수정하지 않았다. 코드 변경이 없으므로 앱 빌드를 반복하지 않았다. 새 문서·증거만 diff/check 후 작업 브랜치 push, main/PR 생성/병합/배포 없음.

후속 수정이 승인되면 시험만 실제 캡처 UID·제공자 우선순위·정규화/폴백 계약을 의미 있게 검증하도록 설계한다. 단언 삭제나 user.uid→uid 문자열 치환 하나로 동작 검증이 충분하다고 보지 않는다. 앱 UID 캡처/세션 가드를 되돌리거나 인증 정책을 바꾸는 것은 현재 승인 밖이다.

## 새 대화용 인수인계

- PR270 완료, PR282 MERGED/Hosting 완료, #280 CLOSED completed. main75a6d849.
- #281 원본 시험18행 실패 재현, 897313a2의 UID 캡처 전환과 시험 미갱신이 원인. 부모/변경 커밋/현재 이력 대조 완료. 진단10건 통과이나 원본 시험은 exit1 유지.
- 원본 작업 폴더 codex-question-input-three-lines 보존. 진단은 /private/tmp/haru-issue281-audit-20261019, 감사 브랜치 codex-issue281-login-test-audit-20261019에 docs만 추가.
- 미완료: #281 시험 수정·정식 검토/CI는 승인되지 않았고 실행하지 않음. 실제 인증 E2E 미실행.
- 금지: 앱·시험·Rules 추가 코드 수정, 인증 정책 변경, main 병합·배포·운영 계정/데이터 조작.
- 다음 첫 행동: 작업 위치·브랜치/status·최신 원격main 재확인 후 이 감사 기록을 읽고, 새 지시에서 허용한 범위만 진행.

작업 난이도: **5.5 낮음**.
