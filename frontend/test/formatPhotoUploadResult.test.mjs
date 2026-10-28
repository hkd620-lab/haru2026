import { getRecordPhotoLimit } from '../src/app/services/recordPhotoLimit.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { test } from 'node:test';
import { startSelectedRecordPhotoReads } from '../src/app/services/selectedRecordPhoto.ts';
import { compressRecordPhoto } from '../src/app/services/recordPhotoCompression.ts';

const source = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const uploadSelectedImages = async'), source.indexOf('  // Firebase Storage URL →'));
const { code } = await transform(`${handler}\nglobalThis.runUpload = handleImageUpload; globalThis.runInitialUpload = (files) => uploadSelectedImages(files, true);`, { loader: 'ts' });
function fixture(outcomes) {
  const notices = [], images = [], tracked = [], busy = [];
  let attempt = 0;
  const toast = Object.fromEntries(['warning', 'error', 'success', 'info'].map(level => [level, (...args) => notices.push({ level, message: args[0] })]));
  const context = {
    RECORD_PHOTO_UPLOAD_TIMEOUT: 'RECORD_PHOTO_UPLOAD_TIMEOUT', getRecordPhotoLimit, toast, console: { error() {} }, File, Date, Math, Error, Uint8Array, btoa, startSelectedRecordPhotoReads, compressRecordPhoto,
    uploadSelectedImagesRef: { current: null }, latestExpandedLedgerRowIdRef: { current: null }, photoEditorSessionRef: { current: 1 },
    isCleaningSessionUploadsRef: { current: false }, isUploadingRef: { current: false }, ledgerInputMode: 'single',
    initialUploadedImagesRef: { current: [] }, initialPhotoUploadFailedRef: { current: false }, setInitialPhotoUploadFailed: () => {},
    uploadedImages: [], format: '일기', user: { uid: 'fixture' }, recordId: 'record', prefix: 'diary',
    setIsUploading: value => busy.push(value), getStorage: () => ({}), getFunctions: () => ({}),
    readOriginalImageMeta: async () => ({ metadataSource: 'none' }),
    compressImage: async () => { const result = outcomes[attempt++]; if (result instanceof Error) throw result; return new Blob(['photo']); },
    ref: (_, path) => ({ fullPath: path }), uploadBytes: async () => {}, uploadBytesResumable: async () => {}, withRecordPhotoUploadDeadline: async task => task, getDownloadURL: async () => `fixture:${attempt}`,
    sessionUploadedImageUrlsRef: { current: tracked }, isStockFormat: false,
    setUploadedImages: update => images.push(...update([])), setUploadedImageMeta: () => {},
    fileInputRef: { current: { value: 'selected' } }, deleteObject: async () => {}, enqueuePendingRecordPhotoCleanup: () => {},
  };
  vm.runInNewContext(code, context);
  const run = async count => context.runUpload({ currentTarget: { files: Array.isArray(count) ? count : Array.from({ length: count }, () => new File(['photo'], 'fixture.jpg', { type: 'image/jpeg' })), value: 'selected' } });
  return { run, notices, images, tracked, busy, context };
}

