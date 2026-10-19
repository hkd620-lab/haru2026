관련 이슈 #280. PR #270은 완료 상태로 유지합니다.

## 목적·주요 변경
기존 haruLawSave 시험에서 빠진 실제 ref·상태 계약을 하네스에 반영합니다. 실제 useHaruLaw의 ref 초기화·effect cleanup을 인스턴스별로 실행하고, 명시적 rerender에서 최신 상태로 콜백을 다시 만듭니다.

코드 변경은 `frontend/test/haruLawSave.test.cjs` 한 파일입니다. 중복 저장(재렌더 전·후), 저장 완료 후 재진입 및 날짜 변경, 언마운트 후 이동 방지를 검증합니다. 나머지는 새 검증 기록입니다.

## 검증
- 대상 시험: 12통과 / 0실패 / 1skip(Rules 에뮬레이터 시험 미실행).
- 관련 오류·첨부 정리 2파일 및 쉬운 설명 정책 시험 통과.
- `npm run build` 통과(더미 Firebase 환경, 로컬 Node26; CI Node20은 별도 확인).
- 메모리에서만 lock/saved/mounted/cleanup 조건을 각각 무효화한 네 변이를 모두 검출(각 11통과/1실패/1skip).
- `git diff --check` 통과.
- [명령·결과 원문 및 한계](https://github.com/hkd620-lab/haru2026/blob/3fb503f3/docs/reviews/2026-10-19-issue280-harness-contract-fix-and-verification.md)

## 검토·배포 범위
허대표님이 이번 요청에서 **프리뷰 자동배포만 허용**했습니다. 초안 PR을 유지하며 Codex 및 독립 Claude 검토를 진행합니다. 이전 기록의 프리뷰 금지는 당시 범위이며 이번 지시로 프리뷰만 허용됐습니다.

앱 코드·Rules·워크플로·의존성·환경변수 정의 변경 없음. main 병합·운영 Hosting·Functions·Rules 배포 금지. Firestore `users/{uid}/records/{date}`, Functions `asia-northeast3`, 결제·인증·AI 호출 변경 없음. 다른 P3/#281 작업 없음.

## 위험·되돌리기
React DOM 마운트나 운영 저장 E2E가 아니라 실제 추출 콜백/ref/cleanup을 경량 하네스에서 검증합니다. Rules 시험 1개는 기존 전제 미충족으로 skip이며 권한 검증 완료로 해석하지 않습니다. 필요 시 이 작업 브랜치의 시험 변경 커밋 92a7e4fc를 별도 되돌림 커밋으로 취소할 수 있습니다. 현재 운영 코드 영향은 없습니다.
