# 독립 Claude 재검토 2회차 — CC 재현 기록 (PR #270 P2-1 변경, HEAD 12a89231)

- 목적: 독립 재검토 2회차 보고의 핵심 주장을 이 세션이 전달하기 전에 CC가 직접 재현한 **정합 확인 기록**이다. 독립 검토나 판정을 대신하지 않으며 CC가 자기 작업을 승인하는 것이 아니다. 독립 보고를 받은 뒤(최종 보고 호출 2026-10-14T17:27:35.269Z)에 했다.
- 실행 시각(UTC, 출력 파일 기준): 신·구 비교 17:29:41Z, 약한 단어 추가 입력 17:30:01Z, 시험 17:30:03Z, 정규식 산술 17:31:10Z. 한국시간은 +9시간.
- 대상: 새 = `12a89231726d18ea60b6aa8423e171a74038620b`, 구 = `1dacf47c861538136b847254cbfb9f3c58ff55a0`. 각각 저장소 밖 scratchpad의 임시 detached worktree에서 실행했고 `frontend/node_modules`는 작업 폴더 것을 심볼릭 링크로 읽기만 했다(`npm install` 없음). 끝난 뒤 worktree·링크·가져오기 ref(`refs/review/pr270-indep2`)를 제거했고 작업 폴더 `git status --short`는 깨끗했다. 앱 코드·PR 브랜치·main은 변경하지 않았다.
- 범위: 독립 보고가 지목한 사례 79개 입력(새 코퍼스가 아님)과 정규식 산술, 지정 시험 37개. 독립 보고의 대규모 조합 수치(330/330, 4,335건, 3,740건, 4,922건, 390건 등)와 합격 13행 전체 재실행, 성능 측정, 전체 빌드·전체 앱 시험, 변이 시험은 **하지 않았다**(이번 단계 지시).
- 결과: 재현한 모든 항목이 독립 보고와 일치했다. 아래 4절.

## 1. 지정 시험과 diff 검사 (12a89231)

- `cd frontend && node --import tsx --test test/assistantRecommendations.test.mjs test/formatRegistry.test.mjs` → exit 0

```
# tests 37
# suites 0
# pass 37
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

- `git diff --check 1dacf47c861538136b847254cbfb9f3c58ff55a0 12a89231726d18ea60b6aa8423e171a74038620b` → 깨끗(exit 0)

## 2. 입력별 신·구 비교 (74개 입력)

`=`는 신·구 결과 같음, `≠`는 다름. 형식은 `카드id(감지된 강한 키워드)`이며 `[]`는 추천 없음.

```
## A 기존 차단 11 (문장 안/단독)
  = 새 아이디어를 정리했다. :: new=[] old=[]
  = 새 아이템 회의를 했다. :: new=[] old=[]
  = 코스피가 올라서 기분이 좋다. :: new=[] old=[]
  = 요즘 컨디션이 일정하다. :: new=[] old=[]
  = 학교생활이 즐겁다 :: new=[] old=[]
  = 반려견용 사료를 샀다 :: new=["pet(사료)"] old=["pet(사료)"]
  = 홍콩에 다녀왔다 :: new=[] old=[]
  = 카드뉴스를 만들었다 :: new=[] old=[]
  = 건강검진표를 받았다 :: new=[] old=[]
  = AI아이가 말했다 :: new=[] old=[]
  = 아이2를 샀다 :: new=[] old=[]
  = 아이디어 :: new=[] old=[]
  = 아이템 :: new=[] old=[]
  = 코스피 :: new=[] old=[]
  = 일정하다 :: new=[] old=[]
  = 학교생활 :: new=[] old=[]
  = 반려견용 :: new=[] old=[]
  = 홍콩 :: new=[] old=[]
  = 카드뉴스 :: new=[] old=[]
  = 건강검진표 :: new=[] old=[]
  = AI아이 :: new=[] old=[]
  = 아이2 :: new=[] old=[]
  = 제주 일정하다 :: new=["travel(제주)"] old=["travel(제주)"]
