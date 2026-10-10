# PR #274 보완 사이클 1 — CC 구현·검증 기록 (HEAD 9b19efe5)

- 작성 시각(UTC): 2026-10-10T09:00Z
- 대상: PR #274 작업 브랜치 `codex-question-input-three-lines` `5bb6758f14d81595c6132aca06cf1336382b3b98` → `9b19efe537180f9d85de935b3b52223a50a54ff8` (fast-forward push, 강제 push 없음, 기준 main `69c371cce46f39f8720283167c037d099fede7af`). GitHub PR 갱신 시각 08:52:23Z.
- 근거 지시: 허대표님 후속 지시(`2026-10-10-question-input-fix-cycle-1-instructions.md`), 독립 Claude 1회 지적 F1~F3·P3(`…-claude-independent-1-result.md`).
- 이 문서는 PR #274 보완·검증 증거다. 같은 시간대의 API 키 노출 보안 작업은 별도 건이며 Slack #haru2026-개발 스레드 `1791620246.004989`에 따로 기록했다(보안 세부는 공개 저장소에 두지 않는다).
- 병합·운영 배포는 이번 지시에 포함되지 않았고 실행하지 않았다.

## 1. 작업 방식
- PR 작업 브랜치의 HEAD `5bb6758f`를 별도 worktree(`cc-fix-274`)로 만들어 작업했다. 증거 브랜치(`claude/elegant-noether-z5zy29`)의 다른 앱 변경은 섞이지 않았다. push 직전 원격 PR 브랜치가 여전히 `5bb6758f`이고 로컬 브랜치가 그 후손임을 확인한 뒤 `git push origin cc-fix-274:refs/heads/codex-question-input-three-lines`로 올렸다.
- 한 변경당 한국어 커밋 1개, 파일은 개별 stage(`git add <파일>`), 커밋 전 `git diff --cached --name-only`로 포함 파일 확인. 수동 백업 파일 없음.
- 결과 편집기, 금지 파일(`routes.tsx`, `HaruRawPage.tsx`, `.zombie`), 기존 F-13~F-19, 저장·첨부·AI 호출 코드는 변경하지 않았다.

## 2. 변경 (4커밋)
| 커밋 | 지적 | 변경 파일 | 내용 |
|---|---|---|---|
| `1a1440b7` | F1 | `ResultChatModal.tsx` | Enter 핸들러가 `form.requestSubmit()` 대신 기존 `sendQuestion(question)`을 직접 호출. 빈 질문·진행 중·첨부 정리 중 가드는 `sendQuestion`이 처리 |
| `9f963f50` | F2 | `ResultChatModal.tsx`, `utils/questionEnterSubmit.ts`(신규), `test/questionEnterSubmit.test.mjs`(신규), `package.json`(스크립트 1줄) | `EnterSubmitGuard`로 Enter 판단 분리. 조합 중(compositionstart~end, `isComposing`, keyCode 229)은 그대로 두고, compositionend 직후 50ms 안의 Enter는 이벤트 timeStamp 차이로 확정 Enter로 보아 전송도 줄바꿈도 하지 않음. blur에서 조합 표시와 직전 종료 기록 해제 |
| `924087a1` | F3 | `FormatModal.tsx`(6곳), `DiaryLearnPage.tsx`(1곳), `test/questionInputs.policy.test.cjs`(신규), `package.json`(스크립트 1줄) | 시작 높이는 `rows=3` 유지, 변경 전 크기 조절이 가능했던 장문 작성칸 7곳만 `resize: 'vertical'` 복원. 질문칸 4곳은 3줄 고정(resize 없음) 유지 |
| `9b19efe5` | P3 | `PlantDetectivePage.tsx`, `test/questionInputs.policy.test.cjs` | 식물탐정 "오늘의 관찰" 자유 메모 `rows` 2→3 |

