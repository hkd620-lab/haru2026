// 점수 가중치(강 3·약 1)를 바꿔도 통과하는 시험 공백을 메울 최소 입력을 찾는다(변이 M01·M03 대비).
import { pathToFileURL } from 'node:url';
const SP = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad';
const base = `${SP}/cc-270-mut/frontend/src/app/utils/`;
const orig = await import(pathToFileURL(base + 'assistantRecommendations.ts').href);
const m01 = await import(pathToFileURL(base + 'assistantRecommendations.M01.ts').href);
const m03 = await import(pathToFileURL(base + 'assistantRecommendations.M03.ts').href);
const pool = ['소송','임대차','보증금','내용증명','합의','법률','강아지','고양이','반려견','사료','산책','피부','구토','배변','짖음','제주','일본','오사카','여행','일정','교통','맛집','주차','걱정','고민','불안','준비','정리','계획','방법','아이','학교','육아','상담','공부','성장','친구','혈당','당뇨','혈압','통증','운동','식단','체중','수면','피로','지출','수입','세금','카드','비용','계좌','텃밭','고추','상추','수확','잎','벌레','줄기'];
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const key = (r) => r.map((x) => x.id).join(',');
const found = { M01: [], M03: [] };
for (let i = 0; i < 40000; i++) {
  const n = 2 + Math.floor(rnd() * 5);
  const toks = Array.from({ length: n }, () => pool[Math.floor(rnd() * pool.length)]);
  const text = [...new Set(toks)].join(' ');
  const o = key(orig.getAssistantRecommendations(text, ['메모']));
  if (key(m01.getAssistantRecommendations(text, ['메모'])) !== o) found.M01.push([text, o, key(m01.getAssistantRecommendations(text, ['메모']))]);
  if (key(m03.getAssistantRecommendations(text, ['메모'])) !== o) found.M03.push([text, o, key(m03.getAssistantRecommendations(text, ['메모']))]);
}
for (const k of ['M01', 'M03']) {
  found[k].sort((a, b) => a[0].length - b[0].length);
  console.log(`${k}: 원본과 결과가 달라지는 입력 ${found[k].length}건. 짧은 순 5건(입력 | 원본 | 변이):`);
  for (const f of found[k].slice(0, 5)) console.log('  ', f.join(' | '));
}
