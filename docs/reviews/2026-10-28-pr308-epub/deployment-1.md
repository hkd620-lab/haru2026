# PR #308 배포·운영 브라우저 검증 기록

- 기록 시각: 2026-10-28T21:43:37+09:00
- 상태: 서버·웹 배포 및 운영 Chrome 확인 완료. Android/iPhone 실기기 리더 앱 열기 추가 E2E 필요.
- 허대표님 병합·웹·exportEpub 배포 승인 및 CC 대체 코드 검토 지시에 따라 진행. 자동 Codex 리뷰 통과로 기록하지 않는다.
- CC 결과 원문: [cc-2-result.md](cc-2-result.md), 판정 '승인', '배포 차단 지적 없음.'
- 검토 대상 코드 b38797a5637fd9369b620cc6e0db4c184b6ac599. 기록 전용 커밋 21c05b2072e01164786002ec455b695e9e1c2fc4의 CI·프리뷰 SUCCESS 확인 후 배포했다. 그 커밋은 docs/reviews 아래 새 파일 A만 포함함을 전체 name-status로 확인했다.

## 서버 선배포

- 명령: `firebase deploy --only functions:exportEpub --project haru2026-8abb8 --non-interactive`
- predeploy Functions 빌드 통과, Successful update operation 및 Deploy complete 확인.
- 실제 함수: projects/haru2026-8abb8/locations/asia-northeast3/functions/exportEpub
- runtime nodejs22 / state ACTIVE / revision exportepub-00033-geq
- updateTime: 2026-10-28T12:32:25.918003132Z (21:32:25 KST)
- Cloud Run latestReadyRevisionName exportepub-00033-geq, Ready/ConfigurationsReady/RoutesReady True, traffic 100%.
- `gcloud functions list`에서 exportEpub ACTIVE·GEN_2 확인. list 출력의 region 열은 비어 있어, 리전은 describe의 전체 리소스 경로 asia-northeast3로 확인했다.
- Functions 리전·Firestore 핵심 경로 유지. Rules 배포 없음. 결제·인증 정책·환경변수 변경 없음.

## 웹 배포

- PR https://github.com/hkd620-lab/haru2026/pull/308 — squash 병합 완료.
- main SHA: ab64f2d373db8a49a96ef883855b4697b1fc6210
- mergedAt: 2026-10-28T12:33:56Z (21:33:56 KST)
- 운영 Hosting CI https://github.com/hkd620-lab/haru2026/actions/runs/40688851210 — build_and_deploy SUCCESS, 위 main SHA 일치.
- 운영 live release: projects/haru2026-8abb8/sites/haru2026-8abb8/channels/live/releases/1793190927671000
- Hosting version: 492b961d98e4e97e
- releaseTime: 2026-10-28T12:35:27.671Z (21:35:27 KST)
- 테스트용 로컬 dist를 배포하지 않고 main CI의 운영 환경값으로 자동 배포했다.

## 운영 확인

운영 haru2026.com/sayu의 기존 로그인 세션에서 실제 버튼으로 확인했다. 사용자 본문·사진·UID·서명 URL·인증정보는 이 기록이나 Slack에 복사하지 않았다.

1. 웹 새로고침 후 EPUB 버튼에서 사진 포함 가능 여부·리더 필요 여부·Android 열기 방법과 Google Play 북 공식 설치 링크 표시 확인.
2. 취소 시 안내창 닫힘, 원래 기록 화면 복귀 및 EPUB 버튼 로딩 해제 확인. 공통 서비스 단위 테스트에서는 취소 시 서버 호출 0건 확인.
3. 에세이 단건 실제 다운로드 성공. ZIP CRC·mimetype 정상, 본문 장 1개, 비어 있지 않은 내장 사진 4개, 파일 436436 bytes.
4. 최초 오류가 발생했던 일기 단건 실제 다운로드 성공. ZIP CRC·mimetype 정상, 본문 장 1개, 비어 있지 않은 내장 사진 2개, 파일 310914 bytes.
5. Cloud Run POST 요청 로그 2건이 모두 HTTP 200, revision exportepub-00033-geq임을 확인. timestamp는 각각 2026-10-28T12:38:11.820878Z와 2026-10-28T12:40:48.484938Z.
6. 새 이미지 공개·기록 내용 변경·추가 AI 호출은 수행하지 않았다. 기존 기록의 EPUB 생성과 다운로드만 수행했다.

## 남은 확인과 검토 상태

- Android 실제 휴대폰에서 설치 링크를 열고 받은 EPUB을 리더 앱에서 열기, iPhone 도서 앱 열기는 미실행. Chrome의 Android 표시 환경 확인을 실기기 E2E로 부르지 않는다.
- 합본·기간별 요청 및 네 진입점 연결은 회귀 테스트 통과. 이번 운영 브라우저 파일 생성은 일기·에세이 단건 2건을 확인했다.
- GitHub 자동 Codex 리뷰 실행 1은 배포 후 마지막 확인에도 running, 결과 리뷰 ID 없음이었다. [진행 중 색인](codex-index-1-pending.md)의 원문 링크에 남기며 통과·거부·정책상 2시간 무응답 확정으로 바꾸지 않았다.
- 이번 기록은 배포 후 새로 추가하는 문서이며 제품 코드를 바꾸지 않는다. 검토 원문·이전 기록은 수정하지 않았다.

## 복구 기준

이상 시 웹을 먼저 직전 release/이전 main으로 되돌리고 필요하면 exportEpub을 이전 코드로 재배포한다. 배포 전 서버 revision exportepub-00032-hom, Hosting version bce59454f6bba074. 이번 작업에서 롤백은 실행하지 않았다.
