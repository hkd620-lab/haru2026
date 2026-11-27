# PR #455 모바일 하단 메뉴 교차 검토

## Codex 자동 리뷰

- 실행 1. 초안 해제 자동 요청. 요청 댓글 없음. 시작 2026-11-27 12:10:34 UTC, 완료 12:11:05 UTC. 대상 `1e98173bc3cb1c2865e7fb2f411bbe26003dd9cc`. 지적 없음.

- 실행 2. [요청 댓글 7218005667](https://github.com/hkd620-lab/haru2026/pull/455#issuecomment-7218005667). 시작 2026-11-27 12:14:43 UTC, 완료 12:15:27 UTC. 대상 `24e37ea04557734d5968717f041a993ea462ca7c`. 지적 없음.

- 결과는 [요약 댓글 7217928865](https://github.com/hkd620-lab/haru2026/pull/455#issuecomment-7217928865)에 기록됐습니다. 별도 리뷰 ID는 없습니다.

## Claude Code 독립 검토

### 실행 1 요청 원문 (2026-11-27T12:10:20.309466+00:00)

~~~~text
독립 검토 요청. HEAD 1e98173b. iPhone 하단 메뉴 두 이름의 모바일 말줄임 제거. 코드 수정·외부 작업 없이 diff를 검토하고 표시·접근성·기존 경로/권한·회귀·작업 규모/멈춤 조건을 확인해 승인/수정 후 승인/재설계 판정 바랍니다. Vite 빌드 통과. WebKit에서 실제 BottomNav 컴포넌트를 320/375/390/640/1024px로 일반 및 개발자 권한을 모의하여 렌더링했고 링크 대상/활성 표시/레이블/넘침과 메뉴 높이를 확인했습니다.
diff --git a/frontend/src/app/components/BottomNav.tsx b/frontend/src/app/components/BottomNav.tsx
index 7ce90f92..c3c35760 100644
--- a/frontend/src/app/components/BottomNav.tsx
+++ b/frontend/src/app/components/BottomNav.tsx
@@ -21,8 +21,8 @@ export function BottomNav() {

   const baseItems = [
     { path: homePath, icon: Home, label: 'HARU' },
-    { path: '/sayu', icon: Sparkles, label: 'SAYU·나의 기록' },
-    { path: '/sayu-together', icon: Users, label: '공개 기록 함께읽기' },
+    { path: '/sayu', icon: Sparkles, label: 'SAYU·나의 기록', mobileLabel: '나의 기록' },
+    { path: '/sayu-together', icon: Users, label: '공개 기록 함께읽기', mobileLabel: '함께 읽기' },
     { path: '/fun-videos', icon: Clapperboard, label: '재미 영상' },
     // 구독은 설정 화면·하단 안내(Footer)에서 들어간다 (은퇴자 대상 메뉴 정리 2026-11-18)
     { path: '/settings', icon: Settings, label: '설정' },
@@ -68,15 +68,9 @@ export function BottomNav() {
                 }}
               >
                 <Icon className="mb-1 h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
-                <span
-                  className="min-h-[34px] w-full min-w-0 max-w-full overflow-hidden text-center text-[14px] leading-[1.2] tracking-normal break-keep sm:text-base"
-                  style={{
-                    display: '-webkit-box',
-                    WebkitBoxOrient: 'vertical',
-                    WebkitLineClamp: 2,
-                  }}
-                >
-                  {item.label}
+                <span className="min-h-[34px] w-full break-keep text-center text-xs leading-[1.2] sm:text-base">
+                  <span className="sm:hidden">{'mobileLabel' in item ? item.mobileLabel : item.label}</span>
+                  <span className="hidden sm:inline">{item.label}</span>
                 </span>
               </Link>
             );
~~~~

### 실행 1 결과 원문 (2026-11-27T12:11:15.059113+00:00)

## 판정: **수정 후 승인**

말줄임을 없애고 모바일에서 짧은 이름을 보여 주는 방향은 맞습니다. 다만 모바일 글자 크기가 14px에서 12px로 줄었습니다. 이 변경은 다섯 메뉴 모두에 적용되고, 커밋 메시지에는 적혀 있지 않습니다. 이 점만 고치면 승인합니다.

> 검토 범위: 이 세션에서는 Bash와 파일 읽기 도구를 쓸 수 없었습니다. 그래서 받은 diff만 검토했고 빌드, 렌더링, `git status`를 제가 다시 실행하지는 못했습니다. 아래 결론은 이 diff와 기장이 보고한 WebKit 확인 결과를 근거로 합니다. diff 밖 코드(개발자 메뉴 항목, `Link`의 다른 속성)는 보지 못했습니다.

### 1. 고칠 것: 모바일 글자 크기가 줄었음
```diff
- ... text-[14px] leading-[1.2] ... sm:text-base
+ ... text-xs leading-[1.2] sm:text-base        // 12px
```
- 이 변경은 두 메뉴만이 아니라 HARU·재미 영상·설정·개발자 메뉴까지 640px 미만 화면의 모든 이름에 적용됩니다. 주 사용자가 은퇴자라서 글씨가 작아지면 읽기 어려워집니다.
- 짧은 이름이라면 14px에서도 넘치지 않을 가능성이 큽니다. 320px에 메뉴 6개면 칸 하나가 약 53px입니다. "나의 기록"은 14px에서 약 60px라서 `break-keep` 때문에 "나의 / 기록" 두 줄로 나뉘고, 두 줄 높이는 34px로 기존 `min-h-[34px]` 안에 들어갑니다. 이 추정은 실측으로 확인해야 합니다.
- 제안:
```tsx
<span className="min-h-[34px] w-full min-w-0 break-keep text-center text-[14px] leading-[1.2] sm:text-base">
  <span className="sm:hidden">{'mobileLabel' in item ? item.mobileLabel : item.label}</span>
  <span className="hidden sm:inline">{item.label}</span>
</span>
```
- 14px로 320px에서 넘침이나 3줄 줄바꿈이 생기면 13px까지만 줄이고, 그 사유를 커밋 메시지에 적어 주세요.
- `min-w-0`은 남겨 두기를 권합니다. 줄바꿈되지 않는 긴 이름(앞으로 추가될 개발자 메뉴 등)이 칸 밖으로 밀려나는 것을 막아 줍니다. `overflow-hidden`이나 줄 수 제한을 빼는 것에는 동의합니다.

### 2. 확인 결과 (문제 없음)
| 항목 | 결과 |
|---|---|
| 표시 | 640px 미만은 짧은 이름, 640px 이상은 기존 전체 이름입니다. `mobileLabel`이 없는 메뉴는 원래 `label`을 씁니다. |
| 접근성 | `sm:hidden`과 `hidden sm:inline`은 `display:none` 방식이라 숨긴 이름은 화면낭독기가 읽지 않습니다. 이름이 두 번 읽히지 않고, 보이는 글자와 낭독되는 이름이 같습니다. |
| 경로·권한 | `path`, `homePath`, 아이콘, 활성 표시 조건은 바뀌지 않았습니다. Firestore 경로와도 관계없습니다. 개발자 권한 메뉴는 `mobileLabel`이 없어 기존 이름 그대로 나옵니다(diff 밖이라 기장 실측 결과에 의존). |
| 타입 | `'mobileLabel' in item`으로 유니온 타입을 좁히는 방식이라 안전합니다. Vite 빌드 통과는 보고로만 확인했습니다. |
| 회귀 | 640px 이상에서 줄 수 제한이 없어져 이름이 3줄이 되면 메뉴 높이가 커질 수 있습니다. 보고하신 640/1024px 결과에서 이상이 없었다면 괜찮습니다. |

### 3. 확인해 주실 점 (차단 사유 아님)
- **"공개 기록 함께읽기" → "함께 읽기"**: 모바일 이름에서 '공개'가 빠졌습니다. 공개된 기록만 읽는 곳이라는 표시가 사라지고, "SAYU" 이름도 모바일에서는 보이지 않습니다. 화면 문구를 바꾸는 소규모 작업이지만 이름 결정은 허대표님께 보고에 함께 적어 주세요.
- 띄어쓰기가 다릅니다. 640px 이상은 "함께읽기", 모바일은 "함께 읽기"입니다. 한쪽으로 맞추기를 권합니다.
- `Link`에 `aria-label={item.label}`이 따로 있다면 모바일에서 보이는 이름과 낭독되는 이름이 달라집니다. diff에는 보이지 않았으니 없는지만 확인해 주세요.

### 4. 작업 규모와 멈춤 조건
- 소규모 작업입니다(UI 문구와 글자 크기). 모델·라우터·새 기능 변경은 없습니다.
- 커밋 메시지는 "말줄임 제거"인데 실제로는 이름 단축과 글자 축소도 들어 있어 내용이 일부 다릅니다. 1번을 고치면서 메시지를 실제 변경에 맞춰 주세요. 예: `fix: 모바일 하단 메뉴 짧은 이름 적용·말줄임 제거`.

---
**Slack 기록용 확정 요약** (요청하신 대로 Slack에는 게시하지 않았습니다)
> CC 독립 검토 · HEAD 1e98173b · BottomNav 모바일 말줄임 제거 → **수정 후 승인**. 요청: 모바일 글자 크기를 14px로 되돌리고(넘치면 13px까지, 사유를 커밋에 기록) `min-w-0`를 유지할 것, 커밋 메시지를 실제 변경에 맞출 것. 경로·권한·접근성·타입 문제 없음. 허대표님 확인 요청: 모바일 이름 "함께 읽기"에서 '공개'가 빠진 점. 한계: CC는 Bash를 쓸 수 없어 diff만 검토했고 빌드·렌더링은 기장 보고를 근거로 함.

### 실행 2 요청 원문 (2026-11-27T12:14:49.951722+00:00)

~~~~text
PR #455 재검토 요청. 검토 대상 HEAD 24e37ea0. 아래 이전 판정 원문 전체와 수정 diff 및 최종 diff를 검토하세요. 변경 사항: 모바일 기존 14px 색상/크기 유지 및 min-w-0 복원, 변경 내용을 후속 커밋에 명시. 기존 화면 이름은 유지. 일반/개발자 메뉴의 320·375·390·640·1024px WebKit 검증, 링크 경로, 활성 표시, 가로 넘침, 웹 빌드가 모두 통과했습니다. Link에 aria-label 덮어쓰기 없음. 코드 수정 없이 최종 승인/수정 후 승인/재설계 판정 부탁합니다.
## 판정: **수정 후 승인**

말줄임을 없애고 모바일에서 짧은 이름을 보여 주는 방향은 맞습니다. 다만 모바일 글자 크기가 14px에서 12px로 줄었습니다. 이 변경은 다섯 메뉴 모두에 적용되고, 커밋 메시지에는 적혀 있지 않습니다. 이 점만 고치면 승인합니다.

> 검토 범위: 이 세션에서는 Bash와 파일 읽기 도구를 쓸 수 없었습니다. 그래서 받은 diff만 검토했고 빌드, 렌더링, `git status`를 제가 다시 실행하지는 못했습니다. 아래 결론은 이 diff와 기장이 보고한 WebKit 확인 결과를 근거로 합니다. diff 밖 코드(개발자 메뉴 항목, `Link`의 다른 속성)는 보지 못했습니다.

### 1. 고칠 것: 모바일 글자 크기가 줄었음
```diff
- ... text-[14px] leading-[1.2] ... sm:text-base
+ ... text-xs leading-[1.2] sm:text-base        // 12px
```
- 이 변경은 두 메뉴만이 아니라 HARU·재미 영상·설정·개발자 메뉴까지 640px 미만 화면의 모든 이름에 적용됩니다. 주 사용자가 은퇴자라서 글씨가 작아지면 읽기 어려워집니다.
- 짧은 이름이라면 14px에서도 넘치지 않을 가능성이 큽니다. 320px에 메뉴 6개면 칸 하나가 약 53px입니다. "나의 기록"은 14px에서 약 60px라서 `break-keep` 때문에 "나의 / 기록" 두 줄로 나뉘고, 두 줄 높이는 34px로 기존 `min-h-[34px]` 안에 들어갑니다. 이 추정은 실측으로 확인해야 합니다.
- 제안:
```tsx
<span className="min-h-[34px] w-full min-w-0 break-keep text-center text-[14px] leading-[1.2] sm:text-base">
  <span className="sm:hidden">{'mobileLabel' in item ? item.mobileLabel : item.label}</span>
  <span className="hidden sm:inline">{item.label}</span>
</span>
```
- 14px로 320px에서 넘침이나 3줄 줄바꿈이 생기면 13px까지만 줄이고, 그 사유를 커밋 메시지에 적어 주세요.
- `min-w-0`은 남겨 두기를 권합니다. 줄바꿈되지 않는 긴 이름(앞으로 추가될 개발자 메뉴 등)이 칸 밖으로 밀려나는 것을 막아 줍니다. `overflow-hidden`이나 줄 수 제한을 빼는 것에는 동의합니다.

### 2. 확인 결과 (문제 없음)
| 항목 | 결과 |
|---|---|
| 표시 | 640px 미만은 짧은 이름, 640px 이상은 기존 전체 이름입니다. `mobileLabel`이 없는 메뉴는 원래 `label`을 씁니다. |
| 접근성 | `sm:hidden`과 `hidden sm:inline`은 `display:none` 방식이라 숨긴 이름은 화면낭독기가 읽지 않습니다. 이름이 두 번 읽히지 않고, 보이는 글자와 낭독되는 이름이 같습니다. |
| 경로·권한 | `path`, `homePath`, 아이콘, 활성 표시 조건은 바뀌지 않았습니다. Firestore 경로와도 관계없습니다. 개발자 권한 메뉴는 `mobileLabel`이 없어 기존 이름 그대로 나옵니다(diff 밖이라 기장 실측 결과에 의존). |
| 타입 | `'mobileLabel' in item`으로 유니온 타입을 좁히는 방식이라 안전합니다. Vite 빌드 통과는 보고로만 확인했습니다. |
| 회귀 | 640px 이상에서 줄 수 제한이 없어져 이름이 3줄이 되면 메뉴 높이가 커질 수 있습니다. 보고하신 640/1024px 결과에서 이상이 없었다면 괜찮습니다. |

### 3. 확인해 주실 점 (차단 사유 아님)
- **"공개 기록 함께읽기" → "함께 읽기"**: 모바일 이름에서 '공개'가 빠졌습니다. 공개된 기록만 읽는 곳이라는 표시가 사라지고, "SAYU" 이름도 모바일에서는 보이지 않습니다. 화면 문구를 바꾸는 소규모 작업이지만 이름 결정은 허대표님께 보고에 함께 적어 주세요.
- 띄어쓰기가 다릅니다. 640px 이상은 "함께읽기", 모바일은 "함께 읽기"입니다. 한쪽으로 맞추기를 권합니다.
- `Link`에 `aria-label={item.label}`이 따로 있다면 모바일에서 보이는 이름과 낭독되는 이름이 달라집니다. diff에는 보이지 않았으니 없는지만 확인해 주세요.

### 4. 작업 규모와 멈춤 조건
- 소규모 작업입니다(UI 문구와 글자 크기). 모델·라우터·새 기능 변경은 없습니다.
- 커밋 메시지는 "말줄임 제거"인데 실제로는 이름 단축과 글자 축소도 들어 있어 내용이 일부 다릅니다. 1번을 고치면서 메시지를 실제 변경에 맞춰 주세요. 예: `fix: 모바일 하단 메뉴 짧은 이름 적용·말줄임 제거`.

---
**Slack 기록용 확정 요약** (요청하신 대로 Slack에는 게시하지 않았습니다)
> CC 독립 검토 · HEAD 1e98173b · BottomNav 모바일 말줄임 제거 → **수정 후 승인**. 요청: 모바일 글자 크기를 14px로 되돌리고(넘치면 13px까지, 사유를 커밋에 기록) `min-w-0`를 유지할 것, 커밋 메시지를 실제 변경에 맞출 것. 경로·권한·접근성·타입 문제 없음. 허대표님 확인 요청: 모바일 이름 "함께 읽기"에서 '공개'가 빠진 점. 한계: CC는 Bash를 쓸 수 없어 diff만 검토했고 빌드·렌더링은 기장 보고를 근거로 함.
diff --git a/frontend/src/app/components/BottomNav.tsx b/frontend/src/app/components/BottomNav.tsx
index c3c35760..266cf3ef 100644
--- a/frontend/src/app/components/BottomNav.tsx
+++ b/frontend/src/app/components/BottomNav.tsx
@@ -68,7 +68,7 @@ export function BottomNav() {
                 }}
               >
                 <Icon className="mb-1 h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
-                <span className="min-h-[34px] w-full break-keep text-center text-xs leading-[1.2] sm:text-base">
+                <span className="min-h-[34px] w-full min-w-0 break-keep text-center text-[14px] leading-[1.2] sm:text-base">
                   <span className="sm:hidden">{'mobileLabel' in item ? item.mobileLabel : item.label}</span>
                   <span className="hidden sm:inline">{item.label}</span>
                 </span>
diff --git a/frontend/src/app/components/BottomNav.tsx b/frontend/src/app/components/BottomNav.tsx
index 7ce90f92..266cf3ef 100644
--- a/frontend/src/app/components/BottomNav.tsx
+++ b/frontend/src/app/components/BottomNav.tsx
@@ -21,8 +21,8 @@ export function BottomNav() {

   const baseItems = [
     { path: homePath, icon: Home, label: 'HARU' },
-    { path: '/sayu', icon: Sparkles, label: 'SAYU·나의 기록' },
-    { path: '/sayu-together', icon: Users, label: '공개 기록 함께읽기' },
+    { path: '/sayu', icon: Sparkles, label: 'SAYU·나의 기록', mobileLabel: '나의 기록' },
+    { path: '/sayu-together', icon: Users, label: '공개 기록 함께읽기', mobileLabel: '함께 읽기' },
     { path: '/fun-videos', icon: Clapperboard, label: '재미 영상' },
     // 구독은 설정 화면·하단 안내(Footer)에서 들어간다 (은퇴자 대상 메뉴 정리 2026-11-18)
     { path: '/settings', icon: Settings, label: '설정' },
@@ -68,15 +68,9 @@ export function BottomNav() {
                 }}
               >
                 <Icon className="mb-1 h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
-                <span
-                  className="min-h-[34px] w-full min-w-0 max-w-full overflow-hidden text-center text-[14px] leading-[1.2] tracking-normal break-keep sm:text-base"
-                  style={{
-                    display: '-webkit-box',
-                    WebkitBoxOrient: 'vertical',
-                    WebkitLineClamp: 2,
-                  }}
-                >
-                  {item.label}
+                <span className="min-h-[34px] w-full min-w-0 break-keep text-center text-[14px] leading-[1.2] sm:text-base">
+                  <span className="sm:hidden">{'mobileLabel' in item ? item.mobileLabel : item.label}</span>
+                  <span className="hidden sm:inline">{item.label}</span>
                 </span>
               </Link>
             );
~~~~

### 실행 2 결과 원문 (2026-11-27T12:15:18.173354+00:00)

## 판정: **최종 승인**

지난 판정에서 요청한 두 가지가 모두 고쳐졌습니다. 차단할 문제는 없습니다.

> 검토 범위: 이번 세션에도 Bash와 파일 읽기 도구가 없습니다. 그래서 받은 두 diff만 검토했고, 빌드·WebKit 렌더링·`git status`는 제가 다시 실행하지 못했습니다. 아래 결론은 diff와 기장이 보고한 실측 결과(320·375·390·640·1024px, 일반·개발자 메뉴)를 근거로 합니다.

### 1. 지난 요청 반영 여부
| 요청 | 결과 | 근거 (24e37ea0) |
|---|---|---|
| 모바일 글자를 14px로 복원 | 반영 | `text-xs` → `text-[14px]`. main과 같은 크기입니다 |
| `min-w-0` 유지 | 반영 | `w-full min-w-0 break-keep` |
| 커밋 메시지를 실제 변경에 맞추기 | 반영 | 후속 커밋 `fix: 모바일 하단 메뉴 글자 크기 유지`에 적었다고 보고받았습니다 |
| `Link`의 `aria-label`이 이름을 덮어쓰는지 | 없음 | 기장 확인. 보이는 이름과 낭독되는 이름이 같습니다 |

### 2. 최종 diff(main 대비) 검토
```tsx
<span className="min-h-[34px] w-full min-w-0 break-keep text-center text-[14px] leading-[1.2] sm:text-base">
  <span className="sm:hidden">{'mobileLabel' in item ? item.mobileLabel : item.label}</span>
  <span className="hidden sm:inline">{item.label}</span>
</span>
```
- **없어진 것**: `overflow-hidden`, `-webkit-line-clamp: 2`, `max-w-full`, `tracking-normal`이 빠졌습니다. `max-w-full`은 `w-full`이 있어서 필요 없고, `tracking-normal`은 기본값입니다. 말줄임을 없애는 것이 이번 작업의 목적이므로 이 변경은 의도에 맞습니다.
- **남은 위험**: 줄 수 제한이 없어서 긴 이름이 3줄이 되면 메뉴 높이가 커질 수 있습니다. 다만 넘침 검증을 통과했고, 640px 이상에서도 칸 하나가 약 106px라 가장 긴 "공개 기록 함께읽기"(16px)도 2줄 안에 들어갑니다. 지금 메뉴 구성에서는 문제가 없습니다.
- **경로·권한·Firestore**: `path`, `homePath`, 아이콘, 활성 표시 조건은 바뀌지 않았습니다. Firestore와는 관계없습니다.
- **타입**: `'mobileLabel' in item`으로 타입을 좁히는 방식이라 안전합니다. 빌드 통과는 보고받은 결과입니다.

### 3. 남은 참고 사항 (차단 사유 아님)
- **띄어쓰기**: 모바일은 "함께 읽기", 640px 이상은 "함께읽기"로 아직 다릅니다. 화면 이름은 유지하기로 하셨으니 그대로 두되, 나중에 문구를 정리할 때 한쪽으로 맞추면 좋겠습니다.
- **'공개' 생략**: 모바일 이름에서 '공개'가 빠진 점은 허대표님께 드리는 결과 보고에 한 줄 적어 주세요.
- **병합 메시지**: 첫 커밋 제목은 "말줄임 제거"뿐입니다. squash 병합을 한다면 PR 제목이나 병합 메시지에 "모바일 짧은 이름 적용"도 함께 적어 주세요.

### 4. 작업 규모
소규모 작업입니다(UI 문구·스타일). 모델, 라우터, 새 기능 변경이 없어서 멈추고 보고해야 하는 조건에 해당하지 않습니다. 병합과 배포는 기존 승인 범위대로 기장이 진행하면 됩니다.

---
**Slack 기록용 확정 요약** (Slack에는 게시하지 않았습니다)
> CC 독립 재검토 · PR #455 · HEAD 24e37ea0 · BottomNav 모바일 짧은 이름·말줄임 제거 → **최종 승인**. 지난 요청 반영 확인: 모바일 14px 복원, `min-w-0` 유지, 후속 커밋 메시지 명시, `aria-label` 덮어쓰기 없음. 경로·권한·활성 표시·타입 문제 없음. 참고(차단 아님): 모바일 "함께 읽기"와 640px 이상 "함께읽기"의 띄어쓰기 차이, 모바일 이름의 '공개' 생략은 허대표님 보고에 포함할 것, squash 병합 시 메시지에 짧은 이름 적용을 적을 것. 한계: CC는 Bash가 없어 diff만 검토했고 빌드·WebKit 결과는 기장 보고를 근거로 함.

## 검증

14px 복원 후 웹 빌드와 320·375·390·640·1024px WebKit의 일반·개발자 메뉴를 다시 검증했습니다. 링크 대상, 선택 상태, 표시 이름, 잘림 및 메뉴 높이를 확인했습니다.
