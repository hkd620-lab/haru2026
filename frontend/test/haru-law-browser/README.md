# 하루LAW 전용 화면 격리 검증

`cd frontend && npx vite --config test/haru-law-browser/vite.config.mjs`

- http://127.0.0.1:18774/haru-law : 실제 HaruLawPage와 패널·훅을 렌더링.
- `?mobile=1`은 390×844 iframe, `?plan=free`는 무료 첨부 제한.
- 검색/저장 실패 체크 후 재시도, 기존 기록 준비 후 병합 보존 확인.
- Firebase 모듈과 서비스·인증·구독은 합성 mock으로 치환. 운영 데이터·AI 호출 없음.
- 상단 검증 컨트롤은 이 격리 페이지에만 존재한다.
