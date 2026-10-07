// P3.5d Functions 형식 등록부 — (1) 프런트 형식 등록부와 저장 필드 접두어가 같은지, (2) 바꾼 3곳의 값이 기준 커밋과 같은지 확인한다.
// 실행: npm run build && node --experimental-strip-types --test test/formatRegistry.parity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const functionsRegistry = require('../lib/formats/formatRegistry.js');
const frontendRegistry = await import('../../frontend/src/app/records/formatRegistry.ts');
const snapshot = JSON.parse(readFileSync(new URL('./formatRegistry.snapshot.json', import.meta.url), 'utf8'));
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const arrayAfter = (source, marker) => {
  const at = source.indexOf(marker);
  assert.ok(at >= 0, `marker: ${marker}`);
  const start = source.indexOf('[', at + marker.length - 1);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1;
    else if (source[i] === ']') { depth -= 1; if (depth === 0) return Function(`return (${source.slice(start, i + 1)});`)(); }
  }
  throw new Error(`unterminated: ${marker}`);
};

test('Functions 등록부의 저장 필드 접두어가 프런트 등록부와 같다(형식·순서 포함)', () => {
  const frontend = frontendRegistry.ALL_REGISTERED_FORMATS.map((format) => [format, frontendRegistry.getFormatKey(format)]);
  assert.deepEqual(Object.entries(functionsRegistry.FORMAT_FIELD_PREFIX), frontend);
});

test('polishContent SAYU 그룹·generateTitlesForAll·epubExport 의 값이 기준 커밋과 같다', () => {
  const index = read('index.ts');
  const epub = read('epubExport.ts');
  const group = (name) => functionsRegistry.formatPrefixesOf(arrayAfter(index, `const ${name} = formatPrefixesOf(`));
  assert.deepEqual(group('RICH_FORMATS'), snapshot.polishContent_RICH_FORMATS);
  assert.deepEqual(group('BALANCED_FORMATS'), snapshot.polishContent_BALANCED_FORMATS);
  assert.deepEqual(group('CONSERVATIVE_FORMATS'), snapshot.polishContent_CONSERVATIVE_FORMATS);
  assert.deepEqual(
    Object.entries(functionsRegistry.buildFormatPrefixMap(arrayAfter(index, 'const FORMAT_PREFIX_MAP: Record<string, string> = buildFormatPrefixMap('))),
    snapshot.generateTitlesForAll_FORMAT_PREFIX_MAP,
  );
  assert.deepEqual(
    Object.entries(functionsRegistry.buildFormatPrefixMap(arrayAfter(epub, 'const FORMAT_PREFIX: Record<string, string> = buildFormatPrefixMap('))),
    snapshot.epubExport_FORMAT_PREFIX,
  );
  // 바꾼 곳에 접두어 표가 다시 생기지 않는다
  for (const source of [index, epub]) {
    assert.doesNotMatch(source, /['"]?일기['"]?\s*:\s*['"]diary['"]/);
    assert.doesNotMatch(source, /RICH_FORMATS = \['diary'/);
  }
});
