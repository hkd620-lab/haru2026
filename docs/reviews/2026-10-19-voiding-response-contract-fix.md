# 배뇨일지 AI 응답 계약 수정·검증

- 요청: 배뇨일지 text/result 응답 불일치만 수정하고 검증. 다른 항목 수정·병합·배포 금지.
- 기준: main `9141f7f37fa9ff7e41baae977f9a594de649d603`.
- 브랜치: `codex-voiding-response-contract`. 원격에 `codex` 브랜치가 있어 `codex/` 대신 기존 저장소의 하이픈 방식 사용.
- 작업본: `/private/tmp/haru-issue279-performance-20261019`. Developer 원본 작업 브랜치는 보존.

## 원인·수정

`functions/src/index.ts`의 `polishContent`는 `{ text, stats, aiComment }`를 반환하지만, 배뇨일지는 `result`를 읽어 정상 응답도 빈 문자열로 처리했다. 클라이언트 응답 타입과 읽기를 `text`로 맞췄으며 문자열만 기존 검증으로 넘긴다. 서버·프롬프트·AI 호출 횟수는 변경하지 않았다.

제품 변경은 `frontend/src/app/pages/SayuHealthVoidingPage.tsx` 두 줄이다. `isSayuSafe` 본문, 동의·현재 계정·세션·로딩·저장 잠금, 대상 문서 ID 선택, 오류 처리 및 저장 순서는 기준 코드와 동일하다. Firestore 경로·Functions 리전·환경변수·인증 및 결제 코드 변경은 없다.

## 회귀 검증

`frontend/test/voidingRecordTarget.test.mjs`의 모의 응답도 서버처럼 `text`로 수정했다. 기존 시험은 잘못된 `result` 계약과 안전검사 대역을 사용해 이 오류를 놓쳤다. 이제 제품의 실제 `isSayuSafe` 함수를 실행한다.

- 기존 시험: 수정 전 12개 통과.
- 시험 보강 후 제품 수정 전: 15개 중 4개 실패로 오류 재현.
- 제품 수정 후: `node --test frontend/test/voidingRecordTarget.test.mjs` 15개 통과.
- 정상 수치 text 저장, result 동시 존재 시 text 사용, 불일치 수치 거부, 빈값·누락·result만 존재·비문자열·null 응답 거부 및 기존 해석 보존 확인.
- 동의 미확정·철회 상태 차단, 계정 이탈 후 늦은 응답 저장 차단, 중복 호출 잠금과 검증 실패 후 재시도, 실제 저장 ID 재사용 등 기존 회귀 시험 유지.
- `cd frontend && npm run build` 성공(Vite + PWA). package-lock 동일성 확인 후 기존 의존성을 재사용했고, Firebase 필수 환경값 6종은 합성값으로 제공했다. 대형 청크·오래된 Browserslist 데이터 경고가 있었으며 실패는 없었다. 빌드 로그: `/private/tmp/haru-voiding-contract-build.log`.
- `git diff --check` 통과.
- 함수 본문 비교로 제품 차이가 응답 타입·읽기 두 줄뿐임을 확인.

## 배포·검토 상태

브랜치 보관까지만 수행한다. PR 생성 시 Hosting 미리보기 자동 배포가 실행되므로 PR도 만들지 않는다. main 병합·Hosting/Functions/Rules 배포 없음. 다른 API 호출 개선 항목은 미수정.

PR CI·Codex 자동 리뷰·독립 Claude 승인 및 공식 판정①은 미실행이다. 로컬 수정·시험 통과를 운영 완료로 해석하지 않는다. 실제 유료 AI 호출·사용자 데이터 쓰기 및 운영 E2E는 수행하지 않았다. 향후 승인된 검토·배포 후 배뇨 기록 저장 → AI 해석 생성 → 새로고침 후 해석 유지 동작 확인이 남는다.

작업 난이도: 5.5 중간.
