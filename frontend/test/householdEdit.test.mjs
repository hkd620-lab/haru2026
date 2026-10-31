// 실행: node --import tsx --test test/householdEdit.test.mjs
// 합성 자료만 사용한다. 저장된 거래 편집의 위치 식별·편집 차단·허용 필드 규칙.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readHouseholdDashboard, filterTransactions, needsHouseholdCategoryReview } from '../src/app/utils/householdDashboard.ts';
import { householdRecordShape, householdEntryFingerprint, householdLegacyFingerprint } from '../src/app/utils/householdRecordShape.ts';
import { applyHouseholdPatch, normalizeHouseholdPatch } from '../src/app/services/householdEditService.ts';
import { isBlankHouseholdEntry, previewHouseholdSave, householdSaveLabel } from '../src/app/services/householdSavePreview.ts';
import { householdSayuText } from '../src/app/services/householdSaveService.ts';
import { householdStoredEntries } from '../src/app/services/householdDuplicates.ts';
import { householdRuleArchived, suggestHouseholdCategory, upsertHouseholdVendorRule } from '../src/app/services/householdVendorRules.ts';
import { applyHouseholdCategoryAction, emptyHouseholdCategories, mergeHouseholdCategories } from '../src/app/services/householdCategories.ts';
import { householdCashRetryDiff } from '../src/app/components/HouseholdCashEntry.tsx';

const tx = (id, overrides = {}) => ({ id, date: '2026-10-05', transactionType: '지출', category: '식비', vendor: '시험 식당', amount: '4500', paymentMethod: '체크카드', memo: '원본 메모', ...overrides });
// 작성창의 기본 행(구분만 '지출')과, 저장 배열에 남은 내용 없는 항목.
const blank = { id: 'blank', date: '', transactionType: '지출', category: '', vendor: '', amount: '', paymentMethod: '', memo: '' };
const emptyStored = { id: 'empty', date: '', transactionType: '', category: '', vendor: '', amount: '', paymentMethod: '', memo: '' };
const record = (id, entries, extra = {}) => ({ id, date: id.slice(0, 10), household_entries: JSON.stringify(entries), ...extra });

test('빈 행을 걸러낸 뒤의 표시 위치가 아니라 저장 배열의 실제 위치를 편집 위치로 쓴다', () => {
  const raw = [emptyStored, tx('a'), null, tx('b', { amount: '7000' })];
  const { entries, ignoredEntries } = readHouseholdDashboard([record('2026-10-01_household', raw)]);
  assert.equal(ignoredEntries, 2);
  assert.deepEqual(entries.map(e => e.sourceKey), ['2026-10-01_household:0', '2026-10-01_household:1']);
  assert.deepEqual(entries.map(e => e.locator.rawIndex), [1, 3]);
  assert.equal(entries[1].locator.fingerprint, householdEntryFingerprint(raw[3]));
  assert.equal(entries[0].locator.identity, 'manual:a');
});

test('id 없는 거래·중복 id·문서 사이 중복 출처키도 기록 위치와 원본 지문으로 각각 편집 위치를 갖는다(M1)', () => {
  const noId = [{ ...tx('x'), id: undefined }, { ...tx('y'), id: '' }, { ...tx('z'), id: undefined }];
  const dupId = [tx('same'), tx('same', { amount: '9000' })];
  const bank = (id) => tx(id, { importSource: { kind: 'kakao', fileDigest: 'f', key: 'kakao:k1' } });
  const records = [
    record('2026-09-01_household', noId),
    record('2026-10-01_household', dupId),
    record('2026-11-01_household', [bank('r1')]),
    record('2026-12-01_household', [bank('r2')]),
  ];
  const frozen = JSON.stringify(records);
  const { entries } = readHouseholdDashboard(records);
  assert.equal(entries.length, 7);
  for (const entry of entries) assert.equal(entry.editBlock, undefined);
  // 위치는 문서 id + 실제 배열 위치. identity는 같은 위치의 추가 확인용 값일 뿐이다.
  assert.deepEqual(entries.map(e => [e.locator.recordId, e.locator.rawIndex, e.locator.identity]), [
    ['2026-09-01_household', 0, 'manual:undefined'], ['2026-09-01_household', 1, 'manual:'], ['2026-09-01_household', 2, 'manual:undefined'],
    ['2026-10-01_household', 0, 'manual:same'], ['2026-10-01_household', 1, 'manual:same'],
    ['2026-11-01_household', 0, 'kakao:k1'], ['2026-12-01_household', 0, 'kakao:k1'],
  ]);
  assert.equal(entries[2].locator.fingerprint, householdEntryFingerprint(noId[2]));
  assert.equal(new Set(entries.map(e => `${e.locator.recordId}#${e.locator.rawIndex}`)).size, 7);
  // 화면 조회는 원본의 id·importSource를 만들거나 바꾸지 않는다.
  assert.equal(JSON.stringify(records), frozen);
  // 기록 문서 id가 없거나 배열이 손상되면 계속 편집하지 않는다.
  const blocked = readHouseholdDashboard([{ date: '2026-10-01', household_entries: JSON.stringify([tx('a')]) }, { id: 'b', household_entries: '[{', household_memo: 'm', household_type: '지출' }]).entries;
  assert.deepEqual(blocked.map(e => [Boolean(e.locator), Boolean(e.editBlock)]), [[false, true], [false, true]]);
});