test('편집창을 닫아도 초안 사진 effect의 Hook 호출을 건너뛰지 않는다', () => {
  const closedReturn = source.indexOf('  if (!isOpen) return null;');
  const hooks = [...source.matchAll(/\buse(?:Effect|State|Ref|Memo|Callback)\s*\(/g)];
  assert.ok(closedReturn > 0);
  assert.ok(hooks.length > 0);
  assert.ok(hooks.every(hook => hook.index < closedReturn), '모든 Hook은 닫힌 편집창의 반환보다 먼저 호출되어야 한다');
});

test('다시 연 편집창의 초안 사진 한도는 이전 렌더의 다섯 장을 참조하지 않는다', async () => {
  const f = fixture(['ok']);
  f.context.uploadedImages = ['old1', 'old2', 'old3', 'old4', 'old5'];
  await f.context.runInitialUpload([new File(['photo'], 'new.jpg', { type: 'image/jpeg' })]);
  assert.equal(f.images.length, 1);
  assert.equal(f.context.initialPhotoUploadFailedRef.current, false);
  assert.equal(f.notices.at(-1).level, 'success');
});
test('all unreadable photos retain the failure reason and never report zero-photo success; retry works', async () => {
  const f = fixture([new Error('FILE_READER_ERROR'), 'ok']);
  await f.run(1);
  assert.equal(f.notices.at(-1).level, 'error');
  assert.match(f.notices.at(-1).message, /원본/);
  assert.equal(f.notices.some(n => n.level === 'success'), false);
  assert.deepEqual(f.images, []);
  assert.deepEqual(f.busy, [true, false]);
  assert.equal(f.context.fileInputRef.current.value, '');
  await f.run(1);
  assert.equal(f.notices.at(-1).level, 'success');
  assert.equal(f.images.length, 1);
});
test('an upload failure does not discard another successfully uploaded photo', async () => {
  const f = fixture(['ok', new Error('network'), 'ok']);
  await f.run(3);
  assert.deepEqual(f.images, ['fixture:1', 'fixture:3']);
  assert.deepEqual(f.tracked, f.images);
  assert.equal(f.notices.at(-1).level, 'warning');
  assert.match(f.notices.at(-1).message, /2장의 사진/);
  assert.match(f.notices.at(-1).message, /1장은 실패/);
});
test('successful uploads preserve the notice about excluded extra selections', async () => {
  const f = fixture(Array(5).fill('ok'));
  await f.run(7);
  assert.equal(f.images.length, 5);
  assert.equal(f.notices.at(-1).level, 'success');
  assert.match(f.notices.at(-1).message, /초과한 2장/);
});

test('Android HEIC NotReadableError identifies the source-file read failure before calling the server', async () => {
  const f = fixture([]);
  const error = new Error('device provider unavailable'); error.name = 'NotReadableError';
  let serverCalls = 0;
  f.context.httpsCallable = () => { serverCalls++; throw new Error('must not call server'); };
  await f.run([{ name: 'fixture.heic', type: 'image/heic', size: 100, stream: () => { throw error; } }]);
  assert.equal(serverCalls, 0);
  assert.equal(f.notices.at(-1).level, 'error');
  assert.match(f.notices.at(-1).message, /원본을 읽지 못했습니다/);
  assert.equal(f.notices.some(n => n.level === 'success'), false);
});
test('oversized or invalid selections are counted as failures rather than zero-photo success', async () => {
  const f = fixture([]);
  await f.run([new File([new Uint8Array(21 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' }), { name: 'document.txt', type: 'text/plain', size: 10 }]);
  assert.equal(f.notices.at(-1).level, 'error');
  assert.match(f.notices.at(-1).message, /20MB/);
  assert.match(f.notices.at(-1).message, /이미지 형식/);
});

test('the handler snapshots the picker before size/EXIF access and reads the original only once', async () => {
  const f = fixture(['ok']);
  let reads = 0, conversionCalls = 0;
  f.context.httpsCallable = () => async ({ imageBase64 }) => {
    conversionCalls++;
    assert.equal(imageBase64, btoa('fixture'));
    return { data: 'jpeg' };
  };
  f.context.decodeConvertedJpeg = async () => new Blob(['jpeg'], { type: 'image/jpeg' });
  f.context.readOriginalImageMeta = async file => {
    assert.ok(file instanceof File);
    assert.equal(file.name, 'fixture.heic');
    assert.equal(await file.text(), 'fixture');
    return { metadataSource: 'none' };
  };
  const source = {
    name: 'fixture.heic', type: 'image/heic',
    get size() { throw new Error('original metadata must never be read'); },
    get lastModified() { throw new Error('original metadata must never be read'); },
    stream() { reads++; return new Blob(['fixture']).stream(); },
  };
  await f.run([source]);
  assert.equal(reads, 1);
  assert.equal(conversionCalls, 0, 'local HEIC success must not call the server');
  assert.equal(f.notices.at(-1).level, 'success');
  assert.equal(f.images.length, 1);
});

test('processed photo promises are removed from the queue', async () => {
  const f = fixture(['ok', 'ok', 'ok']);
  let queue;
  f.context.startSelectedRecordPhotoReads = files => {
    queue = startSelectedRecordPhotoReads(files);
    return queue;
  };
  await f.run(3);
  assert.equal(queue.length, 0);
  assert.equal(f.images.length, 3);
});

test('period ledger photos update the selected entry and preserve its existing photo metadata', async () => {
  const f = fixture(['ok']);
  let update;
  Object.assign(f.context, {
    ledgerInputMode: 'period', format: 'HARU보조장부', expandedLedgerXlsxRowId: 'row',
    ledgerXlsxPreviewRows: [{ id: 'row', entry: { imageUrls: ['existing'], imageMeta: [{ url: 'existing' }] } }],
    updateLedgerPeriodEntry: (id, entry) => { update = { id, entry }; },
  });
  await f.run(1);
  assert.equal(update.id, 'row');
  assert.deepEqual(Array.from(update.entry.imageUrls), ['existing', 'fixture:1']);
  assert.equal(update.entry.imageMeta.length, 2);
  assert.equal(update.entry.imageMeta[0].url, 'existing');
  assert.equal(f.images.length, 0);
});

test('unsupported local HEIC falls back to server conversion before uploading and keeps original metadata', async () => {
  const f = fixture([new Error('unsupported HEIC'), 'ok']);
  let serverCalls = 0;
  f.context.httpsCallable = () => async () => { serverCalls++; return { data: 'jpeg' }; };
  f.context.decodeConvertedJpeg = async () => new Blob(['jpeg'], { type: 'image/jpeg' });
  let metadata;
  f.context.readOriginalImageMeta = async file => {
    assert.equal(file.type, 'image/heic');
    assert.equal(await file.text(), 'original');
    return { metadataSource: 'exif', takenDate: '2020-01-02' };
  };
  f.context.setUploadedImageMeta = update => { metadata = update([]); };
  await f.run([new File(['original'], 'fixture.heic', { type: 'image/heic' })]);
  assert.equal(serverCalls, 1);
  assert.equal(f.images.length, 1);
  assert.equal(metadata[0].takenDate, '2020-01-02');
  assert.equal(f.notices.at(-1).level, 'success');
});

for (const format of ['일기', '에세이', '선교보고', '일반보고', '업무일지', '여행기록', '텃밭일지', '애완동물관찰일지', '육아일기', '성장기록', '메모', 'HARU가계부']) {
  test(`${format}: existing three photos accept only two more from a larger selection`, async () => {
    const f = fixture(['ok', 'ok']);
    f.context.format = format;
    f.context.uploadedImages = ['old1', 'old2', 'old3'];
    await f.run(4);
    assert.equal(f.images.length, 2);
    assert.match(f.notices.at(-1).message, /초과한 2장/);
    f.context.uploadedImages = ['1', '2', '3', '4', '5'];
    await f.run(1);
    assert.match(f.notices.at(-1).message, /최대 5장/);
    assert.equal(f.images.length, 2);
  });
}
