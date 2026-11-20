# 독립 Claude 최종 검토 기록

- 검토 대상 `34862cc9b31d4f0b38177c15bba01a892ef3e33f`
- 검토자 Claude Code · Opus 5.5
- 완료(UTC) `2026-11-20T11:40:00+00:00`

## 질문 원문

~~~~text
HARU2026 PR #428의 독립 검토자입니다. 대상 커밋은 34862cc9b31d4f0b38177c15bba01a892ef3e33f입니다. 이전 독립 검토 3차에서 7223bf23을 승인하고 동일 조건 재검색 및 계정 전환, 소셜 시작 주소를 보강하라는 권고를 남겼습니다. 아래 원문과 변경 diff를 보고 권고 반영, 모의 재현 결과 및 신규 배포 차단 문제 여부를 검토해 한국어로 승인·수정 후 승인 중 판정해 주세요. 실제로 브라우저에서 다른 검색의 늦은 성공·오류 및 같은 조건 재검색 시 늦은 페이지가 화면을 덮지 않고, 저장 중 메모·태그와 다시 열 때 메모가 보존되는 모의 응답 시험을 통과했습니다. 계정 키로 화면을 다시 만들고 앱이나 서버의 실제 회원 인증을 이 diff로 넓히지 않습니다. 코드에는 메모를 서버 응답으로 동기화하는 effect가 없고 readDraft는 문자열 또는 null입니다. 도구 호출·파일 수정·외부 요청·운영 시험은 수행하지 않습니다.

# 내 영상 찾기 독립 검토 3차

- 날짜: 2026-11-20 KST
- 검토 커밋: `7223bf23ca4412ed76b7cdf5d49b24208686117a`
- 검토 대상: b29444ef 이후 도메인 및 늦은 응답 수정 diff
- 검토 세션: `2c5898ec-b6df-4e7f-93f6-4c03aaa06c9a`

## 요청 원문

당신은 이 수정을 한 에이전트와 다른 Claude Code 독립 검토자입니다. HARU2026 PR #428 기준 b29444ef에서 실제 검토 커밋 7223bf23ca4412ed76b7cdf5d49b24208686117a까지의 아래 수정 diff만 검토하세요. 사용자 승인 독립 도메인은 https://videos.haru2026.com이며 기존 후보는 사용하지 않습니다. 이전 독립 결과 원문을 첨부합니다. 중점은 운영 출처 한정·기존 소셜 로그인 유지, 늦은 페이지의 오류와 결과가 새 검색을 덮지 않음, 메모 저장 사이 새 초안·태그 보존입니다. 추가 배포 차단이 있으면 구체적 근거와 수정 방안을, 없으면 승인 여부를 한국어로 회신하세요. 운영 실행 여부를 단정하지 마세요. 도구 호출, 파일 변경, 외부 요청 금지.


이전 독립 검토 원문은 02-independent-review.md, 변경 diff는 위 검토 커밋에 있습니다.

## 결과 원문

# 내 영상 찾기 독립 검토 3차 (b29444ef → 7223bf23)

**판정: 승인.** 이 diff 안에서 배포를 막을 결함은 찾지 못했습니다. 다만 diff 밖에서 확인할 것 3개와, 다음 수정에 넣을 권장 사항 4개가 있습니다.
- 첨부된 diff만 읽었습니다. 도구 호출, 시험, 빌드, 파일 변경, 외부 요청은 하지 않았습니다.
- diff에 없는 코드의 동작은 이전 검토 원문을 근거로만 언급했고, 직접 확인하지는 않았습니다.
- 운영에 실제로 배포·실행됐는지는 판단하지 않습니다.

## 1. 운영 출처 한정과 기존 소셜 로그인 유지: 문제 없음

