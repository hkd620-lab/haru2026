// FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdEdit.emulator.test.mjs
// 실제 Firestore SDK + 저장소의 기존 firestore.rules 로컬 에뮬레이터. 합성 자료만 사용한다.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer } from 'firebase/firestore';
import { saveHouseholdEntries, saveHouseholdOriginal, loadHouseholdRecords, householdSayuText, HouseholdOriginalConflict } from '../src/app/services/householdSaveService.ts';
import { checkHouseholdDuplicates, HouseholdDuplicateReviewRequired } from '../src/app/services/householdDuplicates.ts';
import { updateHouseholdEntries, HouseholdEditConflict } from '../src/app/services/householdEditService.ts';
import { loadHouseholdCategories, updateHouseholdCategories, mergeHouseholdCategories, householdCategoryOptions } from '../src/app/services/householdCategories.ts';
import { loadHouseholdVendorRules, updateHouseholdVendorRules, upsertHouseholdVendorRule } from '../src/app/services/householdVendorRules.ts';
import { readHouseholdDashboard } from '../src/app/utils/householdDashboard.ts';
import { parseKakaoBankWorkbook } from '../src/app/services/householdKakaoImport.ts';
import { buildHouseholdCashEntry, newHouseholdCashDraft } from '../src/app/components/HouseholdCashEntry.tsx';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('로컬 Firestore 에뮬레이터에서만 실행할 수 있습니다.');
const projectId = 'demo-haru-household-dedup', apps = [];
const runId = crypto.randomUUID().slice(0, 8);
const uidFor = name => `${name}-${runId}`;
function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'emulator-only' }, `household-edit-${uid}-${apps.length}`);
  apps.push(app);
  const db = getFirestore(app);
  const [hostname, port] = host.split(':');
  connectFirestoreEmulator(db, hostname, Number(port), { mockUserToken: { sub: uid, email: `${uid}@example.test`, email_verified: true } });
  return db;
}
after(async () => { await Promise.all(apps.map(deleteApp)); });

const pad = n => String(n).padStart(2, '0');
const recordsOf = async (db, uid) => (await loadHouseholdRecords(db, uid)).map(r => ({ id: r.id, ...r.data }));
const dashboardOf = async (db, uid) => readHouseholdDashboard(await recordsOf(db, uid)).entries;
const snapshotAll = async (db, uid) => Object.fromEntries((await loadHouseholdRecords(db, uid)).map(r => [r.id, r.data]));

// 합성 529건: 월별 배열 문서 12개(527건, 메모·은행 원본 키·잔액·다른 형식 필드 포함) + 예전 단건 문서 2개.
async function seed529(db, uid) {
  for (let m = 1; m <= 12; m++) {
    const count = m <= 11 ? 44 : 527 - 44 * 11;
    const entries = Array.from({ length: count }, (_, i) => {
      const bank = i % 5 === 0;
      const id = bank ? `kakao:fx-${m}-${i}` : `e-${m}-${i}`;
      return {
        id, date: `2026-${pad(m)}-${pad((i % 28) + 1)}`, transactionType: i % 7 === 0 ? '이체' : i % 4 === 0 ? '수입' : '지출',
        category: i % 7 === 0 ? '이체' : i % 4 === 0 ? '기타수입' : ['식비', '교통비', '기타', '쇼핑'][i % 4], vendor: `합성 거래처 ${i % 9}`,
        amount: String(1000 + m * 100 + i), paymentMethod: bank ? '체크카드' : '현금', memo: i % 3 === 0 ? `메모 ${m}-${i}\n둘째 줄` : '',
        ...(bank ? { importSource: { kind: 'kakao', fileDigest: `fx-${m}`, key: id }, balanceAfter: String(50000 + i), transactionAt: `2026-${pad(m)}-${pad((i % 28) + 1)} 12:00:00` } : {}),
      };
    });
    await setDoc(doc(db, 'users', uid, 'records', `2026-${pad(m)}-01_household`), {
      date: `2026-${pad(m)}-01`, formats: ['HARU가계부', '메모'], household_entries: JSON.stringify(entries),
      // 짝수 달은 저장 서비스가 만든 본문, 홀수 달은 사용자가 직접 고친 본문.
      household_sayu: m % 2 === 0 ? householdSayuText(entries) : `사용자가 직접 쓴 ${m}월 본문`,
      household_memo: entries[0].memo, household_category: entries[0].category, household_importKeys: [`skip-key-${m}`],
      household_title: `2026-${pad(m)} 가계부`, memo_sayu: '다른 형식 본문은 그대로',
    });
  }
  for (const day of ['2025-12-24', '2025-12-25']) {
    await setDoc(doc(db, 'users', uid, 'records', day), {
      date: day, household_type: '지출', household_category: '기타', household_vendor: '예전 가게', household_amount: '3000',
      household_payment: '현금', household_memo: `예전 메모 ${day}`, household_date: day, household_sayu: '예전 단건 본문',
    });
  }
}

