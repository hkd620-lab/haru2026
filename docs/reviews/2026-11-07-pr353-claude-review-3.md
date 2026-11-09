# PR353 독립 검토 3 원문

- 대상 HEAD ef23d1525f3c5f4ae1eeff4f3ac2ecf4d73b79c8, 코드964590c6.
- 동일 검토 대화 https://claude.ai/chat/a7d26759-0461-45d0-b219-045eaa1de244
- 모델 Opus5.5 중간, 변경 없음. 수집 시각 2026-11-07T10:00:40.497811+00:00; UI 요청·완료 정확 시각 미표시.
- 판정: 승인(코드 기준).

## 질문 원문

PR353 세 번째 독립 검토입니다. HEAD ef23d1525f3c5f4ae1eeff4f3ac2ecf4d73b79c8 / 코드964590c6. 이전 수정 후 승인 2회 모두 보존했습니다. 아래 직전 원문과 반영 diff를 함께 대조해 승인/수정 후 승인/재설계를 판정해주세요. N1은 기록 형식 이름 대신 AI에게 질문(하루LAW 분기), N2 모아보기 열기/모으는 중/실패 문구, N3 해당 화면 공개 기록 문구 통일 및 기존 SAYU함께보기와 같다는 연결, N4 keep-all, N5 내려받기 설명을 반영했습니다. 다른 화면의 기존 함께보기 이름은 같은 공간이라는 연결 설명으로 혼동을 줄였으며 권한·공개 동작은 바꾸지 않았습니다. build 성공21.30초(합성 Firebase 환경값), 질문Enter21/21·입력정책·diff검사 통과. 공통 결과 대화 화면과 실기기·실계정 E2E는 아직 미확인으로 남깁니다. 홈 이미지는 재촬영하여 판독되는 것을 직접 확인했으나 이번 요청에는 첨부하지 않으므로 코드 검토와 시각검증을 구분해주세요. 최신 Codex 및 CI는 현재 대기 중이며 코드판정과 별도 조건입니다. 병합/Hosting은 대표님 최종 승인 전 실행하지 않습니다. 파일·Git·Slack 수정 금지. 작업규모·남은지적·운영멈춤조건을 알려주세요.

직전 판정 원문:
# PR #353 독립 재검토 (2회차)

**대상**: 최신 HEAD `650caa96`, 코드 `ce892525`
**이전 판정**: 수정 후 승인(1회째). 원문과 반영 내역은 첨부에서 대조했습니다.
**근거 범위**: 이번 첨부와 스크린샷 2장만 사용했습니다. 파일·Git·Slack·서비스는 수정하지 않았습니다.

## 판정: **수정 후 승인** (2회째, 코드 기준)

- 이전 필수 F1~F3은 모두 해소됐습니다. 권장 F4~F9도 대부분 반영됐습니다.
- 다만 이번 첨부(resultChatConfig 전체, MergePage 전체)로 새로 확인된 문제 2건이 남았습니다. 둘 다 이 PR이 도입했거나, 이 PR이 고친 화면의 핵심 버튼에 남은 문구입니다. 각각 한 줄 수준의 수정입니다.
- Codex(지적 없음)와 CI(SUCCESS)는 HEAD `650caa96` 기준으로 충족됐습니다. 따라서 아래 필수 2건을 고친 뒤 새 HEAD에서 Codex·CI·독립 검토를 다시 받으면 판정① 요건에 도달합니다.
- 독립 검토에서 "수정 후 승인"이 3회를 넘으면 판정하지 않고 대표님께 보고하게 되어 있습니다. 다음 검토가 3회째입니다.

---

## 1. 이전 지적 반영 확인

