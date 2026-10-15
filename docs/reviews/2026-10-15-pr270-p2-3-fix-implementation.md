# PR #270 P2-3 후속 구현 기록 — `고소했다`·`합의했다` 허용 목록 제외 (한 항목만)

- 작성 시각: 2026-10-15T12:49:16Z (한국시간 2026-10-15 21:49:16)
- 대상: PR #270 작업 브랜치 `codex-assistant-recommendation-accuracy`. 수정 전 원격 HEAD `bdefa3f8c681d887606342ab54bbb581be908a32`(작업 시작 시 `git ls-remote`와 GitHub PR 조회로 정확히 일치 확인, 커밋 직전·push 직전에도 작업 브랜치와 `refs/pull/270/head`가 같은 값임을 다시 확인), 새 코드 커밋 `7f659deeee55df4d2dd8462e20ffc7deb18e298c`(부모 `bdefa3f8`), main `69c371cce46f39f8720283167c037d099fede7af`(변동 없음).
- 지시: 허대표님이 기장의 권고를 받아들여 Codex 실행 4가 지적한 `고소했다`(P2)와 `합의했다`(P3)를 **모두** 허용 목록에서 제외하기로 결정했다. 이번 한 단계는 구현 → 시험·빌드 → 커밋·push → CI → 새 증거·PR 댓글·Slack 기록이다. 지시 원문은 1절.
- 이 기록은 **두 Codex 인라인 지적이 요구한 대응을 새 코드 커밋으로 반영했다는 구현 기록**이다. 지적이 해결됐다는 판정이나 PR 승인, 정책 8.1 판정①이 아니다. 해결 여부는 새 HEAD `7f659dee`의 Codex·독립 재검토에서 확인해야 하며 이번 단계에서는 요청하지 않았다. 전체 판정은 **"수정 후 승인 유지, 누적 1회"**이다.

## 1. 지시 원문 (수정 없이 보존)

- 접수: 허대표님 결정을 기장이 전달한 이 세션의 지시. 작업 시작(격리 worktree 생성) 2026-10-15T12:38:52Z, 그 직전에 원격 HEAD를 확인했다.

```
허대표님 결정: 기장의 권고를 받아들여 PR #270에서 `고소했다`와 `합의했다`를 모두 허용 목록에서 제외합니다.

이번 한 단계만 실행하세요: 구현 → 필요한 테스트·빌드 → 커밋·작업 브랜치 push → CI 확인 → 새 증거 파일·PR 댓글·Slack 기록. 완료 보고 후 멈추세요. Codex 재검토, 독립 Claude 재검토, 병합, 배포, 새 에이전트 생성은 하지 마세요.

기준:
- 대상 PR: https://github.com/hkd620-lab/haru2026/pull/270
- 수정 전 원격 HEAD를 정확히 bdefa3f8c681d887606342ab54bbb581be908a32로 확인하세요. 다르면 멈추고 보고하세요.
- 현재 CI build_and_preview와 Deploy Preview는 success입니다.

최소 변경:
1. frontend/src/app/utils/assistantRecommendations.ts
   - `합의: ['합의서', '합의했다']` → `합의: ['합의서']`
   - `고소: ['고소장', '고소했다']` → `고소: ['고소장']`
   - 문맥 예외나 새 로직을 추가하지 마세요.
2. frontend/test/assistantRecommendations.test.mjs
   - P2-3 닫힌 목록의 제목·주석·개수 단언을 22개에서 20개로 조정하세요.
   - COMPOUND_FORMS와 기존 양성 대표 문장에서 두 표현을 제거하세요.
   - `참기름 냄새가 고소했다`와 `회의에서 일정에 합의했다`가 추천 없음([])임을 명시적으로 고정하세요. 이전 양성형인 `상대방을 고소했다`, `상대방과 합의했다`도 이제 추천 없음임을 고정해 결정이 되돌아가지 않게 하세요.
   - `고소장`, `합의서`의 양성 인식은 유지하세요.
   - 가능하면 기존 테스트 케이스 안의 행만 조정해 전체 테스트 수 43개를 유지하세요.

금지 범위:
- 위 두 파일 외 코드 수정 금지.
- P2-1, P2-2, 나머지 P3, PR #274, 라우터, Firestore, Functions, 모바일 수정 금지.
- 기존 증거 파일 수정 금지. docs/reviews에는 새 파일만 추가하세요.
- 리뷰 스레드는 재검토 전 임의 resolve하지 마세요.

검증:
- 새 음성/오탐 테스트를 먼저 추가해 수정 전 HEAD에서 두 문제가 재현되는 red를 확인하고 기록한 뒤, 두 변형을 제거해 green을 확인하세요.
- frontend에서 `node --import tsx --test test/assistantRecommendations.test.mjs test/formatRegistry.test.mjs`
- `git diff --check`, 변경 파일과 diff 직접 확인
- 기존 방식의 더미 환경변수로 `npm run build`
- Firestore 경로·Functions 리전·AI 모델·결제/인증/개인정보/비밀값 변경 없음 명시

Git/기록:
- 요청 파일 두 개만 개별 stage하고 `git diff --cached --name-only` 확인, 한국어 conventional commit, 정상 push.
- 증거 브랜치에는 새로운 검토/구현 증거 파일만 추가하고 이전 파일은 수정하지 마세요.
- PR에 두 Codex 인라인 지적(r4282906294, r4282906305)을 새 코드 SHA로 해결했다는 구현 보고를 남기세요.
- 개발 Slack 스레드와 감사 채널에 새 SHA·검증·CI·미해결 재검토 상태를 기록하세요. 비밀·개인정보는 쓰지 마세요.

완료 보고에는 코드 SHA, 정확한 diff, red/green 결과, 전체 테스트 수, 빌드, CI run 링크/상태, 증거 SHA·파일·PR 댓글·Slack 링크, 작업 폴더 정리 상태를 포함하세요. 현재 전체 판정은 '수정 후 승인 유지, 누적 1회'이고 새 HEAD 재검토 전 판정①을 기록하지 마세요. 대표님 할 일은 없고, 기장이 결과를 확인합니다.
```

