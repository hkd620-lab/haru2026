# PR #274 CC 최종 의견 2 — HEAD 9fa88ead (3회차 재검토 후)

- 작성 시각(UTC): 2026-10-10T09:29Z
- 대상: PR #274 작업 브랜치 `codex-question-input-three-lines` HEAD `9fa88eada5b4dafec1ab2950d95f22119cae073c`, 기준 main `69c371cce46f39f8720283167c037d099fede7af` (PR은 초안 상태)
- 앞선 CC 의견은 `2026-10-10-question-input-cc-opinion.md`(5bb6758f 시점)이며 고치지 않았다. 이 파일은 그 뒤 두 번의 보완 사이클과 재검토 결과를 반영한 최종 의견이다.
- PR 검토·보완 증거다. 같은 시간대의 별도 보안 건은 Slack의 해당 스레드에만 기록했고 세부를 이 공개 저장소에 두지 않는다.
- 병합·운영 배포는 실행하지 않았다(이번 지시에 포함되지 않음).

## 1. CC 의견
**코드·시험 기준으로 승인한다.** 근거는 다음과 같다.
- 독립 Claude 3회차가 "승인 (코드·시험 기준)"을 냈다(`2026-10-10-question-input-claude-independent-3-result.md`). 1회차 F1~F3·P3, 2회차 N1~N3를 모두 해결로 확인했고, 새 지적은 P3 3건뿐이다.
- Codex 실행 4가 9fa88ead에서 "Didn't find any major issues"(`2026-10-10-question-input-codex-4-result.md`, 색인 `…-codex-index-4.md`).
- 최신 HEAD CI 성공: `build_and_preview` 실행 38040743250(09:15:29Z~09:17:29Z), `Deploy Preview`(09:17:09Z~09:17:27Z) 모두 success.
- CC 직접 검증은 `2026-10-10-question-input-cc-fix-cycle-2.md`와 PR 댓글의 필수 검증 로그에 있다. 이번 3회차 중 독립 검토자가 따로 재현한 결과(N1 시각 역전 구간 −2.6~−100ms, 변이 66개 중 60개 사망·생존 6개는 T1~T3, 오프라인 시험·tsc·빌드)도 CC 결과와 어긋나지 않는다. node:test 합계는 CC 228, 검토자 225로 달랐다. 검토자는 원인 미확인이라 했고 파일별 결과 집합은 같다. CC도 원인은 추적하지 않았다.

이 의견은 허대표님이 정할 사항(아래 4절)을 대신하지 않는다.

## 2. 정책 8.1 적용
| 항목 | 상태 |
|---|---|
| 독립 Claude 판정 | 1회차 수정 후 승인(5bb6758f) → 2회차 수정 후 승인(9b19efe5) → 3회차 **승인**(9fa88ead). "수정 후 승인" 누적 2회, 상한(3회 초과) 해당 없음. "재설계" 없음, CC가 지적을 거부한 적 없음 |
| Codex | 실행 3(9b19efe5) 지적 없음, 실행 4(9fa88ead) 지적 없음. 실행 1의 P2 2건은 e4ff864e 기준 해결(실행 2) |
| CI(최신 HEAD) | 성공(위 1절) |
| 필수 검증 로그(판정① 2항) | PR #274 댓글로 첨부 |
| 멈춤 조건 | 해당 없음. 저장 경로·Rules·결제·인증·모델·AI 호출·라우터·홈 불변(독립 검토자 확인 포함). 단 정책이 AI에게 맡기지 않는 "실기기 운영 E2E가 완료 조건인 작업의 운영 완료 판정"은 이 PR에도 적용된다 |
| 판정① | 4조건(CI·필수 검증 로그·Codex 지적 해결·독립 "승인")이 9fa88ead에서 충족됨을 기록한다. 병합 가능 선언이나 운영 완료 판정이 아니다 |
| 병합·배포 | 하지 않았다. 정책 8.1의 병합·배포 승인 범위는 2026-10-07 해당 CC 세션 한정이라 이 세션은 이어받지 않으며, 이번 지시에도 포함되지 않았다. 허대표님 확인 후에만 진행 |