test('합성 529건 중 30건 일괄 분류: 전체 529건·메모·원본 키·다른 필드 보존, 대상은 분류만 바뀜', async () => {
  const uid = uidFor('bulk529'), db = client(uid);
  await seed529(db, uid);
  const before = await snapshotAll(db, uid);
  const entries = await dashboardOf(db, uid);
  assert.equal(entries.length, 529);
  const targets = entries.filter(e => e.locator).filter((_, i) => i % 17 === 0).slice(0, 30);
  assert.equal(targets.length, 30);
  const result = await updateHouseholdEntries(db, uid, targets.map(e => ({ locator: e.locator, patch: { category: '교통비', subcategory: '버스' } })));
  assert.equal(result.updated, 30);
  const afterAll = await snapshotAll(db, uid);
  const afterEntries = await dashboardOf(db, uid);
  assert.equal(afterEntries.length, 529);
  assert.deepEqual(afterEntries.map(e => [e.date, e.amount, e.vendor, e.memo, e.transactionType]), entries.map(e => [e.date, e.amount, e.vendor, e.memo, e.transactionType]));
  const targetKeys = new Set(targets.map(e => `${e.locator.recordId}#${e.locator.rawIndex}`));
  for (const [id, data] of Object.entries(before)) {
    const now = afterAll[id];
    for (const key of Object.keys(data)) {
      if (['household_entries', 'updatedAt', 'household_sayu', 'household_category'].includes(key)) continue;
      assert.deepEqual(now[key], data[key], `${id}.${key}`);
    }
    if (typeof data.household_entries !== 'string') continue;
    const oldRaw = JSON.parse(data.household_entries), newRaw = JSON.parse(now.household_entries);
    assert.equal(newRaw.length, oldRaw.length);
    oldRaw.forEach((entry, index) => {
      if (!targetKeys.has(`${id}#${index}`)) return assert.deepEqual(newRaw[index], entry);
      assert.deepEqual(newRaw[index], { ...entry, category: '교통비', subcategory: '버스', categorySource: 'user' });
    });
    // 분류만 바뀌면 자동 본문도 같은 문자열이고, 사용자 본문은 그대로다.
    assert.equal(now.household_sayu, data.household_sayu);
  }
});

test('메모 편집: 자동 생성 본문은 현재 거래로 다시 만들고, 사용자 본문은 고치지 않는다', async () => {
  const uid = uidFor('sayu'), db = client(uid);
  await seed529(db, uid);
  const entries = await dashboardOf(db, uid);
  const feb = entries.find(e => e.locator?.recordId === '2026-02-01_household' && e.locator.rawIndex === 0);
  const mar = entries.find(e => e.locator?.recordId === '2026-03-01_household' && e.locator.rawIndex === 0);
  const before = await snapshotAll(db, uid);
  await updateHouseholdEntries(db, uid, [{ locator: feb.locator, patch: { memo: '새 메모 2월' } }, { locator: mar.locator, patch: { memo: '새 메모 3월' } }]);
  const now = await snapshotAll(db, uid);
  const febRaw = JSON.parse(now['2026-02-01_household'].household_entries);
  assert.equal(now['2026-02-01_household'].household_sayu, householdSayuText(febRaw));
  assert.match(now['2026-02-01_household'].household_sayu, /새 메모 2월/);
  assert.doesNotMatch(now['2026-02-01_household'].household_sayu, /메모 2-0\n/);
  assert.equal(now['2026-03-01_household'].household_sayu, '사용자가 직접 쓴 3월 본문');
  // 첫 거래 복사본인 상위 메모는 복사본 그대로였을 때만 맞춘다.
  assert.equal(now['2026-02-01_household'].household_memo, '새 메모 2월');
  assert.equal(now['2026-03-01_household'].household_memo, '새 메모 3월');
  assert.equal(now['2026-03-01_household'].memo_sayu, before['2026-03-01_household'].memo_sayu);
  // 상위 메모가 첫 거래와 다른 문서는 상위 메모를 건드리지 않는다.
  const ref = doc(db, 'users', uid, 'records', '2026-04-01_household');
  await setDoc(ref, { household_memo: '사용자가 따로 쓴 상위 메모' }, { merge: true });
  const apr = (await dashboardOf(db, uid)).find(e => e.locator?.recordId === '2026-04-01_household' && e.locator.rawIndex === 0);
  await updateHouseholdEntries(db, uid, [{ locator: apr.locator, patch: { memo: '4월 새 메모' } }]);
  assert.equal((await getDocFromServer(ref)).data().household_memo, '사용자가 따로 쓴 상위 메모');
});

