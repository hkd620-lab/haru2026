import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startSelectedRecordPhotoReads } from '../src/app/services/selectedRecordPhoto.ts';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

test('starts all picker reads immediately without size, lastModified, slicing, or waiting for the first file', async () => {
  const started = [], finish = [];
  const sources = [0, 1].map(index => ({
    name: `fixture-${index}.heic`, type: index ? '' : 'image/heic',
    get size() { throw new Error('picker metadata queried'); },
    get lastModified() { throw new Error('picker metadata queried'); },
    slice() { throw new Error('picker source sliced'); },
    stream() {
      let consumed = false;
      return { getReader: () => ({
        read() {
          if (consumed) return Promise.resolve({ done: true });
          consumed = true; started.push(index);
          return new Promise(resolve => finish.push(bytes => resolve({ done: false, value: new Uint8Array(bytes) })));
        },
        cancel: async () => {}, releaseLock() {},
      }) };
    },
  }));
  const reads = startSelectedRecordPhotoReads(sources);
  assert.deepEqual(started, [0, 1]);
  const bytes = new TextEncoder().encode('fixture');
  finish.forEach(resolve => resolve(bytes.buffer));
  for (const [index, result] of (await Promise.all(reads)).entries()) {
    assert.equal(result.ok, true);
    assert.equal(result.file.name, sources[index].name);
    assert.equal('buffer' in result, false, 'do not retain both a raw buffer and a memory File');
    assert.deepEqual(new Uint8Array(await result.file.arrayBuffer()), bytes);
    assert.equal(await result.file.text(), 'fixture');
  }
});

test('one unreadable picker file does not reject another readable file', async () => {
  const results = await Promise.all(startSelectedRecordPhotoReads([
    { name: 'unreadable.jpg', type: 'image/jpeg', stream() { throw new Error('NotReadableError'); } },
    new File(['jpeg'], 'readable.jpg', { type: 'image/jpeg' }),
  ]));
  assert.equal(results[0].ok, false);
  assert.match(results[0].message, /원본을 읽지 못했습니다/);
  assert.equal(results[1].ok, true);
});

test('preserves the exact 20MiB boundary and rejects oversized bytes before downstream upload', async () => {
  const [atLimit, oversized] = await Promise.all(startSelectedRecordPhotoReads([
    new File([new Uint8Array(20 * 1024 * 1024)], 'limit.jpg', { type: 'image/jpeg' }),
    new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }),
  ]));
  assert.equal(atLimit.ok, true);
  assert.equal(oversized.ok, false);
  assert.match(oversized.message, /20MB/);
});

test('does not read non-image selections', async () => {
  const [result] = await Promise.all(startSelectedRecordPhotoReads([
    { name: 'fixture.txt', type: 'text/plain', arrayBuffer() { throw new Error('must not read'); } },
  ]));
  assert.equal(result.ok, false);
  assert.match(result.message, /이미지 형식/);
});

test('EXIF-less photos do not acquire an upload date from the memory File lastModified', async () => {
  const source = new File(['no-exif'], 'fixture.jpg', { type: 'image/jpeg', lastModified: 0 });
  const [snapshot] = await Promise.all(startSelectedRecordPhotoReads([source]));
  assert.equal(snapshot.ok, true);
  // Exercise the production metadata mapping with a parser that found no EXIF.
  // exifr's browser namespace import is not directly compatible with Node ESM.
  const metadataSource = readFileSync(new URL('../src/app/services/photoMetadataService.ts', import.meta.url), 'utf8');
  const { code } = await transform(metadataSource.replace("import * as exifr from 'exifr';", ''), { loader: 'ts', format: 'cjs' });
  const context = { module: { exports: {} }, exifr: { parse: async file => {
    assert.equal(await file.text(), 'no-exif');
    return {};
  } } };
  vm.runInNewContext(code, context);
  const metadata = await context.module.exports.readOriginalImageMeta(snapshot.file);
  assert.equal(metadata.originalName, source.name);
  assert.equal(metadata.metadataSource, 'none');
  assert.equal(metadata.takenAt, undefined);
  assert.equal(metadata.takenDate, undefined);
});

