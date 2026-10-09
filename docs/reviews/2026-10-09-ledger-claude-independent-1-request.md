# 독립 Claude 검토 1회 — 질문 원문 (PR #271 · #272)

- 실행: 독립 Claude 검토 1회(본 건 최초)
- 요청 시각(UTC): 2026-10-09T10:52:26Z
- 검토 대상 HEAD: PR #271 `a4c8d034883a8645ebdc929c64e8734c9e6a0b32`(기능 `b1fe10848c8fc9e360b476896505ef11f79f6efb`) / PR #272 `0500bf3ed935fcdcacbd9f4586fc49627ce15cdb`(기능 `5ab44d90356c36c74183be4cdaf319eb9c58aeac`). 둘 다 base `main` `4db3ce79`.
- 검토자: CC가 작업 맥락을 넘기지 않은 별도 에이전트 세션(읽기 전용). 실행자(기장·Codex)와 CC의 결론은 전달하지 않았다.
- 의뢰 근거: 허대표님 전달 요청(기장 검토 요청서 `frontend/test/persona-sim/handoff/2026-10-09-ledger-feedback-review-ready.md`, 커밋 `5c8bc59d`).
- 아래 질문 원문은 요약·수정 없이 그대로 보존한다.

## 질문 원문

당신은 HARU2026 저장소(`hkd620-lab/haru2026`)의 **독립 코드·설계 검토자**입니다. 이 세션은 작업 맥락을 공유하지 않은 별도 세션이며, 아래 근거만으로 판단합니다. **읽기 전용**: 파일 수정·커밋·push·PR 댓글·이슈·Slack 게시·병합·배포는 하지 마세요(저장소 읽기와 로컬 테스트 실행만 허용). 최종 회신은 한국어로 작성합니다.