test('같은 거래 동시 수정은 하나만 반영하고, 수정과 같은 달 추가가 겹치면 둘 다 남는다', async () => {
  const uid = uidFor('concurrent'), dbA = client(uid), dbB = client(uid);
  await seed529(dbA, uid);
  const entries = await dashboardOf(dbA, uid);
  const target = entries.find(e => e.locator?.recordId === '2026-06-01_household' && e.locator.rawIndex === 2);
  const results = await Promise.allSettled([
    updateHouseholdEntries(dbA, uid, [{ locator: target.locator, patch: { memo: 'A 기기' } }]),
    updateHouseholdEntries(dbB, uid, [{ locator: target.locator, patch: { memo: 'B 기기' } }]),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(results.find(r => r.status === 'rejected').reason instanceof HouseholdEditConflict);
  const winner = results.findIndex(r => r.status === 'fulfilled') === 0 ? 'A 기기' : 'B 기기';
  const ref = doc(dbA, 'users', uid, 'records', '2026-06-01_household');
  assert.equal(JSON.parse((await getDocFromServer(ref)).data().household_entries)[2].memo, winner);

  const other = (await dashboardOf(dbA, uid)).find(e => e.locator?.recordId === '2026-06-01_household' && e.locator.rawIndex === 4);
  const added = { id: `cash-${runId}`, date: '2026-06-20', transactionType: '지출', category: '식비', vendor: '동시 추가', amount: '98765', paymentMethod: '현금', memo: '' };
  const [edit, save] = await Promise.all([
    updateHouseholdEntries(dbA, uid, [{ locator: other.locator, patch: { category: '의료비' } }]),
    saveHouseholdEntries(dbB, uid, [added]),
  ]);
  assert.equal(edit.updated, 1);
  assert.equal(save.added, 1);
  const raw = JSON.parse((await getDocFromServer(ref)).data().household_entries);
  assert.equal(raw.length, 44 + 1);
  assert.equal(raw[4].category, '의료비');
  assert.deepEqual(raw.at(-1), added);
  // 짝수 달 자동 본문은 추가·수정이 겹쳐도 현재 거래 전체와 같다.
  assert.equal((await getDocFromServer(ref)).data().household_sayu, householdSayuText(raw));
  assert.equal((await dashboardOf(dbA, uid)).length, 530);
});

test('수정 후 같은 은행 파일을 다시 가져와도 이미 저장됨으로 제외하고 고친 분류·메모를 유지한다', async () => {
  const uid = uidFor('reimport'), db = client(uid);
  const row = (time, vendor, amount) => ['', time, '출금', amount, '100000', '체크카드결제', vendor, ''];
  const rows = [row('2026.10.05 12:00:00', '합성 식당', '4,500'), row('2026.10.05 12:00:00', '합성 식당', '4,500'), row('2026.10.07 09:00:00', '합성 버스', '1,500')];
  const parse = () => parseKakaoBankWorkbook({ SheetNames: ['내역'], Sheets: { 내역: rows } }, { utils: { sheet_to_json: s => s } }, '합성.xlsx');
  const first = await parse();
  assert.equal((await saveHouseholdEntries(db, uid, first.rows.map(r => r.entry))).added, 3);
  const target = (await dashboardOf(db, uid))[1];
  await updateHouseholdEntries(db, uid, [{ locator: target.locator, patch: { category: '식비', subcategory: '점심', memo: '동료와 점심' } }]);
  const before = await snapshotAll(db, uid);
  const again = await parse();
  const checks = await checkHouseholdDuplicates(again.rows.map(r => r.entry), await loadHouseholdRecords(db, uid));
  assert.deepEqual(checks.map(c => c.status), ['already', 'already', 'already']);
  const result = await saveHouseholdEntries(db, uid, again.rows.map(r => r.entry));
  assert.equal(result.added, 0);
  assert.equal(result.already, 3);
  assert.deepEqual(await snapshotAll(db, uid), before);
  const saved = JSON.parse(before['2026-10-01_household'].household_entries)[1];
  assert.deepEqual([saved.category, saved.subcategory, saved.memo, saved.categorySource, saved.importSource.key], ['식비', '점심', '동료와 점심', 'user', again.rows[1].entry.importSource.key]);
});

test('응답 유실 후 같은 수정을 다시 보내면 이미 반영된 것으로 처리하고 다시 쓰지 않는다', async () => {
  const uid = uidFor('retry-edit'), db = client(uid);
  await saveHouseholdEntries(db, uid, [{ id: 'r1', date: '2026-10-05', transactionType: '지출', category: '기타', vendor: '가게', amount: '1000', paymentMethod: '현금', memo: '' }]);
  const [entry] = await dashboardOf(db, uid);
  const edit = [{ locator: entry.locator, patch: { category: '식비', memo: '다시 보냄' } }];
  assert.equal((await updateHouseholdEntries(db, uid, edit)).updated, 1);
  const before = await snapshotAll(db, uid);
  const retry = await updateHouseholdEntries(db, uid, edit);
  assert.deepEqual([retry.updated, retry.unchanged], [0, 1]);
  assert.deepEqual(await snapshotAll(db, uid), before);
  // 열 때 내용과도, 같은 수정 결과와도 다르면 충돌이다.
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: entry.locator, patch: { memo: '다른 수정' } }]), HouseholdEditConflict);
  assert.deepEqual(await snapshotAll(db, uid), before);
});

