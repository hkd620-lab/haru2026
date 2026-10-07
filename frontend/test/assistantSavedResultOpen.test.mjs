import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync, transformSync } from 'esbuild';

// Execute the real handlers and SAYU route reader against memory-only services.
// No Firebase initialization, Storage, AI, login, or production record is used.
const read = path => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8');
const extract = (source, name) => {
  const match = source.match(new RegExp(`  const ${name} = [\\s\\S]*?\\n  };`));
  assert.ok(match, `actual handler exists: ${name}`);
  return match[0];
};
const compile = (source, names) => {
  const code = transformSync(names.map(name => extract(source, name)).join('\n'), { loader: 'ts', target: 'es2022' }).code;
  return env => new Function(...Object.keys(env), `${code}\nreturn { ${names.join(', ')} };`)(...Object.values(env));
};
const clone = value => structuredClone(value);
const noop = () => {};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const toast = { success: noop, error: noop, warning: noop, info: noop };
const silentConsole = { error: noop };
const novel = compile(read('pages/NovelStoryPage.tsx'), ['buildStoryRecord', 'handleSaveToMyRecord', 'handleViewSavedRecord', 'handlePublishTogether']);
function novelFixture() {
  const state = { id: null, writes: [], publishes: [], routes: [], saving: false, publishing: false, profile: { nickname: 'fixture' } };
  const busy = { current: false };
  const handlers = () => novel({
    user: { uid: 'fixture-user' }, savedRecordId: state.id, recordWriteRef: busy,
    story: '합성 미래 이야기', recordDate: '2026-09-20', shareTitle: '합성 제목 — HARU미래전망',
    protagonistName: '합성 인물', timeOption: '10년 후', fromRecord: true, recordTitle: '원본 제목', recordFormat: '일기',
    setSavedRecordId: id => { state.id = id; }, setSavingToRecord: value => { state.saving = value; },
    setPublishingShared: value => { state.publishing = value; },
    firestoreService: {
      saveRecord: async (uid, data) => { state.writes.push(clone(data)); return state.save ? state.save() : '2026-09-20_exact-story'; },
      getUserProfile: async () => state.getProfile ? state.getProfile() : state.profile,
      publishRecordToShared: async (uid, id) => { state.publishes.push(id); if (state.publish) await state.publish(); },
    },
    navigate: (path, options) => state.routes.push({ path, ...options }),
    window: { confirm: () => true }, toast: Object.assign(() => {}, toast), console: silentConsole,
  });
  return { state, busy, handlers };
}

test('future story saves once, views the exact ID, and preserves source/content', async () => {
  const f = novelFixture();
  await f.handlers().handleSaveToMyRecord();
  f.handlers().handleViewSavedRecord();
  await f.handlers().handleSaveToMyRecord();
  assert.equal(f.state.writes.length, 1);
  assert.equal(f.state.publishes.length, 0);
  assert.equal(f.state.writes[0].essay_sayu, '합성 미래 이야기');
  assert.equal(f.state.writes[0].future_story_source.recordDate, '2026-09-20');
  assert.deepEqual(f.state.routes, [{ path: '/sayu', state: { filterFormat: '에세이', openRecordId: '2026-09-20_exact-story' } }]);
});

test('future story synchronous lock blocks repeated save, publish and view during saving', async () => {
  const f = novelFixture(); const pending = deferred(); f.state.save = () => pending.promise;
  const first = f.handlers().handleSaveToMyRecord();
  await f.handlers().handleSaveToMyRecord();
  await f.handlers().handlePublishTogether();
  f.handlers().handleViewSavedRecord();
  assert.equal(f.state.writes.length, 1); assert.equal(f.state.routes.length, 0);
  pending.resolve('exact-id'); await first;
  assert.equal(f.busy.current, false); assert.equal(f.state.id, 'exact-id');
});

test('future story failed save has no view target and can retry without changing the story', async () => {
  const f = novelFixture(); f.state.save = () => { throw new Error('fixture failure'); };
  await f.handlers().handleSaveToMyRecord(); f.handlers().handleViewSavedRecord();
  assert.equal(f.state.id, null); assert.equal(f.state.routes.length, 0); assert.equal(f.busy.current, false);
  delete f.state.save; await f.handlers().handleSaveToMyRecord();
  assert.deepEqual(f.state.writes[1], f.state.writes[0]);
});

