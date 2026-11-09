# PR 353 휴대폰 가독성·다음 단계 안내 보완 검증

- 요청: 허대표님 “기장 의견을 Slack 감사 채널에 올리고, 권장한 순서대로 수정 진행해줘. PR 353의 휴대폰 글자 크기부터 보완해줘.”
- 의견·착수 기록: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1794005113596599
- 기준 main: 8f173349 (PR352). 작업 브랜치 codex-input-clarity-20261106, PR https://github.com/hkd620-lab/haru2026/pull/353 (초안).
- 모바일 보완 커밋 63ceebb9, 안내 보완 코드 f24775fd. 이 문서는 자체 구현 검증이며 독립 검토 승인이나 운영 완료 판정이 아니다.

## 보완

1. 모바일 미디어 규칙의 선택 문구 8px 덮어쓰기를 14px로 수정. 비서 이름16px, 선택 표시 높이44px, 긴 이름 줄바꿈.
2. 홈 버튼을 ‘다음 · 기록 형식 고르기’, 미리 형식을 선택했으면 ‘다음 · 기록 확인하기’로 변경. 다음 화면에서 확인 후 저장한다고 안내.
3. 분석도구 → 내 기록 살펴보기, 기록합본 → 기록 모아보기, SAYU·함께보기 → 공개 기록 함께읽기. 통계와 합본의 실제 제공 범위 설명. 공개/공유 권한은 변경하지 않음.
4. 첫 방문 제목에 기록 정리와 생활 비서 두 역할 표시. 시작 버튼을 가치 설명 앞에 두고 모바일 소개 이미지 순서를 뒤로 조정. 데스크톱·320px 제목 줄바꿈 보완. 호박 이야기는 아래 소개로 이동. 서비스 haru2026, 운영사 하루lab 표기. 공식 로고는 원본 유지.

## 검증

- frontend npm run build 성공(최종 코드31.45초). 비운영 Firebase 합성 환경값 사용, 경고는 기존 번들 크기/동적·정적 import 혼용 경고. TypeScript 전수 검사는 수행하지 않았다.
- node --import tsx --test test/homeRecordComposer.test.mjs test/homeAssistantSelection.test.mjs: 8/8.
- npm run test:question-enter: 21/21. test:question-inputs, socialLoginReturnOrigin.policy.test.cjs, loginPerformanceCallsites.policy.test.cjs 통과.
- git diff --check 통과. 변경 범위에 Functions/Rules/환경변수/결제·인증 로직/모바일 소스 없음. Firestore users/{uid}/records/{date}, Functions asia-northeast3 유지.
- 실제 HomePageV2/RecordPage/LandingPage 컴포넌트를 격리 Vite fixture로 렌더링. 인증·Firestore·형식 편집창 서비스는 합성 대체, 운영 저장·AI 호출 없음.
- 390px iframe(내용375px), 320px iframe(내용305px): 가로 넘침 없음. 계산된 선택 표시14px·높이44px, 긴 비서 이름16px. 카드 클릭 후 ‘선택한 비서 · 하루LAW’ 및 ‘전자소송연습비서 · 베타’ 설명 창 확인.
- 홈 원문 입력 → ‘다음 · 기록 형식 고르기’ → 메모: 원문이 메모 편집창으로 그대로 전달됨. fixture 상태 ‘저장 없음’ 유지. 형식을 먼저 골랐을 때 ‘다음 · 기록 확인하기’ 표시 확인.
- 첫 방문320/390px 및 데스크톱1280px: 제목/시작 버튼/줄바꿈/가로 넘침 확인. 무료로 시작하기 → /login 이동. 실제 제공자 로그인은 이 fixture에서 시험하지 않음.
- 월 기록 현황 오류 표시는 fixture의 auth.currentUser=null에 따른 합성 상태로 이번 운영 오류를 뜻하지 않는다.

## 보관·한계

- LaCie 연결 및 UUID 06827F85-BF9F-465C-9C30-E39085839975 확인.
- 외장 보관: /Volumes/LaCie/Mac_작업/완료자료/HARU2026/2026-11-07_PR353_휴대폰문구보완_0945/
- 화면5장·빌드로그1개를 새 폴더로 복사한 뒤 임시 원본과 전체 SHA-256 일치 확인. 기존 보관 파일은 유지.
- 기존 PR353 입력칸 검증 기록은 보존. 이번 기록은 모바일 CSS 보완 및 승인된 안내 수정에 대한 추가 근거.
- PR은 초안으로 유지. 독립 검토/최종 CI 확인 및 별도 승인된 병합·운영 배포·실기기 E2E는 별도 단계. 최신 GitHub PR 상태와 감사 채널의 김비서·CC·착수 메시지를 대조함.
- 난이도: 5.5 중간.

## 보관 파일 SHA-256

```text
a6eb738e92f12b5beb278c5e7b2e6633dca7b90eb798e5a108335994e54e4caa  assistant-mobile-390.jpg
d3740d55bd69f0e38d78a3d79f68973ad3be7dee53907cd51d0615606ee192d0  build.log
434f1666ae585c5f06a1b446a9d40970e25561ed24c56421670c3ca0f86df244  home-mobile-390.jpg
709f4002d92b1c8cab9e64ac7700851c17eca349a466b923e0cbeac588006329  landing-desktop.jpg
e3fa06578495449967ded1432c2818814bbf813f4bceb9d257b5c21f7a22998b  landing-mobile-320.jpg
7118992a2ca9f7b356ad8e3ab7d53c73c11e964400d007a7276a786da8dcf5f5  landing-mobile-390.jpg
```