test('편집기를 연 뒤 거래가 수정되면 SAYU 원본 저장은 충돌로 멈춘다', async () => {
  const uid = uidFor('original'), db = client(uid);
  await saveHouseholdEntries(db, uid, [{ id: 'o1', date: '2026-10-05', transactionType: '지출', category: '기타', vendor: '가게', amount: '1000', paymentMethod: '현금', memo: '처음' }]);
  const ref = doc(db, 'users', uid, 'records', '2026-10-01_household');
  const opened = Object.fromEntries(Object.entries((await getDocFromServer(ref)).data()).filter(([, v]) => typeof v === 'string'));
  const [entry] = await dashboardOf(db, uid);
  await updateHouseholdEntries(db, uid, [{ locator: entry.locator, patch: { memo: '거래 목록에서 수정' } }]);
  await assert.rejects(saveHouseholdOriginal(db, uid, '2026-10-01_household', opened, { ...opened, household_title: '바꾼 제목' }), HouseholdOriginalConflict);
  assert.match((await getDocFromServer(ref)).data().household_entries, /거래 목록에서 수정/);
});

test('예전 단건 문서는 단건 필드만 고치고, 연 사이 배열로 바뀌거나 손상·중복 id면 저장하지 않는다', async () => {
  const uid = uidFor('legacy'), db = client(uid);
  await seed529(db, uid);
  const legacy = (await dashboardOf(db, uid)).find(e => e.locator?.recordId === '2025-12-24');
  await updateHouseholdEntries(db, uid, [{ locator: legacy.locator, patch: { category: '식비', subcategory: '간식', memo: '예전 메모 수정' } }]);
  const data = (await getDocFromServer(doc(db, 'users', uid, 'records', '2025-12-24'))).data();
  assert.deepEqual([data.household_category, data.household_subcategory, data.household_categorySource, data.household_memo], ['식비', '간식', 'user', '예전 메모 수정']);
  assert.equal(data.household_entries, undefined);
  assert.equal(data.household_sayu, '예전 단건 본문');
  assert.equal(data.household_amount, '3000');
  assert.equal((await dashboardOf(db, uid)).length, 529);

  // '[]' + 단건 필드 문서를 연 사이 같은 달 거래가 추가되면 단건 편집은 충돌이다.
  const novRef = doc(db, 'users', uid, 'records', '2025-11-01_household');
  await setDoc(novRef, { date: '2025-11-01', household_entries: '[]', household_type: '지출', household_category: '기타', household_vendor: '11월 가게', household_amount: '2000', household_memo: '11월 메모', household_date: '2025-11-03' });
  const nov = (await dashboardOf(db, uid)).find(e => e.locator?.recordId === '2025-11-01_household');
  assert.equal(nov.locator.rawIndex, -1);
  await saveHouseholdEntries(db, uid, [{ id: 'nov-new', date: '2025-11-10', transactionType: '지출', category: '식비', vendor: '새 거래', amount: '777', paymentMethod: '현금', memo: '' }]);
  const novBefore = (await getDocFromServer(novRef)).data();
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: nov.locator, patch: { memo: '덮어쓰기 시도' } }]), HouseholdEditConflict);
  assert.deepEqual((await getDocFromServer(novRef)).data(), novBefore);

  // 손상된 배열과 중복 id 문서는 화면을 거치지 않은 위치로 보내도 저장하지 않는다.
  const badRef = doc(db, 'users', uid, 'records', '2025-10-01_household');
  await setDoc(badRef, { date: '2025-10-01', household_entries: '{broken', household_memo: '보존' });
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: { recordId: '2025-10-01_household', rawIndex: 0, identity: 'manual:x', fingerprint: '{}' }, patch: { memo: 'x' } }]), HouseholdEditConflict);
  assert.equal((await getDocFromServer(badRef)).data().household_entries, '{broken');
  // 중복 id 문서: 열 때의 위치·지문과 다른 위치·지문으로 보내면 다른 위치를 찾지 않고 거부한다.
  const dupRef = doc(db, 'users', uid, 'records', '2025-09-01_household');
  const dup = { id: 'same', date: '2025-09-02', transactionType: '지출', category: '기타', vendor: 'a', amount: '1', paymentMethod: '', memo: '' };
  await setDoc(dupRef, { date: '2025-09-01', household_entries: JSON.stringify([dup, { ...dup, amount: '2' }, { ...dup, id: undefined }]) });
  const dupBefore = (await getDocFromServer(dupRef)).data();
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: { recordId: '2025-09-01_household', rawIndex: 1, identity: 'manual:same', fingerprint: JSON.stringify(dup) }, patch: { memo: 'x' } }]), HouseholdEditConflict);
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: { recordId: '2025-09-01_household', rawIndex: 2, identity: 'manual:same', fingerprint: JSON.stringify({ ...dup, id: undefined }) }, patch: { memo: 'x' } }]), HouseholdEditConflict);
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: { recordId: '2025-09-01_household', rawIndex: 3, identity: 'manual:same', fingerprint: JSON.stringify(dup) }, patch: { memo: 'x' } }]), HouseholdEditConflict);
  assert.deepEqual((await getDocFromServer(dupRef)).data(), dupBefore);
  // 한 요청에 일부만 충돌해도 아무것도 저장하지 않는다.
  const ok = (await dashboardOf(db, uid)).find(e => e.locator?.recordId === '2026-01-01_household');
  const janBefore = (await getDocFromServer(doc(db, 'users', uid, 'records', '2026-01-01_household'))).data();
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: ok.locator, patch: { memo: '일부' } }, { locator: nov.locator, patch: { memo: 'x' } }]), HouseholdEditConflict);
  assert.deepEqual((await getDocFromServer(doc(db, 'users', uid, 'records', '2026-01-01_household'))).data(), janBefore);
});

