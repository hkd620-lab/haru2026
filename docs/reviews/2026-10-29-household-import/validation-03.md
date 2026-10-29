# b777c3be 최종 기능 검증

대상: b777c3be80a00ee669dbe5a780e3038627a722d3. validation.md와 validation-02.md는 이전 HEAD의 수치이며 이 문서가 최신 기능 검증이다.

- 단위·SSR·기존 글쓰기/초안 회귀 59/59 통과. 명령: frontend에서 node --import tsx --test test/householdAmount.test.mjs test/householdSummary.test.mjs test/householdExport.test.mjs test/householdDuplicates.test.mjs test/householdPdf.test.mjs test/writeBeforeFormat.test.mjs test/writingDraftLifecycle.test.mjs test/originalSaveAutoTitle.test.mjs
- 실제 Firestore SDK + 기존 firestore.rules의 로컬 에뮬레이터 18/18 통과. 명령: FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs
- 프론트 npm run build(Vite/PWA) 통과. 더미 Firebase 설정 사용. 별도 전체 타입 검사는 실행하지 않았다. 기존 큰 청크·Browserslist 경고가 있다.
- PDF 추가 검증: 같은 명의·같은 거래라도 계좌 메타정보가 다르면 출처 키가 달라 확정 중복이 되지 않는다. 예금주 조각 이름과 다음 라벨 구분, 잘못된 표·누락 행·스캔 PDF 거부, 전체 쪽 파싱·정상 반복 결제 보존을 확인했다.
- 실제 원본은 로컬에서만 거래/금액/날짜/시각 대조 및 반복 파일·기간 중복 파일·수동 겹침 저장을 다시 검증했다. 재가져오기와 겹침 제외 후 기존 거래·메모·합계를 보존했다. 금융 개인정보·원본·중간 자료는 저장소와 리뷰에 포함하지 않았다. 운영에는 저장하지 않았다.
- 실제 브라우저: 합성 PDF/XLSX 직접 선택과 미리보기, 선택 전 저장 차단, 기존 거래 사용 후 합계 유지. 공통 저장 래퍼 보완 뒤에는 일반 콜백이 호출되면 오류가 나는 fixture에서 실제 수동 저장 및 겹침 보존 저장을 재검증했다. UI fixture의 인증·이용 이벤트는 모의이므로 운영 이용 이벤트 전송 성공을 증명하지 않는다.
- pdfjs-dist 6.4.299는 npm audit 경고 없음. 저장소의 기존 다른 의존성 경고 20건은 이 범위에서 수정하지 않았다. Hosting 빌드 Node 22 성공; Functions 런타임은 그대로다.
- 운영 암호 XLSX 해제, 실제 모바일, 운영 E2E는 추가 확인 대상이다. main 병합·운영 배포하지 않았다.

대표님 결정 사항: 월별 고정 문서 ID와 월 1일 대표 날짜, 기존 문서의 제외 확인 키 메타데이터, 전수 서버 조회에 따른 비용·지연 및 오프라인 제약. 기존 기록 문서는 이동·삭제하지 않는다. 가져오기 한 번은 미리보기와 저장에서 각각 기록 컬렉션을 읽으므로 문서 수 N에 대해 전체 읽기는 약 2N이며 트랜잭션 재확인 읽기는 별도다. 실제 과금액을 계산하거나 운영 자료를 조회하지 않았다.
