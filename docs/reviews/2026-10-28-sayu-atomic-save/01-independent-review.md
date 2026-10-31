# SAYU 원자 저장 독립 검토 1

- 대상 HEAD: edfb211b75ac8f12e79f79304485ab2090a0720c
- 판정 원문: 수정 후 승인 (1회차)
- 실행: Claude CLI 별도 세션, 읽기 전용 Read/Grep/Glob, permission-mode plan. exit 0.
- 정확한 시작·완료 시각은 확인 불가. 결과 확인: 2026-10-28 02:39 KST 무렵(정확한 시각 확인 불가).
- 질문의 브랜치는 codex/sayu-atomic-save였으나 원격 이름 충돌로 실행 중 codex-sayu-atomic-save로 변경. 대상 HEAD 동일.

## 질문 원문

```text
독립 설계·완료 검토 요청. 실행자 대화 맥락은 제공하지 않습니다. 파일 수정·추가 에이전트·Git 변경·Slack 게시 금지. Read/Grep/Glob만 사용하세요.
저장소: /Users/heogyeongdae/Developer/HARU2026. 브랜치 codex/sayu-atomic-save. 검토 HEAD edfb211b. 기준 main 601b7437.
AGENTS.md와 docs/HARU2026_Slack_운영정책.md 8.1을 읽고 변경 규모·멈춤 조건을 판정하세요. 숨김 LibraryPage 등 금지 대상 점검 금지.
사용자 요구: 제목 저장 성공 후 본문 저장 실패로 일부 변경만 남는 SAYU 일반 편집 저장 경로의 일관성을 보완하고 저장 실패 안내와 재시도를 점검. 기존 기록·사용자 제목·저장 경로·리전 보존. 이전 배포 승인 확대 금지.
변경 파일: frontend/src/app/components/SayuModal.tsx, frontend/src/app/pages/SayuPage.tsx, frontend/test/sayuEditedTitle.test.mjs, frontend/test/statsStorage.policy.test.cjs. 코드와 실제 저장 서비스의 필요한 부분만 확인하세요.
검증 증거: /private/tmp/haru-atomic-cc-output.txt(실행자 보고, 빌드 미완료 후 별도로 실행됨), /private/tmp/haru-atomic-build.log(합성 Firebase 환경값으로 npm run build exit0), /private/tmp/haru-atomic-baseline-tests.log 및 /private/tmp/haru-atomic-current-tests.log(main과 현재의 동일한 7개 기존 하네스 오류). 별도 핵심 테스트 node --test test/sayuEditedTitle.test.mjs 12/12 통과, statsStorage/sayuMobileReadingUx/snsStoryCreator 정책 테스트 통과.
설계·실패·재시도·공개본 처리·보존 조건·테스트 충분성을 검토하고 승인 / 수정 후 승인 / 재설계 중 하나로 판정하세요. 검증되지 않은 사실과 운영 E2E는 구분하세요. 최초 독립 검토이며 이전 판정은 없습니다. 병합·배포는 이번 범위에서 승인되지 않았습니다.
```

## 결과 원문

# 독립 설계·완료 검토 — SAYU 일반 편집의 원자 저장 (HEAD `edfb211b`, 기준 main `601b7437`)

**판정: 수정 후 승인**

설계 방향은 맞습니다. 다만 저장 실패 안내가 빠지는 경로가 1곳 있고, 검증 증거 설명 1곳이 사실과 다릅니다. 둘 다 고쳐야 승인할 수 있습니다.

Read·Grep만 썼고 git 명령은 실행하지 않았습니다. 그래서 커밋 diff와 main 원문을 직접 비교하지 못했습니다. 아래에서 "미검증"으로 표시한 항목이 그 때문입니다. 지시대로 파일 수정이 금지돼 있어 plan 파일도 만들지 않았습니다.

## 1. 규모·멈춤 조건

- **규모: 중규모(컴포넌트 저장 경로 수정).** 대규모가 아닙니다. 홈화면·라우터(`App.tsx`, `routes.tsx`)는 변경 파일 4개에 들어 있지 않습니다.
- **멈춤 조건: 해당 없음.**
  - 저장 경로는 그대로 `users/{uid}/records/{id}`이고, 실제 저장은 `firestoreService.updateRecord`의 `updateDoc` 한 번입니다.
  - Rules·Functions·리전·AI 호출·비용 변경이 없습니다.
  - 커밋 메시지 "SAYU 제목과 본문을 함께 저장"은 실제 변경과 일치합니다.
- `SayuModal`을 쓰는 곳은 `SayuPage.tsx:5375` 한 곳뿐입니다. `onSave`에 세 번째 인자가 추가돼도 다른 화면에는 영향이 없습니다.

