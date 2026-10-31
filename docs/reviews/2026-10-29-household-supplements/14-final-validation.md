# 가계부 보완 1단위 — PR 전 최종 검증

기준 main `2e622d82911748a0e380f0b75c6584a8891d05ee`를 다시 fetch하여 동일함을 확인했다. 작업 브랜치 `codex-household-supplements`. 검증 대상은 13 보완까지의 미커밋 코드이며, 이후 코드는 동결하고 Git/리뷰를 진행한다. 난이도 **5.5 높음**.

## 구현 범위와 현재 판정

- 첫 단위: 현금 전용 입력, 유형별 사용자 분류·세부분류 관리, 개별/일괄 분류·메모 편집, 미분류 확인/확정, 명시적 거래처 분류 제안, 은행 가져오기 진입 구분과 동일 분류 선택.
- 실제 저장된 배열 위치/원본 지문을 확인하고 변경 필드만 트랜잭션 저장. id 없는 거래·같은 id·동일 내용 거래도 실제 위치로 구분하며 기존 id/importSource는 바꾸지 않는다. `[]`+레거시 단건에 현금 추가 시 원래 거래 보존.
- 사용자 본문은 보존. 자동 본문과 첫 거래 복사 필드만 원래 자동 생성/복사 값과 일치할 때 갱신. 다른 형식 필드는 유지.
- 독립 설계 판정 원문은 [04](04-independent-design-result.md)의 **수정 후 승인**(같은 건 1회). [06 사전 지적](06-root-pre-review-findings.md)은 [09](09-cc-pre-pr-fix-result.md), 은행 설정의 추가 경계는 [13](13-bank-settings-guard-result.md)으로 반영. 아직 최신 PR 코드 리뷰·독립 완료 승인은 받지 않았다. 병합/배포 전 조건을 채워야 한다.

## 최종 실행 결과

1. `cd frontend && node --import tsx --test --test-reporter=tap` — 가계부 10개 및 SAYU/형식 관련 6개 파일: **170/170 통과**. [원문](14-final-unit.txt).
2. `FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test --test-reporter=tap test/householdSave.emulator.test.mjs test/householdEdit.emulator.test.mjs`: **34/34 통과**, 기존 Rules·실제 SDK·합성 529건. [원문](14-final-emulator.txt). 로컬 `demo-haru-household-dedup`만 사용.
3. `npm run build`: **통과**, 환경변수 검사 + Vite + PWA 포함. 실제 인증값을 사용하지 않고 합성 Firebase 환경변수 6개를 명령에만 전달했다. [빌드 요약](14-build-summary.txt), 전체 로그 `/private/tmp/haru-household-supplements-final-build.txt`. 실제 설정의 CI 빌드는 PR에서 별도 확인한다. 앞선 CC의 환경변수 누락 실패·직접 Vite 빌드 결과와 구분한다.
4. `git diff --check`: 통과. 변경 파일을 확인했으며 App/routes.tsx/HaruRawPage.tsx/.zombie/모바일/숨김 LibraryPage 변경 없음. Functions/Rules/AI/인증/결제 코드 변경 없음. 새 비밀값·환경변수·외부 계약 없음. 금융 원본·운영 개인정보를 Git에 포함하지 않는다.
5. 실제 브라우저 조작 결과는 [11](11-browser-validation-01.md). 현금 추가, 사용자/세부분류와 기존 두 줄 메모 유지, 로그아웃, 응답 유실 뒤 변경 재시도 중복 방지 확인. 운영 데이터 쓰기 없음. 아이폰 실기기 PWA는 추가 E2E 필요.

## 기존 검증 실패의 대조

- 전체 TypeScript 검사는 변경하지 않은 ExportModal.tsx 구문 오류로 차단됨. 프로젝트 의존성은 바꾸지 않았다. 기존 Functions TypeScript 컴파일러를 사용한 좁은 검사는 CC 로그에 별도 기록되어 있다. 전체 타입 검사 통과로 보고하지 않는다.
- 성장타임라인 하네스는 현재 코드와 **수정 전 HEAD의 SayuPage.tsx를 읽도록 바꾼 동일 테스트**에서 모두 11개 중 같은 6개가 `isSpecialDayRecord is not defined`로 실패했다. [HEAD 기준 원문](14-growth-baseline.txt), [현재 원문](14-growth-current.txt). 저장소 소스를 임시 변경하지 않았고, `/private/tmp/haru-household-baseline-sayu-loader.mjs`가 해당 테스트 프로세스의 SayuPage 읽기만 HEAD 사본으로 대체했다. 이 기존 실패를 고치려고 성장타임라인을 수정하지 않는다.

## 배포 영향과 남은 범위

- Hosting 프론트만 대상. main 병합에 따른 자동 배포는 최신 CI·Codex 리뷰·독립 승인 후 수행한다. Functions `asia-northeast3`·Firestore `users/{uid}/records/{date}` 유지, Rules/Functions 배포 없음. 새 본인 전용 분류/규칙 설정은 기존 허용된 `users/{uid}/settings` 아래 두 문서만 사용.
- 배포 자체로 거래를 수정하거나 데이터 이전을 하지 않는다. 사용자의 명시적인 저장/편집 조작만 트랜잭션으로 반영한다. 기존 운영 529건·메모에 실행자가 쓰지 않았다.
- 전체 장부 [01](01-scope-ledger.md)의 카드 내역/이중 계산 연결, 반복·고정지출·할부, 금액 배분, 계좌 잔액 대조, 저축 목표는 후속 구현이다. 가족 공유는 **선택한 가계부 조회 전용**으로 범위가 확정됐지만 대상/노출/초대·해제/Rules는 별도 설계가 필요하다. 자동 연동은 공급자·계약·비용·인증 의존성이 남아 있다. 이 기능들을 완료했다고 보고하지 않는다.
- 코드 문제 시 PR revert 후 Hosting 재배포가 되돌리기 방법이다. 새 필드/설정 문서는 원본 기록과 함께 유지하며 운영 데이터를 일괄 삭제·복원하는 롤백은 하지 않는다.
