PR #398의 diff를 GitHub에서 읽기 전용으로 가져와 검토를 시작합니다.

**판정: 승인** (비차단 권고 4건). 검토 대상은 PR #398 HEAD `7a0091a`(부모 `27aa8eb` = 현 main)이며, diff 두 파일(`PolishStrengthSelect.tsx` +13/−2, `SayuModal.tsx` +15/−12)을 git으로 직접 읽었습니다. 저장소는 변경하지 않았습니다.

## 확인 항목

**① 누른 강도 전달 — 정확함.** 버튼 `onClick → onChange(strength)` → `handleRepolish(editPolishSource, strength)`로 인자가 직접 흐르고, `allowCreativeRepolish`와 `strength` 페이로드 둘 다 상태값 대신 인자를 씁니다. 상태 `polishStrength`가 WEAK인 채로 강을 눌러도 `STRONG`이 전송되는 것을 핸들러 추출 검사로 확인했습니다(일기 강 → 추정 안내 포함, memo 강 → 추정 안내 없음, voiding → strength 필드 미전송).

**② 중복 요청 — 두 겹 방어.** 버튼은 `fieldset disabled={isSaving || isRefining}` 안에 있어 다듬는 중 클릭이 막히고(버튼에 `disabled` 속성은 없지만 fieldset 상속으로 `:disabled` 성립, `disabled:opacity-50`도 동작), `handleRepolish` 첫 줄 `isRefining` 가드가 추가로 막습니다. textarea는 `readOnly={isRefining}`이라 요청 중 입력도 차단됩니다.

**③ 편집 초안 보호 — 적절함.** 확인창은 "본문 ≠ 저장본 **그리고** 본문 ≠ 직전 미리보기"일 때만 뜹니다. 즉 직접 고친 글은 보호되고, 약→강 연속 누름은 확인 없이 교체됩니다(의도). `polishPreviewRef`는 모달 열 때 초기화되고, 요청 중 편집창이 사라지면 결과·ref 모두 버립니다.

**④ 저장 시점 — 미리보기는 Firestore 미기록.** preview 분기는 `updateDoc` 없이 `setEditedContent`만 하고, 최종 저장은 기존 `onSave(editedContent, …)` 경로 그대로입니다.

**⑤ 기존 기록 작성·원본 탭 회귀 — 없음.** `runOnClick` 기본값 false라 FormatModal(`pendingPolishStrength` 라디오)과 원본 탭(`onChange={setPolishStrength}` + `handleRepolish()`)은 렌더 분기가 이전과 동일하고, 원본 탭 호출은 기본 인자 `= polishStrength`로 상태값을 써 Firestore 저장·aiComment 갱신 경로가 그대로입니다.

## 비차단 권고
1. 삭제된 버튼 문구('원본으로 다시 다듬기' / '저장된 본문 다시 다듬기')가 주던 **출처 표시**가 사라졌습니다. 독서 형식은 책 정보+사용자 입력, 그 외는 저장본을 쓰는데 사용자가 알 수 없으니 한 줄 캡션을 권합니다.
2. legend는 여전히 "다듬기 정도"인데 버튼은 **실행**입니다. 누르면 바로 호출된다는 문구(버튼 또는 안내 토스트)가 있으면 오동작·비용 오해를 줄입니다.
3. `runOnClick` 분기와 미리보기 경로(`handleRepolish(source, strength)`)를 직접 검사하는 테스트가 저장소에 없습니다. 기존 `polishCommentOptOut.test.mjs`의 핸들러 추출 방식으로 쉽게 추가 가능합니다(아래 첨부 참고).
4. 사소: runOnClick 모드에서 `value` prop과 `polishStrength` 상태가 쓰이지 않아 원본 탭 라디오가 수정 화면의 마지막 선택을 따르지 않습니다(허용 가능).

## 작업 규모·8.1 멈춤 조건
- **규모: 소규모** (프론트 2파일, 기존 기능의 실행 UI 교체).
- **멈춤 조건 비해당**: 홈·라우터·새 기능 아님, Functions/Rules/저장 경로/결제·인증 무변경, 새 AI 호출·모델 변경 없음(동일 `polishContent` PREMIUM, 누름 1회 = 호출 1회). CC의 "웹만, 기존 호출의 실행 버튼 변경" 서술은 사실과 일치합니다. 단서 하나: 미리보기 후 재누름 확인창이 없어져 연속 호출이 쉬워진 점은 구조적 호출량 변경은 아니지만 비용 관점 판단은 허 대표님 몫입니다.
- **배포 승인 범위**: #397 검토 기록처럼 2026-10-07 배포 승인은 특정 CC 세션 한정이므로, #398 병합·Hosting 배포는 허 대표님 지시가 따로 있어야 합니다.

## 검증 한계
- PR 페이지: Draft, 커밋 1개, Codex가 `7a0091abb9`에 "Didn't find any major issues" 완료, Firebase 프리뷰 봇 댓글 확인. CI 통과 여부는 페이지에서 직접 보이지 않아 **판정① 기록 시 CC 로그 첨부가 필요**합니다.
- 제 환경은 `xlsx`(cdn.sheetjs.com) 차단으로 `npm ci`가 실패해 웹 빌드·48개 검사·합성 브라우저 실험을 재현하지 못했습니다. 대신 저장소 밖에서 esbuild로 두 파일을 변환해 컴포넌트 검사 4건, 핸들러 검사 7건, 기존 `polishStrengthGuide` 테스트 3건을 PR HEAD에 대해 실행했고 전부 통과했습니다.

**최종 판정 문구(기록용): "승인 — 비차단 권고 4건, 판정① 기록 전 최신 HEAD CI 통과 로그 첨부 필요."**
