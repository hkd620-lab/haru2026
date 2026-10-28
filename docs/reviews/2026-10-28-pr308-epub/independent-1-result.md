# PR #308 독립 Claude 검토 1 원문

- 대상 HEAD: `b38797a5637fd9369b620cc6e0db4c184b6ac599`
- 질문 원문: [independent-1-prompt.txt](independent-1-prompt.txt)
- CLI 원문 JSON: [independent-1-result.json](independent-1-result.json)
- 실행: 새 세션, 읽기 전용 Read/Grep/Glob 도구, MCP 비활성화, 별도 대화 이력 없음
- 모델: claude-opus-5-5
- 결과 수신 확인: 2026-10-28 20:49 KST
- 제한: 저장소 밖 diff·빌드 로그 읽기 거부 사실은 아래 원문 및 JSON에 보존. 구현자가 전체 파일 diff·CI·빌드 결과를 별도로 대조한다.

## 검토 결과 원문

승인

검토 범위에 대해 먼저 알려 드립니다. 이 세션의 파일 도구는 저장소 밖을 읽을 수 없어서 `/private/tmp/haru-pr308-review.diff`와 `/private/tmp/haru-epub-guide-build.log`는 열지 못했습니다. 그래서 diff 원문이 아니라 HEAD 작업 트리에 있는 EPUB 관련 코드와 테스트를 직접 읽고 판단했습니다. 이 승인은 아래에 적은 파일에만 해당합니다. 빌드 성공도 제가 직접 확인하지 못했습니다.

**검토한 파일:** `frontend/src/app/services/epubExportGuide.ts`, `services/epubExportService.ts`, `utils/epubReaderGuide.ts`, `components/EpubReaderNotice.tsx`, `components/SayuModal.tsx`(1024–1048), `pages/MergeViewerPage.tsx`(146–166), `pages/RecordBookPage.tsx`(421–434), `pages/SayuTogetherPage.tsx`(932–945), `functions/src/epubExport.ts`, `functions/src/epubContent.ts`(validateRecordIds), 테스트 `frontend/test/epubExportGuide.test.mjs`, `frontend/test/epubSingleRecord.test.mjs`, `functions/test/epubSingleRecord.test.js`

## 근거

1. **요청과 구현이 맞습니다.**
   - 웹에서 `exportEpub`을 호출하는 곳은 `epubExportService.ts:37` 한 군데뿐입니다. 서버 호출 전에 반드시 `confirmEpubExport()`를 거칩니다(`:34`).
   - 이 서비스를 쓰는 4곳(단건 SayuModal, 합본 MergeViewer, 기간 RecordBook·SayuTogether)은 모두 `if (!result) return;`로 취소를 처리합니다.
   - 안내창에는 사진 포함 가능 여부, 리더 앱이 필요하다는 점, 기기별 여는 방법이 들어 있습니다. Android에서만 Play 북 공식 설치 링크가 보이고(`noopener noreferrer`), iOS와 데스크톱에서는 링크가 보이지 않는 것도 테스트로 확인됩니다.
   - 취소하면 서버를 호출하지 않고 다운로드도 일어나지 않습니다(`epubSingleRecord.test.mjs:38-43`).
2. **다른 기록이 섞이지 않습니다.**
   - 단건은 `users/{uid}/records/{singleRecordId}` 문서 하나만 읽습니다(`epubExport.ts:212-213`).
   - 같은 날짜의 다른 기록, 다른 형식의 본문, 이전 날짜 기록이 빠지는 것을 EPUB 파일을 직접 풀어서 검증합니다(`functions/test/epubSingleRecord.test.js:54-65`).
   - 단건 ID와 `recordIds`를 함께 보내면 거절합니다(`:177-181`).
3. **권한과 정보 노출에 문제가 없습니다.**
   - 로그인 확인과 유료 구독 확인이 단건 경로보다 먼저 실행됩니다(`:165-169`). 테스트 `:90-94`가 이를 확인합니다.
   - ID에 `/`가 들어가거나, 빈 값이거나, 문자열이 아니거나, 200자를 넘으면 거절합니다. 읽는 경로가 본인 uid 아래로 고정되어 있어 다른 사용자의 기록에 접근할 수 없습니다.
4. **기존 기능과 호환됩니다.**
   - 기간별 요청(`singleRecordId` 없음)과 합본 `recordIds` 요청은 예전처럼 동작합니다(테스트 `:72-80`).
   - 날짜 형태의 기존 ID로 하는 단건 요청도 통과합니다(`:67-70`).
   - 배포 전 구 클라이언트가 새 서버를 호출해도 이전처럼 동작합니다.
5. **취소·중복·접근성 처리는 충분합니다.**
   - 취소 버튼, Escape(`cancel`), 창 닫기 모두 `false`를 돌려주고 안내창을 DOM에서 지웁니다. `settled` 플래그로 두 번 처리되는 것을 막습니다.
   - 안내창이 이미 떠 있으면 새로 띄우지 않습니다.
   - 안내창에 `aria-labelledby`/`aria-describedby`가 붙어 있고, 열리면 제목으로 포커스가 이동합니다. `showModal`이라 바깥 화면은 조작할 수 없습니다.
   - 모든 호출부가 결제 확인이나 500건 제한 확인을 안내창보다 먼저 하므로, 안 될 요청에 안내창이 뜨지 않습니다.
