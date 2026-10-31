# 동일 파일 재가져오기 상태 갱신

- 기준 main af27e7e4. 사용자 요청: 이미 저장한 동일 파일을 신규로 표시하는 원인을 확인하고 수정. 사용자 추가 저장 없음.
- 확인 사실: 운영을 읽기 전용으로 집계하고 동일 로컬 원본 식별자를 대조해 저장 누락·원본 키 불일치 없음 확인. 실제 Chrome 사용자 계정에서 동일 원본을 새로 읽으면 추가 0·전체 중복 제외로 정상. 운영 데이터 변경 0.
- 한계: 사용자가 제공한 이전 신규/선택대기 화면으로 이어지는 정확한 동작 경로는 재현하지 못함. 현 코드에 저장 이후 열린 미리보기 자동 갱신이 없어 이전 비교 결과가 남는 경로는 합성 UI로 재현함. 이를 원 사건의 확정 원인이라고 주장하지 않음.
- 수정: 가져오기 미리보기를 연 채 화면으로 복귀하면 서버 내역을 다시 읽어 중복 확인. 수동 재확인 버튼 제공. 동일 요청 중복 실행 및 창 종료/새 파일/계정 변경 뒤 낡은 응답 반영 방지. 조회 실패 시 이전 수치를 숨기고 저장 비활성화. 모두 중복이면 다시 저장하지 않고 닫아도 된다는 안내.
- 비용: 미리보기가 열린 상태에서 포커스 복귀/수동 재확인 1회마다 기존 기록 컬렉션 N개를 추가 조회. 타이머 반복 조회 없음, 동시 요청 중복 실행 방지. 기존 가져오기 약 2N에 재확인 조회가 더해짐.
- 자동 검증: 단위·SSR·기존 회귀 65/65, 실제 SDK·기존 Rules 로컬 에뮬레이터 20/20. 합성 529건 중 기존 거래 142건이 있을 때 처음은 신규 387/선택대기 142, 저장 후 재조회는 추가 0/제외 529. 재저장도 추가 0, 기존 문서 동일 확인.
- 브라우저: 합성 PDF 2건 미리보기(추가 2) 뒤 별도 로컬 SDK로 저장. 미리보기는 기존 추가 2 상태가 남음. 최신 저장 내역 다시 확인 클릭 후 추가 0/제외 2 및 닫기 안내 확인. 운영 원 사건의 정확한 재현은 아님.
- 명령: frontend에서 node --import tsx --test test/householdAmount.test.mjs test/householdSummary.test.mjs test/householdExport.test.mjs test/householdDuplicates.test.mjs test/householdPdf.test.mjs test/householdSavePreview.test.mjs test/writeBeforeFormat.test.mjs test/writingDraftLifecycle.test.mjs test/originalSaveAutoTitle.test.mjs. FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs.
- 빌드: 더미 Firebase 환경변수로 npm run build 실행, 결과는 최종 기록 참조. git diff --check 통과.
- Functions/Rules/Firestore 경로/환경변수 설정/결제/인증/모바일 변경 없음. 금융 원본·거래 원문·원본 식별 키·계좌·파일명·인증정보는 리뷰 자료/저장소/PR/Slack에 포함하지 않음.
