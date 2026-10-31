# 제목 일괄 생성 1차 개선 — 수정·검증

- 요청: 유효한 사용자/AI 제목 보존, 비문자열 제목 처리, 요청 내 중복 형식 처리만 구현. 동시 요청 잠금·강제 재생성·병합·배포 제외.
- 기준 main: `be7f9afee0f686c80d63728263242824893d4c9b`.
- 브랜치: `codex-title-backfill-first-pass`. 원격 `codex` 브랜치와 충돌을 피하는 기존 하이픈 방식.
- 선행 점검: [13개 시나리오·운영 배포 코드 대조](https://github.com/hkd620-lab/haru2026/blob/57d61160/docs/reviews/2026-10-20-title-api-duplication-audit.md).

## 수정 범위

제품 변경은 `functions/src/index.ts`의 `generateTitlesForAll` 제목 판정/반복 처리 부분뿐이다.

- 사용자 제목과 AI 제목이 문자열이고 기존 isValidTitle 기준에 맞으면 원값/updatedAt까지 보존하며 모델·저장 호출을 생략한다. 사용자 값은 trim해서 덮어쓰거나 AI 필드로 복사하지 않는다.
- 비문자열 제목은 유효 제목으로 취급하지 않되 `.trim()`을 직접 호출하지 않는다. 다른 유효 제목이 있으면 두 값 모두 그대로 보존하며, 둘 다 무효이면 기존 경로로 AI 제목만 생성한다. 비문자열 사용자 제목 값은 삭제/덮어쓰기하지 않는다.
- 한 기록에서 같은 접두어는 한 요청 안에서 한 번만 처리한다. 서로 다른 기록의 같은 형식은 각각 처리한다. 모델 오류/무효 응답이 나도 같은 요청의 중복 형식으로 재호출하지 않는다.
- 최초 저장 성공 후 재실행은 호출0회·쓰기0회·count=0. 중도 저장 실패 후 재시작은 이미 저장된 제목을 보존하고 실패 기록만 다시 처리한다.

기존 isValidTitle 함수, 모델·프롬프트·600자 입력·20자 후처리·count 응답 형태·10개 형식·500문서 상한·개발자 권한은 유지한다. 동시 요청 잠금·강제 재생성·본문 변경 시 자동 갱신은 없다. UI·공용 extractTitle·환경변수·결제/인증 정책·Rules·Firestore 경로 `users/{uid}/records/{date}`·Functions 리전 `asia-northeast3` 변경 없음.

## 검증

- 신규 `functions/test/generateTitlesForAll.test.js`: 실제 핸들러와 검증 함수를 TypeScript AST로 추출하고 메모리 Firestore/합성 AI로 실행. Firebase/provider SDK 및 네트워크 호출 없음.
- 수정 전 보강 시험 11개 중 8개 실패로 기존 결함 재현. 초기 저장 실패 시험의 합성 문서 참조 공유는 실제 독립 문서처럼 각각 복제하도록 바로잡았다.
- 수정 후 신규 회귀 시험 11개 통과. 유효 사용자/AI 제목 원값 보존, 숫자/불리언/배열/객체 제목 처리, 순차 재실행, 문서별 중복 구분, AI 오류/무효 응답, 저장 실패 후 재시작, 본문 없음, 인증·개발자 거부를 확인했다.
- `node --test functions/test/generateTitlesForAll.test.js functions/test/aiGateway.test.js functions/test/internalEntitlements.policy.test.js`: 26개 통과([로그](test-output.txt)).
- `node --experimental-strip-types --test functions/test/formatRegistry.parity.test.mjs`: 2개 통과. 관련 검증 합계 28개.
- `cd functions && npm run build`: 수정 전/후 모두 성공. 동일 package-lock의 기존 Developer/functions/node_modules를 임시 링크로 재사용 후 링크 제거, 의존성 파일 변경 없음.
- export diff([결과](exports.json)): source export 72개·컴파일 runtime export 114개, 추가/삭제0. main 소스의 TypeScript 변환 결과와 수정 후 실제 빌드 JS를 AST로 비교했다. SDK를 실행하지 않았다.
- 빌드가 만든 추적 산출물 `functions/lib/index.js`/`snsToDiary.js`에는 기존 main 소스와의 광범위 드리프트가 있어 검증용 built index는 로컬 임시 파일에 보관하고, 이번 빌드로 생긴 추적 파일 변경만 시작 상태로 되돌렸다. 제품 소스·신규 시험만 구현 커밋에 포함하며, 배포용 산출물은 향후 승인된 빌드에서 재생성해야 한다.
- `git diff --check`, 실제 변경 파일 및 범위 확인. 웹 변경이 없어 웹 빌드는 실행하지 않았다.

## 현재 상태와 제한

구현·로컬 검증 완료. 독립 검토 질문/결과는 별도 새 기록으로 보관한다. PR은 Hosting preview 자동배포를 유발하므로 생성하지 않으며, CI/자동 PR 리뷰/공식 판정① 미실행. 병합·Hosting/Functions/Rules 배포·실제 모델 호출·운영 기록 조회/쓰기·기존 제목 대량 갱신 없음.

동시에 시작해 같은 이전 스냅샷을 읽는 독립 요청 두 개를 차단하는 기능은 이번에 구현하지 않았다. 본문이 바뀌어도 유효 AI 제목이 있으면 보존한다. 생성 후 저장이 실패한 기록은 재시작 때 다시 생성될 수 있다. 500문서 상한/페이지네이션 및 운영 SDK 직접 호출→main callAi 선행 차이는 이번에 변경하지 않았다.

작업 난이도: 5.5 중간.
