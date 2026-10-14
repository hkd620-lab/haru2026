// 시제품(조사 확장+합성어 목록, 복사본)과 PR 원본이 같은 입력에서 달라지는 경우를 모두 출력한다 — 새 오탐 점검용
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const SP = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad';
const prM = await import(pathToFileURL(`${SP}/cc-270/frontend/src/app/utils/assistantRecommendations.ts`).href);
const prot = await import(pathToFileURL(`${SP}/cc-270-mut/frontend/src/app/utils/assistantRecommendations.ts`).href);
const f = (r) => r.map((x) => `${x.id}(${x.matchedKeywords.join('·')})`).join(' ') || '없음';
const persona = JSON.parse(fs.readFileSync(`${SP}/pr270-verify/corpus-persona.json`, 'utf8')).map((x) => x.text);
const stress = JSON.parse(fs.readFileSync(`${SP}/pr270-verify/stress-set.json`, 'utf8')).map((x) => x[0]);
let n = 0;
for (const t of [...persona, ...stress]) {
  const a = f(prM.getAssistantRecommendations(t, ['일기'])), b = f(prot.getAssistantRecommendations(t, ['일기']));
  if (a !== b) { n++; console.log(`${stress.includes(t) ? '[스트레스]' : '[가상사용자]'} ${t.replace(/\n/g, ' ').slice(0, 70)} | PR ${a} | 시제품 ${b}`); }
}
console.log('PR과 시제품이 달라진 입력:', n, '/', persona.length + stress.length);
