// 실행: node --import tsx --test test/householdCashEntry.test.mjs
// 합성 자료만 사용한다. 현금 간편 입력·저장된 거래 편집·분류 관리 화면의 실제 컴포넌트 SSR.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HouseholdCashEntry, buildHouseholdCashEntry, householdTodayKst, newHouseholdCashDraft } from '../src/app/components/HouseholdCashEntry.tsx';
import { HouseholdBulkSheet, HouseholdEditSheet } from '../src/app/components/HouseholdEditSheet.tsx';
import { HouseholdCategoryManager } from '../src/app/components/HouseholdCategoryManager.tsx';
import { HouseholdCategoryPicker } from '../src/app/components/HouseholdCategoryPicker.tsx';
import { applyHouseholdCategoryAction, emptyHouseholdCategories, mergeHouseholdCategories } from '../src/app/services/householdCategories.ts';
import { readHouseholdDashboard } from '../src/app/utils/householdDashboard.ts';

const noop = () => {};
const views = mergeHouseholdCategories(applyHouseholdCategoryAction(emptyHouseholdCategories(), '지출', { kind: 'archive', name: '쇼핑' }));
const text = markup => markup.replace(/<[^>]+>/g, ' ');

test('기본 날짜는 기기 시간대와 무관한 한국 날짜다', () => {
  // 한국 10월 29일 01:00 = UTC 10월 28일 16:00. toISOString은 하루 전 날짜가 된다.
  const now = new Date('2026-10-28T16:00:00Z');
  assert.equal(householdTodayKst(now), '2026-10-29');
  assert.equal(now.toISOString().slice(0, 10), '2026-10-28');
  assert.equal(householdTodayKst(new Date('2026-10-29T14:59:00Z')), '2026-10-29');
  assert.equal(newHouseholdCashDraft('u', now).date, '2026-10-29');
});

test('현금 거래는 결제수단을 현금으로 고정하고 금액은 양수만, 시트를 연 동안 같은 id를 쓴다', () => {
  const draft = { ...newHouseholdCashDraft('u'), amount: '5천원', vendor: ' 시장 ', category: '식비', subcategory: '장보기', memo: ' 메모 ' };
  const entry = buildHouseholdCashEntry(draft);
  assert.deepEqual(entry, { id: draft.id, transactionType: '지출', category: '식비', date: draft.date, vendor: '시장', amount: '5000', paymentMethod: '현금', memo: '메모', categorySource: 'user', subcategory: '장보기' });
  assert.equal(buildHouseholdCashEntry(draft).id, entry.id);
  assert.match(draft.id, /^[0-9a-f]{32}$/);
  assert.notEqual(newHouseholdCashDraft('u').id, draft.id);
  assert.throws(() => buildHouseholdCashEntry({ ...draft, amount: '0' }), /0보다 큰/);
  assert.throws(() => buildHouseholdCashEntry({ ...draft, amount: '-3000' }), /0보다 큰/);
  assert.throws(() => buildHouseholdCashEntry({ ...draft, amount: '오천원' }), /0보다 큰/);
  assert.throws(() => buildHouseholdCashEntry({ ...draft, vendor: '' }), /사용처/);
  assert.throws(() => buildHouseholdCashEntry({ ...draft, category: '' }), /분류를 선택/);
  assert.throws(() => buildHouseholdCashEntry({ ...draft, date: '2026-02-30' }), /날짜/);
  // 현금 수입은 받은 곳이 없어도 된다. 기억한 분류로 채운 값은 출처를 남긴다.
  const income = buildHouseholdCashEntry({ ...draft, transactionType: '수입', vendor: '', category: '용돈', subcategory: '', categorySource: 'rule' });
  assert.equal(income.paymentMethod, '현금');
  assert.equal(income.categorySource, 'rule');
  assert.equal('subcategory' in income, false);
});

test('현금 입력 화면에는 사진·파일·이체·결제수단·테스트 버튼과 입력 전 거래 건수가 없다', () => {
  const draft = newHouseholdCashDraft('u');
  const markup = renderToStaticMarkup(React.createElement(HouseholdCashEntry, {
    draft, onDraftChange: noop, categories: views, rules: [], onSave: async () => ({}), onCreate: noop, onClose: noop, onSaved: noop,
  }));
  const visible = text(markup);
  assert.match(visible, /현금 거래 추가/);
  assert.match(visible, /지출/);
  assert.match(visible, /현금 수입/);
  assert.match(markup, new RegExp(`value="${draft.date}"`));
  assert.doesNotMatch(visible, /사진|영수증|파일|이체|결제수단|테스트|\d+건|중복/);
  assert.doesNotMatch(markup, /type="file"/);
  // 거래처 기억은 직접 체크해야 한다.
  assert.match(markup, /type="checkbox"(?![^>]*checked)/);
  // 보관한 분류는 새 선택지에 없다.
  assert.doesNotMatch(markup, /<option value="쇼핑">/);
  assert.match(markup, /<option value="식비">/);
  assert.match(markup, /disabled=""[^>]*>현금 지출 저장|현금 지출 저장/);
});

test('저장된 거래 수정 화면은 날짜·금액·거래처를 표시만 하고 분류 확정·기억(기본 꺼짐)을 제공한다', () => {
  const [entry] = readHouseholdDashboard([{ id: '2026-10-01_household', household_entries: JSON.stringify([{ id: 'a', date: '2026-10-05', transactionType: '지출', category: '기타', vendor: '동네 가게', amount: '4500', paymentMethod: '현금', memo: '원래 메모' }]) }]).entries;
  const markup = renderToStaticMarkup(React.createElement(HouseholdEditSheet, { entry, views: views.지출, onSubmit: async () => {}, onCreate: noop, onClose: noop }));
  const visible = text(markup);
  assert.match(visible, /동네 가게/);
  assert.match(visible, /4,500원/);
  assert.match(visible, /‘기타’ 분류로 확정/);
  assert.match(markup, /원래 메모/);
  assert.doesNotMatch(markup, /checked=""/);
  assert.doesNotMatch(markup, /value="동네 가게"/);
  assert.doesNotMatch(markup, /value="4500"/);
});

