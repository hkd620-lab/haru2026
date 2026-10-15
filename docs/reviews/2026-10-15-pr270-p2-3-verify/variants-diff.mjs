import fs from 'node:fs';
const load = (p) => {
  const s = fs.readFileSync(p, 'utf8');
  const m = s.match(/const KEYWORD_VARIANTS: Record<string, string\[\]> = \{([\s\S]*?)\n\};/);
  return new Function('return ({' + m[1] + '\n})')();
};
const o = load(process.env.OLD_SRC), n = load(process.env.NEW_SRC);
const want = ['전세보증금','월세보증금','민사소송','행정소송','형사소송','합의서','고소장','내용증명우편','손해배상청구','고혈압','저혈압','고혈당','저혈당','공복혈당','식후혈당','건강보험료','현금영수증','입금했다','입금되었다','고소했다','고발했다','합의했다'];
const added = [], removed = [], changedKeys = [], newKeys = [];
for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
  const a = o[k] || [], b = n[k] || [];
  if (!(k in o)) newKeys.push(k);
  if (JSON.stringify(a) !== JSON.stringify(b)) changedKeys.push(k);
  for (const x of b) if (!a.includes(x)) added.push(`${k}:${x}`);
  for (const x of a) if (!b.includes(x)) removed.push(`${k}:${x}`);
  // 기존 항목이 같은 순서로 앞에 보존되는지
  if (a.length && JSON.stringify(b.slice(0, a.length)) !== JSON.stringify(a)) console.log('ORDER/PREFIX CHANGED for', k);
}
const addedForms = added.map((x) => x.split(':')[1]);
console.log('keys total old/new:', Object.keys(o).length, Object.keys(n).length);
console.log('new keys:', newKeys.join(' '));
console.log('changed existing keys:', changedKeys.filter((k) => !newKeys.includes(k)).join(' '));
console.log('added count:', added.length, '(expected 22)', '| removed:', removed.length);
console.log('added == requested 22 (set equality):', addedForms.length === want.length && want.every((w) => addedForms.includes(w)) && new Set(addedForms).size === 22);
console.log('duplicates inside any array:', Object.entries(n).filter(([, v]) => new Set(v).size !== v.length).map(([k]) => k).join(' ') || 'none');
console.log('added by key:', added.join(' '));
// 각 키가 실제 규칙 키워드인지 확인하기 위해 소스에서 keywords 배열을 대조
const src = fs.readFileSync(process.env.NEW_SRC, 'utf8');
const ruleBlock = src.slice(src.indexOf('const RECOMMENDATION_RULES'), src.indexOf('export const ASSISTANT_RECOMMENDATION_SAFETY_NOTE'));
const missing = newKeys.concat(['보증금']).filter((k) => !ruleBlock.includes(`'${k}'`));
console.log('keys not found as rule keyword strings:', missing.join(' ') || 'none');
