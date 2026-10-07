// P3.5 형식 등록부 스냅샷 — 기준 커밋(112f497)의 원래 형식·접두어 정의 값을 뽑아 저장한다(P3.5a 6곳, P3.5b 4곳).
// 실행: node test/formatRegistry.makeSnapshot.mjs [--check]
//   --check: 저장된 스냅샷이 기준 커밋에서 다시 뽑은 값과 같은지 확인한다.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const BASE = '112f4974d2d1d22d1d1ee6019f5eca3c80364758';
const show = (path) => execFileSync('git', ['show', `${BASE}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const haruTypes = show('frontend/src/app/types/haruTypes.ts');
const firestoreService = show('frontend/src/app/services/firestoreService.ts');
const sayuPage = show('frontend/src/app/pages/SayuPage.tsx');
const sayuModal = show('frontend/src/app/components/SayuModal.tsx');
const timelineCollage = show('frontend/src/app/components/TimelineCollageModal.tsx');

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
const evaluate = (literal) => Function('SNS_GALMURI_LABEL', `return (${literal});`)('SNS 갈무리');
const entries = (object) => Object.entries(object);

const snapshot = {
  base: BASE,
  haruTypes_FORMAT_PREFIX: entries(evaluate(literalAfter(haruTypes, 'export const FORMAT_PREFIX: Record<RecordFormat, string> = {', '{', '}'))),
  haruTypes_PREFIX_TO_FORMAT: entries(evaluate(literalAfter(haruTypes, 'export const PREFIX_TO_FORMAT: Record<string, RecordFormat> = {', '{', '}'))),
  firestoreService_PUBLIC_FORMAT_PREFIX: entries(evaluate(literalAfter(firestoreService, 'const PUBLIC_FORMAT_PREFIX: Record<RecordFormat, string> = {', '{', '}'))),
  firestoreService_statsPrefixMap: entries(evaluate(literalAfter(firestoreService, 'const prefixMap: Record<RecordFormat, string> = {', '{', '}'))),
  firestoreService_overviewFormatPrefixes: evaluate(literalAfter(firestoreService, 'const formatPrefixes = [', '[', ']')),
  firestoreService_EXPORT_FORMAT_PREFIXES: evaluate(literalAfter(firestoreService, 'private readonly EXPORT_FORMAT_PREFIXES = [', '[', ']')),
  // P3.5b
  sayuPage_PUBLIC_ALLOWED_FORMAT_KEYS: evaluate(literalAfter(sayuPage, 'const PUBLIC_ALLOWED_FORMAT_KEYS = new Set([', '[', ']')),
  sayuPage_ALL_FORMAT_PREFIXES: entries(evaluate(literalAfter(sayuPage, 'const ALL_FORMAT_PREFIXES: Record<string, string> = {', '{', '}'))),
  sayuModal_formatLabelMap: entries(evaluate(literalAfter(sayuModal, 'const formatLabelMap: Record<string, string> = {', '{', '}'))),
  timelineCollage_FORMAT_PREFIXES: evaluate(literalAfter(timelineCollage, 'const FORMAT_PREFIXES = [', '[', ']')),
};

const file = new URL('./formatRegistry.snapshot.json', import.meta.url);
if (process.argv.includes('--check')) {
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), snapshot);
  console.log('formatRegistry snapshot matches base', BASE.slice(0, 7));
} else {
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log('wrote', file.pathname);
}
