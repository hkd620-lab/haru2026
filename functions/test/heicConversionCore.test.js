const assert = require('node:assert/strict');
const { convertHeicToJpegBase64 } = require('../src/heicConversionCore.ts');

async function run() {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  {
    const destroyed = [];
    const result = await convertHeicToJpegBase64('aGVpYw==', 'heic_temp/user-a/success', {
      upload: async (_dataUri, publicId) => ({ public_id: publicId, secure_url: 'https://example.test/a.jpg' }),
      download: async () => jpeg,
      destroy: async (publicId) => destroyed.push(publicId),
    });
    assert.equal(result.contentType, 'image/jpeg');
    assert.deepEqual(Buffer.from(result.imageBase64, 'base64'), jpeg);
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
}

run().then(() => console.log('HEIC conversion cleanup behavior tests passed'));
