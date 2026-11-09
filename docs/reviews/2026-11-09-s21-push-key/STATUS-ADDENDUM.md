# 상태 추가 기록 — S21 구독 키 수정 최종 검증·검토 현황 (2026-11-10)

- 같은 worktree `/private/tmp/haru-s21-push-key-fix-20261109`, 브랜치 `codex/s21-push-subscription-key-20261109`.
- 검토 대상 소스 HEAD: `0688d8da26179ff4ebe187cfa441ff915565d04f` (base `f38e0ddcad2c130e92333b0c5dd735972e09e5e8`).
- 이 파일은 **새로 추가한 문서**다. `README.md`, `SUPPLEMENT-sw-update-guard.md`, `raw/` 아래 기존 기록은 고치지 않았다. 이전 판정·의견·권한 거부 원문은 그대로 보존한다.
- 이 문서는 배포 승인, 운영 완료, 8.1절 판정①이 아니다.

## 1. 최종 검증 근거 (링크)

| 근거 | 파일 |
|---|---|
| 최종 로컬 검증 요약 | [`FINAL-LOCAL-VERIFICATION.json`](FINAL-LOCAL-VERIFICATION.json) |
| root runner 원본 로그(무손실 JSON 보존, sha256 포함) | [`raw/ROOT-FINAL-VERIFICATION-LOG.json`](raw/ROOT-FINAL-VERIFICATION-LOG.json) |
| 어댑터(`notificationService.ts`) strict 컴파일 | [`raw/ROOT-ADAPTER-STRICT-CHECK.json`](raw/ROOT-ADAPTER-STRICT-CHECK.json) |
| 검증 소스와 커밋 소스의 blob 동일성 | [`VERIFICATION-SOURCE-EQUIVALENCE.json`](VERIFICATION-SOURCE-EQUIVALENCE.json) |

## 2. 이전 '대기' 기록은 과거 시점 기록이다 (대체됨)

아래 문구는 **작성 당시의 시점 기록**이며, 현재 상태로 세지 않는다. 원문은 고치지 않는다.

| 이전 문구 | 현재 상태 |
|---|---|
| README §4 "SW 업데이트·활성화 (미변경 — 결정 대기)" | CC 2차에서 fail closed 방식 update·활성화 대기 보호로 구현됨(`fcmRegistrationUpdate.ts`, [`SUPPLEMENT-sw-update-guard.md`](SUPPLEMENT-sw-update-guard.md) §2) |
| README §5 build·tsc "권한 거부로 실행 안 됨 / 실행 불가" | root가 runner로 실행함. 아래 결과 참조 |
| README §6 3번(SW update 보호 결정 대기)·5번(build·tsc root 실행 필요) | 3번은 결정·구현 완료, 5번은 실행 완료 |
| SUPPLEMENT §3 "이 세션에서 실행되지 않았고 통과를 주장하지 않는다" | CC 2차 세션 자체는 실행하지 않은 것이 맞다. 이후 root 실행으로 아래 결과를 얻음 |

현재 결과(근거: §1 파일):

- 시험 4개 파일 **57/57 통과** (fail 0).
- Node `22.23.2`, 자리값 env `npm run build` **exit 0**.
- `dist/firebase-messaging-sw.js` = `public/firebase-messaging-sw.js` (`cmp` exit 0).
- helper 2개 + 실제 lib.dom `ServiceWorkerRegistration` 대입 browser fixture strict 검사 **exit 0** (TypeScript 5.9.3).
- 어댑터 `notificationService.ts` strict 컴파일 **exit 0**.
- 프로젝트 tsconfig 전체 기준 변경 파일 오류 0건.
- **전체 앱 tsc는 통과하지 않았다.** 기존 ExportModal 구문 오류 기준선 때문에 project tsc exit 2이며, 통과 근거로 쓰지 않는다.
- 로컬 `dist`는 자리값 env로 만든 점검용이다. **배포하지 않으며 배포에 쓰면 안 된다.**

## 3. 검증 소스와 HEAD `0688d8da`의 동일성 — 증거의 성격

- root runner는 `2026-11-09T19:49:14Z`에 **커밋 전 작업 트리**(로그상 `HEAD=f38e0ddc`)에서 실행됐다.
- 변경 소스·시험 6개 파일의 커밋 blob과 작업 트리 blob이 모두 같다(`VERIFICATION-SOURCE-EQUIVALENCE.json`, 6/6 `identical: true`).
- 6개 파일의 마지막 수정 시각은 모두 검증 시작(19:49:14Z)보다 앞선다(가장 늦은 것 `14:28:20Z`). CC 1차·2차 세션은 검증 전에 끝났고, 그 뒤 제품 코드 수정은 없었다.
- **한계(과장 금지):** 이 blob 동일성 기록은 **빌드·커밋 뒤에 남긴 것**이다(`comparisonRecordedAfterBuild: true`, `preRunHashManifestCaptured: false`). 실행 직전에 해시 목록을 찍어 둔 것이 아니다. 따라서 "실행 시점의 해시를 그때 캡처했다"고 주장하지 않는다.
- 독립 검토자는 HEAD에서 다시 실행하는 대신 **blob 해시 동일성 증거**를 붙이는 방법도 허용했다(아래 §4 원문 2절 1번). 이번 기록은 그 방법을 택했다.

