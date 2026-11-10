const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

// Execute the real TypeScript callable handlers with an entirely in-memory SDK.
// No Firebase app, credentials, emulator, production, or AI API is contacted.
function harness() {
  const rows = new Map();
  const reads = [];
  const writes = [];
  const DELETE = Symbol('delete');
  class Timestamp {
    constructor(seconds, nanoseconds = 0) { Object.assign(this, { seconds, nanoseconds }); }
    static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
    toDate() { return new Date(this.seconds * 1000 + this.nanoseconds / 1e6); }
  }
  const ref = (p) => ({ path: p, id: p.split('/').pop() });
  const snap = (r) => ({ ...r, exists: rows.has(r.path), data: () => rows.get(r.path), get: (k) => rows.get(r.path)?.[k] });
  const compare = (a, b) => b.get('createdAt').seconds - a.get('createdAt').seconds
    || b.get('createdAt').nanoseconds - a.get('createdAt').nanoseconds || b.id.localeCompare(a.id);
  let transactionTail = Promise.resolve();
  const db = {
    doc: ref,
    collection(p) {
      let after;
      let limit;
      const ordering = [];
      const expectedOrdering = [['createdAt', 'desc'], ['__name__', 'desc']];
      const q = {
        doc: (id) => ref(`${p}/${id}`),
        where(field, op, value) { assert.deepEqual([field, op, value], ['type', '==', 'ai_log']); return q; },
        orderBy(field, direction) {
          assert.ok(ordering.length < expectedOrdering.length, 'unexpected extra ordering');
          assert.deepEqual([field, direction], expectedOrdering[ordering.length]);
          ordering.push([field, direction]);
          return q;
        },
        startAfter(t, r) { after = { id: r.id, get: () => t }; return q; },
        limit(n) { limit = n; return q; },
        async get() {
          assert.deepEqual(ordering, expectedOrdering, 'handler must specify both sort keys in order');
          reads.push(limit);
          const docs = [...rows.keys()].filter((k) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/'))
            .map((k) => snap(ref(k))).filter((s) => s.get('type') === 'ai_log').sort(compare)
            .filter((s) => !after || compare(s, after) > 0).slice(0, limit);
          return { docs };
        },
      };
      return q;
    },
    async runTransaction(fn) {
      // Serialize mock transactions to model Firestore serializable commit results.
      const previous = transactionTail;
      let release;
      transactionTail = new Promise((resolve) => { release = resolve; });
      await previous;
      try { return await fn({
        get: async (r) => snap(r), getAll: async (...rs) => rs.map(snap),
        set(r, data) { writes.push(data); rows.set(r.path, data); },
        update(r, data) {
          writes.push(data);
          const next = { ...rows.get(r.path), ...data };
          for (const [k, v] of Object.entries(next)) if (v === DELETE) delete next[k];
          rows.set(r.path, next);
        },
        delete: (r) => rows.delete(r.path),
      }); } finally { release(); }
    },
  };
  const firestore = Object.assign(() => db, { Timestamp, FieldPath: { documentId: () => '__name__' }, FieldValue: { serverTimestamp: () => 'SERVER_TIME', delete: () => DELETE } });
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, `../src/${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
    vm.runInThisContext(`(function(require,exports){${code}\n})`)((id) => {
      if (id === 'firebase-admin') return { firestore };
      if (id === 'firebase-functions/v2/https') return { HttpsError, onCall: (_opts, fn) => fn };
      if (id === './aiLibraryCategory') return load('aiLibraryCategory');
      throw Error(`Unexpected dependency: ${id}`);
    }, exports);
    cache[name] = exports;
    return exports;
  }
  const auth = { uid: 'owner', token: { email: 'hkd620@gmail.com', email_verified: true } };
  const api = load('aiLibrary');
  const call = (name, data, identity = auth) => api[name]({ data, auth: identity });
  const seed = (id, category, seconds = 100, uid = 'owner', type = 'ai_log') => rows.set(`users/${uid}/records/${id}`, {
    type, content: `content:${id}`, source: 'slack', createdAt: new Timestamp(seconds), ...(category === undefined ? {} : { aiCategory: category }),
  });
  return { call, seed, rows, reads, writes, helper: load('aiLibraryCategory') };
}
const rejects = (p, code) => assert.rejects(p, (e) => e.code === code);

test('filtered scan finds older matches; pages have no gaps or duplicates at tied timestamps', async () => {
  const h = harness();
  for (let i = 0; i < 150; i++) h.seed(String(i).padStart(3, '0'), i < 25 ? 'health' : 'life');
  let cursor;
  const ids = [];
  let empty = 0;
  do {
    const result = await h.call('listAiLibraryLogs', { category: 'health', ...(cursor ? { cursor } : {}) });
    assert.ok(result.logs.length <= 10);
    if (!result.logs.length) empty++;
    ids.push(...result.logs.map((r) => r.id));
    cursor = result.nextCursor;
  } while (cursor);
  assert.equal(empty, 1);
  assert.deepEqual(ids, Array.from({ length: 25 }, (_, i) => String(24 - i).padStart(3, '0')));
  assert.ok(h.reads.every((n) => n <= 100));
});

test('legacy/invalid categories normalize to unclassified; all v1 cursor remains compatible', async () => {
  const h = harness();
  h.seed('old', undefined); h.seed('invalid', 'removed-topic'); h.seed('new', 'health');
  const result = await h.call('listAiLibraryLogs', { category: 'unclassified' });
  assert.deepEqual(result.logs.map((r) => r.id), ['old', 'invalid']);
  assert.ok(result.logs.every((r) => r.aiCategory === 'unclassified'));
  for (let i = 0; i < 11; i++) h.seed(`all-${i}`, 'life', 200);
  const first = await h.call('listAiLibraryLogs', {});
  assert.equal(JSON.parse(Buffer.from(first.nextCursor, 'base64url')).v, 1);
  const second = await h.call('listAiLibraryLogs', { cursor: first.nextCursor });
  assert.equal(new Set([...first.logs, ...second.logs].map((r) => r.id)).size, 14);
});

test('invalid category/cursors and cross-category cursor reuse rejected before query', async () => {
  const h = harness();
  for (let i = 0; i < 12; i++) h.seed(`id-${i}`, 'health');
  const { nextCursor } = await h.call('listAiLibraryLogs', { category: 'health' });
  for (const data of [{ category: null }, { category: '' }, { cursor: '!' }, { cursor: nextCursor }, { category: 'life', cursor: nextCursor }]) {
    const reads = h.reads.length;
    await rejects(h.call('listAiLibraryLogs', data), 'invalid-argument');
    assert.equal(h.reads.length, reads);
  }
  const all = await h.call('listAiLibraryLogs', {});
  await rejects(h.call('listAiLibraryLogs', { category: 'health', cursor: all.nextCursor }), 'invalid-argument');
});

test('import category validates and duplicate save preserves all original fields', async () => {
  const h = harness();
  const data = { importId: 'a'.repeat(64), content: 'original', source: 'slack', capturedAt: '2026-01-01T00:00:00Z', category: 'ai-tech' };
  const saved = await h.call('saveAiLibraryImport', data);
  const before = { ...h.rows.get(`users/owner/records/${saved.recordId}`) };
  assert.equal(before.aiCategory, 'ai-tech');
  assert.equal(before.aiCategorySource, 'manual');
  assert.equal((await h.call('saveAiLibraryImport', { ...data, content: 'changed', category: 'health' })).duplicate, true);
  assert.deepEqual(h.rows.get(`users/owner/records/${saved.recordId}`), before);
  await rejects(h.call('saveAiLibraryImport', { ...data, category: 'unclassified' }), 'invalid-argument');
  const legacy = await h.call('saveAiLibraryImport', { ...data, importId: 'b'.repeat(64), category: undefined });
  assert.equal(h.rows.get(`users/owner/records/${legacy.recordId}`).aiCategory, undefined);
});

test('manual move changes only classification, stale concurrent intent aborts, clear remains manual', async () => {
  const h = harness(); h.seed('record', undefined);
  const before = { ...h.rows.get('users/owner/records/record') };
  assert.deepEqual(await h.call('moveAiLibraryLog', { id: 'record', category: 'health', expectedCategory: 'unclassified' }), { id: 'record', category: 'health' });
  assert.deepEqual(Object.keys(h.writes[0]).sort(), ['aiCategory', 'aiCategorySource', 'aiCategoryUpdatedAt']);
  for (const [k, v] of Object.entries(before)) assert.deepEqual(h.rows.get('users/owner/records/record')[k], v);
  await rejects(h.call('moveAiLibraryLog', { id: 'record', category: 'life', expectedCategory: 'unclassified' }), 'aborted');
  await h.call('moveAiLibraryLog', { id: 'record', category: 'unclassified', expectedCategory: 'health' });
  assert.equal(h.helper.canAutomaticallyClassifyAiLibraryRecord(h.rows.get('users/owner/records/record')), false);
  assert.equal(h.helper.canAutomaticallyClassifyAiLibraryRecord({}), true);
});

test('manual choice wins over an automatic result newer than the displayed category', async () => {
  const h = harness(); h.seed('record', 'health');
  h.rows.get('users/owner/records/record').aiCategorySource = 'auto';
  await h.call('moveAiLibraryLog', { id: 'record', category: 'life', expectedCategory: 'unclassified' });
  assert.equal(h.rows.get('users/owner/records/record').aiCategory, 'life');
  assert.equal(h.rows.get('users/owner/records/record').aiCategorySource, 'manual');
  await rejects(h.call('moveAiLibraryLog', { id: 'record', category: 'investment', expectedCategory: 'unclassified' }), 'aborted');
});

test('ownership, type, verified email and max10 delete protections remain', async () => {
  const h = harness(); h.seed('foreign', 'health', 1, 'other'); h.seed('wrong', 'health', 1, 'owner', 'diary');
  for (const id of ['foreign', 'wrong']) await rejects(h.call('moveAiLibraryLog', { id, category: 'life', expectedCategory: 'health', uid: 'other' }), 'failed-precondition');
  for (const id of ['../foreign', '.', '__reserved__']) await rejects(h.call('moveAiLibraryLog', { id, category: 'life', expectedCategory: 'health' }), 'invalid-argument');
  for (const name of ['moveAiLibraryLog', 'listAiLibraryLogs', 'saveAiLibraryImport', 'deleteAiLibraryLogs']) {
    await rejects(h.call(name, {}, null), 'unauthenticated');
    await rejects(h.call(name, {}, { uid: 'owner', token: { email: 'hkd620@gmail.com', email_verified: false } }), 'permission-denied');
  }
  await rejects(h.call('deleteAiLibraryLogs', { ids: Array.from({ length: 11 }, (_, i) => `${i}`) }), 'invalid-argument');
  assert.equal(h.writes.length, 0);
});

test('cursor strict shape and timestamp/id validation; malformed input performs no reads', async () => {
  const h = harness();
  const valid = { v: 2, category: 'health', seconds: 10, nanoseconds: 0, id: 'valid' };
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  for (const cursor of [null, 42, '', 'x'.repeat(4097), encode(null), encode([]),
    ...[{ extra: true }, { v: 1 }, { seconds: 0.5 }, { seconds: 253402300800 }, { nanoseconds: -1 }, { nanoseconds: 1e9 }, { id: '../x' }, { id: '' }, { id: '__x__' }].map((patch) => encode({ ...valid, ...patch })),
  ]) await rejects(h.call('listAiLibraryLogs', { category: 'health', cursor }), 'invalid-argument');
  assert.equal(h.reads.length, 0);
});

test('empty full scans advance to exhaustion and deleted cursor anchor remains usable', async () => {
  const h = harness();
  for (let i = 0; i < 200; i++) h.seed(String(i).padStart(3, '0'), 'life');
  const first = await h.call('listAiLibraryLogs', { category: 'investment' });
  assert.deepEqual(first.logs, []); assert.ok(first.nextCursor);
  const anchor = JSON.parse(Buffer.from(first.nextCursor, 'base64url')).id;
  h.rows.delete(`users/owner/records/${anchor}`);
  const second = await h.call('listAiLibraryLogs', { category: 'investment', cursor: first.nextCursor });
  assert.deepEqual(second.logs, []); assert.ok(second.nextCursor);
  const last = await h.call('listAiLibraryLogs', { category: 'investment', cursor: second.nextCursor });
  assert.deepEqual(last, { logs: [] });
});


test('concurrent moves with the same expected category cannot silently overwrite', async () => {
  const h = harness(); h.seed('race', 'health');
  const results = await Promise.allSettled(['life', 'investment'].map((category) =>
    h.call('moveAiLibraryLog', { id: 'race', category, expectedCategory: 'health' })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'aborted');
  assert.equal(h.writes.length, 1);
});
