# PR #295 독립 검토 1 — 결과 원문

- 대상 HEAD: `1a174372086f46202250cd4b705a72fb739f295a`
- 출처: 검토 에이전트 최종 회신(전사 파일에서 그대로 추출, 수정 없음)

````text
판정: 승인

검토 대상 HEAD SHA: 1a174372086f46202250cd4b705a72fb739f295a (PR #295, cc/stats-merge-followups → main)

## 차단 지적
없음. 실제로 실패하는 시나리오는 찾지 못했습니다.

## 확인한 내용 (정확성)
1. **SayuModal 작물 자동 채우기 제거** (frontend/src/app/components/SayuModal.tsx:1313)
   - 원본 보기: `renderOriginalData`는 `editedOriginalData`에 있는 키만 그립니다(1766~1777). 작물을 고르지 않은 텃밭 기록에서는 '🌱 식물종류' 칸이 이제 나오지 않습니다. 빈 문자열로 저장된 키는 지금처럼 빈 칸으로 보입니다. 결정 ②에 맞는 의도된 변화이고 오류는 아닙니다.
   - 다시 다듬기와 원본 저장: 이제 그 기록에 저장된 작물만 넘어갑니다. 등록 작물 전체가 기록에 쓰이던 문제는 사라졌고, 다른 회귀는 없습니다.
   - `doc`·`getDoc`는 703·881·1364행 등에서 계속 쓰이므로 쓰지 않는 import가 생기지 않습니다.
2. **getRecordsInRange throwOnError** (frontend/src/app/services/firestoreService.ts:815, 843)
   - 기본값이 `{}`라서 다른 호출부(firestoreService.ts:1225, :1998, SayuHealthVoidingPage.tsx:118)는 지금처럼 빈 목록을 받습니다. 영향이 없습니다.
   - `.bak_ailog`, `.test_backup` 파일에 남은 옛 시그니처는 빌드 대상이 아닙니다.
3. **통계 두 화면의 실패 안내**
   - StatisticsPage.tsx:50/115와 FormatStatisticsPage.tsx:75/165 모두 catch에서 `setLoadFailed(true)`를 부르고, 안내 문구를 로딩 문구보다 먼저 확인합니다.
   - 취소(`cancelled`) 처리도 되어 있습니다. 경로에 문제가 없습니다.
4. **EPUB 이스케이프** (functions/src/epubExport.ts:58-59, 75, 90, 99)
   - 날씨·기분·성장기록 본문·측정값은 저장할 때 평문입니다. 타임라인 content는 `buildTimelineSummary`가 만든 평문입니다(GrowthTimelineCreator.tsx:157).
   - 그래서 이중 이스케이프가 일어나지 않습니다. 일반 형식 본문(이미 escape 중)과 처리 방식도 같아졌습니다.
   - 오히려 지금까지 이스케이프하지 않은 `&`·`<`가 XHTML을 깨뜨릴 수 있었던 문제가 고쳐집니다.
5. **photoOnly 안내**: 글 없는 타임라인에서 사진을 하나도 받지 못하면 문구가 들어가는 조건은 맞습니다.
6. **테스트**: git archive로 scratchpad에 풀어 statsStorage.policy.test.cjs를 직접 돌렸고 통과했습니다. vite·functions 빌드는 다시 돌리지 않았고, PR 본문의 CC 실행 결과를 따랐습니다.

## 비차단 메모
- **(낮음) functions/src/epubExport.ts:228, 263**: `photoOnly`가 사진 URL이 0개인 경우에도 참이 됩니다. `[].every()`가 true를 돌려주기 때문입니다.
  - 시나리오: 성장타임라인 기록에 content가 없고 `timelineItems`도 비어 있거나 http 주소가 아니면, '(내용 없음)'과 '(사진을 불러오지 못했습니다)'가 함께 들어갑니다.
  - 드문 경우이고 장이 비는 것도 아니어서 표시가 어색한 정도입니다.
  - 제안: `chapter.photoOnly && chapter.photos.length > 0 && srcByChapter[index].every((src) => !src)`
- **(낮음) 같은 조건**: 상한(overLimit)이나 시간 예산 초과로 빠진 사진도 '불러오지 못했습니다'로 표시됩니다. 응답의 `limitedPhotos`로 따로 안내되니 그대로 두어도 됩니다.
- **(정보)** `!record.content`라서 공백만 있는 content는 photoOnly로 보지 않습니다. 실제 저장값은 trim된 요약이라 문제는 없습니다.
- **(정보)** 원본 보기에서 작물 칸이 없는 기존 텃밭 기록은 그 화면에서 작물을 새로 넣을 수 없습니다. 결정 ②의 범위 안이라 필요하면 별도 UX 과제로 다루면 됩니다.

## 요구사항 충족
- PR #291 후속 과제 6건 가운데 4건이 반영됐습니다: 작물 자동 채움, 통계 로딩 실패 표시, 사진만 있는 타임라인의 빈 장, 기존 EPUB 필드 이스케이프.
- 남은 2건은 의도적으로 범위 밖입니다. PR 본문이 "비용·저장 경로·AI 호출과 무관한 4건"으로 범위를 밝혔으므로 누락으로 보지 않습니다.
  - 프리미엄 전체 기간·작년 비교
  - 독서 초안의 추가 소감·수정 선택 안내
- 이 2건은 다음 과제로 계속 추적해야 합니다.
- 결정 ②("텃밭은 기록마다 고른 작물만 저장")와 일치합니다. Slack 원문은 MCP 인증이 없어 직접 읽지 못했고, 지시서의 요약을 기준으로 판단했습니다.

## 규모·멈춤 조건
- **규모: 소~중규모.** 컴포넌트 일부 수정, 서비스 선택 인자 추가, Functions 본문 생성 수정입니다.
- **8.1 멈춤 조건: 해당 없음.**
  - 모델 다운그레이드나 교체, 출력 품질 변경이 없습니다.
  - 커밋 내용과 실제 변경이 일치합니다.
  - 홈·라우터·새 기능이 아닙니다.
  - 저장 경로(`users/{uid}/records`), Rules, 결제, 인증, AI 호출 변경이 없습니다.
  - Functions 리전 asia-northeast3와 설정(1GiB·동시 1·300초)이 그대로입니다.
- **배포 안내**: 병합하면 Hosting이 자동 배포됩니다. `exportEpub`는 Functions 배포를 따로 해야 합니다(asia-northeast3). PR 본문대로 배포 승인 절차를 따르면 됩니다.

파일은 수정하지 않았습니다. scratchpad에 풀어 둔 소스: /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/pr295src
````
