# 독립 Claude 검토 실행 2 — 최초 검토 후 첫 재검토

검토 대상 HEAD: `bd981bc8275c635e380205c1aeaeb95fc6f4508b`

기록시각(UTC): 2026-10-27T04:59:02.622522+00:00

총 독립 검토는 2회(최초 1회, 재검토 1회)다. 요청/결과의 ‘재검토 2’는 전체 실행번호 2를 뜻한다. 누락된 중간 독립 검토는 없다. CC 후속 수정 세션은 실행자이며 독립 검토가 아니다. ‘수정 후 승인’ 판정 횟수는 1회다. 원문은 아래에 그대로 보존한다.

## 질문 원문

독립 Claude 재검토 2 요청. 저장소 /Users/heogyeongdae/Developer/HARU2026, 브랜치 codex-record-title-save, 검토 대상 HEAD bd981bc8, 기준 main 0df59145. 실행자의 대화 맥락은 제공하지 않습니다. AGENTS.md와 docs/HARU2026_Slack_운영정책.md 8.1 준수, 파일 수정 금지, 숨김 LibraryPage 점검 금지, 별도 에이전트 생성 금지.
반드시 docs/reviews/2026-10-27-record-title-save/01-independent-review.md의 질문·결과 원문을 먼저 읽으세요. 이전 판정 원문은 '수정 후 승인'이며 비용 증가/옛 제목 필수 정책 변경 멈춤 지적이 있었습니다.
CC 반영 내역: ① 대기 중 제목 외 본문 변경 시 저장/이동0 및 재시도 안내 ② 무관 공백 원복 ③ photoEditorSessionRef 세션으로 닫기/기록변경 뒤 늦은 응답 저장 차단, 새 세션 잠금 보호 ④ 잘못된 타입 title fallback, AI 전송 앞600자 ⑤ Codex 추가 지적에 따라 사진/메타/선택작물/성장대상(생일·성별)/recordStyle도 대기 중 변경하면 같은 재시도 안내. 코드는 git diff origin/main..bd981bc8로 직접 확인하세요. 기존 검토 기록은 새 파일로만 추가됐고 수정하지 않았습니다.
검증 근거: node --import tsx --test test/originalSaveAutoTitle.test.mjs test/polishCommentOptOut.test.mjs test/formatPolishRequest.test.mjs test/writeBeforeFormat.test.mjs test/photoSelectionRoutes.test.mjs test/recordPhotoPolicy.test.mjs test/formatRegistry.test.mjs test/statsStorage.policy.test.cjs → 57/57 (신규16+기존41). npm run build exit0(환경파일 부재로 VITE_FIREBASE_*6개 임시 합성 환경 사용, 실서비스 E2E아님). git diff --check 통과. 기존 formatPhotoUploadResult의 fixture 실패는 범위밖. 테스트 실행 가능.
요청: 이전 필수 수정과 추가 입력/세션 경합 해결 여부, 새 결함 여부, 변경규모/멈춤조건 확인. 코드 변경에 대해 승인 / 수정 후 승인 / 재설계 중 판정하세요. 병합/운영완료 승인을 요청하지 않습니다. 유료 AI 호출 증가 및 2026-04-13 제목필수 정책 변경은 PR에 명시하고 허대표님께 이번 변경의 병합/웹 운영 배포 결정을 받을 예정입니다. PR #301 승인 승계 없음.


## 결과 원문

# 독립 Claude 재검토 2 결과: `bd981bc8` (기준 main `0df59145`)

**판정: 승인** (코드 변경 기준)

이 판정은 코드만 본 것이고, 병합이나 운영 완료를 승인하지 않습니다. 이 건은 8.1의 **멈춤 조건에 그대로 해당**합니다. 비용이 늘고, 2026-04-13 "제목 필수" 정책을 되돌리기 때문입니다. 그래서 판정①과 병합·배포는 허대표님이 결정한 뒤에만 진행할 수 있습니다.

## 0. 확인한 범위와 실측