test('여러 거래 분류 화면은 메모를 바꾸지 않는다고 알리고 현재 분류 건수를 보여 준다', () => {
  const { entries } = readHouseholdDashboard([{ id: 'r', household_entries: JSON.stringify([
    { id: 'a', date: '2026-10-05', transactionType: '지출', category: '기타', vendor: 'A', amount: '1', paymentMethod: '', memo: 'm' },
    { id: 'b', date: '2026-10-06', transactionType: '지출', category: '', vendor: 'B', amount: '2', paymentMethod: '', memo: '' },
  ]) }]);
  const visible = text(renderToStaticMarkup(React.createElement(HouseholdBulkSheet, { entries, views: views.지출, onSubmit: async () => {}, onCreate: noop, onClose: noop })));
  assert.match(visible, /2건 분류 한 번에 바꾸기/);
  assert.match(visible, /메모·금액·날짜·거래처는 그대로/);
  assert.match(visible, /기타 1건 · 분류 없음 1건/);
});

test('분류 관리는 구분별 추가·세부분류·보관 해제와 거래처 기억 탭을 제공한다', () => {
  const visible = text(renderToStaticMarkup(React.createElement(HouseholdCategoryManager, {
    views, rules: [], loadError: '', onAction: async () => {}, onRemoveRule: async () => {}, onShowTransactions: noop, onClose: noop,
  })));
  for (const label of ['지출', '수입', '이체', '거래처 기억', '세부분류 추가', '이름 바꾸기', '보관 해제', '보관']) assert.match(visible, new RegExp(label));
  assert.match(visible, /쇼핑[\s\S]*보관됨/);
});

test('분류 선택은 직접 입력 선택지를 제공하고 표에서도 같은 컴포넌트를 쓴다', () => {
  const markup = renderToStaticMarkup(React.createElement(HouseholdCategoryPicker, { idPrefix: 'p', options: ['식비'], subOptions: () => ['외식'], category: '식비', subcategory: '', onChange: noop, compact: true }));
  assert.match(markup, /＋ 직접 입력/);
  assert.match(markup, /<option value="외식">/);
  const formatModal = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
  assert.match(formatModal, /<HouseholdCategoryPicker compact/);
  assert.doesNotMatch(formatModal, /transactionType === '이체' \? \['이체'\]/);
});

test('은행 버튼은 파일 가져오기 진입 표시를 넘기고 현금 버튼은 같은 화면의 간편 입력을 연다', () => {
  const page = readFileSync(new URL('../src/app/pages/HouseholdPage.tsx', import.meta.url), 'utf8');
  const record = readFileSync(new URL('../src/app/pages/RecordPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /householdEntry: "bank"/);
  assert.match(page, /onClick=\{openCash\}[\s\S]{0,80}현금 거래 추가/);
  // RecordPage는 state를 지우기 전에 진입 방식을 읽어 가계부 형식에만 넘긴다.
  const effect = record.slice(record.indexOf('const incomingHouseholdEntry'), record.indexOf("navigate(location.pathname, { replace: true, state: null })"));
  assert.ok(effect.length > 0 && effect.includes("setHouseholdEntryMode(incomingHouseholdEntry)"));
  assert.match(record, /householdEntryMode=\{savedFormat === 'HARU가계부' \? householdEntryMode : undefined\}/);
});

test('저장 중 상태 확인용 mounted 값은 effect setup에서 다시 true가 되어 StrictMode 재실행 뒤에도 저장 결과를 받는다', () => {
  for (const file of ['HouseholdCashEntry.tsx', 'HouseholdEditSheet.tsx', 'HouseholdCategoryManager.tsx']) {
    const source = readFileSync(new URL(`../src/app/components/${file}`, import.meta.url), 'utf8');
    assert.match(source, /useEffect\(\(\) => \{ mounted\.current = true; return \(\) => \{ mounted\.current = false; \}; \}, \[\]\);/, file);
    assert.doesNotMatch(source, /useEffect\(\(\) => \(\) => \{ mounted\.current = false; \}, \[\]\)/, file);
  }
});

test('분류 관리는 연 계정에만 그리고 계정별 key로 내부 입력을 나누며, 늦은 설정 조회는 최신 변경을 덮지 않는다', () => {
  const page = readFileSync(new URL('../src/app/pages/HouseholdPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /\{uid && managerOwner === uid && \([\s\S]{0,120}<HouseholdCategoryManager\s+key=\{uid\}/);
  // 변경 결과 반영 시 수정 번호를 올리고, 조회는 시작 때 번호와 다르면 그 항목을 덮지 않는다.
  assert.match(page, /if \(patch\.categories\) settingsRevision\.current\.categories\+\+;/);
  assert.match(page, /if \(patch\.rules\) settingsRevision\.current\.rules\+\+;/);
  assert.match(page, /const started = \{ \.\.\.settingsRevision\.current \};/);
  assert.match(page, /keepRules\s*\? own!\.rules/);
  // 현금 재시도가 이미 저장됨이고 첫 시도와 분류가 다를 수 있으면 거래처 기억을 저장하지 않는다.
  assert.match(page, /result\.already && saved\.rememberMismatch\)[\s\S]{0,400}return;/);
});