| 지적 | 결과 | 확인 내용 |
|---|---|---|
| F1 라벨·접근성 이름 | **해소** | 세 곳 모두 `aria-label`이 삭제돼 `<label htmlFor>`가 이름이 됩니다. 정책 테스트는 id로 찾고, haruLawEntry 테스트는 `for=`, 라벨 문구, aria-label 부재를 확인합니다. |
| F2 합본/모아보기 혼용 | **대부분 해소**, 잔여 1건(N2) | MergePage의 안내·기준·기간·잠금 문구와 랜딩 문구를 바꿨습니다. 요금표 문구는 유지하고 L650에서 "합본과 같은 기능"으로 연결했는데, 가격 정책을 건드리지 않는 방법으로 타당합니다. 비서 합본(`SHOW_ASSISTANT_LIBRARY_MERGE=false`), 주석, 로그는 사용자에게 보이지 않으므로 유지해도 됩니다. |
| F3 히어로 3단계 | **해소** | `HERO_FLOW`가 "한 줄 기록 → 필요하면 AI 정리 → 확인 후 저장"으로 바뀌었고, 320px 스크린샷에서도 확인됩니다. |
| F3 폰 목업의 HARU미래전망 | **유지 타당** | `AGENTS`에 `/prophecy-hub` 항목이 있고 `developerOnly`가 아닙니다. `HIDDEN_AGENT_LABELS`는 '나도작가'만 숨깁니다. 즉 일반 사용자에게 보이는 비서이므로 목업에 비서 소개로 남겨도 사실과 맞습니다. 저장 단계로 묘사하지 않은 점도 적절합니다. |
| F4 브랜드 부제 | **해소** | 모바일 11px, 자간 0.5px, 줄높이 1.4입니다. |
| F5 "선택" 중의성 | **해소** | 카드는 "이 비서 알아보기", 대화상자는 "이용할 비서", 실행 버튼은 "이 비서 이용하기", 담기는 "내 비서에 담기"로 동작마다 말이 다릅니다. |
| F6 도구 카드 설명 | **해소** | 데스크톱 13px `#646B57`, 모바일 제목 14px입니다. 이 규칙은 기록 형식 카드(`.v2-rec`)에도 함께 적용되는데, 형식 이름이 짧아 320px 2열에서도 문제가 없습니다. |
| F7 비활성 상태 안내 | **해소** | 자리표시자와 하단 안내가 비로그인·준비 중 상태를 따로 표시합니다. 활성화 조건은 바뀌지 않았습니다. |
| F8 공개 기록 이름 | **부분 해소**, 잔여(N3) | 상단 캡션과 탭은 바뀌었지만 같은 페이지의 사용자 노출 문구 5곳이 남아 있습니다. |
| F9 문구·대비 | **해소** | 비서 안내에 사진 추가를 포함했습니다. "식물 사진 확인"으로 고쳤고, 호박 문구는 h2 아래로 옮겼습니다. 모아보기 부제는 13px `#646B57`입니다. |
| 범위 외 변경 | 없음 | 가격 수치·문구, 인증, 공유 권한, 라우트, 저장 흐름 모두 이번 diff에서 그대로입니다. |
| 검토 기록 전용 커밋 | 예외 요건과 부합 | `ce892525..650caa96`이 `A docs/reviews/…` 3건만입니다. 검토 1 원문 파일은 제 1차 결과와 내용이 일치합니다. |

---

## 2. 남은 지적

### 필수

**N1 [중] 기록 결과 질문칸 라벨이 "일기에게 질문"처럼 읽힘** (이 PR이 도입)
- 위치: ResultChatModal L1104 `{config.label}에게 질문 · …`
- `RESULT_CHAT_CONFIGS`의 label 대부분은 비서가 아니라 기록 형식입니다. 그래서 다음과 같이 표시되고, F1 수정 이후에는 이 문구가 접근성 이름으로 읽힙니다.
  - "일기에게 질문", "메모에게 질문", "최종 독서사유에게 질문"
  - "애완동물관찰일지에게 질문": 다른 화면에서는 "반려동물"로 표시되는 형식입니다.
- 재현: 일기에서 SAYU를 마친 뒤 결과 대화를 열면 라벨이 "일기에게 질문 · 아래 글상자에 써 주세요"로 나옵니다.
- 이 PR의 목표가 "기록과 비서의 구분"인데, 기록을 질문받는 대상(비서)처럼 표현하게 됩니다.
- 최소 수정 예: `` `AI에게 질문 · ${config.label} 기록을 바탕으로 아래 글상자에 써 주세요` ``. 하루LAW만 기존 문구를 원하면 `isHaruLaw`로 분기하면 됩니다. 반려동물 표기도 맞추려면 `pet_sayu`일 때 '반려동물'로 바꿉니다.

