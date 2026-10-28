# PR #306 웹 Hosting 병합·배포 결과

## 승인 원문

> 좋아 PR #306 웹 Hosting만 병합하고 배포해줘. 실기기 확인은 내가 할게.

## 결과

- PR #306: MERGED. main 병합 SHA d5301f7f7d7a12a8ffa90e61ebc837bbfe33f741. 병합 시각 2026-10-28T08:52:50Z (17:52:50 KST).
- 검토 코드 HEAD 8d020b8e, 최종 PR HEAD 8e2e5c01. 그 사이는 검토 기록 새 파일 추가뿐이며 CI 성공을 확인했다. 최신 ready 전환 자동 리뷰도 지적 없이 완료됐다(07 색인).
- GitHub Actions [40659975804](https://github.com/hkd620-lab/haru2026/actions/runs/40659975804): headSha가 병합 SHA와 일치, build_and_deploy 성공.
- 실제 배포 명령은 `firebase-tools deploy --only hosting`이다. 프로젝트 haru2026-8abb8, live 버전 bce59454f6bba074. 배포 로그의 버전 ID와 Firebase live 조회 결과가 일치한다.
- releaseTime: 2026-10-28T08:54:45.790Z (17:54:45.790 KST). FINALIZED.
- 운영 https://haru2026.com HTML 200 및 /assets/index-CfCiDka3.js 제공 확인. 새 안내 3종·대화상자 제목 ID 반영과 옛 방식 선택/안내 문구 제거 확인(08-live-verification.json).
- Functions·Firestore/Storage Rules는 이번 작업에서 배포하지 않았다. 데이터 저장 경로와 Functions 리전 변경 없음.
- 실제 기록 저장·AI 사용·로그인·iOS PWA 복귀 E2E는 실행하지 않았으며, 허대표님이 직접 확인한다.
- 판정: ✅ 승인된 병합·웹 Hosting 배포 완료 / 🔍 실기기 E2E는 대표 확인 예정.

## 보존

이 배포 증거는 main 코드나 배포를 다시 바꾸지 않도록 기존 작업 브랜치에 기록 전용으로 push한다. 병합 후 추가 기록은 운영 배포 코드에 포함되지 않는다.