test('[]와 예전 단건 필드가 함께 있는 문서는 저장 시 단건 거래를 함께 읽고, 실제 빈 문서·손상 배열은 구분한다', () => {
  const legacyFields = { household_type: '지출', household_category: '식비', household_subcategory: '간식', household_categorySource: 'user', household_vendor: '예전 가게', household_amount: '3000', household_payment: '현금', household_memo: '예전 메모\n둘째 줄', household_date: '2025-11-03' };
  const mixed = householdStoredEntries({ id: '2025-11-01_household', data: { household_entries: '[]', ...legacyFields } });
  assert.deepEqual(mixed, [{ id: 'legacy:2025-11-01_household', date: '2025-11-03', transactionType: '지출', category: '식비', vendor: '예전 가게', amount: '3000', paymentMethod: '현금', memo: '예전 메모\n둘째 줄', subcategory: '간식', categorySource: 'user' }]);
  // 거래 없는 배열 항목은 위치 그대로 두고 단건 거래를 뒤에 남긴다.
  assert.deepEqual(householdStoredEntries({ id: 'r', data: { household_entries: '[{}]', ...legacyFields } }).map(e => e.id), [undefined, 'legacy:r']);
  // 단건 필드도 거래 내용이 없으면 실제 빈 문서다.
  assert.deepEqual(householdStoredEntries({ id: 'e', data: { household_entries: '[]', household_title: '2025-11 가계부' } }), []);
  // 거래가 있는 배열은 단건 필드가 함께 있어도 배열만 쓴다(첫 거래 복사본).
  assert.deepEqual(householdStoredEntries({ id: 'a', data: { household_entries: JSON.stringify([tx('a')]), ...legacyFields } }), [tx('a')]);
  // 손상·배열 아닌 값은 빈 내역으로 보지 않고 저장을 거부한다.
  for (const broken of ['{broken', '{"a":1}', 5])
    assert.throws(() => householdStoredEntries({ id: 'b', data: { household_entries: broken, ...legacyFields } }), /읽지 못했습니다/);
  // household_entries가 없는 기존 단건 문서는 기존 규칙 그대로다.
  assert.equal(householdStoredEntries({ id: 'l', data: legacyFields })[0].id, 'legacy:l');
});

test('보관한 분류는 거래처 기억이 새 거래에 제안하지 않고, 보관한 세부분류만이면 분류만 제안한다', () => {
  const rules = upsertHouseholdVendorRule({ version: 1, rules: [] }, { type: '지출', vendor: '단골', category: '쇼핑', subcategory: '생활용품' }, 't').rules;
  const base = { transactionType: '지출', vendor: '단골', category: '기타', categorySource: 'import-default' };
  const active = mergeHouseholdCategories(emptyHouseholdCategories());
  assert.deepEqual(suggestHouseholdCategory(base, rules, active), { ...base, category: '쇼핑', subcategory: '생활용품', categorySource: 'rule' });
  const archived = mergeHouseholdCategories(applyHouseholdCategoryAction(emptyHouseholdCategories(), '지출', { kind: 'archive', name: '쇼핑' }));
  assert.deepEqual(suggestHouseholdCategory(base, rules, archived), base);
  assert.deepEqual(householdRuleArchived(rules[0], archived), { category: true, subcategory: false });
  const subArchived = mergeHouseholdCategories(applyHouseholdCategoryAction(emptyHouseholdCategories(), '지출', { kind: 'archiveSub', category: '쇼핑', name: '생활용품' }));
  const sub = suggestHouseholdCategory({ ...base, subcategory: '이전' }, rules, subArchived);
  assert.deepEqual([sub.category, sub.subcategory, sub.categorySource], ['쇼핑', undefined, 'rule']);
  // 규칙 자체는 지우지 않는다.
  assert.equal(rules.length, 1);
});