**N2 [중하] 모아보기 화면의 실행 버튼이 아직 "합치기"**
- 위치: MergePage 실행 버튼 `{isRunning ? '합치는 중...' : '📥 합치기 실행'}`, 실패 토스트 `'합치기에 실패했습니다…'`
- 재현: `/merge`에서 제목, 형식, 기준, 기간은 모두 "모아보기"인데 맨 아래 주요 버튼만 "합치기 실행"입니다. 사용자가 가장 먼저 누르는 버튼이므로 F2의 목적이 마지막 단계에서 무너집니다.
- 최소 수정: "📥 모아보기 열기"와 "모으는 중...", 토스트는 "모아보기를 열지 못했습니다. 다시 시도해주세요."로 바꿉니다.

### 권장

**N3 [하] SayuTogetherPage에 사용자 노출 "SAYU-함께보기" 잔존**
- 위치: L379(삭제 확인창), L389(성공 토스트), L392·L451("함께보기 삭제" 버튼과 실패 토스트), L799(비로그인 안내)
- 최소 수정: "공개 기록 함께읽기"로 바꿉니다. L129~370은 `console` 로그이므로 유지해도 됩니다.
- 이번 검색은 변경 파일에 한정됐습니다. SAYU 기록 화면의 "함께보기에 공개" 같은 진입 문구가 다른 파일에 있는지는 확인되지 않았습니다(부족 자료 2).

**N4 [하] 랜딩 320px에서 한글 단어 중간 줄바꿈** (스크린샷으로 확인)
- 증상: 값 카드 제목이 "…묻습니 / 다", 3단계 안내문이 "확 / 인해"로 끊깁니다.
- 위치: `.lp-value-card h2`, `.lp-value-card p`, `.lp-mini-flow__lead`
- 최소 수정: 이 세 규칙에 `word-break:keep-all`을 추가합니다. 제목에는 이미 `lp-h1`과 같은 방식이 쓰이고 있습니다.

**N5 [하] 랜딩 FLOW 04 "한 권으로 묶어 보관합니다"**
- 모아보기 화면은 "결과는 서버에 저장되지 않습니다"라고 안내합니다. 반면 랜딩의 "보관"은 앱 안에 저장된다는 뜻으로 읽힐 수 있습니다.
- 최소 수정: "한 권으로 묶어 읽고 PDF·EPUB로 내려받습니다".
- 기존 문구이므로 후속 처리해도 됩니다.

---

## 3. 검증 범위 구분

**코드·제공 화면으로 확인한 것**
- 위 diff 전체와 MergePage, resultChatConfig, AGENTS 원문을 직접 읽었습니다.
- 랜딩 320px 스크린샷 1장을 확인했습니다.
- 첨부된 첫 번째 이미지(홈 모바일로 보임)는 회색 빈 화면으로 보여 판독할 수 없습니다. 홈 모바일의 11px 부제, 14px 카드 제목, "알아보기" 버튼은 코드로만 확인했습니다.

**작성자 보고로만 취급한 것**
- build, 정책 테스트 결과
- 격리 fixture 확인(홈 → 형식 → 편집창 원문 유지, 저장 없음)
- Codex(지적 없음), CI(SUCCESS)는 링크로 제시된 결과입니다.

**운영 E2E로 남은 것 (AI가 대신 판정할 수 없음)**
- 실제 계정으로 홈 초안을 쓰고 편집창에서 Firestore에 저장하기
- 카카오·네이버·Google 실제 로그인
- iOS와 Android 실기기 키보드에서 ResultChatModal 높이와 3px 포커스 윤곽선 잘림 여부
- VoiceOver와 TalkBack에서 라벨 낭독: N1 수정 후 확인해야 합니다.
- 실제 하루LAW AI 응답 화면

**tsc 전수 검사**
- 미실행입니다. 정책 8.1의 필수 검증 항목은 아니어서 판정 조건에는 넣지 않습니다.
- 이번 변경은 문자열·스타일·속성 삭제뿐이라 타입 위험이 낮습니다. 그래도 최종 병합 전에 한 번 실행하기를 권합니다.

## 4. 부족 자료

1. 판독 가능한 홈 모바일 390px 또는 320px 스크린샷: 첨부된 이미지는 빈 화면입니다.
2. `git grep -n -E "SAYU-함께보기|SAYU·함께보기|함께보기" frontend/src` 전체 결과: 변경하지 않은 파일의 진입 문구를 확인하기 위함입니다.
3. N1 수정 후 결과 대화 라벨 화면 1장: 일기 1개와 하루LAW 1개면 충분합니다.

