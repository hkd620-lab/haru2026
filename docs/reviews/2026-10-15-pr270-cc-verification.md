# PR #270 CC 직접 검증 기록 (HEAD 1dacf47c, 최신 main 69c371cc)

- 작성 시각: 2026-10-14T16:12Z (한국시간 2026-10-15 01:12) 정리·보존. 검증 실행은 2026-10-14T15:37Z~16:05Z에 했다
- 대상: PR #270 `codex-assistant-recommendation-accuracy` HEAD `1dacf47c861538136b847254cbfb9f3c58ff55a0`(기능 검토 HEAD `cf390dea`), 최신 main `69c371cce46f39f8720283167c037d099fede7af`, PR 기준 main `4db3ce792da0a40678bd35afce8be74b696f1e9f`.
- 범위: 검토·필수 검증만. 앱 코드 수정, PR 브랜치 push, 병합, 운영 배포, 외부 AI 호출, 운영 데이터 저장은 하지 않았다. 아래 모든 실행은 격리 worktree(`cc-270` PR HEAD, `cc-270-main` 최신 main, `cc-270-merge` main에 PR을 병합한 검증본, `cc-270-mut` 변이·시제품 복사본)에서 했고 `frontend/node_modules`는 증거 브랜치 설치본을 심볼릭 링크로 썼다.
- 스크립트와 결과 원본: `2026-10-15-pr270-cc-verify/` (README 참고). 경로 상수는 CC 세션의 임시 경로다.
- 독립 Claude 검토 결과는 별도 파일(`2026-10-15-pr270-claude-independent-1-result.md`)에 있다. 이 문서는 독립 검토 결과를 보기 전에 쓴 CC 자체 실행 기록이다.

## 1. 필수 검증 (정책 8.1 판정① 2항: 프론트 코드 → 빌드 + 변경 영역 시험)

