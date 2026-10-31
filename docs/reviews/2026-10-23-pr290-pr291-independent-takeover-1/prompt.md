# 독립 Claude 설계·완료 검토 요청

저장소: /Users/heogyeongdae/Developer/HARU2026
PR #290: https://github.com/hkd620-lab/haru2026/pull/290 (HEAD eb1ce601)
PR #291: https://github.com/hkd620-lab/haru2026/pull/291 (검토 HEAD 47da9ec7ee48cfa62d00babfca5d9bcd9b33d72e)

당신은 독립 검토자입니다. 파일 수정·Git 변경·Slack 게시·배포를 하지 마세요. 별도 실행자의 대화 맥락 대신 저장소·PR·근거만 읽고 검토하세요. 읽기 도구만 제공됩니다.
최초 전체 diff 근거는 /private/tmp/haru-takeover-pr290.diff, /private/tmp/haru-takeover-pr291.diff 입니다. 이전 검토 이후 diff는 /private/tmp/haru-takeover-after-cc.diff 입니다. 실제 파일과 필요한 연결 부위를 읽어 판단하세요. docs/HARU2026_Slack_운영정책.md 8.1에 따라 검토합니다.

이전 판정과 반영 내역:
- CC의 독립 Claude 검토 1~7은 docs/reviews/2026-10-23-pr291-independent-review-* 에 질문·결과 원문이 전부 있습니다. 수정 후 승인 3회(1~3), 이후 4~7 승인이었습니다. 이전 판단을 숨기거나 횟수를 초기화하지 않습니다.
- 아래에 직전 7회차 결과 원문을 그대로 첨부했습니다.
- 이번에는 선행 PR #290 전체와 #291 인수 변경을 함께 확인해 주세요.
- #290 Codex 실행 1 P1(조건부 Hook 호출) → 0c6080f9에서 effect를 조기 반환 앞에 이동, Hook 순서 검사·격리 브라우저 열기/닫기/재열기 확인.
- #290 Codex 실행 2 P2 두 건(독서사유 최초 책 선택에서 공통 초안 소실, 기존 회차 편집 ID·날짜 덮어쓰기) → eb1ce601에서 반영. initialWritingDraft를 명시적으로 전달하고 첫 책 선택에서만 전달된 journal을 보존하며 이후 책 변경 시 초기화합니다. 기존 회차 edit 대상은 applyDraftSaveTarget에서 보존하고 신규 저장만 초안 ID를 씁니다.
- 선교보고·일반보고 글쓰기 후보와 프리미엄 초안 전달은 e8414275에서 반영.
- 허대표님은 현재 Codex 대화에서 검토 통과 후 #290→#291 병합·Hosting 자동배포와 서울 exportEpub 단독 배포 승인, specialDays 키 확정, EPUB 1GiB·인스턴스 동시 요청 1개를 명시 승인했습니다. f3b176aa에 자원 설정 반영.
- 인수 후 웹/Functions 빌드 및 관련 테스트는 로컬에서 실행했습니다. 로그: /private/tmp/haru290-reading-tests.log, /private/tmp/haru290-reading-build.log, /private/tmp/haru291-final-tests.log, /private/tmp/haru291-final-build.log, /private/tmp/haru291-resources-tests.log. 일부 로그는 실행 중일 수 있으니 완료 표시 없이 통과로 판단하지 마세요.
- 운영 데이터·Rules·결제·인증·AI 호출 변경 없음. 실제 로그인 계정 통계 대조·운영 EPUB·실기기 PDF/EPUB는 미확인입니다.

검토 요청:
1. 위 Codex 지적이 실제로 해결됐는지, 다른 저장·초안 손실·중복 기록·Hook·사진 정리 회귀가 있는지 확인.
2. #291의 이전 독립 승인 후 변경과 승인한 자원 설정이 의도에 맞는지 확인.
3. 작업 규모와 멈춤 조건, 승인 범위와 남은 E2E를 명시.
4. 첫 줄은 판정: 승인 / 판정: 수정 후 승인 / 판정: 재설계 중 하나. PR별로 나눠 써도 됩니다. 실제 저장소를 읽을 수 없거나 사용량 제한이면 승인하지 말고 제한을 명시.
5. 새 필수 수정이 있으면 파일·위치·재현 조건을 명확히 쓰세요. 이전 수정 후 승인 횟수가 이미 3회였음을 고려해 추가 수정 후 승인 판정이면 대표 보고가 필요합니다.

