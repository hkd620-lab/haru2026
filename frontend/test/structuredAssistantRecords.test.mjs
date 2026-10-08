import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as views from '../src/app/utils/structuredAssistantRecords.ts';
import * as growthSubjectUtils from '../src/app/utils/growthSubject.ts';
import { getStructuredViewAccess } from '../src/app/assistants/sayuAdapters.ts';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8');
const extract = (source, name) => source.match(new RegExp(`  const ${name} = [\\s\\S]*?\\n  };`))[0];
function handlers(source, names, env) {
  const code = transformSync(names.map(name => extract(source, name)).join('\n'), { loader: 'ts' }).code;
  return new Function(...Object.keys(env), `${code}\nreturn {${names.join(',')}}`)(...Object.values(env));
}
function moduleFrom(source, overrides, loader = 'ts') {
  const code = transformSync(source, { loader, format: 'cjs', jsx: 'automatic' }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(path => overrides[path] ?? require(path), module, module.exports);
  return module.exports;
}
const english = { id: 'english-second', date: '2026-09-20', formats: ['직접작성영어일기'], english_diary_title: '합성 일기', english_diary_korean: '<원문> 줄1\n줄2', english_diary_english: 'Original English.', _english_sentences: ['Original English.'] };
const growth = { id: 'growth-second', date: '2026-10-06', formats: ['성장기록'], growthSubjectName: '합성 대상', child_measuredate: '2026-09-01', child_height: '45.50', child_weight: '6.0', child_headcircum: '35' };
const voiding = { id: 'voiding-second', date: '2026-09-20', formats: ['배뇨일지'], voiding_entries: JSON.stringify([{ time: '03:00', type: 'void', amountMl: 0 }, { time: '09:10', type: 'drink', amountMl: 120 }]), voiding_sayu: '기존 저장 해석' };

test('English reader preserves original Korean, English and learning sentences without altering the record', () => {
  const original = structuredClone(english), view = views.buildStructuredAssistantView(english, 'english_diary');
  assert.equal(view.rows.find(row => row.label === '한국어 원문').value, english.english_diary_korean);
  assert.equal(view.rows.find(row => row.label === '학습 문장 1').value, 'Original English.');
  assert.deepEqual(english, original);
});
test('growth reader separates record date from measurement date and preserves decimal strings/units', () => {
  const view = views.buildStructuredAssistantView(growth, 'child_measure');
  assert.equal(view.rows.find(row => row.label === '측정일').value, '2026-09-01');
  assert.equal(view.rows.find(row => row.label === '키').value, '45.50 cm');
  assert.equal(view.rows.find(row => row.label === '몸무게').value, '6.0 kg');
});
test('voiding reader keeps zero amounts, entry order and the stored interpretation', () => {
  const view = views.buildStructuredAssistantView(voiding, 'voiding');
  assert.deepEqual(view.entries, [{ time: '03:00', type: '배뇨', amount: '0 ml' }, { time: '09:10', type: '음료', amount: '120 ml' }]);
  assert.equal(view.rows.find(row => row.label === '기존 저장 해석').value, voiding.voiding_sayu);
});
test('malformed voiding entries show an explicit warning and never become invented measurements', () => {
  for (const raw of ['broken json', '{}', '[null, 5, {"time":{},"type":"other","amountMl":{}}]']) {
    const view = views.buildStructuredAssistantView({ voiding_entries: raw }, 'voiding');
    assert.ok(view.warning); assert.ok(view.entries.every(entry => !entry.amount.includes('[object')));
  }
});
test('ordinary memo records are not misclassified as any structured assistant format', () => {
  const memo = { date: '2026-09-20', formats: ['메모'], memo_content: '기존 메모' };
  for (const prefix of ['english_diary', 'child_measure', 'voiding']) {
    assert.equal(views.hasStructuredAssistantRecord(memo, prefix), false);
    assert.equal(views.structuredAssistantSourceText(memo, prefix), '');
  }
});
test('existing childcare journals with measurement fields keep their existing format', () => {
  assert.equal(views.hasStructuredAssistantRecord({ formats: ['육아일기'], child_height: '45', child_weight: '6' }, 'child_measure'), false);
});

const Modal = moduleFrom(read('components/StructuredAssistantRecordModal.tsx'), {
  'react-router': { useNavigate: () => () => {} }, '../utils/structuredAssistantRecords': views,
}, 'tsx').StructuredAssistantRecordModal;
test('actual reader renders escaped original text and only close/origin controls', () => {
  const html = renderToStaticMarkup(createElement(Modal, { record: english, prefix: 'english_diary', onClose() {} }));
  assert.ok(html.includes('&lt;원문&gt;')); assert.ok(html.includes('Original English.'));
  assert.equal((html.match(/<button/g) ?? []).length, 2);
  assert.ok(!html.includes('<input')); assert.ok(!html.includes('다시 다듬기')); assert.ok(!html.includes('공개'));
});
test('actual voiding reader renders the units and saved interpretation without an analysis control', () => {
  const html = renderToStaticMarkup(createElement(Modal, { record: voiding, prefix: 'voiding', onClose() {} }));
  assert.ok(html.includes('0 ml')); assert.ok(html.includes('기존 저장 해석')); assert.equal((html.match(/<button/g) ?? []).length, 2);
});

function consentFixture() {
  let stored = null, previousDeps, cleanup;
  const listeners = [];
  const hook = moduleFrom(read('hooks/useRecordReadConsent.ts'), {
    react: {
      useState: () => [stored, value => { stored = value; }],
      useEffect: (effect, deps) => { if (!previousDeps || deps.some((value, i) => value !== previousDeps[i])) { cleanup?.(); previousDeps = deps; cleanup = effect(); } },
    },
    'firebase/firestore': { doc: (db, path, uid) => uid, onSnapshot: (uid, success, failure) => { const item = { uid, success, failure, unsubscribed: false }; listeners.push(item); return () => { item.unsubscribed = true; }; } },
    '../../firebase': { db: {} },
  }).useRecordReadConsent;
  return { hook, listeners };
}
test('read consent waits for a strict true value and cannot grant consent', () => {
  const f = consentFixture(); assert.equal(f.hook('user-A', 'sensitiveHealth'), null);
  f.listeners[0].success({ data: () => ({ consents: { sensitiveHealth: 'true' } }) });
  assert.equal(f.hook('user-A', 'sensitiveHealth'), false);
  f.listeners[0].success({ data: () => ({ consents: { sensitiveHealth: true } }) });
  assert.equal(f.hook('user-A', 'sensitiveHealth'), true);
});
test('account switch immediately hides prior consent and rejects late callbacks from the old account', () => {
  const f = consentFixture(); f.hook('user-A', 'sensitiveHealth');
  f.listeners[0].success({ data: () => ({ consents: { sensitiveHealth: true } }) });
  assert.equal(f.hook('user-A', 'sensitiveHealth'), true); assert.equal(f.hook('user-B', 'sensitiveHealth'), null);
  assert.equal(f.listeners[0].unsubscribed, true);
  f.listeners[0].success({ data: () => ({ consents: { sensitiveHealth: true } }) });
  assert.equal(f.hook('user-B', 'sensitiveHealth'), null);
  f.listeners[1].failure(); assert.equal(f.hook('user-B', 'sensitiveHealth'), false);
});

test('SAYU exact-ID reader preserves the selected structured record, consent and session boundaries', () => {
  const source = read('pages/SayuPage.tsx');
  for (const [record, prefix] of [[english, 'english_diary'], [growth, 'child_measure'], [voiding, 'voiding']]) {
    let result = null;
    const env = { records: [{ ...record, id: 'same-date-sibling' }, record], user: { uid: 'fixture-user' }, recordsOwnerUid: 'fixture-user',
      healthReadConsent: true, ...views, getStructuredViewAccess, toast: { info() {} }, setStructuredRecord: value => { result = value; }, setSayuModalState() {}, setHarurawModal() {} };
    handlers(source, ['openFormatSayu'], env).openFormatSayu(record.date, prefix, 'label', record.id);
    assert.equal(result.record.id, record.id);
    result = null; env.recordsOwnerUid = 'other-session'; handlers(source, ['openFormatSayu'], env).openFormatSayu(record.date, prefix, 'label', record.id);
    assert.equal(result, null);
    if (prefix !== 'english_diary') {
      env.recordsOwnerUid = 'fixture-user'; env.healthReadConsent = false;
      handlers(source, ['openFormatSayu'], env).openFormatSayu(record.date, prefix, 'label', record.id); assert.equal(result, null);
    }
  }
});

function growthFixture() {
  const state = { id: null, status: 'idle', creates: [], links: [], routes: [], height: '45.50', weight: '6.0', head: '35', date: '2026-09-01' };
  const savingRef = { current: false }, pendingLinkRef = { current: null }, currentDraftKeyRef = { current: '' };
  const fixtureHandlers = () => {
    const env = { user: { uid: 'fixture-user' }, hasConsent: 'hasConsent' in state ? state.hasConsent : true, isCurrentSession: () => state.sessionActive !== false, savingRef, pendingLinkRef, currentDraftKeyRef,
      selectedId: 'child-existing', newName: '', birthdate: '', gender: '', measuredate: state.date, height: state.height, weight: state.weight, headcircum: state.head,
      selectedSubject: { name: '합성 대상' }, matchedSubject: { name: '합성 대상' }, findSameNameChildSubject: async () => { state.lookups = (state.lookups ?? 0) + 1; return state.lookup ?? { status: 'none' }; },
      effectiveBirthdate: '2026-01-01', effectiveGender: 'F', savedGrowthRecordId: state.id,
      db: {}, getTodayStr: () => '2026-10-06', doc: (...parts) => parts.slice(1).join('/'),
      firestoreService: { saveRecord: async (uid, data) => { state.creates.push(data); if (state.recordPending) await state.recordPending; if (state.recordFail) throw new Error('fixture'); return 'exact-growth'; } },
      setDoc: async (path, data) => { state.links.push({ path, data }); if (state.linkPending && state.links.length === state.pendingAt) await state.linkPending; if (state.links.length === state.failAt) throw new Error('fixture'); },
      serverTimestamp: () => 'fixture-time', arrayUnion: value => [value], collection() {},
      setIsSaving() {}, setSavedGrowthRecordId: value => { state.id = value; }, setGrowthSaveStatus: value => { state.status = value; },
      setHeight: value => { state.height = value; }, setWeight: value => { state.weight = value; }, setHeadcircum: value => { state.head = value; }, setMeasuredate: value => { state.date = value; },
      navigate: (path, options) => state.routes.push({ path, ...options }), toast: { warning() {}, success() {}, error: message => { (state.errors ??= []).push(message); } }, console: { error() {} },
    };
    Object.assign(env, state.envOverrides); // 테스트가 화면의 선택·입력 상태(selectedId, newName, matchedSubject 등)를 바꿔 볼 수 있게 한다
    currentDraftKeyRef.current = JSON.stringify([env.selectedId, env.newName, env.birthdate, env.gender, env.measuredate, env.height, env.weight, env.headcircum]);
    return handlers(read('pages/ChildHealthGrowthPage.tsx'), ['handleSave', 'handleViewGrowthRecord'], env);
  };
  return { state, handlers: fixtureHandlers };
}
test('growth save preserves measurement date and fields, then views the actual saved ID', async () => {
  const f = growthFixture(); await f.handlers().handleSave(); f.handlers().handleViewGrowthRecord();
  assert.equal(f.state.status, 'complete'); assert.equal(f.state.creates[0].child_measuredate, '2026-09-01');
  assert.equal(f.state.creates[0].child_height, '45.50'); assert.equal(f.state.routes[0].state.openRecordId, 'exact-growth');
});
test('partial growth linkage retries the same entry without creating another record or rewriting the linked subject', async () => {
  const f = growthFixture(); f.state.failAt = 2; await f.handlers().handleSave();
  assert.equal(f.state.status, 'partial'); assert.equal(f.state.id, 'exact-growth'); f.handlers().handleViewGrowthRecord();
  await f.handlers().handleSave(); assert.equal(f.state.status, 'complete'); assert.equal(f.state.creates.length, 1);
  assert.equal(f.state.links.length, 3); assert.ok(f.state.links[2].path.endsWith('/entries/exact-growth'));
});
test('growth linkage retry preserves newer unsaved measurements', async () => {
  const f = growthFixture(); f.state.failAt = 2; await f.handlers().handleSave(); f.state.height = '66';
  await f.handlers().handleSave(); assert.equal(f.state.height, '66'); assert.equal(f.state.creates.length, 1);
});
test('growth initial record failure has no view target or linkage writes', async () => {
  const f = growthFixture(); f.state.recordFail = true; await f.handlers().handleSave(); f.handlers().handleViewGrowthRecord();
  assert.equal(f.state.id, null); assert.equal(f.state.links.length, 0); assert.equal(f.state.routes.length, 0);
});

// 건강성장 페이지의 같은 이름 아이 중복 등록 방지 — 화면의 선택·입력 상태는 state.envOverrides 로, 저장 직전 서버 조회 결과는 state.lookup 으로 바꿔 본다.
const newChildDoc = (...parts) => (parts.length === 1 ? { id: 'new-subject-id' } : parts.slice(1).join('/'));
test('growth save: a child picked from the list is saved as before, without any lookup and without a new createdAt', async () => {
  const f = growthFixture(); await f.handlers().handleSave();
  assert.equal(f.state.lookups ?? 0, 0); assert.equal(f.state.creates[0].growthSubjectId, 'child-existing');
  assert.equal(f.state.links[0].path, 'users/fixture-user/growthSubjects/child-existing'); assert.ok(!('createdAt' in f.state.links[0].data));
});
test('growth save: a typed name already on the list continues that child without creating one or looking up again', async () => {
  const f = growthFixture();
  f.state.envOverrides = { selectedId: '', newName: ' 서윤 ', selectedSubject: undefined, matchedSubject: { id: 'subC', name: '서윤', birthdate: '2024-01-02', gender: 'F' }, birthdate: '', gender: '' };
  await f.handlers().handleSave();
  assert.equal(f.state.lookups ?? 0, 0); assert.equal(f.state.status, 'complete');
  assert.equal(f.state.creates[0].growthSubjectId, 'subC'); assert.equal(f.state.creates[0].growthSubjectName, '서윤');
  assert.equal(f.state.creates[0].growthSubjectBirthdate, '2024-01-02'); assert.equal(f.state.creates[0].growthSubjectGender, 'F');
  assert.equal(f.state.links[0].path, 'users/fixture-user/growthSubjects/subC'); assert.ok(!('createdAt' in f.state.links[0].data));
});
test('growth save: a new name the server confirms is unregistered creates a new child with createdAt', async () => {
  const f = growthFixture(); f.state.lookup = { status: 'none' };
  f.state.envOverrides = { selectedId: '', newName: '새아이', selectedSubject: undefined, matchedSubject: undefined, birthdate: '2025-01-01', gender: 'M', doc: newChildDoc };
  await f.handlers().handleSave();
  assert.equal(f.state.lookups, 1); assert.equal(f.state.creates[0].growthSubjectId, 'new-subject-id'); assert.equal(f.state.creates[0].growthSubjectBirthdate, '2025-01-01');
  assert.equal(f.state.links[0].path, 'users/fixture-user/growthSubjects/new-subject-id'); assert.equal(f.state.links[0].data.createdAt, 'fixture-time');
});
test('growth save: a typed name missing from a stale list is found by the pre-save lookup and continues that child', async () => {
  const f = growthFixture(); f.state.lookup = { status: 'found', subject: { id: 'subD', name: '민아', birthdate: '2025-03-03', gender: 'F' } };
  f.state.envOverrides = { selectedId: '', newName: '민아', selectedSubject: undefined, matchedSubject: undefined, birthdate: '', gender: '', doc: newChildDoc };
  await f.handlers().handleSave();
  assert.equal(f.state.lookups, 1); assert.equal(f.state.creates[0].growthSubjectId, 'subD'); assert.equal(f.state.creates[0].growthSubjectBirthdate, '2025-03-03');
  assert.equal(f.state.links[0].path, 'users/fixture-user/growthSubjects/subD'); assert.ok(!('createdAt' in f.state.links[0].data));
});
test('growth save: a failed pre-save lookup stops saving so no duplicate child is created, and a retry continues the existing child', async () => {
  const f = growthFixture(); f.state.lookup = { status: 'error' };
  f.state.envOverrides = { selectedId: '', newName: '해든', selectedSubject: undefined, matchedSubject: undefined, doc: newChildDoc };
  await f.handlers().handleSave();
  assert.equal(f.state.creates.length, 0); assert.equal(f.state.links.length, 0); assert.equal(f.state.status, 'idle');
  assert.equal(f.state.errors.length, 1); assert.match(f.state.errors[0], /확인하지 못했어요/);
  f.state.lookup = { status: 'found', subject: { id: 'subE', name: '해든', birthdate: '2025-05-05', gender: 'M' } };
  await f.handlers().handleSave();
  assert.equal(f.state.creates.length, 1); assert.equal(f.state.creates[0].growthSubjectId, 'subE'); assert.equal(f.state.status, 'complete');
});
test('growth save: a typed birthdate or gender that disagrees with the registered child stops saving without overwriting it', async () => {
  const f = growthFixture(); f.state.lookup = { status: 'found', subject: { id: 'subF', name: '지안', birthdate: '2024-06-06', gender: 'M' } };
  f.state.envOverrides = { selectedId: '', newName: '지안', selectedSubject: undefined, matchedSubject: undefined, birthdate: '2023-01-01', gender: 'F' };
  await f.handlers().handleSave();
  assert.equal(f.state.creates.length, 0); assert.equal(f.state.links.length, 0); assert.match(f.state.errors[0], /생년월일·성별과 입력한 값이 달라요/);
});
test('growth save: a disagreeing birthdate alone, or a disagreeing gender alone, also stops saving', async () => {
  for (const typed of [{ birthdate: '2023-01-01', gender: '' }, { birthdate: '', gender: 'F' }]) {
    const f = growthFixture(); f.state.lookup = { status: 'found', subject: { id: 'subF', name: '지안', birthdate: '2024-06-06', gender: 'M' } };
    f.state.envOverrides = { selectedId: '', newName: '지안', selectedSubject: undefined, matchedSubject: undefined, ...typed };
    await f.handlers().handleSave();
    assert.equal(f.state.creates.length, 0); assert.equal(f.state.links.length, 0); assert.match(f.state.errors[0], /달라요/);
  }
});
test('growth save: a found child keeps its registered name, birthdate and gender, and only blanks are filled from the typed values', async () => {
  const same = growthFixture(); same.state.lookup = { status: 'found', subject: { id: 'subJ', name: 'Jun', birthdate: '2025-02-02', gender: 'M' } };
  same.state.envOverrides = { selectedId: '', newName: 'jUN', selectedSubject: undefined, matchedSubject: undefined, birthdate: '2025-02-02', gender: 'M' };
  await same.handlers().handleSave();
  assert.equal(same.state.creates[0].growthSubjectName, 'Jun'); assert.equal(same.state.links[0].data.name, 'Jun');
  const blankTyped = growthFixture(); blankTyped.state.lookup = { status: 'found', subject: { id: 'subJ', name: 'Jun', birthdate: '2025-02-02', gender: 'M' } };
  blankTyped.state.envOverrides = { selectedId: '', newName: 'Jun', selectedSubject: undefined, matchedSubject: undefined, birthdate: '', gender: '' };
  await blankTyped.handlers().handleSave();
  assert.equal(blankTyped.state.creates[0].growthSubjectBirthdate, '2025-02-02'); assert.equal(blankTyped.state.creates[0].growthSubjectGender, 'M');
  const blankRegistered = growthFixture(); blankRegistered.state.lookup = { status: 'found', subject: { id: 'subK', name: '다온', birthdate: '', gender: undefined } };
  blankRegistered.state.envOverrides = { selectedId: '', newName: '다온', selectedSubject: undefined, matchedSubject: undefined, birthdate: '2025-04-04', gender: 'F' };
  await blankRegistered.handlers().handleSave();
  assert.equal(blankRegistered.state.creates[0].growthSubjectId, 'subK'); assert.equal(blankRegistered.state.creates[0].growthSubjectBirthdate, '2025-04-04');
  assert.equal(blankRegistered.state.links[0].data.birthdate, '2025-04-04'); assert.equal(blankRegistered.state.links[0].data.gender, 'F'); assert.ok(!('createdAt' in blankRegistered.state.links[0].data));
});
test('growth save: a lookup that finishes after the account left writes nothing', async () => {
  const f = growthFixture(); f.state.lookup = { status: 'found', subject: { id: 'subG', name: '도윤', birthdate: '2025-07-07', gender: 'M' } };
  f.state.envOverrides = { selectedId: '', newName: '도윤', selectedSubject: undefined, matchedSubject: undefined, isCurrentSession: () => f.state.lookups === undefined };
  await f.handlers().handleSave();
  assert.equal(f.state.lookups, 1); assert.equal(f.state.creates.length, 0); assert.equal(f.state.links.length, 0);
});

// 저장 직전 "같은 이름의 아이" Firestore 조회 어댑터 — 조회 대상 경로·조건과 실패 처리를 지킨다(판정은 utils/growthSubject.ts 의 resolveSameNameChild).
function lookupAdapter(getDocsImpl) {
  const queries = [];
  const mod = moduleFrom(read('services/growthSubjectLookup.ts'), {
    'firebase/firestore': {
      collection: (db, ...path) => ({ path: path.join('/') }),
      where: (...args) => ({ where: args }),
      query: (source, ...constraints) => ({ source, constraints }),
      getDocs: async query => { queries.push(query); return getDocsImpl(query); },
    },
    '../../firebase': { db: {} },
    '../utils/growthSubject': growthSubjectUtils,
  });
  return { find: mod.findSameNameChildSubject, queries };
}
test('same-name child lookup adapter: queries only this user\'s child subjects and hands the snapshot to the decision', async () => {
  const snap = { metadata: { fromCache: false }, docs: [{ id: 'subC', data: () => ({ name: '서윤', birthdate: '2024-01-02', gender: 'F' }) }] };
  const f = lookupAdapter(() => snap), result = await f.find('fixture-user', '서윤');
  assert.equal(result.status, 'found'); assert.equal(result.subject.id, 'subC');
  assert.equal(f.queries.length, 1); assert.equal(f.queries[0].source.path, 'users/fixture-user/growthSubjects');
  assert.deepEqual(f.queries[0].constraints, [{ where: ['subjectType', '==', 'child'] }]);
});
test('same-name child lookup adapter: a thrown query and a cache-only snapshot are both "could not confirm", never "none"', async () => {
  const warn = console.warn; console.warn = () => {};
  try {
    assert.deepEqual(await lookupAdapter(() => { throw new Error('unavailable'); }).find('fixture-user', '해든'), { status: 'error' });
    assert.deepEqual(await lookupAdapter(() => ({ metadata: { fromCache: true }, docs: [] })).find('fixture-user', '해든'), { status: 'error' });
  } finally { console.warn = warn; }
  assert.deepEqual(await lookupAdapter(() => ({ metadata: { fromCache: false }, docs: [] })).find('fixture-user', '해든'), { status: 'none' });
});

function englishFixture() {
  const state = { id: null, failed: false, step: null, selected: null, routes: [] };
  const fixtureHandlers = () => handlers(read('pages/DiaryLearnPage.tsx'), ['handleDirectTranslate', 'handleViewEnglishRecord'], {
    koreanInput: '합성 원문', user: { uid: 'fixture-user' }, isCurrentSession: () => state.sessionActive !== false, fns: {}, directSavedRecordId: state.id, directTranslating: false,
    httpsCallable: () => async () => { if (state.translationPending) await state.translationPending; return { data: { sentences: ['Synthetic original.'] } }; },
    firestoreService: { saveRecord: async () => { state.writes = (state.writes ?? 0) + 1; if (state.savePending) await state.savePending; if (state.failWrite) throw new Error('fixture'); return 'actual-english-id'; } },
    setDirectTranslating() {}, setDirectSavedRecordId: value => { state.id = value; }, setDirectSaveFailed: value => { state.failed = value; },
    setSelected: value => { state.selected = value; }, setTranslatedSentences() {}, setActiveTab() {}, setStep: value => { state.step = value; },
    navigate: (path, options) => state.routes.push({ path, ...options }), console: { error() {} },
  });
  return { state, handlers: fixtureHandlers };
}
test('English save success keeps learning on screen and explicit view uses the returned ID', async () => {
  const f = englishFixture(); await f.handlers().handleDirectTranslate();
  assert.equal(f.state.step, 'learn'); assert.equal(f.state.routes.length, 0); assert.equal(f.state.failed, false);
  f.handlers().handleViewEnglishRecord(); assert.equal(f.state.routes[0].state.openRecordId, 'actual-english-id');
});
test('English save failure still enters learning, clears an old saved target and offers no invalid view', async () => {
  const f = englishFixture(); f.state.id = 'old-target'; f.state.failWrite = true; await f.handlers().handleDirectTranslate();
  f.handlers().handleViewEnglishRecord(); assert.equal(f.state.failed, true); assert.equal(f.state.id, null);
  assert.equal(f.state.step, 'learn'); assert.equal(f.state.selected.content, '합성 원문'); assert.equal(f.state.routes.length, 0);
});

const deferredSession = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
test('health pending and nonboolean consent cannot start growth persistence', async () => {
  for (const hasConsent of [null, false, 'true']) {
    const f = growthFixture(); f.state.hasConsent = hasConsent; await f.handlers().handleSave();
    assert.equal(f.state.creates.length, 0); assert.equal(f.state.links.length, 0);
  }
});
test('account departure during growth record save prevents subsequent subject/entry writes and view publication', async () => {
  const f = growthFixture(), pending = deferredSession(); f.state.recordPending = pending.promise;
  const saving = f.handlers().handleSave(); f.state.sessionActive = false; pending.resolve(); await saving;
  assert.equal(f.state.creates.length, 1); assert.equal(f.state.links.length, 0); assert.equal(f.state.id, null);
  f.handlers().handleViewGrowthRecord(); assert.equal(f.state.routes.length, 0);
});
test('account departure during growth subject linkage stops the entry write', async () => {
  const f = growthFixture(), pending = deferredSession(); f.state.linkPending = pending.promise; f.state.pendingAt = 1;
  const saving = f.handlers().handleSave(); await new Promise(done => setImmediate(done));
  f.state.sessionActive = false; pending.resolve(); await saving;
  assert.equal(f.state.links.length, 1); assert.notEqual(f.state.status, 'complete');
  f.handlers().handleViewGrowthRecord(); assert.equal(f.state.routes.length, 0);
});
test('late translation from a departed account cannot start an English record save or enter learning', async () => {
  const f = englishFixture(), pending = deferredSession(); f.state.translationPending = pending.promise;
  const translating = f.handlers().handleDirectTranslate(); f.state.sessionActive = false; pending.resolve(); await translating;
  assert.equal(f.state.writes ?? 0, 0); assert.equal(f.state.selected, null); assert.equal(f.state.step, null);
});
test('late English save from a departed account cannot publish a view target', async () => {
  const f = englishFixture(), pending = deferredSession(); f.state.savePending = pending.promise;
  const translating = f.handlers().handleDirectTranslate(); await new Promise(done => setImmediate(done));
  f.state.sessionActive = false; pending.resolve(); await translating;
  assert.equal(f.state.writes, 1); assert.equal(f.state.id, null); assert.equal(f.state.step, null);
  f.handlers().handleViewEnglishRecord(); assert.equal(f.state.routes.length, 0);
});

test('departed account cannot start a selected-diary translation or cache persistence', async () => {
  let calls = 0, writes = 0;
  const env = { selected: { id: 'old-id', content: '합성 원문' }, user: { uid: 'fixture-user' }, isCurrentSession: () => false,
    setTranslating() {}, fns: {}, httpsCallable: () => async () => { calls++; }, firestoreService: { updateRecord: async () => { writes++; } } };
  await handlers(read('pages/DiaryLearnPage.tsx'), ['handleTranslate'], env).handleTranslate();
  assert.equal(calls, 0); assert.equal(writes, 0);
});
test('late selected-diary translation cannot start cache persistence after account departure', async () => {
  const pending = deferredSession(); let active = true, writes = 0;
  const env = { selected: { id: 'old-id', content: '합성 원문' }, user: { uid: 'fixture-user' }, isCurrentSession: () => active,
    setTranslating() {}, fns: {}, httpsCallable: () => async () => { await pending.promise; return { data: { sentences: ['Synthetic.'] } }; },
    firestoreService: { updateRecord: async () => { writes++; } }, console: { error() {} } };
  const translating = handlers(read('pages/DiaryLearnPage.tsx'), ['handleTranslate'], env).handleTranslate();
  active = false; pending.resolve(); await translating; assert.equal(writes, 0);
});

test('actual page session guards reject changed Firebase owners before React rerenders and after cleanup', () => {
  for (const [file, health] of [['DiaryLearnPage.tsx', false], ['ChildHealthGrowthPage.tsx', true], ['SayuHealthVoidingPage.tsx', true]]) {
    const source = read('pages/' + file);
    const start = source.indexOf('  const activeRef = useRef(true);');
    const guard = source.slice(start).match(/[\s\S]*?  const isCurrentSession = .*?;/)[0];
    let cleanup; const auth = { currentUser: { uid: 'user-A' } };
    const env = { user: { uid: 'user-A' }, auth, hasConsent: true,
      useRef: value => ({ current: value }), useEffect: effect => { cleanup = effect(); } };
    const create = consent => new Function(...Object.keys(env), guard + '\nreturn isCurrentSession;')(...Object.values({ ...env, hasConsent: consent }));
    const current = create(true); assert.equal(current(), true);
    auth.currentUser = { uid: 'user-B' }; assert.equal(current(), false);
    auth.currentUser = { uid: 'user-A' }; cleanup(); assert.equal(current(), false);
    if (health) for (const value of [null, false, 'true']) assert.equal(create(value)(), false);
  }
});
