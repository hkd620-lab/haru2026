import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { test } from 'node:test';
import { startSelectedRecordPhotoReads } from '../src/app/services/selectedRecordPhoto.ts';

const source = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const handleImageUpload = async'), source.indexOf('  // Firebase Storage URL →'));
const { code } = await transform(`${handler}\nglobalThis.runUpload = handleImageUpload;`, { loader: 'ts' });
function fixture(outcomes) {
  const notices = [], images = [], tracked = [], busy = [];
  let attempt = 0;
  const toast = Object.fromEntries(['warning', 'error', 'success', 'info'].map(level => [level, (...args) => notices.push({ level, message: args[0] })]));
  const context = {
    toast, console: { error() {} }, File, Date, Math, Error, Uint8Array, btoa, startSelectedRecordPhotoReads,
    isCleaningSessionUploadsRef: { current: false }, ledgerInputMode: 'single',
    uploadedImages: [], format: '일기', user: { uid: 'fixture' }, recordId: 'record', prefix: 'diary',
    setIsUploading: value => busy.push(value), getStorage: () => ({}), getFunctions: () => ({}),
    readOriginalImageMeta: async () => ({ metadataSource: 'none' }),
    compressImage: async () => { const result = outcomes[attempt++]; if (result instanceof Error) throw result; return new Blob(['photo']); },
    ref: (_, path) => ({ fullPath: path }), uploadBytes: async () => {}, getDownloadURL: async () => `fixture:${attempt}`,
    sessionUploadedImageUrlsRef: { current: tracked }, isStockFormat: false,
    setUploadedImages: update => images.push(...update([])), setUploadedImageMeta: () => {},
    fileInputRef: { current: { value: 'selected' } }, deleteObject: async () => {}, enqueuePendingRecordPhotoCleanup: () => {},
  };
  vm.runInNewContext(code, context);
  const run = async count => context.runUpload({ target: { files: Array.isArray(count) ? count : Array.from({ length: count }, () => new File(['photo'], 'fixture.jpg', { type: 'image/jpeg' })), value: 'selected' } });
  return { run, notices, images, tracked, busy, context };
}
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
  const f = fixture(['ok', 'ok', 'ok']);
  await f.run(5);
  assert.equal(f.images.length, 3);
  assert.equal(f.notices.at(-1).level, 'success');
  assert.match(f.notices.at(-1).message, /초과한 2장/);
});

test('Android HEIC NotReadableError identifies the source-file read failure before calling the server', async () => {
  const f = fixture([]);
  const error = new Error('device provider unavailable'); error.name = 'NotReadableError';
  let serverCalls = 0;
  f.context.httpsCallable = () => { serverCalls++; throw new Error('must not call server'); };
  await f.run([{ name: 'fixture.heic', type: 'image/heic', size: 100, arrayBuffer: async () => { throw error; } }]);
  assert.equal(serverCalls, 0);
  assert.equal(f.notices.at(-1).level, 'error');
  assert.match(f.notices.at(-1).message, /원본을 읽지 못했습니다/);
  assert.equal(f.notices.some(n => n.level === 'success'), false);
});
test('oversized or invalid selections are counted as failures rather than zero-photo success', async () => {
  const f = fixture([]);
  await f.run([{ name: 'large.jpg', type: 'image/jpeg', arrayBuffer: async () => new ArrayBuffer(21 * 1024 * 1024) }, { name: 'document.txt', type: 'text/plain', size: 10 }]);
  assert.equal(f.notices.at(-1).level, 'error');
  assert.match(f.notices.at(-1).message, /20MB/);
  assert.match(f.notices.at(-1).message, /이미지 형식/);
});

test('the handler snapshots the picker before size/EXIF access and reuses the HEIC bytes', async () => {
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
    arrayBuffer() { reads++; return Promise.resolve(new TextEncoder().encode('fixture').buffer); },
  };
  await f.run([source]);
  assert.equal(reads, 1);
  assert.equal(conversionCalls, 1);
  assert.equal(f.notices.at(-1).level, 'success');
  assert.equal(f.images.length, 1);
});