test('현금 재시도가 이미 저장됨이면 실패한 첫 시도와 다른 분류는 기억하지 않는다', () => {
  const first = { id: 'c', transactionType: '지출', vendor: '시장', category: '식비', date: '2026-10-29', amount: '4500', paymentMethod: '현금', memo: '', categorySource: 'user' };
  assert.deepEqual(householdCashRetryDiff(undefined, first), { changedAfterFailure: false, rememberMismatch: false });
  assert.deepEqual(householdCashRetryDiff(JSON.stringify(first), first), { changedAfterFailure: false, rememberMismatch: false });
  // 메모만 바뀌면 고친 내용은 미반영 안내, 분류 기억은 첫 시도와 같아 그대로 둔다.
  assert.deepEqual(householdCashRetryDiff(JSON.stringify(first), { ...first, memo: '나중 메모' }), { changedAfterFailure: true, rememberMismatch: false });
  assert.deepEqual(householdCashRetryDiff(JSON.stringify(first), { ...first, category: '쇼핑' }), { changedAfterFailure: true, rememberMismatch: true });
  assert.deepEqual(householdCashRetryDiff(JSON.stringify(first), { ...first, subcategory: '외식' }), { changedAfterFailure: true, rememberMismatch: true });
  // 서로 다른 내용으로 여러 번 실패했으면 어느 시도가 저장됐는지 단정하지 않는다.
  assert.deepEqual(householdCashRetryDiff('\u0000mixed', first), { changedAfterFailure: true, rememberMismatch: true });
});

test('내용이 완전히 같은 두 거래도 id가 다르면 각자의 위치·지문으로 따로 편집한다', () => {
  const twins = [tx('t1'), tx('t2')];
  const { entries } = readHouseholdDashboard([record('2026-10-01_household', twins)]);
  assert.deepEqual(entries.map(e => [e.locator.rawIndex, e.locator.identity]), [[0, 'manual:t1'], [1, 'manual:t2']]);
  assert.notEqual(entries[0].locator.fingerprint, entries[1].locator.fingerprint);
});

test('문서 모양으로 배열·단건을 판정하고 손상된 배열은 편집하지 않는다', () => {
  const legacyFields = { household_type: '지출', household_category: '기타', household_vendor: '예전 가게', household_amount: '3000', household_memo: '예전 메모', household_date: '2025-01-02' };
  assert.equal(householdRecordShape(record('a', [tx('a')])).kind, 'array');
  assert.equal(householdRecordShape({ id: 'b', ...legacyFields }).kind, 'legacy');
  assert.equal(householdRecordShape({ id: 'c', household_entries: '[]', ...legacyFields }).kind, 'legacy');
  assert.equal(householdRecordShape({ id: 'd', household_entries: '{broken', ...legacyFields }).kind, 'corrupt');
  assert.equal(householdRecordShape({ id: 'e', household_entries: '{"a":1}', ...legacyFields }).kind, 'corrupt');
  const { entries } = readHouseholdDashboard([
    { id: '2025-01-02', date: '2025-01-02', ...legacyFields },
    { id: '2025-01-03', date: '2025-01-03', household_entries: '[]', ...legacyFields },
    { id: '2025-01-04', date: '2025-01-04', household_entries: '{broken', ...legacyFields },
  ]);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0].locator, { recordId: '2025-01-02', rawIndex: -1, identity: 'legacy:2025-01-02', fingerprint: householdLegacyFingerprint({ ...legacyFields }) });
  assert.equal(entries[1].locator.rawIndex, -1);
  // 열 때 배열 값까지 지문에 넣어, 그 사이 거래가 추가되면 단건 편집이 충돌한다.
  assert.notEqual(entries[1].locator.fingerprint, householdLegacyFingerprint({ ...legacyFields, household_entries: JSON.stringify([tx('n')]) }));
  assert.equal(entries[2].locator, undefined);
  assert.match(entries[2].editBlock, /읽을 수 없어/);
  assert.equal(entries[2].memo, '예전 메모');
});

