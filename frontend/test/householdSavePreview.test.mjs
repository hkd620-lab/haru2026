import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkHouseholdDuplicates } from '../src/app/services/householdDuplicates.ts';
import { previewHouseholdSave, householdSaveLabel } from '../src/app/services/householdSavePreview.ts';
import { HouseholdSaveSummary } from '../src/app/components/HouseholdSaveSummary.tsx';

const entry = id => ({ id, date: '2026-10-05', amount: '4500', vendor: '합성 카페', transactionType: '지출', category: '식비', paymentMethod: '', memo: '' });
const rows = entries => entries.map(entry => ({ entry, selected: true }));
const stored = entries => [{ id: 'old', data: { household_entries: JSON.stringify(entries) } }];

test('529건 중 142건 겹침: 선택 전·모두 제외·별개 추가 결과가 각각 합산된다', () => {
  const entries = Array.from({ length: 529 }, (_, i) => entry(String(i)));
  const checks = entries.map((entry, i) => ({ entry, status: i < 142 ? 'suspect' : 'new', token: entry.id, matches: [{ recordId: 'old' }] }));
  const before = previewHouseholdSave(rows(entries), checks, {});
  assert.deepEqual(before, { total: 529, added: 387, excluded: 0, pending: 142, unchecked: 0, unselected: 0 });
  const decisions = Object.fromEntries(entries.slice(0, 142).map(e => [e.id, { token: e.id, action: 'skip' }]));
  const skipped = previewHouseholdSave(rows(entries), checks, decisions);
  assert.equal(skipped.added, 387); assert.equal(skipped.excluded, 142); assert.equal(skipped.pending, 0);
  assert.equal(householdSaveLabel(skipped), '387건 추가 · 중복 142건 제외하고 저장');
  decisions['0'].action = 'keep';
  const kept = previewHouseholdSave(rows(entries), checks, decisions);
  assert.equal(kept.added, 388); assert.equal(kept.excluded, 141);
  const markup = renderToStaticMarkup(React.createElement(HouseholdSaveSummary, { preview: before }));
  assert.match(markup, /추가 예정 387건 · 중복 제외 0건/);
  assert.match(markup, /겹침 선택 대기 142건/);
});

test('자동 제외와 미선택을 구분하고 파일 내 정상 반복 결제를 추가 건수로 유지한다', async () => {
  const a = { ...entry('a'), importSource: { key: 'a', fileDigest: 'same' } };
  const b = { ...entry('b'), importSource: { key: 'b', fileDigest: 'same' } };
  const c = { ...entry('c'), importSource: { key: 'c', fileDigest: 'same' } };
  const entries = [a, b, c];
  const checks = await checkHouseholdDuplicates(entries, stored([a]));
  assert.deepEqual(previewHouseholdSave(rows(entries), checks, {}), { total: 3, added: 2, excluded: 1, pending: 0, unchecked: 0, unselected: 0 });
  assert.deepEqual(previewHouseholdSave([{ entry: a, selected: false }, { entry: b, selected: false }, { entry: c, selected: true }], checks, {}),
    { total: 3, added: 1, excluded: 1, pending: 0, unchecked: 0, unselected: 1 });
  const retry = previewHouseholdSave(entries.map(entry => ({ entry, selected: false })), await checkHouseholdDuplicates(entries, stored(entries)), {});
  assert.equal(retry.added, 0); assert.equal(retry.excluded, 3);
});

test('입력 내용·비교 토큰 변경과 비교 후보 소멸은 예전 제외 선택을 확정 건수로 쓰지 않는다', async () => {
  const incoming = entry('incoming');
  const checks = await checkHouseholdDuplicates([incoming], stored([entry('manual')]));
  const decisions = { incoming: { token: checks[0].token, action: 'skip' } };
  assert.equal(previewHouseholdSave(rows([incoming]), checks, decisions).excluded, 1);
  const edited = previewHouseholdSave(rows([{ ...incoming, amount: '9000' }]), checks, decisions);
  assert.equal(edited.unchecked, 1); assert.equal(edited.excluded, 0);
  assert.match(householdSaveLabel(edited), /중복 확인 후 저장/);
  assert.equal(previewHouseholdSave(rows([incoming]), [{ ...checks[0], token: 'changed' }], decisions).pending, 1);
  assert.equal(previewHouseholdSave(rows([incoming]), [{ ...checks[0], matches: [] }], decisions).pending, 1);
  assert.equal(previewHouseholdSave(rows([incoming]), [], {}).unchecked, 1);
});
