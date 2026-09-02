# CC 8차 완료보고 — 무인증 AI 함수 7개 잠금 + 문법캐시 uid 격리 통합

**작업 브랜치:** `feature/ai-guard-grammar-isolation`
**작업 일자:** 2026-09-02
**실행 환경:** 클라우드 컨테이너 세션 (Firebase CLI 인증 없음)

---

## 1. Step 0 — 기준 커밋

- `origin/main` 최신 = **`c22d3eff`** (Merge pull request #132 from hkd620-lab/feature/internal-entitlements)
- 지시서 기재값과 일치. 그 뒤 새 커밋 없음.
- 작업 시작 시 `git status` : **clean** (미커밋 변경 0건)

---

## 2. Step 1 — PR #129(firestore.rules) 상태 재확인 (조치 없음, 증거만 수집)

```
git merge-base --is-ancestor origin/claude/merge-firestore-rules-yya2ru origin/main
→ NOT MERGED

git show origin/main:firestore.rules | grep -c "resultThreads"
→ 0

git show origin/main:firestore.rules | grep -n "^    match /vocabulary\|^    match /gardenCrops\|^    match /novelSettings"
→ 319:    match /vocabulary/{docId} {
   324:    match /gardenCrops/{docId} {
   329:    match /novelSettings/{docId} {
```

**판정: NOT MERGED** — Cowork 실측과 동일. PR #129는 아직 main에 병합되지 않았고,
`resultThreads` 규칙 부재 / 최상위 유령 규칙 3개 잔존 상태가 그대로 확인됨.
이 지시서에서는 `firestore.rules`를 일절 수정하지 않았음.

---

## 3. Step 3·4 — 병합 결과

| 단계 | 대상 | 결과 |
|---|---|---|
| Step 3 | `origin/feature/ai-endpoint-auth-guard` | **충돌 0건** (`functions/lib/index.js`, `functions/src/index.ts` auto-merge, +77) |
| Step 4 | `origin/feature/grammar-changes-fix` | **충돌 0건** (`functions/src/index.ts` +30/-5, `firestore.rules`는 auto-merge 후 순변경 0) |

병합 커밋:
- `a9bdc55e` merge: feature/ai-endpoint-auth-guard 통합
- `35b1a532` merge: feature/grammar-changes-fix 통합

---

## 4. Step 5 — 병합 결과 검증

### 4-1. 무인증 AI 함수 7개 인증 블록 — **7/7 확인**

| 함수 | src/index.ts 라인 | 인증 블록 | uid 획득 |
|---|---|---|---|
| getWordMeaning | 7743 | ✅ `if (!request.auth) throw HttpsError('unauthenticated')` | ✅ |
| getGrammarExplain | 7792 | ✅ | ✅ |
| getVerseQuiz | 8219 | ✅ | ✅ |
| translateToEnglish | 8297 | ✅ | ✅ |
| getVerseTranslation | 8945 | ✅ | ✅ |
| getVerseWordMapping | 8977 | ✅ | ✅ |
| petFoodCheck | 12124 | ✅ | ✅ |

7개 모두 함수 본문 첫머리에 인증 검사가 있고, 뒤이어 `enforceRateLimit` 호출이 붙어 있음.

### 4-2. 문법캐시 uid 격리 확인

```
7806:    let cacheKey = verseKey;
7810:      cacheKey = `diary_${uid}_${verseKey.slice('diary_'.length)}`;
7814:    const cacheRef = db.collection('grammarCache').doc(cacheKey);
```

→ `getGrammarExplain`의 캐시 참조가 `doc(cacheKey)` 형태로 정상 유지됨. 병합 사고 없음.

**참고 (사고 아님):** `grep`에 `8031: db.collection('grammarCache').doc(verseKey)` 가 함께 잡히나,
이는 **관리자 전용 성경 배치 사전캐시 함수**(ADMIN_UID 검사 + `^[a-z]+_\d+_\d+$` 키 형식 강제)로
`diary_` 키가 들어올 수 없는 별도 경로임. 일기 캐시와 무관하므로 그대로 둠.

### 4-3. `uid` 중복 선언 정리 — **정리 완료**

`getGrammarExplain` 안쪽 블록의 중복 2줄만 삭제 (바깥 `const uid = request.auth.uid;`가 이미 인증 강제):

```diff
     let cacheKey = verseKey;
     if ((verseKey || '').startsWith('diary_')) {
-      const uid = request.auth?.uid;
-      if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
       cacheKey = `diary_${uid}_${verseKey.slice('diary_'.length)}`;
     }
```

지시서 지정 구간 외 다른 줄은 건드리지 않음 (`git diff` 확인: src 변경 = -2줄뿐).

### 4-4. `git diff origin/main HEAD --stat`

```
 functions/lib/index.js | 35 +++++++++++++++++++++++
 functions/src/index.ts | 75 ++++++++++++++++++++++++++++++++++++++++++++++----
 2 files changed, 105 insertions(+), 5 deletions(-)
```

→ **`firestore.rules` 없음.** 정상. (grammarCache `diary_` 차단 규칙은 이미 main에 반영되어 있음)

---

## 5. Step 6 — 빌드

```
cd functions
PUPPETEER_SKIP_DOWNLOAD=true npm ci   → 성공
npm run build                          → 성공 (exit 0)
```

- TypeScript 버전: **5.9.3**
- `npm ci` 시 audit 경고 10건(moderate 2 / high 8)이 출력되나 설치·빌드 자체는 성공. 이번 범위 밖이라 조치하지 않음.
- 빌드 결과 `functions/lib/index.js` 재생성됨 (+29/-6).

---

## 6. Step 7 — 커밋 / push

| 항목 | 값 |
|---|---|
| 커밋 해시 | `a1f5f489` chore: 무인증 AI 7개 잠금 + 문법캐시 uid 격리 통합 빌드 |
| staged 파일 | `functions/src/index.ts`, `functions/lib/index.js` (개별 add, `git add .` 미사용) |
| push 대상 | `origin feature/ai-guard-grammar-isolation` |

**참고:** `functions/lib` 가 `.gitignore` 대상이라 `git add` 시 ignore 경고가 출력되지만,
`functions/lib/index.js`는 이미 **추적 중인 파일(tracked)** 이라 정상적으로 스테이징됨.
`-f` 옵션은 사용하지 않았음.

---

## 7. 미수행 항목 (의도적 — 지시서 §13 준수)

- ❌ `firebase deploy` (functions·rules 모두) — 클라우드 컨테이너에 Firebase CLI 인증 없음
- ❌ main 병합 / PR 머지
- ❌ `firestore.rules` 수정 (PR #129 건은 별도 처리)
- ❌ 런타임 검증 6항목 — **로컬에서 허 대표님이 직접 수행**
  (체크리스트: `claude/로컬_런타임검증_체크리스트_ai-guard-grammar.md`)
- ❌ 월간 AI 쿼터 확장 / 독서 OCR 게이트 / 저장소 위생 정리 — 별도 지시서

---

## 8. 실행 모델

- 지시서 지정 모델: **sonnet 4.6**
- 실제 실행 모델: **claude-opus-5** (세션 조회 결과 `session_context.model` = `claude-opus-5`,
  `last_served_model` = `claude-opus-5`)
- 세션이 opus-5로 생성되어 있어 지정 모델과 다르게 실행됨. 작업 절차·범위는 지시서대로 준수함.
