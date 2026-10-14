// 가상사용자(persona-sim) 시나리오에서 한국어 기록 문장 후보를 뽑는다. 라벨 없는 참고용 코퍼스다.
import fs from 'node:fs';
import path from 'node:path';
const dir = '/home/user/haru2026/frontend/test/persona-sim/personas';
const out = new Map();
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.mjs'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
  let m;
  while ((m = re.exec(src))) {
    const s = m[2].replace(/\\n/g, '\n').replace(/\\(['"`\\])/g, '$1').trim();
    if (!/[가-힣]/.test(s)) continue;
    if (s.length < 14) continue;
    if (/^(\.\.|\/|http|#|\$\{)/.test(s)) continue;
    if (/[{}<>]|=>|function|import /.test(s)) continue;
    if (!out.has(s)) out.set(s, f);
  }
}
const arr = [...out.entries()].map(([text, file]) => ({ text, file }));
fs.writeFileSync(process.argv[2], JSON.stringify(arr, null, 1));
console.log('persona strings:', arr.length);
