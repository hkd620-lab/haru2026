# 독립 검토 5 — 결과 원문

- 대상 HEAD: `1f1691197fb99c90174ad1c84fade484be7b336a`
- 출처: 검토 에이전트 최종 회신(전사 파일에서 그대로 추출, 수정 없음)

````text
판정: 승인

검토 대상 HEAD는 1f1691197fb99c90174ad1c84fade484be7b336a(코드 HEAD 05e0a9a1)입니다. 원격 최신 HEAD는 `git fetch`와 `gh pr view 291`로 확인했습니다.
- 1f169119가 docs/reviews만 건드리는지 확인했습니다. `git diff --name-status 05e0a9a1 1f169119` 결과 6개 항목이 모두 `A`이고 경로가 `docs/reviews/` 아래입니다. `git diff --check`도 통과했습니다. 검토 기록 전용 커밋 예외에 해당합니다.
- 05e0a9a1이 바꾼 파일은 `frontend/src/app/records/recordStats.ts`와 `frontend/test/recordStats.test.mjs` 두 개뿐입니다. functions·Rules·FormatModal 변경은 없습니다.

## 직접 실행한 것
HEAD를 git archive로 scratchpad/r5에 풀어 실행했습니다. 저장소 파일과 브랜치는 건드리지 않았습니다.
- `npm run test:record-stats`: 16개 통과, statsStorage 정책 테스트 통과
- `vite build`: 성공
- PR CI(1f169119): build_and_preview, Deploy Preview 모두 pass. MERGEABLE/CLEAN.
- 같은 입력 10건을 8a7e40d5 이전 코드와 새 코드에 넣어 결과를 비교했습니다. 스크립트: /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/tools5/probe5.mjs

## 지적 해결 여부

**Codex 실행 4 P2(comment 4357286425, 간편 기록에 남은 프리미엄 칸): 해결**
- `usesPremiumFields`(recordStats.ts:225-228)는 `_style === 'simple'`이고 `_simple`이 있을 때만 false를 돌려줍니다. `getOriginalBody`(:209-222)가 간편 본문을 원문으로 고르는 조건과 정확히 같습니다.
  - style이 'simple'인데 `_simple`이 비면 `getOriginalBody`는 프리미엄 칸으로 돌아가고, `usesPremiumFields`도 true입니다. 두 판정이 맞습니다.
  - style이 'premium'이거나 없는 경우(옛 기록)는 모두 true입니다.
- 적용 위치는 메모(:634-639), 선교보고(:648-650), 일반보고(:660-662)입니다. 칸 사실 집계와 '칸이 있으면 본문 대조 제외' 조건 양쪽에 똑같이 들어갔습니다.

이전 코드와 비교한 결과입니다.

| 입력 | 이전 → 새 | 판단 |
| --- | --- | --- |
| 간편 일반보고(남은 report_future) | '다음 달 간담회' auto → 간편 본문 '다음 주 설문 예정.' candidate | 수정됨 |
| 간편 선교보고(남은 mission_prayer) | '옛 기도' auto → 간편 본문 candidate | 수정됨 |
| 간편 메모(남은 memo_action) | 2개('전화' auto 포함) → '우유 사기' 1개 | 수정됨 |
| 옛 기록(_style 없음) 3형식: 일반보고, 선교보고(mission_simple과 mission_prayer 함께) | 그대로 | 동작 유지 |
| 프리미엄 기록 3형식 | 그대로 | 동작 유지 |
| style 'simple'인데 `_simple`이 빈 메모 | 그대로 | 동작 유지 |

**비차단 메모 2('치과 예약.'과 '치과 예약' 두 번 셈): 해결**
- `normalizeSentence`(:351-353)가 앞 목록 기호, 끝 문장부호, 공백 차이를 무시합니다.
- 옛 메모 사례가 3개에서 2개로 바뀌었는데, 중복 하나만 빠진 것이고 의도한 결과입니다.
- 테스트도 추가됐습니다(recordStats.test.mjs:176-184).

새 회귀는 찾지 못했습니다.

## 새 지적
차단 지적은 없습니다. 비차단 메모만 둘입니다.

1. **[비차단] 다른 형식의 고정 칸도 `_style`을 보지 않습니다.**
   - 해당 칸: 독서 reading_book_title·reading_book_text(:543-547), pet_name(:593), child_name(:604), work_rating(:623)
   - 이번 P2와 같은 종류입니다. 다만 대부분 이름·제목처럼 방식이 바뀌어도 여전히 맞는 정보라서, 실제로 잘못된 결과가 나오는 사례를 만들지 못했습니다.
   - 필요하면 후속 과제로 두면 됩니다.
2. **[비차단, 무시해도 됨]** 어떤 칸이 '.'처럼 문장부호만 있어 정규화 후 빈 문자열이 되면, 같은 기록에서 정규화 후 빈 본문 후보도 함께 빠집니다. 실사용에서는 거의 생기지 않습니다.

## 규모·멈춤 조건
- **규모:** 대규모입니다(통계 화면 전면 교체, 새 저장 필드 specialDays·statsChecks·garden_crops, Functions exportEpub timeout 300초). 이전 판단을 유지합니다.
- **이번 반영으로 새로 생긴 멈춤 조건:** 없습니다.
  - 저장 경로는 users/{uid}/records 그대로입니다.
  - Rules·라우터·결제·인증·AI 호출 변경은 없습니다.
  - region은 asia-northeast3입니다.
- **8.1 조건 3:** 05e0a9a1 대상 Codex 실행 5가 아직 끝나지 않았습니다.
  - 요청은 issue comment 6360195548(2026-10-23T07:52:20Z)에 있습니다.
  - 이 검토 시점에 결과 리뷰와 새 인라인 코멘트가 없습니다.
  - 실행 5 결과를 받고, Codex 보조 색인을 새 파일로 추가해 기록해야 판정①을 적을 수 있습니다.
- **판정①만으로 병합·배포할 수 있는 건이 아닙니다.** 허대표님 결정이 필요한 것:
  - 대규모 작업 승인
  - 특별한 날 키 이름
  - EPUB 메모리 1GiB 상향 여부
  - exportEpub 운영 배포와 실기기 PDF/EPUB 확인

검토 대상 HEAD SHA: 1f1691197fb99c90174ad1c84fade484be7b336a (코드 HEAD 05e0a9a19ac8cdb4b18370543fda7178cfcaa842)

저장소 파일 수정은 없습니다. 확인용 파일은 모두 scratchpad에만 있습니다.
- 새 HEAD: /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/r5
- 비교용 이전 코드: /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/old5
````