test('M1: id 없는 두 거래·중복 id·내용이 같은 두 건을 각자의 원본 위치로 편집하고 id·importSource는 만들거나 바꾸지 않는다', async () => {
  const uid = uidFor('m1-position'), db = client(uid);
  const base = { date: '2026-10-05', transactionType: '지출', category: '기타', vendor: '같은 가게', amount: '4500', paymentMethod: '현금', memo: '원래 메모\n둘째 줄' };
  const bank = { kind: 'kakao', fileDigest: 'f', key: 'kakao:dup' };
  const raw = [
    { ...base }, { ...base },                                   // 원래 id 없는 두 거래(내용도 같음)
    { ...base, id: 'same' }, { ...base, id: 'same', amount: '9000' }, // 중복 id
    { ...base, id: 'twin' }, { ...base, id: 'twin' },           // id까지 같은 동일 내용 두 건
    { ...base, id: 'b1', importSource: bank }, { ...base, id: 'b2', importSource: bank }, // 같은 출처키
  ];
  const ref = doc(db, 'users', uid, 'records', '2026-10-01_household');
  await setDoc(ref, { date: '2026-10-01', formats: ['HARU가계부', '메모'], household_entries: JSON.stringify(raw), household_importKeys: ['receipt-1'],
    household_sayu: '사용자 본문', household_memo: '사용자 상위 메모', memo_sayu: '다른 형식 본문' });
  const before = (await getDocFromServer(ref)).data();
  const entries = await dashboardOf(db, uid);
  assert.equal(entries.length, 8);
  assert.ok(entries.every(e => e.locator && !e.editBlock));
  // 짝수 위치만 편집: 같은 내용의 이웃 거래는 그대로여야 한다.
  const targets = entries.filter(e => e.locator.rawIndex % 2 === 0);
  const result = await updateHouseholdEntries(db, uid, targets.map(e => ({ locator: e.locator, patch: { category: '식비', memo: `위치 ${e.locator.rawIndex} 메모` } })));
  assert.deepEqual([result.updated, result.unchanged], [4, 0]);
  const now = (await getDocFromServer(ref)).data();
  const after = JSON.parse(now.household_entries);
  assert.equal(after.length, raw.length);
  raw.forEach((entry, index) => {
    if (index % 2) return assert.deepEqual(after[index], entry, `위치 ${index}는 그대로`);
    assert.deepEqual(after[index], { ...entry, category: '식비', categorySource: 'user', memo: `위치 ${index} 메모` });
    // 없던 id를 만들지 않고, 있던 id·importSource는 그대로다.
    assert.equal('id' in after[index], 'id' in entry);
    assert.deepEqual(after[index].importSource, entry.importSource);
  });
  for (const key of ['formats', 'household_importKeys', 'household_sayu', 'household_memo', 'memo_sayu', 'date']) assert.deepEqual(now[key], before[key], key);
  // 같은 위치를 한 요청에 두 번 보내면 거부한다.
  const odd = (await dashboardOf(db, uid)).find(e => e.locator.rawIndex === 1);
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: odd.locator, patch: { memo: 'a' } }, { locator: odd.locator, patch: { memo: 'b' } }]), /두 번 선택/);
  // 열 때 위치의 지문이 지금과 다르면(같은 내용의 이웃 거래 위치로 바꿔 보내도) 저장하지 않는다.
  const stale = entries.find(e => e.locator.rawIndex === 0);
  const snapshot = (await getDocFromServer(ref)).data();
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: stale.locator, patch: { memo: '다른 수정' } }]), HouseholdEditConflict);
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: { ...stale.locator, rawIndex: 2 }, patch: { memo: 'x' } }]), HouseholdEditConflict);
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: { ...stale.locator, rawIndex: 99 }, patch: { memo: 'x' } }]), HouseholdEditConflict);
  // 기록 문서가 없으면(문서 id 불명) 저장하지 않는다.
  await assert.rejects(updateHouseholdEntries(db, uid, [{ locator: { ...odd.locator, recordId: '2030-01-01_household' }, patch: { memo: 'x' } }]), HouseholdEditConflict);
  assert.deepEqual((await getDocFromServer(ref)).data(), snapshot);
  // 같은 수정 재전송은 이미 반영으로 처리한다.
  const retry = await updateHouseholdEntries(db, uid, [{ locator: stale.locator, patch: { category: '식비', memo: '위치 0 메모' } }]);
  assert.deepEqual([retry.updated, retry.unchanged], [0, 1]);
});

