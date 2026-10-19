# 김비서 자료 대조 — 불필요·중복 API 호출 점검

## 결과와 범위

**✅ 최신 main 코드 대조·모의 진단·개선 범위 정리 완료. 구현은 하지 않았다.**

허대표님 요청: “김비서 자료를 최신 코드와 대조해서 불필요·중복 API 호출부터 점검해줘. 아직 수정하지 말고 결과와 개선 범위를 정리해.”

- 기준 코드: main **9141f7f37fa9ff7e41baae977f9a594de649d603**. 원본 Developer 작업본은 `codex-question-input-three-lines`, 시작 시 미커밋 변경 없음. 별도 감사 브랜치 `codex-api-call-audit-20261019`에서 새 보고서·진단 근거만 추가했다.
- 대조 자료: [김비서 · HARU2026 PWA API 비용·교체 용이성 분석, 2026-10-18](https://harulab-hq.slack.com/archives/C0C92KHPTBL/p1792327744726879). 자료의 소스 기준은 `9fa88ead…`이다. 현재 main의 활성 호출·반환값·클라이언트 소비·저장까지 다시 추적했다.
- **이 점검은 현재 저장소 main 기준이다. 운영 Functions의 배포 소스 일치·실제 호출량·청구액·장애 발생 여부는 확인하지 않았다.** 실절감액, 전체 사용자 영향, 운영 실패 확정으로 확대하지 않는다.
- 모델 교체·유료 AI 호출·운영 기록 조회/변경·Functions/Hosting/Rules 배포·PR 생성·병합은 없다. 기존 앱·기존 시험·환경변수·의존성을 수정하지 않았다.

## 우선순위와 판정

| 순서 | 항목 | 현재 main 대조 결과 | 권장 개선 범위 |
| --- | --- | --- | --- |
| 1 | 배뇨일지 응답 계약 | 활성 페이지는 `result`를 읽지만 서버는 `text` 반환. 모의 응답에서 빈 값으로 처리됨 | 응답 필드·형식·안전 검증 계약 정합성 확인. 별도 건강 기능 검증을 유지하고 무의미한 재시도 방지 |
| 2 | 개발자 제목 일괄 생성 | `_title`로 skip, `_ai_title`에 저장. 같은 기록 두 번 실행 시 두 번 생성·덮어쓰기 재현 | 이미 생성된 AI 제목 판정 정합성·재실행 멱등성. 사용자 제목 보존 |
| 3 | 다듬기 결과 중 미소비 출력 | FormatModal은 AI 한마디 미사용, stats 객체는 RecordPage 문자열 필터에서 탈락. SayuModal 재다듬기는 stats 미사용 | 소비처별 필요한 출력·저장 계약 결정 후 선택적 보조 호출. 전역 기능 삭제 금지 |
| 4 | 출력 상한·중복 요청 계측 | 대상 모델 호출에 명시적 생성 토큰 상한·공통 중복 방지가 없음. 사후 slice는 길이 후처리 | 목적별 상한·논리 요청ID/단계 계측·전송 중복 방지. 범용 캐시·프롬프트 결합은 후속 검증 |
| 비용원으로 확정하지 않음 | 저장 뒤 extractTitle | 결과 미사용 코드는 있지만 handleSubmit 참조가 선언1회뿐. 현재 UI에서 연결되지 않음 | 현행 낭비 호출 수에 넣지 않음. 공용 extractTitle 삭제 금지 |
| 비용원으로 확정하지 않음 | 자동 키워드 백필·뉴스 스케줄 | observeKwTarget 호출 참조 없음. fetchTopNews는 주석이라 소스 export 없음 | 현재 웹 경로의 자동 비용으로 합산하지 않음. 운영에 남은 구형 배포 여부는 별도 확인 |

## 1. 배뇨일지: 생성 결과를 읽는 필드가 다름

- [클라이언트](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/pages/SayuHealthVoidingPage.tsx#L239): `polishContent` 호출 후 `res.data.result ?? ''`를 읽고, 빈 값이면 안전 검증 실패 메시지와 함께 저장하지 않는다. [활성 라우트](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/App.tsx#L270)가 있다. 라우터는 읽기만 했다.
- [서버](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/functions/src/index.ts#L2505)는 `{ text, stats, aiComment }`를 반환한다. `voiding`은 통계 프롬프트 대상이 아니므로 통계 모델 호출은 없고 본문+AI 한마디 **2개의 논리 모델 호출**이 발생한다.
- 실제 서버 핸들러를 추출하고 AI를 모의 응답으로 바꾼 진단에서 `text='모의 본문'`이 반환돼도 해당 클라이언트 표현식은 `''`였다. 운영 백엔드가 같은 계약일 때 적용되는 정적·모의 재현이며 **실제 사용자 장애를 관찰한 것은 아니다.**
- 개선 범위: 응답 타입·필드 계약을 맞추고 `isSayuSafe`, 세션 전환·중복 클릭 방지·저장 조건을 유지한다. 값이 비었다는 이유로 다른 AI 호출을 자동 추가하거나 안전 검증을 우회하지 않는다. 건강 해석 내용·의료 정책·통계 계산식은 변경 범위에서 제외한다. 운영 확인과 필요한 유료 시험은 별도 범위·예산 결정 후 진행한다.

## 2. 제목 일괄 생성: 저장 필드와 skip 필드 불일치

- [generateTitlesForAll](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/functions/src/index.ts#L4741)는 `${prefix}_title`이 유효할 때만 skip한다. 새 결과는 [`${prefix}_ai_title`](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/functions/src/index.ts#L4776)에 쓴다.
- 현재 UI는 [SettingsPage의 개발자 전용 버튼](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/pages/SettingsPage.tsx#L1278)이고, 서버도 내부 개발자UID를 검사한다. 일반 사용자의 상시 자동 비용으로 취급하지 않는다. 조회는 최대500문서이며 문서별 형식을 순회한다. 실제 대상 수·사용 빈도는 미확인이다.
- 메모1건의 메모리 저장소 진단: 최초1회 호출·저장 → 재실행도1회 호출·저장. 기존 `_ai_title`만 있는 기록도 다시 생성했다. 반대로 유효한 사용자 `_title`이 있는 대조군은 두 번 모두0회였다.
- 개선 범위: “제목 없는 기록 채우기”의 의미에 맞춰 사용자 제목·유효한 기존 AI 제목을 모두 판정하고 재실행 중복을 막는다. 원문 변경 시 갱신·명시적 재생성은 별도 명세로 정한다. 동시 요청은 사용자/기록/형식/본문·프롬프트 버전을 고려한 중복 방지가 후보이다. 운영 기록의 기존 값 정리·마이그레이션·대량 재생성은 이 범위에 포함하지 않는다.

## 3. polishContent: 필요한 출력과 생성한 출력이 다름

서버는 순차적으로 본문 → 지원 형식 통계 → AI 한마디를 생성한다. 통계 프롬프트가 있는10형식은 **3회**, `reading`/`voiding` 등 미지원 형식은 **2회**다. 통계 지원 형식은 diary/essay/mission/report/work/travel/garden/pet/child/memo다. 표의 횟수는 정상 흐름의 `callAi` 진입 횟수이며 SDK 내부 재시도·실청구 횟수·월간 이용횟수 차감을 뜻하지 않는다. 월간 quota 예약은 논리 다듬기 요청당1회로 별도다.

| 활성 소비처 | 반환값 사용 | 미소비·유실 범위 |
| --- | --- | --- |
| [FormatModal 일반 다듬기](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/components/FormatModal.tsx#L1376) | 본문 미리보기, stats 상태에 보관 후 저장 payload 포함 | aiComment 읽기 없음. 객체 stats는 [RecordPage:656](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/pages/RecordPage.tsx#L656)의 문자열 전용 필터에서 탈락 |
| [FormatModal 독서 마무리](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/components/FormatModal.tsx#L3160)·[중간 독서장](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/components/FormatModal.tsx#L3228) | 본문 분석/저장 | aiComment 읽기 없음. reading stats는 null이므로 유료 통계 호출이 있었다고 세면 안 됨 |
| [SayuModal 다시 다듬기](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/components/SayuModal.tsx#L1728) | 본문과 aiComment를 저장하고 localAiComment로 표시 | 서버가 지원 형식에서 생성한 stats는 읽거나 저장하지 않음 |
| 배뇨일지 | result 필드만 읽음 | 위 응답 계약 불일치. aiComment도 사용하지 않음 |

**AI 한마디는 SayuModal에서 실제 저장·표시되므로 전역 제거하면 안 된다.** 김비서의 이 주의점은 유지한다. 새 기록 경로의 통계가 빠지는 것은 데이터 전달 계약 문제이며, 현재 화면에서 통계가 어떻게 쓰여야 하는지를 확정한 후 보존 또는 생성 생략을 선택해야 한다. 필요 여부를 확인하지 않고 저장 스키마를 넓히거나 기능을 끄지 않는다.

가장 작은 개선 후보는 소비처별 `includeStats`/`includeAiComment`와 같은 **선택적 출력 계약**이다(이름·기본값 미확정). 기존 클라이언트 기본 동작을 보존하고, 안 쓰는 보조 결과에 대해서만 해당 모델 호출을 생략한다. 본문/한마디/통계의 JSON 통합 생성은 프롬프트·품질·부분 실패 처리를 바꾸므로 별도 검증 후 검토한다. 현재 소비가 없는 한마디를 새로 저장·표시할지, 생성하지 않을지는 제품 범위 결정이다.

## 4. 자료에서 비용원으로 단정하면 안 되는 경로

- FormatModal의 [handleSubmit](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/components/FormatModal.tsx#L1228)에는 반환값을 버리는 `extractTitleFn(...)`가 있다. 그러나 AST상 `handleSubmit` 식별자는 선언1회뿐이다. 현재 저장 버튼은 handleSaveOriginalAsSayu/handleSaveSayu 등에 연결된다. **소스에 불필요한 호출이 있다는 사실만으로 현재 호출 비용을 절약할 수 있다고 계산하면 안 된다.**
- 공용 `extractTitle`은 [GrowthTimelineCreator](https://github.com/hkd620-lab/haru2026/blob/9141f7f3/frontend/src/app/components/GrowthTimelineCreator.tsx#L193)에서 결과를 사용한다. 엔드포인트 전역 삭제 대상이 아니다.
- SayuPage의 AI 로그 제목 백필은 `if(false && ...)`로 막혀 있다. 키워드용 observeKwTarget도 선언 외 참조가 없어 현재 observer에 요소가 등록되지 않는다. 이 경로를 현재 웹의 상시 자동 모델 호출로 세지 않는다. `extractKeywords` 엔드포인트 자체의 다른 클라이언트/직접 호출 여부는 별도다.
- `fetchTopNews` 스케줄은 주석 안에 있어 AST export에 없다. 활성 `refreshNews` 같은 수동 경로와 분리한다. **운영에 남은 구형 함수/스케줄러는 조회하지 않았으므로 자동 과금이 절대 없다고 판정하지 않는다.**
- ExportModal/FormatModal_DEBUG/`.broken` 및 미사용 SayuService는 활성 진입 확인 없이 현재 비용 합계에 넣지 않았다. 숨김 LibraryPage·보존 파일은 복구·수정하지 않았다.

## 5. 단계별 개선 범위와 검증 조건

1. **반환·저장 계약 확인부터:** 배뇨일지 `text/result` 불일치와 통계 객체 유실을 별도 이슈로 다룬다. 건강 안전 검사·기존 저장 경로·사용자 제목·기존 한마디 표시를 유지한다. 필요한 출력의 소비 계약이 정해져야 생성 생략도 안전하게 결정할 수 있다.
2. **제목 백필 멱등성:** 실제 코드 기반 무과금 모의 시험으로 기존 수동제목/기존 AI제목/빈 제목/무효 제목/재실행/중도실패 후 재시작/동시요청을 검증한다. 기존 값을 임의 삭제하거나 기록 전체를 실제 API로 재처리하지 않는다.
3. **소비처별 보조 호출 선택:** 최초 범위는 polishContent와 활성 소비처의 옵션·응답 타입/필드·해당 테스트다. 모델·프롬프트·quota·권한·요금 정책·Functions 리전은 유지한다. 구형 클라이언트 호환과 생략된 출력이 기존 값을 지우지 않음을 확인한다.
4. **중복·상한 계측:** 입력/출력/재시도/캐시 여부를 단계별로 구분하고 하나의 사용자 동작에 연결할 논리 requestId를 검토한다. 현재 polish/통계/한마디는 같은 featureName이며 requestId가null이고 제목 추출·백필에는 같은 usage로그가 없어 월 절감액을 이 자료만으로 정밀 계산할 수 없다. 본문·민감정보를 로그에 넣지 않는다. 명시적 재다듬기는 새 결과 요청일 수 있으므로 원문 hash가 같다는 이유만으로 강제 캐시하지 않는다.
5. **출력 상한·통합 생성은 후속:** 대상 callAi에는 명시적 generationConfig.maxOutputTokens가 없으며 반환값slice는 생성 후 처리다. 목적별 상한 후보는 실제 토큰·필수 출력 완결성을 보고 정한다. 이번에 임의의 상한값·공급자 교체·자동 fallback을 도입하지 않는다.

예상 효과는 “불필요한 모델 요청 수 감소·실패 재시도 예방” 수준이다. 어떤 필드를 계속 제공할지에 따라 절감 가능한 호출 수가 달라지며 실제 월 비용은 호출 빈도·토큰·재시도·배포 소스 확인 후 산정해야 한다. 법률·건강·발행 검토 게이트를 비용 절감을 이유로 삭제하지 않는다.

## 검증·보존 상태

- [AST 추출·메모리 모의 진단](2026-10-19-api-call-audit-evidence/audit.cjs), [결과·소스해시](2026-10-19-api-call-audit-evidence/results.json), [재현·한계](2026-10-19-api-call-audit-evidence/README.md). 실제 Firebase/AI SDK를 import하지 않고 추출한 핸들러를 vm에서 실행했다.
- 모의 단언 전부 통과. 제목 재실행 중복·수동제목 대조군·stats 탈락·voiding 계약 불일치·비활성 선언 참조·뉴스 export를 확인했다. AI 응답 품질·의료 안전성·실제 저장 E2E·운영 호출량을 검증한 시험은 아니다.
- 문서·독립 진단 파일만 추가해 앱/Functions 빌드는 반복하지 않았다. `git diff --check`와 변경 경로를 확인한다. 새 PR·자동 CI·Codex PR 리뷰·독립 Claude 판정은 실행하지 않았고 공식 판정①을 주장하지 않는다.
- Firestore `users/{uid}/records/{date}`, Functions `asia-northeast3`, 결제·인증·Rules·환경변수·운영 데이터 유지. PR284·#279 상태는 이 독립 감사로 바꾸지 않는다.
- 다음 첫 행동: 이 목록에서 실제 개선할 좁은 범위를 선택한다. 이 보고서 자체를 구현·유료 시험·병합·배포 승인으로 이어받지 않는다.

작업 난이도: **5.5 중간**.