test('future story publishing locks saving and viewing, and reuses an already saved ID', async () => {
  const f = novelFixture(); f.state.id = 'existing-story'; const pending = deferred(); f.state.publish = () => pending.promise;
  const first = f.handlers().handlePublishTogether();
  await new Promise(resolve => setImmediate(resolve));
  await f.handlers().handleSaveToMyRecord(); await f.handlers().handlePublishTogether(); f.handlers().handleViewSavedRecord();
  assert.deepEqual(f.state.publishes, ['existing-story']); assert.equal(f.state.writes.length, 0); assert.equal(f.state.routes.length, 0);
  pending.resolve(); await first;
  assert.equal(f.state.routes[0].path, '/sayu-together'); assert.equal(f.busy.current, false);
});

test('future story failed publication keeps the newly saved ID usable without resaving', async () => {
  const f = novelFixture(); f.state.publish = () => { throw new Error('fixture failure'); };
  await f.handlers().handlePublishTogether(); f.handlers().handleViewSavedRecord();
  assert.equal(f.state.writes.length, 1); assert.equal(f.state.routes[0].state.openRecordId, f.state.id);
});

test('future story missing nickname releases the publication lock without saving', async () => {
  const f = novelFixture(); f.state.profile = { nickname: '' };
  await f.handlers().handlePublishTogether();
  assert.equal(f.state.writes.length, 0); assert.equal(f.state.publishes.length, 0); assert.equal(f.busy.current, false);
});

const law = compile(read('pages/RecordPage.tsx'), ['closeToOrigin', 'handleLawSaveDateChange', 'handleSaveLawResult']);
function lawFixture() {
  const original = { formats: ['일기'], content: '원본 합성 일기', weather: '맑음', mood: '평온', temperature: '21' };
  const state = { writes: [], reads: [], routes: [], saved: false, date: '2026-09-20', error: null, saving: false };
  const busy = { current: false }, mounted = { current: true };
  const handlers = () => law({
    user: { uid: 'fixture-user' }, lawSaved: state.saved, lawSaveRef: busy, lawSaveMountedRef: mounted,
    lawSaveDate: state.date, uploadingLawFiles: false, lawLoading: false, isSavingLaw: state.saving,
    lawResults: [{ lawName: '합성 법령', articleStr: '제1조', title: '제목', content: '합성 조문' }],
    activeLawQuery: '합성 질문', lawSummary: '합성 요약', activeLawAttachments: [{ name: 'fixture.pdf', path: 'fixture' }],
    weather: '흐림', temperature: '19', mood: '보통', db: {},
    doc: (...parts) => { const path = parts.slice(1).join('/'); state.reads.push(path); return path; },
    getDoc: async () => { if (state.read) await state.read(); return { exists: () => true, data: () => clone(original) }; },
    firestoreService: { saveRecord: async (uid, data) => { state.writes.push(clone(data)); return state.save ? state.save() : data.id; } },
    setLawSaveError: value => { state.error = value; }, setIsSavingLaw: value => { state.saving = value; },
    setLawSaved: value => { state.saved = value; }, setLawSaveDate: value => { state.date = value; },
    navigate: (path, options) => state.routes.push({ path, ...options }),
    fromPath: '/fixture-origin', getOrigin: () => null, window: { history: { length: 2 } }, toast, console: silentConsole,
  });
  return { state, original, busy, mounted, handlers };
}

test('LAW opens the actual returned ID on the selected past date and keeps original fields/attachments', async () => {
  const f = lawFixture(); f.state.save = () => '2026-09-20_returned';
  await f.handlers().handleSaveLawResult();
  assert.deepEqual(f.state.reads, ['users/fixture-user/records/2026-09-20']);
  assert.equal(f.state.writes[0].id, '2026-09-20');
  for (const key of ['content', 'weather', 'mood', 'temperature']) assert.equal(f.state.writes[0][key], f.original[key]);
  assert.deepEqual(f.state.writes[0].formats, ['일기', 'HARUraw']);
  assert.deepEqual(f.state.writes[0].haruraw_attachments, [{ name: 'fixture.pdf', path: 'fixture' }]);
  assert.deepEqual(f.state.routes, [{ path: '/sayu', state: { filterFormat: '하루LAW', tab: 'assistants', openRecordId: '2026-09-20_returned' } }]);
});