---

## 5. 작업 규모와 멈춤 조건

**작업 규모: 중**
- 남은 수정(N1, N2)은 2개 파일 몇 줄 수준의 소규모입니다. 로직 변경은 없습니다.

**구현 범위**
- 홈, 브랜드, 첫 방문 설명의 구현과 수정은 대표님 지시("권장한 순서대로 수정 진행", "다음작업진행")의 범위 안으로 봅니다. N1~N5 수정도 이 범위에 포함됩니다.

**운영 멈춤 조건 (해당함)**
- **main 병합과 Hosting 배포**: 홈화면 파일 변경 건이고, 이전 배포 승인은 당시 CC 세션에 한정됩니다. 따라서 대표님의 별도 최종 승인이 필요합니다. 판정①을 받더라도 자동으로 병합·배포할 수 없습니다.
- **요금표 "합본" 문구**: 변경하려면 대표님 확인이 필요합니다. 현재처럼 유지하면 해당되지 않습니다.
- **"운영 완료" 판정**: 위 실기기 E2E 이후 대표님이 합니다.

**다음 순서**
1. N1, N2 수정. N3, N4는 함께 고치는 것을 권합니다.
2. build와 관련 테스트 재실행, 로그를 PR에 첨부
3. 새 HEAD에서 Codex 재검토와 CI 확인
4. 독립 검토 3회째 요청: 이번 원문과 반영 내역을 첨부
5. 판정① 기록
6. 대표님 병합·배포 승인
7. 운영 E2E

반영 전체 diff:
diff --git a/frontend/src/app/components/ResultChatModal.tsx b/frontend/src/app/components/ResultChatModal.tsx
index 37b37152..1305c655 100644
--- a/frontend/src/app/components/ResultChatModal.tsx
+++ b/frontend/src/app/components/ResultChatModal.tsx
@@ -1101,7 +1101,7 @@ export function ResultChatModal({
               )}
             </>
           )}
-          <label htmlFor={questionInputId} style={{ display: 'block', margin: '8px 0', fontSize: 16, fontWeight: 700, color: '#1A3C6E' }}>{config.label}에게 질문 · 아래 글상자에 써 주세요</label>
+          <label htmlFor={questionInputId} style={{ display: 'block', margin: '8px 0', fontSize: 16, fontWeight: 700, color: '#1A3C6E' }}>{isHaruLaw ? '하루LAW에게 질문' : 'AI에게 질문'} · 아래 글상자에 써 주세요</label>
           <div style={{ display: 'flex', gap: 8 }}>
             <textarea
               id={questionInputId}
diff --git a/frontend/src/app/pages/LandingPage.tsx b/frontend/src/app/pages/LandingPage.tsx
index f615018c..d03bbe83 100644
--- a/frontend/src/app/pages/LandingPage.tsx
+++ b/frontend/src/app/pages/LandingPage.tsx
@@ -92,7 +92,7 @@ const FLOW = [
   { n: '01', t: '기록 입력',   d: '오늘 있었던 일을 평소 말투로 자유롭게 적습니다.' },
   { n: '02', t: 'AI 정리',     d: 'SAYU가 표현만 다듬어 읽기 좋은 글로 정돈합니다.' },
   { n: '03', t: '분류 · 검색', d: '형식과 날짜로 자동 분류되고, 키워드로 찾을 수 있습니다.' },
-  { n: '04', t: '통계 · 모아보기', d: '월별·연도별로 흐름을 보여주고, 한 권으로 묶어 보관합니다.' },
+  { n: '04', t: '통계 · 모아보기', d: '월별·연도별로 흐름을 보여주고, 한 권으로 묶어 읽고 PDF·EPUB로 내려받습니다.' },
   { n: '05', t: '오래 남는 기록',   d: '책 소재가 되고, 회고 자료가 되고, 다음 세대에 남길 기록이 됩니다.' },
 ];
 
