# 독립 Codex 설계·완료 검토 요청 4

- 허대표님 선택 원문: **“이번 건은 독립 Codex 검토자로 대체”**. Claude OAuth 만료로 검토가 불가능해 이번 건에 한해 검토자 대체를 명시 승인했다.
- 실제 에이전트 전달 문구: “이 파일의 요청 전체를 읽고 수행하라. 구현자와 독립된 검토자이며 파일을 수정하지 않는다. 대상 HEAD와 이전 판정 원문·반영내역을 확인하고 원문 판정을 회신하라.”
- 저장소: `/private/tmp/haru-dev-console-cleanup-20261102`
- PR: https://github.com/hkd620-lab/haru2026/pull/323
- 대상 HEAD: `476d6402faec1e3a4891c212116068ffd7504d48`
- 후속 변경 기준 HEAD: `cd57b92a11aa503d5b1bcb27e3d043267dd47ebd`
- 원래 main: `bea0aadcd8afe6e548ea8b9c3a8d221b0f471225`

## 원래 사용자 요구

영어성경(EEB로 별도 개발), HARU 기록탐정 /asset-explorer, 한글워드, 명작탐정비서 임시 화면을 메뉴뿐 아니라 전용 화면·경로·코드·호출처까지 제거한다. 주식거래일지·선교보고·일반보고는 개발자 콘솔에서 일반 기록 선택으로 옮긴다. 기존 저장 기록·공용 기능·하루식물탐정은 보존한다. 사용자 후속 승인은 주식 사진 OCR에 월한도를 적용한 뒤 공개, 주식 통계/합본/EPUB 제외는 유지, 검증 후 화면 반영, 전용 운영 함수14개 삭제·연결토큰정리는 별도 작업이다. 이번 후속 구현·검증은 Codex 직접 실행을 명시 승인했다.

## 이전 판정과 반영 원문(반드시 함께 확인)

- docs/reviews/2026-11-02-dev-console-design-review-request-01.md 및 result-01.md: '수정 후 승인' 1회
- docs/reviews/2026-11-02-dev-console-design-review-request-02.md 및 result-02.md: 이전 코드 범위 '승인'
- docs/reviews/2026-11-02-dev-console-design-review-request-03.md 및 result-03.md: 인증 실패. 판정이 아니며 승인/수정후승인 횟수로 세지 않음
- docs/reviews/2026-11-02-dev-console-stock-ocr-followup.md: 후속 실제 구현·검증 근거
- docs/reviews/2026-11-02-dev-console-stock-ocr-review-fix.md: 자동 리뷰 P2 원문 링크와 수용·반영 내역
- docs/reviews/2026-11-02-dev-console-device-e2e-confirmation.md: 대표의 세 형식 저장·재열기 정상 답변 원문. 기존 성공을 기록 누락/새 코드가 있다는 이유로 무효화하지 않는다. 초안 사진 경로를 글 저장 검증과 구분한다.

## 이번 독립 판단

파일 수정·Git 변경·Slack 전송·운영 API 호출·실제 AI/실제 사용자 데이터 사용 금지. 상태와 코드를 스스로 확인하고, 필요한 테스트만 읽거나 실행할 수 있다. 에뮬레이터는 localhost:18879/demo-haru-dev-console이고 시험 데이터 전용이다.

새 quota의 서버 권위, 동시성, stock/book/general 분리, 실패/월경계 복원, counter Rules, provider 미호출, 기존 응답/저장 호환성, 초안 사진 업로드와 OCR 배치 중단의 구분, 기존 삭제범위/공용기능 보존을 확인한다. 후속 변경 delta를 중심으로 보고, 이미 검토한 370개 성경 JSON을 전수 재검토할 필요는 없다.

`승인 / 수정 후 승인 / 재설계` 중 판정과 적용 범위를 명시한다. 지적마다 정확한 파일/위치·사용자 영향·필수수정 조건을 적는다. 이전 P2 반영의 수용 여부와 규모/멈춤 조건, 운영 반영 가능 범위를 판단한다. 사용자 추천안 승인과 실기기 확인 원문은 위 기록으로 확인하되 미검증 범위를 과장하지 않는다. 전용 함수14개 삭제·토큰/데이터 폐기는 승인 범위에 포함되지 않는다.

답변은 대상 HEAD·검토 시각·판정을 포함한 원문 Markdown으로 회신한다. 구현자 설명을 신뢰만 하고 승인하지 말고 코드/증거로 확인한다. 상위 작업자가 결과 원문을 저장하므로 저장소 파일은 쓰지 않는다. 최종 완료로 보고한 뒤 추가 동작을 하지 않는다.