보호 시간 50ms를 정한 이유: 같은 키 입력에서 나온 두 이벤트의 간격(보통 한 자리 ms)보다 길고, 사람이 Enter를 두 번 누르는 간격(대개 수십~수백 ms)보다 짧게 잡았다. 첫 구현은 100ms였으나 빠른 이중 Enter가 막힐 수 있어 50ms로 줄였고 단위 시험 경계를 함께 고쳤다. 독립 검토자가 권한 `setTimeout(0)` 대신 timeStamp 방식을 택한 이유는 이벤트 순서나 핸들러 실행 지연과 무관하게 판단되고 단위 시험이 가능하기 때문이다.

## 3. P3 판별 (현재 라우터 `App.tsx`와 코드 기준)
기준: 운영 라우트에 있고, 사용자가 쓰는 칸이 (가) AI 비서에 묻는 질문이거나 (나) 저장되는 기록의 최초 작성 입력일 때만 3줄로 맞춘다. 수정 중인 기존 내용 편집기, 보조 메모, 위저드 설정, 체험·미리보기, 관리자 화면, 미사용 파일은 제외한다.

| 후보 | 위치 | 라우트·용도 | 결정 |
|---|---|---|---|
| 식물탐정 자유 메모 | `PlantDetectivePage` 3668행 | `/plant-detective`, "오늘의 관찰" 저장 폼. 같은 폼의 두 칸은 이미 3줄 | **3줄로 변경** |
| 접종 메모 | `PetHealthVaccinePage` 208행 | `/pet-health/vaccine`, 접종 기록의 보조 메모 | 제외 |
| 한 줄 기록 체험 | `AssistantOnboardingDetailPage` 167행 | `/onboarding/detail`, 저장되지 않는 체험 예시 | 제외 |
| 디자인 미리보기 | `GyeongdaePreviewPage` 699행, `OnyuPreviewPage` 645행 | `/gyeongdae-preview`, `/onyu-preview` | 제외 |
| 소설·전망 설정 입력 | `NovelStudio` 407·747·876~914·1198행 | `/novel-studio` 위저드 설정 입력(전망 직접 질문 479행만 이미 3줄로 변경됨) | 제외 |
| 전망 위저드 | `ProphecyFromRecord` 11곳 | `/record-prophecy` 단계별 답변 입력 | 제외 |
| 법률 메모 | `CourtDocumentHelperPage` 361·419행, `LegalCaseDetailPage` 594·955행, `LegalCasesPage` 416행 | 사건 메모·확인사항(보조 메모) | 제외 |
| 전자소송연습 | `LawsuitPracticePage` 1162·1320행 | `/lawsuit-practice/practice`, 서면 연습 입력(긴 서면용) | 제외 |
| 성장타임라인 사진 설명 | `GrowthTimelineDocumentModal` 476행 | 사진 캡션 | 제외 |
| 성경 예문·단어 메모 | `BiblePage` 3344·3365행 | `/bible` 학습 보조 메모 | 제외 |
| 댓글 | `SayuTogetherPage` 534행 | 함께 보기 댓글 | 제외 |
| 정보금고 | `VaultPage` 633행 | `/vault`는 `/settings`로 리다이렉트, 고정 정보 보관 | 제외 |
| 관리자·개발자 | `SettingsPage`, `TodayChargePublisherPage`, `KNewsPublisherPage`, `BookCreate`, `ElderBookPage`, `RecordBookPage`, `SnsStoryCreator` | `/admin/*`, `/book-create` 등 | 제외 |
| 미사용 파일 | `RecordModal`, `FormatModal_DEBUG`, `ExportModal` | 저장소 안 import 없음 | 제외 |
| 금지 파일 | `HaruRawPage` | AGENTS.md §4 수정 금지 | 제외 |
| 이미 3줄 | `PetHealthSymptomPage` 157행, `SayuHealthHospitalPage` 201행 등 | AI 증상 질문 등 | 변경 없음 |

