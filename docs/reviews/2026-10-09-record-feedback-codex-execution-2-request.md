# PR #272 Codex 실행 2 요청 및 CC 잠정 P2 반영

- 요청 시각: 2026-10-09T11:19:07Z.
- 요청 시점 PR HEAD 및 명시한 검토 대상: `ee7411283535c72bf812224e82202fee5e9d9783`.
- 질문 원문: https://github.com/hkd620-lab/haru2026/pull/272#issuecomment-6079824454
- 결과: 요청 기록 시점 대기. 실행 완료 시각·결과 ID는 확인 후 별도 새 파일로 추가한다. 이 파일은 완료 또는 승인 기록이 아니다.
- 이전 실행 1은 `2026-10-09-record-feedback-codex-execution-1-request.md`, `2026-10-09-record-feedback-codex-execution-1-result.md`에 보존했다. 실행 1 결과 원문과 대상 SHA를 이번 질문에 전달했다.

## CC 잠정 지적과 반영

CC 전달 세션: https://claude.ai/epitaxy/session_01BgCGCxWFeHTKDh1EAUEzuy

잠정 P2 원문: “F-17 수정이 부가세·소득세 두 함수에만 적용돼, 월별·전체·기간 엑셀은 0건이어도 빈 파일이 내려받아집니다.”

`ee741128`에서 공통 `exportLedgerToXlsx`의 출력행이 0개이면 XLSX 생성·객체 URL·다운로드 전에 `{count:0,fileName:''}`을 반환한다. 월별 내보내기는 이 함수를 사용한다. 기존 화면의 0건 안내는 유지한다.

검증:
- `node --import tsx --test test/ledgerEmptyExport.test.mjs`: 17/17.
- PR #271 최종 코드와 PR #272를 결합한 로컬 검증본의 `ledgerEmptyExport.test.mjs`, `ledgerExportConsistency.test.mjs`: 25/25.
- 가상 Firebase 환경변수로 `npm run build`: 성공. 실제 운영 연결 또는 운영 E2E 확인을 뜻하지 않는다.
- `git diff --check`: 통과.

## p14 보정 근거

CC가 미커밋 기대값 보정 때문에 기존 p14 결과를 30/32로 재현한 문제를 확인했다. 증거 개발 브랜치에 보정 diff를 커밋했다:
https://github.com/hkd620-lab/haru2026/commit/84a9c1ea

F-20 종결에 따라 본인 전용 두 사업구분을 유지하는 기대값, 점·하이픈 날짜가 함께 포함되는 합계, 지출만 정확히 합산하는 기대값을 명시한다. 기존 결과 원본은 바꾸지 않는다. 모의 신원 변경은 보정 커밋에 포함하지 않았다. 이 증거 브랜치의 앱 코드는 main에 병합하지 않는다. 이번 커밋으로 새로운 p14 실행의 32/32를 확인했다고 주장하지 않는다.

CC에게 원래 대상에 대한 독립 검토를 중단하지 않고 원문·판정·시각을 보존한 뒤, 이전 판정 원문과 반영 내역을 넘겨 새 기능 SHA를 재검토하도록 직접 요청했다. 독립 검토 결과는 아직 대기이며 자동 판정①을 충족하지 않는다. 미병합·운영 배포 없음.