## 4. 8.1절 독립 Claude 검토 — 원문 보존

- 판정 원문: **`승인`** — 범위는 **코드 병합 준비 상태만**이다. Hosting 배포 승인도, 운영 완료(S21 실제 수신) 승인도 아니다.
- 원문 파일:
  - 프롬프트 [`raw/haru-s21-key-independent-first.prompt.txt`](raw/haru-s21-key-independent-first.prompt.txt)
  - 결과 [`raw/haru-s21-key-independent-first.raw.json`](raw/haru-s21-key-independent-first.raw.json) (`permission_denials: []`, `is_error: false`)
  - 실행 정보 [`raw/haru-s21-key-independent-first.meta.json`](raw/haru-s21-key-independent-first.meta.json) (19:52:30Z~19:56:02Z, exit 0, plan 모드·읽기 도구)
  - stderr [`raw/haru-s21-key-independent-first.err.log`](raw/haru-s21-key-independent-first.err.log)
- 검토자가 판정① 전에 요구한 두 가지: (1) 검증 결과를 HEAD에 묶기 → §3, (2) 대체된 대기 문구 정리를 새 파일로 추가 → §2(이 파일).
- 검토자가 남긴 선택적 위험(원인 미확정, 첫 등록 기기의 update, 느린 망 10초, 아이폰 회귀, 시험이 실제 어댑터를 실행하지 않음, 범위 밖 기존 문제)은 원문 3절 그대로이며 배포 뒤 확인 항목이다.
- 이전 진단·Astra 의견·CC 1차 거부 6건·CC 2차 결과 원문은 고치지 않았다.

## 5. Codex·CI 현황 (기록 시점)

| 항목 | 상태 |
|---|---|
| Codex 수동 재검토 요청 | id `6749939932`, 생성 `2026-11-09T19:56:02Z`, 시작 `19:56:23.668610Z`, 대상 `0688d8da…` |
| Codex 요약 | id `6749947914` — **실행 중, 아직 통과 아님** |
| CI / preview | run `42687429322` — HEAD `0688d8da`에서 성공 확인 |

- 위 Codex·CI 값은 root가 확인해 전달한 값이다. 이 문서 작성 세션(CC)은 GitHub API를 조회하지 않았다.
- Codex 결과가 나오면 root가 Codex 원문 색인을 별도 새 파일로 추가한다. 이 문서는 Codex 통과를 주장하지 않는다.

## 6. 남은 승인·확인 (대기)

- **Hosting 배포 승인 대기.** 허대표님의 원래 승인 범위는 PR #364·#365와 Functions `lawSearch`·`sendTestNotification` 두 함수 배포뿐이다. PR #368의 frontend 새 Hosting 배포는 승인되지 않았다.
- `main`은 `f38e0ddc`. **PR #368은 Draft이며 병합되지 않았다.**
- **S21 실제 수신은 확인되지 않았다.** 아이폰 회귀 확인도 배포 뒤로 남아 있다. 둘 다 허대표님 실기기에서만 확인할 수 있다.
- 이전 아이폰 실제 수신(사람 확인)과 파일 4종·저장·카카오 관련 기존 확인 기록은 그대로 보존하며, 이번 변경으로 다시 판정하지 않았다.

## 7. 범위와 실행 주체

- 바뀌지 않음: 인증 정책, 결제, Firestore 경로(`users/{uid}/records`, `users/{uid}/settings/settings`의 `fcmTokens` 포함), Functions·region `asia-northeast3`, Rules, AI 호출·비용.
- SW의 공개 web config `apiKey`·`appId`를 운영 페이지와 맞춘 것은 공개 설정 정합이며 **인증 정책 변경이 아니다.**
- 실행 주체: CC 1차 세션은 Bash가 거부되어(6건, 원문은 `raw/haru-s21-key-cc-1.raw.json`의 `permission_denials`와 SUPPLEMENT §3.1) root가 정식 권한 상승으로 Git 작업·검증 runner·checks 확인을 실행했다. CC 2차·3차 세션의 권한 거부는 없다(root 전달). 거부 원문은 고치지 않았다.