## 직전 독립 검토 7 결과 원문

# 독립 검토 7 — 결과 원문

- 대상 HEAD: `34bca571d5055eabb072e164b34af21d5840705c`
- 출처: 검토 에이전트 최종 회신(전사 파일에서 그대로 추출, 수정 없음)

````text
판정: 승인

검토 대상 HEAD SHA: 34bca571d5055eabb072e164b34af21d5840705c (코드 HEAD 2cb31382)
- `gh pr view 291` 기준 headRefOid는 34bca571입니다. 2cb31382에서 34bca571로 넘어가며 바뀐 것은 docs/reviews/ 아래 새 파일 6개(codex-index-5, independent-review-6 폴더)뿐이고, 코드 변경은 없습니다.
- c0ab6aa4에서 2cb31382로 바뀐 코드는 functions/src/epubContent.ts, functions/src/epubExport.ts, functions/test/epubContent.test.js 세 파일입니다.
- 확인 방법: 34bca571의 functions를 git archive로 scratchpad r7에 풀었습니다. node_modules는 r6 것을 링크했습니다.
  - `tsc` 종료 코드 0
  - `node --test test/epubContent.test.js` 8개 모두 통과(새 예산 테스트 포함)
  - PR checks(build_and_preview, Deploy Preview) 통과

## 1. 지적 해결 여부

**Codex 실행 6 P2(사진 다운로드 전체 시간 예산): 해결**
- epubContent.ts:110에서 마감 시각을 정하고, :123에서 묶음(batch)을 시작하기 전에 확인합니다.
  ```ts
  const deadline = Date.now() + (options.budgetMs ?? PHOTO_BUDGET_MS); // 150_000
  for (let i = 0; i < unique.length; i += concurrency) {
    if (Date.now() >= deadline) break;
  ```
- 시도 1회의 AbortController 타이머(8초)는 finally에서 해제되므로 `arrayBuffer()` 본문 읽기까지 덮습니다.
  - 그래서 사진 1장의 최악은 8초×2회, 약 16초입니다.
  - 사진 단계 전체의 최악은 150초 + 마지막 묶음 16초, 약 166초입니다.
- 이전 계산은 최악 25묶음×30초였습니다. 이번에는 사진 단계 166초 + Firestore 조회 + EPUB 생성 + 업로드·서명 URL을 더해도 300초 안에 충분한 여유가 남습니다.
- 마감 뒤 받지 않은 사진은 `fetched.get(url)`이 undefined여서 null이 되고 failed로 셉니다. 이 값이 skippedPhotos로 화면 안내에 반영됩니다.
- 프런트 호출 제한 시간은 310초로, 서버 300초보다 깁니다(epubExportService.ts:33).
- 테스트(budgetMs 40, 30ms×동시 2개)는 부하가 있어도 `calls < 6`이 유지되는 구조라 흔들릴 위험이 낮습니다.

**검토 6 비차단 1(성장타임라인 사진도 같은 준비 단계로): 해결**
- 타임라인 사진 주소가 더 이상 본문에 원격 주소로 들어가지 않습니다.
  - recordToHtml이 `timelinePhotos`로 넘기고(epubExport.ts:80-82), 다른 사진과 같은 preparePhotos 단계를 거칩니다.
- 사진을 받지 못하면 캡션도 함께 빠집니다(epubExport.ts:254-258).
  ```ts
  const src = srcByChapter[index][photoIndex];
  if (!src) return;
  lines.push(`<img src="${escapeHtml(src)}" ...>`);
  if (photo.caption) lines.push(`<p ...>${escapeHtml(photo.caption)}</p>`);
  ```
