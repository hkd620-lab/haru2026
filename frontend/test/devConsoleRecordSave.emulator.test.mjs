// FIRESTORE_EMULATOR_HOST=127.0.0.1:18879 node --import tsx --test test/devConsoleRecordSave.emulator.test.mjs
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer } from 'firebase/firestore';
import { buildDraftEditorData } from '../src/app/records/writeBeforeFormat.ts';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw Error('로컬 Firestore 에뮬레이터에서만 실행합니다.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectId = 'demo-haru-dev-console';
const uid = `record-save-${crypto.randomUUID()}`;
const app = initializeApp({ projectId, apiKey: 'emulator-only' });
const db = getFirestore(app);
const [hostname, port] = host.split(':');
connectFirestoreEmulator(db, hostname, Number(port), { mockUserToken: { sub: uid, email_verified: true, email: 'test@example.test' } });
const output = path.join(root, 'test', `.record-save-${crypto.randomUUID()}.mjs`);
await build({
  entryPoints: [path.join(root, 'src/app/services/firestoreService.ts')], outfile: output,
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'local-only-firebase', setup(builder) {
    builder.onResolve({ filter: /firebase$/ }, args => {
      if (args.path.startsWith('.') && path.resolve(args.resolveDir, args.path) === path.join(root, 'src/firebase')) return { path: 'local-firebase', namespace: 'test-only' };
    });
    // 실제 Firestore SDK/Rules를 사용하며, 사용 로그용 callable만 auth=null로 미호출.
    builder.onLoad({ filter: /.*/, namespace: 'test-only' }, () => ({ contents: "import {getFirestore} from 'firebase/firestore'; export const db=getFirestore(); export const auth={currentUser:null};", resolveDir: root }));
  } }],
});
const { firestoreService } = await import(pathToFileURL(output).href);
after(async () => { await deleteApp(app); fs.unlinkSync(output); });

for (const [format, prefix, field] of [['선교보고','mission','mission_space'], ['일반보고','report','report_space'], ['주식거래일지','stock','stock_reflection']]) {
  test(`${format}: 일반 계정 저장→서버 재읽기→수정→기존 기록 재열기`, async () => {
    const id = `2026-11-02_${prefix}_${crypto.randomUUID()}`;
    const draft = buildDraftEditorData(format, '로컬 검증 원문', '2026-11-02', id);
    const fields = Object.fromEntries(Object.entries(draft).filter(([key]) => !key.startsWith('_')));
    const savedId = await firestoreService.saveRecord(uid, { id, date: '2026-11-02', formats: [format], ...fields, [`${prefix}_title`]: '로컬 검증', ...(prefix === 'stock' ? { stock_name: '시험종목' } : {}) });
    assert.equal(savedId, id);
    const server = (await getDocFromServer(doc(db, 'users', uid, 'records', id))).data();
    assert.equal(server[field], '로컬 검증 원문');
    assert.equal((await firestoreService.getRecord(uid, id))[field], '로컬 검증 원문');
    await firestoreService.updateRecord(uid, id, { [field]: '수정한 원문' });
    const reopened = await firestoreService.getRecord(uid, id);
    assert.equal(reopened[field], '수정한 원문');
    assert.deepEqual(reopened.formats, [format]);
    if (prefix === 'stock') assert.equal(reopened.stock_simple, undefined);
  });
}

test('기존 주식 식별자와 다른 형식 필드를 유지한 채 수정·조회', async () => {
  const id = `legacy-${crypto.randomUUID()}`;
  await setDoc(doc(db, 'users', uid, 'records', id), {
    date: '2026-10-01', formats: ['HARU주식관리', '일기'], stock_name: '기존시험종목', stock_reflection: '기존 소감', diary_sayu: '보존할 일기',
  });
  await firestoreService.updateRecord(uid, id, { stock_reflection: '수정 소감' });
  const server = (await getDocFromServer(doc(db, 'users', uid, 'records', id))).data();
  assert.equal(server.diary_sayu, '보존할 일기');
  assert.deepEqual(server.formats, ['HARU주식관리', '일기']);
  assert.equal((await firestoreService.getRecord(uid, id)).stock_reflection, '수정 소감');
  assert.ok((await firestoreService.getRecords(uid)).some(record => record.id === id));
});

test('다른 일반 사용자의 기록 조회는 기존 Rules가 차단', async () => {
  await assert.rejects(firestoreService.getRecord(`${uid}-other`, 'not-owned'), error => error.code === 'permission-denied');
});

test('사용자가 자신의 OCR 월간 카운터를 직접 초기화할 수 없다', async () => {
  await assert.rejects(setDoc(doc(db, 'users', uid, 'monthlyAiUsage', '2026-11'), { byFeature: { stock_ocr: 0 } }), error => error.code === 'permission-denied');
});
