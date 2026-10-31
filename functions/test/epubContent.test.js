// EPUB 본문·사진 규칙(2026-10-23) — 합본 조건 재확인, 그 형식 사진만 최대 5장, 내려받기 실패 사진 제외.
// 실행: npm run build && node --test test/epubContent.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const epub = require('../lib/epubContent.js');

const range = { startDate: '2026-10-01', endDate: '2026-10-31' };

test('사진: 요청 형식의 _images 우선, 없으면 _imageMeta, 중복 제거, 최대 5장, 다른 형식 사진은 섞지 않는다', () => {
  const urls = Array.from({ length: 7 }, (_, i) => `https://p/${i}.jpg`);
  const record = {
    diary_images: JSON.stringify([urls[0], urls[0], ...urls.slice(1)]),
    essay_images: JSON.stringify(['https://p/essay.jpg']),
  };
  assert.deepEqual(epub.getRecordPhotoUrls(record, 'diary'), urls.slice(0, 5));
  assert.deepEqual(epub.getRecordPhotoUrls({ diary_imageMeta: JSON.stringify([{ url: urls[6] }]) }, 'diary'), [urls[6]]);
  assert.deepEqual(epub.getRecordPhotoUrls(record, 'memo'), []);
});

test('합본 조건: 기간·비서 아님·SAYU 완료·특별한 날(specialDays 또는 옛 숫자 _rating)', () => {
  const base = { date: '2026-10-05', diary_sayu: 'SAYU 글' };
  assert.equal(epub.isEligibleMergeRecord(base, 'diary', range), true);
  assert.equal(epub.isEligibleMergeRecord({ ...base, diary_sayu: ' ' }, 'diary', range), false);
  assert.equal(epub.isEligibleMergeRecord({ ...base, date: '2026-11-01' }, 'diary', range), false);
  assert.equal(epub.isEligibleMergeRecord({ ...base, source: 'result_ai_chat' }, 'diary', range), false);
  assert.equal(epub.isEligibleMergeRecord(base, 'diary', { ...range, filter: 'special' }), false);
  assert.equal(epub.isEligibleMergeRecord({ ...base, specialDays: { diary: true } }, 'diary', { ...range, filter: 'special' }), true);
  assert.equal(epub.isEligibleMergeRecord({ ...base, diary_rating: 1 }, 'diary', { ...range, filter: 'special' }), true);
  assert.equal(epub.isEligibleMergeRecord({ ...base, work_rating: '★★★' }, 'work', { ...range, filter: 'special' }), false);
});

test('기록 ID 검증: 비거나 너무 많거나 경로 문자가 있으면 거절', () => {
  assert.equal(epub.validateRecordIds(undefined), null);
  assert.deepEqual(epub.validateRecordIds([]), []);
  assert.deepEqual(epub.validateRecordIds(['a/b']), []);
  assert.deepEqual(epub.validateRecordIds(Array.from({ length: 501 }, (_, i) => `r${i}`)), []);
  assert.deepEqual(epub.validateRecordIds(['a', 'b', 'a']), ['a', 'b']);
});

test('대상 형식: 선교·일반보고 포함, 보조장부·주식 제외', () => {
  assert.equal(epub.isMergeRecordFormat('선교보고'), true);
  assert.equal(epub.isMergeRecordFormat('HARU보조장부'), false);
  assert.equal(epub.isMergeRecordFormat('주식거래일지'), false);
});

test('합본 장: 요청 형식의 SAYU 글을 쓰고 HTML 을 이스케이프한다(같은 날 다른 형식 본문을 넣지 않음)', () => {
  const html = epub.mergeRecordToHtml({ diary_sayu: '일기 <b>본문</b>\n둘째 줄', essay_sayu: '에세이', essay_title: '에세이 제목' }, 'diary', []);
  assert.match(html, /일기 &lt;b&gt;본문&lt;\/b&gt;<br\/>둘째 줄/);
  assert.doesNotMatch(html, /에세이/);
});

test('사진 준비: 받지 못한 사진만 빼고 개수를 세며, 파일당 상한을 넘는 사진도 따로 센다', async () => {
  const chapters = [['https://ok/1', 'https://bad/2'], ['https://ok/3', 'https://ok/4']];
  const fetchPhoto = async (url) => (url.includes('bad') ? null : `file:///tmp/${url.slice(-1)}.jpg`);
  const result = await epub.preparePhotos(chapters, fetchPhoto, { maxTotal: 3 });
  assert.deepEqual(result.srcByChapter, [['file:///tmp/1.jpg', null], ['file:///tmp/3.jpg', null]]);
  assert.equal(result.failed, 1);
  assert.equal(result.overLimit, 1);
  const thrown = await epub.preparePhotos([['https://x/1']], async () => { throw new Error('net'); });
  assert.deepEqual(thrown.srcByChapter, [[null]]);
  assert.equal(thrown.failed, 1);
  assert.equal(thrown.overLimit, 0);
});

test('실제 EPUB: HEAD 200·GET 503 사진은 빈 이미지로 남지 않고 누락으로 세며, 받은 사진만 들어간다', async () => {
  const http = require('node:http');
  const os = require('node:os');
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const Epub = require('epub-gen-memory').default;
  const JSZip = require('jszip');
  // 1x1 PNG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const server = http.createServer((req, res) => {
    if (req.url === '/ok.png') { res.writeHead(200, { 'content-type': 'image/png' }); res.end(req.method === 'HEAD' ? undefined : png); return; }
    if (req.url === '/head-only.png') { res.writeHead(req.method === 'HEAD' ? 200 : 503, { 'content-type': 'image/png' }); res.end(); return; }
    res.writeHead(404); res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-test-'));
  try {
    const { srcByChapter, failed } = await epub.preparePhotos([[`${base}/ok.png`, `${base}/head-only.png`]], epub.createTempPhotoFetcher(dir));
    assert.equal(failed, 1);
    assert.equal(srcByChapter[0].filter(Boolean).length, 1);
    const content = ['<p>본문</p>', ...srcByChapter[0].filter(Boolean).map((src) => `<img src="${epub.escapeHtml(src)}">`)].join('\n');
    const buffer = await Epub({ title: 't', author: 'a', lang: 'ko', ignoreFailedDownloads: true, verbose: false }, [{ title: 'c', content }]);
    const zip = await JSZip.loadAsync(buffer);
    const images = Object.values(zip.files).filter((file) => file.name.startsWith('OEBPS/images/') && !file.dir);
    assert.equal(images.length, 1);
    const data = await images[0].async('nodebuffer');
    assert.ok(data.length > 0);
  } finally {
    server.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('사진 내려받기 전체 시간 예산이 지나면 남은 사진은 받지 않고 누락으로 센다(Codex 실행 6)', async () => {
  const urls = Array.from({ length: 6 }, (_, i) => `https://slow/${i}`);
  const calls = [];
  const fetchPhoto = async (url) => { calls.push(url); await new Promise((resolve) => setTimeout(resolve, 30)); return `file:///tmp/${url.slice(-1)}.jpg`; };
  const result = await epub.preparePhotos([urls], fetchPhoto, { concurrency: 2, budgetMs: 40 });
  assert.ok(calls.length < urls.length, `calls=${calls.length}`);
  assert.equal(result.failed, urls.length - calls.length);
  assert.equal(result.srcByChapter[0].filter(Boolean).length, calls.length);
});
