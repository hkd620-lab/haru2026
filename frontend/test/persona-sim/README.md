# 가상사용자 격리 파일럿

실제 `frontend/src` 앱 화면을 모바일 Chromium에서 조작하고 Firebase SDK·AuthContext·Functions만 모의한다. 운영 코드·운영 DB·실제 AI 품질을 변경하거나 판정하지 않는다.

## 실행

저장소 루트에서 `cd frontend && npm ci`, 이어서 `cd test/persona-sim && npm install`로 도구를 준비한다. 루트 패키지와 lock 파일은 수정하지 않는다.
(`cdn.sheetjs.com` 접속이 막힌 환경에서는 `xlsx` 만 레지스트리 판으로 바꿔 설치한 뒤 `frontend/package.json`·lock 을 git 으로 되돌린다.)

macOS Chrome:

```sh
PERSONA_SIM_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node runner/run.mjs p01 p06 p11
```

Linux에서는 `PERSONA_SIM_CHROMIUM`에 Chromium 실행 파일 경로를 지정한다(미지정 기본값 `/opt/pw-browsers/chromium`). 서버는 `127.0.0.1:18762`만 사용한다. 브라우저 실행을 제한하는 샌드박스에서는 해당 실행 권한이 필요하다.
인물을 지정하지 않으면 `personas/` 의 모든 인물을 실행한다. 이미 떠 있는 서버를 재사용하려면 `node runner/serve.mjs` 를 따로 띄워 둔다.

## 가상인물

같은 형식을 서로 다른 인물·시나리오로 두 번 구현해 두었다(작성 주체가 달라 번호 체계가 다르다). 둘 다 유지한다.

| 파일 | 인물 | 형식 | 시나리오 요약 |
|---|---|---|---|
| `p01-diary` | 김서연(34·여·교사) | 일기 | 7일간 일기 8건, 제목 필수 안내, 간편/항목별, AI 미리보기 저장 1회, 사진 1장, 같은 날 2건, 목록·달력 확인 |
| `p06-child` | 박지우(32·여·회사원) | 육아일기 | 7일간 7건, 간편/항목별, AI 1회, 사진 1장, 재접속 확인. 성장대상 등록·성장 통계까지는 보지 않음 |
| `p08-child` | 한지민(36·여·육아휴직 회사원) | 육아일기 | 성장 대상(아이) 등록·재선택·이름 중복 입력 실수, 사진 2장, AI 1회, 타임라인 화면 확인 |
| `p11-household` | 이민준 | 가계부 | 7일간 문서 7건/거래 8건, 빈 금액·사용처 검증, 지출·수입·이체·다건 저장, 월 합계 |
| `p13-household` | 송다은(26·여·사회초년생) | 가계부 | 홈 카드→가계부 화면→첫 기록 추가, 월급·지출·이체 5건, 합계 검산, "5천원"·날짜 비움 같은 입력 실수 |

## 증거와 종료 코드

실행마다 `out/runs/<UTC 실행ID>/<인물>/result.json`과 단계별 PNG를 생성한다. `summary.json`에는 시간, 기대값 미충족, 단계 실패, 중단 여부가 구분된다. `out/latest-run.txt`에서 최신 실행을 찾는다. `out/`은 Git에서 제외하며 확정 보고서·선별 증거는 `reports/`에 보존한다.

- 종료 0: 모든 시나리오와 기대값 충족.
- 종료 1: 시나리오 중단 또는 제품 기대값 미충족. **중단 없는 실행도 실제 결함이 재현되면 1이다.**
- 단계 오류는 해당 인물의 실행을 중단한다. 틀어진 화면에서 나머지 단계를 실행해 가짜 결함을 쌓지 않는다. 다음 인물은 새 컨텍스트에서 실행한다.

## 보고서 만들기

```sh
node runner/report.mjs --name 2026-10-07-pilot --title "제목" [--cost-file 메모.md]
```

최근 실행 결과(또는 실행 ID 지정)에서 `reports/<이름>/report.md`, `report.json`, 발견 증거 캡처(`img/F-NN.png`)를 만든다. 같은 인물의 같은 제목 발견은 하나로 합치고 재현 횟수를 적는다.

## 가상인물 추가하기

`personas/p01-diary.mjs` 를 본떠 `meta`(프로필·시나리오·`identity`)와 `run(ctx)` 를 쓴다.
날짜는 `ctx.setDay('2026-10-03', '21:30')` 로 옮기고, 실제 사용자처럼 `openApp → openFormatFromHome → 작성 → 저장` 순서로 누른다.
`ctx.check(이름, 조건, 근거, 심각도)` 로 기대를 적고, 결과가 문제면 `ctx.finding({severity, title, detail, shot})` 로 발견을 남긴다(`ctx.snap('증거-…')` 로 찍은 화면이 증거가 된다).

## 격리와 한계

- Vite 설정은 운영 `.env`를 읽지 않고 Firebase import를 모의 SDK로 대체한다.
- 브라우저 HTTP(S) 요청은 정확히 일치하는 로컬 origin만 허용한다. 모의 이미지 도메인은 로컬 응답으로 대체하고 나머지 외부 요청은 차단·집계한다. 서비스 워커도 차단한다.
- 호출·쓰기·업로드 로그는 인물별 localStorage에 누적해 페이지 이동 뒤에도 남는다. 인물마다 새 브라우저 컨텍스트를 사용한다.
- 날짜만 이동하는 Date 프록시를 쓰며 브라우저의 RAF·performance·타이머는 그대로 둔다. 전체 가상 시계를 쓰면 Motion의 애니메이션 시간과 달라져 종료된 로딩 오버레이가 남을 수 있다.
- 390×844 모바일 Chromium 에뮬레이션이다. 실제 iPhone Safari·실기기·Firebase Rules·인증·운영 저장·AI 품질 검증을 대신하지 않는다. 사진은 합성 PNG를 업로드하고 모의 다운로드에서는 1픽셀 이미지를 반환한다.
- `fakes.ts`의 AI 응답과 한도 정책은 모의 값이다. 서버가 거는 입력 제한(다듬기 5,000자)·월 한도 오류 모양만 운영과 같게 흉내 낸다. 실제 서버 정책과 자동 동기화되지 않는다.
- 이 서버에는 한글 글꼴이 없어 Noto Sans KR 로 통일해 렌더링한다(운영은 Pretendard). 줄바꿈 위치가 실기기와 다를 수 있다.
- 소셜 로그인·결제·푸시·외부 조회(법제처·온비드 등)는 범위 밖이다.
