# 비서실 격리 브라우저 검증

`cd frontend && npm run dev -- --config test/home-assistants-browser/vite.config.mjs`

`http://127.0.0.1:18772/`에서 실제 HomePageV2와 관리 창을 렌더링한다. 인증·Firestore·온보딩·타임라인·성능 기록은 합성 데이터로 대체하며 운영 요청을 보내지 않는다.

- 기본: 하루LAW만 표시, 기록의 전체 보기와 비서실의 전체 보기 독립성.
- `?scenario=existing`: 기존 전자소송연습비서 선택 유지, 담기 저장 시 기록 `메모` 보존.
- `?scenario=empty`: 작은 빈 상태, 둘러보기 진입, 등록 없이 실행.
- `?scenario=legacy`: 과거 기록에 담은 장부 유지, 장부를 빼면 다시 표시되지 않음.
- `?scenario=error`: 저장 실패 시 선택 유지, 관리 창 내부 오류 표시, 재시도 가능.

전체 보기에서 담기·빼기, 관리 창 저장·취소, 휴대폰 폭의 1열 배치를 확인한다. 저장 결과는 상단 output에 표시된다.