**출처 교체가 일관됩니다.**
- 서버 허용 목록이 `https://videos.haru2026.com` 하나로 바뀌었습니다(`functions/src/videoFinderCore.ts:32`).
- 연결 창이 쓰는 상수도 같은 값으로 바뀌었습니다(`frontend/src/app/videoFinder/videoFinderBridge.ts:12`).
- 이전 검토 기준으로 CORS는 이 상수를 함께 씁니다. 따라서 이전 후보 `youtube.haru2026.com`은 다음 세 군데에서 모두 거절됩니다.
  - 연결 요청 해석(`frontend/test/videoFinder.test.mjs:106`)
  - 세션 발급(`functions/test/videoFinderCore.test.js:621`)
  - 서버 Origin 검사
- 시험에 이전 후보 거절이 회귀 항목으로 추가된 점도 좋습니다.

**기존 소셜 로그인은 넓어지지 않았습니다.**
- `oauthState` 검사가 정규식 `\b(?:youtube|videos)\.haru2026\.com\b`로 바뀌어 두 도메인 모두 막습니다(`frontend/test/videoFinder.policy.test.cjs:56`).
- 소셜 시작 주소, `postLoginReturn` 허용 목록, `fromProtectedRoute` 흐름은 바뀌지 않았습니다.

**권장 (낮음): 시작 주소 검사가 새 도메인을 보지 않습니다.**
- 바로 다음 줄 `!socialUrls.includes('youtube')`는 여전히 `youtube`만 확인합니다.
- `!/\b(?:youtube|videos)\.haru2026\.com\b/.test(socialUrls)`로 맞춰 주세요.

## 2. 늦게 온 다음 페이지가 새 검색을 덮지 않음: 의도한 경우는 해결, 남는 틈 2개 (낮음)

**해결된 부분**
- 요청할 때의 `searchKey`를 저장해 둡니다.
- 응답과 오류 모두 `activeSearchKey.current`와 비교한 뒤에만 화면 상태를 바꿉니다(`VideoFinderScreen.tsx:252`, `:257`).
- 캐시는 요청할 때의 키로만 저장합니다. 그래서 A를 검색하다 B로 바꾼 경우, A의 결과와 오류가 B 화면, 남은 횟수, 상태 문구에 섞이지 않습니다.

**남는 틈 ① 같은 검색어로 다시 검색할 때**
- 비교 기준이 검색 키라서, 같은 조건으로 다시 검색하면 키가 바뀌지 않습니다.
- 이때 이전 요청의 다음 페이지나 오류가 늦게 오면, 새 첫 페이지 결과를 오래된 `current` 기준 상태로 덮을 수 있습니다.
- 같은 검색어의 공개 결과라 피해는 작습니다. 다만 남은 횟수 표시와 `moreError`는 틀릴 수 있습니다.
- 수정 방안: 키 비교 대신 요청 번호를 씁니다. 예: `const gen = ++searchGen.current`를 두고, `runSearch`가 시작될 때도 이 번호를 올린 뒤 응답 시 같은지 비교합니다.

**남는 틈 ② 계정 경계**
- `cacheKey`에는 `uid`가 들어가지만, 화면 반영 여부를 판단하는 비교에는 `uid`가 없습니다.
- 같은 탭에서 계정이 바뀌었는데 검색 키가 같으면, 이전 계정 응답의 남은 횟수가 새 계정 화면에 반영될 수 있습니다.
- 계정이 바뀔 때 화면이 다시 마운트되거나 `activeSearchKey`가 초기화된다면 이 문제는 생기지 않습니다. 이 부분은 diff 밖이라 확인이 필요합니다.
- 위의 요청 번호 방식이나 `${uid}|${key}` 비교로 함께 막을 수 있습니다.

## 3. 메모 저장 중 새 초안·태그 보존: 방향은 맞음, diff 밖 확인 2개

**해결된 부분**
- 보낸 메모와 태그 문자열을 따로 저장해 둡니다.
- 초안은 저장소 값이 보낸 메모와 같을 때만 지웁니다.
- 태그 입력은 그사이 바뀌지 않았을 때만 서버 정규화 값으로 바꿉니다.
- 저장 뒤 `setNote`를 하지 않으므로 입력 중인 메모가 유지됩니다.
- 실패하면 초안이 그대로 남습니다.

