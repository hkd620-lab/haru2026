# #280 하루LAW 저장 시험 기존 실패 원인 점검

- 요청: PR #270 완료 상태 유지. 최신 main 확인 후 haruLawSave.test.cjs 하네스와 실제 구현 계약 대조. 추가 코드 수정·병합·배포 금지.
- 기준 main: `a4d55436fee851f2b66f1ae86a62dcdeb21dcadf` (원격 재조회 및 별도 clone fetch). PR #270은 MERGED 상태 유지.
- 점검 시각 UTC: 2026-10-18T15:10:45.339295+00:00
- **✅ 원인 점검 완료: 추출된 콜백의 실제 의존성 3개가 시험 하네스 context에서 누락됐다.** 원본 시험은 여전히 실패이며 #280 수정·해결·종료는 하지 않았다. 운영 저장 장애의 증거로 확대하지 않는다.

## 1. 위치와 보존

원본 `/Users/heogyeongdae/Developer/HARU2026`: codex-question-input-three-lines / 9fa88ead, 시작 시 깨끗. 원격 main a4d55436과 다른 기존 작업 브랜치이므로 전환/수정하지 않았다.

새 `/private/tmp/haru-issue280-audit-20261019` clone에서 a4d55436 detached HEAD로 시험·읽기를 수행했다. 기존 임시 node_modules 복사본을 symlink로 읽고 검증 종료 후 직접 만든 링크만 제거했다. 소스·시험 4파일을 Git HEAD blob과 바이트 비교해 동일함을 확인했다. 보고서 저장을 위해서만 `codex-issue280-save-test-audit-20261019` 증거 브랜치를 만들었다. 새 앱 개발·PR·배포 브랜치가 아니다.

## 2. 실제 구현과 하네스의 계약 불일치