## 2. 설계 검토 — 적절함

**원자성:** `updateRecord`는 null을 필드 삭제로 바꾼 뒤 `updateDoc`을 한 번만 호출합니다. `firestoreService.ts:853-872`:
```ts
if (value === null) processedData[key] = deleteField();
...
await updateDoc(recordRef, processedData);
```
`updateDoc`은 `specialDays.${formatKey}` 같은 점 표기를 맵의 하위 필드로 처리합니다. 따라서 제목·AI 제목 해제·날씨·기분·본문·특별한 날이 한 번에 반영되거나, 하나도 반영되지 않습니다. 모달이 따로 하던 `updateDoc`이 없어져 "제목만 저장되고 본문은 실패"하는 상황이 구조적으로 사라집니다.

**대상 일치 확인:** `SayuPage.tsx:2692`
```ts
if (!record || !formatKey || record.id !== meta.recordId || formatKey !== meta.formatKey) { toast.error(...); return false; }
```
`openFormatSayu`(2401-2402)는 `selectedDateFormats`에 지금 연 형식 하나만 넣습니다. 그래서 정상 흐름에서 이 검사가 저장을 잘못 막는 경우는 없습니다. 다른 기록을 덮어쓰지 않게 막는 안전장치로 적절합니다.

**실패·재시도:** 실패하면 `onSave`가 false를 돌려줍니다. 이때 `rememberSavedEdit`가 호출되지 않아 `savedDraftRef`가 그대로 남습니다. 그래서 다시 시도해도 `titleChanged`와 `clearAiTitle` 판정이 처음과 같게 나옵니다. 화면 목록(`setRecords`)은 원본 저장이 성공한 뒤에만 바뀝니다.

**공개본:** 원본 저장이 성공한 뒤에만 `publishRecordToShared`를 부릅니다(2752-2759). 공개본만 실패하면 경고를 띄우고 저장은 성공으로 처리합니다. 순서와 의미 모두 맞습니다. 다만 공개본을 다시 보내는 방법은 다시 저장하는 것뿐입니다. 이건 수용 가능한 수준입니다.

**보존 조건:**
- 제목을 바꾸지 않으면 AI 제목이 그대로 남습니다(테스트 110-117).
- 원문 `_simple`, `_ai_comment`, 다른 형식의 제목도 보존됩니다(테스트 101-104).
- 기분은 고른 경우에만 저장됩니다.
- 성장타임라인 저장 분기(`SayuModal.tsx:1373-1421`)는 따로 그대로 있습니다.

## 3. 필수 수정 (수정 후 승인 조건)

**① 저장 실패 안내가 빠지는 경로** — `SayuPage.tsx:2682`
```ts
if (!selectedDate) return false;   // toast 없음
```
모달은 `if (!saved) return;`으로 끝나고 자체 오류 표시도 없습니다(`SayuModal.tsx:1440`). 이 경로로 실패하면 사용자는 아무 안내 없이 버튼만 다시 눌리는 상태가 됩니다. `fetchRecords` 중 2641줄에서 `selectedDate`를 비우는 경우가 있어 실제로 생길 수 있는 경로입니다. "저장 실패 안내를 점검하라"는 요구에 바로 걸립니다.

제안:
```ts
if (!selectedDate) { toast.error('저장할 기록을 확인하지 못했습니다. 다시 열어 시도해주세요.'); return false; }
```
테스트도 하나 추가해야 합니다. `selectedDate: ''`일 때 쓰기 0회, 오류 1건, 초안 유지를 확인하는 테스트입니다.

**② 검증 증거 설명 정정**
"main과 현재의 동일한 7개 하네스 오류"라는 설명은 사실이 아닙니다.
- `baseline-tests.log`: `assistantSavedResultOpen` 1건만 `ReferenceError: isSpecialDayRecord`입니다. `sayuGrowthTimeline` 6건은 `SyntaxError: Unexpected token 'default'`(harness.mjs:110, `new Function` 단계)입니다.
- `current-tests.log`: 7건 모두 `ReferenceError`입니다.

실패한 테스트 이름과 개수는 같지만 원인이 다릅니다. 기준 환경에서 6건은 컴파일 단계에서 멈춰 `openFormatSayu`까지 가지 못했습니다. 그래서 기준 로그만으로는 이 6건의 ReferenceError가 원래부터 있었다고 직접 증명되지 않습니다.

그래도 이번 변경 때문에 생긴 회귀는 아니라고 봅니다. `SayuPage.tsx:65`에서 `isSpecialDayRecord`를 정상적으로 import하고 있고, 같은 `openFormatSayu`(2407)에서 나는 같은 오류가 main의 `assistantSavedResultOpen`에도 있습니다. 하네스가 이 import를 주입하지 않아서 생기는 문제로 보입니다.

