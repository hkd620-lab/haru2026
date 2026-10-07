# 가상사용자(페르소나) 격리 시뮬레이션 하네스

실제 앱(`frontend/src`의 `App`)을 **가짜 Firebase 위에서** 모바일 브라우저(Chromium, 390×844)로 조작해,
가상인물이 기록을 쓰고 저장하고 목록·합계를 확인하는 과정을 재현하고 결과 보고서를 만든다.

## 안전 원칙

- 운영 Firebase·Gemini·결제·로그인 서버에 **접속하지 않는다.** 앱의 `firebase/*`, `src/firebase.ts`, `AuthContext` 세 곳만 이 폴더의 모의 구현(`sdk.ts`, `providers.tsx`)으로 바꿔 끼우며, 하네스 서버 밖으로 향하는 요청은 모두 차단·집계한다.
- 데이터는 브라우저 메모리(+localStorage)에만 남고 인물마다 저장소가 따로다.
- AI 응답은 모의값(`fakes.ts`)이다. **AI 결과의 품질은 평가하지 않는다.** 서버가 거는 입력 제한(예: 다듬기 5,000자)·월 한도 오류만 운영과 같은 모양으로 흉내 낸다.
- 운영 코드·설정은 바꾸지 않는다. 이 폴더에는 테스트 도구만 있다.

## 실행

```bash
cd frontend/test/persona-sim
npm install                      # 최초 1회 (playwright-core, 한글 글꼴)
node runner/run.mjs              # personas/ 의 모든 인물 실행 (예: node runner/run.mjs p01 p13)
node runner/report.mjs --name 2026-10-07-pilot   # 최근 실행 결과로 보고서 생성
```

- 앱 의존성은 `frontend` 에서 먼저 설치해 두어야 한다(`frontend/node_modules`). `cdn.sheetjs.com` 접속이 막힌 환경에서는 `xlsx` 만 레지스트리 판으로 바꿔 설치한 뒤 `package.json`·lock 을 되돌린다.
- 결과 원본(스크린샷·`result.json`)은 `out/runs/<실행ID>/` (git 제외), 보고서는 `reports/<이름>/` (git 포함).
- 이미 떠 있는 서버를 재사용하려면 `node runner/serve.mjs` 를 따로 띄워 둔다(포트 18762).

## 구성

| 경로 | 역할 |
|---|---|
| `vite.config.mjs`, `main.tsx`, `index.html` | 하네스 서버 — 실제 `App`을 그대로 올리고 위 세 곳만 교체 |
| `sdk.ts` | 인메모리 Firestore(where·orderBy·merge·배치·트랜잭션), Auth, Storage, Functions 모의 |
| `fakes.ts` | Cloud Functions 모의 응답(다듬기·월 한도·키워드 등). 모의되지 않은 함수는 `unknownCallables` 로 따로 집계 |
| `fixture.ts`, `providers.tsx` | 가상사용자 신원·호출/저장 기록(`window.__qa`)·로그인 상태 |
| `runner/driver.mjs` | 홈→형식 카드→작성→저장→SAYU 조작 도구, 단계·점검·발견 기록 |
| `runner/run.mjs`, `runner/report.mjs` | 실행기, 보고서 생성기 |
| `personas/pNN-*.mjs` | 가상인물 시나리오(프로필, 일자별 입력, 기대 결과 점검) |

## 가상인물 추가하기

`personas/p01-diary.mjs` 를 본떠 `meta`(프로필·시나리오)와 `run(ctx)`를 쓴다. 날짜는 `ctx.setDay('2026-10-03', '21:30')` 로 옮기고
(시간은 흐르되 "오늘"만 바뀐다), 실제 사용자처럼 `openApp → openFormatFromHome → 작성 → 저장` 순서로 누른다.
`ctx.check(이름, 조건, 근거, 심각도)` 로 기대를 적고, 결과가 문제면 `ctx.finding({severity, title, detail})` 로 발견을 남긴다.

## 한계

- Chromium 모바일 에뮬레이션이라 iOS Safari 고유 문제는 못 잡는다. 글꼴을 Noto Sans KR 로 바꿔 쓰므로 줄바꿈 위치가 실기기와 다를 수 있다.
- 가상인물은 실제 사용자보다 협조적이다. 취향·구독 의사는 알 수 없다.
- 소셜 로그인·결제·푸시·외부 조회(법제처·온비드 등)는 범위 밖이다.