**확인 필요 (diff 밖)**
1. **메모 동기화 effect가 있는지.** `SavedCard`에 `item.note` → `setNote` 같은 effect가 있다면, `onChanged(result.item)` 직후 입력 중이던 새 메모가 저장된 값으로 덮입니다. 초안을 쓰는 effect가 이어서 저장소 초안까지 덮을 수 있습니다. 그런 effect가 있다면 "변경되지 않았을 때만 반영" 조건을 넣어 주세요.
2. **`readDraft` 반환 형식.** 반환값이 문자열이 아니라 객체 형태(예: `{note, at}`)라면 `===` 비교가 항상 거짓입니다. 그러면 초안이 영영 지워지지 않고 다른 기기의 최신 메모를 가릴 수 있습니다. 초안을 쓸 때 디바운스를 쓰더라도, 나중에 다시 쓰므로 유실은 없습니다.

**권장 (낮음)**
- 저장 중에 내용이 바뀌었다면 "메모를 저장했어요" 대신 "저장 뒤 바뀐 내용은 아직 저장 전이에요"처럼 안내하면 혼동이 줄어듭니다.

## 시험 보강 권장

이번 diff는 도메인 관련 시험만 바꿨습니다. 아래 두 경우의 시험이 없습니다.
- 늦게 온 페이지가 다른 검색이나 다시 검색한 결과를 덮지 않는 경우
- 저장 중에 입력한 메모·태그가 보존되는 경우

이 수정의 핵심이므로 프런트 단위 시험 2건을 추가하길 권합니다.

## 운영 전 조건 (코드 밖)

1. 저장소 전체에서 `youtube.haru2026.com` 잔존 여부를 확인합니다. 이 diff에 없는 파일이 대상입니다.
   - `firebase.json` 머리글과 CSP
   - `HomePageV2.tsx` 카드 링크
   - 독립 `index.html`과 canonical
   - 문서와 운영 안내
2. Hosting 사이트 `haru2026-video-finder`에 `videos.haru2026.com` 커스텀 도메인을 연결한 뒤 실제 로그인 연결을 확인합니다. iOS Safari 팝업도 포함합니다. 이전 조건대로 미리보기와 기본 `web.app` 주소에서는 로그인할 수 없는 것이 정상입니다.
3. 이전 조건은 그대로 유지됩니다.
   - 색인을 먼저 배포한 뒤 함수를 배포합니다.
   - 새 경로와 `rateLimits` 탈퇴 범위, 한도 숫자는 승인이 필요합니다.

**Slack 기록용 요약:** 내 영상 찾기 7223bf23(b29444ef 기준) 독립 검토 3차 결과 승인. 배포 차단 결함 없음. 출처는 videos.haru2026.com 하나로 한정되고 이전 후보는 거절되며, 소셜 로그인 허용 목록은 바뀌지 않음. 늦은 페이지와 메모 저장 보존은 의도한 경우 해결. 남은 낮음 등급: 같은 검색어로 다시 검색할 때와 계정 경계의 틈은 요청 번호 방식 권장, 시작 주소 검사에 videos 추가, 관련 시험 2건 추가. 확인 필요: SavedCard 메모 동기화 effect와 readDraft 형식, 이전 도메인 잔존 여부, 커스텀 도메인 연결 뒤 로그인 확인. diff 정적 검토만 했고 시험·빌드·배포는 하지 않음.


