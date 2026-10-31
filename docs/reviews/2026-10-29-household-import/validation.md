# 가계부 가져오기·중복 처리 검증

- 범위: 카카오뱅크 텍스트 PDF, XLSX(암호 없음은 로컬, 암호 있음은 기존 해제 함수), 신규 가계부 저장의 중복 확인.
- 단위·SSR: 33/33 통과. frontend에서 node --import tsx --test test/householdAmount.test.mjs test/householdSummary.test.mjs test/householdExport.test.mjs test/householdDuplicates.test.mjs test/householdPdf.test.mjs
- 기존 firestore.rules + 실제 SDK의 로컬 에뮬레이터: 14/14 통과. FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs
- 주요 사례: 파일명 변경 재가져오기, 응답 유실 재시도, 수동→은행, 은행→수동, 동시 저장, 정상 반복 결제, 기존 단건·다중 형식 보존, 오래된 선택 거부, 여러 달 전체 저장/실패, 권한 실패.
- 초안·원본 저장 회귀 22/22 통과: node --import tsx --test test/writeBeforeFormat.test.mjs test/writingDraftLifecycle.test.mjs test/originalSaveAutoTitle.test.mjs
- npm run build 성공(Vite+PWA). 더미 Firebase 설정 사용. 별도 TypeScript 전체 검사는 실행하지 않음. 기존 큰 청크·Browserslist 경고 있음.
- 로컬 브라우저: 실제 FormatModal에서 합성 XLSX·PDF 직접 선택, 비밀번호 없는 읽기, 겹침 비교, 선택 전 미저장, 기존 거래 사용 후 지출 합계 보존 확인. 기존 XLSX 재가져오기는 이미 저장·선택 비활성 확인. PDF는 실제 PDF.js worker를 사용함.
- 비공개 실전 자료는 로컬에서만 원본과 금액·거래 건수 대조 및 반복/기간 중복/수동 중복 검증. 원본·가공 자료·금액·이름·계좌정보는 저장소/PR/Slack/검토자에게 제공하지 않음. 운영 데이터에 저장하지 않음.
- PDF 의존성 pdfjs-dist 6.4.299 고정. npm audit에서 이 패키지 경고 없음. 저장소의 기존 다른 의존성 경고 20건은 이번 범위에서 수정하지 않음. 라이브러리 요구에 맞춰 Hosting 빌드 Node 22 사용. Functions 런타임은 변경하지 않음.
- 최초 에뮬레이터 실행은 Java 한국어 리소스 오류로 실패하여 en_US로 재시작했고 기존 Rules 그대로 재검증함. 최초 PDF 합성 fixture는 텍스트가 한 셀로 합쳐져 거부됐으며 실제 표와 같은 간격으로 fixture를 수정 후 통과함.
- 보존: 기존 문서 이동/삭제/일괄 정리 없음. users/{uid}/records 컬렉션 유지. 신규 저장 대상은 YYYY-MM-01_household 문서. 선택적 출처 해시·거래 시각·제외 확인 키 메타데이터를 추가함. 기존 거래 필드와 다른 형식은 보존.
- 제한: 스캔 PDF, 다른 은행 임의 양식, XLS/CSV는 미지원. 20MB·PDF 200쪽 제한. 암호 있는 XLSX의 운영 함수 해제·실제 모바일·운영 E2E는 이번 로컬 검증으로 단정하지 않음. 이전 클라이언트/일반 편집까지 전역 잠금하지 않음. 기존 중복 거래를 자동 청소하지 않음.
- 운영 배포/병합 없음. Functions·Rules·환경변수·AI 모델/호출·결제/인증 정책 변경 없음. 기존 이용기록 이벤트 유지.