## 3. 새 지적 T1~T3에 대한 CC 의견
- **T1 (P3)**: 타당하다. 정책 시험이 호출 문자열만 확인해 핸들러를 `onKeyUp`·`onKeyPress`로 옮겨도 통과한다. 최소 수정은 검토자 제안 그대로 `/onKeyDown=\{\(event\) => \{\s*handleQuestionEnterKeyDown\(questionEnterGuard, event,/` 확인을 `frontend/test/questionInputs.policy.test.cjs`에 더하는 것이다.
- **T2 (P3)**: 타당하다. `ENTER_AFTER_COMPOSITION_GUARD_MS`를 50→25로 바꿔도 시험이 통과한다. `frontend/test/questionEnterSubmit.test.mjs`에 `assert.equal(ENTER_AFTER_COMPOSITION_GUARD_MS, 50)`을 더하면 된다.
- **T3 (P3, 선택)**: 공통 질문칸·간편 작성칸 `onChange`와 식물탐정 `maxLength` 삭제 변이가 살아남는다. 가치는 낮지만 수용한다.
- **처리**: 이번 HEAD에는 넣지 않았다. 지적을 거부하는 것이 아니라 시기를 미룬다. 이유는 (1) 3회차 판정이 "승인"이라 수정 요구가 아니다, (2) 시험만 바꾸더라도 push하면 새 HEAD가 되어 Codex·독립 재검토를 다시 받아야 하고 판정① 기준 HEAD가 바뀐다, (3) 대표님의 CC 업무 보류 안내(Slack, 2026-10-13까지)가 있어 추가 사이클을 시작하지 않는다. 다음에 이 PR의 파일을 바꾸는 push가 있으면 T1·T2(필요하면 T3)를 함께 넣고, 그때 8.1에 따라 재검토를 받는다.

## 4. 허대표님 결정·확인이 필요한 사항
1. **범위 해석**: 허대표님 지시는 "질문칸만 수정"이었고, 작성자는 범위 질문에 답을 받지 못한 채 장문 작성칸(독서 현재 본문, 간편 작성, 보조장부 메모 2곳, 독서장, 기록 형식 공통 상세 입력, 외국어일기, 식물탐정 자유 메모)까지 처음 3줄로 맞췄다(세로 크기 조절은 허용). 이 해석을 승인할지, 질문칸 4곳과 Enter 처리만 남기고 작성칸 변경을 되돌릴지 정해야 한다. 되돌리면 후속 커밋과 재검토가 필요하다.
2. **크기 조절 제거**: 독서 AI 질문칸·하루LAW 질문칸은 변경 전 세로 크기 조절이 가능했으나 이 PR이 없앴다. 승인하거나 두 칸만 `resize: vertical`로 복원한다.
3. **실기기 확인**: iOS 16+ Safari·Android 키보드의 한글 확정 Enter(compositionend와 Enter가 50ms 안에 오면 첫 Enter가 무시될 수 있음), iOS 13~15 Enter, 로그인 후 전체 화면. CC 세션에서는 프리뷰 URL에 접근할 수 없어 확인하지 못했다. 운영 완료 판정은 AI가 대신할 수 없다.

## 5. 남은 항목
- 미반영 P3: T1~T3, 모바일 소프트 키보드 안내 문구·`enterKeyHint`, 전송 버튼 정렬, PR 제목의 "모든" 표현.
- 알려진 제한: 독서장에 AI 참고 질문을 반영하면 텍스트가 끝에 붙어 3줄 창 밖에 있을 수 있다(스크롤 또는 창 확대로 확인).
- 이 PR과 무관한 기존 실패: `haruLawSave.test.cjs`, `loginProviderStorage.policy.test.cjs`(기준 main에서도 같은 실패, 하루LAW 저장 시험 8실패는 별도).

## 6. 증거 목록(증거 브랜치 `claude/elegant-noether-z5zy29`, `docs/reviews/`, 모두 새 파일 추가)
- 요청 원문: `…-cc-request.md`, `…-claude-independent-{1,2,3}-request.md`, `…-codex-{3,4}-request.md`, `…-fix-cycle-1-instructions.md`
- 결과 원문: `…-claude-independent-{1,2,3}-result.md`, `…-codex-{3,4}-result.md`, 색인 `…-codex-index-{3,4}.md`
- CC 기록: `…-cc-opinion.md`, `…-cc-opinion-2.md`(이 파일), `…-cc-fix-cycle-{1,2}.md`, 재현 도구·결과 `…-cc-repro/`, `…-cc-repro-fix/`, `…-cc-repro-fix2/`
- 이 증거 브랜치의 앱 코드는 오래되어 PR #274에 섞지 않았고 main에도 병합하지 않는다.