@@ -819,11 +819,11 @@ const LP_CSS = `
 .lp-value-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:-10px 0 26px;max-width:680px;}
 .lp-value-card{background:rgba(255,255,255,0.78);border:1px solid var(--border);border-radius:18px;padding:16px;display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:flex-start;box-shadow:0 12px 28px -24px rgba(74,90,44,0.32);}
 .lp-value-card__ico{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex-shrink:0;}
-.lp-value-card h2{font-size:15px;font-weight:800;line-height:1.35;letter-spacing:-0.01em;color:var(--fg);margin:0 0 6px;}
-.lp-value-card p{font-size:13px;line-height:1.58;color:var(--fg-2);margin:0;}
+.lp-value-card h2{word-break:keep-all;font-size:15px;font-weight:800;line-height:1.35;letter-spacing:-0.01em;color:var(--fg);margin:0 0 6px;}
+.lp-value-card p{word-break:keep-all;font-size:13px;line-height:1.58;color:var(--fg-2);margin:0;}
 @media(max-width:640px){.lp-value-cards{grid-template-columns:1fr;margin:-8px 0 22px;}.lp-value-card{padding:14px;grid-template-columns:38px 1fr;gap:11px;border-radius:16px;}.lp-value-card__ico{width:38px;height:38px;border-radius:12px;}.lp-value-card h2{font-size:14px;}.lp-value-card p{font-size:12.5px;line-height:1.55;}}
 .lp-mini-flow{max-width:680px;margin:-8px 0 22px;padding:12px 13px;border:1px solid rgba(229,223,208,0.9);border-radius:16px;background:rgba(255,255,255,0.54);}
-.lp-mini-flow__lead{margin:0 0 9px;color:var(--fg);font-size:13px;font-weight:700;line-height:1.45;}
+.lp-mini-flow__lead{word-break:keep-all;margin:0 0 9px;color:var(--fg);font-size:13px;font-weight:700;line-height:1.45;}
 .lp-mini-flow__steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;}
 .lp-mini-flow__item{position:relative;display:flex;align-items:center;gap:7px;min-width:0;padding:8px 24px 8px 8px;border-radius:13px;background:rgba(245,240,232,0.72);}
 .lp-mini-flow__ico{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex:0 0 auto;}
diff --git a/frontend/src/app/pages/MergePage.tsx b/frontend/src/app/pages/MergePage.tsx
index c9c378e9..512c9e2a 100644
--- a/frontend/src/app/pages/MergePage.tsx
+++ b/frontend/src/app/pages/MergePage.tsx
@@ -417,7 +417,7 @@ export function MergePage() {
       });
     } catch (error) {
       console.error('병합 실패:', error);
-      toast.error('합치기에 실패했습니다. 다시 시도해주세요.');
+      toast.error('모아보기를 열지 못했습니다. 다시 시도해주세요.');
     } finally {
       setIsRunning(false);
     }
@@ -781,7 +781,7 @@ export function MergePage() {
         }}
       >
         <Layers className="w-4 h-4" />
-        <span>{isRunning ? '합치는 중...' : '📥 합치기 실행'}</span>
+        <span>{isRunning ? '모으는 중...' : '📥 모아보기 열기'}</span>
       </button>
       </>)}
 
diff --git a/frontend/src/app/pages/SayuTogetherPage.tsx b/frontend/src/app/pages/SayuTogetherPage.tsx
index 24e6e3ef..3eb6dddc 100644
--- a/frontend/src/app/pages/SayuTogetherPage.tsx
+++ b/frontend/src/app/pages/SayuTogetherPage.tsx
@@ -376,7 +376,7 @@ export function SayuTogetherPage() {
 
   const handleUnpublishSharedRecord = async (item: SharedRecordListItem) => {
     if (!user?.uid || item.ownerUid !== user.uid || !item.sourceRecordId) return;
-    const confirmed = window.confirm('이 글을 SAYU-함께보기에서 삭제합니다. 내 개인 기록은 삭제되지 않습니다.');
+    const confirmed = window.confirm('이 글을 공개 기록 함께읽기에서 삭제합니다. 내 개인 기록은 삭제되지 않습니다.');
     if (!confirmed) return;
 
     setSharedActionId(item.id);
@@ -386,10 +386,10 @@ export function SayuTogetherPage() {
       setItems(nextItems);
       setSelectedId((current) => current === item.id ? '' : current);
       setComments([]);
-      toast.success('SAYU-함께보기에서 삭제했습니다.');
+      toast.success('공개 기록 함께읽기에서 삭제했습니다.');
     } catch (error) {
       console.error('SAYU-함께보기 공개 삭제 실패:', error);
-      toast.error('함께보기 글을 삭제하지 못했습니다.');
+      toast.error('공개 기록을 삭제하지 못했습니다.');
     } finally {
       setSharedActionId('');
     }
@@ -448,7 +448,7 @@ export function SayuTogetherPage() {
                   opacity: isBusy ? 0.65 : 1,
                 }}
               >
-                함께보기 삭제
+                공개 기록 삭제
               </button>
             </div>
           )}
@@ -796,7 +796,7 @@ export function SayuTogetherPage() {
       return (
         <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #D1FAE5' }}>
           <p className="text-sm" style={{ color: '#0F766E', lineHeight: 1.7 }}>
-            SAYU-함께보기는 로그인한 HARU 회원만 볼 수 있습니다.
+            공개 기록 함께읽기는 로그인한 HARU 회원만 볼 수 있습니다.
           </p>
         </div>
       );
@@ -1108,7 +1108,7 @@ export function SayuTogetherPage() {
           🌿 공개 기록 함께읽기
         </h1>
         <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
-          HARU 회원들이 공개한 기록을 함께 읽고 댓글로 마음을 나누는 공간입니다.
+          HARU 회원들이 공개한 기록을 함께 읽고 댓글로 마음을 나누는 공간입니다. 기존 ‘SAYU·함께보기’와 같은 공간이에요.
         </p>
       </div>
 


## 결과 원문

# PR #353 독립 재검토 (3회차)

**대상**: HEAD `ef23d152`, 코드 `964590c6`
**이전 판정**: 수정 후 승인 2회. 직전 원문과 이번 반영 diff를 대조했습니다.
**근거 범위**: 이번 요청 본문만 사용했습니다. 파일·Git·Slack·서비스는 수정하지 않았습니다.

## 판정: **승인** (코드 기준)

- 필수 N1·N2와 권장 N3~N5가 모두 diff로 반영됐습니다. 새로 생긴 결함은 없습니다.
- 이 승인은 코드 판정입니다. 아래 판정① 조건 2건(새 HEAD의 Codex·CI)과 운영 멈춤 조건은 별도로 남아 있습니다.
- 승인이므로 "수정 후 승인" 3회 상한과는 관계가 없습니다.

---

## 1. 반영 확인

| 지적 | 결과 | 확인 내용 |
|---|---|---|
| N1 "일기에게 질문" | **해소** | ResultChatModal 라벨이 `isHaruLaw ? '하루LAW에게 질문' : 'AI에게 질문'`으로 바뀌었습니다. 기록 형식을 질문 대상으로 부르지 않고, 자리표시자 "나의 기록을 바탕으로…"와도 맞습니다. 하루LAW 결과 대화의 라벨은 HaruLawPanel 라벨과 같은 표현이어서 일관됩니다. `isHaruLaw`는 기존 변수(`config.sourceKey === 'haruraw_sayu'`)이고, 입력 정책 테스트는 id로 찾으므로 영향이 없습니다. |
| N2 실행 버튼 | **해소** | "📥 모아보기 열기", "모으는 중...", 실패 토스트 "모아보기를 열지 못했습니다"로 바뀌었습니다. `console.error('병합 실패')`는 사용자에게 보이지 않아 유지해도 됩니다. |
| N3 함께보기 잔존 | **해소** (해당 화면) | 삭제 확인창, 성공·실패 토스트, 버튼, 비로그인 안내가 "공개 기록 (함께읽기)"로 통일됐습니다. 설명에 "기존 'SAYU·함께보기'와 같은 공간"을 덧붙여 다른 화면의 옛 이름과 이어 줍니다. 삭제 조건(`ownerUid === user.uid`)과 공개 동작은 바뀌지 않았습니다. |
| N4 단어 중간 줄바꿈 | **해소** (코드) | `.lp-value-card h2`, `.lp-value-card p`, `.lp-mini-flow__lead`에 `word-break:keep-all`이 추가됐습니다. 모바일 미디어 규칙은 글자 크기만 덮어쓰므로 keep-all이 유지됩니다. |
| N5 "보관" 표현 | **해소** | "한 권으로 묶어 읽고 PDF·EPUB로 내려받습니다"로 바뀌어, MergePage의 "서버에 저장되지 않습니다" 안내와 맞습니다. |
| 범위 외 변경 | 없음 | 문자열 4개 파일, CSS 3줄입니다. 가격, 인증, 공유 권한, 저장 흐름, 라우트는 변경되지 않았습니다. |

---

## 2. 남은 사항 (승인을 막지 않음)

**판정① 기록 전에 확인할 것**
1. **새 HEAD의 Codex 재검토 완료와 지적 해결**: 현재 대기 중입니다. 지적이 나오면 이 승인은 그 해결을 전제로 합니다.
2. **새 HEAD의 CI 통과**: 현재 대기 중입니다.
3. **검토 기록 전용 커밋 확인**: 이번 요청에 `git diff --name-status 964590c6..ef23d152` 결과가 첨부되지 않았습니다. 모든 항목이 `A docs/reviews/…`인지 확인하고, 그 출력을 판정 기록에 그대로 붙여야 합니다. 다른 경로가 섞여 있으면 예외가 아니므로 재검토 대상입니다.

**권장 (후속 가능)**
- 다른 화면의 옛 이름 "함께보기": 연결 설명으로 혼동은 줄었지만, 저장소 전체 grep 결과는 아직 받지 못했습니다. 후속 PR에서 정리해도 됩니다.
- 최종 병합 전 `tsc --noEmit` 한 번 실행을 권합니다. 이번 변경은 문자열·CSS뿐이라 위험은 낮습니다.

---

## 3. 검증 범위 구분

**코드로 확인한 것**
- 위 반영 diff 전체

**시각 검증으로는 확인하지 못한 것**
- N4의 줄바꿈이 실제로 해결됐는지: 이번에 스크린샷이 없습니다.
- 홈 모바일 화면: 재촬영본은 첨부되지 않았습니다. 작성자가 확인했다는 보고로만 취급합니다.

**작성자 보고로만 취급한 것**
- build 성공(21.30초, 합성 Firebase 환경값)
- 질문 Enter 21/21, 입력 정책 검사, diff 검사 통과

**운영 E2E로 남은 것 (AI가 대신 판정할 수 없음)**
- 공통 결과 대화 화면 실물: 일기 1개와 하루LAW 1개의 라벨·키보드·포커스 윤곽선
- 실제 계정으로 홈 초안 → 편집창 → 저장
- 카카오·네이버·Google 실제 로그인
- iOS와 Android 실기기 키보드
- VoiceOver와 TalkBack 라벨 낭독
- 실제 하루LAW AI 응답

---

## 4. 작업 규모와 멈춤 조건

**작업 규모: 중**
- PR 전체로는 홈, 첫 방문, 모아보기, 공개 기록 화면의 문구·스타일 변경입니다.
- 이번 반영분만 보면 소규모입니다. 로직 변경은 없습니다.

**구현 범위**
- 대표님 지시("권장한 순서대로 수정 진행", "다음작업진행")의 범위 안입니다.

**운영 멈춤 조건 (해당함)**
- **main 병합과 Hosting 배포**: 홈화면 파일 변경 건입니다. 이전 배포 승인은 당시 CC 세션에 한정되므로, 판정① 이후에도 대표님 최종 승인 전에는 실행하지 않습니다.
- **요금표 "합본" 문구**: 현재 유지 중이라 해당되지 않습니다. 바꾸려면 대표님 확인이 필요합니다.
- **"운영 완료" 판정**: 위 운영 E2E 이후 대표님이 합니다.

**다음 순서**
1. 새 HEAD의 Codex·CI 결과 확인
2. 문서 전용 커밋 name-status 첨부
3. `#haru2026-감사`에 판정① 기록: 이번 원문 링크와 판정 문구를 그대로 인용
4. 대표님 병합·배포 승인
5. 운영 E2E

## 검토 기록 전용 커밋 확인

```
A	docs/reviews/2026-11-07-pr353-claude-review-2.md
A	docs/reviews/2026-11-07-pr353-codex-index-2.md
```

검증: 합성 Firebase 환경값 build21.30초 성공, 질문 Enter21/21·질문입력정책·diff 검사 통과. 실제 계정·실기기·공통 결과 대화 시각 E2E 미검증.
