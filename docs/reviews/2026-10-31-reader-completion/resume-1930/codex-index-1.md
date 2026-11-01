# PR #320 (#141 대체) Codex 검토 색인 1

- 원문 위치: GitHub PR 댓글과 리뷰. 부모가 받아 둔 사본은 `raw/reader141-codex-review1-comments.json`, `raw/reader141-codex-review2-comments.json`.
- 시작 시각 두 개는 사본 JSON에 없고 부모의 `control/resume-after-1930.md` 기록 값이다. 나머지는 사본 JSON에서 대조했다.
- 이 파일을 작성한 CC는 `gh` 호출이 권한 거부되어 GitHub를 직접 다시 조회하지 못했다.

## 실행별 색인

| 실행 | PR | 요청 | 요청 시각 | 검토 대상 HEAD | 시작 | 완료 | 결과 ID | 결과 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 옛 1 | #141 | 확인 불가 | 확인 불가 | **확인 불가, 추정하지 않음** | 확인 불가 | 없음. 검토 미수행 | issue comment `5547183930` (2026-09-04T22:31:12Z) | 사용량 제한으로 검토 못함 |
| 1 | #320 | [6541435609](https://github.com/hkd620-lab/haru2026/pull/320#issuecomment-6541435609) | 2026-10-31T09:00:11Z | `cc053f9fd25f454289aae01343a68cae08be537e` | 09:00:20.100986Z | 09:02:40.957483Z | [review 5722091709](https://github.com/hkd620-lab/haru2026/pull/320#pullrequestreview-5722091709) (09:02:38Z) | P2 지적 1건 |
| 2 | #320 | [6541711292](https://github.com/hkd620-lab/haru2026/pull/320#issuecomment-6541711292) | 2026-10-31T09:30:03Z | `c99f59d816abb3790759565aa34ed8b5b82c01c9` | 09:30:16.644493Z | 09:32:47.023557Z | [issue comment 6541736395](https://github.com/hkd620-lab/haru2026/pull/320#issuecomment-6541736395) (09:32:45Z) | "Didn't find any major issues", 지적 없음. 별도 review ID 없음 |

### 옛 #141 실행 주의

- 근거는 부모의 `raw/reader141-node22-prompt.txt`와 `raw/reader141-resume1930-prompt.txt` 기재이며, 댓글 원문 사본은 control에 없다. 형식상 링크는 https://github.com/hkd620-lab/haru2026/pull/141#issuecomment-5547183930 이지만 이번 실행에서 열어 보지 못했다.
- 과거 승인이나 검토 완료 근거로 쓰지 않는다.

## 지적별 색인

| 제목 | 심각도 | 원문 | 위치 | 대상 커밋 | 반영 커밋 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| 오디오 잠금 해제 이후에도 요청 취소 여부를 확인하세요 | P2 | [discussion_r4431176372](https://github.com/hkd620-lab/haru2026/pull/320#discussion_r4431176372) | `frontend/src/app/pages/BiblePage.tsx:1215` (cc053f9f 기준) | `cc053f9f` | `c99f59d8` | 수정 커밋 반영, 실행 2에서 새 지적 없음. **독립 검토자 확인 전** |

- 반영 내용: `resume()` 뒤 요청 번호 재확인, `play()` 뒤 재확인과 `pause()`, 300ms 재시도 시작 전 재확인, 재시도 동안 로딩 유지.
- 회귀 시험: `test:bible-grammar` 13·14·15번 (`node22-followup/logs/07-frontend-bible-grammar.log`).
- 재시도의 두 번째 `play()` 대기 중 팝업을 닫는 경우는 남아 있다. `README.md`의 "남은 문제" 1번 참고.
- 요약 댓글 [6541437236](https://github.com/hkd620-lab/haru2026/pull/320#issuecomment-6541437236)의 `has_unresolved_findings: true`는 실행 2 뒤에도 유지된다. 부모 기록은 과거 스레드가 남아 있기 때문이라고 설명한다. 스레드 resolve는 해결 근거가 아니므로 8.1절대로 수정 커밋과 독립 검토 확인으로 판정한다.

## CI (`c99f59d8`)

원문 `raw/reader141-ci-c99f59d8.json`.

| 체크 | 결과 | 링크 |
| --- | --- | --- |
| `build_and_preview` | success, annotations 2건 (내용 미수집) | https://github.com/hkd620-lab/haru2026/actions/runs/41187067942/job/124496036110 |
| `Deploy Preview` | success | https://github.com/hkd620-lab/haru2026/runs/124496381331 |

이 증거 커밋이 올라가면 최신 HEAD가 바뀌므로, 8.1절의 Codex 재검토와 CI 대상은 부모가 새 HEAD로 다시 확인해야 한다.