## 검토 대상 (모두 초안·미병합 PR, base = main `4db3ce79`)
- **PR #271** https://github.com/hkd620-lab/haru2026/pull/271 — F-13~F-16: 보조장부(ledger) 엑셀의 거래일 기준 필터, 지출 집계, 공제 선택값, 날짜·시간 정렬. 기능 SHA `b1fe10848c8fc9e360b476896505ef11f79f6efb`, 최종 HEAD `a4c8d034883a8645ebdc929c64e8734c9e6a0b32`. (기능 SHA 이후 커밋은 docs/reviews 신규 파일 추가뿐이라고 주장됨 — 직접 확인할 것)
- **PR #272** https://github.com/hkd620-lab/haru2026/pull/272 — F-17~F-19: 빈 장부 다운로드 방지, 사진 초과 안내, AI 다듬기 길이(5,000자) 오류 안내. 기능 SHA `5ab44d90356c36c74183be4cdaf319eb9c58aeac`, 최종 HEAD `0500bf3ed935fcdcacbd9f4586fc49627ce15cdb`.
- **작성자(Codex)의 검토 요청서**: https://github.com/hkd620-lab/haru2026/blob/5c8bc59d/frontend/test/persona-sim/handoff/2026-10-09-ledger-feedback-review-ready.md (`git show 5c8bc59d:frontend/test/persona-sim/handoff/2026-10-09-ledger-feedback-review-ready.md`). **이 문서의 주장은 검증 대상이지 사실이 아닙니다.** 반드시 실제 diff와 대조하세요.
- **요구사항 원천**: 가상사용자 시뮬레이션 보고서의 발견 F-13~F-19 — `git show origin/claude/elegant-noether-z5zy29:frontend/test/persona-sim/reports/2026-10-08-batch2/report.md` (각 발견의 증상·증거를 요구사항으로 삼으세요).
- **이전 Codex 검토 지적**(PR #271, 3건)과 반영: https://github.com/hkd620-lab/haru2026/pull/271#discussion_r4227985621 (→ e0a66f5c), https://github.com/hkd620-lab/haru2026/pull/271#discussion_r4228210633 (→ 3799cdc6), https://github.com/hkd620-lab/haru2026/pull/271#discussion_r4228429303 (→ b1fe1084). "새 주요 지적 없음" 댓글: https://github.com/hkd620-lab/haru2026/pull/271#issuecomment-6077999286 , https://github.com/hkd620-lab/haru2026/pull/272#issuecomment-6077399620 . 해결 여부를 건별로 직접 확인하세요. 이번이 본 건의 **첫 독립 Claude 검토**입니다.
- 운영 정책: `git show origin/main:docs/HARU2026_Slack_운영정책.md`의 8.1절(멈춤 조건 포함).

## 검토 항목
1. F-13~F-19 각 요구의 충족 여부
2. fallback(거래일이 비었거나 읽을 수 없을 때 입력일로 대체)과 날짜·시간 경계값: 월말/월초, 점·슬래시·"년월일" 표기, 한 자리 시각(9:00), 존재하지 않는 날짜(2026-02-30), 연도 경계, 시간대 영향
3. 수입/지출/VAT 집계의 정확성(계정과목 집계, 공제/불공제/확인필요/해당없음 매핑, 합계)
4. 빈 상태(거래 0건) 다운로드 차단이 모든 내보내기 경로에서 일관되는지, 유효한 경우 다운로드가 그대로 되는지
5. 사진 제한(일반 3장 / 보조장부 10장)과 초과·남은 칸 안내(정확히 남은 칸 수, 0칸, 초과, 여러 번 나눠 올리기)
6. 5,000자 오류와 다른 오류의 구분(월 한도 초과 `MONTHLY_AI_QUOTA_EXCEEDED`, 연결 오류, 다른 `invalid-argument` 등)이 올바른지
7. 기존 흐름 회귀: 변경된 함수의 호출처(예: `SayuPage.tsx`, `MergePage.tsx` 등)에서 시그니처·반환값·동작이 달라지는 곳
8. 저장 경로 `users/{uid}/records/{date}`와 저장 값(원문 저장 불변), Functions 리전 `asia-northeast3`, Firestore/Storage Rules, 결제·인증·환경변수·모바일 관련 변경이 있는지
9. 두 PR이 모두 `frontend/src/app/services/ledgerExportService.ts`를 수정합니다 — 병합 순서별 충돌 및 **의미 충돌**(둘이 합쳐졌을 때 한쪽 수정이 다른 쪽을 깨는지)
10. 작업 규모(소/중/대)와 정책 8.1 멈춤 조건(저장 경로 변경·마이그레이션, 운영 데이터 변경, 결제·인증, Rules, 새 AI 호출·모델·호출량 증가 등 비용 증가, 홈·라우터 변경) 해당 여부 — 판단과 근거
11. 작성자가 추가한 테스트(`frontend/test/ledgerExportConsistency.test.mjs`, `frontend/test/ledgerEmptyExport.test.mjs`)가 실제로 위 요구를 검증하는지, 통과해도 놓치는 경계가 있는지

## 작업 방법(권장)
- 이미 가져온 읽기용 참조가 있습니다: `refs/review/pr271`, `refs/review/pr272`(없으면 `git fetch origin pull/271/head:refs/review/pr271 pull/272/head:refs/review/pr272 main`). 비교 기준: `git diff $(git merge-base origin/main refs/review/pr271) refs/review/pr271` 처럼.
- 코드를 실행하려면 **별도 worktree**에서 하세요: `git worktree add --detach /tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad/rv-271 <SHA>` 후 `ln -s /home/user/haru2026/frontend/node_modules <그 폴더>/frontend/node_modules`, 그 다음 `cd <그 폴더>/frontend && node --import tsx --test test/<파일>`. 필요하면 두 PR을 함께 적용한 임시 worktree에서도 실행해 보세요. 끝나면 만든 worktree를 `git worktree remove --force`로 지우세요.
- `/home/user/haru2026` 작업 폴더의 현재 브랜치와 파일은 **바꾸지 마세요**(읽기·`git show`·`git diff`만).
- GitHub 도구(`mcp__github__*`)는 ToolSearch로 불러와 **읽기 전용**으로만 쓰세요(`pull_request_read`의 get_diff·get_review_comments·get_check_runs 등).
- 코드를 읽어서 추정한 것과 실제로 실행해 확인한 것을 구분해 표시하세요.

## 회신 형식 (한국어, 본문은 약 2,500자 이내로 간결하게)
1. **판정**: 승인 / 수정 후 승인 / 재설계 중 하나 + 근거(PR별로 따로 판정해도 됩니다)
2. **발견 사항**: 건마다 파일·행·재현 조건(입력 → 기대 / 실제)·우선순위(P1 차단 · P2 중요 · P3 경미)·권장 수정·(실행 확인/코드 추정 구분)
3. **이전 Codex 지적 3건의 해결 여부**(건별, 근거 포함)
4. **검토 요청서(문서)의 주장 중 실제 diff와 다른 점**
5. **미확인 항목**(운영 E2E 등)과 **잔여 위험**
6. **이번 검토가 확인하지 못한 것**, 그리고 실행한 명령과 결과의 요약(짧게)
