import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { applyPlantDetectiveEdit, fingerprintPlantEntry } from '../src/app/utils/plantDetectiveEdit.ts';

// Execute the actual page handlers with in-memory dependencies. No Firebase,
// Storage, AI, browser login, or production data is used by this harness.
const source = readFileSync(new URL('../src/app/pages/SayuPage.tsx', import.meta.url), 'utf8');
const names = ['handleEditPlantDetectiveRecord', 'handleAddPlantDetectivePhoto', 'handleDeletePlantDetectivePhoto'];
const handlersSource = names.map(name => {
  const match = source.match(new RegExp(`  const ${name} = [\\s\\S]*?\\n  };`));
  assert.ok(match, `page handler exists: ${name}`);
  return match[0];
}).join('\n');
const handlersJs = transformSync(handlersSource, { loader: 'ts', target: 'es2022' }).code;
const clone = value => structuredClone(value);
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const original = {
  title: '원래 식물', memo: '원래 메모', updatedAt: 1,
  imageUrl: 'https://fixture.invalid/one',
  imageUrls: ['https://fixture.invalid/one', 'https://fixture.invalid/two'],
  providerResults: { original: true }, editHistory: [],
};
const sibling = { title: '다른 항목', memo: '유지' };
const draft = { displayName: '원래 식물', userConfirmedName: '', englishName: '', scientificName: '', observation: '', aiDifference: '', memo: '수정 메모', locationLabel: '' };

function fixture() {
  const state = {
    stored: [clone(original), clone(sibling)],
    records: [{ id: 'fixture-record', date: '2026-10-06', plantDetective: [clone(original), clone(sibling)] }],
    detail: { type: 'detective', recordId: 'fixture-record', entryIdx: 0, editSnapshot: clone(original), imageUrl: original.imageUrl, imageUrls: [...original.imageUrls] },
    busyRef: { current: false }, busy: false, writes: 0, uploads: 0, removals: 0, navigations: [],
  };
  const handlers = () => {
    const env = {
      user: { uid: 'fixture-user' }, db: {}, records: state.records,
      plantReadOnlyDetail: state.detail, plantDetectivePhotoBusyRef: state.busyRef,
      setPlantDetectivePhotoBusy: value => { state.busy = value; },
      setRecords: updater => { state.records = updater(state.records); },
      setPlantReadOnlyDetail: updater => { state.detail = updater(state.detail); },
      fingerprintPlantEntry: entry => state.hash ? state.hash(entry) : fingerprintPlantEntry(entry),
      navigate: (path, options) => { state.navigations.push({ path, ...options }); },
      doc: (...args) => args,
      updateDoc: async (_ref, payload) => {
        const write = ++state.writes;
        if (state.beforeWrite) await state.beforeWrite(write);
        state.stored = clone(payload.plantDetective);
      },
      uploadSayuPlantDetectivePhoto: async () => {
        state.uploads++;
        return state.upload ? state.upload() : { url: 'https://fixture.invalid/three' };
      },
      reanalyzePlantDetectivePhotos: async () => state.reanalysis ? state.reanalysis() : { imageCount: 3, result: {} },
      buildPlantDetectiveReanalysisFields: () => ({ aiPrediction: '합성 결과', providerResults: { fixture: true }, plantReanalysisStatus: 'complete' }),
      deleteSayuPlantDiaryStoredPhoto: async () => { state.removals++; },
      getPlantDisplayName: entry => entry.title,
      getPlantMemoSummary: entry => entry.memo,
      getPlantScientificLine: () => '', formatKoreanDate: value => value,
      filterPlantInfoFields: fields => fields, buildPlantDetectiveDetailSections: () => [],
      PLANT_SAYU_SOURCE_LABEL: {}, window: { confirm: () => true },
      toast: { error() {}, success() {}, warning() {} }, console: { warn() {}, error() {} },
    };
    return new Function(...Object.keys(env), `${handlersJs}\nreturn { ${names.join(', ')} };`)(...Object.values(env));
  };
  const assertEditable = async () => {
    await handlers().handleEditPlantDetectiveRecord();
    const navigation = state.navigations.at(-1);
    assert.equal(navigation?.path, '/plant-detective');
    assert.equal(navigation.state.fingerprint, await fingerprintPlantEntry(state.stored[0]));
    const edited = await applyPlantDetectiveEdit(state.stored, navigation.state, draft, Date.now());
    assert.equal(edited.entries[0].memo, '수정 메모');
    assert.deepEqual(edited.entries[0].imageUrls, state.stored[0].imageUrls);
    assert.deepEqual(edited.entries[0].providerResults, state.stored[0].providerResults);
    assert.deepEqual(edited.entries[1], sibling);
  };
  return { state, handlers, assertEditable };
}

