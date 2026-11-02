# 개발자 콘솔 정리 운영 반영 결과

판정: **✅ 코드 정리·승인 범위 운영 반영 완료 / 🔍 사진 OCR 운영 실기기 추가 E2E 필요**. 작업 난이도 **5.5 높음**. 실제 검증 범위를 전체 공용 기능 회귀나 사진 OCR 실기기 성공으로 확대하지 않는다.

## 요구·코드·검토

- PR https://github.com/hkd620-lab/haru2026/pull/323 . 대상 main, 원격 작업 브랜치 codex-dev-console-cleanup, 로컬 codex/dev-console-cleanup.
- 영어성경·HARU 기록탐정·한글워드·명작탐정비서 임시 화면의 전용 메뉴/경로/코드 제거. 선교보고·일반보고·주식거래일지는 일반 기록 선택으로 이동. 사용자 데이터·공용 영어일기/하루식물탐정 등 보존.
- 주식 사진 추출 독립 월간20/100/300장, 서버 transaction 예약·실패 복원, 한도 초과 뒤 공통 사진 업로드 계속 처리. 직접 입력/저장 유지.
- 사용자 승인: 추천안 진행, 이번 보완 Codex 직접 구현·검증, 이번 건 독립 Claude→독립 Codex 대체. 사용자 실기기 원문 **“세 형식 저장·다시 열기 정상 확인”** 보존.
- 최신 검토 코드 c1dc299abe8544fde4b8e14fa69185b8f9a0163e. 최신 main17f2d8c의 강 다듬기 통합 포함. 자동 재검토 무지적·독립05 **승인**. a3fd4bd13f13a86ee7880fabeb88972ab43b3d7c는 검토 기록3개 추가만, 최종 CI 모두 success. ready 자동6차도 무지적 완료. 원문/실패 포함 색인01~04 참조.
- 통합 Functions 빌드+53시험, 프론트 빌드36.74초+62시험 통과. 독립 검토 Functions53·프론트69, 메모리 컴파일 index 전체 일치. 앞선 실제 Firestore emulator quota1·저장/권한6 통과. 기존 전수 프론트 실패8건은 기준선 동일로 범위 밖 보존.

## 선택 Functions 배포

- 명령: `firebase deploy --only functions:extractStockTradeTextFromPhoto --project haru2026-8abb8 --non-interactive` . 성공 exit0. Hosting 공개 전 실행.
- 대상 projects/haru2026-8abb8/locations/asia-northeast3/functions/extractStockTradeTextFromPhoto . gcloud functions describe와 list --v2 실측.
- runtime nodejs22, state ACTIVE, revision **extractstocktradetextfromphoto-00033-wun**, allTrafficOnLatestRevision=true, updateTime **2026-11-02T20:34:48.638784264Z**.
- 이전 revision extractstocktradetextfromphoto-00032-doq. 단일 함수만 갱신. 다른 함수·Rules·기존 객체 ACL·연결 토큰·사용자 기록 변경/삭제 없음. polishContent 추가 배포 없음.
- 미로그인 빈 data callable 운영 요청: HTTP401, `UNAUTHENTICATED`, “로그인이 필요합니다.”. 실제 AI·사진·사용자 데이터/사용량 변경 없이 인증 가드 확인. 이 시험이 로그인 후 월한도 동작을 입증하는 것은 아니다.

## main·Hosting

- 병합 SHA **4be8e423b6fcb16c75a2f485dbb2cac7388a95ec**, mergedAt2026-11-02T22:18:44Z. expected_head_sha a3fd4bd1 검증, 자동 병합 설정 없이 즉시 일반 merge.
- Hosting Actions **41536171831**, build_and_deploy125588442720, conclusion success, 완료2026-11-02T22:22:47Z. https://github.com/hkd620-lab/haru2026/actions/runs/41536171831
- firebase hosting:channel:list 운영 live 실측: 버전 **d3d42598d4138c8a**, FINALIZED, release **1793658006096000**, releaseTime **2026-11-02T22:20:06.096Z**. fileCount53/versionBytes11987557. 배포 도구 cli-firebase--action-hosting-deploy.
- 운영 https://haru2026.com 에서 브라우저 렌더 확인: /asset-explorer, /bible, /vocab, /dev/hangul-word, /dev/masterpiece-detective 모두 홈 /로 이동. 최초 일부 관찰은 hydration 이전이었으므로 기록검색 버튼 렌더 대기 후 URL/홈 확인으로 판정했다.
- 홈 전체 보기에서 선교보고·일반보고·주식거래일지 일반 카드 표시. 영어일기/하루식물탐정 버튼과 공용 성경 말씀 표시 유지. 사용자 기록 저장/수정·실제AI 호출은 하지 않았다.

## 남은 범위·복구

- 대표 preview 실기기 텍스트3형식 저장·SAYU 재열기 성공은 유효하다. 사진 OCR 운영 월한도/다중 초안 사진 실기기, 공용 기능 전체 실제계정 회귀는 별도 미확인.
- 운영 전용 함수14개 삭제·Drive/OneDrive 토큰 폐기·기존 데이터 삭제는 이번 범위 밖. 소스에서 제거됐어도 운영 함수가 폐기됐다고 표현하지 않는다.
- 실패 복원은 저장 장애 시 최선 노력 방식. 복원 쓰기 자체 실패/프로세스 종료의 내구성 한계 유지.
- 이전 PDF·독서 운영 검증은 미완료 보류를 유지한다.
- 되돌리기는 병합 revert 및 검증된 Hosting/선택 함수 버전 재반영을 검토하며, 임의 롤백은 실행하지 않았다. 이전 main17f2d8c/함수00032-doq와 데이터 보존 범위를 함께 확인해야 한다.

## 저장·정리

- 소스·필수 검토 기록은 내부 정상 Git worktree `/private/tmp/haru-dev-console-cleanup-20261102`와 원격 작업 브랜치에 유지. 일반 내보내기 산출물은 생성하지 않아 외장 저장/해시 복사 대상 없음.
- 이번 로컬 demo-haru-dev-console emulator 프로세스만 SIGINT 종료, 18879 LISTEN 없음 확인. 직접 만든 frontend/functions node_modules 링크만 unlink, 대상 의존 폴더 보존. 배포 빌드가 재생성한 범위 밖 snsToDiary.js 변경 원복.
- 원본 `/Users/heogyeongdae/Developer/HARU2026`은 다른 작업이 사용 중인 clean codex-essay-chat-images/b1dc35cc로 확인했고 임의 브랜치 변경/수정하지 않았다.
- GitHub·Slack 대조: 감사 https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1793651522871309 , 선택 함수 결과 https://harulab-hq.slack.com/archives/C0C11P98MHV/p1793651922754919 . 최종 반영 결과는 동일 개발 대표 스레드와 감사에 추가 기록한다.