추가 diff
diff --git a/frontend/src/app/pages/VideoFinderPage.tsx b/frontend/src/app/pages/VideoFinderPage.tsx
index 9553674d..c4ca4deb 100644
--- a/frontend/src/app/pages/VideoFinderPage.tsx
+++ b/frontend/src/app/pages/VideoFinderPage.tsx
@@ -11,5 +11,5 @@ type Props = {

 export function VideoFinderPage({ basePath, variant }: Props) {
   const { user } = useAuth();
-  return <VideoFinderScreen basePath={basePath} variant={variant} client={haruVideoFinderClient} accountKey={user?.uid || ''} />;
+  return <VideoFinderScreen key={user?.uid} basePath={basePath} variant={variant} client={haruVideoFinderClient} accountKey={user?.uid || ''} />;
 }
diff --git a/frontend/src/app/videoFinder/VideoFinderScreen.tsx b/frontend/src/app/videoFinder/VideoFinderScreen.tsx
index d8916e63..f1af3ca4 100644
--- a/frontend/src/app/videoFinder/VideoFinderScreen.tsx
+++ b/frontend/src/app/videoFinder/VideoFinderScreen.tsx
@@ -195,12 +195,13 @@ export function VideoFinderScreen({ basePath, variant, client, accountKey, haruO

   useEffect(() => { setDraft(urlFilters); setFormError(''); }, [urlFilters]);

-  const activeSearchKey = useRef('');
+  const activeSearch = useRef<{ key: string } | null>(null);
   const lastSearchKey = useRef('');
   if (searchKey) lastSearchKey.current = searchKey;

   const runSearch = useCallback(async (key: string, filters: SearchFilters, force = false) => {
-    activeSearchKey.current = key;
+    const request = { key };
+    activeSearch.current = request;
     const cacheKey = `${uid}|${key}`;
     if (!force && searchCache.has(cacheKey)) {
       setSearchState(searchCache.get(cacheKey)!);
@@ -217,14 +218,16 @@ export function VideoFinderScreen({ basePath, variant, client, accountKey, haruO
       }
       const result = await pending.finally(() => pendingSearches.delete(cacheKey));
       const ready: SearchState = { ...loading, status: 'ready', videos: result.videos, nextPageToken: result.nextPageToken, notice: result.notice };
-      rememberSearch(cacheKey, ready);
+      if (activeSearch.current === request || activeSearch.current?.key !== key) {
+        rememberSearch(cacheKey, ready);
+      }
+      // 같은 조건을 다시 고른 경우까지 해당 요청의 화면에서만 결과를 반영한다.
+      if (activeSearch.current !== request) return;
       setRemainingSearches(result.remainingSearches);
-      // 기다리는 사이 다른 검색으로 옮겼으면 늦게 온 결과로 화면을 덮지 않는다.
-      if (activeSearchKey.current !== key) return;
       setSearchState(ready);
       setStatus(result.videos.length ? `영상 ${result.videos.length}개를 찾았어요.` : '조건에 맞는 영상을 찾지 못했어요.');
     } catch (error) {
-      if (activeSearchKey.current !== key) return;
+      if (activeSearch.current !== request) return;
       const message = friendlyErrorMessage(error);
       setSearchState({ ...loading, status: 'error', error: message });
       setStatus('');
@@ -232,15 +235,15 @@ export function VideoFinderScreen({ basePath, variant, client, accountKey, haruO
   }, [client, uid]);

   useEffect(() => {
-    if (!searchKey || !uid) { activeSearchKey.current = ''; setSearchState(null); return; }
+    if (!searchKey || !uid) { activeSearch.current = null; setSearchState(null); return; }
     void runSearch(searchKey, urlFilters);
   }, [searchKey, uid, urlFilters, runSearch]);

   const loadMore = async () => {
-    const requestedSearchKey = searchKey;
-    if (!requestedSearchKey || activeSearchKey.current !== requestedSearchKey ||
-        !searchState?.nextPageToken || searchState.loadingMore) return;
-    const cacheKey = `${uid}|${requestedSearchKey}`;
+    const request = activeSearch.current;
+    if (!request || request.key !== searchKey || !searchState?.nextPageToken || searchState.loadingMore) return;
+    const cacheKey = `${uid}|${request.key}`;
+    const cachedAtStart = searchCache.get(cacheKey);
     const current = { ...searchState, loadingMore: true, moreError: '' };
     setSearchState(current);
     try {
@@ -248,13 +251,16 @@ export function VideoFinderScreen({ basePath, variant, client, accountKey, haruO
       const seen = new Set(current.videos.map((v) => v.videoId));
       const added = result.videos.filter((v) => !seen.has(v.videoId));
       const next: SearchState = { ...current, loadingMore: false, videos: [...current.videos, ...added], nextPageToken: result.nextPageToken, notice: result.notice || current.notice };
-      rememberSearch(cacheKey, next);
-      if (activeSearchKey.current !== requestedSearchKey) return;
+      if (searchCache.get(cacheKey) === cachedAtStart &&
+          (activeSearch.current === request || activeSearch.current?.key !== request.key)) {
+        rememberSearch(cacheKey, next);
+      }
+      if (activeSearch.current !== request) return;
       setRemainingSearches(result.remainingSearches);
       setSearchState(next);
       setStatus(added.length ? `영상 ${added.length}개를 더 찾았어요.` : '더 보여드릴 새 영상이 없어요.');
     } catch (error) {
-      if (activeSearchKey.current !== requestedSearchKey) return;
+      if (activeSearch.current !== request) return;
       setSearchState({ ...current, loadingMore: false, moreError: friendlyErrorMessage(error) });
     }
   };
diff --git a/frontend/src/video-finder-standalone/main.tsx b/frontend/src/video-finder-standalone/main.tsx
index fade378d..efbc028d 100644
--- a/frontend/src/video-finder-standalone/main.tsx
+++ b/frontend/src/video-finder-standalone/main.tsx
@@ -156,7 +156,7 @@ function StandaloneShell() {
   }, [end]);

   if (!session) return <StandaloneSignIn onSession={onSession} notice={notice} />;
-  return <VideoFinderScreen basePath="" variant="standalone" client={client} accountKey={session.accountKey} haruOrigin={HARU_ORIGIN} onSignOut={signOut} />;
+  return <VideoFinderScreen key={session.accountKey} basePath="" variant="standalone" client={client} accountKey={session.accountKey} haruOrigin={HARU_ORIGIN} onSignOut={signOut} />;
 }

 function RedirectToHaru({ path }: { path: string }) {
diff --git a/frontend/test/videoFinder.policy.test.cjs b/frontend/test/videoFinder.policy.test.cjs
index c9828e56..1e69a874 100644
--- a/frontend/test/videoFinder.policy.test.cjs
+++ b/frontend/test/videoFinder.policy.test.cjs
@@ -54,7 +54,7 @@ assert(!/<iframe/i.test(page), '영상은 YouTube에서 재생하고 화면 안

 // 4) 로그인·결제 경로 보존: URL로 토큰을 넘기는 기존 흐름에 독립 주소를 추가하지 않는다.
 assert(!/\b(?:youtube|videos)\.haru2026\.com\b/.test(oauthState), '소셜 로그인 returnOrigin 허용 목록을 넓히지 않는다');
-assert(!socialUrls.includes('youtube'), '소셜 로그인 시작 주소 변경 없음');
+assert(!/(?:youtube|videos)\.haru2026\.com/.test(socialUrls), '소셜 로그인 시작 주소 변경 없음');
 assert(postLoginReturn.includes("const SIGNED_IN_RETURN_PATHS = new Set(['/settings', '/sayu', '/video-finder/connect']);"), '로그인 복귀 허용 목록은 /video-finder/connect만 추가');
 assert(connect.includes("rememberPostLoginReturnPath('/video-finder/connect'); navigate('/login', { state: { fromProtectedRoute: true } });"), '확인 창은 정확한 경로만 기억하고 기존 fromProtectedRoute 상태로 로그인에 간다');
 assert(connect.includes('VIDEO_FINDER_CONNECT_STORAGE_KEY') && connect.includes('parseConnectRequest(window.location.hash, allowedOrigins)'), '연결 요청은 검증 후 같은 출처 sessionStorage에서만 복원');
~~~~

## 결과 원문

# 내 영상 찾기 독립 검토 4차 (7223bf23 → 34862cc9)

**판정: 승인.** 이 diff 안에서 배포를 막을 결함은 찾지 못했습니다. 3차 권고 중 코드 항목 3개(같은 조건 재검색, 계정 전환, 소셜 시작 주소)가 모두 반영됐습니다. 남은 것은 낮음 등급 권장 2개와 기존 운영 전 조건입니다.

- 첨부된 diff만 정적으로 읽었습니다. 도구 호출, 시험, 빌드, 파일 변경, 외부 요청은 하지 않았습니다.
- 브라우저 모의 응답 시험 통과 내용은 전달받은 내용을 근거로 적었고, 직접 재현하지는 않았습니다.
- `SavedCard`에 메모 동기화 effect가 없다는 점과 `readDraft`가 `string | null`이라는 점도 전달받은 내용을 근거로 했습니다. diff 밖이라 직접 확인하지 않았습니다.
- 운영에 실제로 배포·실행됐는지는 판단하지 않습니다.

## 1. 3차 권고 반영 여부

| 권고 | 반영 | 근거 |
|---|---|---|
| 같은 조건 재검색 틈 | 반영 | 요청마다 새 객체 `{ key }`를 만들고 비교함 |
| 계정 경계 틈 | 반영 | 두 진입점 모두 `key`로 화면을 다시 마운트함 |
| 소셜 시작 주소 검사 | 반영 | 정규식으로 두 도메인을 함께 검사함 |
| 메모·태그 diff 밖 확인 2개 | 해소(전달받은 내용 기준) | effect 없음, `readDraft`는 `string \| null` |
| 늦은 페이지·메모 보존 시험 | 일부 | 브라우저 모의 시험은 통과했지만, 저장소 회귀 시험은 diff에 없음 |
| 저장 중 변경 안내 문구 | 미반영 | 낮음, 차단 아님 |

## 2. 늦은 응답 처리: 문제 없음

**요청 식별 방식이 맞습니다.**
- `runSearch`는 호출할 때마다 새 `request` 객체를 `activeSearch.current`에 넣습니다(`VideoFinderScreen.tsx:203`).
- 응답과 오류 모두 `activeSearch.current !== request`이면 화면을 바꾸지 않습니다.
- 그래서 키가 같아도 이전 요청과 새 요청이 구분됩니다. 3차의 남는 틈 ①이 닫혔습니다.
- `loadMore`는 시작할 때의 `activeSearch.current`를 붙잡아 둡니다. 그사이 같은 조건으로 다시 검색하면 참조가 바뀌므로, 늦은 페이지와 `moreError`가 새 첫 페이지를 덮지 않습니다.

**캐시 기록 조건도 맞습니다.**
- `runSearch`는 두 경우에만 캐시를 씁니다.
  - 아직 자신이 활성 요청일 때
  - 다른 키로 옮겨 갔을 때
- 같은 키의 새 요청이 진행 중이면 이전 결과로 캐시를 덮지 않습니다.
- `loadMore`는 `cachedAtStart`와 같을 때만 씁니다. 그래서 그사이 같은 키로 다시 검색해 새 첫 페이지가 캐시에 들어갔다면, 오래된 페이지를 붙이지 않습니다.
- A → B → A로 돌아온 경우도 따져 봤습니다. 돌아올 때 캐시의 첫 페이지가 다시 쓰이고, 그 뒤 늦게 온 A의 다음 페이지는 버려집니다. 화면이 섞이지 않는 쪽이고, 사용자는 "더 보기"를 다시 누르면 됩니다.

**동작 변화 (낮음, 차단 아님)**
- `setRemainingSearches`가 활성 요청 확인 뒤로 옮겨졌습니다.
- 그래서 다른 검색의 늦은 응답은 남은 횟수 표시를 갱신하지 않습니다.
- 서버 기준으로는 늦은 응답의 횟수가 더 최신일 수 있어, 다음 응답이 올 때까지 표시가 1회 정도 많게 보일 수 있습니다.
- 화면을 섞지 않는다는 원칙에는 맞는 선택입니다. 한도 자체는 서버가 집행하므로 보안 문제는 아닙니다.

## 3. 계정 전환: 문제 없음

- `VideoFinderPage`는 `key={user?.uid}`를, 독립 화면은 `key={session.accountKey}`를 씁니다. 따라서 계정이 바뀌면 `activeSearch`와 화면 상태가 모두 새로 만들어집니다.
- 이전 인스턴스에서 늦게 온 응답은 마운트 해제된 컴포넌트의 상태 갱신이라 화면에 반영되지 않습니다.
- 이전 인스턴스가 캐시에 쓰는 값은 `${uid}|${key}`, 즉 이전 계정 키로 한정됩니다.
- `key`는 화면을 다시 만들 뿐입니다. 앱이나 서버의 회원 인증 범위는 이 diff로 넓어지지 않았다는 판단에 동의합니다.

## 4. 소셜 로그인 시작 주소 검사: 문제 없음

- 이제 `videos.haru2026.com`도 검사합니다.
- 참고로 기존의 `includes('youtube')`보다 범위가 좁아졌습니다. 예전에는 `youtube` 문자열이 어디에든 있으면 실패했지만, 이제는 haru2026 하위 도메인만 봅니다.
- 이번 검사의 목적은 독립 출처를 넣지 않는 것이므로 문제는 없습니다.

## 권장 (낮음, 다음 수정에서)

1. **회귀 시험을 저장소에 넣어 주세요.** 이번에 통과한 브라우저 모의 시나리오를 프런트 단위 시험으로 옮기길 권합니다.
   - 다른 검색의 늦은 성공·오류
   - 같은 조건 재검색 중 늦은 페이지
   - 저장 중 메모·태그 보존
   - 다시 열 때 메모 보존
   - 계정 키가 바뀔 때 다시 마운트됨
2. **저장 중 변경 안내 문구.** 저장 중에 메모가 바뀐 경우 "메모를 저장했어요" 대신 다른 안내를 보여 주세요. 3차 권고 그대로입니다.

## 운영 전 조건 (코드 밖, 3차와 동일)

1. 저장소 전체에서 `youtube.haru2026.com`이 남아 있는지 확인합니다.
   - `firebase.json` 머리글과 CSP
   - `HomePageV2.tsx`
   - 독립 `index.html`과 canonical
   - 문서
2. `haru2026-video-finder`에 `videos.haru2026.com`을 연결한 뒤 실제 로그인을 확인합니다. iOS Safari 팝업도 포함합니다. 미리보기와 `web.app` 주소에서 로그인이 거절되는 것이 정상입니다.
3. 배포 순서와 승인 항목을 지킵니다.
   - 색인을 먼저 배포한 뒤 함수를 배포합니다.
   - 새 경로, `rateLimits` 탈퇴 범위, 한도 숫자는 승인이 필요합니다.

**Slack 기록용 요약:** 내 영상 찾기 34862cc9(7223bf23 기준) 독립 검토 4차 결과 승인, 배포 차단 결함 없음. 3차 권고 반영: 요청 객체 비교로 같은 조건 재검색 중 늦은 페이지·오류 차단, 계정 키로 화면 재마운트, 소셜 시작 주소 검사에 videos 추가. 메모 effect 없음과 readDraft가 문자열·null이라는 점은 전달받은 내용 기준으로 해소. 브라우저 모의 응답 시험 통과는 전달받은 결과이며 직접 재현하지 않음. 남은 낮음 등급: 모의 시나리오의 저장소 회귀 시험화, 저장 중 변경 안내 문구. 운영 전 조건(이전 도메인 잔존 확인, 커스텀 도메인 연결 뒤 로그인 확인, 색인 먼저 배포 뒤 함수 배포, 경로·한도 승인)은 유지. diff 정적 검토만 했고 시험·빌드·배포는 하지 않음.