test("'[]'와 예전 단건 필드가 함께 있는 문서에 현금을 추가해도 단건 거래·메모·금액·원본 키·다른 형식을 보존한다", async () => {
  const uid = uidFor('empty-array-legacy'), db = client(uid);
  await seed529(db, uid);
  const ref = doc(db, 'users', uid, 'records', '2025-11-01_household');
  const legacyFields = { household_type: '지출', household_category: '식비', household_subcategory: '간식', household_categorySource: 'user', household_vendor: '11월 가게',
    household_amount: '2000', household_payment: '현금', household_memo: '11월 메모\n둘째 줄', household_date: '2025-11-03' };
  await setDoc(ref, { date: '2025-11-01', formats: ['HARU가계부', '메모'], household_entries: '[]', ...legacyFields, household_sayu: '예전 본문',
    household_importKeys: ['receipt-nov'], household_title: '2025-11 가계부', memo_sayu: '다른 형식 본문' });
  // 실제 빈 문서: 배열·단건 필드 모두 거래가 없다.
  const emptyRef = doc(db, 'users', uid, 'records', '2025-08-01_household');
  await setDoc(emptyRef, { date: '2025-08-01', household_entries: '[]', household_title: '2025-08 가계부', memo_sayu: '빈 문서의 다른 형식' });
  const before = await snapshotAll(db, uid);
  const beforeEntries = await dashboardOf(db, uid);
  assert.equal(beforeEntries.length, 530);
  const legacyRow = beforeEntries.find(e => e.locator?.recordId === '2025-11-01_household');
  assert.deepEqual([legacyRow.locator.rawIndex, legacyRow.memo, legacyRow.amount, legacyRow.subcategory], [-1, '11월 메모\n둘째 줄', '2000', '간식']);

  const cash = buildHouseholdCashEntry({ ...newHouseholdCashDraft(uid), date: '2025-11-10', amount: '5678', vendor: '시장', category: '식비' });
  const empty = buildHouseholdCashEntry({ ...newHouseholdCashDraft(uid), date: '2025-08-10', amount: '1234', vendor: '빈 달 가게', category: '식비' });
  const saved = await saveHouseholdEntries(db, uid, [cash, empty]);
  assert.deepEqual([saved.added, saved.createdRecords], [2, 0]);

  const now = await snapshotAll(db, uid);
  const nov = now['2025-11-01_household'];
  const raw = JSON.parse(nov.household_entries);
  assert.equal(raw.length, 2);
  assert.deepEqual(raw[0], { id: 'legacy:2025-11-01_household', date: '2025-11-03', transactionType: '지출', category: '식비', vendor: '11월 가게', amount: '2000',
    paymentMethod: '현금', memo: '11월 메모\n둘째 줄', subcategory: '간식', categorySource: 'user' });
  assert.deepEqual(raw[1], cash);
  // 상위 단건 필드·원본 키·다른 형식·제목은 그대로 남는다. 운영 데이터 이전은 하지 않는다.
  for (const key of [...Object.keys(legacyFields), 'household_importKeys', 'household_title', 'memo_sayu', 'date']) assert.deepEqual(nov[key], before['2025-11-01_household'][key], key);
  assert.deepEqual(nov.formats, ['HARU가계부', '메모']);
  assert.match(nov.household_sayu, /^예전 본문\n\n\[지출\] 2025-11-10 5678원 시장/);
  // 실제 빈 문서에는 새 거래만 들어가고 다른 형식 필드는 그대로다.
  assert.deepEqual(JSON.parse(now['2025-08-01_household'].household_entries), [empty]);
  assert.equal(now['2025-08-01_household'].memo_sayu, '빈 문서의 다른 형식');
  // 나머지 문서는 한 글자도 바뀌지 않는다.
  for (const id of Object.keys(before)) if (!['2025-11-01_household', '2025-08-01_household'].includes(id)) assert.deepEqual(now[id], before[id], id);
  // 전체 건수: 기존 530건 + 새 2건. 예전 단건 거래가 사라지지 않는다.
  const afterEntries = await dashboardOf(db, uid);
  assert.equal(afterEntries.length, 532);
  assert.ok(afterEntries.some(e => e.vendor === '11월 가게' && e.memo === '11월 메모\n둘째 줄' && e.amount === '2000'));
  // 같은 현금 재시도는 단건 변환 거래와 겹치지 않고 이미 저장됨으로 처리한다.
  const retry = await saveHouseholdEntries(db, uid, [cash]);
  assert.deepEqual([retry.added, retry.already], [0, 1]);
  assert.deepEqual(await snapshotAll(db, uid), now);
});

