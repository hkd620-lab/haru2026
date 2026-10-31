# PR #296 독립 검토 1 — 결과 원문

- 대상 HEAD: `c3c10ecd3ae4d62632c1d61a6ec5d7f51e3b6796`
- 출처: 검토 에이전트 최종 회신(전사에서 그대로 추출)

````text
판정: 승인

검토 대상 HEAD SHA: c3c10ecd3ae4d62632c1d61a6ec5d7f51e3b6796 (PR #296, cc/epub-reader-guide → main)

직접 실행한 검증: PR HEAD를 git archive로 scratchpad에 풀어서 돌렸습니다(저장소 파일은 수정하지 않았습니다).
- `node --import tsx --test test/epubReaderGuide.test.mjs` 결과 pass 3, fail 0
- `npx vite build` 성공

요구 충족: 충족합니다.
- 안드로이드에서는 "기본 앱이 없다"는 사실을 알리고, Google Play 북 설치 링크와 여는 방법을 안내합니다. 안드로이드는 안내가 처음부터 펼쳐집니다.
- EPUB 내보내기 호출 지점 `exportRecordsToEpub(` 4곳이 모두 연결돼 있습니다(MergeViewerPage, RecordBookPage, SayuTogetherPage, SayuModal). git grep으로 다른 호출 지점이 없음을 확인했습니다.

안내 내용 정확성(상식 수준):
- Play 스토어 링크의 `id=com.google.android.apps.books`는 Google Play 북의 정식 패키지 ID입니다.
- "내 파일 → 다운로드"는 갤럭시(삼성 '내 파일' 앱) 기준으로 맞습니다.
- iOS의 "'파일' 앱 → 다운로드 → 공유 → '도서'" 경로는 맞습니다. Mac은 '도서' 앱으로 열리는 것이 맞고, Windows에 기본 EPUB 뷰어가 없다는 설명도 사실입니다.

기존 동작 영향:
- 토스트: sonner 2.0.3은 `description`과 `duration` 옵션을 지원합니다. 기존 성공 메시지와 경고 토스트(skipped/limited)는 그대로입니다.
- alert: `\n\n` 줄바꿈이 붙는 것뿐이고 동작은 바뀌지 않습니다.
- 레이아웃: 새 블록이 하나 들어간 것 말고는 버튼과 입력 구조가 그대로입니다.
- 저장 경로, Functions, Rules, 결제, 인증, AI 호출 변경은 없습니다.

지적 (차단 0건, 모두 비차단):

1. [비차단·낮음] epubReaderGuide.ts 17–22행, 기기 판별
   - 시나리오: 갤럭시에서 Chrome이나 삼성 인터넷의 "데스크톱 사이트 보기"를 켜거나 Samsung DeX를 쓰면 UA가 `X11; Linux x86_64`가 되어 Android 문자열이 빠집니다. 그러면 'desktop'으로 판별되고, Play 북 안내 대신 Mac/Windows 안내가 나옵니다. 이번 요구 상황(갤럭시 기본 모드)에는 해당하지 않습니다.
   - 제안: `/linux/i && maxTouchPoints > 0`이면 android로 보거나, `navigator.userAgentData?.platform === 'Android'`를 함께 확인합니다.
   - iPadOS 데스크톱 UA(Macintosh + maxTouchPoints > 1) 판별은 맞고, 테스트로도 확인돼 있습니다. 일반 Mac은 maxTouchPoints가 0이라 오판하지 않습니다.

2. [비차단·낮음] epubReaderGuide.ts, 컴퓨터용 안내 3번째 줄 "위 안내대로 전자책 앱에서 여세요"
   - 컴퓨터에서는 휴대폰용 안내가 화면에 나오지 않기 때문에 "위 안내"가 가리키는 대상이 없습니다.
   - 제안: "안드로이드는 'Google Play 북', 아이폰은 '도서' 앱에서 여세요"처럼 앱 이름을 직접 적습니다.

3. [비차단·낮음] MergeViewerPage.tsx 864행 `<div className="mb-3"><EpubReaderNotice /></div>`
   - 이 바텀시트는 `fixed bottom-0`이고 max-height나 스크롤 설정이 없습니다. 안드로이드에서는 안내가 펼쳐진 상태로 들어가 시트가 대략 250px 늘어납니다.
   - 화면이 작은 기기(가시 높이 약 640px)에서는 시트 위쪽(핸들, 제목, 미리보기)이 화면 밖으로 잘리고 스크롤할 수 없습니다. 아래쪽이 고정돼 있어 PDF/EPUB/취소 버튼은 계속 보이므로 기능이 망가지지는 않습니다.
   - 제안: 시트에 `maxHeight: '90vh', overflowY: 'auto'`를 주거나, 이 위치에서만 `defaultOpen={false}`로 둡니다.

4. [비차단·확인 필요] epubReaderGuide.ts, 안드로이드 4번째 단계의 Play 북 메뉴 이름
   - "라이브러리 → 점 세 개(⋮) → 'PDF 또는 EPUB 업로드'"는 Play 북 앱 버전에 따라 메뉴 위치나 이름이 다를 수 있습니다.
   - 상식 수준으로는 대체로 맞지만, 실기기에서 같은 이름이 보이는지 확인을 권합니다. 1~3단계의 "내 파일에서 열기" 흐름이 주 경로이므로 차단 사유는 아닙니다.

5. [참고] SayuModal에는 EPUB 버튼 옆에 접이식 안내가 없고 저장 완료 토스트 한 줄만 붙었습니다. PR 본문의 설명과 일치하므로 문제 아닙니다.

규모·멈춤 조건:
- 규모: 소규모입니다. 프론트엔드 문구와 안내 컴포넌트만 바뀌었고, 새 파일 2개(유틸·컴포넌트)와 테스트 1개, 4개 화면에 한두 줄 연결이 전부입니다. 홈화면이나 라우터는 바뀌지 않았고 새 기능에도 해당하지 않습니다.
- 8.1 멈춤 조건(모델·비용, 저장 경로, Rules, 결제·인증, 홈·라우터, 커밋과 실제 변경 불일치): 해당 없음.
- 단, "갤럭시에서 Play 북 설치 후 실제로 열린다"는 운영 완료 판정은 8.1의 실기기 E2E 항목이라 AI가 대신 확인할 수 없습니다. 병합·배포는 진행할 수 있지만 완료 보고는 허대표님의 실기기 확인이 필요합니다. PR 본문에도 그렇게 적혀 있습니다.
````
