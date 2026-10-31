# 독립 검토 1 결과

- 대상 HEAD: a5ebca1438df664bf5ac4c80f153a48931b1703d
- Claude CLI 읽기 전용 별도 세션, exit 0.
- 완료 확인 시각: 2026-10-28T03:02:13.292853+00:00 (도구 종료 확인 후 기록, 정확한 종료 시각 확인 불가)
- 판정: 수정 후 승인 (1회차)

## 결과 원문

# PR #306 독립 설계·완료 검토 (HEAD `a5ebca14`, 기준 main `d14ead17`)

## 판정: **수정 후 승인**

막히는 문제는 하나입니다. 기록 형식 선택 창의 안내 문구가 이번 요구와 반대로 남아 있습니다. 나머지 실행 경로, 사진 보존, AI 호출 계약, 기존 기록 호환성은 문제를 찾지 못했습니다.

---

## 1. 규모와 멈춤 조건

- **규모: 중규모(컴포넌트 수정).** 바뀐 코드는 `FormatModal.tsx`와 `RecordPage.tsx` 문구 1줄, 그리고 테스트와 검증용 화면(harness)입니다.
- **멈춤 조건: 해당 없음.**
  - **홈화면·라우터:** `/` 경로는 `App.tsx:199`의 `HomeOrLanding`입니다. `RecordPage`는 홈화면이 아니고, `App.tsx`와 `routes.tsx`도 바뀌지 않았습니다.
  - **저장 경로:** `onSave`에서 `handleSaveFormatData`로 이어지는 흐름이 그대로이고, `users/{uid}/records`도 바뀌지 않았습니다.
  - **리전:** `getFunctions(undefined, 'asia-northeast3')`가 그대로입니다.
  - **비용:** 새 AI 호출은 없습니다. 자동으로 부르는 것은 `getMonthlyAiQuotaStatus`뿐입니다(`functions/src/index.ts:2556`). 이 함수는 인증을 확인한 뒤 사용량을 조회만 하고 횟수를 쓰지 않습니다. 실제 AI 호출인 `polishContent`는 사용자가 「AI로 다듬기」를 눌렀을 때만 나갑니다.
  - **모델·결제 정책:** 바뀌지 않았습니다. 요금제는 링크만 바뀌었습니다.

## 2. 반드시 고칠 것

**R1. 형식 선택 창 문구가 요구와 반대입니다** — `frontend/src/app/pages/RecordPage.tsx:1208`
```tsx
<p className="mt-1 text-sm text-gray-600">애매하면 일기를 선택하세요. 이어서 간편·프리미엄 방식을 고릅니다.</p>
```
- **재현:** 기록 페이지에서 글을 쓴 뒤 형식 선택 창을 엽니다. 창에는 "간편·프리미엄 방식을 고릅니다"라고 나오지만, 실제로는 방식 선택 없이 AI 도움 안내가 바로 열립니다.
- diff는 `:308` 문구만 고쳤고 이 문구는 빠졌습니다.
- **제안:** `애매하면 일기를 선택하세요. 작성한 글과 사진으로 AI 도움 안내가 이어집니다.`

## 3. 권장 (막히는 문제 아님, 반영하거나 PR에 설명)

**S1. AI 도움 안내 창에 대화상자 표시가 없습니다** — `FormatModal.tsx:6843-6866`
- 원래 있던 문제입니다. 다만 이번 변경으로 편집창에 들어가자마자 자동으로 열리게 되어 영향이 커졌습니다.
- 지금은 `role="dialog"`, `aria-modal`, `aria-labelledby`가 없습니다. 화면낭독기 사용자는 갑자기 덮인 창이 무엇인지 안내받지 못합니다.
- 로딩 영역의 `role="status" aria-live="polite"`(:6872)는 적절합니다.
```tsx
<div role="dialog" aria-modal="true" aria-labelledby="monthly-ai-guide-title" style={{...}} onClick={e => e.stopPropagation()}>
  <h2 id="monthly-ai-guide-title" ...>AI 도움 사용 안내</h2>
```

**S2. 「요금제 보기」를 새 탭으로 여는 방식은 실기기 확인이 필요합니다** — `FormatModal.tsx:6936-6953`
- 같은 창에서 이동하던 방식보다 작성 중인 글이 남는다는 점에서 맞는 방향입니다.
- 다만 iOS 홈 화면 앱(PWA)에서 새 탭으로 열면 Safari로 넘어가는데, 저장 공간이 분리되어 있어 로그인 화면이 나올 수 있습니다.
- iOS PWA 실기기 확인 항목으로 넣어 주세요.

