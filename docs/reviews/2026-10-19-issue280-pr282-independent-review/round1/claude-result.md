## 독립 설계·완료 검토 결과 — PR #282 (#280 시험 하네스 정합성 복구)

**판정: 승인**

이 승인은 독립 Claude 검토 범위에만 해당합니다. Codex 자동 리뷰, PR CI 통과, 판정①, main 병합, 운영 배포 승인을 대신하지 않습니다.

### 직접 확인한 범위와 확인하지 못한 것
- **직접 확인함 (Read/Glob/Grep):**
  - `test.diff`와 시험 파일 전체
  - `HaruLawPanel.tsx`의 82–88 및 255–355(ref·effect·두 핸들러), 609–619(날짜 입력), 863–895(재시도·저장 버튼)
  - `RecordPage.tsx`의 174–178 및 227–228
  - 검증 기록, evidence 디렉터리 로그·메타데이터, PR 본문, 운영정책 8.1
- **확인하지 못함:**
  - GitHub의 PR #282 실제 상태, CI, 프리뷰 배포 여부, Codex 리뷰. 네트워크를 쓰지 않았습니다.
  - 시험·빌드 재실행. Bash를 쓰지 않았으므로 결과는 저장된 로그로만 대조했습니다.
  - 저장소 밖 변이 실행기 `/private/tmp/haru-issue280-fix-evidence-20261019/contract-mutants.cjs`. 읽기 권한이 거부되어 내용을 보지 못했습니다.

### 근거

**1. 추출한 콜백에 실제 계약을 제공하는지 → 타당함**
- **인스턴스별 ref:** `saveRefsSource`(test:23)가 잘라내는 구간은 `HaruLawPanel.tsx:82–87` 원문과 같습니다. 즉 두 `useRef`와 실제 `useEffect`(setup은 `mounted=true`, cleanup은 `mounted=false`)를 그대로 실행합니다. 이 문자열은 HaruLawPanel에만 있고, RecordPage는 구조분해(228)만 하므로 엉뚱한 곳이 잘리지 않습니다. 하네스를 만들 때마다 ref 객체와 `cleanups`가 새로 생깁니다(test:36–41).
- **최신 state closure:** `rerender()`(test:67–72)는 setter가 기록한 상태로 context를 갱신하고 핸들러를 다시 만들되 ref는 유지합니다. setter가 기존 closure 값을 바꾸지 않으므로 React의 오래된 closure 동작과도 맞습니다.
- **실제 cleanup:** `unmount()`(test:78)는 앱에서 추출한 cleanup만 호출합니다. 시험이 ref를 직접 false로 만들지 않습니다.
- **구간 경계가 깨질 경우:** `indexOf`가 -1이 되면 변환이나 `new Function` 단계에서 오류가 나 시험이 실패합니다. 조용히 통과하는 구조가 아닙니다.

**2. 동작 검증 → 앱 계약과 일치함**
- **중복 저장 (test:251–278):**
  - `beforeRender`는 오래된 closure, `afterRender`는 `isSavingLaw=true` closure로 호출합니다. 앱 핸들러(263)는 `isSavingLaw`를 보지 않으므로 두 경우 모두 `lawSaveRef`만이 막습니다. 이 가드를 정확히 겨냥한 시험입니다.
  - 조회 1회·쓰기 0회 → 1회, 이동 1회(openRecordId 포함), finally에서 잠금 해제까지 확인합니다.
  - lock 변이 로그에서 `actual: 3`이 나와, 두 closure가 모두 IO를 시작한다는 점이 드러납니다.
- **완료 후 재진입과 날짜 변경 (test:280–309):**
  - rerender 후 `lawSaved=true` 가드(263)로 재진입을 막습니다.
  - 실제 JSX `onChange` → `handleLawSaveDateChange`(255–260)로 saved와 error가 초기화된 뒤에만 새 날짜의 id/date로 두 번째 저장이 됩니다. 앱 흐름과 같습니다.
- **언마운트 (test:311–335):** 쓰기가 대기 중일 때 cleanup을 실행하면 navigate 0회, 잠금은 해제됩니다. 앱 324행의 가드를 검증합니다.
- **변이 결과:** mounted·cleanup 변이 로그의 `actual: [Array]`와 `actual: true`가 해당 단언의 실패와 맞습니다.

