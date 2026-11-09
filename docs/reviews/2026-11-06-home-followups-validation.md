# 홈 후속 수정 검증 기록 — 2026-11-06

## 범위와 근거

허대표님 직접 지시: “그럼 기장이 할 수 있는 일은 진행하고, 내가 확인할 것은 하나씩 안내해줘.” 이어서 연결된 삼성 S21 직접 확인을 요청하고 HARU에 로그인했다고 회신했다.

- CC 인계: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1793960245034969
- 독서 회차 유지 결정: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1793960071180399
- 기준 main `d5c28c23d1fa9c323ac2c32dc2f8bbc0c037b89b`, 기존 PR351 병합 및 Hosting 실행 42200434210 SUCCESS를 GitHub/Slack에서 대조했다.
- 실행 기장(Codex). 이번 변경의 병합·운영 배포는 수행하지 않는다. 독립 검토 승인을 대신하는 문서가 아니다.

## 구현

- Firebase 인증 uid 변화를 구독해 로그인 상태가 늦게 맞춰져도 조회를 시작한다. 불일치 시 이전 값은 숨기고 오류/재시도를 제공한다.
- live region을 첫 응답 전에 마운트하고 0건 전환에도 유지한다.
- 받은 날짜 문자열의 한 자리 일을 정규화하며 존재하지 않는 날짜는 제외한다. 월 자체가 패딩되지 않아 서버 쿼리 밖에 있는 문서와 Timestamp 날짜를 새로 조회/마이그레이션하지 않는다.
- SAYU의 선택 기록 누락 시 추가 조회를 전체 목록에서 문서 하나로 변경했다. 페이지의 기존 기본 목록 조회는 유지하므로 전체 SAYU 읽기 비용이 1건이 됐다는 뜻이 아니다. 화면/계정 변경 뒤 응답·오류는 무시하고 안내를 일반 기록에 맞췄다.
- 기존 실패 테스트는 PR344의 작성 중 글 전달 분기와 RecordFormatPicker 추출을 반영하지 못했다. 실제 홈 클릭 핸들러를 11종·글 유무·사용자 유무로 실행해 전달값을 검사하도록 수정했다. 제품 코드를 과거 동작으로 되돌리지 않았다.
- 환불정책 닫기는 직전 앱 화면으로 돌아가고 직접 방문은 홈으로 이동한다. 대표님은 기존 이용 기간 보장 문구와 환불정책 직접 링크도 추가 승인했다. SettingsPage의 기존 설명과 대조했으며 환불 정책·결제 로직은 변경하지 않는다.
- 320px 가격 줄바꿈과 OG 기본 메타데이터를 보완했다. 확정 공유 이미지의 색·파일은 유지한다.

## 검증 결과

- 수정 전 `node --import tsx --test test/devConsoleCleanup.test.mjs`: 10/11, 기존 홈 카드 전달 검사 실패 재현.
- 수정 후 `node --import tsx --test test/monthProgress.test.mjs test/devConsoleCleanup.test.mjs test/homeRecordComposer.test.mjs test/sayuEditedTitle.test.mjs test/sayuAssistantAdapters.test.mjs test/sayuDirectRecord.test.mjs`: **69/69**.
- `shareImageMeta.policy.test.cjs`, `subscriptionDisplay.policy.test.cjs`, `sayuMobileReadingUx.policy.test.cjs`: 모두 통과.
- `npm run build`: 통과. 운영 비밀값 없이 합성 Firebase 환경값을 프로세스에만 제공했다. 배포용 빌드가 아니다. 기존 청크/빌드 성능 경고는 남는다.
- `git diff --check`: 통과.
- `test/month-progress-browser/build.mjs`로 생성한 실제 React 브라우저 검사, 320×844: **16/16**. 인증 불일치·지연 후 일치·계정 변경·재시도·언마운트·live region 유지·카드 가로 넘침·환불 닫기 3경로·가격 한 줄 표시를 확인했다.
- 타입 검사는 미실행(기존 프런트 typescript 미설치). 의존성 추가 없음.

## 기존 운영판의 삼성 S21 확인

Galaxy S21(SM-G991N), Chrome, `https://haru2026.com`, 2026-11-06 KST. 사용자 로그인 뒤 기장이 직접 탐색했다.

1. 홈: 이번 달 6편, 최근 3행, 기간 표시. 화면 캡처에서 카드 내부 가로 넘침 없음.
2. 첫 독서사유 행: 해당 날짜·책의 이어쓰기 회차 SAYU가 열림. 모든 행/모든 형식을 열었다고 확대하지 않는다.
3. 전체 14가지 배지. 비서실 전체 보기 → HARU주식관리 → 열기 → 주식거래일지 작성 모달(제목·거래유형·종목명 입력칸) 확인.
4. 기록 입력·저장·삭제, AI 호출, 결제, 비서 선택 저장은 하지 않았다. 새 후속 코드를 운영에서 확인한 결과와 구분한다.

스크린샷은 UUID `06827F85-BF9F-465C-9C30-E39085839975` 확인 후 LaCie 새 폴더에 저장하고 재열어 확인했다. 개인 기록 제목이 있으므로 GitHub/Slack에 이미지와 제목·본문을 첨부하지 않는다.

- 로컬 보관: `/Volumes/LaCie/Mac_작업/스크린샷/HARU2026/20261106_S21_기장_1927/01-home.png`
- SHA-256: `99a9b7ef1d90a38c35d2993b9d01cdb92fd21cf0b19ddb56bb4323c9954f2806`

## 남은 항목

- 코드 리뷰·최종 CI·독립 Claude 검토 후 대표님 병합/배포 결정. 현재 CLI `claude auth status`는 `loggedIn:false`; 독립 검토를 수행하거나 통과했다고 보고하지 않는다.
- Firebase 읽기량/전송량 측정과 2단계 필요성, 카카오 실제 공유 카드 확인.
- 제목 20자 뒤 `…`, 로그인 소개의 11가지 기록 형식·14가지 AI 비서는 대표님이 이 채팅에서 확정하여 반영했다. 하루LAW는 기존 도움받기 영역에 소개하기로 승인되어 반영했다. 추천 주식 비서는 결정 대기다. 해지 후 이용 기간 안내·환불정책 직접 링크는 이 채팅에서 추가 승인되어 반영했다.
- Functions 리전 `asia-northeast3`, Firestore `users/{uid}/records`, Rules/인덱스/환경변수 설정/결제·인증 정책/AI 호출 변경 없음. 변경은 기존 로그인 상태를 읽는 UI 구독과 웹 표시·읽기 경로에 한정한다.
