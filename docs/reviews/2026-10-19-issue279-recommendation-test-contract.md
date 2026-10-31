# #279 추천 시험 누락 단언 보강

## 범위와 현재 판정

- 허대표님의 새 대화 지시 “계속하자”에 따라 직전 안내의 **추천 시험 누락 단언 보강**만 수행했다.
- 기준 main: `4433a043265359f4446a5ffac9d93e942c50464c`. 작업 브랜치: `codex-issue279-test-contract` (원격의 `codex` 브랜치와 경로 충돌하여 슬래시 대신 하이픈 사용).
- 원래 Developer 작업본의 `codex-question-input-three-lines`와 깨끗한 상태를 보존하고 별도 임시 클론에서 작업했다.
- **시험 보강·로컬 검증 완료 / 정식 검토·PR·병합·배포 미진행**. 자동 검토 체계의 판정① 또는 #279 전체 완료를 주장하지 않는다.
- 선행 근거: [인수인계](https://github.com/hkd620-lab/haru2026/blob/02a6643f/docs/reviews/2026-10-19-remaining-work-closeout-and-p3-triage.md), [#279](https://github.com/hkd620-lab/haru2026/issues/279). 기존 검토 기록 원문은 수정하지 않았다.

## 변경 내용

`frontend/test/assistantRecommendations.test.mjs`에 시험 4개를 추가했다.

1. `불안감소`, `걱정스럽다고`, `걱정돼요요` 각각 추천 없음과 유효한 `소송`이 함께 있을 때 법률 후보만 유지함을 직접 단언한다.
2. 법률 강한 단어 2개와 생활 강한 단어 1개 + 약한 단어 2·3·4개를 비교한다. 6 대 5, 6 대 6, 6 대 7의 순위와 동점 시 양쪽 형식 우선순위를 검증한다.

점수는 공개 반환값에 없으므로 가중치 단언은 **3:1 비율의 관찰 가능한 동작**을 고정한다. 두 가중치를 같은 배수로 바꿔 결과가 같아지는 경우까지 구별하는 절대 수치 시험은 아니다. 이를 위해 앱 코드에 점수 노출이나 테스트 전용 export를 추가하지 않았다.

## 검증

- 환경: Node `v26.8.2`, macOS arm64. 기존 시험 36개 통과를 먼저 확인했다.
- `cd frontend && node --import tsx --test test/assistantRecommendations.test.mjs test/formatRegistry.test.mjs`: **47 pass / 0 fail / 0 skip** (추천 40개 + 등록부 7개).
- `cd frontend && npm run build`: **exit 0**, PWA 산출물 생성 완료. Firebase 6개 필수 환경변수에 합성 placeholder를 사용한 로컬 컴파일 검증이며 운영 연결·E2E 검증이 아니다.
- lockfile이 동일한 기존 임시 작업본의 node_modules를 임시 심볼릭 링크로 재사용했다. 의존성·lockfile 변경 없음. 링크는 검증 후 제거했다.
- build 경고: Browserslist 데이터 갱신 안내, Node module.register deprecation, 번들·정적/동적 import 관련 경고. 이번 시험 수정 범위에서는 변경하지 않았다.
- `git diff --check`: 통과. 최종 앱 소스 diff 없음.

### 회귀 변이 검증

격리 작업본의 추천 소스를 한 번에 하나씩 변경하고 아래 명령에서 해당 신규 시험의 AssertionError·exit 1을 확인한 뒤 원문으로 복원했다.

```text
cd frontend
node --import tsx --test --test-name-pattern '<해당 신규 시험 제목>' test/assistantRecommendations.test.mjs
```

| 단일 진단 변이 | 결과 |
| --- | --- |
| 강한 가중치 3 → 2 | 새 가중치 비율 시험이 검출 |
| 강한 가중치 3 → 4 | 새 가중치 비율 시험이 검출 |
| 약한 가중치 1 → 0 | 새 가중치 비율 시험이 검출 |
| 약한 가중치 1 → 2 | 새 가중치 비율 시험이 검출 |
| 불안감소를 허용 활용형에 추가 | 해당 새 차단 시험이 검출 |
| 걱정스럽다고를 허용 활용형에 추가 | 해당 새 차단 시험이 검출 |
| 걱정돼요요를 허용 활용형에 추가 | 해당 새 차단 시험이 검출 |

복원 후 위 47개 시험을 다시 실행해 모두 통과했다. 변이와 빌드 산출물은 커밋하지 않는다.

## 남은 일과 다음 첫 행동

- #279는 OPEN 유지. 장문 계산 비용 계측·개선 범위와 추천 정책 선택은 미착수 후속 범위다.
- 이 브랜치는 시험·증거를 보존하기 위한 push까지만 한다. PR 생성에 따른 프리뷰 배포도 이번에는 수행하지 않는다.
- 정식 Codex PR 검토·독립 Claude 검토·CI는 미실행. 기존 PR270의 수정 후 승인 누적 1회 이력은 초기화하지 않는다.
- Firestore `users/{uid}/records/{date}`, Functions `asia-northeast3`, Rules·결제·인증·추천 정책·어휘·호출량 변경 없음. AI 호출·운영 데이터 변경·Hosting/Functions/Rules 배포 없음.
- 다음 첫 행동: 이 브랜치의 diff와 검증 근거를 확인한 후 PR·프리뷰 및 정식 검토 진행 범위를 확정한다. 성능 개선이나 추천 정책 변경으로 자동 확대하지 않는다.

작업 난이도: **5.5 중간**.
