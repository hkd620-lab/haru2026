import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { AI_LIBRARY_CATEGORIES, normalizeAiLibraryCategory, applyAiLibraryMoves } from '../src/app/utils/aiLibraryCategory.ts';
import { AiLibraryPageRequestGuard, hasAiLibraryNextPage } from '../src/app/utils/aiLibraryPagination.ts';
import { parseAiImportPayload } from '../src/app/services/aiImportService.ts';
const page = readFileSync(new URL('../src/app/pages/AiLibraryPage.tsx', import.meta.url), 'utf8');
const payload = { importId: 'a'.repeat(64), content: 'synthetic content', source: 'slack', capturedAt: '2026-11-09T00:00:00Z' };
test('five topic IDs and missing/invalid legacy categories use a separate bucket', () => {
  assert.deepEqual(AI_LIBRARY_CATEGORIES.map(x => x.label), ['의료신기술', '건강상식', '생활정보', '투자정보', 'AI신기술']);
  for (const value of [undefined, null, '', 'unknown', 'all', {}, 'unclassified']) assert.equal(normalizeAiLibraryCategory(value), 'unclassified');
  for (const { value } of AI_LIBRARY_CATEGORIES) assert.equal(normalizeAiLibraryCategory(value), value);
});
test('legacy import remains unchanged and all optional category IDs round-trip', () => {
  assert.equal('category' in parseAiImportPayload(payload, payload.importId), false);
  for (const { value } of AI_LIBRARY_CATEGORIES) assert.equal(parseAiImportPayload({ ...payload, category: value }, payload.importId).category, value);
  for (const category of ['unclassified', 'all', '', null, {}, 'invalid']) assert.throws(() => parseAiImportPayload({ ...payload, category }, payload.importId), /목적 폴더/);
});
test('confirmed move removes old folder item, updates all count, preserves metadata/body and masks stale pagination', () => {
  const records = [{ id: 'a', content: 'original', source: 'slack' }, { id: 'b' }];
  const moves = new Map([['a', 'health']]);
  assert.deepEqual(applyAiLibraryMoves(records, 'unclassified', moves), [{ id: 'b' }]);
  const all = applyAiLibraryMoves(records, 'all', moves);
  assert.equal(all.length, 2);
  assert.deepEqual(all[0], { ...records[0], aiCategory: 'health' });
  assert.equal(applyAiLibraryMoves(records, 'health', moves).length, 1);
  assert.equal(records[0].aiCategory, undefined);
});
test('folder A-B-A invalidates pending pages and movement success/failure', async () => {
  const guard = new AiLibraryPageRequestGuard();
  const a = guard.startSession();
  const ticket = guard.startRequest(a, 'move:a');
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  let applied = false;
  const task = pending.then(() => { if (guard.isCurrent(a)) applied = true; });
  guard.endSession(a); guard.startSession(); const newA = guard.startSession();
  finish(); await task;
  assert.equal(applied, false);
  assert.equal(guard.finishRequest(ticket), false);
  assert.ok(guard.startRequest(newA, 'move:a'));
});
test('failed move leaves records intact; component only applies a confirmed result', async () => {
  const original = [{ id: 'a', aiCategory: 'health' }];
  let logs = original;
  try { await Promise.reject(new Error('conflict')); logs = applyAiLibraryMoves(logs, 'all', new Map([['a', 'life']])); } catch {}
  assert.equal(logs, original);
  assert.match(page, /await firestoreService.moveAiLibraryLog[\s\S]*?if \(!guard.isCurrent\(generation\)\) return;[\s\S]*?movesRef.current.set/);
  assert.match(page, /user\?\.emailVerified, folder\]/);
  assert.match(page, /setMoveBusy\(new Set\(\)\)/);
  assert.match(page, /setSelectedIds\(new Set\(\)\)/);
});
test('empty bounded page still supports load more and retained original actions', () => {
  assert.equal(hasAiLibraryNextPage('scan-cursor'), true);
  assert.match(page, /!loading && hasAiLibraryNextPage\(nextCursor\)/);
  for (const name of ['handleDeleteSelected', 'handleDeleteOne', 'handleConvertToBookMaterial', 'handleCardClick', 'BookMaterialPanel', 'navigator.clipboard.writeText', 'formatDate(log.createdAt)']) assert.ok(page.includes(name));
  assert.match(page, /검토가 필요한 자료는 보류/);
  assert.match(page, /추천 폴더로 이동/);
});

test('confirmed manual move leaves review list and stale pages cannot resurrect moved rows', () => {
  const rows = [{ id: 'a', aiReview: { recommendation: 'health' }, content: 'original' }, { id: 'b' }];
  assert.deepEqual(applyAiLibraryMoves(rows, 'review', new Map([['a', 'health']])), [rows[1]]);
  assert.equal(applyAiLibraryMoves(rows, 'review', new Map()).length, 2);
});
