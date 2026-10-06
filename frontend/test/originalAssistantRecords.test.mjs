import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8');
function compile(source, dependencies, loader = 'ts') {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', transformSync(source, { loader, format: 'cjs', jsx: 'automatic' }).code)(
    path => dependencies[path] ?? require(path), module, module.exports);
  return module.exports;
}
function serviceFixture() {
  const auth = { currentUser: { uid: 'fixture-user' } }, state = { reads: [], rows: [] };
  const service = compile(read('services/originalAssistantRecords.ts'), {
    '../../firebase': { auth, db: {} },
    'firebase/firestore': {
      collection: (db, ...parts) => parts.join('/'), orderBy: (field, order) => ({ field, order }), limit: value => ({ limit: value }), query: (...parts) => parts,
      getDocs: async query => { state.reads.push(query); if (state.pending) await state.pending; if (state.error) throw state.error; return { docs: state.rows.map(row => ({ id: row.id, data: () => row.data })) }; },
    },
  });
  return { auth, state, service };
}
test('pet records read only the current owner collection and use document IDs', async () => {
  const f = serviceFixture(); f.state.rows = [{ id: 'actual-document', data: { id: 'forged-data-id', petName: '合成<名前>', query: '합성 입력', answer: ['기존 안내1', '기존 안내2'] } }];
  const result = await f.service.loadOriginalAssistantRecords('fixture-user', 'pet');
  assert.deepEqual(f.state.reads, [['users/fixture-user/petHealthLogs', { field: 'createdAt', order: 'desc' }, { limit: 20 }]]);
  assert.equal(result[0].id, 'actual-document'); assert.equal(result[0].fields.find(field => field.label === '저장된 안내').value, '기존 안내1\n기존 안내2');
});
test('legal records preserve the source status and return to the exact case ID', async () => {
  const f = serviceFixture(); f.state.rows = [{ id: 'case id', data: { title: '합성 사건', status: '보정필요', caseNumber: '합성 번호', memo: '기존 메모' } }];
  const result = await f.service.loadOriginalAssistantRecords('fixture-user', 'legal');
  assert.equal(f.state.reads[0][0], 'users/fixture-user/legalCases'); assert.equal(result[0].origin, '/legal-cases/case%20id');
  assert.equal(result[0].fields.find(field => field.label === '현재 상태').value, '보정필요');
});
test('invalid owner or kind is rejected before any read', async () => {
  const f = serviceFixture();
  for (const [uid, kind] of [['other-user', 'pet'], ['', 'pet'], ['fixture-user', 'unknown']]) {
    await assert.rejects(f.service.loadOriginalAssistantRecords(uid, kind));
  }
  assert.equal(f.state.reads.length, 0);
});
test('an account change during the read cannot return the previous owner records', async () => {
  const f = serviceFixture(); let resolve; f.state.pending = new Promise(done => { resolve = done; });
  const loading = f.service.loadOriginalAssistantRecords('fixture-user', 'legal'); f.auth.currentUser = { uid: 'other-user' }; resolve();
  await assert.rejects(loading, /계정이 변경/);
});
test('read permission failure is propagated and never reported as an empty collection', async () => {
  const f = serviceFixture(); f.state.error = new Error('fixture permission denied');
  await assert.rejects(f.service.loadOriginalAssistantRecords('fixture-user', 'pet'), /permission denied/);
});

function componentsFixture(status = 'ready', rows = [], consent = true) {
  const routes = [], state = { loads: 0 };
  const components = compile(read('components/OriginalAssistantRecords.tsx'), {
    react: { useState: initial => [Array.isArray(initial) ? rows : initial === 'loading' ? status : null, () => {}], useEffect() {} },
    'react-router': { useNavigate: () => (path, options) => routes.push({ path, ...options }) },
    '../hooks/useRecordReadConsent': { useRecordReadConsent: () => consent },
    '../services/originalAssistantRecords': { loadOriginalAssistantRecords: async () => { state.loads++; return rows; } },
  }, 'tsx');
  return { components, routes, state };
}
test('actual source list renders escaped saved content and no input, save or AI controls', () => {
  const f = serviceFixture(), row = f.service.mapOriginalAssistantRecord('pet-document', { petName: '<합성 이름>', answer: '기존 안내' }, 'pet');
  const ui = componentsFixture('ready', [row]);
  const html = renderToStaticMarkup(createElement(ui.components.OriginalAssistantRecordsList, { uid: 'fixture-user', kind: 'pet' }));
  assert.ok(html.includes('&lt;합성 이름&gt;')); assert.ok(html.includes('기존 안내'));
  assert.ok(!html.includes('<input')); assert.ok(!html.includes('저장하기')); assert.ok(!html.includes('AI 생성'));
});
test('legal consent denies list rendering and offers only the original consent screen', () => {
  const ui = componentsFixture('ready', [], false);
  const html = renderToStaticMarkup(createElement(ui.components.LegalOriginalAssistantRecords, { uid: 'fixture-user' }));
  assert.ok(html.includes('민감정보 열람 동의')); assert.ok(html.includes('사건 관리 화면으로'));
  assert.ok(!html.includes('원본 기록이 없습니다')); assert.equal(ui.state.loads, 0);
});
test('pending legal consent does not expose a list', () => {
  const ui = componentsFixture('ready', [], null);
  const html = renderToStaticMarkup(createElement(ui.components.LegalOriginalAssistantRecords, { uid: 'fixture-user' }));
  assert.ok(html.includes('확인하는 중')); assert.ok(!html.includes('<details'));
});
test('actual source list distinguishes error and empty states', () => {
  const render = status => { const ui = componentsFixture(status); return renderToStaticMarkup(createElement(ui.components.OriginalAssistantRecordsList, { uid: 'fixture-user', kind: 'pet' })); };
  assert.ok(render('error').includes('불러오지 못했습니다')); assert.ok(!render('error').includes('저장된 원본 기록이 없습니다'));
  assert.ok(render('ready').includes('저장된 원본 기록이 없습니다'));
});
test('opening the source panel initially does not read collections and provides existing query destinations', () => {
  const ui = componentsFixture(); const html = renderToStaticMarkup(createElement(ui.components.OriginalAssistantRecords, { uid: 'fixture-user' }));
  assert.equal(ui.state.loads, 0); for (const label of ['온비드 조회', '약정보 조회', '병원 조회', 'EBS 정보']) assert.ok(html.includes(label));
});
test('actual lifecycle cancels a delayed list result after unmount', async () => {
  let resolve, cleanup; const updates = [];
  const components = compile(read('components/OriginalAssistantRecords.tsx'), {
    react: { useState: initial => [initial, value => updates.push(value)], useEffect: effect => { cleanup = effect(); } },
    'react-router': { useNavigate: () => () => {} }, '../hooks/useRecordReadConsent': { useRecordReadConsent: () => true },
    '../services/originalAssistantRecords': { loadOriginalAssistantRecords: () => new Promise(done => { resolve = done; }) },
  }, 'tsx');
  components.OriginalAssistantRecordsList({ uid: 'fixture-user', kind: 'pet' }); const before = updates.length;
  cleanup(); resolve([{ id: 'old-owner-record' }]); await new Promise(done => setImmediate(done)); assert.equal(updates.length, before);
});
