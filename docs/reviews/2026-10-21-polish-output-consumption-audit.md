# 다듬기 보조 출력 — 불필요 API 호출 후속 점검

**✅ 최신 코드·운영 배포 소스 대조 및 개선 범위 정리 완료. 제품 구현은 하지 않았다.**

## 완료 건과 이번 범위

제목 일괄 생성 1차 개선은 PR #287 병합(main `8a2bbfd8cb24fd9d381ed75d9e3e5ce31d68fce9`), Hosting live `4328b2c609937df9`, `generateTitlesForAll` revision `generatetitlesforall-00129-nuf` 배포 및 승인된 운영 E2E까지 완료로 정리한다. 실제 계정 354개 내보내기 대조에서 최초 2건의 AI 제목/updatedAt만 변경됐고, 재실행·새로고침 후 추가 변경 0건과 기존 제목 보존을 확인했다. [확정 근거·확인 한계](https://github.com/hkd620-lab/haru2026/pull/287#issuecomment-6313863451). 이번 점검에서 해당 기록을 다시 조회하거나 생성하지 않았다.

다음 항목은 [기존 API 감사의 3번](https://github.com/hkd620-lab/haru2026/blob/d15534ab/docs/reviews/2026-10-19-api-call-waste-and-duplication-audit.md), `polishContent`의 통계(stats)·AI 한마디 생성과 소비/저장 계약이다. 허대표님 요청에 따라 분석·합성 진단·문서만 작성했다. 유료 AI 호출·운영 사용자 기록 조회/변경·PR·병합·배포는 하지 않았다.

## 기준과 방법

- 원격 main: `8a2bbfd8cb24fd9d381ed75d9e3e5ce31d68fce9`. 원본 Developer 작업본 `codex-question-input-three-lines`는 clean 상태로 보존하고, 별도 감사 브랜치 `codex-polish-output-audit-20261021`을 사용했다. 원격 `codex` 브랜치가 있어 하이픈 방식으로 이름을 정했다.
- 운영 `polishContent`: `asia-northeast3`, `nodejs22`, ACTIVE, revision `polishcontent-00242-pay`, updateTime `2026-09-13T08:05:26.095480723Z`. [메타데이터](2026-10-21-polish-output-audit-evidence/deployment.json).
- 운영 소스 generation `1789286623874132`, ZIP SHA-256 `b9c1f6804d1737de596b956cae7b4d79cb54639c6ac523b74d53c986ceb25f02`. 원본 ZIP은 로컬에서만 읽고 필요한 소스 함수만 추출했다. 비밀값·사용자 데이터는 읽지 않았다.
- 운영 도메인 HTTP 200 및 `/assets/index-bqOd6PMb.js` 유지 확인. 웹 분석은 위 main의 활성 라우트·소비처 코드 기준이다. 이번에 실제 다듬기 버튼이나 운영 callable은 실행하지 않았다.
- main TypeScript·운영 TypeScript·운영 실행 JavaScript의 실제 핸들러, `STATS_PROMPTS`, `analyzeStats`를 AST로 추출해 합성 SDK/AI와 메모리 저장소로 실행했다. 버전별 27개, 총 **81개 서버 시나리오**의 결과가 일치하고 단언을 통과했다. 앱·Firebase·공급자 SDK를 import하지 않았다.
- [진단 코드](2026-10-21-polish-output-audit-evidence/audit.cjs), [전체 결과·소스 해시](2026-10-21-polish-output-audit-evidence/results.json), [재현·한계](2026-10-21-polish-output-audit-evidence/README.md).

## 1. 서버는 사용하지 않을 출력도 생성한다

[본문](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/index.ts#L2430) → [지원 형식 통계](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/index.ts#L2455) → [AI 한마디](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/functions/src/index.ts#L2465) 순서다. ‘별도 호출 없음’이라는 주석과 달리 한마디도 별도 모델 호출이다.

| 요청 조건 | 정상 흐름의 논리 모델 호출 | 반환 |
| --- | --- | --- |
| diary/essay/mission/report/work/travel/garden/pet/child/memo | 본문 1 + 통계 1 + 한마디 1 = **3회** | `text`, 객체 `stats`, `aiComment` |
| reading/voiding/미등록 형식/format 누락 | 본문 1 + 한마디 1 = **2회** | `text`, `stats:null`, `aiComment` |
| BASIC 모드의 지원 형식 | **3회** | 동일한 응답 필드 |
| 현재 코드에 `includeStats:false`, `includeAiComment:false`를 보내는 합성 요청 | 지원 형식에서 여전히 **3회** | 옵션은 현재 구현되어 있지 않음 |

통계 미지원 형식은 `analyzeStats`가 null을 돌려줄 뿐 유료 통계 모델을 호출하지 않는다. 위 숫자는 코드의 `callAi`/SDK 진입 횟수이며, SDK 내부 재시도·실청구액·월간 이용횟수 차감이 아니다. quota 예약은 다듬기 요청당 1회다. `text`/`stats`/`aiComment` 응답 키와 인증·5,000자 제한·rate limit·quota·부분 실패 처리는 세 버전에서 같은 분기를 확인했다.

## 2. 활성 소비처별 유실·미소비 출력

| 활성 소비처 | 사용하는 결과 | 미소비 또는 유실 | 이번 권장 1차의 예상 변화 |
| --- | --- | --- | --- |
| FormatModal 일반 다듬기 | 본문 미리보기, stats를 상태/저장 payload에 넣음 | AI 한마디를 읽지 않음. 객체 stats는 RecordPage 저장 필터에서 탈락 | 지원 형식 **3→2회**. 통계는 1차에서 그대로 둠 |
| FormatModal 독서 마무리·중간 독서장(및 일반 독서 다듬기) | 본문 분석·저장 | AI 한마디 미사용. reading stats는 원래 null | **2→1회** |
| SayuModal 다시 다듬기 | 본문·AI 한마디 저장/표시 | 지원 형식의 stats를 읽거나 저장하지 않음 | 1차에서는 유지. 별도 stats 선택 생략 시 **3→2회** 후보 |
| 배뇨일지 해석 | 안전 검사를 통과한 `text`만 저장 | 한마디 미사용, 통계 모델 호출 없음 | 완료 건을 다시 수정하지 않고 1차에서 제외 |

일반 모달은 [응답을 읽어](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/components/FormatModal.tsx#L1376) [stats 객체를 저장 payload에 추가](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/components/FormatModal.tsx#L2868)한다. 그러나 [RecordPage:656](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/pages/RecordPage.tsx#L656)은 비어 있지 않은 문자열만 복사한다. 실제 `handleSaveSayu`와 상위 필터를 모의 실행해 `memo_stats(object)`가 탈락하고 본문/사용자 제목은 유지됨을 재현했다. 이 필터는 다른 객체·boolean도 제외하므로 통계만을 위해 전역 타입 허용을 넓히지 않는다. 기존 JSON 문자열 stats는 통과할 수 있어 레거시 형태도 구분해야 한다.

[SayuModal:1727](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/components/SayuModal.tsx#L1727)은 `text`와 `aiComment`만 읽고, 한마디가 비어 있지 않을 때 저장·표시한다. 모의 Firestore 검증에서 stats 응답은 저장되지 않고 기존 stats는 보존됐다. 빈 한마디는 기존 한마디를 지우지 않았다. [SayuPage](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/pages/SayuPage.tsx#L2479)가 저장된 한마디를 모달에 넘기고 [모달에서 표시](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/components/SayuModal.tsx#L3063)하므로 **AI 한마디를 전역 제거하면 안 된다.**

ExportModal·SayuService는 활성 진입 참조를 확인하지 못해 현재 절감 가능 호출 수에 넣지 않았다. 숨김 LibraryPage는 점검하지 않았으며, 보존 파일은 활성 경로·비용 계산의 근거에서 제외하고 복구·수정하지 않았다.

## 3. 통계 객체 유실과 현재 통계 화면은 구분해야 한다

활성 [형식 통계 화면](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/App.tsx#L233)은 [calculateFormatStatistics](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/pages/FormatStatisticsPage.tsx#L228)를 호출한다. 이 서비스는 [형식별 계산 함수](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/services/firestoreService.ts#L1266)로 기록 필드·별점 등을 계산하며 저장된 AI stats 객체의 지표를 그대로 읽어 표시하는 경로가 아니다. [전체 통계](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/services/firestoreService.ts#L1993)도 형식·SAYU 존재 여부 등을 집계한다.

- 실제 `calculateDiaryStats`에 같은 합성 기록을 넣고 `diary_stats`의 AI 수치만 바꿔도 계산 결과는 같았다.
- 단, [calculateBasicStats](https://github.com/hkd620-lab/haru2026/blob/8a2bbfd8/frontend/src/app/services/firestoreService.ts#L1443)는 접두어로 시작하는 필드가 하나라도 있으면 내용이 있다고 센다. 메모 내용이 없는 합성 기록에서 `memo_stats` 메타데이터만 추가하면 `positivity_ratio`가 0→1로 바뀌었다. AI 지표를 해석한 것은 아니지만 메타데이터 존재가 간접 영향을 줄 수 있다.

따라서 **‘stats 객체를 저장하면 현재 통계 화면이 정상화된다’고 결론 내릴 수 없다.** 기존 AI 통계 값을 계속 생성·보존할지, 검증된 데이터로 별도 표시할지, 현재 소비처에서는 생략할지 먼저 정해야 한다. 통계 저장을 급히 넓히거나 저장된 과거 stats를 삭제하지 않는다.

## 4. 권장 개선 범위 — 아직 구현하지 않음

### 1차 권장: FormatModal의 미사용 AI 한마디만 선택 생략

- 서버 `polishContent`에 한마디 생성 여부를 선택하는 요청 계약을 둔다. 예시는 `includeAiComment?: boolean`이며, **누락 시 기존 생성 유지, 명시적 false에서만 생략**한다. 구형 클라이언트·직접 호출은 기존 동작을 유지해야 한다.
- FormatModal의 일반 다듬기·독서 마무리·중간 독서장 세 호출에서만 생략을 명시한다. 본문·stats의 생성/처리·저장 계약은 바꾸지 않는다.
- 응답 키 `text`/`stats`/`aiComment`는 유지하고 생략된 한마디는 빈 문자열 등 기존 빈 값 계약으로 반환하되, 저장된 한마디를 지우는 동작은 추가하지 않는다.
- SayuModal의 실제 한마디 생성·저장·표시는 유지한다. 배뇨일지·통계 화면·RecordPage 저장 필터·공용 프롬프트/모델은 이 1차에서 수정하지 않는다.
- 예상 변경 파일은 `functions/src/index.ts`의 해당 핸들러, `FormatModal.tsx`의 세 호출 및 관련 회귀 시험으로 한정한다. 모델·프롬프트·quota/rate limit·권한·Firestore 경로·Functions 리전·결제/요금 정책·기존 AI 값은 유지한다.
- 지원 형식은 논리 모델 진입 3→2, reading은 2→1이 후보 효과다. 호출 빈도·토큰·SDK 재시도·실청구를 계측하지 않아 월 절감액은 산정하지 않았다.

### 별도 후속 범위

1. **SayuModal의 미사용 stats 선택 생략:** 본문·한마디는 유지하고 stats만 요청별로 생략하는 계약을 별도 검토한다. 기존 stats를 지우지 않아야 하며 월간 quota 1회 정책을 모델 호출 수와 혼동하지 않는다.
2. **FormatModal stats 저장/활용 정책:** 현재 저장 유실과 별개로 실제 소비 목적을 결정한다. 저장을 선택하면 `_stats` 키별 허용 스키마·레거시 문자열·메타데이터 집계 영향까지 검증하고, 모든 객체를 통과시키는 식으로 해결하지 않는다.
3. **배뇨일지 미사용 한마디:** 완료 건의 안전 검증을 유지하는 별도 승인 범위에서만 검토한다. 이번에 재오픈·수정하지 않았다.
4. 동시 요청 잠금·캐시·출력 토큰 상한·본문/통계/한마디 통합 생성·모델 교체는 이번 개선 범위에서 제외한다.

### 실제 구현 시 필요한 검증

옵션 누락/true는 기존 호출 순서·응답을 유지하고, false는 한마디 모델만 생략해야 한다. 지원/미지원 형식·BASIC/PREMIUM·본문 실패·통계 실패·기존 한마디 보존·한마디를 쓰는 SayuModal 대조군을 포함한다. 권한/5,000자/rate limit/quota·부분 실패 동작, Functions 빌드·관련 시험·export diff, 웹 빌드·관련 요청 계약 시험이 필요하다. 서버가 먼저 옵션을 지원하는지 확인하지 않고 클라이언트에 false만 추가해선 호출이 줄지 않는다.

운영 함수는 SDK 직접 호출이고 main은 `callAi` 경로다. 현재 세 용도의 모델은 모두 Gemini / `gemini-3.1-flash-lite`지만, 이후 main 소스로 이 함수를 배포하면 게이트웨이·Secret 연결 선행 변경도 함께 포함된다. 실제 구현/배포 단계에서 이 차이와 클라이언트 호환을 별도 확인해야 한다. 이번 모의 진단은 분기·응답·저장 계약 확인이며 AI 응답 품질 검증이 아니다.

## 검증·보존·인수인계

- 서버 81개 시나리오 및 프런트 저장/통계 합성 단언 모두 통과. [실행 요약](2026-10-21-polish-output-audit-evidence/run-output.json). 실제 기존 시험·앱 소스·의존성·환경변수는 수정하지 않았다.
- 새 문서·감사용 진단 근거만 추가했다. `git diff --check` 및 실제 변경 경로를 확인한다. 제품 코드 변경이 없어 앱/Functions 전체 빌드는 반복하지 않았다.
- 구현·PR CI·자동 PR 리뷰·독립 검토·공식 판정①·운영 모델 호출·운영 E2E·병합/배포는 이번 점검에서 실행하지 않았다. 제품 구현/배포 완료로 해석하지 않는다.
- 사용자 원본 작업본은 보존, 기존 제목 완료 상태 유지. 금지 사항은 동시 요청 잠금·강제 재생성·다른 항목 임의 수정·비밀값/사용자 데이터 게시다.
- 다음 첫 행동: 이 문서의 1차 범위(FormatModal 미사용 한마디 선택 생략)를 허대표님이 승인하면 최신 main/운영 상태를 재확인한 뒤 해당 범위만 구현한다. stats 저장 확대나 전역 한마디 제거로 범위를 넓히지 않는다.

작업 난이도: **5.5 중간**.
