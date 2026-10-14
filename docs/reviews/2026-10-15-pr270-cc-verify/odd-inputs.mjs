import { pathToFileURL } from 'node:url';
const SP = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad';
const m = await import(pathToFileURL(`${SP}/cc-270/frontend/src/app/utils/assistantRecommendations.ts`).href);
const cases = { 'null': null, 'undefined': undefined, '빈 문자열': '', '공백·개행': ' \n\t ', '숫자': 12345, '객체': { a: 1 }, '배열': ['소송'], '짝 없는 서로게이트': '\ud800아이\udc00', '이모지 경계': '강아지🐶와 산책', 'NFD 한글': '강아지와'.normalize('NFD'), '제어문자·ZWSP': '혈​당이 높다', '전각 공백 경계': '소송　중', '긴 개행 혼합': '소송\n\n임대차\r\n보증금', '영문 대문자 혼합': 'AI 아이 Dog 강아지' };
for (const [k, v] of Object.entries(cases)) {
  try { const r = m.getAssistantRecommendations(v, ['메모']); console.log('OK  ', k.padEnd(14), '→', r.map((x) => x.id).join(',') || '없음'); }
  catch (e) { console.log('THROW', k, e && e.message); }
}
// formats 인자 이상값
for (const f of [undefined, [], [''], ['unknown'], ['diary', '메모'], [' 하루LAW ']]) {
  try { console.log('OK   formats', JSON.stringify(f), '→', m.getAssistantRecommendations('소송 임대차 고민 걱정', f).map((x) => x.id).join(',')); } catch (e) { console.log('THROW formats', JSON.stringify(f), e.message); }
}
