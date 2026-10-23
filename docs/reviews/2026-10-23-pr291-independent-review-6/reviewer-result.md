# 독립 검토 6 — 결과 원문

- 대상 HEAD: `c0ab6aa4924ee3f4bb5f9cec355bf7384f8e9e13`
- 출처: 검토 에이전트 최종 회신(전사 파일에서 그대로 추출, 수정 없음)

````text
판정: 승인

검토 대상 HEAD는 c0ab6aa4924ee3f4bb5f9cec355bf7384f8e9e13, 코드 HEAD는 bdad5dfd입니다. `git fetch`와 `gh pr view 291`로 원격 최신 HEAD가 c0ab6aa4인 것을 확인했고, 상태는 OPEN입니다. CI는 build_and_preview와 Deploy Preview 모두 pass입니다.
- c0ab6aa4는 docs/reviews/ 아래 새 파일 6개만 추가합니다. 모두 `A`이고 `git diff --check`도 통과했습니다. 검토 기록 전용 커밋 예외에 해당합니다.
- bdad5dfd가 바꾼 파일은 functions/src/epubContent.ts, functions/src/epubExport.ts, functions/test/epubContent.test.js 세 개뿐입니다.

## 직접 실행한 것
c0ab6aa4를 git archive로 scratchpad/r6에 풀어 실행했습니다. 저장소와 브랜치는 건드리지 않았습니다.
- `npm ci` 뒤 `npm run test:epub-content`(tsc 빌드 포함): 7개 모두 통과
- 경계 사례 확인 스크립트: /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/tools6/probe6.js

## 1. Codex 실행 5 P2(comment 4357352266): 해결
- **HEAD 사전 확인을 없앴습니다.** `createTempPhotoFetcher`(epubContent.ts:142-165)가 GET 본문 전체를 실제로 받습니다. 다음 경우는 null을 돌려주고, `preparePhotos`가 `failed`로 셉니다(:122-129).
  - 응답이 성공이 아님
  - content-type이 jpeg, png, webp, gif가 아님
  - 본문이 0바이트
  - 받는 중 연결이 끊김
- **받은 사진만 `file://`로 넘깁니다.** 그래서 라이브러리 단계에서 빈 이미지가 생길 길이 사실상 없습니다.
- **라이브러리가 file://을 읽는 경로를 확인했습니다**(epub-gen-memory 1.1.2).
  - dist/lib/util/fetchable.js는 `file://`로 시작하면 `fs.readFile(new URL(url))`로 읽습니다.
  - html.js의 imgSrc는 쿼리를 뗀 경로 확장자로 mime을 정합니다. 그래서 photo-N.jpg/png/webp/gif가 각각 맞는 형식이 됩니다.
  - 실측 결과: `image/jpg; charset=x` → .jpg → OPF image/jpeg, png → image/png
- **경계 사례 실측 결과**
  - octet-stream, 받는 중 끊김, 빈 본문 → 3장 모두 제외되고 failed=3
  - 같은 URL → 파일 1개로 합쳐짐
  - 파일 이름은 unique 배열 위치(i+offset)를 쓰므로 겹치지 않습니다.
- **기록 사진 형식 확인:** 기록 사진은 FormatModal.tsx:1995 등에서 `contentType: 'image/jpeg'`로 올라갑니다. content-type 기준 판정이 잘못 빼는 사진은 확인되지 않았습니다.
- **임시 폴더 정리:** `mkdtemp`로 요청마다 다른 폴더를 만들어 동시 요청끼리 충돌하지 않습니다. finally에서 `rm(force)`를 하므로 Epub, 저장, 서명 URL 단계에서 오류가 나도 정리됩니다(epubExport.ts:239, 281).

## 2. 테스트 타당성: 타당
- HEAD 200·GET 503 로컬 서버로 시작해 다음 순서로 확인합니다.
  1. preparePhotos 실행
  2. 실제 Epub 생성
  3. JSZip으로 OEBPS/images 열기
- 이미지 1개, 0바이트 아님, failed=1을 검증합니다. jszip은 package.json 직접 의존성이라 테스트 환경에서도 안정적입니다.
- 아쉬운 점(비차단):
  - 운영 epubOptions(css)를 그대로 쓰지 않습니다.
  - 받는 중 끊김과 비이미지 content-type 사례가 테스트에 없습니다. probe6.js에서는 확인했습니다.

## 새 지적(모두 비차단)

**1. [비차단, 권장 우선 처리] 성장타임라인 사진은 새 경로를 거치지 않습니다.** epubExport.ts:76 / :255
- **현상:** recordToHtml이 `timelineItems[].url`을 원격 주소 그대로 `<img>`로 본문에 넣습니다. 그래서 preparePhotos를 지나지 않습니다.
- **실패 시나리오:** 성장타임라인 기록(formats ['성장타임라인'], 전체 또는 성장타임라인 형식 내보내기)에서 사진 1장이 404/403이거나, 기본값 20초×3회 재시도 뒤에도 실패한다고 합시다.
  - `ignoreFailedDownloads: true` 때문에 0바이트 이미지가 그대로 남습니다.
  - skippedPhotos는 0입니다.
  - 실측: 원격 404 → `img jpeg 0`
