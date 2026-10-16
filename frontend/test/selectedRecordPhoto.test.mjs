import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startSelectedRecordPhotoReads } from '../src/app/services/selectedRecordPhoto.ts';

test('starts all picker reads immediately without size, lastModified, slicing, or waiting for the first file', async () => {
  const started = [], finish = [];
  const sources = [0, 1].map(index => ({
    name: `fixture-${index}.heic`, type: index ? '' : 'image/heic',
    get size() { throw new Error('picker metadata queried'); },
    get lastModified() { throw new Error('picker metadata queried'); },
    slice() { throw new Error('picker source sliced'); },
    arrayBuffer() { started.push(index); return new Promise(resolve => finish.push(resolve)); },
  }));
  const reads = startSelectedRecordPhotoReads(sources);
  assert.deepEqual(started, [0, 1]);
  const bytes = new TextEncoder().encode('fixture');
  finish.forEach(resolve => resolve(bytes.buffer));
  for (const [index, result] of (await Promise.all(reads)).entries()) {
    assert.equal(result.ok, true);
    assert.equal(result.file.name, sources[index].name);
    assert.deepEqual(new Uint8Array(result.buffer), bytes);
    assert.equal(await result.file.text(), 'fixture');
  }
});

test('one unreadable picker file does not reject another readable file', async () => {
  const results = await Promise.all(startSelectedRecordPhotoReads([
    { name: 'unreadable.jpg', type: 'image/jpeg', arrayBuffer() { throw new Error('NotReadableError'); } },
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