test('LAW locks repeated save, date changes and close while the initial read is pending', async () => {
  const f = lawFixture(); const pending = deferred(); f.state.read = () => pending.promise;
  const first = f.handlers().handleSaveLawResult();
  await f.handlers().handleSaveLawResult();
  f.handlers().handleLawSaveDateChange({ target: { value: '2026-10-06' } }); f.handlers().closeToOrigin();
  assert.equal(f.state.reads.length, 1); assert.equal(f.state.date, '2026-09-20'); assert.equal(f.state.routes.length, 0);
  pending.resolve(); await first; await f.handlers().handleSaveLawResult();
  assert.equal(f.state.writes.length, 1); assert.equal(f.busy.current, false);
});

test('LAW initial read failure does not save or navigate and preserves a retryable error', async () => {
  const f = lawFixture(); f.state.read = () => { throw { code: 'unavailable' }; };
  await f.handlers().handleSaveLawResult();
  assert.equal(f.state.writes.length, 0); assert.equal(f.state.routes.length, 0);
  assert.equal(f.state.error.retryable, true); assert.equal(f.busy.current, false);
});

test('LAW write failure stays on the result, releases its lock and allows retry', async () => {
  const f = lawFixture(); f.state.save = () => { throw { code: 'permission-denied' }; };
  await f.handlers().handleSaveLawResult();
  assert.equal(f.state.routes.length, 0); assert.equal(f.state.saved, false); assert.equal(f.busy.current, false);
  delete f.state.save; await f.handlers().handleSaveLawResult();
  assert.equal(f.state.routes.length, 1); assert.deepEqual(f.state.writes[1], f.state.writes[0]);
});

test('LAW invalid date never reads, writes or navigates', async () => {
  const f = lawFixture(); f.state.date = '2026-02-30'; await f.handlers().handleSaveLawResult();
  assert.equal(f.state.reads.length, 0); assert.equal(f.state.writes.length, 0); assert.equal(f.state.routes.length, 0);
});

test('LAW does not redirect after the result page was unmounted during saving', async () => {
  const f = lawFixture(); const pending = deferred(); f.state.save = () => pending.promise;
  const first = f.handlers().handleSaveLawResult(); await new Promise(resolve => setImmediate(resolve));
  f.mounted.current = false; pending.resolve('exact-id'); await first;
  assert.equal(f.state.writes.length, 1); assert.equal(f.state.routes.length, 0);
});

const timeline = compile(read('components/TimelineCollageModal.tsx'), ['handleGrowthSavingChange', 'handleClose', 'handleViewSavedTimeline']);
function timelineFixture() {
  const state = { id: null, routes: [], closed: 0, saving: false };
  const busy = { current: false };
  const handlers = () => timeline({
    savedTimelineId: state.id, growthSavingRef: busy, generatingRef: { current: false }, step: 'select',
    setGrowthSaving: value => { state.saving = value; }, setSavedTimelineId: value => { state.id = value; },
    setStep: noop, setSelected: noop, setTitle: noop, setResultUrl: noop, setSearchText: noop,
    setDateFrom: noop, setDateTo: noop, setGrowthCreatorOpen: noop,
    onClose: () => { state.closed++; }, navigate: (path, options) => state.routes.push({ path, ...options }), toast,
  });
  return { state, busy, handlers };
}

test('timeline viewing closes once and uses the saved ID in the assistants tab', () => {
  const f = timelineFixture(); f.state.id = '2026-09-20_timeline-second';
  f.handlers().handleViewSavedTimeline(); f.handlers().handleViewSavedTimeline();
  assert.equal(f.state.closed, 1); assert.equal(f.state.id, null);
  assert.deepEqual(f.state.routes, [{ path: '/sayu', state: { filterFormat: 'HARU타임라인', tab: 'assistants', openRecordId: '2026-09-20_timeline-second' } }]);
});

