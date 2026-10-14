// 수정 전(main)과 수정 후(PR #270) getAssistantRecommendations 를 같은 입력으로 직접 실행해 비교한다.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const SP = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad';
const oldM = await import(pathToFileURL(`${SP}/cc-270-main/frontend/src/app/utils/assistantRecommendations.ts`).href);
const newM = await import(pathToFileURL(`${SP}/cc-270/frontend/src/app/utils/assistantRecommendations.ts`).href);
const fmt = (r) => r.map((x) => `${x.id}(${x.matchedKeywords.join('·')})`).join(' ') || '없음';
const ids = (r) => r.map((x) => x.id);

const stress = JSON.parse(fs.readFileSync(`${SP}/pr270-verify/stress-set.json`, 'utf8'));
const persona = JSON.parse(fs.readFileSync(`${SP}/pr270-verify/corpus-persona.json`, 'utf8'));

const result = { stress: [], persona: [] };
for (const [text, primary, note] of stress) {
  const o = oldM.getAssistantRecommendations(text, ['일기']);
  const n = newM.getAssistantRecommendations(text, ['일기']);
  const has = (r) => primary ? ids(r).some((id) => id === primary || (primary === 'health' && id === 'hospital') || (primary === 'hospital' && id === 'health')) : null;
  result.stress.push({ text, primary, note, old: fmt(o), new: fmt(n), oldHit: has(o), newHit: has(n), oldIds: ids(o), newIds: ids(n) });
}
for (const { text, file } of persona) {
  const o = oldM.getAssistantRecommendations(text, ['일기']);
  const n = newM.getAssistantRecommendations(text, ['일기']);
  if (JSON.stringify(ids(o)) !== JSON.stringify(ids(n)) || fmt(o) !== fmt(n)) {
    result.persona.push({ file, text, old: fmt(o), new: fmt(n), oldIds: ids(o), newIds: ids(n) });
  }
}
fs.writeFileSync(`${SP}/pr270-verify/compare-results.json`, JSON.stringify(result, null, 1));

// 요약
const withPrimary = result.stress.filter((r) => r.primary);
const oldHits = withPrimary.filter((r) => r.oldHit).length;
const newHits = withPrimary.filter((r) => r.newHit).length;
const lost = withPrimary.filter((r) => r.oldHit && !r.newHit);
const gained = withPrimary.filter((r) => !r.oldHit && r.newHit);
console.log(`스트레스 세트 ${stress.length}문장(주 분야 라벨 ${withPrimary.length}): 수정 전 주 분야 카드 ${oldHits}, 수정 후 ${newHits}, 새로 놓침 ${lost.length}, 새로 잡음 ${gained.length}`);
const nulls = result.stress.filter((r) => !r.primary);
console.log('라벨 없음(오탐 후보) 문장:');
for (const r of nulls) console.log(`  ${r.text} | 전 ${r.old} | 후 ${r.new}`);
console.log('--- 새로 놓침(전에는 주 분야 카드가 있었는데 후에는 없음) ---');
for (const r of lost) console.log(`  [${r.primary}] ${r.text} (${r.note}) | 전 ${r.old} | 후 ${r.new}`);
console.log('--- 둘 다 놓침 ---');
for (const r of withPrimary.filter((x) => !x.oldHit && !x.newHit)) console.log(`  [${r.primary}] ${r.text} (${r.note}) | 전 ${r.old} | 후 ${r.new}`);
console.log('--- 새로 잡음 ---');
for (const r of gained) console.log(`  [${r.primary}] ${r.text} | 전 ${r.old} | 후 ${r.new}`);
console.log('--- 둘 다 잡음 ---', withPrimary.filter((x) => x.oldHit && x.newHit).length);
console.log(`가상사용자 문자열 ${persona.length}개 중 결과가 달라진 것: ${result.persona.length}`);
