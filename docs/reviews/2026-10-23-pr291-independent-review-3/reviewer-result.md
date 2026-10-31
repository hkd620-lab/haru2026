# 독립 검토 3 — 결과 원문

- 대상 HEAD: `4942bf81702d0ae7cf1b94f35527482641e34900`
- 출처: 검토 에이전트 최종 회신(전사 파일에서 그대로 추출, 수정 없음)

````text
판정: 수정 후 승인

검토 대상 HEAD: 4942bf81702d0ae7cf1b94f35527482641e34900 (origin/cc/stats-merge-epub, base codex-write-then-format). 코드 기준 HEAD는 d7efa1e3입니다.
- `git diff --name-status d7efa1e3..4942bf81`의 6개 항목은 모두 `A`이고 경로가 `docs/reviews/` 아래입니다. 검토 기록 전용 커밋 예외에 해당합니다.
- `git diff --check 5afe4b9e..HEAD`도 통과했습니다.

이번 판정은 같은 건의 세 번째 '수정 후 승인'입니다. 8.1절 상한은 "3회를 넘으면"이므로 아직 상한 안입니다. 다음 회차도 '수정 후 승인'이면 상한을 넘어 허대표님 보고 대상이 됩니다.

## 직접 확인한 것
HEAD를 git archive로 scratchpad에 풀어서 실행했습니다. 저장소와 브랜치는 건드리지 않았습니다.
- **frontend:**
  - `npm run test:record-stats`: recordStats 16개 통과, statsStorage 정책 테스트 통과
  - `vite build`: 성공
- **functions:**
  - `tsc` 빌드: 오류 없음
  - `node --test test/epubContent.test.js`: 6개 통과
- **PR CI(4942bf81):** build_and_preview, Deploy Preview 모두 SUCCESS, MERGEABLE
- **Firebase SDK:** firebase 12.13.0(@firebase/functions 0.13.4)의 `HttpsCallableOptions.timeout`이 실제로 있음을 확인했습니다.
- **Slack 스레드:** 다시 확인했습니다. "두 칸에 같은 문장이 있으면 한 번만 셉니다"라는 중복 처리 원칙이 게시돼 있습니다.

## 이전 지적별 해결 여부

**A. garden_crops 배열이 SAYU 원본 칸·다시 다듬기에 들어감 — 해결**
- `SayuPage.tsx:2418`에 `typeof record[key] === 'string'` 조건이 추가됐습니다.
- `SayuModal.tsx:1718`은 `typeof v === 'string' && v.trim()`으로 바뀌었습니다.
- SayuModal을 여는 곳은 SayuPage:5338 한 곳뿐입니다.
- `garden_` 접두어 키를 도는 다른 곳도 모두 확인했습니다: SayuPage(428, 2241, 2293, 2332, 2435, 2947, 3973, 4013), RecordDetailPage, RecordPage:819, ProphecyFromRecord, functions index.ts(2963, 4754), epubExport.ts:109. 모두 문자열 검사가 있습니다.
- 내보내기는 `isExportBodyExcluded`로 제외됩니다. 같은 문제가 더 남은 곳은 없습니다.

**B. 빈 배열이 본문 대조를 끔 — 해결**
- `recordStats.ts:548`의 `hasSelectedCrops`가 길이 1 이상일 때만 '고른 작물(사실)'로 봅니다.
- 빈 배열은 본문 대조로 넘어갑니다.
- 테스트(`garden_crops: []` + 본문 "고추")가 추가됐고 통과합니다.

**C. 옛 garden_crop 문자열 복원 — 해결**
- `FormatModal.tsx:647-653`에서 배열이 없으면 빈 선택으로 시작합니다.
- 저장할 때 고른 작물이 없으면 `garden_crop`을 덮어쓰지 않으므로(:1270), 옛 문자열은 그대로 남습니다.
- RecordPage 초안 경로(buildDraftEditorData)는 원래 작물 값을 넘기지 않으므로 달라진 동작이 없습니다.
- LibraryPage(숨김)는 `garden_` 키를 그대로 넘기므로 `garden_crops`가 복원됩니다.

**Codex 실행 2 P2(EPUB 호출 제한 시간) — 해결**
- `epubExportService.ts:33`에 `{ timeout: 310_000 }`이 들어가 서버 `timeoutSeconds: 300`(epubExport.ts:152)보다 길어졌습니다. region은 asia-northeast3 그대로입니다.
- 호출하는 곳 4곳(SayuModal, SayuTogetherPage, MergeViewerPage, RecordBookPage)에 더 짧게 끊는 별도 처리는 없습니다.
- 정책 테스트가 두 값을 함께 고정합니다.

## 남긴 항목 처리가 타당한지
- **D(SayuModal이 비어 있는 garden_crop에 등록 작물 전체를 채움, 기존 코드):** 후속 과제로 남기는 것은 타당합니다. 통계는 garden_crops만 읽어 수치에 영향이 없습니다.
  - 다만 현재 D가 적힌 곳은 `docs/reviews/.../review-2/README.md`뿐입니다. PR 본문과 Slack 후속 과제 목록에는 없습니다. 판정 기록을 게시할 때 후속 과제로 함께 남기기를 권합니다(처리 절차 보완이며, 코드 수정 조건은 아닙니다).