- 위치·브랜치: `/Users/heogyeongdae/Developer/HARU2026`, `codex-record-title-save`, HEAD `bd981bc8`, 작업트리 clean. 파일은 수정하지 않았습니다. LibraryPage는 열지 않았고 에이전트도 만들지 않았습니다.
- 바뀐 파일(`git diff --stat origin/main..bd981bc8`): `FormatModal.tsx`(+55 −3), 새 테스트 파일 1개, `docs/reviews/.../01-independent-review.md`(새로 추가). `functions/`는 바뀐 줄이 0입니다. 저장 경로, 리전(`asia-northeast3`), 결제, 인증도 그대로입니다.
- 제가 실행한 검증:
  - 요청에 적힌 테스트 8개 파일: **57/57 통과**
  - `git diff --check origin/main..bd981bc8`: 통과
- `npm run build`는 돌리지 않았습니다. 빌드 결과물을 쓰기 때문이고, 실행자 로그(exit 0)를 근거로 둡니다. 덧붙여 `build`는 `vite build`뿐이라 타입 검사를 하지 않습니다. 이 환경에는 `tsc`도 없어서(exit 127) 타입 검사를 대신하지 못했습니다. 바뀐 줄을 직접 읽어 본 결과로는 타입 위험이 낮습니다.

## 1. 이전 필수 수정 반영 확인

| 이전 지적 | 결과 |
|---|---|
| 필수 1: 기다리는 동안 고친 본문이 조용히 사라짐 | ✅ 해결 |
| 필수 2: `= growthSubjects` 공백 변경 | ✅ 원래대로 돌아옴 |
| 권고 A: 화면 닫기·기록 변경 뒤 늦은 응답으로 저장·이동 | ✅ 반영 |
| 권고 B: 새 테스트가 CI에서 돌지 않음 | 그대로임 (아래 3-4) |
| 권고 C: 이모지 중간 자름 | 반영 안 됨 (사소함) |

**필수 1.** 저장 직전에 최신 `formData`를 비교하고, formData 밖의 입력도 비교합니다. 하나라도 바뀌었으면 저장하지 않고 다시 누르도록 안내합니다(`FormatModal.tsx:2984-2990`).

```ts
const changedWhileWaiting = originalSaveContextRef.current !== saveContext || Object.keys({ ...formData, ...latestFormData })
  .some(key => key !== `${prefix}_title` && (latestFormData[key] ?? '') !== (formData[key] ?? ''));
```

`dataToSave`(`:2937-2959`)에 들어가는 값은 모두 다음 세 가지 중 하나입니다.
- `formData`
- `getOriginalSaveContext`(`:2891`)가 담는 `recordStyle`, `uploadedImages`, 사진 정보, `selectedCrops`, `getGrowthSaveFields()`(생일·성별 포함)
- 형식마다 고정된 `fields`, `DIARY_PREMIUM_FIELDS`

그래서 비교에서 빠진 입력은 없습니다(Codex 추가 지적 ⑤도 해결). 회귀 테스트도 있습니다: 본문을 고치면 저장 0·안내 1·다시 누르면 고친 본문으로 저장(`:199`), 다른 입력 6가지가 바뀌는 경우(`:313`), 다시 그려져도 값이 같으면 정상 저장(`:339`).

**필수 2.** `:1052`이 원래대로 돌아왔습니다. diff에 해당 줄 변경이 없습니다.

**권고 A.** 동작은 이렇습니다.
- `photoEditorSessionRef`는 `[isOpen, format, recordId]`가 바뀌거나 화면이 사라질 때 1씩 올라갑니다(`:490-494`).
- 응답을 받은 뒤 세션 번호가 다르면 저장·이동 없이 끝냅니다(`:2982`).
- `finally`는 자기 세션의 잠금일 때만 풉니다(`:3013-3016`).

테스트 `:241`이 두 경우를 확인합니다. ① 세션만 바뀌면 저장 0, 이동 0, 잠금 정리. ② 새 세션이 저장 중이면 옛 응답이 새 세션의 잠금과 저장 중 표시를 풀지 않음.

**④ 응답 형식.** 문자열이 아닌 `title`은 첫 줄 제목으로 대신합니다(`:2975-2976`, 테스트 `:287`). AI에는 앞 600자만 보냅니다(테스트 `:298`).

## 2. 새 결함

**병합을 막는 결함은 없습니다.**