test('분류 확인 필요는 원본 분류로 판정하고, 사용자가 확정하면 빠진다', () => {
  assert.equal(needsHouseholdCategoryReview('', undefined), true);
  assert.equal(needsHouseholdCategoryReview('기타', undefined), true);
  assert.equal(needsHouseholdCategoryReview('기타수입', 'import-default'), true);
  assert.equal(needsHouseholdCategoryReview('이체', undefined), true);
  assert.equal(needsHouseholdCategoryReview('기타', 'user'), false);
  assert.equal(needsHouseholdCategoryReview('기타', 'rule'), false);
  assert.equal(needsHouseholdCategoryReview('식비', undefined), false);
  const { entries } = readHouseholdDashboard([record('2026-10-01_household', [tx('e', { category: '' }), tx('f', { category: '기타', categorySource: 'user' }), tx('g', { subcategory: '외식' })])]);
  // 표시용 복사본은 빈 분류를 '기타'로 보여 주지만 판정은 원본으로 한다.
  assert.equal(entries[0].category, '기타');
  assert.equal(entries[0].rawCategory, '');
  assert.deepEqual(filterTransactions(entries, '전체', '전체', '', { needsReview: true }).map(e => e.locator.identity), ['manual:e']);
  assert.deepEqual(filterTransactions(entries, '전체', '전체', '외식').map(e => e.locator.identity), ['manual:g']);
});

test('편집은 분류·세부분류·메모만 바꾸고 날짜·금액·거래처·원본 키·잔액은 그대로 둔다', () => {
  const original = tx('k', { importSource: { kind: 'kakao', fileDigest: 'f', key: 'kakao:k' }, balanceAfter: '120000', transactionAt: '2026-10-05 12:00:00', categorySource: 'import-default', subcategory: '점심' });
  const frozen = JSON.stringify(original);
  const edited = applyHouseholdPatch(original, { category: '교통비', subcategory: '', memo: '새 메모' });
  assert.equal(JSON.stringify(original), frozen);
  const { category, subcategory, memo, categorySource, ...rest } = edited;
  const { category: _c, subcategory: _s, memo: _m, categorySource: _src, ...originalRest } = original;
  assert.deepEqual(rest, originalRest);
  assert.deepEqual([category, subcategory, memo, categorySource], ['교통비', undefined, '새 메모', 'user']);
  // 메모만 고치면 분류 출처는 바꾸지 않는다(일괄 분류는 메모를 넘기지 않는다).
  assert.equal(applyHouseholdPatch(original, { memo: 'x' }).categorySource, 'import-default');
  assert.equal(applyHouseholdPatch(original, { category: '식비', subcategory: '점심' }).memo, '원본 메모');
});

test('편집 입력은 길이·제어문자·빈 분류를 막고 이름을 정규화한다', () => {
  assert.deepEqual(normalizeHouseholdPatch({ category: '  ｶﾌｪ  식비 ', memo: '첫 줄\r\n둘째 줄' }), { category: 'カフェ 식비', memo: '첫 줄\n둘째 줄' });
  assert.throws(() => normalizeHouseholdPatch({ category: '' }), /분류를 선택/);
  assert.throws(() => normalizeHouseholdPatch({ category: 'a'.repeat(41) }), /40자/);
  assert.throws(() => normalizeHouseholdPatch({ memo: 'x'.repeat(501) }), /500자/);
  assert.throws(() => normalizeHouseholdPatch({ memo: 'bad\u0007' }), /500자/);
  assert.throws(() => normalizeHouseholdPatch({}), /바꿀 내용/);
});

test('입력하지 않은 기본 행은 거래 1건·중복 확인 필요 1건으로 세지 않는다', () => {
  assert.equal(isBlankHouseholdEntry(blank), true);
  assert.equal(isBlankHouseholdEntry({ ...blank, memo: '메모만' }), false);
  assert.equal(isBlankHouseholdEntry({ ...blank, amount: '1000' }), false);
  const rows = [blank].filter(e => !isBlankHouseholdEntry(e)).map(entry => ({ entry, selected: true }));
  const preview = previewHouseholdSave(rows, [], {});
  assert.equal(preview.total, 0);
  assert.equal(preview.unchecked, 0);
  assert.doesNotMatch(householdSaveLabel(preview), /확인 필요/);
});

test('자동 생성 본문 규칙은 저장 서비스와 같고 사용자 본문과 구분된다', () => {
  const entries = [tx('a'), tx('b', { memo: '' })];
  assert.equal(householdSayuText(entries), '[지출] 2026-10-05 4500원 시험 식당\n메모: 원본 메모\n\n[지출] 2026-10-05 4500원 시험 식당');
});
