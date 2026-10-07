// P3.5d Functions 형식 정의 스냅샷 — 기준 커밋(0423fa6)의 원래 형식·접두어 정의 3곳(+ 같은 블록의 SAYU 그룹 2개)을 뽑아 저장한다.
// 실행: node test/formatRegistry.makeSnapshot.mjs [--check]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const BASE = '0423fa64ea27bc734100c468b8c4092923c2d9eb';
const show = (path) => execFileSync('git', ['show', `${BASE}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const index = show('functions/src/index.ts');
const epub = show('functions/src/epubExport.ts');
const literalAfter = (source, marker, open, close) => {
  const at = source.indexOf(marker);
  assert.ok(at >= 0, `marker: ${marker}`);
  const start = source.indexOf(open, at + marker.length - 1);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    else if (source[i] === close) { depth -= 1; if (depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error(`unterminated: ${marker}`);
};
const evaluate = (literal) => Function(`return (${literal});`)();
const snapshot = {
  base: BASE,
  polishContent_RICH_FORMATS: evaluate(literalAfter(index, 'const RICH_FORMATS = [', '[', ']')),
  polishContent_BALANCED_FORMATS: evaluate(literalAfter(index, 'const BALANCED_FORMATS = [', '[', ']')),
  polishContent_CONSERVATIVE_FORMATS: evaluate(literalAfter(index, 'const CONSERVATIVE_FORMATS = [', '[', ']')),
  generateTitlesForAll_FORMAT_PREFIX_MAP: Object.entries(evaluate(literalAfter(index, 'const FORMAT_PREFIX_MAP: Record<string, string> = {', '{', '}'))),
  epubExport_FORMAT_PREFIX: Object.entries(evaluate(literalAfter(epub, 'const FORMAT_PREFIX: Record<string, string> = {', '{', '}'))),
};
const file = new URL('./formatRegistry.snapshot.json', import.meta.url);
if (process.argv.includes('--check')) {
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), snapshot);
  console.log('functions formatRegistry snapshot matches base', BASE.slice(0, 7));
} else {
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log('wrote', file.pathname);
}