## B 허대표님 사례 8 + 추가
  ≠ 강아지랑 산책했다 :: new=["pet(강아지)"] old=[]
  ≠ 강아지하고 산책했다 :: new=["pet(강아지)"] old=[]
  ≠ 아이랑 놀이터에 갔다 :: new=["childcare(아이)"] old=[]
  ≠ 아이들이랑 놀았다 :: new=["childcare(아이)"] old=[]
  ≠ 선생님께 편지를 썼다 :: new=["childcare(선생님)"] old=[]
  ≠ 요즘 고민이에요 :: new=["life(고민)"] old=[]
  ≠ 병원에서의 경험을 적었다 :: new=["hospital(병원)"] old=[]
  ≠ 변호사님과 통화했다 :: new=["law(변호사)"] old=[]
  ≠ 변호사님들께서는 바쁘시다 :: new=["law(변호사)"] old=[]
  ≠ 강아지랑은 잘 논다 :: new=["pet(강아지)"] old=[]
## C 하고 연결형·동형이의
  ≠ 여행하고 왔다 :: new=["travel(여행)"] old=[]
  ≠ 교육하고 있다 :: new=["childcare(교육)"] old=[]
  ≠ 합의하고 헤어졌다 :: new=["law(합의)"] old=[]
  ≠ 계약하고 왔다 :: new=["law(계약)"] old=[]
  ≠ 고소하고 맛있다 :: new=["law(고소)"] old=[]
  ≠ 제주에서 고소하고 맛있는 걸 먹었다 :: new=["law(고소)","travel(제주)"] old=["travel(제주)"]
  ≠ 제주 일정하고 :: new=["travel(제주,일정)"] old=["travel(제주)"]
  = 제주 일정하다 :: new=["travel(제주)"] old=["travel(제주)"]
  = 고소한 맛 :: new=[] old=[]
  = 고소해서 맛있다 :: new=[] old=[]
  = 고소하게 볶았다 :: new=[] old=[]
## D P2-2·P2-3 미접촉
  = 걱정돼요 :: new=[] old=[]
  = 요즘 불안해요 :: new=[] old=[]
  = 고민했는데 :: new=[] old=[]
  = 고소했다 :: new=[] old=[]
  = 합의서 :: new=[] old=[]
  = 전세보증금 :: new=[] old=[]
  = 고혈압 :: new=[] old=[]
  = 입금했다 :: new=[] old=[]
## E 목록 밖 형태(미인식 유지)
  = 강아지에서부터 :: new=[] old=[]
  = 아이에게까지 :: new=[] old=[]
  = 강아지이었는데 :: new=[] old=[]
  = 강아지같이 :: new=[] old=[]
  = 강아지만큼 :: new=[] old=[]
  = 강아지이라도 :: new=[] old=[]
  = 강아지야 :: new=[] old=[]
  = 강아지고 :: new=[] old=[]
## F 경계·접미사 차단
  = AI강아지랑 :: new=[] old=[]
  = 강아지랑2 :: new=[] old=[]
  = 강아지랑_a :: new=[] old=[]
  = 아이랑이 :: new=[] old=[]
  = 아이랑과 :: new=[] old=[]
  = 아이고 :: new=[] old=[]
  = 아이고야 :: new=[] old=[]
  = 강아지나라 :: new=[] old=[]
  = 강아지랑이 :: new=[] old=[]
  = 강아지용 :: new=[] old=[]
  = 강아지집 :: new=[] old=[]
  = 아이스크림 :: new=[] old=[]
  = 콩나물 :: new=[] old=[]
  = 여행이야기 :: new=[] old=[]
