# PR #326 — 에세이 본문 이미지 대화 검토 근거

- PR: https://github.com/hkd620-lab/haru2026/pull/326
- 구현·검토 HEAD: b1dc35cc129a12eab925b1de1b069e003bc668c9
- 상태: 구현·로컬 검증·구현 CI·Codex 리뷰·실제 Gemini 합성 이미지 인식 시험 완료. 독립 Claude 검토·병합·운영 배포·운영 E2E는 대기.
- 난이도: 중간. 기장의 자체 확인이며 자동 판정①이나 독립 검토자 승인으로 대체하지 않는다.

## Codex 리뷰 실행 1

- 요청 원문: https://github.com/hkd620-lab/haru2026/pull/326#issuecomment-6589925923
- 요청 시각: 2026-11-02T22:20:22Z (2026-11-03 07:20:22 KST)
- 요청 당시 PR HEAD 및 문구에 지정한 HEAD: 모두 b1dc35cc129a12eab925b1de1b069e003bc668c9
- 실제 시작: 2026-11-02T22:20:36.387058Z
- 완료: 2026-11-02T22:22:04.963150Z
- 결과: completed, has_any_findings=false, has_unresolved_findings=false.
- 결과 원문: https://github.com/hkd620-lab/haru2026/pull/326#issuecomment-6589959978 (댓글 ID 6589959978)
- 요약 상태 원문: https://github.com/hkd620-lab/haru2026/pull/326#issuecomment-6589931324 (댓글 ID 6589931324)
- 별도 PR review ID 없음. 무지적 결과 댓글과 상태 요약으로 확인. 지적·수정 반영 커밋·중단·대체 실행 없음.
- 요청·결과 원문과 관측 당시 CI는 github-comments-observed.json 및 pr-observed.json에 보존.

## 검증

- 이전 작업의 Functions build, 이미지 시험 7/7, Firestore 에뮬레이터 resultChat.integration.js 전체 통과, 월간 AI 할당량 정책 및 하루LAW 오류 코어 시험 통과 근거를 유지한다.
- 이번 후속 작업에서 Functions npm run build 및 node --test test/resultChatImages.test.js 재실행: exit 0, 7/7 통과.
- 구현 HEAD의 CI: build_and_preview, linux_x64_node22, Deploy Preview 모두 SUCCESS. 원문은 pr-observed.json.
- Functions 직접 export 선언 73개 동일(원 구현 작업의 비교 결과). 리전 asia-northeast3, Firestore users/{uid}/records/{date}, 환경변수·Rules·결제·인증 정책 변경 없음.
- 이번 후속 작업은 docs/reviews 아래 새 기록만 추가한다. 생성 lib의 기존 stale 차이는 커밋에 포함하지 않는다. 배포 전 predeploy build로 생성해야 한다.

## 실제 이미지 인식 시험

- 2026-11-03 07:35:27 KST, gemini-3.1-flash-lite 실제 1회 응답. 상세 원문: real-image-smoke.json.
- 합성 PNG(파란 배경과 빨간 원)를 prepareEssayChatImages로 변환한 inlineData와 본문 이미지 안내를 동일한 기존 모델에 전달했다. 질문 텍스트에는 도형과 색의 정답을 넣지 않았다.
- 응답이 파란색 배경과 붉은색 원을 모두 식별했다. 입력 1,286토큰(이미지 1,064·텍스트 222), 출력 46토큰. 그림 이해 능력의 단일 합성 사례 검증이다.
- Firebase 비밀값은 프로세스 메모리에서만 사용했고 키·인증정보를 출력·저장하지 않았다. 제한 실행 환경의 비밀값 읽기 2회는 종료 코드 2로 실패하여 모델을 호출하지 않았다. 권한 요청 후 실행한 1회만 모델 응답을 받았다.
- 실제 배포된 chatWithResult나 실제 사용자 기록으로 실행한 운영 E2E가 아니다. 실서비스 Storage 읽기·사용자 첨부 그림의 내용 설명은 아직 확인하지 않았다. 모의 SDK를 사용한 callable 전달 시험과 실제 모델의 합성 이미지 시험을 구분한다.

## 독립 검토와 다음 조건

- 저장소 docs/reviews/2026-11-02-polish-strength-richness/index.md와 관련 Slack 기록에서 2026-11-03 20:00 KST까지 CC 추가 호출을 하지 말라는 대표 공지를 확인해 적용했다. 이번 작업에서는 Claude CLI나 CC 세션을 호출하지 않았다.
- 대조한 Slack 출처: https://harulab-hq.slack.com/archives/C0C11P98MHV/p1793625723729469 . 이 항목은 다른 PR의 기록으로, 그 승인·배포 근거를 #326에 전용하지 않는다.
- Slack의 #326 관련 검색에서는 직접 해당하는 검토·배포 기록을 확인하지 못했다. 검색 결과 부재를 기존 검증 무효나 운영 실패로 해석하지 않는다. 이번 후속 작업도 Slack에 게시하지 않았다.
- docs/HARU2026_Slack_운영정책.md 8.1절의 독립 검토자 승인 조건이 남아 있다. 호출 중단 해제 후 이 PR·HEAD·근거만 독립 Claude 검토자에게 전달하고 승인 여부·작업 규모·멈춤 조건을 확인해야 한다.
- 운영 반영은 별도 승인 범위를 확인한 후 chatWithResult만 배포 대상으로 삼는다. 별도 AI 호출·모델 변경은 없으나 이미지 입력 토큰 및 Storage 읽기 비용은 증가한다. 실제 사용자가 본문 그림을 질문했을 때 답하는 동작을 운영에서 확인해야 한다.

## Slack 기록용 확정 요약

에세이 본문 이미지 대화 PR #326, 구현 b1dc35cc. CI 3개와 Codex 리뷰 통과(지적 없음), Functions build·이미지 7개 시험 재통과. 실제 Gemini 합성 그림 1회 시험에서 파란 배경·빨간 원 식별. 운영 기록 변경 없음. CC 11/3 20시까지 호출 중단 공지를 적용해 독립 검토 대기. 미병합·미배포·운영 E2E 미확인. Slack 미게시.