- **실행 5 P2와 같은 증상입니다.** 경로만 다릅니다. PR 기준점(9f4e93f9)에서는 같은 상황에서 EPUB 전체가 실패했습니다. 그래서 회귀라기보다 실패가 "전체 실패"에서 "조용한 누락"으로 바뀐 것입니다. 이 사진들은 MAX_EPUB_PHOTOS(200) 상한에도 들어가지 않습니다.
- **제안:** 타임라인 사진도 같은 준비 단계를 거치게 하세요.
  - recordToHtml이 타임라인 URL을 돌려주게 합니다.
  - buildAndSave에서 같은 fetcher로 받아 src를 file://로 바꿉니다.
  - 받지 못한 사진은 캡션과 함께 빼고 failed에 더합니다.

**2. [비차단] 사진 내려받기에 전체 시간 상한이 없습니다(Codex 실행 6 P2와 같은 지적).** epubContent.ts:105, 117-120, 144-146
- **배경:** Codex 실행 6이 이미 도착했습니다. review 5625513411(2026-10-23T08:01:51Z, 커밋 c0ab6aa4)의 comment 4357398271입니다.
- **계산:**
  - 8장씩 순서대로 처리하고, 장당 15초×2회 시도합니다.
  - 서로 다른 사진이 모두 응답 없이 멈추면 한 묶음에 30초가 걸립니다.
  - 88장이면 330초, 200장이면 750초입니다. timeoutSeconds 300을 넘어 내보내기 전체가 실패합니다.
  - 1f169119 때는 HEAD 5초 + GET 5초, 12장씩이라 200장 기준 최악 약 170초였습니다. 최악의 경우 시간이 늘었습니다.
- **발생 가능성은 낮습니다.** Storage가 장애 수준일 때만 생깁니다. 정상일 때는 800px JPEG(약 100~200KB) 200장이 수 초 안에 끝납니다.
- **제안:** 전체 기한을 두세요(예: 시작 후 180초). 기한이 지나면 남은 사진은 받지 않고 failed로 셉니다. 시도당 시간도 8~10초로 줄이세요.
- **8.1 조건 3:** CC가 이 P2를 반영하거나 반박하고 Codex 보조 색인 5를 추가해야 판정①을 적을 수 있습니다.

**3. [비차단] 메모리 여유가 줄었습니다.**
- **원인:** Cloud Functions의 /tmp는 메모리 기반이라 512MiB에 포함됩니다. 지금은 사진이 세 번 메모리를 차지합니다.
  1. 임시 파일
  2. 라이브러리가 읽어 둔 Buffer
  3. 완성된 zip
  이전에는 두 번이었습니다.
- **동시 요청:** exportEpub은 cpu 기본값 1 → concurrency 기본값 80입니다. 큰 내보내기가 한 인스턴스에 동시에 몰릴 수 있습니다.
- **추정:** 기록 사진 압축 기준(800px, 0.85)으로 요청당 사진 200장이면 약 20~40MB×3입니다. 단독 요청은 여유가 있습니다.
- **제안:** exportEpub에 `concurrency` 상한(예: 4)을 두거나, 이미 보류 중인 1GiB 상향 결정과 함께 정하세요.
- **시간 초과 시 정리:** 300초를 넘겨 요청이 끊기면 응답 뒤 CPU가 제한되어 finally의 rm이 늦어질 수 있습니다. 실사용 영향은 작습니다.

**4. [비차단, 아주 작음] 성장타임라인 원격 경로의 시도 설정이 바뀌었습니다.**
- fetchTimeout/retryTimes 옵션을 지워 라이브러리 기본값(20초×3회)을 씁니다. 이 설정이 실제로 쓰이는 곳은 1번의 원격 경로뿐입니다. 1번을 고치면 함께 사라집니다.

새 회귀(실제 실패 시나리오가 생긴 것)는 찾지 못했습니다. 2번의 최악 시간 증가는 장애 수준 조건에서만 생깁니다.

## 3. 규모·멈춤 조건
- **규모:** 대규모입니다. 통계 화면 전면 교체, 새 저장 필드, Functions exportEpub 변경이 들어 있습니다. 이전 판단을 유지합니다.
- **이번 반영으로 새로 생긴 멈춤 조건:** 없습니다.
  - 저장 경로는 users/{uid}/records 그대로입니다.
  - region은 asia-northeast3입니다.
  - Rules, 라우터, 결제, 인증, AI 모델 변경은 없습니다.
- **판정①만으로 병합·배포할 수 있는 건이 아닙니다.** 허대표님 결정이 필요한 것:
  - 대규모 작업 승인
  - 특별한 날 키 이름
  - EPUB 메모리 1GiB 상향 또는 concurrency 상한
  - exportEpub 운영 배포와 실기기 PDF/EPUB 확인

검토 대상 HEAD SHA: c0ab6aa4924ee3f4bb5f9cec355bf7384f8e9e13 (코드 HEAD bdad5dfd)

저장소 파일 수정은 없습니다. 확인용 파일은 모두 scratchpad에만 있습니다.
- 풀어 놓은 HEAD: /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/r6
- 확인 스크립트: /private/tmp/claude-501/-Users-heogyeongdae-Developer-HARU2026/5675bfe4-2122-4f15-8c88-b9069c17c48e/scratchpad/tools6/probe6.js
````