**3. 기존 단언 약화 → 없음**
- diff상 기존 단언은 하나도 삭제되거나 완화되지 않았습니다.
- `state.saving/saved`를 override 값으로 초기화한 변경(test:35)은 rerender의 `Object.assign`이 `isSavingLaw:true` 시험(114–129)을 덮어쓰지 않게 하는 정합성 보완입니다.
- `run`을 wrapper로 바꿨지만 rerender가 없는 기존 시험에서는 동작이 같습니다.

**4. 한계 표현 → 정확함**
다음 내용이 검증 기록 23, 28, 31, 47행과 PR 본문 9–12, 22행에 과장 없이 적혀 있습니다.
- 변이 4개는 메모리에서만 적용했고, 이 확인을 전체 결함 부재로 확대하지 않음
- Rules 시험 1개는 skip이며 권한 검증 완료로 해석하지 않음
- 로컬 Node26 빌드이며 CI(Node20)는 아님
- React DOM 마운트·운영 E2E는 아님

`target-tests.log`(12/0/1)와 `contract-mutants.json`(각 11/1/1, exit 1)은 이 서술과 일치합니다.

**5. 범위·되돌림 → 준수함**
- `code-scope.txt`와 diff 기준으로 코드 변경은 `frontend/test/haruLawSave.test.cjs` 하나입니다. 앱·Rules·워크플로 변경은 없습니다.
- 되돌림 방법(커밋 92a7e4fc를 별도 되돌림 커밋으로 취소)은 적절하고, 운영 코드에는 영향이 없습니다.

### 발견사항 (모두 P3, 승인을 막지 않음)
1. **[P3] 인스턴스 독립성 단언이 약함** — `frontend/test/haruLawSave.test.cjs:331–334`
   - `other` 하네스는 `h`가 언마운트된 뒤에 만들어지고, mount effect가 `mounted=true`를 다시 설정합니다. 그래서 ref가 모듈 단위로 공유되는 결함이 있어도 이 단언은 통과합니다.
   - 독립성은 하네스 구조(호출마다 fake `useRef`)와 React `useRef`의 의미로 보장되는 것이지, 이 단언이 증명하는 것이 아닙니다.
   - 검증 기록 21행의 "수명 상태가 공유되지 않음"은 "새 인스턴스가 정상 이동함" 정도로 읽는 것이 정확합니다.
2. **[P3] 검증 기록의 배포·PR 서술이 현재 상태보다 오래됨** — `docs/reviews/2026-10-19-issue280-harness-contract-fix-and-verification.md:3, 52`
   - 기록에는 "배포 금지… PR을 생성하지 않는다"고 되어 있지만, 실제로는 초안 PR #282가 있고 프리뷰가 허용됐습니다.
   - PR 본문 17행에 사유가 적혀 있으므로, 기존 파일을 고치기보다 필요하면 새 기록을 추가해 보완하는 정도면 충분합니다.
3. **[P3] 변이 실행기를 독립적으로 확인할 수 없음** — 실행기가 저장소 밖에 있어 이번 검토에서 열람하지 못했습니다(권한 거부). 실패 메시지가 기대한 단언과 맞는다는 점으로만 간접 확인했습니다.

### 작업 규모·멈춤 조건·운영 E2E
- **작업 규모:** 소 (시험 하네스 1파일 + 검증 기록)
- **멈춤 조건:** 해당 없음. 모델 변경·저장 경로·Rules·인증/결제·AI 호출·라우터/홈화면·대규모 작업이 없고, 커밋 메시지와 실제 변경도 일치합니다.
- **운영 E2E:** 이번 PR의 완료 조건으로는 필요 없습니다. 앱 코드가 바뀌지 않았기 때문입니다. 다만 #280을 "실기기 저장 동작 운영 완료"로 닫으려면 실기기 운영 E2E가 따로 필요합니다(중복 탭, 저장 후 재저장 차단과 날짜 변경 후 재저장, 저장 중 화면 이탈 시 이동 없음). 이 판정은 멈춤 조건에 따라 허대표님 몫입니다. Rules 에뮬레이터 시험(현재 skip)도 별도로 실행해야 권한 검증을 주장할 수 있습니다.

판정①까지 남은 일은 최신 HEAD의 PR CI 통과와 Codex 재검토 완료·지적 해결입니다. 둘 다 이번 검토에서 확인하지 못했습니다.