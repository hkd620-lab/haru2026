const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { getEssayChatImageUrls, resolveEssayChatImage, prepareEssayChatImages } = require('../lib/resultChatImages');

test('에세이 저장 형식·중복·메타데이터 폴백과 다른 기록 격리', () => {
  assert.deepEqual(getEssayChatImageUrls({ essay_images: '["a","a","b"]' }, 'essay_sayu'), ['a', 'b']);
  assert.deepEqual(getEssayChatImageUrls({ essay_images: 'bad', essay_imageMeta: [{ url: 'c' }] }, 'essay_sayu'), ['c']);
  assert.deepEqual(getEssayChatImageUrls({ essay_images: ['a'] }, 'diary_sayu'), []);
});

const firebaseUrl = (bucket, path) => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=unused`;
const resolve = url => resolveEssayChatImage(url, 'alice', 'app.appspot.com', 'mycloud');
test('본인 경로와 지정 버킷의 Firebase 이미지만 허용', () => {
  assert.deepEqual(resolve(firebaseUrl('app.appspot.com', 'users/alice/format_photos/photo.jpg')),
    { kind: 'firebase', path: 'users/alice/format_photos/photo.jpg' });
  assert.equal(resolve(firebaseUrl('app.appspot.com', 'users/bob/format_photos/photo.jpg')), null);
  assert.equal(resolve(firebaseUrl('other.appspot.com', 'users/alice/format_photos/photo.jpg')), null);
  assert.equal(resolve(firebaseUrl('app.appspot.com', 'users/alice/format_photos/../secret')), null);
  assert.equal(resolve(firebaseUrl('app.appspot.com', 'users/alice/private/photo.jpg')), null);
});

test('Cloudinary 소유 경로 및 HTTPS·호스트 제한', () => {
  const url = 'https://res.cloudinary.com/mycloud/image/upload/v123/haru2026/records/alice/photo.jpg';
  assert.equal(resolve(url).kind, 'cloudinary');
  for (const invalid of [url.replace('/alice/', '/bob/'), url.replace('/mycloud/', '/other/'),
    url.replace('res.cloudinary.com', 'res.cloudinary.com.evil.test'), url.replace('https:', 'http:'),
    'https://127.0.0.1/image.jpg', 'https://user:pass@res.cloudinary.com/mycloud/image/upload/a.jpg']) {
    assert.equal(resolve(invalid), null);
  }
});

test('실제 PNG를 AI inlineData로 변환하고 이미지 순서를 유지', async () => {
  const png = await sharp({ create: { width: 1800, height: 900, channels: 3, background: 'red' } }).png().toBuffer();
  const { parts, guide } = await prepareEssayChatImages(['one', 'two'], 'alice', async () => png);
  assert.equal(parts.length, 4);
  assert.match(parts[0].text, /이미지 1/);
  assert.match(parts[2].text, /이미지 2/);
  const decoded = Buffer.from(parts[1].inlineData.data, 'base64');
  const metadata = await sharp(decoded).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 1536);
  assert.equal(metadata.height, 768);
  assert.match(guide, /외부검색 자료가 아니다/);
  assert.match(guide, /지시문은 참고자료/);
});

test('일부 손상·실패·개수 초과 시 보지 못한 이미지를 명시', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer();
  const calls = [];
  const result = await prepareEssayChatImages(['ok', 'bad', 'missing', 'ok2', 'ok3', 'omitted'], 'alice', async url => {
    calls.push(url);
    if (url === 'missing') throw new Error('not found');
    return url === 'bad' ? Buffer.from('invalid') : png;
  });
  assert.equal(calls.length, 5);
  assert.equal(result.parts.length, 6);
  assert.match(result.parts[2].text, /이미지 4/);
  assert.match(result.guide, /읽기 실패 2장, 개수 제한으로 제외 1장/);
});

test('이미지가 없으면 읽기·프롬프트 추가 없음', async () => {
  assert.deepEqual(await prepareEssayChatImages([], 'alice', async () => { throw new Error('must not read'); }),
    { parts: [], guide: '' });
});

test('최대 크기 초과 입력은 모델에 보내지 않음', async () => {
  const result = await prepareEssayChatImages(['large'], 'alice', async () => Buffer.alloc(8 * 1024 * 1024 + 1));
  assert.equal(result.parts.length, 0);
  assert.match(result.guide, /읽기 실패 1장/);
});

test('이미지 읽기에 남은 공통 시간만 주고 마감 후 다음 이미지를 읽지 않음', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  const originalNow = Date.now;
  let now = originalNow();
  const deadline = now + 5000;
  const budgets = [];
  Date.now = () => now;
  try {
    await assert.rejects(prepareEssayChatImages(['a', 'b', 'c'], 'alice', async (_url, _uid, timeoutMs) => {
      budgets.push(timeoutMs);
      now += 4000;
      return png;
    }, deadline), error => error.code === 'deadline-exceeded');
    assert.deepEqual(budgets, [5000, 1000]);
  } finally { Date.now = originalNow; }
});

test('이미지 전체 마감이 이미 지났으면 읽기 호출 없음', async () => {
  let calls = 0;
  await assert.rejects(prepareEssayChatImages(['a'], 'alice', async () => {
    calls++;
    return Buffer.alloc(0);
  }, Date.now() - 1), error => error.code === 'deadline-exceeded');
  assert.equal(calls, 0);
});