판정 기록에는 "실패 7건(이름 동일). 기준은 SyntaxError 6 + ReferenceError 1, 현재는 ReferenceError 7. 기준 환경의 하네스 컴파일 차이로 보이며, 원인은 하네스가 import를 주입하지 않는 데 있음"처럼 정확히 적어야 합니다.

## 4. 권고 (차단 아님, 미검증)

- **main 원문 대조 필요 (사용자 제목 보존 요구):** 모달은 제목을 바꾸지 않아도 항상 `${formatKey}_title`에 `editedTitle.trim()`을 씁니다. 그런데 가계부는 처음 표시하는 제목이 `buildHouseholdSummaryTitle(record) || household_title`입니다(2470-2471). 그대로 저장하면 생성된 요약 제목이 `household_title`을 덮어쓸 수 있습니다. main의 옛 모달 `updateDoc`도 제목을 항상 썼다면 원래 있던 동작이라 이번 범위 밖이고, 아니었다면 회귀입니다. `git show 601b7437:frontend/src/app/components/SayuModal.tsx`로 옛 저장 객체를 확인해야 합니다.
- **성공 안내가 두 번 뜸:** 저장에 성공하면 부모(2761 "SAYU-나의기록에 저장되었습니다!")와 모달(1450)이 둘 다 `toast.success`를 띄웁니다. 테스트는 `successes` 횟수를 확인하지 않습니다. main에서도 그랬는지 미검증입니다. 원래 동작이면 범위 밖입니다.
- **타입 검사 미실행:** `build`는 `vite build`뿐이라 `tsc`가 돌지 않습니다. `Record<string, string|null>`을 `Partial<HaruRecord>`로 넘기는 부분 등 타입 검증은 아직 확인되지 않았습니다.

## 5. 테스트 충분성

`sayuEditedTitle.test.mjs`는 실제 모달 `handleSave`와 실제 부모 `handleSaveSayu`의 소스를 잘라 함께 실행합니다. 다음 경우를 다룹니다.
- 실패 시 필드가 모두 그대로이고, 같은 초안으로 다시 시도하면 모두 저장됨
- 공개본만 실패하는 경우
- 모달 쪽·부모 쪽 각각 로그인이 없는 경우
- 다른 기록·다른 형식이 대상인 경우
- 저장 호출이 한 번뿐인지

단, 가짜 `updateRecord`는 실패하면 아무 필드도 안 바뀌도록 처음부터 만들어져 있습니다. 그래서 실제 Firestore 저장의 원자성은 이 테스트가 아니라 `updateDoc` 한 번 호출이라는 설계로 보장됩니다. 빠진 경우는 위 ①의 `selectedDate`가 빈 경우 하나입니다.

## 6. 검증 증거 구분

| 항목 | 상태 |
|---|---|
| `npm run build`(합성 Firebase 환경값) | 통과: `haru-atomic-build.log:824` "✓ built in 40.75s". 운영 환경값 빌드는 아님 |
| 핵심 테스트 12/12, 정책 테스트 3종 | 실행자 보고. 이번 검토에서 직접 실행하지 않음 |
| `tsc` | 미실행 |
| PR CI, Codex 리뷰 | 없음 (판정① 조건 1·3 미충족) |
| 운영 E2E | 없음. 실제 기기에서 확인해야 할 동작: 제목+본문 수정 저장 → 목록·검색·재열기 반영, 공개 기록이면 함께보기 반영 |

병합·배포는 이번 범위에서 승인하지 않았고, 이번 판정도 그 승인을 넓히지 않습니다. 재검토 때는 이 판정 원문과 ①·②를 어떻게 반영했는지 함께 넘겨 주세요.

## Slack 기록용 확정 요약
> [독립 설계·완료 검토] SAYU 일반 편집 원자 저장 · 브랜치 codex/sayu-atomic-save · HEAD edfb211b · 기준 main 601b7437
> 판정: **수정 후 승인** (1회차)
> 규모: 중규모 / 멈춤 조건: 해당 없음
> 필수 수정: ① `SayuPage.tsx:2682` `!selectedDate`일 때 오류 안내 없이 실패 → 오류 toast와 테스트 추가 ② 기준·현재 테스트 실패 7건의 원인이 다름(기준 SyntaxError 6 + ReferenceError 1, 현재 ReferenceError 7) → 증거 설명 정정
> 권고: 가계부 등에서 표시용 제목이 `_title`을 덮어쓰는지 main 대조, 성공 toast 중복 확인, tsc 실행
> 미충족: PR CI, Codex 리뷰, tsc, 운영 E2E / 병합·배포 미승인
