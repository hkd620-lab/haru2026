# be70fa7b 보완 검증

- 단위·SSR·기존 글쓰기/초안 회귀: 57/57 통과. frontend에서 node --import tsx --test test/householdAmount.test.mjs test/householdSummary.test.mjs test/householdExport.test.mjs test/householdDuplicates.test.mjs test/householdPdf.test.mjs test/writeBeforeFormat.test.mjs test/writingDraftLifecycle.test.mjs test/originalSaveAutoTitle.test.mjs
- 실제 SDK·기존 Rules 로컬 에뮬레이터: 18/18 통과. FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs
- Vite/PWA 프론트 빌드 성공. PDF 패키지 audit 경고 없음. 기존 다른 의존성 경고와 청크 경고는 1차 검증 문서와 같다.
- 브라우저: 일반 콜백이 실행되면 오류를 내는 fixture에서 실제 FormatModal 공통 저장 성공. 동일 날짜·금액 수동 거래는 선택 전 거부, 기존 거래 사용 후 저장 건수/지출 합계 유지.
- 로컬 비공개 실전 자료: PDF 직접 파싱 거래/금액 대조, 반복 파일 저장, 다른 기간 중복 파일, 수동 겹침에서 기존 거래·메모·합계 보존을 다시 확인. 실제 자료나 금융 개인정보는 이 저장소에 보관하지 않음.
- CI: https://github.com/hkd620-lab/haru2026/actions/runs/40795172468 (기능 HEAD be70fa7b 성공).
- 기능 HEAD의 main 대비 경로 확인: Functions·Rules·모바일·금지 파일·라우터 변경 없음. RecordPage는 첫 구현에서 추가한 분기를 공통 FormatModal로 옮겨 최종 main 대비 변경 없음.
- 운영 배포·main 병합 없음. 독립 1차의 규모 대·저장 문서 ID 및 날짜 의미 변경 멈춤 조건 판정을 수용하며, 대표 승인 대상이다. 전수 조회 비용·지연도 함께 보고한다.
