# PR #365 독립 Claude 검토 1차 기록과 CC 반영 내역

- 작성: CC 실행자 (2026-11-09). 검토자 질문·결과 원문은 저장소 밖에 따로 남지 않으므로 `raw/`에 원문 파일을 그대로 보존한다(8.1).
- 이 파일은 기록과 반영 내역일 뿐 승인이 아니다. CC는 자기 작업을 승인하지 않는다. 재검토는 다른 세션의 독립 검토자가 하며, 아래 1차 판정 원문과 3절 반영 내역을 함께 넘긴다.

## 1. 실행 정보 (원문: `raw/haru-memory-independent-first.meta.json`)

| 항목 | 값 |
|---|---|
| 검토 대상 | PR #365, HEAD `89fa9644f75cfaf28667f7ce04229603ea2e781c` |
| 시작 / 종료 | `2026-11-09T05:08:58.790617+00:00` / `2026-11-09T05:11:11.776879+00:00` |
| exit | 0 (stderr `raw/haru-memory-independent-first.err.log` 0바이트) |
| 실행 방식 | `claude -p --permission-mode plan`. 허용 도구는 Read·Glob·Grep와 읽기 전용 git/gh/cat/rg/ls, 그리고 `scheduledNotificationCore` 시험. Edit·Write·NotebookEdit는 금지 |
| 질문 원문 | `raw/haru-memory-independent-first.prompt.txt` |
| 결과 원문 | `raw/haru-memory-independent-first.raw.json`의 `result` |

## 2. 판정 원문 (요약하지 않고 인용)

> **판정: 수정 후 승인.** 코드 1줄은 그대로 승인합니다. 고칠 것은 근거 문서 보완뿐이고, 코드 수정은 필요 없습니다. 운영 배포에는 허대표님 비용 승인이 따로 필요합니다(8.1 멈춤 조건).

필수 수정 원문(결과 원문 "필수 수정 (문서만)" 절):

> 1. **README가 미실행 상태로 남아 있음.** … root가 실행한 결과를 새 파일이나 PR 본문으로 연결해 주세요. README 자체는 고치지 않는 원칙대로 둡니다. 실패한 첫 실행(exit 2)과 재실행 통과를 둘 다 원문 그대로 보존해야 합니다.
> 2. **재발 가능성 명시.** … 259MiB의 대부분은 커다란 `index.js` 모듈 전체를 시작할 때 불러오기 때문으로 보입니다(pdfkit·sharp 등을 바로 불러옴). 이는 추정이라고 표기해 주세요. … 512MiB는 약 2배 여유지만, 충분한지는 배포 후 실측해야 확정됩니다.
> 3. **원인 범위 한정 유지.** … 과거 미수신 전체의 원인으로 단정하지 않는다는 문구를 PR 본문에도 유지해 주세요.

전체 원문(확인 근거·비용·규모·멈춤 조건·범위 밖 관찰·배포 후 운영 확인)은 `raw/haru-memory-independent-first.raw.json`에 있다. 같은 건의 "수정 후 승인"은 이번이 **1회째**다(3회 상한).

### 2.1 검토자 실행 중 권한 거부·부수 동작 (원문 그대로 보존)

- 검토자는 검토 결과를 `/Users/heogyeongdae/.claude/plans/claude-precious-willow.md`에 쓰려 했다. 이 셸 명령은 권한이 거부되어 실행되지 않았다(`permission_denials` 1건). 검토 결과는 `result`에만 있다.
- 검토자는 결과에서 `git fetch origin`을 1회 실행해 원격 추적 ref만 갱신했다고 스스로 밝혔다. 파일 변경은 없었다고 적었다.

### 2.2 검토자 지적 이력 — 현재 새 근거와 구분

- 검토자의 근거 중 "`git log -L` 결과, 함수 본문은 2026-04-27(`171de7e2`) 이후 바뀐 적이 없습니다. 9월에 배포된 버전과 같은 본문이 다시 올라갑니다"는 **1차 검토자가 확인해 적은 지적 이력**이다.
- 이 문서 보완 실행에서 CC가 다시 확인한 새 근거가 아니다. 이번 보완의 새 근거는 `SUPPLEMENT-1.md` 1절의 root 실행 결과(빌드·시험·endpoint 비교)뿐이다. 둘을 섞어 인용하지 않는다.
- 범위 밖 관찰(`request.data`가 비어 있을 때 구조분해 500 가능, 기존 동작이라 변경하지 않음)도 지적 이력으로만 보존한다. 이번에 수정하지 않는다.

## 3. CC 반영 내역 (코드 변경 없음)

| 필수 수정 | 반영 위치 | 반영 내용 |
|---|---|---|
| 1. 미실행 → root 실행 결과 연결, 실패·통과 원문 보존 | `SUPPLEMENT-1.md` 1절, `raw/` | 1차 runner 4단계(0·1·2 성공, 3 exit 2 usage 실패) 원문과 재실행 verify 결과 원문을 보존했다. 함께 기록한 것: baseline `92535da2` 한계(`functions/src` diff 0, `package.json`·lock 차이), metadata `null`과 운영 실측의 구분. README는 수정하지 않았다 |
| 2. 재발 가능성·추정 표기 | `SUPPLEMENT-1.md` 2절, PR 본문 | 전역 모듈 로드 원인은 "추정"으로 표기했다. 9월 이후 main 코드·의존성이 함께 배포된다는 점, 512MiB 충분성·정확한 청구액·시작 peak가 미측정이라는 점, CPU 1·timeout 60 유지와 배포 후 gcloud 확인 계획을 적었다 |
| 3. 원인 범위 한정 | `SUPPLEMENT-1.md` 3절, PR 본문 | 1회 OOM 한정 문구를 유지했다. 과거 전체 원인은 단정하지 않는다고 적었다 |

- 커밋 범위: `docs/reviews/2026-11-09-iphone-push-memory/` 아래 새 파일 추가만 한다. `git diff --name-status 89fa9644..HEAD`의 모든 항목이 `A docs/reviews/…`인지 커밋 후 확인한다.
- 하지 않은 것: 코드 변경, README 수정, ready·merge·배포, Slack 게시, 실기기·운영 함수 호출, 자기 승인.
