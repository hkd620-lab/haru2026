# iPhone SAYU 검색 후 확대 현상 최소 수정 준비

- 기준 main: `5ac06e853b2062d0e20b860096c99e97916adf41` (PR342 병합·운영 배포 완료).
- 실기기 관찰: iPhone16e Safari에서 SAYU 결과 검색 입력에 초점을 둔 뒤 페이지가 확대되며 오른쪽 일부가 보이지 않았다. 초점 전 화면과 초점 후 화면 차이를 확인했다.
- 원인 가설: 검색 입력 fontSize 14px에 따른 Safari 입력 초점 확대. 수정은 해당 입력 한 곳을 16px로 올리는 한 줄이다. 사용자 확대 금지나 viewport 조작은 하지 않는다.
- 실기기 확대 해소 재검증은 미완료. 수정 완료·운영 해결로 판정하지 않는다.
- 검증: `git diff --check` 통과. `node --import tsx --test test/haruLawAnswer.test.mjs test/sayuAssistantAdapters.test.mjs` 11/11 통과. `npm run build` 통과(명시적 demo Firebase 환경값; 배포용 빌드 아님). 최초 빌드는 이 worktree에 Firebase 환경값이 없어 prebuild에서 중단되었고, 비밀값 없는 demo 값을 넣어 재실행했다.
- 범위: 웹 SAYU 검색 입력 표시만. Functions/Firestore/Storage Rules/경로/환경변수/결제/인증/모델 변경 없음. 기존 첨부·검색 데이터·저장 처리 변경 없음.
- CC 구현 위임을 먼저 시도했으나 CLI OAuth 만료(401)로 파일 읽기·수정 전에 종료했다. 실제 한 줄 변경은 사용자 요청에 따른 Codex가 수행했다. CC 구현 성공 또는 독립 승인으로 기록하지 않는다.
- 독립 Claude 승인 미확보, Codex PR 리뷰 확인 전. 이 문서는 승인 판정이 아니다. 병합·배포하지 않는다.
- 기존 가독성 개선 건의 수정 후 승인 횟수는 1회다. 앞선 검토 원문은 `2026-11-05-pr342-claude-c7d24009-raw.md`, 재검토 승인은 `2026-11-05-pr342-claude-bb8f14f3-raw.md`를 다음 검토자에게 함께 제공해야 한다.

## CC 실행 질문 원문

사용자가 PR342 병합·웹/lawSearch 배포 후 iPhone/PWA 검증과 발견 문제 수정 요청을 했다. 현재 PR342는 main5ac06e85에 배포되어 있고 이 worktree는 후속 최소 수정용이다. 먼저 pwd, branch, status, 적용 AGENTS/CLAUDE 및 HARU_작업위치.md를 확인하라. 구현 역할은 CC이다. Codex는 현재 실기기에서 SAYU 결과 검색 입력을 누르면 Safari가 확대하고 blur 이후에도 우측이 잘리는 모습을 관찰했다. 대상 frontend/src/app/pages/SayuPage.tsx의 aria-label=SAYU 결과 검색 input, fontSize:14만 16으로 올려 iOS 자동확대 유발을 피하도록 최소 수정하라. 다른 함수/레이아웃/데이터/설정은 수정하지 말라. 코드 변경만 수행하며 커밋/push/PR/배포/UI 제어를 하지 말라. 새 테스트나 기능을 만들지 말라. 파일을 수정한 다음 diff와 의도·실기기 재검증 한계를 보고하라. 이 작업은 기존 답변 가독성 개선의 운영 검증에서 발견한 입력 초점 확대 문제에 국한된다. 독립 승인을 스스로 하지 말라.

## CC 실행 결과 원문

```text
Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.
```

작업 난이도: 중간. PR342 운영 판정은 배포·PWA 완료, iPhone 추가 E2E 필요 상태를 유지한다.
