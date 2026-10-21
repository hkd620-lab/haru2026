# API 호출 후속 점검 — 중복 요청·출력 상한 계측

**✅ 코드 대조·합성 진단·개선 범위 정리 완료. 제품 수정은 하지 않았다.**

## 요청과 기준

허대표님이 제목 일괄 생성 건을 완료로 정리하고 다음 API 호출 항목을 우선 수정 없이 점검하도록 요청했다. 이어진 “다음작업 계속하자”에서도 수정 보류 범위를 유지했다. [원래 감사](https://github.com/hkd620-lab/haru2026/blob/d15534ab/docs/reviews/2026-10-19-api-call-waste-and-duplication-audit.md)의 4번 ‘출력 상한·중복 요청 계측’을 구체화했다.

- 최신 원격 main: `8a2bbfd8cb24fd9d381ed75d9e3e5ce31d68fce9` (2026-10-22 재확인).
- 제목 일괄 생성은 PR #287 병합·Hosting/대상 Functions 배포·승인된 실제 계정 E2E 완료 상태를 유지한다. [기존 확정 근거](https://github.com/hkd620-lab/haru2026/pull/287#issuecomment-6313863451). 이번에 다시 실행하거나 운영 기록을 읽지 않았다.
- [앞선 다듬기 보조 출력 점검](https://github.com/hkd620-lab/haru2026/blob/579e99a61f4c3b65f7ad09846f47f1a5456d97be/docs/reviews/2026-10-21-polish-output-consumption-audit.md)은 분석 완료, 구현 미진행이다. FormatModal의 미사용 한마디 선택 생략 권고와 SayuModal의 실제 한마디 보존 원칙을 유지한다.
- 이번 대상: `polishContent`의 본문/통계/한마디, 공통 사용량 로그와 토큰 변환, 제목 함수의 계측 유무, 활성 클라이언트 전송 가드. 전체 AI 기능·모바일을 전수 점검하지 않았다.
- 운영 `polishContent`는 메타데이터만 재조회했다. `asia-northeast3`, `nodejs22`, ACTIVE, revision `polishcontent-00242-pay`, source generation `1789286623874132`로 앞선 점검과 같다. [메타데이터](2026-10-22-api-metering-audit-evidence/deployment.json). 이번 진단은 **현재 main 소스** 기준이며 운영 사용량 로그·사용자 기록·실청구액은 조회하지 않았다.
- 원본 Developer 작업본 `codex-question-input-three-lines` / `9fa88ead`는 clean 상태를 보존했다. 별도 감사 브랜치 `codex-api-metering-audit-20261022`에서 문서·진단 근거만 추가했다. 원격 `codex` 브랜치와 경로가 충돌해 기존 하이픈 명명 방식을 사용했다.

## 핵심 결과

1. **현재 `aiUsageLogs` 행 수는 모델 요청 수가 아니다.** 세 단계가 모두 `sayu_polish`, `requestId:null`로 기록돼 단계·논리 요청의 연결이 없다. 일부는 모델 응답을 읽거나 파싱하기 전에 성공을 기록하고, 실패 시 추가 행을 쓰거나 실패 행을 생략한다.
2. **로그 기록 자체에 같은 구독 정보의 반복 조회가 있다.** 일반 사용자의 지원 형식 정상 다듬기에서는 로그 3행을 위해 동일한 `subscription/info`를 3회 읽는다. quota의 별도 조회·트랜잭션은 이 숫자에 포함하지 않았다.
3. **빈도 제한과 중복 방지는 다르다.** rate limit은 살아 있고 버튼 disabled도 있다. 하지만 동일한 두 서버 요청을 합치는 장치는 이 범위에 없다. 합성 병렬 요청 둘은 6번의 논리 모델 진입과 quota 예약 2회로 처리됐다. 실제 사용자에게 이런 중복이 얼마나 발생하는지는 미계측이다.
4. **문자열 잘라내기는 생성 토큰 상한이 아니다.** 대상 5개 `callAi` 호출에는 명시적 `generationConfig.maxOutputTokens`가 없다. 공통 창구도 받지 않은 상한을 추가하지 않는다. 모델 자체 한도·기본 설정까지 없다는 뜻은 아니다.

## 1. 사용량 로그와 모델 요청의 대응

[본문 로그](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/index.ts#L2437), [한마디 로그](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/index.ts#L2471), [통계 로그](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/index.ts#L5000)는 같은 featureName·모델·빈 requestId를 사용한다. 목적·단계·단계 소요 시간 필드가 이 호출들에 없다. [공통 창구](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/ai/aiGateway.ts#L46)는 provider/model/inputTokens/outputTokens/raw를 반환하지만 이 세 로그는 provider·finishReason·SDK 재시도 정보를 구조적으로 남기지 않는다.

추출한 실제 핸들러·사용량 로거에 가짜 AI/메모리 Firestore를 넣은 결과:

| 합성 조건 | 논리 모델 진입 | 사용량 로그 행 | 현재 집계의 한계 |
| --- | ---: | ---: | --- |
| 지원 형식 정상 | 3 | 성공 3 | 서로 다른 단계지만 같은 featureName, requestId:null |
| reading 정상 | 2 | 성공 2 | 통계 미지원이라 유료 통계 단계 없음 |
| 통계 응답에 JSON 구간이 있으나 파싱 실패 | 3 | 성공 3 + 실패 1 | 통계 한 호출에 성공·실패 행이 모두 생김 |
| 통계 응답에 JSON 구간 자체가 없음 | 3 | 성공 3 | stats:null이어도 별도 실패 행 없음 |
| 한마디 공급자 호출 실패 | 3 | 성공 2 | 한마디 실패는 console 경고만, 사용량 실패 행 없음 |
| 한마디 text() 읽기 실패 | 3 | 성공 3 | 최종 한마디는 비지만 이미 성공 기록 |
| 본문 text() 읽기 실패 | 1 | 성공 1 + 실패 1 | 모델 응답 도착과 사용자 결과 성공이 구분되지 않음 |
| 빈 입력 / quota 거부 | 0 | 실패 1 | 모델 진입 전 실패도 같은 usage 계열에 포함 |
| 사용량 로그 저장 실패 | 3 | 저장 0 (시도 3) | 로거는 요청을 중단시키지 않으므로 로그만으로 누락 복원 불가 |

이는 코드 분기 재현이다. 논리 모델 진입은 `callAi` 진입 횟수로서 SDK 내부 전송·재시도·과금 확정을 뜻하지 않는다. 공급자 실패로 반환된 요청도 이 횟수에 포함된다. 성공 행의 토큰 합이 항상 두 배가 된다는 뜻도 아니다. 예를 들어 파싱 실패에 추가된 실패 행의 토큰은 null이다.

[extractTitle](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/index.ts#L2559)과 [generateTitlesForAll](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/index.ts#L4699)은 이 공통 사용량 로그를 쓰지 않는다. 합성 제목 생성은 모델 진입 1회에 usage 행 0개였다. 제목 완료 건을 다시 열어 수정하자는 의미가 아니며, 전 기능 비용을 현재 usage 표만으로 산정할 수 없다는 경계다. 공용 제목 추출은 성장타임라인에서 결과를 사용하므로 미사용 함수로 취급하지 않는다.

## 2. 로그용 구독 조회 중복 — 별도 작은 개선 후보

[logAiUsage](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/aiUsageLogger.ts#L56)는 매번 `resolveActualPlan`을 실행한다. actualPlan 미지정·비개발자 조건에서는 같은 [`users/{uid}/subscription/info`](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/aiUsageLogger.ts#L37)를 읽는다.

- 정상 지원 형식: **로그 전용 구독 읽기 3회**.
- 정상 reading: **로그 전용 구독 읽기 2회**.
- 통계 JSON 파싱 실패: 로그 4행으로 **로그 전용 읽기 4회**.
- 개발자: 로거의 개발자 분기에서 반환해 **로그 전용 읽기 0회**. quota 등 다른 읽기가 없다는 뜻은 아니다.

이는 Firestore SDK의 논리 get 횟수이며 실청구액이 아니다. 실제 quota 예약도 [별도로 구독을 조회](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/utils/monthlyAiQuota.ts#L91)하나, 이번 모의 계측은 quota를 대역으로 바꿨으므로 전체 Firestore 호출 수를 제시하지 않는다.

**quota의 plan을 단순히 로그에 복사해서는 안 된다.** 로그용 판정은 구독 status를 검사하지 않지만 quota 판정은 active/cancelled 여부를 검사한다. premium/inactive 합성 구독에서 로그 판정은 premium, quota 판정은 free로 갈라졌다. 중복 읽기를 제거하려면 기존 로그 판정 의미를 유지하는 요청 범위의 조회/결과 재사용과, 정책을 통일할지의 결정을 구분해야 한다. 전역 캐시·TTL·권한/한도 정책 변경은 포함하지 않는다.

## 3. 전송 방지와 서버 중복 처리

- [FormatModal 일반 다듬기](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/components/FormatModal.tsx#L1311)는 handler 시작의 `isPolishing` 확인과 버튼 disabled가 있다. React state 기반으로, 모든 동시 요청을 원자적으로 막는 서버 잠금은 아니다.
- [SayuModal 다시 다듬기](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/components/SayuModal.tsx#L1709), [개발자 제목 버튼](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/pages/SettingsPage.tsx#L591)은 버튼 disabled를 사용한다. handler 내부에는 해당 busy 상태만을 검사하는 명시적 가드가 없다. 이것만으로 실제 클릭 경쟁이 발생했다고 판정하지 않는다. UI 이벤트·재렌더·지연 조건을 재현한 E2E는 하지 않았다.
- [enforceRateLimit](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/utils/rateLimit.ts#L11)은 사용자/기능별 분·시간 창의 횟수 제한이다. 다듬기는 분 10회/시간 60회다. 실제 추출 함수에서 같은 창 10회 허용·11번째 거부를 확인했다. 같은 본문 두 요청이 제한 이하라는 이유로 하나로 합쳐지지는 않는다.
- 동일 본문 두 병렬 다듬기 합성 요청은 모두 처리됐다. **한 번의 사용자 조작이 두 번 전송됐는지, 의도적으로 다시 다듬기를 눌렀는지 서버 requestId만으로는 구분할 수 없다.** 서버 요청별 ID와 별개로 UI 조작별 operationId가 있어야 해당 구분을 검토할 수 있다. 아직 어느 쪽도 이 다듬기 계약에 추가하지 않았다.

제목 함수의 기존 값 보존과 요청 안 형식 중복 처리는 PR #287의 완료 범위다. 요청 간 잠금·강제 재생성은 이번에 추가하지 않았다. 건강 안전 검사·발행 게이트·다른 기능의 잠금 구현을 이 비용 점검 때문에 바꾸지 않는다.

## 4. 출력 길이와 토큰 자료

AST로 확인한 대상 목적은 `sayuPolish`, `recordStats`, `sayuPolishComment`, `recordTitle`, `recordTitleBackfill` 5개다. 각 호출에 `generationConfig`가 없고 [공통 창구](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/ai/aiGateway.ts#L77)는 요청 설정이 있을 때만 모델 설정에 넣는다.

- 한마디 `.slice(0,50)`, 제목 `.slice(0,20)`은 **생성 후** 반환값을 자른다. 합성 대역이 긴 출력/토큰을 반환해도 요청에는 토큰 상한이 없고, 반환 한마디 50자·제목 20자로만 줄었다.
- 본문 5,000자 검증과 제목 입력 600자 slice는 입력 제한이다. 프롬프트의 “10자 이내” 또는 “2,500자 이내” 지시도 API 생성 상한값과는 다르다.
- `getGeminiUsage`는 토큰 필드 누락을 null, 실제 숫자 0을 0으로 반환한다. 단, 명시적 null/빈 문자열은 현재 Number 변환 때문에 0이 됨을 재현했다. 운영 SDK가 그런 값을 준다고 확인한 것은 아니다. 향후 집계에서 알 수 없음과 실제 0을 구분하도록 계약을 검토해야 한다.
- 현재 창구의 정규화 필드는 입력/출력 토큰뿐이다. raw 응답에는 추가 메타데이터가 있을 수 있지만 이 범위는 finishReason·캐시 토큰·추론 토큰·공급자 내부 재시도 등을 기록하지 않는다. 토큰 수만으로 캐시 절감·전체 청구액·잘림 여부를 확정할 수 없다.

따라서 임의의 토큰 상한값은 권고하지 않는다. 목적별 실제 분포와 필수 출력의 완결성·통계 JSON 파싱·한국어 품질을 확인한 뒤 별도 품질 검증으로 결정해야 한다. 이번에 유료 샘플을 생성하지 않았다.

## 권장 개선 범위와 순서 — 구현 전

### 앞선 즉시 절감 후보 유지

FormatModal의 세 호출에서만 미사용 AI 한마디를 선택 생략하는 [앞선 1차 범위](https://github.com/hkd620-lab/haru2026/blob/579e99a61f4c3b65f7ad09846f47f1a5456d97be/docs/reviews/2026-10-21-polish-output-consumption-audit.md#4-권장-개선-범위--아직-구현하지-않음)가 여전히 우선이다. 선택 누락 시 기존 동작을 유지하고 SayuModal의 실제 한마디를 보존한다. 이번 계측 점검을 해당 구현 승인으로 해석하지 않는다.

### 계측 1차 후보: 다듬기 안에서 요청과 단계를 구분

- 범위: `polishContent`·`analyzeStats`의 계측 인자/기록 위치, `aiUsageLogger.ts`의 선택 필드, 관련 시험. 기존 `createAiUsageRequestId`를 활용할 수 있다. 공통 AI 창구나 모든 함수를 일괄 바꾸지 않는다.
- 서버 요청마다 비내용성 랜덤 requestId, 단계별 purpose/stage, 단계 소요 시간, 공급자 응답 결과와 본문 읽기/파싱 결과를 구분한다. `featureName`과 기존 토큰/요금제 필드는 호환 유지한다.
- 정상 경로의 현재 단계별 1행을 활용하고 시작/종료를 무조건 2행씩 Firestore에 추가하지 않는다. 공급자 오류·파싱 오류·모델 진입 전 거부를 모델 호출 수에 섞어 세지 않도록 정의한다. 한 모델 응답에 파싱 오류가 있으면 상태를 같은 단계 결과에 표현할지 결정한다.
- 로거 저장 실패가 사용자 요청을 깨뜨리지 않는 기존 원칙, 본문/통계/한마디 부분 실패 계약, quota 예약/환원·rate limit·안전 검증은 유지한다. 로깅을 위해 새 AI 요청을 추가하지 않는다.
- 본문·응답 원문·프롬프트·첨부파일·비밀값·원본 오류 메시지를 새 계측 필드에 넣지 않는다. 추가 recordId나 내용 hash가 없어도 단계 연결은 가능하다. 실제 공급자 전송 횟수와 논리 callAi 진입을 혼동하지 않는다.
- 구독 조회 중복·UI operationId·토큰 상한·공통 토큰 정규화 변경은 이 1차와 분리한다. 서버 요청 ID만으로 UI 중복률을 계산했다고 보고하지 않는다.

### 별도 작은 후보: 로그용 구독 조회를 요청 안에서 재사용

현재 로그 판정 의미를 보존하는 함수 범위의 조회/결과 재사용을 적용하면, 정상 지원 형식의 로그 전용 구독 읽기는 **3→1**, reading은 **2→1**이 후보 효과다. quota의 기존 조회까지 통합한다고 가정하지 않는다. 구독 상태가 처리 도중 바뀌었을 때 스냅샷 기준을 무엇으로 할지와 inactive/만료/개발자/조회 실패의 기존 판정을 시험해야 한다. quota plan의 무조건 재사용·전역 캐시·권한 변경은 제외한다.

### 더 뒤의 검토

- UI operationId가 필요하면 활성 클라이언트에 선택적 요청 필드로 추가하고, 누락 시 구형 동작을 유지한다. 실제 중복률·명시적 재요청을 관찰한 뒤 전송 가드/서버 잠금 필요성을 정한다.
- 목적별 출력 상한은 실측·품질 검증 뒤 별도 결정한다. 모델 교체·자동 fallback·통합 프롬프트·범용 캐시·강제 재생성은 이번 범위 밖이다.
- 제목 함수 계측·통계 저장 스키마·완료된 배뇨일지를 위 작은 범위에 섞지 않는다.

## 검증과 한계

- [진단 코드](2026-10-22-api-metering-audit-evidence/audit.cjs), [전체 결과·소스 SHA-256](2026-10-22-api-metering-audit-evidence/results.json), [실행 요약](2026-10-22-api-metering-audit-evidence/run-output.json), [재현 안내](2026-10-22-api-metering-audit-evidence/README.md).
- 서버 시나리오 **20개**, 토큰 변환 **5개**, 요금제 의미 차이 **1개**, 대상 호출 설정 **5개**, 클라이언트 명시적 busy 가드 **3개**의 단언을 통과했다. 이들을 하나의 기존 회귀시험 수로 합산하지 않는다.
- 실제 TS AST에서 추출한 코드만 vm에 넣고 AI/Firestore/quota를 대역으로 실행했다. rate-limit 함수와 로그용 구독 조회는 실제 추출 로직을 실행했지만 Firestore 트랜잭션 동시성·실청구·SDK 내부 전송을 시험하지 않았다. 병렬 시나리오는 동일한 두 요청을 처리하는 로직을 보여주며 React 클릭 경쟁을 재현하지 않는다.
- 기존 앱/시험/의존성은 수정하지 않았다. 문서·진단 근거 추가만 하므로 전체 앱/Functions 빌드는 반복하지 않고 진단 실행·실제 변경 경로·`git diff --check`를 확인한다.
- 유료 AI 호출·운영 사용자 기록/usage 로그 조회·데이터 변경·PR/CI·Codex PR 자동 리뷰·독립 검토·공식 판정①·병합·Hosting/Functions/Rules 배포는 하지 않았다. 분석 완료이며 제품 개선 완료가 아니다.
- Firestore 핵심 경로 `users/{uid}/records/{date}`, Functions `asia-northeast3`, 인증/결제 정책·모델·프롬프트·환경변수·모바일은 유지한다.

## 인수인계

현재 판정은 점검·개선 범위 정리 완료, 구현 미진행이다. 배뇨일지·제목 일괄 생성은 기존 완료 상태를 유지하고 다듬기 보조 출력의 앞선 보고서도 유효하다. 최신 main은 `8a2bbfd8`이며 이번 문서 브랜치는 `codex-api-metering-audit-20261022`다. 이 브랜치는 제품 코드·운영 배포를 바꾸지 않는다.

다음 첫 행동은 허대표님이 정한 좁은 구현 범위를 기준으로 main·배포 상태를 다시 확인하는 것이다. 즉시 절감은 앞선 ‘FormatModal 미사용 한마디 선택 생략’, 계측은 ‘다듬기 요청/단계 구분’, Firestore 중복 조회는 ‘로그 판정 의미를 보존한 요청 범위 재사용’으로 각각 나눠 진행한다. 명시적 범위 결정 없이 이 셋이나 동시 요청 잠금·강제 재생성·통계 저장 확대를 한 작업에 합치지 않는다.

작업 난이도: **5.5 중간**.
