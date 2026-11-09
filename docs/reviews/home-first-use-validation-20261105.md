# 첫 기록 홈화면 구현·격리 검증 기록

- 날짜: 2026-11-05 KST
- PR: https://github.com/hkd620-lab/haru2026/pull/344
- 코드 검토 대상: `db48129791dd5c130d1eafffd5c72a53ef8d4641`
- 기준 main: `5ac06e853b2062d0e20b860096c99e97916adf41`
- 요구: 허대표님이 승인한 홈 시안을 실제 웹에 구현. 기록 형식 설명 및 작성 전후 선택, 비서 역할 확인 후 선택, 개발자 메뉴의 개발자 전용 표시.
- 상태: 작업 브랜치 구현·로컬 검증 및 초안 PR 생성. 운영 병합·배포·실기기 E2E 판정이 아니다.

## 구현 범위

홈 입력란 → 기록 형식 선택 → 기존 RecordPage → 기존 형식별 편집창 → 기존 저장 처리로 연결한다. 목록에서 먼저 형식을 선택하는 기존 동선도 유지한다. 홈에 글을 쓴 뒤 전체 형식 목록에서 골라도 원문이 전달된다.

12개 기록 형식의 쉬운 설명은 `recordFormatDescriptions.ts`에서 공통 사용한다. 비서 13종의 이름·경로·기존 설명·베타/숨김 조건은 HomePageV2의 기존 목록을 사용하고, 필요한 도움 문장과 역할 확인 창을 추가했다. 저장 경로·Functions 리전·Rules·인증/결제 정책·AI 호출·환경변수 정의 변경은 없다.

## 로컬 검증

- `cd frontend && npm run build`: 통과. 운영 Hosting 공개 Firebase 설정을 해당 빌드 프로세스에만 주입했으며 키 값이나 환경 파일을 저장·커밋하지 않았다. 기존 대형 청크·동적 import 경고는 유지된다.
- `node --import tsx --test test/writeBeforeFormat.test.mjs test/writingDraftLifecycle.test.mjs test/homeAssistantSelection.test.mjs`: 14/14 통과.
- `node test/authCallbackAndHomePersonalization.policy.test.cjs`: 통과.
- `git diff --check`: 통과.

## 격리 브라우저 확인

시험 환경: `frontend/test/home-assistants-browser/`의 실제 HomePageV2·RecordPage·BottomNav. 인증·Firestore·법률 hook·형식별 편집창·타임라인은 합성 경계로 치환한다. 운영 요청을 보내지 않는다. 형식별 실제 편집창의 내부 전체 기능은 이번 시험 범위가 아니다.

1. 320px·390px·데스크톱: 화면 폭과 내용 폭 일치. 작은 화면에서도 형식 설명과 비서 설명 노출.
2. 작성 전 반려동물 선택 → 홈 작성 → 실제 RecordPage → `애완동물관찰일지` 편집창 수신: `pet_simple`·`pet_space`에 원문 전달.
3. 홈에 글을 먼저 작성 → 작성 후 형식 설명 선택창 → 일기 → 실제 RecordPage → 합성 최종 저장: 기존 저장 처리에 `formats: ['일기']`와 본문 전달, 성공 뒤 초안 초기화.
4. 편집창 취소 → 원문 유지 → 다른 형식 메모 선택: 같은 초안 ID·원문 유지.
5. 홈 입력 뒤 전체 형식 목록 → 메모 선택: `memo_simple`·`memo_content`에 원문 유지.
6. 기존 계정 비서 역할 확인 → 가계부 담기: 기존 전자소송 선택과 `selectedRecordFormats: ['메모']` 유지. 열기 선택 시 `/household`로 연결.
7. 비서 선택 저장 실패: 오류 표시, 담기 상태 미변경. 빈 내 비서 목록에서도 역할별 둘러보기 가능.
8. 전체 보기에서 비서 카드 13개. 일반 이용자 상단·하단의 개발자 콘솔/AI 학습함 비노출. 개발자 UID 시나리오의 콘솔과 기존 검증된 개발자 이메일 시나리오의 AI 학습함 노출.

## 독립 검토 실행 원문

명령: `claude -p --permission-mode plan --tools Read,Grep,Glob --no-session-persistence` (stdin 대신 아래 프롬프트를 단일 인자로 전달). 수정 도구 없이 요청했다.

프롬프트 원문:

> 독립 설계·완료 검토를 수행하세요. 코드를 수정하지 마세요. 저장소 /private/tmp/haru-home-first-use-20261105, PR https://github.com/hkd620-lab/haru2026/pull/344, 검토 대상 HEAD db48129791dd5c130d1eafffd5c72a53ef8d4641 입니다. 근거는 PR 설명과 frontend/test/home-assistants-browser/README.md 및 frontend/test/writeBeforeFormat.test.mjs 입니다. 변경 파일을 읽고 홈의 기록 형식 작성 전후 선택, 실제 RecordPage 초안 연결 및 계정 경계, 비서 역할 확인 후 열기/선택 저장, 기존 개발자 메뉴 조건 유지에 재현 가능한 결함이 있는지 독립적으로 검토하세요. 승인/수정 후 승인/재설계 중 판정과 근거 파일·행을 작성하세요. 작업 규모와 Slack 정책 8.1 멈춤 조건도 검토하되 사용자가 이 채팅에서 홈화면 시안 구현 범위를 직접 승인했다는 사실을 적용하세요. 운영 배포는 아직 수행하지 않았습니다. 응답은 한국어로 작성하세요.

CLI 결과 원문(exit 1):

```text
Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.
```

독립 검토는 실행되지 않았으며 승인으로 처리하지 않는다. Claude 재인증 후 같은 코드 HEAD에 대한 검토가 필요하다. Codex PR 리뷰도 아직 결과가 확인되지 않았다.

## 근거 대조와 남은 범위

GitHub PR·커밋·Actions를 조회했고, 공개 Slack에서 2026-11-04 이후 홈 관련 기록을 검색했다. 이 작업과 일치하는 기존 검토·운영 완료 근거는 확인되지 않았다. 기록 부재를 실패로 판정하지 않는다. 이번 대화의 승인과 이번 PR의 구현·검증 범위만 보고한다. Slack 게시를 수행했다고 주장하지 않는다.

코드 HEAD의 [GitHub 빌드](https://github.com/hkd620-lab/haru2026/actions/runs/42027999021)와 Deploy Preview가 성공했다. [미리보기 배포 댓글](https://github.com/hkd620-lab/haru2026/pull/344#issuecomment-6658096675)의 대상은 `db48129`이며, [미리보기](https://haru2026-8abb8--pr344-codex-home-first-rec-asnj54wx.web.app)는 운영 live와 별개다.

독립 검토, 병합/Hosting 운영 반영, 실서비스 계정의 최종 저장·재열기는 별도 확인 사항이다. Functions·Rules 배포는 대상이 아니다. 되돌릴 때는 이 PR의 프론트 변경을 revert하여 기존 Hosting 절차로 배포하며 데이터 마이그레이션은 없다.
