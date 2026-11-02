import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { isStockOcrQuotaExceeded, STOCK_OCR_QUOTA_NOTICE } from '../src/app/services/stockOcrQuota.ts';

const source = fs.readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
const exhausted = Object.assign(new Error('이번 달 주식 사진 한도'), { code: 'functions/resource-exhausted', details: { reason: 'MONTHLY_STOCK_OCR_QUOTA_EXCEEDED' } });
const begin = source.indexOf('  const handleExtractSelectedStockText = async');
const selected = source.slice(begin, source.indexOf('\n  };', begin) + 5);
function fixture(failure) {
  let calls = 0; const notices = [];
  const context = {
    isStockFormat: true, selectedStockOcrFiles: Array.from({ length: 3 }, () => ({ type: 'image/png', name: 'test.png', size: 1 })),
    user: { uid: 'local-test' }, setIsExtractingStockText() {}, setSelectedStockOcrFiles() {},
    prepareBookOcrImage: async file => file,
    extractStockTextFromImage: async () => { if (++calls === 2) throw failure; },
    isStockOcrQuotaExceeded, console: { error() {} },
    toast: Object.fromEntries(['warning','success','error'].map(k => [k, message => notices.push(message)])),
  };
  vm.runInNewContext(transformSync(`${selected}\nglobalThis.run=handleExtractSelectedStockText;`, { loader: 'ts' }).code, context);
  return { run: context.run, calls: () => calls, notices };
}
test('한도 도달 시 나머지 선택 사진 요청을 중단하지만 앞선 추출은 유지', async () => {
  const f = fixture(exhausted); await f.run();
  assert.equal(f.calls(), 2); assert.ok(f.notices.some(s => s.includes('1장')));
});
test('일시적 추출 오류에는 다음 사진을 계속 처리', async () => {
  const f = fixture(new Error('일시 오류')); await f.run(); assert.equal(f.calls(), 3);
});
test('독서·일반 AI·속도 제한 오류를 주식 월한도로 오인하지 않는다', () => {
  for (const error of [null, new Error('resource-exhausted'), { details: { reason: 'MONTHLY_OCR_QUOTA_EXCEEDED' } }]) assert.equal(isStockOcrQuotaExceeded(error), false);
  assert.equal(isStockOcrQuotaExceeded(exhausted), true);
  assert.ok(STOCK_OCR_QUOTA_NOTICE.includes('직접 입력·저장'));
});

test('월한도 초과 때 초안 사진 3장의 업로드는 완료하고 OCR만 중단한다', async () => {
  const start = source.indexOf('  const uploadSelectedImages = async');
  const handler = source.slice(start, source.indexOf('\n  };', start) + 5);
  let calls = 0, uploads = 0; const state = { images: [], meta: [] };
  const context = {
    isCleaningSessionUploadsRef: { current: false }, isUploadingRef: { current: false },
    initialPhotoUploadFailedRef: { current: false }, initialUploadedImagesRef: { current: [] },
    ledgerInputMode: 'simple', uploadedImages: [], format: '주식거래일지', prefix: 'stock', recordId: 'local-draft',
    user: { uid: 'local-test' }, getRecordPhotoLimit: () => 10, isStockFormat: true,
    getStorage: () => ({}), getFunctions: () => ({}), readOriginalImageMeta: async () => ({}),
    startSelectedRecordPhotoReads: files => files.map(file => Promise.resolve({ ok: true, file })),
    compressRecordPhoto: async file => file, ref: (_, fullPath) => ({ fullPath }),
    withRecordPhotoUploadDeadline: promise => promise, uploadBytesResumable: async () => { uploads++; },
    getDownloadURL: async () => `https://test.invalid/${uploads}`,
    sessionUploadedImageUrlsRef: { current: [] }, photoEditorSessionRef: { current: 1 }, fileInputRef: { current: null },
    isStockOcrQuotaExceeded, extractStockTextFromImage: async () => { calls++; throw exhausted; },
    setInitialPhotoUploadFailed: value => { state.failed = value; }, setIsUploading() {},
    setUploadedImages: update => { state.images = update(state.images); },
    setUploadedImageMeta: update => { state.meta = update(state.meta); },
    console: { error() {} }, toast: Object.fromEntries(['warning','success','error'].map(k => [k, () => {}])),
  };
  vm.runInNewContext(transformSync(`${handler}\nglobalThis.run=uploadSelectedImages;`, { loader: 'ts' }).code, context);
  await context.run(Array.from({ length: 3 }, () => ({ name: 'test.png', type: 'image/png', size: 1 })), true);
  assert.equal(calls, 1);
  assert.equal(uploads, 3);
  assert.equal(state.images.length, 3);
  assert.equal(state.meta.length, 3);
  assert.equal(context.initialPhotoUploadFailedRef.current, false, '직접 입력한 기록의 저장 차단 플래그가 켜지면 안 됨');
});