추가로 본 부분:
- **잘못된 "내용이 바뀜" 판정 가능성:** 비동기로 `setFormData`를 부르는 곳(`:1595` OCR, `:1618` 주식, `:1884` 장부, `:3119-3221` 독서)은 모두 자동 제목 대상이 아닌 형식입니다. 일반 기록에서 사용자 입력 없이 내용이 바뀌었다고 잘못 판정할 경로는 찾지 못했습니다.
- **선언 순서:** `canAutoTitleOnOriginalSave`(`:1051`)가 쓰는 `prefix`·`sayuKey`·`isStockFormat`는 `:1040-1045`에서 먼저 선언됩니다. 실행 중 선언 전 사용 오류(TDZ)는 없습니다.

## 3. 권고 (병합을 막지 않음)

1. **화면을 떠나면 아무 안내 없이 저장되지 않음.** 저장을 누른 뒤 10초 안에 뒤로가기나 탭 이동을 하면 `:2982`에서 조용히 끝납니다. 사용자가 고른 이동을 따르는 것이 맞으므로 지금 설계는 받아들일 만합니다. 다만 "저장을 눌렀는데 기록이 없다"는 문의가 생길 수 있으니 PR의 남은 위험에 적어 주세요.
2. **다시 누르면 유료 호출이 한 번 더 남.** 안내 후 다시 누르면 `extractTitle`을 또 부릅니다. 받은 `autoTitle`을 같은 세션에서 다시 쓰면 아낄 수 있습니다. 비용 설명에 이 경우도 함께 적기를 권합니다.
3. **텃밭일지 프리미엄의 첫 줄 제목.** 본문 맨 앞에 `작물: …` 줄이 붙어서(`:2927-2928`), AI가 실패하면 제목이 "작물: 상추, 토마토"가 됩니다. 사소한 문제입니다.
4. **CI 미연결(이전 권고 B).** 새 테스트가 여전히 `package.json` 테스트 스크립트에 연결돼 있지 않습니다. 8.1 판정 조건 2에 따라 실행 로그를 PR에 꼭 첨부해 주세요.

## 4. 변경 규모와 멈춤 조건

- **규모: 중규모.** 컴포넌트 동작을 고친 것이고 코드 파일은 1개입니다. 홈화면·라우터·새 기능에 해당하지 않습니다.
- **멈춤 조건: 해당합니다.** 8.1의 "새 AI 호출 추가 등 비용이 늘어나는 변경"입니다.
  - 제목 없이 원본 저장할 때마다 `gpt-6-luna`를 1회 호출합니다. 서버 `extractTitle`(`functions/src/index.ts:2575`)에는 월별 한도가 없습니다. 위 권고 2의 경우에는 호출이 한 번 더 늘어납니다.
  - `frontend/.claude/CLAUDE.md`의 "✅ 제목 입력 필수. AI 자동생성 제거됨 (2026-04-13 변경)"을 새 일반 기록에 한해 되돌립니다.
- **커밋 메시지:** "fix: … 자동 제목 추출 연결"은 실제 동작과 다르지 않습니다. 다만 정책을 되돌리는 변경이므로 PR 본문에 그 점을 꼭 적어 주세요.

## 5. 기록 관련 확인

- 저장소의 `docs/reviews/2026-10-27-record-title-save/`에는 **`01-independent-review.md` 하나만** 있습니다.
  - 이번 요청은 "재검토 2"인데, 중간의 재검토 1 원문이 없습니다.
  - 재검토 1이 실제로 있었다면 그 질문·결과 원문을 새 파일로 추가해야 하고, "수정 후 승인" 횟수에도 넣어야 합니다.
  - 지금 저장소 기준으로 "수정 후 승인"은 1회입니다.
- 이번 결과도 새 파일(예: `02-…`)로만 추가해 주세요.
- Codex 색인 파일은 PR을 만든 뒤 8.1 형식에 맞춰 추가해야 합니다.
- **판정①에 아직 필요한 것:** 최신 HEAD에서 CI 통과, `bd981bc8` 이후 HEAD에 대한 Codex 재검토 완료, 그리고 멈춤 조건에 따른 허대표님 결정. PR #301의 승인은 이어받지 않습니다.
