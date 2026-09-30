import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host?.startsWith('127.0.0.1:') && !host?.startsWith('localhost:')) {
  throw new Error('로컬 Firestore emulator에서만 실행할 수 있습니다.');
}

const [emulatorHost, emulatorPort] = host.split(':');
const here = path.dirname(fileURLToPath(import.meta.url));
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-haru-ai-library-access',
    firestore: {
      host: emulatorHost,
      port: Number(emulatorPort),
      rules: fs.readFileSync(path.resolve(here, '../../firestore.rules'), 'utf8'),
    },
  });
});

after(async () => env?.cleanup());

test('일반 사용자는 일반 기록 CRUD를 유지하지만 ai_log 생성은 거부된다', async () => {
  const db = env.authenticatedContext('ordinary', { email: 'ordinary@example.com' }).firestore();
  const normal = doc(db, 'users/ordinary/records/2026-09-30');
  await assertSucceeds(setDoc(normal, { type: 'diary', content: '일반 기록' }));
  await assertSucceeds(getDoc(normal));
  await assertSucceeds(updateDoc(normal, { content: '수정' }));
  await assertSucceeds(deleteDoc(normal));

  const aiLog = doc(db, 'users/ordinary/records/ai_test');
  await assertFails(setDoc(aiLog, { type: 'ai_log', content: '차단 대상' }));
});

test('허용 이메일의 본인 계정만 ai_log 쓰기와 삭제가 가능하다', async () => {
  const developerDb = env.authenticatedContext('developer', { email: 'hkd620@gmail.com' }).firestore();
  const ref = doc(developerDb, 'users/developer/records/ai_test');
  await assertSucceeds(setDoc(ref, { type: 'ai_log', content: '허용' }));
  await assertSucceeds(updateDoc(ref, { content: '수정 허용' }));
  await assertSucceeds(deleteDoc(ref));

  const otherOwnerRef = doc(developerDb, 'users/ordinary/records/ai_test');
  await assertFails(setDoc(otherOwnerRef, { type: 'ai_log', content: '타인 경로' }));
});

test('일반 사용자는 기존 ai_log를 수정·삭제할 수 없다', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/ordinary/records/legacy_ai'), {
      type: 'ai_log', content: '기존 자료',
    });
  });
  const db = env.authenticatedContext('ordinary', { email: 'ordinary@example.com' }).firestore();
  const ref = doc(db, 'users/ordinary/records/legacy_ai');
  await assertFails(updateDoc(ref, { content: '변조' }));
  await assertFails(deleteDoc(ref));
});

test('현재 단일 records 컬렉션 규칙에서는 일반 기록 조회를 유지하면 기존 ai_log 단건 읽기도 허용된다', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/ordinary/records/legacy_ai_read'), {
      type: 'ai_log', content: '기존 자료',
    });
  });
  const db = env.authenticatedContext('ordinary', { email: 'ordinary@example.com' }).firestore();
  await assertSucceeds(getDoc(doc(db, 'users/ordinary/records/legacy_ai_read')));
});