differences(new≠old): 17
```

약한 단어 추가 입력(5개, 약한 단어 단독 후보 차단 유지 확인):

```
일정하고 :: new=[] old=[]
일정하고 있다 :: new=[] old=[]
정리하고 있다 :: new=[] old=[]
준비하고 공부하고 운동하고 :: new=[] old=[]
정리하고 준비하고 공부하고 운동하고 일정하고 해결하고 :: new=[] old=[]
```

## 3. 정규식 대안 수와 조합 상한

`KOREAN_PARTICLES` 문자열을 소스에서 읽어 선택 그룹별 대안 수를 센 값이다.

```
old(1dacf47c): 선택 그룹 3개, 그룹별 대안 수 [1, 29, 3], 중복 대안 [0, 0, 0], 조합 상한(빈 선택 포함) 240
new(12a89231): 선택 그룹 4개, 그룹별 대안 수 [1, 1, 61, 5], 중복 대안 [0, 0, 0, 0], 조합 상한(빈 선택 포함) 1488
```

## 4. 독립 보고와 대조

| 독립 보고 주장 | CC 재현 | 결과 |
|---|---|---|
| 허대표님 사례 8개가 신에서 인식되고 구에서는 [] | 2절 B 그룹 10개(8개 + `변호사님들께서는`·`강아지랑은`): 신은 모두 기대 분야, 구는 모두 [] | 일치 |
| 차단 11개가 신·구 모두 차단 | 2절 A 그룹 23개 입력(문장 11 + 단독 11 + `제주 일정하다`): 신 = 구. 차단 낱말 자체는 모두 []. `반려견용 사료를 샀다`의 pet은 `반려견용`이 아니라 키워드 `사료` 때문이며 신·구 동일 | 일치 |
| `하고` 연결형 인식: `여행하고`→travel, `교육하고`→childcare, `합의하고`→law | 2절 C 그룹 그대로(구는 []). `계약하고`→law도 인식 | 일치 |
| 동형이의 `고소하고 맛있다`→law(구 []), `제주에서 고소하고 맛있는 걸 먹었다`→law 추가(구는 travel만), `고소한`·`고소해서`·`고소하게`는 계속 차단 | 2절 C 그룹 그대로 | 일치 |
| `일정하고` 단독은 [], `제주`와 함께면 감지 키워드에 `일정`이 추가, `일정하다`는 계속 차단 | 2절 C 그룹(`제주 일정하고`→travel(제주,일정), `제주 일정하다` 불변), 3절 추가 입력 | 일치 |
| 약한 단어 + `하고`만으로는 카드 0건 | 추가 입력 5개 모두 [] (신·구 동일) | 일치 |
| P2-2·P2-3 예시(걱정돼요·불안해요·고민했는데·고소했다·합의서·전세보증금·고혈압·입금했다)가 신·구 동일([]) | 2절 D 그룹 8개 | 일치 |
| 1회차 목록 밖 형태(`에서부터`·`에게까지`·`이었는데`·`같이`·`만큼`·`이라도`·`야`·`고`)는 여전히 인식되지 않음 | 2절 E 그룹 8개 모두 [] | 일치 |
| 경계·접미사 차단(`AI강아지랑`·`강아지랑2`·`강아지랑_a`·`아이랑이`·`아이랑과`·`아이고`·`강아지나라`·`강아지랑이`·`강아지용`·`강아지집`·`아이스크림` 등) | 2절 F 그룹 14개 모두 [] | 일치 |
| 주 조사 대안 29→61, 조합 상한 240→1,488, 중복 없음 | 3절 | 일치 |
| 시험 37 통과 / 0 실패 | 1절 | 일치 |

## 5. 한계

- 독립 보고를 받은 뒤 그 사례를 그대로 쓴 정합 확인이므로 독립 검증이 아니다. 사례 선택이 같은 쪽으로 치우쳤을 가능성은 남는다.
- 독립 보고의 낱말 충돌 점검은 육안·언어 지식 기반(보고 4절)이며, CC도 사전 대조나 전수 점검을 하지 않았다. `고소하고` 외의 동형이의가 있는지는 확정되지 않았다.
- 성능(정규식 대안 29→61로 호출당 시간이 늘 수 있음)은 독립 검토자도 CC도 측정하지 않았다. 1회차 P3-1 영역이며 이번 단계 범위가 아니다.
- 실제 사용자 글에서의 `~하고` 빈도, 프리뷰·실기기 동작은 미확인이다.

## 6. 재현 스크립트

`spot.mjs` (신·구 비교, 환경 변수 `UTIL_NEW`·`UTIL_OLD`에 각 worktree의 `frontend/src/app/utils/assistantRecommendations.ts` 경로를 주고 `frontend` 폴더에서 `node --import tsx spot.mjs`):

```js
const NEW = await import(process.env.UTIL_NEW);
const OLD = await import(process.env.UTIL_OLD);
const run = (m, t, f = []) => m.getAssistantRecommendations(t, f).map(r => r.id + (r.matchedKeywords?.length ? '(' + r.matchedKeywords.join(',') + ')' : ''));
const groups = {
  'A 기존 차단 11 (문장 안/단독)': [
    '새 아이디어를 정리했다.', '새 아이템 회의를 했다.', '코스피가 올라서 기분이 좋다.', '요즘 컨디션이 일정하다.',
    '학교생활이 즐겁다', '반려견용 사료를 샀다', '홍콩에 다녀왔다', '카드뉴스를 만들었다', '건강검진표를 받았다',
    'AI아이가 말했다', '아이2를 샀다', '아이디어', '아이템', '코스피', '일정하다', '학교생활', '반려견용', '홍콩', '카드뉴스', '건강검진표', 'AI아이', '아이2',
    '제주 일정하다'],
  'B 허대표님 사례 8 + 추가': [
    '강아지랑 산책했다', '강아지하고 산책했다', '아이랑 놀이터에 갔다', '아이들이랑 놀았다', '선생님께 편지를 썼다',
    '요즘 고민이에요', '병원에서의 경험을 적었다', '변호사님과 통화했다', '변호사님들께서는 바쁘시다', '강아지랑은 잘 논다'],
  'C 하고 연결형·동형이의': [
    '여행하고 왔다', '교육하고 있다', '합의하고 헤어졌다', '계약하고 왔다', '고소하고 맛있다',
    '제주에서 고소하고 맛있는 걸 먹었다', '제주 일정하고', '제주 일정하다', '고소한 맛', '고소해서 맛있다', '고소하게 볶았다'],
  'D P2-2·P2-3 미접촉': ['걱정돼요', '요즘 불안해요', '고민했는데', '고소했다', '합의서', '전세보증금', '고혈압', '입금했다'],
  'E 목록 밖 형태(미인식 유지)': ['강아지에서부터', '아이에게까지', '강아지이었는데', '강아지같이', '강아지만큼', '강아지이라도', '강아지야', '강아지고'],
  'F 경계·접미사 차단': ['AI강아지랑', '강아지랑2', '강아지랑_a', '아이랑이', '아이랑과', '아이고', '아이고야', '강아지나라', '강아지랑이', '강아지용', '강아지집', '아이스크림', '콩나물', '여행이야기'],
};
let diff = 0;
for (const [g, cases] of Object.entries(groups)) {
  console.log('## ' + g);
  for (const t of cases) {
    const n = JSON.stringify(run(NEW, t)), o = JSON.stringify(run(OLD, t));
    if (n !== o) diff++;
    console.log(`${n === o ? '  =' : '  ≠'} ${t} :: new=${n} old=${o}`);
  }
}
console.log('differences(new≠old):', diff);
```

`spot2.mjs` (약한 단어 추가 입력):

```js
const NEW = await import(process.env.UTIL_NEW);
const OLD = await import(process.env.UTIL_OLD);
const run = (m, t, f = []) => m.getAssistantRecommendations(t, f).map(r => r.id + (r.matchedKeywords?.length ? '(' + r.matchedKeywords.join(',') + ')' : ''));
for (const t of ['일정하고', '일정하고 있다', '정리하고 있다', '준비하고 공부하고 운동하고', '정리하고 준비하고 공부하고 운동하고 일정하고 해결하고']) {
  console.log(`${t} :: new=${JSON.stringify(run(NEW, t))} old=${JSON.stringify(run(OLD, t))}`);
}
```

`arith.mjs` (`KOREAN_PARTICLES` 대안 수 산술, `node arith.mjs`):

```js
import fs from 'node:fs';
const get = (p) => { const s = fs.readFileSync(p, 'utf8'); const m = s.match(/const KOREAN_PARTICLES =\s*'([^']*)'/); if (!m) throw new Error('no match ' + p); return m[1]; };
for (const [k, p] of [['old(1dacf47c)', process.env.UTIL_OLD], ['new(12a89231)', process.env.UTIL_NEW]]) {
  const kp = get(p);
  const groups = [...kp.matchAll(/\(\?:([^)]*)\)\?/g)].map((m) => m[1].split('|'));
  const sizes = groups.map((g) => g.length);
  const dup = groups.map((g) => g.length - new Set(g).size);
  const combos = sizes.reduce((a, n) => a * (n + 1), 1);
  console.log(`${k}: 선택 그룹 ${groups.length}개, 그룹별 대안 수 [${sizes.join(', ')}], 중복 대안 [${dup.join(', ')}], 조합 상한(빈 선택 포함) ${combos}`);
}
```