test("손상된 배열이 있는 달에는 현금을 추가하지 않고 원본을 그대로 둔다", async () => {
  const uid = uidFor('corrupt-add'), db = client(uid);
  const ref = doc(db, 'users', uid, 'records', '2025-07-01_household');
  await setDoc(ref, { date: '2025-07-01', household_entries: '{broken', household_type: '지출', household_vendor: '보존 가게', household_amount: '1000', household_memo: '보존 메모' });
  const before = (await getDocFromServer(ref)).data();
  const cash = buildHouseholdCashEntry({ ...newHouseholdCashDraft(uid), date: '2025-07-10', amount: '999', vendor: '시장', category: '식비' });
  await assert.rejects(saveHouseholdEntries(db, uid, [cash]), /읽지 못했습니다/);
  assert.deepEqual((await getDocFromServer(ref)).data(), before);
});

test('다른 계정은 기존 Rules에 따라 거래·분류 설정을 고칠 수 없다', async () => {
  const owner = uidFor('owner'), intruder = uidFor('intruder');
  const ownerDb = client(owner), intruderDb = client(intruder);
  await saveHouseholdEntries(ownerDb, owner, [{ id: 'p1', date: '2026-10-05', transactionType: '지출', category: '기타', vendor: '가게', amount: '1000', paymentMethod: '현금', memo: '보존' }]);
  const before = await snapshotAll(ownerDb, owner);
  const [entry] = await dashboardOf(ownerDb, owner);
  await assert.rejects(updateHouseholdEntries(intruderDb, owner, [{ locator: entry.locator, patch: { memo: '침범' } }]), error => /permission|PERMISSION_DENIED/i.test(String(error?.code || error?.message)));
  await assert.rejects(updateHouseholdCategories(intruderDb, owner, '지출', { kind: 'add', name: '침범' }), error => /permission|PERMISSION_DENIED/i.test(String(error?.code || error?.message)));
  await assert.rejects(loadHouseholdVendorRules(intruderDb, owner), error => /permission|PERMISSION_DENIED/i.test(String(error?.code || error?.message)));
  assert.deepEqual(await snapshotAll(ownerDb, owner), before);
});

