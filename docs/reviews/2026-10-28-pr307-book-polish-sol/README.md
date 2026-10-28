# 책 윤문 Sol 전환 — PR #307 검토 기록

- PR: https://github.com/hkd620-lab/haru2026/pull/307
- 최신 검토 대상 HEAD: `bf36b6d2b978a4c98978fc6ad5a1e099039ad4e2`
- 기록 작성 시각: 2026-10-28T03:31:05.324225+00:00
- 개발 범위: `polishElderBookChapters` 호출의 모델·추론 설정만 변경. 출력 한도 6,000·프롬프트·저장 경로·리전·다른 모델·발행 게이트 보존.

## 독립 Claude 검토 — 최초 실행

- 새 Claude CLI 세션, 구현 대화 이력 미전달. 저장소·PR·근거 파일만 전달.
- 도구는 Read만 허용, MCP 비활성화, 파일 수정·명령 실행·재위임 금지.
- 세션 ID: `cea35689-c69c-4126-bb42-ac9e8d0421fc`
- 질문 원문: [claude-request.txt](claude-request.txt)
- 결과 원문: [claude-result.md](claude-result.md)
- CLI 원본 JSON: [claude-result.raw.json](claude-result.raw.json)
- 요청 실행 시작 시각: 확인 불가. 결과 파일 기록 시각: 2026-10-28T03:30:05.458725+00:00. CLI 보고 실행 시간: 78549ms.
- 검토자 최종 판정 원문: **승인**
- 승인 범위 원문: “(코드 개발 범위에 한정합니다. 2절 보완 ①②와 3절 5번은 필수 수정이 아닌 권고입니다. 병합·배포는 멈춤 조건이므로 허대표님 결정 전에는 진행하지 않습니다.)”
- 작업 규모: 소규모. 모델 교체는 멈춤 조건에 해당.
- 필수 수정 없음. 선택 권고인 테스트 스크립트·프롬프트 전체 비교는 이번 최소 변경 범위에서 추가하지 않음. 비교 근거 보존 권고는 아래 원문 사본으로 반영.
- 사실 대조 메모: 검토 원문의 테스트 줄 번호 `:100`은 부정확하며 대상 HEAD의 `endsWith` 검사는 `functions/test/elderBookPolish.test.js:71`에 있음. 검토 원문은 수정하지 않음.

## Codex 검토

[실행 1 색인 및 결과 원문 링크](codex-index.md). 같은 코드 HEAD에서 완료, 지적 0건. GitHub 결과는 Issue comment 형식이며 PR Review 객체는 미발급.

## 비교 근거

[선행 비교 보고서 원문 사본](benchmark-report.txt). 원본 `/private/tmp/haru-quality-bench-20261028/report.txt`을 수정 없이 보존했다. 보고서의 “코드 수정·커밋·PR 없음” 등은 **선행 비교 당시의 상태**이며 현재 PR 상태를 뜻하지 않는다.

합성 초고 10개 × 2회의 작은 표본이며 실제 책 전체·저장·발행 E2E와 청구서 대조는 수행하지 않았다. 이 비교는 개발 후보 선정 근거이며 운영 품질 동등성 보장이 아니다.

## 필수 검증과 CI

- 제품 코드 HEAD에서 `cd functions && npm run build` 통과.
- `cd functions && node --test test/elderBookPolish.test.js`: 3/3 통과.
- `cd functions && node --test test/internalEntitlements.policy.test.js`: 통과.
- `functions/src/index.ts`, `functions/src/elderBook.ts`의 export 선언 목록 비교: 차이 없음.
- 제품 diff를 원본과 비교해 허용한 모델·추론 설정·설명 주석만 변경됨을 확인.
- 위 명령은 구현자가 실행했고 PR 본문에 요약했다. 독립 검토자는 재실행하지 않았다고 명시했다.
- 코드 HEAD CI: https://github.com/hkd620-lab/haru2026/actions/runs/40626766351 — 성공. 프론트 빌드 및 Preview 배포 성공, Functions 운영 배포가 아님.
- 이 기록 이후 검토 기록 전용 커밋의 CI는 별도 확인한다.

## 판정·승인 범위

코드 개발 범위의 두 검토는 완료됐다. 모델 교체는 정책상 멈춤 조건이므로 **판정①(자동 병합·배포 승인)을 부여하지 않는다.**

main 병합·운영 모델 변경·Functions 운영 배포는 허대표님 별도 결정 전 보류. 운영 E2E 미실행. 배포가 승인되면 대상은 `polishElderBookChapters`, 프로젝트 `haru2026-8abb8`, 리전 `asia-northeast3`이며 다른 함수·Rules 배포는 범위에 포함하지 않는다.
