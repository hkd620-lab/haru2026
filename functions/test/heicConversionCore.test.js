const assert = require('node:assert/strict');
const {
  CONVERTED_JPEG_MAX_BYTES,
  CONVERT_HEIC_MAX_SERIALIZED_RESPONSE_BYTES,
  HEIC_TEMP_MAX_AGE_MS,
  HEIC_UPLOAD_TRANSFORMATION,
  buildConvertHeicResponse,
  convertHeicToJpegBase64,
  sweepExpiredHeicTempObjects,
} = require('../src/heicConversionCore.ts');

async function run() {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  assert.deepEqual(HEIC_UPLOAD_TRANSFORMATION, {
    width: 2560,
    height: 2560,
    crop: 'limit',
    angle: 'auto',
    quality: 80,
    flags: 'strip_profile',
  }, 'large iPhone photos must retain aspect ratio, normalize EXIF orientation, and use bounded JPEG quality');

  {
    const destroyed = [];
    const result = await convertHeicToJpegBase64('aGVpYw==', 'heic_temp/user-a/success', {
      upload: async (_dataUri, publicId) => ({ public_id: publicId, secure_url: 'https://example.test/a.jpg' }),
      download: async () => jpeg,
      destroy: async (publicId) => destroyed.push(publicId),
    });
    assert.equal(result.contentType, 'image/jpeg');
    assert.deepEqual(Buffer.from(result.imageBase64, 'base64'), jpeg);
    assert.equal(result.url, `data:image/jpeg;base64,${result.imageBase64}`);
    const legacyClientResponse = await fetch(result.url);
    assert.deepEqual(Buffer.from(await legacyClientResponse.arrayBuffer()), jpeg, 'old frontend must fetch new Function data URL');
    assert.deepEqual(destroyed, ['heic_temp/user-a/success']);
  }

  {
    const destroyed = [];
    await assert.rejects(() => convertHeicToJpegBase64('aGVpYw==', 'heic_temp/user-a/upload-failure', {
      upload: async () => { throw new Error('upload failed after object creation'); },
      download: async () => jpeg,
      destroy: async (publicId) => destroyed.push(publicId),
    }), /upload failed/);
    assert.deepEqual(destroyed, ['heic_temp/user-a/upload-failure']);
  }

  {
    const destroyed = [];
    await assert.rejects(() => convertHeicToJpegBase64('aGVpYw==', 'heic_temp/user-a/download-failure', {
      upload: async (_dataUri, publicId) => ({ public_id: publicId, secure_url: 'https://example.test/a.jpg' }),
      download: async () => { throw new Error('download failed'); },
      destroy: async (publicId) => destroyed.push(publicId),
    }), /download failed/);
    assert.deepEqual(destroyed, ['heic_temp/user-a/download-failure']);
  }

  {
    const destroyed = [];
    await assert.rejects(() => convertHeicToJpegBase64('aGVpYw==', 'heic_temp/user-a/id-mismatch', {
      upload: async () => ({ public_id: 'heic_temp/user-b/other', secure_url: 'https://example.test/b.jpg' }),
      download: async () => jpeg,
      destroy: async (publicId) => destroyed.push(publicId),
    }), /id mismatch/);
    assert.deepEqual(destroyed, ['heic_temp/user-a/id-mismatch']);
  }

  {
    let destroyAttempts = 0;
    const result = await convertHeicToJpegBase64('aGVpYw==', 'heic_temp/user-a/retry-cleanup', {
      upload: async (_dataUri, publicId) => ({ public_id: publicId, secure_url: 'https://example.test/a.jpg' }),
      download: async () => jpeg,
      destroy: async () => {
        destroyAttempts += 1;
        if (destroyAttempts < 3) throw new Error('temporary cleanup failure');
      },
    });
    assert.equal(result.contentType, 'image/jpeg');
    assert.equal(destroyAttempts, 3);
  }

  {
    const highResolutionIphoneMockJpeg = Buffer.alloc(5.5 * 1024 * 1024, 0x7f);
    highResolutionIphoneMockJpeg[0] = 0xff;
    highResolutionIphoneMockJpeg[1] = 0xd8;
    const response = buildConvertHeicResponse(highResolutionIphoneMockJpeg);
    const serializedBytes = Buffer.byteLength(JSON.stringify({ data: response }), 'utf8');
    assert(serializedBytes <= CONVERT_HEIC_MAX_SERIALIZED_RESPONSE_BYTES);
    assert(serializedBytes < 32 * 1024 * 1024, 'duplicated compatibility payload must remain below callable response limit');
    assert.deepEqual(Buffer.from(response.imageBase64, 'base64'), highResolutionIphoneMockJpeg);

    const maximumResponse = buildConvertHeicResponse(Buffer.alloc(CONVERTED_JPEG_MAX_BYTES, 0x5a));
    assert(Buffer.byteLength(JSON.stringify({ data: maximumResponse }), 'utf8') < 32 * 1024 * 1024);
  }

  {
    const now = Date.parse('2026-09-21T00:00:00.000Z');
    const oldCreatedAt = new Date(now - HEIC_TEMP_MAX_AGE_MS - 1).toISOString();
    const freshCreatedAt = new Date(now - HEIC_TEMP_MAX_AGE_MS + 1).toISOString();
    let cleanupAvailable = false;
    const destroyed = [];
    const dependencies = {
      list: async (cursor) => cursor
        ? { resources: [{ public_id: 'heic_temp/user-b/old-b', created_at: oldCreatedAt }] }
        : {
          resources: [
            { public_id: 'heic_temp/user-a/old-a', created_at: oldCreatedAt },
            { public_id: 'heic_temp/user-a/fresh', created_at: freshCreatedAt },
            { public_id: 'haru2026/records/user-a/keep', created_at: oldCreatedAt },
          ],
          next_cursor: 'page-2',
        },
      destroy: async (publicId) => {
        if (!cleanupAvailable) throw new Error('Cloudinary temporarily unavailable');
        destroyed.push(publicId);
      },
    };

    const firstRun = await sweepExpiredHeicTempObjects(now, dependencies);
    assert.deepEqual(firstRun.deleted, []);
    assert.deepEqual(firstRun.failed.sort(), ['heic_temp/user-a/old-a', 'heic_temp/user-b/old-b']);

    cleanupAvailable = true;
    const afterRestart = await sweepExpiredHeicTempObjects(now, dependencies);
    assert.deepEqual(afterRestart.failed, []);
    assert.deepEqual(destroyed.sort(), ['heic_temp/user-a/old-a', 'heic_temp/user-b/old-b']);
  }
}

run().then(() => console.log('HEIC conversion cleanup behavior tests passed'));
