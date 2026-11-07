# PR353 승인된 운영 배포 및 확인

- 대표님 직접 승인: “PR 353 main에 병합하고 웹 Hosting에 배포해줘. 배포 후 실제 화면도 확인하고 Slack 감사 채널에 결과 올려줘.”
- PR353 병합 2026-11-07 20:02:54 KST. main e7a64ab5aa1226d223da89b5e2d1b486e63aba52.
- 배포 https://github.com/hkd620-lab/haru2026/actions/runs/42366503055 SUCCESS, Hosting version19daa27c59a535f1, CLI 성공회신20:04:07 KST.
- 대상 Firebase haru2026-8abb8 / channel live / deploy --only hosting. Functions·Rules 배포 없음, 리전·Firestore 경로·환경변수·인증·결제 변경 없음.
- 병합 전 최종 HEAD3bdcd797 CI/Preview 성공. 독립 Claude 검토3 승인·Codex ef23d152 지적 없음. 그 뒤 신규 검토 기록 2개만 추가됨을 name-status로 확인. ready 전환 후 추가 리뷰 댓글은 확인 시점 없었음.

## 운영 UI 실측

- 기존 로그인 세션으로 https://haru2026.com 접속 후 배포 완료 새로고침. 새 브랜드 haru2026/하루lab, 고정 기록 입력 라벨·글상자, 다음 형식 선택과 저장시점 안내 반영 확인.
- 390px 브라우저: 실제 clientWidth375/scrollWidth375, 브랜드 부제11px, 기록 글상자 폭301px.
- 하루LAW 알아보기 → 이용할 비서·하루LAW 설명창 → 이 비서 이용하기 → 실제 하루LAW 질문 화면 진입 확인. 내 비서 담기/빼기는 누르지 않음.
- 질문칸에 임시 합성 문구 입력 후 비움. 글자16px, 테두리2px, 포커스3px, clientWidth/scrollWidth375 일치. 질문 전송·AI 호출·실제 기록 저장 없음.
- 모아보기·공개 기록 함께읽기 메뉴 이름 반영 확인.
- 320px 브라우저: 비서 이름16px/알아보기14px. 다만 관리자 계정 헤더가 가로 넘침(clientWidth305/scrollWidth354). header-actions와 프로필이 우측으로 넘치는 것으로 DOM 확인. 관리자 메뉴를 포함한 좁은 헤더의 후속 보완 필요. 일반 계정 320px 운영 화면은 미확인.
- 실제 물리 휴대폰·OS 키보드·VoiceOver·실제 저장 및 AI 응답, 비로그인 랜딩의 배포 후 시각 확인은 미실시. 코드·격리 검증과 구분.

## 결과 및 보관

✅ 병합·웹 Hosting 배포 완료. 🔍 좁은 관리자 헤더 및 실기기 E2E 추가 확인 필요. 전체 운영 E2E 완료로 단정하지 않음.
스크린샷 외장 보관: /Volumes/LaCie/Mac_작업/완료자료/HARU2026/2026-11-07_PR353_운영배포_2010. LaCie UUID06827F85-BF9F-465C-9C30-E39085839975 확인, 사진4개 복사 후 SHA256대조. 원본 보존.
난이도: 중간.
