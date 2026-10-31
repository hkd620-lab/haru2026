# 독서대화 격리 브라우저 검증

프론트 폴더에서 `npm run dev:reading-ai-qa`를 실행하고 `http://127.0.0.1:18761`을 연다.

실제 `FormatModal`, OCR 이미지 준비, 독서대화 컴포넌트/훅을 실행한다. Vite의 테스트 전용 resolver가 Firebase SDK와 AuthContext를 합성 fixture로 교체한다. 운영 Firebase나 Gemini에 연결하지 않는다. 일반 `npm run dev`/production build에는 이 resolver가 적용되지 않는다.

신규/기존 책 흐름을 직접 조작하고 ‘검증 근거 · 호출과 저장’에서 입력 컨텍스트·역할별 저장 데이터·bookId를 확인한다. 이미지 선택은 로컬 테스트 PNG/JPG를 사용한다. OCR 응답은 사진 내용과 무관한 합성 문자열이며 실제 OCR 정확도 검증이 아니다. Storage upload는 테스트 실패로 처리한다. 이미지 base64는 검증 로그에도 보관하지 않는다.

‘실패 시나리오’에서 AI·월간 한도·네트워크·OCR·저장 실패를 선택할 수 있다. 기록은 이 테스트 origin의 `reading-qa-records` 키에 저장되어 새로고침 후에도 남는다. 테스트 사진과 개인 기록을 운영 데이터로 취급하지 않는다.

서버 입력 검증/공통 제한 연결/실패 환급은 `functions`의 `npm run test:reading-ai`로 별도 확인한다. 프론트 데이터 분리와 초안 회귀는 `frontend`의 `npm run test:reading-ai`로 확인한다.