test('두 기기에서 동시에 분류·거래처 기억을 추가해도 둘 다 남고, 손상된 설정은 덮어쓰지 않는다', async () => {
  const uid = uidFor('settings'), dbA = client(uid), dbB = client(uid);
  await Promise.all([
    updateHouseholdCategories(dbA, uid, '지출', { kind: 'add', name: '반려동물' }),
    updateHouseholdCategories(dbB, uid, '지출', { kind: 'add', name: '경조사' }),
    updateHouseholdCategories(dbB, uid, '이체', { kind: 'addSub', category: '저축·투자', name: '적금' }),
  ]);
  const views = mergeHouseholdCategories(await loadHouseholdCategories(dbA, uid));
  assert.ok(householdCategoryOptions(views.지출).includes('반려동물'));
  assert.ok(householdCategoryOptions(views.지출).includes('경조사'));
  assert.deepEqual(views.이체.find(v => v.name === '저축·투자').subcategories, ['적금']);
  await Promise.all([
    updateHouseholdVendorRules(dbA, uid, s => upsertHouseholdVendorRule(s, { type: '지출', vendor: 'Store.A|1', category: '식비' })),
    updateHouseholdVendorRules(dbB, uid, s => upsertHouseholdVendorRule(s, { type: '지출', vendor: 'store.b', category: '쇼핑' })),
  ]);
  assert.deepEqual((await loadHouseholdVendorRules(dbA, uid)).rules.map(r => r.vendorKey).sort(), ['store.a|1', 'store.b']);
  const ref = doc(dbA, 'users', uid, 'settings', 'householdCategories');
  await setDoc(ref, { types: 'broken' });
  await assert.rejects(updateHouseholdCategories(dbA, uid, '지출', { kind: 'add', name: '새 분류' }), /읽지 못했습니다/);
  assert.deepEqual((await getDocFromServer(ref)).data(), { types: 'broken' });
});

test('거래처 기억을 저장해도 이미 저장된 529건은 자동으로 바뀌지 않는다', async () => {
  const uid = uidFor('rules529'), db = client(uid);
  await seed529(db, uid);
  const before = await snapshotAll(db, uid);
  await updateHouseholdVendorRules(db, uid, s => upsertHouseholdVendorRule(s, { type: '지출', vendor: '합성 거래처 1', category: '의료비' }));
  assert.deepEqual(await snapshotAll(db, uid), before);
});

test('현금 거래: 새 달 문서 생성, 같은 id 재시도는 한 번만, 같은 날·금액은 확인 후 반복 거래로 보존', async () => {
  const uid = uidFor('cash'), dbA = client(uid), dbB = client(uid);
  const draft = { ...newHouseholdCashDraft(uid, new Date('2026-10-28T16:00:00Z')), amount: '4500', vendor: '시장', category: '식비' };
  const entry = buildHouseholdCashEntry(draft);
  assert.equal(entry.date, '2026-10-29');
  const first = await saveHouseholdEntries(dbA, uid, [entry]);
  assert.deepEqual([first.added, first.createdRecords], [1, 1]);
  // 응답이 유실되어 같은 id로 다시 보낸 경우
  const retry = await saveHouseholdEntries(dbA, uid, [entry]);
  assert.deepEqual([retry.added, retry.already], [0, 1]);
  // 같은 날 같은 금액의 다른 현금 거래는 확인 전 저장하지 않는다.
  const again = buildHouseholdCashEntry({ ...newHouseholdCashDraft(uid, new Date('2026-10-28T16:00:00Z')), amount: '4500', vendor: '시장', category: '식비' });
  await assert.rejects(saveHouseholdEntries(dbA, uid, [again]), HouseholdDuplicateReviewRequired);
  const checks = await checkHouseholdDuplicates([again], await loadHouseholdRecords(dbA, uid));
  const keep = await saveHouseholdEntries(dbA, uid, [again], { [again.id]: { token: checks[0].token, action: 'keep' } });
  assert.equal(keep.added, 1);
  const third = buildHouseholdCashEntry({ ...newHouseholdCashDraft(uid, new Date('2026-10-28T16:00:00Z')), amount: '4500', vendor: '시장', category: '식비' });
  const checks3 = await checkHouseholdDuplicates([third], await loadHouseholdRecords(dbA, uid));
  const skip = await saveHouseholdEntries(dbA, uid, [third], { [third.id]: { token: checks3[0].token, action: 'skip' } });
  assert.deepEqual([skip.added, skip.skipped], [0, 1]);
  // 두 기기에서 같은 달 현금 거래를 동시에 추가해도 둘 다 남는다.
  const x = buildHouseholdCashEntry({ ...draft, id: `x-${runId}`, amount: '1111' }), y = buildHouseholdCashEntry({ ...draft, id: `y-${runId}`, amount: '2222' });
  await Promise.all([saveHouseholdEntries(dbA, uid, [x]), saveHouseholdEntries(dbB, uid, [y])]);
  const raw = JSON.parse((await getDocFromServer(doc(dbA, 'users', uid, 'records', '2026-10-01_household'))).data().household_entries);
  assert.equal(raw.length, 4);
  assert.ok(raw.every(e => e.paymentMethod === '현금'));
  assert.equal(raw.filter(e => e.amount === '4500').length, 2);
});