## 2. 처리 대상 — Codex 실행 4(PR review `5533027872`, 검토 커밋 `bdefa3f8`)의 인라인 지적 2건

원문 전체는 `2026-10-15-pr270-codex-run4-index.md`(증거 브랜치 `76a52eb0`)에 보존돼 있다.

| 심각도 | 지적 | 인라인 댓글 | 위치(`bdefa3f8`) | 이번 대응 | 스레드 상태(작성 시점) |
|---|---|---|---|---|---|
| P2 | 맛 표현인 `고소했다`를 법률 변형에서 제외하세요 | <https://github.com/hkd620-lab/haru2026/pull/270#discussion_r4282906294> (`PRRT_kwDORWOKJc6sxEuv`) | 184행 `고소: ['고소장', '고소했다'],` | `고소했다` 제거 → `고소: ['고소장'],` | 미해결(CC가 resolve하지 않음). 코드가 바뀌어 GitHub가 `outdated`로 표시 |
| P3 | 일상적인 `합의했다`의 오탐 위험을 명시적으로 처리하세요 | <https://github.com/hkd620-lab/haru2026/pull/270#discussion_r4282906305> (`PRRT_kwDORWOKJc6sxEu6`) | 183행 `합의: ['합의서', '합의했다'],` | `합의했다` 제거 → `합의: ['합의서'],` | 미해결(CC가 resolve하지 않음). `outdated` 표시 |

- Codex가 제시한 최소 대응 그대로다. P2: "문맥 예외를 추가하기보다 이번 닫힌 목록에서 `고소했다`만 제외". P3: "정확도를 우선한다면 `합의했다`만 제외하는 것이 최소 코드 대응". 허대표님이 두 제외를 모두 선택했다.
- 스레드는 해결 판정이 아니라 재검토 뒤에 정리한다. 스레드를 resolve하는 것만으로는 해결이 아니다(정책 8.1).

## 3. 변경 (커밋 `7f659deeee55df4d2dd8462e20ffc7deb18e298c`, 한국어 fix 커밋 1개, 2 files, +15 −10)

| 파일 | 내용 |
|---|---|
| `frontend/src/app/utils/assistantRecommendations.ts` | `KEYWORD_VARIANTS`에서 `합의`의 `합의했다`, `고소`의 `고소했다`만 제거(+3 −3). 지시한 두 줄 외에 바로 위 설명 주석 한 줄의 개수 `22개`→`20개`와 제외 사유 한 구절을 고쳤다. **주석만이며 로직은 없다**(주석이 22개라고 말하면 실제 20개와 어긋나기 때문에 맞췄다. 두 줄 diff만 원하면 이 주석 한 줄은 되돌려도 동작은 같다) |
| `frontend/test/assistantRecommendations.test.mjs` | 기존 시험 안의 행만 조정(+12 −7). 새 `test()`는 추가하지 않아 시험 수 43개 유지 |

