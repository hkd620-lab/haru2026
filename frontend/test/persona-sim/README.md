# 가상사용자 격리 파일럿

실제 `frontend/src` 앱 화면을 모바일 Chromium에서 조작하고 Firebase SDK·AuthContext·Functions만 모의한다. 운영 코드·운영 DB·실제 AI 품질을 변경하거나 판정하지 않는다.

## 실행

저장소 루트에서 `cd frontend && npm ci`, 이어서 `cd test/persona-sim && npm install`로 도구를 준비한다. 루트 패키지와 lock 파일은 수정하지 않는다.

macOS Chrome:

```sh
PERSONA_SIM_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node runner/run.mjs p01 p06 p11
```

Linux에서는 `PERSONA_SIM_CHROMIUM`에 Chromium 실행 파일 경로를 지정한다(미지정 기본값 `/opt/pw-browsers/chromium`). 서버는 `127.0.0.1:18762`만 사용한다. 브라우저 실행을 제한하는 샌드박스에서는 해당 실행 권한이 필요하다.

- P01 김서연: 7일간 일기 8건, 제목 필수 안내, 간편/항목별 작성, AI 미리보기 저장 1회, 사진 1장, 같은 날 2건, 목록 확인.
- P06 박지우: 7일간 육아일기 7건, 간편/항목별 작성, AI 1회, 사진 1장, 재접속 확인. 가상의 아동을 사용하며 성장대상 등록·성장 통계까지 검증하지 않는다.
- P11 이민준: 7일간 가계부 문서 7건/거래 8건, 빈 금액·사용처 검증, 지출·수입·이체·다건 저장, 제목, 거래 날짜, 월 합계 확인. OCR·실제 은행 파일은 사용하지 않는다.

## 증거와 종료 코드

실행마다 `out/runs/<UTC 실행ID>/<인물>/result.json`과 단계별 PNG를 생성한다. `summary.json`에는 시간, 기대값 미충족, 단계 실패, 중단 여부가 구분된다. `out/latest-run.txt`에서 최신 실행을 찾는다. `out/`은 Git에서 제외하며 확정 보고서·선별 증거는 `reports/`에 보존한다.

- 종료 0: 모든 시나리오와 기대값 충족.
- 종료 1: 시나리오 중단 또는 제품 기대값 미충족. **중단 없는 실행도 실제 결함이 재현되면 1이다.**
- 단계 오류는 해당 인물의 실행을 중단한다. 틀어진 화면에서 나머지 단계를 실행해 가짜 결함을 쌓지 않는다. 다음 인물은 새 컨텍스트에서 실행한다.

## 격리와 한계

- Vite 설정은 운영 `.env`를 읽지 않고 Firebase import를 모의 SDK로 대체한다.
- 브라우저 HTTP(S) 요청은 정확히 일치하는 로컬 origin만 허용한다. 모의 이미지 도메인은 로컬 응답으로 대체하고 나머지 외부 요청은 차단·집계한다. 서비스 워커도 차단한다.
- 호출·쓰기·업로드 로그는 인물별 localStorage에 누적해 페이지 이동 뒤에도 남는다. 인물마다 새 브라우저 컨텍스트를 사용한다.
- 날짜만 이동하는 Date 프록시를 쓰며 브라우저의 RAF·performance·타이머는 그대로 둔다. 전체 가상 시계를 쓰면 Motion의 애니메이션 시간과 달라져 종료된 로딩 오버레이가 남을 수 있다.
- 390×844 모바일 Chromium 에뮬레이션이다. 실제 iPhone Safari·실기기·Firebase Rules·인증·운영 저장·AI 품질 검증을 대신하지 않는다. 사진은 합성 PNG를 업로드하고 모의 다운로드에서는 1픽셀 이미지를 반환한다.
- `fakes.ts`의 AI 응답과 한도 정책은 모의 값이다. 실제 서버 정책과 자동 동기화되지 않는다.