- **특별한 날 키 이름(specialDays 맵), 메모리 1GiB:** 허대표님 확인 대상으로 남긴 처리가 타당합니다(이전 판단 유지).
- **로딩 실패 표시·updatedAt(기존 동작), 프리미엄 전체 기간·작년 비교(출시 전 보류):** 타당합니다.

## 새 지적

**E. [중간 — 판정①을 막는 지적] 메모 '다음 행동' 칸이 본문 후보로 한 번 더 세짐 (Codex 실행 3의 P2, 아직 반영 안 됨)**
- **출처:**
  - Codex 리뷰 5625283348(2026-10-23T07:36:53Z, 커밋 4942bf81, 요청 issue comment 6359904031)
  - 지적 원문: comment 4357217414 "메모의 다음 행동을 본문 후보와 중복 집계하지 마세요"
  - 이 실행은 Codex 색인(`docs/reviews/2026-10-23-pr291-codex-index.md`) 작성 이후에 나와 색인에 없습니다.
- **위치:**
  - `frontend/src/app/records/recordStats.ts:187`: `BODY_FIELDS['메모']`에 `memo_action`이 들어 있어 본문에 포함됩니다.
  - `:623-628`: `fieldItems(entries, 'memo_action', 'action')`(사실)과 `collect(entries, prefix, todo 규칙)`(본문 후보)을 그대로 합칩니다.
  - 선교보고(:634)·일반보고(:645)·독서사유(:533)는 칸이 채워진 기록을 본문 대조에서 빼서 이 문제가 없습니다. 메모만 빠져 있습니다.
- **실패 시나리오(직접 재현):**
  - 입력: 프리미엄 메모 `memo_action: '치과 예약'`
  - `computeFormatStats` 결과: `[action '치과 예약'(auto), todo '치과 예약'(candidate)]`. 같은 행동이 두 번 들어갑니다.
  - 그래서 '할 일 후보' 개수가 1개 부풀고, 출처 표시도 'auto(사실)'가 아니라 'candidate(후보)'로 바뀝니다.
  - 칸에 '예약·전화·사기·연락' 같은 낱말이 들어가면 항상 생기는 일이라 드문 경우가 아닙니다.
  - Slack 중복 처리 원칙("같은 문장은 한 번만")과 지표 설명 "‘다음 행동’ 칸(사실)과 본문의 …(본문 후보)"에도 어긋납니다.
  - 이전 두 검토에서 놓친 부분이며, 이번 diff로 생긴 회귀는 아닙니다.
- **제안(몇 줄 수정):** 같은 기록의 다음 행동 칸 문장과 같은 본문 후보를 뺍니다.
  ```ts
  const actionSentences = new Map(entries.map((e) => [e.recordId, new Set(splitSentences(text(e.record.memo_action)))]));
  const todos = collect(entries, prefix, { kind: 'todo', pattern: /.../ })
    .filter((t) => !actionSentences.get(t.recordId)?.has(t.sentence));
  ```
  - 다른 형식처럼 `entries.filter(e => !text(e.record.memo_action))`로 바꾸는 방법도 있습니다. 하지만 그러면 다음 행동을 적은 메모의 본문(memo_content) 할 일까지 빠지므로 위 방식을 권합니다.
  - `recordStats.test.mjs`의 '메모·선교·일반보고 예시'에 `memo_action: '치과 예약'`만 있는 경우를 추가해, 후보 1개이고 출처가 'auto'인지 확인합니다.
- **반영 후 할 일:**
  - Codex 재검토 요청
  - 실행 3(과 이후 실행)을 담은 보조 색인 파일을 새로 추가(기존 색인은 고치지 않음, 8.1절)

그 밖에 실제로 실패할 시나리오는 찾지 못했습니다.

## 규모·멈춤 조건 (이전 판단 유지)
- 규모: 대규모입니다. 통계 화면 전면 교체, 새 저장 필드(specialDays, statsChecks, garden_crops), Functions exportEpub 변경(timeout 300초)이 들어 있습니다.
- 이번 반영으로 새로 생긴 멈춤 조건은 없습니다.
  - 저장 경로는 users/{uid}/records 그대로입니다.
  - Rules·라우터·결제·인증·AI 호출 변경은 없습니다.
  - region은 asia-northeast3입니다.
  - 클라이언트 timeout 310초는 비용이 늘지 않습니다.
- 병합·배포 전 허대표님 결정이 필요한 것:
  - 대규모 작업 승인
  - 특별한 날 키 이름 차이(Slack 확인 ①)
  - 메모리 상향 여부(②)
  - exportEpub 운영 배포와 실기기 PDF/EPUB 확인
- 판정①만으로 병합할 수 있는 건이 아닙니다.

## 승인 조건 요약
1. E를 고치고 테스트를 추가합니다.
2. 새 HEAD에서 Codex 재검토를 받고, 실행 3 이후를 보조 색인에 기록합니다.
3. D를 PR 본문 또는 Slack 후속 과제에 기록합니다(권장).

검토 대상 HEAD SHA: 4942bf81702d0ae7cf1b94f35527482641e34900 (코드 HEAD d7efa1e3)

참고: 확인에 쓴 임시 파일은 모두 scratchpad에만 있습니다(풀어 놓은 HEAD `/private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/r3`, 재현 스크립트 `/private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/r3/frontend/test/zz_memo_probe.mjs`). 저장소 파일 수정은 없습니다.
````