- 덤으로 개선된 점이 두 가지 있습니다.
  - 예전에는 캡션과 item.url을 이스케이프하지 않았는데, 이제 이스케이프합니다.
  - `^https?://`만 받습니다.

**자리 맞춤(srcByChapter)**
- epubContent.ts:128-133은 `urlsByChapter`와 같은 모양으로 값을 돌려줍니다.
  - 상한을 넘은 자리는 null로 두고 overLimit으로만 셉니다(failed와 이중 계산 없음).
  - 받지 못한 자리는 null로 두고 failed로 셉니다.
- buildAndSave는 `chapter.photos`와 같은 인덱스로 짝을 짓습니다. 입력 배열을 그대로 map하므로 어긋날 경로가 없습니다.

**합본 경로**
- `getRecordPhotoUrls(...).map((url) => ({ url }))`처럼 캡션 없이 넘깁니다(epubExport.ts:194).
- 순서는 SAYU 글, 그다음 사진으로 이전과 같습니다. 회귀는 없습니다.

## 2. 새 지적
차단 지적은 없습니다. 비차단 메모는 다음과 같습니다.
1. **[낮음] epubExport.ts:83 — 사진만 있는 타임라인 기록의 빈 장**
   - 상황: `content`가 없는 타임라인 기록에서 사진을 전부 받지 못하는 경우입니다. 사진을 받기 전에 `bodyAdded = true`가 정해지므로 "(내용 없음)"이 나오지 않습니다.
   - 결과: 그 장에는 날씨·제목만 남습니다. 실패는 skippedPhotos로 안내되므로 데이터 손실은 아닙니다.
   - 제안(나중에 해도 됨): buildAndSave에서 받은 사진이 0장이고 본문도 비면 "(사진을 불러오지 못했습니다)"를 넣습니다.
2. **[낮음] epubContent.ts:110 — 마감 시각의 기준점**
   - 예산이 함수 시작이 아니라 preparePhotos 시작부터 계산됩니다.
   - 지금 여유(300초 대비 사진 단계 최악 약 166초)로는 문제가 없습니다. 단계 앞에 오래 걸리는 작업이 추가되면 다시 계산해야 합니다.
3. **[참고] 타임라인 사진도 200장 상한에 포함**
   - 이전에는 상한 밖이었습니다. 긴 기간 전체 내보내기에서는 limitedPhotos가 늘 수 있습니다. 의도된 동작으로 보입니다.
4. **[참고, 이번 변경 아님] 기존 코드의 남은 점**
   - epubContent.ts:153: `!response.ok`일 때 응답 본문을 비우지 않고 `continue`합니다.
   - epubExport.ts:58-59, 75, 90: weather·mood·타임라인 content·growth 본문을 이스케이프하지 않습니다.
   - 둘 다 원래부터 있던 코드라 이번 범위 밖입니다.

## 3. 규모·멈춤 조건
- **규모:** 대규모입니다. 통계 화면 전면 교체, 새 저장 필드, Functions exportEpub 변경이 들어 있습니다. 이전 판단을 유지합니다.
- **2cb31382로 새로 생긴 멈춤 조건:** 없습니다.
  - 저장 경로는 users/{uid}/records 그대로입니다.
  - region은 asia-northeast3, timeoutSeconds 300, memory 512MiB로 바뀌지 않았습니다.
  - Rules, 라우터, 결제, 인증, AI 모델 변경은 없습니다.
  - 커밋 메시지와 실제 변경이 일치합니다.
- **판정①만으로 병합·배포할 수는 없습니다.** 허대표님 결정이 필요한 것:
  - 대규모 작업 승인
  - 특별한 날 키 이름
  - EPUB 메모리 1GiB 상향 또는 concurrency 상한
  - exportEpub 운영 배포와 실기기 PDF/EPUB 확인
  - 이 PR은 PR #290 브랜치(codex-write-then-format)를 기준으로 쌓여 있으므로 병합 순서도 함께 정해야 합니다.

## 저장소 상태
- 저장소 파일 수정과 로컬 브랜치 변경은 없습니다.
- 확인용 파일 위치: /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/r7
````