6. **모바일 가독성은 적절합니다.** 너비는 `calc(100% - 32px)`에 최대 440px, 높이는 `100dvh - 32px` 안에서 스크롤됩니다. `dvh`를 지원하지 않는 브라우저에서는 기본 스타일의 최대 높이가 적용됩니다. 본문 14px, 버튼 높이 44px 이상입니다.
7. **작업 규모는 중간입니다.** 프론트 서비스 1개, 안내 모듈, 호출부 4곳, callable 함수 1개를 바꿨습니다.
   - 확인한 범위에서는 8.1절 멈춤 조건에 해당하는 변경이 없었습니다. 홈화면·라우터, Rules, 저장 경로, 결제·인증 정책, AI 호출이나 비용을 바꾸지 않았습니다.
   - 다만 diff를 보지 못했으므로, CC가 `git diff --name-status main...b38797a5`로 바뀐 파일 목록에 `App.tsx`, 라우터, 홈화면, Rules가 없는지 확인해서 판정 기록에 붙여야 합니다.

## 차단 사유는 아니지만 고칠 만한 점

1. **서버를 먼저 배포해야 합니다.** 수정이 아니라 배포 조건입니다.
   - 문제: 새 웹 화면이 구 `exportEpub`을 호출하면 구 서버는 `singleRecordId`를 무시하고 `date == recordDate`로 기간 조회를 합니다.
   - 영향: 같은 날짜의 다른 기록이 단건 EPUB에 섞입니다. 본인 기록이긴 하지만, 이 PR이 고치려는 바로 그 문제입니다.
   - 대응: main에 병합하면 Hosting이 자동으로 배포되므로, PR HEAD `b38797a5` 기준으로 `exportEpub`만 먼저 배포하세요. 그다음 `gcloud functions list`로 실제 배포 상태와 리전 `asia-northeast3`를 확인한 뒤 병합하는 순서를 권합니다.
2. **`<dialog>`를 지원하지 않는 브라우저에서 EPUB 내보내기가 완전히 막힙니다.** (`epubExportGuide.ts:83-89`)
   - 조건: `showModal`이 없는 브라우저(iOS 15.4 미만, 오래된 WebView)
   - 영향: 안내창을 띄우다 오류가 나서 Promise가 실패하고, 화면에는 "EPUB 생성 실패: … showModal is not a function"이 뜹니다. 이전에는 이 브라우저들에서도 내보내기가 됐습니다.
   - 수정: `typeof dialog.showModal !== 'function'`이면 `window.confirm(요약 + 기기별 안내 문구)`로 대신 묻습니다.
3. **단건의 날짜 대체값이 여전히 ID에서 나옵니다.** (`SayuModal.tsx:1038`)
   - 조건: `recordDate`가 비어 있고 문서 ID가 날짜로 시작하지 않는 경우
   - 영향: `startDate`/`endDate`에 날짜가 아닌 값이 들어갑니다. 서버는 `startDate > endDate`만 확인하므로 그대로 받아들이고, EPUB 제목과 파일명이 틀어집니다. 본문은 올바릅니다.
   - 수정: 단건 경로에서는 서버가 `record.date`로 제목과 파일명을 만들도록 합니다. 또는 클라이언트에서 날짜 형식(`/^\d{4}-\d{2}-\d{2}$/`)을 확인합니다.
4. **같은 날짜의 단건 EPUB 파일명이 겹칩니다.** (`epubExport.ts:288-295`)
   - 조건: 같은 날짜의 서로 다른 기록 두 개를 거의 동시에(다른 탭이나 다른 기기에서) 내보내는 경우
   - 영향: 둘 다 `epub/{uid}/HARU_일기_D_D.epub` 경로에 저장되므로, 저장과 서명 URL 발급 사이에 다른 쪽 파일로 덮어써질 수 있습니다. 본인 기록 안에서만 생기고 확률은 낮습니다. 기기에서도 파일명이 구분되지 않습니다.
   - 수정: 단건일 때 파일명에 ID 끝 6자리 정도를 붙입니다.
5. **사소한 점:** 설치 링크의 "↗" 기호는 스크린리더가 "화살표"로 읽고, 새 창으로 열린다는 안내가 없습니다. `aria-label="Google Play 북 설치하기(새 창)"`를 붙이면 됩니다.

## 남은 검증 (정책상 추정하지 않음)

- **판정① 조건:** 아래 항목을 PR에 첨부하고 확인해야 합니다. 저는 이 중 어느 것도 확인하지 못했습니다.
  - 최신 HEAD의 CI 통과
  - 프론트 `npm run build`와 `frontend/test/epub*.test.mjs` 결과
  - `functions` 빌드, `functions/test/epubSingleRecord.test.js` 결과, export 목록 diff
  - 최신 HEAD에 대한 Codex 재검토 완료
- **배포 승인 범위:** 8.1절의 배포 승인은 특정 CC 세션에 묶여 있습니다. 말씀하신 이번 PR의 병합·배포 승인이 어떤 근거로 기록되어 있는지는 제가 확인하지 못했으므로, 판정 기록에 근거 링크를 적어야 합니다.
- **운영 E2E (실기기라 AI가 대신할 수 없음, "운영 완료" 판정은 허대표님 확인 사항):**
  - 날짜와 ID가 다른 SAYU 기록을 단건 EPUB으로 받아, 같은 날짜의 다른 기록이 섞이지 않는지
  - 단건·합본·기간 내보내기마다 안내창이 뜨는지, 취소하면 Functions 로그에 호출이 남지 않는지
  - Android Chrome과 카카오톡 인앱 브라우저에서 설치 링크가 Play 스토어로 열리는지, 돌아와서 다운로드한 파일이 Play 북에서 열리는지
  - iPhone Safari에서 '파일' 앱을 거쳐 '도서' 앱으로 열리는지
  - 360px 폭 화면에서 안내창이 스크롤되고 버튼이 잘리지 않는지
  - 사진이 든 기록에서 EPUB 안의 사진이 보이는지
