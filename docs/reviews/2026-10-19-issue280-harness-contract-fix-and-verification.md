# #280 시험 하네스 ref·상태 계약 수정 및 검증

- 사용자 지시: PR #270 완료 유지. #280의 시험 하네스만 실제 ref·상태 계약에 맞게 수정하고 중복 저장·완료 후 재진입·언마운트 후 이동 방지를 검증. 앱 코드·Rules 수정과 병합·배포 금지.
- 기준 main `a4d55436fee851f2b66f1ae86a62dcdeb21dcadf`, 별도 작업 브랜치 `codex-issue280-test-contract-20261019`.
- 코드 커밋 `92a7e4fcd58f030e265759613e0197e1d02f0f23`: 변경은 **frontend/test/haruLawSave.test.cjs 한 파일(+97/−7)** 뿐이다. 앱 소스·서비스·Rules·워크플로·환경변수 정의·의존성·Functions 변경 없음.
- 이전 [원인 점검](https://github.com/hkd620-lab/haru2026/blob/fb57651a/docs/reviews/2026-10-19-issue280-save-test-root-cause-audit.md)의 전역 진단값 주입으로 시험을 통과시키지 않았다.

## 하네스 수정

1. 실제 useHaruLaw의 lawSaveRef/lawSaveMountedRef 선언 및 useEffect 정리 구간을 기존 방식대로 추출해 실행한다. 하네스 인스턴스마다 별도의 ref와 effect 정리 함수를 만든다. 앱의 guard/cleanup 코드는 바꾸지 않았다.
2. context에 lawSaved 현재 값과 위 ref를 제공한다. setter는 관측 가능한 대기 상태를 갱신한다. rerender()는 최신 날짜·saving·saved 상태를 새 콜백 closure에 전달하되 ref는 그대로 유지한다.
3. unmount()는 앱에서 추출한 실제 effect cleanup을 호출한다. 테스트에서 mounted ref를 수동으로 false로 만들어 앱 cleanup의 결함을 가리지 않는다.
4. 기존 날짜·기록 병합·오류 안내·입력 보존·재시도 단언은 유지했다. 원인에 관계없는 Rules 시험과 #281은 수정하지 않았다.

## 사용자 요청 동작 검증

| 동작 | 시험으로 확인한 결과 |
|---|---|
| 중복 저장 | 기존 시험 강화. 첫 조회를 대기시킨 상태에서 재렌더 전·후에 다시 호출해도 조회1회/쓰기0회. 해제 후 전체 호출 완료 시 조회1회/쓰기1회·이동1회, 성공 전 표시 없음, finally 잠금 해제 |
| 완료 후 재진입 | 실제 성공 → rerender → 다시 호출해도 조회/쓰기/이동 증가 없음. 실제 날짜 입력 onChange로 saved 초기화 → rerender 뒤 변경한 날짜 id/date로 두 번째 저장 가능 |
| 언마운트 후 이동 방지 | 쓰기가 시작돼 대기 중일 때 실제 cleanup 실행 → 쓰기 완료 후 navigate0회·잠금 해제. 새 하네스 인스턴스는 정상 이동해 수명 상태가 공유되지 않음 |

React DOM/실기기를 마운트한 시험은 아니다. 원문에서 추출한 콜백·ref 초기화·effect 정리를 경량 하네스에서 실행하며 rerender를 명시적으로 모델링한다. 실제 운영 저장·AI 호출·Rules 권한 행렬까지 검증한 것으로 확대하지 않는다.

## 실행 검증

- `cd frontend && node test/haruLawSave.test.cjs`: **12통과·0실패·1skip(총13)**, exit0. 전역 진단 주입·preload 없이 실행했다. 기존10개 실행 시험 유지 + 신규2개, 기존 중복저장 시험 강화.
- 실행 환경에서 FIRESTORE_EMULATOR_HOST·HARULAW_BASELINE_RULES를 제거해 Rules 시험1개는 skip. 로컬 에뮬레이터/변경전 baseline을 준비하거나 Rules를 수정하지 않았다.
- `node --import tsx --test test/haruLawError.test.mjs test/haruLawAttachmentCleanup.test.mjs`: 2파일 통과, 실패0.
- `node test/lawEasyExplain.policy.test.cjs`: 통과.
- `npm run build`: 기본/AI_LIBRARY Firebase 더미12변수, **exit0·34.98초**. 로컬 Node v26.8.2, 운영 환경 설정·Node20 CI 실행 증거가 아니다. 기존 번들크기/Browserslist 경고는 그대로다.
- `git diff --check` 통과. main 대비 코드 diff가 시험1개뿐임을 확인했다.

[검증 로그·명령 메타데이터](2026-10-19-issue280-harness-contract-evidence/). 로그는 최초 보존 전 줄끝 공백만 정리했다.

## 회귀 검출력 확인 — 앱 파일 수정 없음

별도 진단 프로세스의 fs.readFileSync 반환 문자열에서만 앱 조건을 한 번씩 무효화했다. 디스크의 앱 파일은 수정하지 않았다. 원본 앱으로는12통과/0실패/1skip, 각 변이에서는 **11통과/1실패/1skip, 취소0, exit1**이었다.

| 메모리 변이 | 실패한 시험 |
|---|---|
| 저장 진입의 lawSaveRef 가드 제거 | 중복 저장 시험 |
| 저장 진입의 lawSaved 가드 제거 | 완료 후 재진입·날짜 변경 시험 |
| lawSaveMountedRef 이동 가드를 항상 true로 변경 | 언마운트 시험 |
| effect cleanup의 mounted=false 대입 제거 | 언마운트 시험 |

변이 실행기는 저장소 밖 /private/tmp에만 두었다. 실행 명령은 `HARU_CONTRACT_MUTANT=<lock|saved|mounted|cleanup> node --require /private/tmp/haru-issue280-fix-evidence-20261019/contract-mutants.cjs test/haruLawSave.test.cjs`이며 원본 시험·단언을 그대로 실행했다. 네 변이는 모두 검출됐다. 이 제한된 변이 확인을 전체 앱 결함 부재의 증명으로 확대하지 않는다.

## Git·리뷰·배포 상태

- 작업 브랜치에 시험 변경과 새 검증 기록을 커밋·push한다. main 병합·배포·이슈 close는 하지 않는다. #280은 OPEN, PR #270은 완료/MERGED 상태 유지.
- 현재 `.github/workflows/firebase-hosting-pull-request.yml`은 pull_request 이벤트에 build_and_preview를 실행하고 같은 저장소 PR에 action-hosting-deploy를 호출한다. **PR 생성만으로 프리뷰가 배포될 수 있으므로 이번 배포 금지를 지키기 위해 PR을 생성하지 않는다.** 워크플로를 임의 수정하거나 배포를 우회하지 않는다.
- PR CI·Codex 자동 PR 리뷰·독립 전체 완료 검토는 이번에 실행하지 않았으며 판정①이나 병합 승인을 선언하지 않는다. 구현·로컬 검증 결과와 정식 리뷰/CI 상태를 구분한다.
- 기준 원본 폴더 `/Users/heogyeongdae/Developer/HARU2026`의 codex-question-input-three-lines / 9fa88ead 기존 작업본은 그대로 보존했다.
- Firestore users/{uid}/records/{date}, Functions asia-northeast3, Rules·결제·인증·저장 서비스·AI 호출 변경 없음. 운영 데이터 읽기/쓰기·삭제·AI 실행 없음. 추가 P3/#281 작업 없음.

이번 요청 범위의 시험 하네스 수정·로컬 검증은 완료하며, 미병합 상태와 Rules1skip·미실행 리뷰/CI는 남는다.

작업 난이도: **5.5 중간**.