시험 파일의 조정 내용:

1. `COMPOUND_FORMS` 22개 → 20개(`고소했다`·`합의했다` 제거), 위 주석 2줄(20개, 제외 사유).
2. 시험 `상위 빈도 합성어·한자어 활용형 20개는 해당 비서에 연결된다`: 제목 22→20, 개수 단언 22→20. `고소장`·`합의서`는 표에 남아 양성 인식이 유지된다.
3. 시험 `합성어·한자어 활용형에 조사가 붙은 대표 문장을 인식한다`: 대표 문장 24→22(이전 양성형 `상대방을 고소했다`·`상대방과 합의했다` 제거). `합의서를 작성했다`·`고소장을 접수했다`는 유지.
4. 시험 `합성어 허용 목록은 닫혀 있어 … 제외한 고소했다·합의했다는 추천하지 않는다`: 제목에 제외 결정을 덧붙이고 6문장을 추천 없음(`[]`)으로 고정 — `요즘 고소했다.`·`요즘 합의했다.`·`참기름 냄새가 고소했다`·`회의에서 일정에 합의했다`·`상대방을 고소했다`·`상대방과 합의했다`. 문장별 반복 단언이 아니라 6문장의 실제 결과를 한 객체로 모아 기대(전부 `[]`)와 비교해, 실패하면 어느 문장이 추천됐는지 한 번에 모두 보인다(red 출력이 그렇게 나왔다).

정확한 diff(`git diff bdefa3f8 7f659dee`, 원본은 `2026-10-15-pr270-p2-3-fix-verify/code.diff`와 같다):