test('timeline blocks close/view while saving and clears the saved target on close', () => {
  const f = timelineFixture(); f.state.id = 'old'; f.handlers().handleGrowthSavingChange(true);
  f.handlers().handleClose(); f.handlers().handleViewSavedTimeline();
  assert.equal(f.state.closed, 0); assert.equal(f.state.routes.length, 0);
  f.handlers().handleGrowthSavingChange(false); f.handlers().handleClose(); f.handlers().handleViewSavedTimeline();
  assert.equal(f.state.id, null); assert.equal(f.state.closed, 1); assert.equal(f.state.routes.length, 0);
});

const growth = compile(read('components/GrowthTimelineCreator.tsx'), ['finalizeTimeline']);
function growthFixture() {
  const state = { uploads: 0, writes: [], done: [], savingChanges: [], cleared: false };
  const busy = { current: false };
  const items = [{ id: 'fixture-photo', file: {}, originalName: 'fixture.jpg', previewUrl: 'blob:fixture', takenDate: '2026-09-20', memo: '합성 사진 메모' }];
  const handlers = () => growth({
    savingRef: busy, sortedItems: items, items, title: '합성 타임라인', uid: 'fixture-user', storage: {},
    setIsSaving: noop, onSavingChange: value => state.savingChanges.push(value),
    sanitizeFileName: value => value, removeFileExtension: value => value.replace(/\.jpg$/, ''),
    ref: (store, path) => path, compressImage: async value => value, TIMELINE_IMAGE_MAX_WIDTH: 1000, TIMELINE_IMAGE_QUALITY: 0.8,
    uploadBytes: async () => { state.uploads++; }, getDownloadURL: async () => 'https://fixture.invalid/photo.jpg',
    serializeTimelineRecordItem: (item, url, order) => ({ takenDate: item.takenDate, memo: item.memo, url, order }),
    buildTimelineSummary: value => value.map(item => item.memo).join('\n'),
    createTimelineTitle: async title => title, buildFallbackTimelineTitle: value => value, todayKey: () => '2026-10-06',
    firestoreService: { saveRecord: async (uid, data) => { state.writes.push(clone(data)); return state.save ? state.save() : '2026-10-06_exact-growth'; } },
    URL: { revokeObjectURL: noop }, setItems: () => { state.cleared = true; }, setTitle: noop, setIsDocumentOpen: noop,
    onDone: id => state.done.push(id), toast, console: silentConsole,
  });
  return { state, busy, handlers };
}

test('growth timeline forwards the service ID and locks repeated finalize synchronously', async () => {
  const f = growthFixture(); const pending = deferred(); f.state.save = () => pending.promise;
  const first = f.handlers().finalizeTimeline(); await f.handlers().finalizeTimeline();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.state.uploads, 1); assert.equal(f.state.writes.length, 1); assert.deepEqual(f.state.done, []);
  pending.resolve('exact-growth'); await first;
  assert.deepEqual(f.state.done, ['exact-growth']); assert.deepEqual(f.state.savingChanges, [true, false]);
  assert.equal(f.state.writes[0].timelineItems[0].memo, '합성 사진 메모'); assert.equal(f.busy.current, false);
});

test('growth timeline failed persistence keeps its draft and never supplies a view ID', async () => {
  const f = growthFixture(); f.state.save = () => { throw new Error('fixture failure'); };
  await f.handlers().finalizeTimeline();
  assert.deepEqual(f.state.done, []); assert.equal(f.state.cleared, false); assert.equal(f.busy.current, false);
  assert.deepEqual(f.state.savingChanges, [true, false]);
});

