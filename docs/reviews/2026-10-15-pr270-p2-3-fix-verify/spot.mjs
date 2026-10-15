// 수정 전(bdefa3f8) 소스와 수정 후 소스의 getAssistantRecommendations를 직접 실행해 소수 사례만 비교한다(새 코퍼스·전수 비교 아님).
// 실행: UTIL_NEW=<수정 후 소스 file URL> UTIL_OLD=<수정 전 소스 file URL> node --import tsx spot.mjs
const NEW = await import(process.env.UTIL_NEW);
const OLD = await import(process.env.UTIL_OLD);
const run = (m, t, f = []) => m.getAssistantRecommendations(t, f).map((r) => r.id + (r.matchedKeywords?.length ? '(' + r.matchedKeywords.join(',') + ')' : ''));

const remaining20 = ['전세보증금', '월세보증금', '민사소송', '행정소송', '형사소송', '합의서', '고소장', '내용증명우편', '손해배상청구', '고발했다', '고혈압', '저혈압', '고혈당', '저혈당', '공복혈당', '식후혈당', '건강보험료', '현금영수증', '입금했다', '입금되었다'];
const excluded = ['요즘 고소했다.', '요즘 합의했다.', '참기름 냄새가 고소했다', '회의에서 일정에 합의했다', '상대방을 고소했다', '상대방과 합의했다', '팀원들과 합의했다'];

const groups = {
  'A 남은 20형 연결 유지(요즘 ○○.)': remaining20.map((f) => `요즘 ${f}.`),
  'B 합성어+조사 대표 문장 22개(수정 후 시험에 남은 문장)': [
    '상대방을 고발했다', '합의서를 작성했다', '고소장을 접수했다', '전세보증금을 돌려받지 못했다', '월세보증금 문제로 다퉜다', '민사소송을 준비 중이다',
    '행정소송을 검토한다', '형사소송은 오래 걸린다', '내용증명우편을 보냈다', '손해배상청구를 검토 중이다', '공복혈당이 140이 나왔다', '식후혈당이 높다',
    '저혈당이 왔다', '고혈당이 계속된다', '고혈압 진단을 받았다', '고혈압 약을 먹고 있다', '저혈압이 있다', '월급이 입금되었다', '거래처에 입금했다',
    '계약금을 입금했다', '건강보험료가 올랐다', '현금영수증을 발급받았다',
  ],
  'C 제외 대상(기대: 수정 전 law → 수정 후 [])': excluded,
  'D 기본 키워드·허용 합성어 유지(고소장·합의서·고소를·합의를 등, 불변 기대)': ['고소장을 접수했다', '합의서를 작성했다', '합의를 했다', '합의가 어렵다', '고소를 당했다', '고소는 취하했다', '합의서와 고소장을 준비한다'],
  'E 기존 차단·비관련어·목록 밖(불변 기대)': ['새 아이디어를 정리했다.', '새 아이템 회의를 했다.', '코스피가 올라서 기분이 좋다.', '요즘 컨디션이 일정하다.', '학교생활이 즐겁다', '반려견용', '홍콩에 다녀왔다', '카드뉴스를 만들었다', '건강검진표를 받았다', 'AI아이가 말했다', '아이2를 샀다', '불안정', '고민정', '입금하다', '입금됐다', '고발되었다', '합의되었다', '고소하다', '합의금을 받았다'],
  'F P2-1·P2-2·기존 사례(불변 기대)': ['강아지랑 산책했다', '아이랑 놀이터에 갔다', '요즘 고민이에요', '걱정돼요', '불안감이 크다', '고민했는데 결정했다', '임대차계약서를 확인했다.', '당뇨병과 불면증으로 힘들었다.', '소송 임대차 보증금 내용증명 합의 준비 해결 방법 상담'],
  'G 이번에 손대지 않은 기존 P3(고소하고 동형이의, 신·구 동일 기대)': ['고소하고 맛있다'],
  'H 다른 법률 키워드가 함께 있는 문장(기대: 카드는 그대로, 감지 단어에서 제외 형태의 키워드만 빠질 수 있음)': ['내용증명을 보내고 상대방과 합의했다', '상대방을 고소했고 고소장을 접수했다'],
};

// 카드(id) 목록과 감지 단어를 따로 비교한다. H 그룹은 카드가 같아야 하고 감지 단어만 달라질 수 있다.
const cardIds = (m, t) => JSON.stringify(m.getAssistantRecommendations(t, []).map((r) => r.id));
const expectedDiffs = new Set(excluded);
const matchedOnlyGroup = new Set(groups['H 다른 법률 키워드가 함께 있는 문장(기대: 카드는 그대로, 감지 단어에서 제외 형태의 키워드만 빠질 수 있음)']);
const unexpected = [];
const missing = [];
const matchedOnly = [];
let diff = 0; const per = {};
for (const [g, cases] of Object.entries(groups)) {
  console.log('## ' + g); per[g] = 0;
  for (const t of cases) {
    const n = JSON.stringify(run(NEW, t)), o = JSON.stringify(run(OLD, t));
    const changed = n !== o;
    const sameCards = cardIds(NEW, t) === cardIds(OLD, t);
    if (changed) { diff++; per[g]++; }
    if (matchedOnlyGroup.has(t)) {
      if (!sameCards) unexpected.push(t + ' (카드가 달라짐)');
      else if (changed) matchedOnly.push(t);
    } else {
      if (changed && !expectedDiffs.has(t)) unexpected.push(t);
      if (!changed && expectedDiffs.has(t)) missing.push(t);
    }
    console.log(`${changed ? (sameCards ? '  ≈' : '  ≠') : '  ='} ${t} :: new=${n} old=${o}`);
  }
}
console.log('표기: = 완전 동일, ≈ 카드는 같고 감지 단어만 다름, ≠ 카드가 달라짐');
console.log('differences(new≠old) total:', diff);
for (const [g, c] of Object.entries(per)) console.log(`  ${g.split(' ')[0]}: ${c}/${groups[g].length}`);
console.log('카드가 달라진 문장이 제외 대상 7개와 정확히 같고, 그 밖의 차이는 H 그룹의 감지 단어 표시뿐인가:', unexpected.length === 0 && missing.length === 0 ? '예' : '아니오', JSON.stringify({ unexpected, missing, matchedOnly }));