```diff
diff --git a/frontend/src/app/utils/assistantRecommendations.ts b/frontend/src/app/utils/assistantRecommendations.ts
index 4cb1664a..a2a3ddb6 100644
--- a/frontend/src/app/utils/assistantRecommendations.ts
+++ b/frontend/src/app/utils/assistantRecommendations.ts
@@ -178,10 +178,10 @@ const KEYWORD_VARIANTS: Record<string, string[]> = {
   법률: ['법률상담'],
   여행: ['국내여행', '해외여행', '가족여행'],
   제주: ['제주도', '제주시', '제주특별자치도'],
-  // 상위 빈도 합성어·한자어 활용형 22개만 기존 키워드에 연결해 허용한다(전세·월세보증금은 위 보증금 항목). 접두·접미 임의 확대와 한자어+하다/되다 일반화는 불허.
+  // 상위 빈도 합성어·한자어 활용형 20개만 기존 키워드에 연결해 허용한다(전세·월세보증금은 위 보증금 항목). 접두·접미 임의 확대와 한자어+하다/되다 일반화는 불허. 고소했다(맛 표현)·합의했다(일상 용법)는 오탐 위험으로 제외.
   소송: ['민사소송', '행정소송', '형사소송'],
-  합의: ['합의서', '합의했다'],
-  고소: ['고소장', '고소했다'],
+  합의: ['합의서'],
+  고소: ['고소장'],
   고발: ['고발했다'],
   내용증명: ['내용증명우편'],
   손해배상: ['손해배상청구'],
diff --git a/frontend/test/assistantRecommendations.test.mjs b/frontend/test/assistantRecommendations.test.mjs
index aebd3732..b6bbf7fa 100644
--- a/frontend/test/assistantRecommendations.test.mjs
+++ b/frontend/test/assistantRecommendations.test.mjs
@@ -130,26 +130,25 @@ test('분야가 분명한 일상 합성어도 추천을 유지한다', () => {
   assert.deepEqual(ids('당뇨병과 불면증으로 힘들었다.'), ['health']);
 });
 
-// 독립 1회차 P2-3이 권고한 상위 빈도 합성어·한자어 활용형 22개만 닫힌 목록으로 허용한다. 기존 키워드의 비서에 그대로 연결한다.
+// 독립 1회차 P2-3이 권고한 상위 빈도 합성어·한자어 활용형 중 20개만 닫힌 목록으로 허용한다. 기존 키워드의 비서에 그대로 연결한다.
+// 고소했다(맛 표현)·합의했다(일상 용법)는 오탐 위험으로 제외했다(아래 닫힌 목록 시험에서 추천 없음으로 고정).
 const COMPOUND_FORMS = [
   ['전세보증금', 'law'], ['월세보증금', 'law'],
   ['민사소송', 'law'], ['행정소송', 'law'], ['형사소송', 'law'],
   ['합의서', 'law'], ['고소장', 'law'], ['내용증명우편', 'law'], ['손해배상청구', 'law'],
-  ['고소했다', 'law'], ['고발했다', 'law'], ['합의했다', 'law'],
+  ['고발했다', 'law'],
   ['고혈압', 'health'], ['저혈압', 'health'], ['고혈당', 'health'], ['저혈당', 'health'], ['공복혈당', 'health'], ['식후혈당', 'health'],
   ['건강보험료', 'finance'], ['현금영수증', 'finance'], ['입금했다', 'finance'], ['입금되었다', 'finance'],
 ];
 
-test('상위 빈도 합성어·한자어 활용형 22개는 해당 비서에 연결된다', () => {
-  assert.equal(COMPOUND_FORMS.length, 22);
+test('상위 빈도 합성어·한자어 활용형 20개는 해당 비서에 연결된다', () => {
+  assert.equal(COMPOUND_FORMS.length, 20);
   for (const [form, id] of COMPOUND_FORMS) assert.deepEqual(ids(`요즘 ${form}.`), [id], form);
 });
 
 test('합성어·한자어 활용형에 조사가 붙은 대표 문장을 인식한다', () => {
   for (const [text, expected] of [
-    ['상대방을 고소했다', ['law']],
     ['상대방을 고발했다', ['law']],
-    ['상대방과 합의했다', ['law']],
     ['합의서를 작성했다', ['law']],
     ['고소장을 접수했다', ['law']],
     ['전세보증금을 돌려받지 못했다', ['law']],
@@ -174,12 +173,18 @@ test('합성어·한자어 활용형에 조사가 붙은 대표 문장을 인식
   ]) assert.deepEqual(ids(text), expected, text);
 });
 
-test('합성어 허용 목록은 닫혀 있어 접두·접미 임의 확대와 한자어+하다/되다 일반화를 막는다', () => {
+test('합성어 허용 목록은 닫혀 있어 접두·접미 임의 확대와 한자어+하다/되다 일반화를 막고, 제외한 고소했다·합의했다는 추천하지 않는다', () => {
   for (const [form] of COMPOUND_FORMS) {
     assert.deepEqual(ids(`요즘 쿠${form}.`), [], `쿠${form}`);
     assert.deepEqual(ids(`요즘 ${form}쿠.`), [], `${form}쿠`);
   }
   for (const word of ['입금하다', '입금됐다', '고발되었다', '합의되었다']) assert.deepEqual(ids(`요즘 ${word}.`), [], word);
+  // 제외한 두 형태는 맛 표현·일상 용법에 법률 비서가 뜨지 않는다. 이전 양성형(상대방을 고소했다·상대방과 합의했다)도 추천 없음으로 고정해 결정이 되돌아가지 않게 한다.
+  const excluded = ['요즘 고소했다.', '요즘 합의했다.', '참기름 냄새가 고소했다', '회의에서 일정에 합의했다', '상대방을 고소했다', '상대방과 합의했다'];
+  assert.deepEqual(
+    Object.fromEntries(excluded.map((text) => [text, ids(text)])),
+    Object.fromEntries(excluded.map((text) => [text, []])),
+  );
 });
 
 test('점수가 형식 우선순위보다 먼저 적용된다', () => {
```

변경하지 않은 것: `KOREAN_PARTICLES`(P2-1), 감정 3단어 변형(P2-2), 나머지 19개 합성어·한자어 활용형, `matchesKeyword`·정규식·점수·`RECOMMENDATION_RULES`(소스 diff에 해당 식별자 0건), 컴포넌트·라우터·Firestore·Functions·모바일. 문맥 예외나 새 로직은 없다.

## 4. 검증 결과

원본 출력은 모두 `2026-10-15-pr270-p2-3-fix-verify/`에 있다.

