관련 이슈 #281. PR270·PR282/#280 완료 상태 유지.

## 목적과 주요 변경
기존 시험의 구형 `user.uid` 문자열 단언을 실제 계약 검증으로 대체합니다. 코드 변경은 `frontend/test/loginProviderStorage.policy.test.cjs` 한 파일이며 기존14개 정책 단언은 유지했습니다. 나머지 변경은 새 검증 기록입니다.

실제 사용자문서 effect 전체·cleanup과 mapUser/remember/정규화 유틸을 추출해 실행합니다. 캡처UID·UID별 저장, 초기Firebase우선/스냅샷로컬우선, 정규화·폴백, 현재인증/세대/cleanup/캐시/대기쓰기/setter UID 가드와 저장소 접근거부를 검증합니다.

## 검증
- 대상 시험9통과/0실패/0skip.
- 관련 인증진단·캐시2파일, 콜백·복귀경로 정책 시험 통과.
- 로컬 `npm run build` exit0(더미 Firebase12변수, Node26). CI Node20 검증은 별도 확인합니다.
- 메모리 회귀 변이 유효12종 모두 검출. 최초setter 진단의 중복앵커 오류는 검출로 세지 않고 보존 후 정정했습니다.
- git diff --check 통과.
- [전체 명령·결과·한계](https://github.com/hkd620-lab/haru2026/blob/5fc95117/docs/reviews/2026-10-19-issue281-provider-contract-test-fix.md)

## 검토·배포 영향
허대표님 이번 지시로 초안 PR과 **프리뷰 자동배포만 허용**됐습니다. 과거 기록의 PR/배포금지는 당시 범위로 보존합니다. Codex와 독립 Claude 검토를 진행하고 초안을 유지합니다.

앱 코드·Rules·인증 정책 수정 및 main 병합·운영배포 금지. Functions·Rules 배포 없음. Firestore users/{uid}/records/{date}, Functions asia-northeast3, 환경변수 정의·결제·AI호출·의존성·워크플로 변경 없음.

## 위험과 되돌리기
실제 React DOM/StrictMode 마운트·OAuth·브라우저복원·SDK/Rules 권한 통합시험이 아닌 추출한 실제 로직의 fixture 시험입니다. timeout은 fake이며 실제 시간경과를 검증하지 않습니다. 앱 계약을 하네스에 복사하지 않습니다. 필요 시 시험 변경5640e0d7을 별도 되돌림 커밋으로 취소할 수 있고 현재 운영 코드 영향은 없습니다.
