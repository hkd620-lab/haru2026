# PR #309 인용문 보존 — 승인된 병합·운영 배포 기록

- 기록 시각: 2026-10-28T15:33:53.027852+00:00
- 허대표님 승인: 현재 대화 “배포계속이어가자”. [승인 기록](https://harulab-hq.slack.com/archives/C0C11P98MHV/p1793191251614689).
- PR: https://github.com/hkd620-lab/haru2026/pull/309
- 병합 SHA: `a489005d326d29259711ac471a09a82cc5193a04`, 병합 시각 2026-10-28 21:47:03 KST.
- 코드 검토 HEAD `8808c8a7`: Codex 지적 없음, 독립 Claude “코드 개발: 승인.” [검토 원문·색인](README.md).
- 검토 후 추가는 `docs/reviews/` 파일 5개 A만. 최종 PR HEAD `53432154` [CI·Preview 성공](https://github.com/hkd620-lab/haru2026/actions/runs/40690384655).

## 배포와 실측

별도 worktree에서 병합 SHA를 사용해 실행:

```sh
firebase deploy --only functions:polishElderBookChapters --project haru2026-8abb8 --account hkd620@gmail.com --non-interactive
```

- Firebase CLI `Deploy complete!`, 대상 함수 `Successful update operation` 확인. 다른 Functions·Rules는 배포하지 않음.
- 프로젝트 `haru2026-8abb8`, 리전 `asia-northeast3`, Gen 2, runtime `nodejs22`, 상태 `ACTIVE`.
- 이전 revision `polishelderbookchapters-00035-rox` → 신규 `polishelderbookchapters-00036-duy`.
- 함수 updateTime: `2026-10-28T12:51:04.432627719Z` (2026-10-28 21:51:04 KST).
- Cloud Run 최신 ready revision과 트래픽 100%가 신규 revision을 가리킴.
- `gcloud functions list --project haru2026-8abb8 --regions asia-northeast3 --filter='name~polishElderBookChapters'` 실측에서도 동일 리전·revision·runtime 확인.
- [main Hosting 자동배포 성공](https://github.com/hkd620-lab/haru2026/actions/runs/40690688680), 운영 https://haru2026.com HTTP 200.
- 함수 무인증 POST: HTTP 403, 거부 확인. 인증된 실제 윤문 호출은 실행하지 않음.

## 코드 일치·검증

- 배포 전 Functions 빌드 성공, 작업 코드와 병합 코드에서 윤문 모의 테스트 20/20 통과, 내부 권한 정책 테스트 통과.
- 배포 함수가 참조하는 Cloud Storage source archive를 로컬 비공개 경로로 읽어 소스·컴파일 JS와 바이트 비교: 모두 일치.
- `src/elderBook.ts` SHA-256: `91b230fbcb85dd3e6581ca58ee87c33f5b0a8ed08a04ba00cd9167f2287a2781`.
- `lib/elderBook.js` SHA-256: `6d5db14245eabce5dc890a9eff21905ff2a220d3b785aed85a99ce8e3dceee0a`.
- 원본 TS는 병합 SHA `a489005d`의 소스와도 동일. Sol/low·출력 6,000·저장 경로·리전·발행 검토 게이트 보존.
- buildConfig/traffic 실측, 소스 비교, HTTP 점검, CLI 로그는 `/private/tmp/haru-book-quotes-review-309/`에 비공개 보관. 원고 내용·비밀값·인증정보는 포함하지 않음.

## 판정·남은 확인

**배포 완료 / 🔍 추가 E2E 필요.** 실제 새 프롬프트의 통과율과 인증된 윤문·저장·새로고침은 미실행이다. 운영 원고/윤문을 수동으로 고치거나 발행하지 않았다.

허대표님이 운영 책 화면에서 윤문을 한 번 실행한 뒤 확인할 최소 동작:

1. 성공하면 저장·새로고침 후 직접 인용문이 초고와 글자·공백·문장부호까지 같은지 확인한다.
2. 인용문 보존 오류로 차단되면 기존 윤문이 모든 장에서 유지되는지 확인한다. 자동 재시도는 없다.

따옴표 없는 인용/인용 밖 문맥은 보호하지 않으며, 특수 apostrophe는 보수적으로 차단될 수 있다. 검증 이후 Firestore 쓰기 실패의 원자성은 기존과 같다.

## 되돌리기

이번 제품 변경을 되돌린 커밋을 검토하고 허대표님 승인 범위에서 해당 함수만 재배포한다. 이전 revision·runtime·트래픽 기준은 위 기록과 로컬 before 메타데이터로 보존했다. 원고·윤문 데이터 자동 복원은 수행하지 않는다.