| 항목 | 명령 | 결과 |
|---|---|---|
| 변경 영역 시험(PR HEAD) | `cd frontend && node --import tsx --test test/assistantRecommendations.test.mjs test/formatRegistry.test.mjs` | 34 통과 / 0 실패(신규 27 + 기존 7). 작성자 보고와 같음 |
| 빌드(PR HEAD) | `npm run build -- --outDir <임시> --emptyOutDir`(더미 `VITE_FIREBASE_*` 6개 + `VITE_AI_LIBRARY_FIREBASE_*` 6개) | exit 0, 96초. 운영 환경 변수 빌드는 아님 |
| 빌드(main + PR 병합 검증본) | 같은 명령 | exit 0, 71초 |
| 타입 | `node /opt/node-tools/node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (main, PR HEAD, 병합 검증본) | 모두 250건, 전부 미사용 `src/app/components/ExportModal.tsx`, 오류 집합 동일(신규 0) |
| diff 검사 | `git diff --check origin/main...refs/review/pr270` | 깨끗(exit 0) |
| 전체 오프라인 시험(에뮬레이터 불필요) | `run-all-tests.sh`(테스트 파일별 실행) — main | 46개 파일, 44 통과·2 실패(`haruLawSave.test.cjs`, `loginProviderStorage.policy.test.cjs`는 기준 main에서도 같은 실패). node:test 합계 통과 208·실패 0 |
| 전체 오프라인 시험 — main + PR 병합 검증본 | 같은 스크립트 | 47개 파일. main과 파일별 결과 차이는 새 시험 1개(`assistantRecommendations.test.mjs` 27/0)뿐. node:test 합계 통과 235·실패 0 |

## 2. 최신 main과 병합 · F-13~F-19 보존 (격리 검증본)

- `git worktree add --detach cc-270-merge origin/main` 후 `git merge --no-commit --no-ff refs/review/pr270` → "Automatic merge went well", 충돌 없음. 검증용으로 로컬에서만 커밋(`0813d1dc`, 푸시하지 않음).
- `git diff --name-status origin/main HEAD`(병합 결과 vs main) = `A docs/reviews/2026-10-09-pr270-codex-run1-request.md`, `A docs/reviews/2026-10-09-pr270-codex-run1-result.md`, `M frontend/src/app/utils/assistantRecommendations.ts`, `A frontend/test/assistantRecommendations.test.mjs`. PR 4개 파일뿐이며 main을 되돌린 흔적이 없다.
- PR 기준 main 이후 main에 들어간 앱·시험 파일 4개(`FormatModal.tsx`, `ledgerExportService.ts`, `ledgerEmptyExport.test.mjs`, `ledgerExportConsistency.test.mjs`)는 병합 결과에서 main과 같다. 같은 기간 main이 바꾼 모든 파일(문서 포함)을 대조해 불일치 0건.
- 병합 결과에서 F-13~F-19 관련 시험: `ledgerEmptyExport` 17/17, `ledgerExportConsistency` 8/8, `recordPhotoPolicy` 1/1, `haruLawError` 1/1, `readingAi` 11/11, `formatRegistry` 7/7, 새 `assistantRecommendations` 27/27.
- `git diff origin/main...refs/review/pr270 -- frontend/src/app/utils/assistantRecommendations.ts`에서 규칙의 `id`·`title`·`category`·`description`·`actionLabel`·`targetPath`·`keywords` 줄, `FORMAT_PRIORITY`·`FORMAT_ALIASES`·안내문·`export` 선언을 바꾼 줄이 없다(추가된 것은 `weakKeywords`, 조사·합성어 표, 점수 상수, 매칭·정렬 로직). `formatRegistry.test.mjs`가 이 선언들을 글자 그대로 검사해 7/7 통과.
- 변경 영향 범위: 추천 유틸을 쓰는 곳은 `SayuPage.tsx:5441`(상세, 렌더 중 호출, 메모이제이션 없음)과 `RecordPage.tsx:687`(저장 직후)뿐. 카드 컴포넌트는 `matchedKeywords`의 앞 2개로 문장을 만들고 전체를 "감지된 키워드"로 표시하므로 강한 단어 우선 정렬은 표시에 부합한다. 저장 경로·Functions·Rules·AI 호출·결제·인증·라우터·홈 파일 변경 없음(정책 8.1 멈춤 조건 해당 없음).

## 3. 요구 충족 직접 실행

- 근거 문서 2-1절 합격 기준 13행(1행은 메모·일기 2회로 14검사)을 수정 후 함수로 실행: **14/14 통과**(`results/acceptance13.txt`). 수정 전(main)과 나란히 적었다. 13행 F-10(교사 맥락)은 문서대로 해소하지 않고 결과만 기록: 육아·교육 비서가 그대로 뜬다.
- PR 본문 "동일 함수 실행 비교" 8사례 표를 수정 전·후 함수로 각각 실행: **수정 전 8/8, 수정 후 8/8 표기와 일치**(`results/pr-table-check.txt`).
- 요구 항목별: 약한 단어 단독 후보 차단(`strongMatches.length === 0`이면 제외) · 낱말 경계(앞 `(^|[^\p{L}\p{N}_])`, 뒤 `(?=$|[^\p{L}\p{N}_])`) · 조사 허용과 합성어·활용형 명시 허용 표(`KEYWORD_VARIANTS` 11항목) · 강 3점·약 1점(고유 일치 전체, 표시 5개 제한과 무관) · 점수 내림차순에 형식 우선순위는 동점 보조 · 최대 2장 · 1위 점수의 절반 이상만(`score >= topScore / 2`, 절반 포함) · `matchedKeywords`는 강한 단어 먼저 최대 5개. 모두 코드와 실행 결과가 일치한다.
- 호환성: `vite.config.ts`의 legacy 타깃은 `ios >= 13`. 이 PR이 쓰는 `u` 플래그와 `\p{L}`·`\p{N}`은 같은 앱의 `SayuPage.tsx:403`, `firestoreService.ts:272`, `ProphecyFromRecord.tsx:42`, `SettingsPage.tsx:280`에도 이미 쓰이고, lookbehind는 쓰지 않았다.

## 4. 시험이 요구를 실제로 고정하는지 — 변이 시험 (복사본, 원본 무수정)

`run-mutants.py`로 25개 변이를 하나씩 적용해 새 단위 시험(27건)이 잡는지 확인(`results/mutants-pr270.txt`): **18개 KILLED, 7개 SURVIVED**.

| 살아남은 변이 | 의미 |
|---|---|
| M01 강한 단어 점수 3→2 | 요구 "강3"을 시험이 고정하지 않음 |
| M03 약한 단어 점수 1→2 | 요구 "약1"을 시험이 고정하지 않음 |
| M16 앞쪽 경계에서 숫자 제외 해제 | `2아이`처럼 숫자가 앞에 붙은 경우 미검증(뒤쪽 `아이2`만 검증) |
| M17 경계에서 밑줄 제외 해제 | 밑줄 경계 미검증 |
| M19 복수형 `들` 허용 제거 | `아이들이`가 `학교` 등 다른 강한 단어에 가려져 `들` 처리가 단독으로 검증되지 않음 |
| M23 소문자화 제거 | 키워드가 한글뿐이라 실질 영향 없음(동등 변이에 가까움) |
| M24 고유 단어 중복 제거 해제 | 규칙 키워드에 중복이 없어 동등 변이 |

가중치를 고정하는 최소 입력(무작위 4만 입력 탐색, `results/weights-find.txt`): `지출 여행 교통 주차 맛집`(메모) → `['travel','finance']`(M01이면 `['travel']`), `수확 일본 벌레 고추`(메모) → `['plant','travel']`(M03이면 `['plant']`). 시험 하나씩이면 두 변이를 잡는다.

## 5. 성능과 최악 입력

`getAssistantRecommendations`는 호출마다 키워드 약 152개로 정규식을 새로 만들고 전체 본문에 돌린다(`results/perf.txt`, 이 컨테이너 측정이라 비교용):

| 본문 길이 | 수정 전 | 수정 후 |
|---|---|---|
| 200자 | 0.031ms | 0.624ms |
| 2,000자 | 0.156ms | 3.134ms |
| 20,000자 | 1.243ms | 27.252ms |
| 100,000자 | 5.340ms | 109.282ms |

약 20배 느리지만 절대값은 작다. 다만 `SayuPage.tsx`의 상세 화면은 렌더 중에 호출한다. 정규식 8종 최악 입력(`아이` 5만 자 반복, 조사 연쇄, `들` 5만 개, 한글 10만 자 등)은 모두 150ms 이하(최대 142ms)로 길이에 비례해 늘어 역추적 폭주는 없다. 복사본에서 "키워드(또는 허용 형태)가 본문에 문자열로 들어 있는지 먼저 `includes`로 확인하고 없으면 정규식 생략"을 시험한 결과 2,000자 기준 0.377ms(약 8배 빠름)에 단위 시험 27/27·스트레스 비교 결과가 PR 원본과 같았다. 정규식 캐시만으로는 200자에서 약 1.8배, 2,000자 이상에서는 변화가 없었다.

## 6. 추천 누락(미탐)과 오탐 — 수정 전·후 같은 입력 비교 (CC 작성 코퍼스, 라벨은 CC 판단)

- 새 함수는 수정 전에 없던 분야 카드를 추가한 적이 없다(731개 입력, 0건). 변화는 모두 카드 감소다.
- 오탐 차단: 아이디어·아이템·코스피·일정하다 외에 아이스크림·아이콘·코스모스·일정한·고소한(맛)도 막힌다(수정 전에는 모두 해당 분야 카드가 떴다). 하루LAW는 `합의`·`계약`·`고소` 같은 일반어 하나만으로도 여전히 뜬다(`회의에서 합의가 이루어졌다` → law, 수정 전과 같음).
- **누락**: CC가 현실적인 일기 문장으로 쓴 스트레스 세트 75문장(주 분야 라벨 72)에서 수정 전에는 72개 모두 주 분야 카드가 떴고 수정 후에는 **44개**만 뜬다(`results/compare-summary.txt`). 새로 놓친 28문장의 원인: 분야가 분명한 **합성어 17**(혈당수치, 혈압측정, 건강검진결과, 소변검사, 병원예약, 전세계약, 계약갱신, 내용증명우편, 고소장, 합의금, 손해배상청구, 법률사무소, 세금계산서, 애완동물병원, 비행기표, 여행계획, 일본여행), **조사·어미 5**(강아지**랑**, 아이**랑**, 반려견**과의**, 변호사**님**과, 소송**중**이라), 약한 단어만 있어 의도대로 차단된 **3**(무릎·운동, 수면·피로, 잎·벌레), 활용형 2(처방받은, 걱정스럽다), 약한 단어+합성어 1(카드값).
- 가상사용자 시나리오 문자열 656개(`extract-corpus.mjs`로 추출, 하네스 라벨 섞임) 중 87개의 결과가 달라졌다: 카드 수 감소 80, 같은 수에서 키워드만 감소 7. 반려동물 이름만 적은 기록(`뭉치와 30분 산책했다`, `산책 20분, 물 250ml`, `앉아 신호에 반응했다. 짖음 2회`, `예방접종 1회, 산책은 쉬었다.`), 식물 기록(`잎 두 장이 새로 나왔다`, `배추에 물을 주고 잎에 붙은 벌레를 손으로 잡았다`), 체중 기록(`체중 5.2kg`)은 약한 단어만이라 더는 비서가 뜨지 않는다. 요구 1에 따른 설계 결과이며, 대표님이 정책으로 판단할 사항이다.
- 조사·어미 94개를 `강아지` 뒤에 붙여 본 결과 **42개만 인식, 52개 미인식**(`results/particles.txt`). 미인식 예: 랑, 이랑, 하고, 이나, 나, 께, 님, 중, 이라, 인데, 이고, 이며, 이야, 이에요, 예요, 였다, 라고, 라는, 이라는, 과의, 와의, 에서의, 으로의.

## 7. 참고용 시제품 (복사본에서만 적용, PR에 포함되지 않음)

"조사 허용 확장"과 "분야가 분명한 합성어 약 30개 추가"를 복사본에 적용해 효과를 쟀다(`results/prototype-attribution.txt`, `results/prototype-recall-fix.diff`).

| 변형 | PR 단위 시험 | 스트레스 세트에서 주 분야 카드가 뜬 문장 |
|---|---|---|
| PR 원본 | 27/27 | 44/72 |
| 조사 확장만 | 27/27 | 48/72 |
| 합성어 목록만 | 27/27 | 62/72 |
| 둘 다 | 27/27 | 66/72 |

둘 다 적용해도 가상사용자 656개 중 달라진 것은 1건(`세금계산서`가 일치)이고 새 오탐으로 볼 변화는 없었다. 남는 6문장은 의도된 약한 단어 차단 3, 활용형 1, 조사 연쇄 1, 약한 단어+합성어 1이다. 이 목록은 CC가 만든 예시이며 확정은 PR 작성자(기장)와 대표님 결정이 필요하다.

## 8. 남은 확인·한계

- 실제 화면(로그인 후 SAYU 상세·저장 직후 카드)은 이 세션에서 열지 못했다(프리뷰 URL 접근 불가). 대표님이 10/9에 기존 법률 메모 한 건에서 하루LAW 1장만 뜨는 것을 확인했다(카드 표시만, 연결·AI 호출·저장·병합 승인 아님).
- 변경이 사용자에게 보이는 동작이라 정책 8.1의 "운영 완료 판정"은 AI가 대신할 수 없다. 병합·운영 배포는 이번 지시에 포함되지 않았고 실행하지 않았다.
- 코퍼스의 라벨은 CC의 판단이며 독립 검증된 정답이 아니다. 성능 수치는 이 컨테이너 기준이다.