| 항목 | 명령·방법 | 결과 |
|---|---|---|
| 수정 전 HEAD 확인 | `git ls-remote origin refs/heads/codex-assistant-recommendation-accuracy refs/pull/270/head` + GitHub PR 조회 | 둘 다 `bdefa3f8c681d887606342ab54bbb581be908a32`(PR `head.sha` 동일). 다르지 않아 계속 진행 |
| **구현 전(red)** | 소스는 `bdefa3f8` 그대로, 시험 파일만 위처럼 고쳐(신규 음성 단언 포함) 같은 시험 명령 실행(2026-10-15T12:40:51Z) | **43개 중 42 통과 / 1 실패.** 실패한 1건은 닫힌 목록 시험의 새 음성 단언이며 6문장이 모두 `['law']`로 나와 두 문제(`참기름 냄새가 고소했다`·`회의에서 일정에 합의했다`와 이전 양성형·단독 형태)가 재현됨 → `test-red.txt` |
| **구현 후(green)** | 소스에서 두 변형 제거 후 `cd frontend && node --import tsx --test test/assistantRecommendations.test.mjs test/formatRegistry.test.mjs`(12:41:07Z) | **43 통과 / 0 실패**(추천 36 + 형식 등록부 7). 기존 시험은 수정 없이 통과. 커밋 후(7f659dee) 같은 명령 재실행도 43/43 → `test-green.txt`, `test-green-postcommit.txt` |
| 신·구 소스 직접 비교 | `spot.mjs`: 두 소스의 `getAssistantRecommendations`를 직접 실행(소수 사례 87개, 새 코퍼스·전수 비교 아님) | 달라진 것은 8개뿐: **제외 대상 7개**(`요즘 고소했다.`·`요즘 합의했다.`·`참기름 냄새가 고소했다`·`회의에서 일정에 합의했다`·`상대방을 고소했다`·`상대방과 합의했다`·`팀원들과 합의했다`)는 `law` → `[]`, 그리고 `내용증명을 보내고 상대방과 합의했다`는 카드(law)는 같고 감지 단어에서 `합의`만 빠짐. 남은 20형 연결(20)·조사 붙은 대표 문장(22)·`고소장`·`합의서`·`합의를`·`고소를` 등 기본 키워드 사례(7)·기존 차단·비관련어·목록 밖(19)·P2-1/P2-2/기존 사례(9)·`고소하고 맛있다`(1)는 신·구 완전 동일 → `spot-check-output.txt` |
| diff 검사 | `git diff --check`(작업 트리 커밋 전, 커밋 후 `HEAD~1 HEAD`) | 둘 다 깨끗(exit 0). 두 파일 모두 NFC, CRLF 없음 → `diff-check.txt` |
| 프론트 빌드 | `cd frontend && npm run build -- --outDir <임시> --emptyOutDir`(더미 `VITE_FIREBASE_*`·`VITE_AI_LIBRARY_FIREBASE_*` 12개 환경변수) | **성공**(exit 0, 74초, `✓ built in 1m 11s`, 3525 modules, precache 781 entries). 운영 환경 변수 빌드가 아니며 실제 Firebase 연결 동작은 확인하지 않았다 → `build-summary.txt` |
| 변경 범위·안전 | `git diff --name-status`와 diff +/- 줄의 식별자 검색 | 변경 파일 2개. Firestore·Functions·리전·모델·인증·결제·비밀값·import 관련 식별자 일치 0건, `KOREAN_PARTICLES`·`matchesKeyword`·점수·`RECOMMENDATION_RULES`·정규식 생성 변경 0건 → `scope-safety-check.txt` |

- **Firestore 경로 `users/{uid}/records/{date}` 유지·변경 없음. Functions 리전 `asia-northeast3`·함수 export·Rules 변경 없음. AI 모델·AI 호출·네트워크 호출 변경 없음. 결제·인증·개인정보·환경변수 정의·비밀값 변경 없음. API 키·실제 사용자 데이터 추가 없음.** 변경은 규칙 키워드 표 두 줄과 그 시험뿐이다. 운영 병합·운영 배포는 하지 않았다.

## 5. Git·CI