**S3. 방식 선택 제거가 초안 흐름 밖에도 적용됩니다**
- `recordStep`은 `독서사유`를 빼고 모두 `'input'`이 됩니다(:589, :817).
- `recordStyle`은 `!initialWritingDraft && savedStyle === 'premium'`일 때만 premium입니다.
- 그런데 `RecordPage`가 여는 편집창은 `initialData`가 `{}`이거나 초안 데이터입니다(:1237). 그래서 바로 입력(`openFormatDirectly` :543, `handleSave` :580)으로 여는 신규 기록에서도 항목별(프리미엄) 입력에 들어갈 방법이 없어집니다. 대상은 일기 `DIARY_PREMIUM_FIELDS` 등 형식 전체입니다.
- 요구 원문 "기록 방식 선택은 없애고"와는 맞습니다. 하지만 화면에서 기능 하나가 사실상 사라지는 것이므로 PR과 보고에 명시해 주세요.
- 성장기록(:4390)과 텃밭 작물(:4493) 입력은 방식과 상관없이 따로 보이므로 손실이 없습니다.

**S4. 사진이 끝까지 남는지에 대한 자동 검증이 약합니다**
- `formatPolishRequest.test.mjs`의 `assert.equal(data.essay_images, ...)`는 아무도 바꾸지 않는 입력 객체를 다시 비교할 뿐입니다. 사진 보존을 증명하지 못합니다.
- 실제로 사진을 지키는 것은 기존 `handleSaveSayu`의 `[imagesKey]: JSON.stringify(uploadedImages)`(:3052)입니다. 코드상 맞습니다.
- 그러나 README에 적힌 `/?draft` 검증 화면을 실제로 돌렸다는 로그는 제공되지 않았습니다. 실행 결과(스크린샷 또는 단계 기록)를 PR에 남기거나, 확인하지 못한 항목이라고 적어 주세요.

## 4. 확인한 항목 (문제 없음)

**실행 경로·초기화**
- 새 effect(:1040-1049)는 세션 effect(:491) 뒤에 선언되어 있습니다. 그래서 세션 번호가 먼저 오른 다음 `fetchMonthlyAiQuotaStatus`가 그 번호를 잡습니다.
- 사진 업로드 effect(:1027)가 먼저 실행되고 `uploadSelectedImages`가 :1978에서 바로 `isUploadingRef`를 켭니다. 따라서 안내 창이 열리는 순간 업로드 잠금이 이미 걸려 있습니다.
- `openMonthlyAiGuide`는 조기 반환(:1051) 아래에 선언되어 있지만 `isOpen`이 참일 때만 불리므로 선언 전 접근(TDZ) 문제는 없습니다.

**재시도·이전 응답 무시**
- 조회 실패: `quota=null`, 로딩 해제, 「다시 시도」 노출(:6919).
- 편집창을 닫거나 기록이 바뀐 뒤 늦게 온 응답은 세션 비교(:1364, :1367, :1372)로 버립니다.
- 조회 중에는 다듬기 버튼이 비활성(:6666)이라 겹친 호출이 생기지 않습니다.

**실행 조건** — `handleConfirmMonthlyAiPolish`(:1394-1398)는 다음 경우 실행하지 않습니다.
- 조회 중이거나 사용량 정보가 없을 때
- 남은 횟수가 0일 때
- 저장 중일 때
- 사진 업로드 중이거나 업로드에 실패했을 때

버튼의 비활성과 문구(:6904-6916)도 같은 조건을 따릅니다.

**초안 이어받기**
- `buildDraftEditorData`가 `_simple`과 첫 줄 제목을 채웁니다(`writeBeforeFormat.ts:38-39`).
- 그래서 자동 안내가 제목 확인을 건너뛰어도 `polishContent`에 원문이 들어갑니다(:1416-1417).

**기존 기록 호환**
- 저장된 기록을 고치는 SAYU 편집은 `SayuModal`이 담당하므로 영향이 없습니다.
- `savedStyle`을 보는 분기는 기존 premium 기록의 입력 구조를 그대로 유지합니다.
- `독서사유`의 책 선택 단계는 그대로입니다.

**포도송이 로딩**
- `isLoadingMonthlyAiQuota`일 때 기존 `GrapeLoadingMini size={64}`와 안내 문구를 우선 보여 줍니다(:6871-6875). 요구와 맞습니다.

**검증 근거**
- 테스트: 53 pass / 0 fail (`haru-record-direct-tests.log`). 새 테스트 3개(초안 직접 안내, 한도 소진·업로드 중·업로드 실패, 재시도와 이전 응답 무시)를 포함합니다.
- `npm run build`: 성공 (`✓ built in 56.39s`).
- CI 결과는 이 검토에서 직접 열어 보지 못했습니다. 판정①을 기록할 때 최신 HEAD 기준으로 다시 확인해 주세요.

## 5. 재검토 요청 시 넘길 것

- 이 판정 원문
- R1 반영 diff
- S1~S4 반영 내역 또는 반박 사유
- 새 HEAD SHA와 Codex 재검토 결과

이번 판정은 병합·배포 승인이 아닙니다. iOS PWA 실기기 확인(S2)과 운영 E2E는 따로 남아 있습니다.