test('cancels an oversized stream at the limit instead of reading the complete source', async () => {
  let pulls = 0, cancelled = false, released = false;
  const reader = {
    async read() { pulls++; return { done: false, value: new Uint8Array(1024 * 1024) }; },
    async cancel() { cancelled = true; },
    releaseLock() { released = true; },
  };
  const [result] = await Promise.all(startSelectedRecordPhotoReads([
    { name: 'large.jpg', type: 'image/jpeg', stream: () => ({ getReader: () => reader }),
      get size() { throw new Error('must not inspect provider metadata'); } },
  ]));
  assert.equal(result.ok, false);
  assert.equal(pulls, 21);
  assert.equal(cancelled, true);
  assert.equal(released, true);
});

test('normalizes extension-only iPhone/Android photo MIME without provider metadata', async () => {
  for (const [name, type] of [['IMG.JPG','image/jpeg'],['capture.PNG','image/png'],['camera.HEIC','image/heic']]) {
    const [result] = await Promise.all(startSelectedRecordPhotoReads([{ name, type: '', stream: () => new Blob(['photo']).stream(), get size() { throw new Error('must not query metadata'); } }]));
    assert.equal(result.ok,true); assert.equal(result.file.type,type);
  }
});
test('limits a selection to 60MiB and cancels excess streams', async () => {
  let cancelled = 0;
  const sources = Array.from({length:4},()=>({name:'photo.jpg',type:'image/jpeg',stream(){let read=false;return{getReader:()=>({async read(){if(read)return{done:true};read=true;return{done:false,value:new Uint8Array(20*1024*1024)};},async cancel(){cancelled++;},releaseLock(){}})};}}));
  const results=await Promise.all(startSelectedRecordPhotoReads(sources));
  assert.equal(results.filter(r=>r.ok).length,3);assert.equal(cancelled,1);assert.match(results[3].message,/60MB/);
});

const MiB = 1024 * 1024;
function chunkedPhoto(count, options = {}) {
  let index = 0;
  return {name: 'chunked.jpg', type: 'image/jpeg', stream: () => ({getReader: () => ({
    async read() {
      if (index === count) { if (options.fail) throw new Error('provider read failed'); return {done: true}; }
      index++;
      return {done: false, value: new Uint8Array(MiB)};
    },
    cancel: options.cancel || (async () => {}), releaseLock() {},
  })})};
}
test('interleaved 16MiB files retain three successes after refunding the fourth', async () => {
  const results = await Promise.all(startSelectedRecordPhotoReads(Array.from({length: 4}, () => chunkedPhoto(16))));
  assert.equal(results.filter(r => r.ok).length, 3);
  assert.equal(results.filter(r => !r.ok).length, 1);
  for (const result of results.filter(r => r.ok)) assert.equal(result.file.size, 16 * MiB);
});
test('read failures refund consumed bytes before slow cancellation finishes', async () => {
  let finishCancel;
  const reads = startSelectedRecordPhotoReads([
    chunkedPhoto(10, {fail: true, cancel: () => new Promise(resolve => { finishCancel = resolve; })}),
    ...Array.from({length: 3}, () => chunkedPhoto(20)),
  ]);
  const valid = await Promise.all(reads.slice(1));
  assert.equal(valid.every(r => r.ok), true);
  assert.equal(typeof finishCancel, 'function');
  finishCancel();
  assert.equal((await reads[0]).ok, false);
});
test('oversized files refund previously accepted chunks for later valid files', async () => {
  let unblock, finishCancel;
  const gate = new Promise(resolve => {unblock = resolve;});
  const later = Array.from({length: 3}, () => {
    const photo = chunkedPhoto(20), reader = photo.stream().getReader();
    return {...photo, stream: () => ({getReader: () => ({...reader, async read() {await gate; return reader.read();}})})};
  });
  const reads = startSelectedRecordPhotoReads([
    chunkedPhoto(21, {cancel: () => {unblock(); return new Promise(resolve => {finishCancel = resolve;});}}), ...later,
  ]);
  assert.equal((await Promise.all(reads.slice(1))).every(r => r.ok), true);
  finishCancel();
  assert.match((await reads[0]).message, /20MB/);
});