## 4. 검증 (CC 직접 실행, 9b19efe5 기준)
- 오프라인 전체 시험: `frontend/test`의 에뮬레이터 불필요 파일 48개를 5bb6758f와 9b19efe5에서 각각 실행(`…-cc-repro-fix/alltests-*.txt`). 결과 집합이 같고 신규 시험 2개(`questionEnterSubmit.test.mjs` 11건, `questionInputs.policy.test.cjs`)만 추가돼 통과. node:test 합계 통과 219·실패 0. 실패 파일 2개(`haruLawSave.test.cjs`, `loginProviderStorage.policy.test.cjs`)는 기준 main 69c371cc에서도 같은 실패라 이번 변경과 무관하다.
- 정책 시험의 유효성: 5bb6758f의 소스에는 `requestSubmit` 단언에서, 보완 2번째 커밋 직후의 소스에는 장문 작성칸 `resize:vertical` 단언에서 각각 실패하는 것을 확인했다.
- 타입: `tsc --noEmit` 기준 main·5bb6758f와 같은 250건(모두 미사용 `ExportModal.tsx`), 신규 오류 0. `git diff --check 5bb6758f HEAD` 깨끗.
- 빌드: 더미 Firebase 변수 12개로 `vite build` 성공(1분 8초). 운영 환경 변수 빌드는 아니다.
- Chromium 시험 267/267(390px·1280px): 13개 입력칸 초기 3줄, 3줄 입력 무클리핑, 15줄·긴 문단 내부 스크롤, 높이 고정, 가로 넘침 없음, 값 보존, 작성칸 8곳 세로 확장, 질문칸 5곳 크기 고정(일기 상세 포함). 질문 폼: Enter 전송 1회·Shift+Enter 줄바꿈·여러 줄 전송·빈 입력/공백 가드·전송 버튼, `requestSubmit` 삭제 브라우저에서도 Enter 전송(오류 0), Chrome 순서·Safari 순서(keyCode 229) 전송 없음·기본 동작 유지, compositionend 직후 keyCode 13 Enter는 전송도 줄바꿈도 없음(기본 동작 차단), 50ms 이후 Enter 전송, compositionend 없는 고착 상태에서 Enter가 막히는 것을 재현한 뒤 blur로 풀리고 전송됨, CDP 실제 조합 중 Enter 전송 없음·확정 후 보호 시간 이후 전송. 입력칸 단위 시험이며 전체 화면은 아니다.
- CI: 9b19efe5의 `build_and_preview`(실행 38039390372, 08:52:29Z~08:54:25Z)와 `Deploy Preview` 모두 성공. CI는 빌드·프리뷰만 하고 단위 시험은 돌리지 않는다.

## 5. 재검토 요청 (정책 8.1)
- Codex 실행 3: PR 댓글 https://github.com/hkd620-lab/haru2026/pull/274#issuecomment-6095869878 (원문 `…-codex-3-request.md`). 독립 Claude 1회 지적 원문과 반영 내역, 수정 diff 요약을 전달했다.
- 독립 Claude 재검토: 1회차와 같은 독립 에이전트를 재개해 요청(원문 `…-claude-independent-2-request.md`, 2026-10-10T08:55:01Z). 읽기 전용.
- 8.1 적용: 독립 Claude 판정이 "승인"이고 최신 HEAD에 대한 Codex 재검토 지적이 해결되면 판정① 조건 중 검토 항목이 충족된다. 단 판정①이 있어도 병합은 허대표님 승인이 필요하다(이번 지시에 병합 불포함). "수정 후 승인"이 4회째가 되면 허대표님께 보고하고 멈춘다. 이번이 2회차 재검토다.
- 결과 원문은 별도 파일(`…-claude-independent-2-result.md`, `…-codex-3-result.md`)에 이어서 보존한다.

## 6. 남은 확인·위험
- 실기기 iOS 16+ Safari·Android 키보드의 한글 확정 Enter, iOS 13~15의 Enter, 로그인 후 전체 화면(프리뷰) E2E는 미확인이다.
- 독서장에 AI 참고 질문을 반영하면 텍스트가 끝에 붙어 3줄 창 밖에 있을 수 있다(스크롤 또는 창 확대로 확인). 이번 범위에서 스크롤 이동은 추가하지 않았다.
- 미반영 P3: 모바일 Enter 안내 문구·`enterKeyHint`, 전송 버튼 정렬, PR 제목의 "모든" 표현(본문의 범위·제외 목록으로 보완).
- 작성자 해석(작성칸까지 포함)에 대한 허대표님 확인은 아직 없다. 본문에 "확인 필요"로 명시했다.