- push: 2026-10-15T12:43:25Z경 `bdefa3f8..7f659dee`를 `git push origin HEAD:refs/heads/codex-assistant-recommendation-accuracy`로 올렸다(fast-forward, 강제 push 없음). push 직전 원격 head가 `bdefa3f8` 그대로임을 확인했고, push 후 작업 브랜치와 `refs/pull/270/head`가 모두 `7f659dee`다. 요청 파일 두 개만 개별 stage했고 `git diff --cached --name-only`는 그 두 개뿐이었다(worktree의 `frontend/node_modules` 심볼릭 링크는 stage하지 않음). PR 본문은 수정하지 않았다.
- CI(`7f659dee`): `Deploy to Firebase Hosting on PR` [실행 38736844621](https://github.com/hkd620-lab/haru2026/actions/runs/38736844621)(run_number 492) — `build_and_preview` [job 116428193374](https://github.com/hkd620-lab/haru2026/actions/runs/38736844621/job/116428193374) **success**(2026-10-15T12:43:37Z~12:45:38Z, Install and Build 12:43:48Z~12:45:22Z), `Deploy Preview`(check run 116428976786) **success**(12:45:22Z~12:45:35Z). CI 통과는 위 필수 검증을 대신하지 않는다.
- 이 새 기록은 증거 브랜치 `claude/elegant-noether-z5zy29`에 새 파일로만 추가된다(PR #270 브랜치와 main은 건드리지 않음). 이 브랜치는 오래된 앱 코드를 포함하므로 main에 병합하지 않는다.

## 6. 영향과 남는 위험 (허대표님이 수용한 결정의 효과, 기록만)

1. **재현율 감소(수용)**: `고소했다`·`합의했다` 형태만으로는 더 이상 추천이 뜨지 않는다. 법률 맥락의 `상대방을 고소했다`·`상대방과 합의했다`도 다른 법률 키워드가 없으면 추천 없음(수정 전 law)이다. 기본 키워드와 조사가 붙은 형태(`고소를`·`고소는`·`합의를`·`합의가`)와 `고소장`·`합의서`는 신·구 동일하게 인식된다.
2. 같은 문형의 다른 활용형(`합의했습니다`·`상대방과 합의했어요`·`고소했어요`·`고소했습니다`·`합의하여 끝냈다`·`고소했는데 …`·`합의했다고 한다`)은 수정 전·후 모두 미인식이다(닫힌 목록 원칙, `inflection-check-output.txt`). 넓힐지는 후속 결정이다.
3. 기존 P3 **`고소하고`(맛) 동형이의**(`고소하고 맛있다`→하루LAW)는 이번 변경과 무관하게 그대로 남아 있다(신·구 동일, `spot-check-output.txt` G 그룹). 이번 단계에서 손대지 않았다.
4. 감지 단어 표시: 다른 법률 키워드와 함께 `합의했다`가 있는 문장은 카드는 같고 표시되는 감지 단어에서 `합의`가 빠질 수 있다(예: `내용증명을 보내고 상대방과 합의했다` → `내용증명`만). 카드가 달라지지는 않는다.
5. 성능은 측정하지 않았다. 이번 변경은 정규식 대안을 줄이는 방향(`합의` 3→2개, `고소` 3→2개; 대안은 `[기본 키워드, ...변형]`)이라 악화 요인은 없다.
6. 화면·실기기 E2E는 확인하지 않았다. 프리뷰 확인이 필요하면 허대표님·기장 결정 사항이며 이번 지시에서 대표님 할 일은 없다.

## 7. 이번 단계에서 하지 않은 것·남은 일

- 하지 않음: Codex 재검토 요청, 독립 Claude 재검토 요청, 병합, 운영 배포, 새 에이전트 생성, P2-1·P2-2 변경, 나머지 P3(성능·가중치 시험·`고소하고`·약한 단어 정책·`건강검진표`·PR 본문 최신화), 독립 3회차 선택 P3(시험 제목·단언 불일치 보강), PR #274, 라우터·Firestore·Functions·모바일 변경, 리뷰 스레드 resolve, 기존 증거 파일 수정.
- **남은 일(정책 8.1)**: 기능 코드가 바뀌었으므로 새 HEAD `7f659deeee55df4d2dd8462e20ffc7deb18e298c` 기준의 Codex·독립 Claude 재검토가 필요하다. 재검토에서 볼 곳은 `KEYWORD_VARIANTS` 두 줄과 설명 주석 한 줄, 시험 파일의 기존 시험 행 조정(+12 −7)이다. Codex 실행 4의 P2·P3 스레드는 그 재검토 뒤에 정리한다.
- **판정**: 전체 판정은 "수정 후 승인 유지, 누적 1회"이며 판정①은 새 HEAD 재검토 전에는 기록하지 않는다. 미해결 Codex 스레드 2개가 남아 있고 독립 Claude의 승인도 아직 없으므로 판정① 조건은 충족되지 않았다.