[하네스 원문](https://github.com/hkd620-lab/haru2026/blob/a4d55436/frontend/test/haruLawSave.test.cjs#L13-L60)은 RecordPage와 HaruLawPanel 원문을 합친 뒤 콜백만 문자열로 잘라 esbuild 변환하고 `new Function(...Object.keys(context), ...)`로 실행한다. 이때 실제 React 훅의 바깥 lexical scope는 따라오지 않는다.

[실제 useHaruLaw](https://github.com/hkd620-lab/haru2026/blob/a4d55436/frontend/src/app/assistants/haruLaw/HaruLawPanel.tsx#L81-L88)에는 아래 3값이 정상 선언되어 있으나, 하네스 context(시험34~51행)에는 없다.

| 누락 의존성 | 실제 역할 | 실패 경로 |
|---|---|---|
| lawSaveRef = useRef(false) | 동기 중복 저장 잠금. 날짜 변경256행, 저장 진입263행, 시작291행, finally352행에서 참조 | 원본 대부분은 첫 guard에서 ReferenceError. 저장IO에 도달하기 전 실패 |
| lawSaved = useState(false)의 현재 값 | 성공 후 다시 저장하는 진입을 막음(263행) | ref만 제공하면 다음 guard에서 ReferenceError. 하네스 notice()에는 lawSaved를 따로 주지만 run() context에는 제공하지 않음 |
| lawSaveMountedRef = useRef(true) | unmount 시 false로 바꾸어 저장 뒤 navigate 방지(83~87행,324행) | 앞의 두 값만 제공하면 저장 성공 뒤 이 참조에서 오류. catch가 unknown/saveRecord 오류로 바꿔 재시도 성공 후 error=null 단언2건 실패 |

현재 `firestoreService.saveRecord`446~463행은 명시id/date 경로, merge:true, recordId 반환 계약이다. 콜백은 선택 날짜의 기존 문서를 읽고 형식/content/환경값을 보존해 해당 id/date로 저장한다. ref가 없는 원본 시험은 이 동작의 정상/실패 판정을 할 단계 이전에 멈춘다.

실제 앱은 useHaruLaw 호출의 closure로 위 값들을 캡처한다. 시험의 누락 변수가 실제 앱에도 미선언된다는 근거는 없다. 이 점검에서는 실제 React mount/unmount나 운영 Firestore 저장을 실행하지 않았다.

## 3. 최신 main 재현과 통제 진단

Node v26.8.2. FIRESTORE_EMULATOR_HOST와 HARULAW_BASELINE_RULES를 실행 환경에서 제거했다. 비에뮬레이터 시험의 Firestore IO는 기존 시험의 mock이며, 운영 연결·AI호출·저장/삭제는 하지 않았다.

원본 명령: `cd frontend && node test/haruLawSave.test.cjs`.

| 실행 | 주입한 실행 프로세스의 진단 값 | pass / fail / skip | 결과 |
|---|---|---|---|
| 원본 main 시험 | 없음 | 2 / 8 / 1 | exit1, lawSaveRef 미정의. 중복재시도 시험의 saving=false 단언과 후속 unhandledRejection도 같은 진입전 오류에서 발생 |
| 진단1 | lawSaveRef.current=false | 3 / 7 / 1 | exit1, 다음 누락 lawSaved 미정의 노출 |
| 진단2 | 위 값 + lawSaved=false | 8 / 2 / 1 | exit1, 저장 성공 후 lawSaveMountedRef 미정의가 catch로 흡수돼 재시도2건의 error=null 단언 실패 |
| 진단3 | 위 값 + lawSaveMountedRef.current=true | 10 / 0 / 1 | exit0, 기존 비에뮬레이터10개 단언 그대로 통과 |

**진단3은 원본 시험 수정/수리나 운영 저장 정상 증명이 아니다.** 실행당 공유 global 값으로 누락 의존성만 분리한 실험이다. 실제 훅의 인스턴스별 ref·rerender·saved=true guard·unmount 효과를 모델링하지 않는다. 모든 단언과 저장 콜백은 원문 그대로 실행했고, 소스/시험 파일을 바꾸지 않았다.

진단 preload는 저장소 밖 `/private/tmp/haru-issue280-evidence-20261019/inject-context-diagnostic.cjs`에만 만들었다. 저장소에는 실행 코드를 추가하지 않고 핵심 원문을 아래에 기록한다.

```javascript
const stage = Number(process.env.HARU_AUDIT_INJECT_STAGE || 0);
if (stage >= 1) globalThis.lawSaveRef = { current: false };
if (stage >= 2) globalThis.lawSaved = false;
if (stage >= 3) globalThis.lawSaveMountedRef = { current: true };
globalThis.fetch = () => { throw new Error('diagnostic network access forbidden'); };
```

단계별 명령은 `HARU_AUDIT_INJECT_STAGE=N node --require /private/tmp/haru-issue280-evidence-20261019/inject-context-diagnostic.cjs test/haruLawSave.test.cjs`이며 emulator 변수는 제거했다. [기준로그·진단로그·메타데이터](2026-10-19-issue280-save-test-cause-evidence/). 최초 보존 시 로그 줄끝 공백만 정리했다.

## 4. 변경 이력 대조

`a52e5f75ff184e8c25530ceb562fa9d244a56914` (2026-10-06 13:01:50 +09:00, 비서 저장 결과를 정확한 SAYU 상세로 연결)은 당시 RecordPage에 동기 ref잠금·mounted ref·lawSaved guard를 추가했다. 같은 커밋의 haruLawSave.test.cjs diff는 없고, parent의 context도 세 값이 없다. 이후 P4a `70ad95d5`가 상태/콜백을 HaruLawPanel로 옮겼으며 시험은 파일을 합쳐 추출하지만 context 누락은 남았다.

이는 원문 diff로 확인한 계약 변화와 하네스 미반영의 이력이며, 과거 모든 커밋을 실행해 최초 bad commit을 이분탐색한 결과는 아니다. PR #270 merge가 바꾼 파일에는 이 시험·저장 훅·saveRecord 서비스가 없음을 diff로 확인했다. PR #270 완료 상태는 유지한다.

## 5. skip된 Rules 시험의 별도 선행조건

시험247~257행은 FIRESTORE_EMULATOR_HOST가 없으면 skip한다. 실행하려면 127.0.0.1 또는 localhost의 Firestore 에뮬레이터와 변경 전 Rules baseline이 필요하다. HARULAW_BASELINE_RULES 파일 또는 정확한 이전 기준 ref를 명시해야 한다.

현재 main Rules에는 missing-document get 절이 이미1회 들어 있다. 현재 Rules에서 그 절을 제거한 결과를 같은 현재 main Rules와 비교하면 불일치하므로, origin/main이 같은 Rules를 가리키는 상태에서 기본 baseline만 믿으면 선행 단언을 통과하지 못한다. 이는 읽기/문자열 비교로 확인한 환경 전제이며 에뮬레이터·Rules 권한 행렬을 실행한 결과가 아니다. 이번에 에뮬레이터 시작·Rules 수정·운영 Rules 배포는 하지 않았다.

## 6. 다음 허용 범위 제안 — 미실행

수정이 별도로 허용된다면 앱 guard를 삭제할 것이 아니라 시험 하네스에 인스턴스별 ref와 lawSaved 상태를 실제 계약에 맞게 제공하는 범위가 우선이다. 이후 다음을 의미 있게 검증해야 한다.

- 동시 두 번 호출 시 읽기/쓰기 한 번과 finally 잠금 해제.
- saved=true 재진입 차단, 날짜 변경 시 성공/오류 상태 초기화.
- mounted=false에서 성공 저장 뒤 navigate를 하지 않는지 확인.
- 조회/저장 오류의 안전한 안내·입력 보존·재시도, 선택 날짜/기존 기록 merge 유지.
- Rules 시험은 올바른 변경전 baseline과 격리 로컬 에뮬레이터를 준비한 뒤 별도 수행.

이 목록은 수정/새 시험 작성/Rules·인증 변경/배포 승인이 아니다. 이번에는 #281/P3로 확대하지 않았고 #280을 close하지 않는다.

## 결과와 한계

**원인 점검은 완료, 수리는 미실행.** 원본 시험은2통과/8실패/1skip 그대로다. 실제 운영 저장 정상/장애는 이번 점검으로 확정하지 않는다. 추가 앱·시험코드 수정·병합·배포·운영 AI/데이터변경 없음. 원본 작업 폴더 보존, 새 증거 문서/로그만 별도 브랜치에 추가한다.

작업 난이도: **5.5 중간**.
