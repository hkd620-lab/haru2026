# PR #453 사유기록 건수 표시 검토

검토 커밋 `a85a2c871f60f0c28a8d1d9f108e36372eb046db`

## Codex 자동 리뷰

- 실행 1. 초안 해제 자동 실행. 요청 댓글 없음. 시작 시각 확인 불가. 완료 2026-11-27 11:29:13 UTC. 지적 없음. 별도 리뷰 ID 없이 [요약 댓글 7217120147](https://github.com/hkd620-lab/haru2026/pull/453#issuecomment-7217120147)에 기록.

## Claude Code 독립 검토

### 요청 원문

```text
PR #453 HEAD a85a2c871f60f0c28a8d1d9f108e36372eb046db 독립 검토. 아래 변경을 평가하되 코드 수정이나 외부 작업 금지. 월별·전체 건수 중복 제거, 독서 최근 완독과 특수 카드 부제 보존, 회귀와 검증 누락, 작업 규모 및 멈춤 조건 여부를 확인하고 승인/수정 후 승인/재설계 판정과 근거를 제시하세요. 로컬 웹 빌드 및 26개 테스트 통과, 실제 JSX 렌더링 검증 통과, 성장 타임라인 스냅샷 차이는 베이스 출력과 동일함을 검증했습니다.
diff --git a/frontend/src/app/pages/SayuPage.tsx b/frontend/src/app/pages/SayuPage.tsx
index e05a1197..63c08320 100644
--- a/frontend/src/app/pages/SayuPage.tsx
+++ b/frontend/src/app/pages/SayuPage.tsx
@@ -4615,7 +4615,7 @@ export function SayuPage() {
               title: groupDisplayLabel,
               subtitle: group.label === '독서사유'
                 ? `최근 완독 · ${group.entries[0].title}`
-                : formatCountLabel(groupCount),
+                : null,
               description: `최근 기록 ${formatListDate(group.latestDate)} · 기록과 사유를 모아두었습니다.`,
             };
           })();
@@ -4644,9 +4644,11 @@ export function SayuPage() {
                       {formatCountLabel(groupCount)}
                     </span>
                   </span>
-                  <span style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.45, fontWeight: 700 }}>
-                    {groupCopy.subtitle}
-                  </span>
+                  {groupCopy.subtitle && (
+                    <span style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.45, fontWeight: 700 }}>
+                      {groupCopy.subtitle}
+                    </span>
+                  )}
                   <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>
                     {groupCopy.description}
                   </span>
```

### 실행 1 결과 원문 (2026-11-27T11:28:30.821891+00:00)

Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.

### 실행 2 결과 원문 (2026-11-27T11:28:52.048590+00:00)

Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.

### 실행 3 결과 원문 (2026-11-27T11:30:23.456503+00:00)

# PR #453 독립 검토 (HEAD `a85a2c87`)

**판정: 승인.** 단, 아래 확인 항목 2개는 기장이 병합 전에 확인해 주세요.

**검토 범위:** 이 세션에서는 로컬 파일 읽기와 셸 도구를 쓸 수 없었습니다. 그래서 저장소를 직접 열거나 빌드·테스트를 다시 돌리지 못했습니다. 판정 근거는 전달받은 diff와 기장의 검증 보고뿐입니다. 코드 수정과 외부 작업은 하지 않았습니다.

## 1. 변경 평가

**건수 중복 제거: 맞음**
- 변경 전에는 일반 카드에서 `formatCountLabel(groupCount)`가 두 번 나왔습니다. 한 번은 제목 옆 배지(4644행 부근 `<span>…{formatCountLabel(groupCount)}</span>`)이고, 한 번은 subtitle입니다.
- 이번 변경으로 일반 카드의 subtitle이 `null`이 되고 렌더링이 조건부로 바뀌었습니다. 배지 한 곳만 남으므로 중복이 정확히 없어집니다.

**독서사유 '최근 완독' 보존: 맞음**
- `group.label === '독서사유'` 분기는 그대로입니다. `최근 완독 · ${group.entries[0].title}`도 유지됩니다.

**특수 카드 부제 보존: 이 hunk에서는 영향 없음**
- 바뀐 곳은 IIFE의 기본(fallback) return뿐입니다. 그 앞에서 따로 return하는 특수 카드 분기는 diff에 없어서 바뀌지 않았다고 봅니다.
- 다만 특수 카드 분기의 subtitle이 빈 문자열(`''`)일 때도 이제는 줄이 렌더링되지 않습니다. 예전에는 빈 줄이 보였을 수 있는데, 오히려 개선입니다.

**조건부 렌더링 안전성: 이상 없음**
- subtitle은 문자열이거나 `null`입니다. 그래서 `{groupCopy.subtitle && …}`가 `0` 같은 값을 화면에 찍는 문제는 생기지 않습니다.

## 2. 회귀 위험과 검증 누락

1. **타입 검사 (확인 필요)**
   - 이제 subtitle 타입은 `string | null`입니다. `groupCopy`나 IIFE 반환값에 `subtitle: string` 같은 명시적 타입이 있으면 타입 오류가 납니다.
   - 그런데 `vite build`만 돌리면 타입 검사를 건너뜁니다. 기장 보고에는 "로컬 웹 빌드 통과"만 있어서 타입 검사까지 했는지 알 수 없습니다.
   - `npm run build` 스크립트에 `tsc`가 들어 있는지, 아니면 `npx tsc --noEmit`을 따로 통과했는지 확인해 주세요.
2. **"월별·전체" 범위 (확인 필요)**
   - diff는 4615행과 4644행 한 군데만 고칩니다.
   - 월별 화면과 전체 화면이 이 렌더링을 같이 쓴다면 문제없습니다. 화면이 따로 있다면 다른 곳에 건수 중복이 남아 있을 수 있습니다.
   - `SayuPage.tsx`에서 `formatCountLabel(` 사용처를 grep해, 배지와 subtitle이 동시에 건수를 찍는 곳이 이 한 곳뿐인지 확인해 주세요.
3. **카드 높이 (참고, 낮은 위험)**
   - 일반 카드는 한 줄이 빠져서 키가 작아집니다. 독서사유 카드나 특수 카드와 그리드에 섞이면 높이가 들쭉날쭉할 수 있습니다.
   - 기장이 이미 실제 JSX 렌더링을 확인했다고 했으니, 모바일 폭에서 시각적으로 괜찮은지만 함께 봤는지 확인하면 됩니다.
4. **성장 타임라인 스냅샷 차이**
   - 베이스 출력과 같다고 검증됐으므로 이번 변경 때문에 생긴 차이는 아니라고 봅니다. 문제없습니다.

## 3. 규모와 멈춤 조건

- **규모: 소규모.** 표시 문구 버그 1개를 고치는 변경입니다. 절차는 feature → PR → preview → merge 대상입니다.
- **멈춤 조건: 해당 없음.** 모델 교체나 품질 저하가 없고, 커밋 메시지("사유기록 카드 건수 중복 표시 제거")와 실제 변경이 일치하며, 대규모 작업도 아닙니다.
- **Firestore 경로, Functions, 라우팅:** 변경 없음.

## 4. 결론

**승인**합니다. 위 1번(타입 검사)과 2번(`formatCountLabel` 다른 사용처) 확인이 끝나면 그대로 병합할 수 있습니다. 둘 중 하나라도 문제가 나오면 '수정 후 승인'으로 바뀝니다. 재설계가 필요한 문제는 없습니다.

**Slack 기록용 확정 요약** (Slack에는 게시하지 않았습니다)
> PR #453 (a85a2c87) CC 독립 검토: 승인. 일반 카드에서 배지와 부제에 건수가 두 번 나오던 것이 없어졌고, 독서사유 '최근 완독' 부제는 유지됨. 소규모 변경이며 멈춤 조건 없음. 병합 전 기장 확인 2건: ① `tsc --noEmit` 통과 여부 ② SayuPage에서 `formatCountLabel` 사용처 중 다른 중복이 없는지. CC는 diff만 보고 검토했고 로컬 재현은 하지 않음.

## 병합 전 확인

- TypeScript 5.9.3 `tsc --noEmit --pretty false`를 기준 커밋과 변경 커밋에 각각 실행했습니다. 두 빌드의 타입 진단 221줄이 일치하며 변경으로 추가된 진단은 없습니다.

- `formatCountLabel` 호출은 형식 선택 탭과 카드 제목 배지에 각각 한 번 있습니다. 월별·전체 목록은 같은 카드 렌더러를 사용합니다.

- 로컬 웹 빌드, 관련 테스트 26건, 월별·전체 카드 렌더링 검증 통과. 성장 타임라인 시나리오 출력은 기준 커밋과 동일합니다.
