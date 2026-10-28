const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const JSZip = require('jszip');

const uid = 'epub-test-user';
const recordId = '2026-10-28_1793179026602_example';
const records = new Map([
  [recordId, { date: '2026-10-28', formats: ['일기', '에세이'], diary_sayu: '선택한 일기 본문', essay_sayu: '다른 형식 본문' }],
  ['2026-10-28_other', { date: '2026-10-28', formats: ['일기'], diary_sayu: '같은 날 다른 기록' }],
  ['2026-10-27', { date: '2026-10-27', formats: ['일기'], diary_sayu: '이전 날짜 기록' }],
]);
let savedBuffer;
let reads = [];
let plan = 'basic';
const snap = (id) => ({ id, exists: records.has(id), data: () => records.get(id) });
const query = (start, end) => ({
  where: (field, op, value) => query(op === '>=' ? value : start, op === '<=' ? value : end),
  orderBy() { return this; },
  get: async () => ({ docs: [...records.keys()].filter((id) => records.get(id).date >= start && records.get(id).date <= end).map(snap) }),
});
const db = {
  doc(path) {
    if (path.startsWith(`users/${uid}/records/`)) return { id: path.slice(`users/${uid}/records/`.length) };
    assert.equal(path, `users/${uid}/subscription/info`);
    return { get: async () => ({ data: () => ({ plan }) }) };
  },
  getAll: async (...refs) => refs.map((ref) => snap(ref.id)),
  collection(path) {
    assert.equal(path, `users/${uid}/records`);
    return {
      ...query(),
      doc(id) { reads.push(id); return { get: async () => snap(id) }; },
    };
  },
};
// 실제 callable·직렬화·EPUB 생성은 실행하고 Firebase 입출력만 대체한다.
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'firebase-admin') return {
    firestore: () => db,
    storage: () => ({ bucket: () => ({ file: () => ({
      save: async (buffer) => { savedBuffer = buffer; },
      getSignedUrl: async () => ['https://example.invalid/export.epub'],
    }) }) }),
  };
  return originalLoad.call(this, name, ...args);
};
let exportEpub;
try { ({ exportEpub } = require('../lib/epubExport')); } finally { Module._load = originalLoad; }
const run = (data, auth = { uid }) => exportEpub.run({ auth, data });
const request = { startDate: '2026-10-28', endDate: '2026-10-28', format: '일기', singleRecordId: recordId };

test('날짜와 다른 ID로 단건 EPUB을 만들고 같은 날 다른 기록·형식을 제외한다', async () => {
  reads = [];
  const result = await run(request);
  assert.equal(result.count, 1);
  assert.deepEqual(reads, [recordId]);
  assert.equal(result.fileName, 'HARU_일기_2026-10-28_2026-10-28.epub');
  const zip = await JSZip.loadAsync(savedBuffer);
  const html = (await Promise.all(Object.values(zip.files).filter((file) => /\.xhtml$/.test(file.name)).map((file) => file.async('string'))))
    .join('\n').replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
  assert.match(html, /선택한 일기 본문/);
  assert.doesNotMatch(html, /같은 날 다른 기록|다른 형식 본문|이전 날짜 기록/);
});

test('날짜형 기존 ID도 단건으로 내보낸다', async () => {
  const result = await run({ ...request, startDate: '2026-10-27', endDate: '2026-10-27', singleRecordId: '2026-10-27' });
  assert.equal(result.count, 1);
});

test('단건은 선택 형식의 저장 제목을 EPUB 메타데이터·본문·파일명에 반영한다', async () => {
  const record = records.get(recordId);
  records.set(recordId, { ...record, diary_title: '나의 하루 & <기록>: 봄/가을', essay_title: '다른 에세이 제목', title: '공통 제목' });
  try {
    const result = await run(request);
    assert.equal(result.fileName, 'HARU_나의 하루 & _기록__ 봄_가을_2026-10-28.epub');
    const zip = await JSZip.loadAsync(savedBuffer);
    const decode = (text) => text.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const opfFile = Object.values(zip.files).find((file) => /\.opf$/.test(file.name));
    const opf = decode(await opfFile.async('string'));
    assert.ok(opf.includes('<dc:title>나의 하루 & <기록>: 봄/가을</dc:title>'));
    const html = decode((await Promise.all(Object.values(zip.files).filter((file) => /\.xhtml$/.test(file.name)).map((file) => file.async('string')))).join('\n'));
    assert.ok(html.includes('<h2>나의 하루 & <기록>: 봄/가을</h2>'));
    assert.doesNotMatch(html, /공통 제목|다른 에세이 제목/);
    const { singleRecordId, ...rangeRequest } = request;
    assert.equal((await run(rangeRequest)).fileName, 'HARU_일기_2026-10-28_2026-10-28.epub');
  } finally { records.set(recordId, record); }
});

test('형식 제목이 비면 공통·AI 제목을 쓰고 긴 파일명은 제한한다', async () => {
  const record = records.get(recordId);
  try {
    records.set(recordId, { ...record, diary_title: '  ', title: ' 공통 제목 ', ai_title: 'AI 제목' });
    assert.equal((await run(request)).fileName, 'HARU_공통 제목_2026-10-28.epub');
    records.set(recordId, { ...record, ai_title: 'AI 제목' });
    assert.equal((await run(request)).fileName, 'HARU_AI 제목_2026-10-28.epub');
    records.set(recordId, { ...record, diary_title: '가'.repeat(200) });
    assert.equal((await run(request)).fileName, `HARU_${'가'.repeat(40)}_2026-10-28.epub`);
  } finally { records.set(recordId, record); }
});

test('단건 ID가 없는 기간별 요청은 같은 날 기록을 모두 내보낸다', async () => {
  const { singleRecordId, ...rangeRequest } = request;
  assert.equal((await run(rangeRequest)).count, 2);
});

test('기존 합본 recordIds 요청도 같은 순서로 내보낸다', async () => {
  const { singleRecordId, ...rangeRequest } = request;
  assert.equal((await run({ ...rangeRequest, recordIds: ['2026-10-28_other', recordId] })).count, 2);
});

test('삭제된 기록·잘못된 ID·단건과 합본의 혼합 요청을 거절한다', async () => {
  await assert.rejects(run({ ...request, singleRecordId: 'missing' }), { code: 'not-found' });
  for (const singleRecordId of ['', 'a/b', null, 123, 'x'.repeat(201)]) {
    await assert.rejects(run({ ...request, singleRecordId }), { code: 'invalid-argument' });
  }
  await assert.rejects(run({ ...request, recordIds: [recordId] }), { code: 'invalid-argument' });
});

test('단건도 로그인·유료 구독 검사를 통과해야 한다', async () => {
  await assert.rejects(run(request, null), { code: 'unauthenticated' });
  plan = 'free';
  try { await assert.rejects(run(request), { code: 'permission-denied' }); } finally { plan = 'basic'; }
});