const sayu = read('pages/SayuPage.tsx');
const routeStart = sayu.indexOf('    const filterFormat = typeof routeState?.filterFormat');
const routeEnd = sayu.indexOf('\n  // eslint-disable-next-line react-hooks/exhaustive-deps', routeStart);
assert.ok(routeStart > 0 && routeEnd > routeStart);
const prefixSource = sayu.match(/  const ALL_FORMAT_PREFIXES:[\s\S]*?\n  };/)[0];
// P2c: 성장타임라인 판정·상세 열기 상태는 SAYU 어댑터로 옮겨졌다. 실제 어댑터를 묶어 실행 환경에 넘긴다.
const sayuAdapterBundle = buildSync({ entryPoints: [new URL('../src/app/assistants/sayuAdapters.ts', import.meta.url).pathname], bundle: true, format: 'cjs', platform: 'node', write: false }).outputFiles[0].text;
const sayuAdapter = (() => { const module = { exports: {} }; new Function('module', 'exports', sayuAdapterBundle)(module, module.exports); return module.exports; })();
const routeCode = transformSync(`${prefixSource}\n${extract(sayu, 'openFormatSayu')}\nconst applyRoute = () => {\n${sayu.slice(routeStart, routeEnd)}\n};`, { loader: 'ts', target: 'es2022' }).code;
function readSavedRoute(routeState, records) {
  const state = { detail: null, tab: null };
  const env = {
    routeState, records, user: { uid: 'fixture-user' }, SNS_GALMURI_LABEL: 'SNS 갈무리', GROWTH_TIMELINE_SAYU_LABEL: 'HARU타임라인',
    setSayuTab: value => { state.tab = value; }, setViewMode: noop, setSayuSearchInput: noop, setDebouncedSayuSearch: noop,
    setSelectedSayuLabels: noop, setExpandedSayuGroups: noop, setCurrentMonth: noop, setSayuScope: noop, setSelectedDate: noop,
    setSelectedDateFormats: noop, setHaruLawShareState: noop, navigate: noop,
    setHarurawModal: value => { state.detail = value; }, setSayuModalState: value => { state.detail = value; },
    normalizeTimelineItems: items => items ?? [], META_SUFFIXES: ['_title'],
    isGrowthTimelineRecord: sayuAdapter.isGrowthTimelineRecord, GROWTH_TIMELINE_FORMAT_KEY: sayuAdapter.GROWTH_TIMELINE_FORMAT_KEY,
    growthTimelineSelectedFormat: sayuAdapter.growthTimelineSelectedFormat, buildGrowthTimelineSayuModalState: sayuAdapter.buildGrowthTimelineSayuModalState,
    structuredViewNeedsHealthConsent: sayuAdapter.structuredViewNeedsHealthConsent,
    // C has its own structured-reader tests; these routes remain generic formats.
    isStructuredAssistantPrefix: () => false, setStructuredRecord: noop,
  };
  new Function(...Object.keys(env), `${routeCode}\napplyRoute();`)(...Object.values(env));
  return state;
}

test('SAYU opens the exact future essay among same-date siblings', () => {
  const records = ['first', 'second'].map(id => ({ id, date: '2026-09-20', essay_sayu: `${id} content`, essay_title: id }));
  const result = readSavedRoute({ filterFormat: '에세이', openRecordId: 'second' }, records);
  assert.equal(result.detail.firestoreId, 'second'); assert.equal(result.detail.content, 'second content'); assert.equal(result.tab, 'records');
});

test('SAYU opens the exact LAW document among same-date siblings', () => {
  const records = ['first', 'second'].map(id => ({ id, date: '2026-09-20', haruraw_summary: `${id} summary`, haruraw_attachments: [{ id }] }));
  const result = readSavedRoute({ filterFormat: '하루LAW', tab: 'assistants', openRecordId: 'second' }, records);
  assert.equal(result.detail.recordId, 'second'); assert.equal(result.detail.summary, 'second summary'); assert.equal(result.tab, 'assistants');
});

test('SAYU opens the exact growth timeline with its existing display-label route', () => {
  const records = ['first', 'second'].map(id => ({ id, date: '2026-09-20', format: '성장타임라인', title: id, timelineItems: [{ url: `https://fixture.invalid/${id}` }] }));
  const result = readSavedRoute({ filterFormat: 'HARU타임라인', tab: 'assistants', openRecordId: 'second' }, records);
  assert.equal(result.detail.firestoreId, 'second'); assert.equal(result.detail.formatKey, 'growthTimeline'); assert.equal(result.tab, 'assistants');
  assert.equal(result.detail.timelineItems[0].url, 'https://fixture.invalid/second');
});