test('upload locks editing and overlapping photo writes immediately; completion remains editable', async () => {
  const f = fixture();
  const upload = deferred();
  f.state.upload = () => upload.promise;
  const add = f.handlers().handleAddPlantDetectivePhoto('fixture-record', 0, {});
  assert.equal(f.state.busyRef.current, true);
  await f.handlers().handleEditPlantDetectiveRecord();
  await f.handlers().handleAddPlantDetectivePhoto('fixture-record', 0, {});
  await f.handlers().handleDeletePlantDetectivePhoto('fixture-record', 0, original.imageUrl);
  assert.equal(f.state.navigations.length, 0);
  assert.equal(f.state.uploads, 1);
  assert.equal(f.state.writes, 0);
  upload.resolve({ url: 'https://fixture.invalid/three' });
  await add;
  assert.equal(f.state.busyRef.current, false);
  assert.equal(f.state.busy, false);
  assert.equal(f.state.writes, 2);
  assert.equal(f.state.stored[0].plantReanalysisStatus, 'complete');
  await f.assertEditable();
});

test('editing stays locked through reanalysis after the photo has been persisted', async () => {
  const f = fixture();
  const started = deferred();
  const result = deferred();
  f.state.reanalysis = () => { started.resolve(); return result.promise; };
  const add = f.handlers().handleAddPlantDetectivePhoto('fixture-record', 0, {});
  await started.promise;
  assert.equal(f.state.writes, 1);
  await f.handlers().handleEditPlantDetectiveRecord();
  assert.equal(f.state.navigations.length, 0);
  result.resolve({ imageCount: 3, result: {} });
  await add;
  await f.assertEditable();
});

test('photo removal blocks editing while its write is pending and updates the snapshot on success', async () => {
  const f = fixture();
  const write = deferred();
  f.state.beforeWrite = () => write.promise;
  const remove = f.handlers().handleDeletePlantDetectivePhoto('fixture-record', 0, original.imageUrl);
  await f.handlers().handleEditPlantDetectiveRecord();
  assert.equal(f.state.navigations.length, 0);
  assert.equal(f.state.busyRef.current, true);
  write.resolve();
  await remove;
  assert.deepEqual(f.state.stored[0].imageUrls, [original.imageUrls[1]]);
  assert.equal(f.state.busyRef.current, false);
  await f.assertEditable();
});

test('failed final save retains the first persisted photo snapshot without unsaved AI mutations', async () => {
  const f = fixture();
  f.state.beforeWrite = write => { if (write === 2) throw new Error('fixture final save failure'); };
  await f.handlers().handleAddPlantDetectivePhoto('fixture-record', 0, {});
  assert.equal(f.state.stored[0].imageUrls.length, 3);
  assert.equal(f.state.stored[0].plantReanalysisStatus, undefined);
  assert.deepEqual(f.state.records[0].plantDetective, f.state.stored);
  assert.equal(f.state.busyRef.current, false);
  assert.equal(f.state.removals, 0);
  await f.assertEditable();
});

test('failed reanalysis keeps the persisted photo and leaves a matching editable snapshot', async () => {
  const f = fixture();
  f.state.reanalysis = () => { throw new Error('fixture analysis failure'); };
  await f.handlers().handleAddPlantDetectivePhoto('fixture-record', 0, {});
  assert.equal(f.state.stored[0].plantReanalysisStatus, 'failed');
  assert.equal(f.state.stored[0].imageUrls.length, 3);
  await f.assertEditable();
});

test('failed first photo save releases the lock and preserves the previous snapshot', async () => {
  const f = fixture();
  f.state.beforeWrite = () => { throw new Error('fixture write failure'); };
  await f.handlers().handleAddPlantDetectivePhoto('fixture-record', 0, {});
  assert.deepEqual(f.state.stored[0], original);
  assert.deepEqual(f.state.detail.editSnapshot, original);
  assert.equal(f.state.busyRef.current, false);
  assert.equal(f.state.removals, 1);
  await f.assertEditable();
});

test('failed photo removal preserves the snapshot and releases the lock', async () => {
  const f = fixture();
  f.state.beforeWrite = () => { throw new Error('fixture write failure'); };
  await f.handlers().handleDeletePlantDetectivePhoto('fixture-record', 0, original.imageUrl);
  assert.deepEqual(f.state.detail.editSnapshot, original);
  assert.equal(f.state.busyRef.current, false);
  await f.assertEditable();
});

test('a photo operation starting during digest calculation prevents late navigation', async () => {
  const f = fixture();
  const digest = deferred();
  const upload = deferred();
  f.state.hash = () => digest.promise;
  f.state.upload = () => upload.promise;
  const edit = f.handlers().handleEditPlantDetectiveRecord();
  const add = f.handlers().handleAddPlantDetectivePhoto('fixture-record', 0, {});
  digest.resolve(await fingerprintPlantEntry(original));
  await edit;
  assert.equal(f.state.navigations.length, 0);
  upload.resolve({ url: 'https://fixture.invalid/three' });
  await add;
});
