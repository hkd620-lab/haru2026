import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compressRecordPhoto } from '../src/app/services/recordPhotoCompression.ts';

const heic = new File(['source'], 'fixture.heic', { type: 'image/heic' });
const jpeg = new File(['converted'], 'fixture.jpg', { type: 'image/jpeg' });
const small = new Blob(['small'], { type: 'image/jpeg' });

test('a locally decoded HEIC uploads the local JPEG without a conversion request', async () => {
  let serverCalls = 0;
  const result = await compressRecordPhoto(heic, {
    isHeic: true,
    compress: async file => { assert.equal(file, heic); return small; },
    convertHeic: async () => { serverCalls++; throw new Error('must not send original'); },
  });
  assert.equal(result, small);
  assert.equal(serverCalls, 0);
});

test('unsupported HEIC uses the existing server path exactly once and compresses the converted JPEG', async () => {
  const calls = [];
  const result = await compressRecordPhoto(heic, {
    isHeic: true,
    compress: async file => { calls.push(file); if (file === heic) throw new Error('unsupported'); return small; },
    convertHeic: async file => { assert.equal(file, heic); return jpeg; },
  });
  assert.deepEqual(calls, [heic, jpeg]);
  assert.equal(result, small);
});

test('a non-HEIC compression failure never calls the HEIC server', async () => {
  let serverCalls = 0;
  await assert.rejects(compressRecordPhoto(jpeg, {
    isHeic: false,
    compress: async () => { throw new Error('decode failed'); },
    convertHeic: async () => { serverCalls++; return jpeg; },
  }), /decode failed/);
  assert.equal(serverCalls, 0);
});

test('server conversion failure remains a failure without further retries', async () => {
  let serverCalls = 0;
  await assert.rejects(compressRecordPhoto(heic, {
    isHeic: true,
    compress: async () => { throw new Error('unsupported'); },
    convertHeic: async () => { serverCalls++; throw new Error('server unavailable'); },
  }), /server unavailable/);
  assert.equal(serverCalls, 1);
});
