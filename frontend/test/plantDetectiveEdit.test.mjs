import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase/firestore';
import { applyPlantDetectiveEdit, fingerprintPlantEntry, readPlantDetectiveSelection, PLANT_EDIT_CONFLICT } from '../src/app/utils/plantDetectiveEdit.ts';

const original = {
  createdAt: Timestamp.fromMillis(1000), plantId: 'fixture-plant', title: '원래 이름',
  humanReportedName: '사용자 이름', imageUrls: ['fixture:photo'], imageMetas: [{ storagePath: 'fixture/path' }],
  providerResults: { gemini: { healthScore: 90, wateringAdvice: '기존 내용' }, plantNet: { confidence: 0.81 } },
  plantAssistant: { healthScore: 90 }, warningSigns: ['기존 주의'], unknownLegacy: { keep: true },
  memo: '원래 메모', editHistory: [{ editedAt: '기존 시각' }],
};
const draft = { displayName: '새 이름', userConfirmedName: '새 이름', englishName: 'Luffa', scientificName: 'Luffa cylindrica', observation: '관찰', aiDifference: '비교', memo: ' 새 메모 ', locationLabel: '정원' };
const select = async (entry = original, idx = 0) => ({ recordId: '2026-10-06_fixture', idx, fingerprint: await fingerprintPlantEntry(entry) });

test('selection requires an exact document, safe array index and snapshot digest', async () => {
  const valid = await select();
  assert.deepEqual(readPlantDetectiveSelection(valid), valid);
  for (const value of [null, {}, { ...valid, idx: -1 }, { ...valid, idx: 0.5 }, { ...valid, idx: '0' }, { ...valid, recordId: 'users/other' }, { ...valid, fingerprint: '' }]) {
    assert.equal(readPlantDetectiveSelection(value), null);
  }
});

test('snapshot digest ignores key order but includes timestamp and nested changes', async () => {
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  assert.equal(await fingerprintPlantEntry(original), await fingerprintPlantEntry(reordered));
  assert.notEqual(await fingerprintPlantEntry(original), await fingerprintPlantEntry({ ...original, createdAt: Timestamp.fromMillis(1001) }));
  assert.notEqual(await fingerprintPlantEntry(original), await fingerprintPlantEntry({ ...original, providerResults: { changed: true } }));
});

test('Firestore numeric special values cannot collide with null or an object marker', async () => {
  const fingerprints = await Promise.all([null, NaN, Infinity, -Infinity, 'NaN', { number: 'NaN' }].map(value => fingerprintPlantEntry({ value })));
  assert.equal(new Set(fingerprints).size, fingerprints.length);
});

test('edit preserves every photo/provider/legacy field and leaves the input untouched', async () => {
  const before = await fingerprintPlantEntry(original);
  const sibling = { createdAt: 2000, title: '다른 판독', memo: '다른 메모' };
  const result = await applyPlantDetectiveEdit([original, sibling], await select(), draft, 3000);
  const edited = result.entries[0];
  for (const key of ['createdAt', 'plantId', 'imageUrls', 'imageMetas', 'providerResults', 'plantAssistant', 'warningSigns', 'unknownLegacy']) assert.deepEqual(edited[key], original[key]);
  assert.equal(edited.memo, '새 메모');
  assert.equal(edited.editHistory.length, 2);
  assert.equal(edited.editHistory[1].previousMemo, original.memo);
  assert.equal(edited.editHistory[1].previousUserConfirmedName, original.humanReportedName);
  assert.equal(result.entries[1], sibling);
  assert.equal(await fingerprintPlantEntry(original), before);
  assert.equal(result.selection.fingerprint, await fingerprintPlantEntry(edited));
});

test('concurrent sibling updates and additions are retained from the latest transaction snapshot', async () => {
  const latestSibling = { title: '다른 화면의 수정', memo: '최신' };
  const addition = { title: '새로 추가' };
  const result = await applyPlantDetectiveEdit([original, latestSibling, addition], await select(), draft, 3000);
  assert.deepEqual(result.entries.slice(1), [latestSibling, addition]);
});

test('target modification, replacement, deletion and index shift reject instead of overwriting', async () => {
  const selection = await select();
  for (const latest of [[{ ...original, memo: '다른 화면의 수정' }], [{ title: '다른 판독' }], [], [42], [[original]], [{ title: '삽입 항목' }, original]]) {
    await assert.rejects(applyPlantDetectiveEdit(latest, selection, draft, 3000), { message: PLANT_EDIT_CONFLICT });
  }
});

test('nonzero index stays stable for linked chat memos and supports repeated edits', async () => {
  const first = await applyPlantDetectiveEdit([{ title: '앞 항목' }, original], await select(original, 1), draft, 3000);
  assert.equal(first.selection.idx, 1);
  const second = await applyPlantDetectiveEdit(first.entries, first.selection, { ...draft, memo: '두 번째 수정' }, 4000);
  assert.equal(second.entries[1].editHistory.length, 3);
  assert.equal(second.entries[1].memo, '두 번째 수정');
});

test('clearing user confirmation clears both compatible name fields', async () => {
  const result = await applyPlantDetectiveEdit([original], await select(), { ...draft, userConfirmedName: '', locationLabel: '' }, 3000);
  assert.equal(result.entries[0].userConfirmedName, '');
  assert.equal(result.entries[0].humanReportedName, '');
  assert.equal(result.entries[0].locationLabel, '');
});
