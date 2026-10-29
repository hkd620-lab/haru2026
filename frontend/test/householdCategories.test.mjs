// 실행: node --import tsx --test test/householdCategories.test.mjs
// 합성 자료만 사용한다. 유형별 사용자 분류·세부분류·보관·이름 바꾸기와 거래처 기억 규칙.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HOUSEHOLD_CATEGORIES, HOUSEHOLD_CATEGORY_LIMITS, applyHouseholdCategoryAction, emptyHouseholdCategories,
  householdCategoryOptions, householdSubcategoryOptions, mergeHouseholdCategories, parseHouseholdCategories,
} from '../src/app/services/householdCategories.ts';
import {
  HOUSEHOLD_VENDOR_RULE_LIMIT, findHouseholdVendorRule, normalizeHouseholdVendor, parseHouseholdVendorRules,
  readHouseholdSuggestionBasis, removeHouseholdVendorRule, suggestHouseholdCategory, upsertHouseholdVendorRule,
} from '../src/app/services/householdVendorRules.ts';
import { readFileSync } from 'node:fs';
import { parseKakaoBankWorkbook } from '../src/app/services/householdKakaoImport.ts';

const apply = (settings, type, ...actions) => actions.reduce((current, action) => applyHouseholdCategoryAction(current, type, action), settings);

test('수입·지출·이체마다 기본 분류가 있고 이체에도 선택지가 여러 개다', () => {
  const views = mergeHouseholdCategories(emptyHouseholdCategories());
  assert.deepEqual(householdCategoryOptions(views.이체), ['이체', '계좌이동', '저축·투자', '카드대금', '대출상환', '기타이체']);
  assert.ok(householdCategoryOptions(views.지출).includes('식비'));
  assert.ok(householdCategoryOptions(views.수입).includes('기타수입'));
  // 기본 목록은 코드에만 둔다.
  assert.deepEqual(emptyHouseholdCategories().types, { 지출: [], 수입: [], 이체: [] });
});

test('직접 만든 분류·세부분류는 그 구분 안에서만 재사용되고 같은 이름은 정규화 후 막는다', () => {
  let settings = apply(emptyHouseholdCategories(), '지출', { kind: 'add', name: '  반려동물 ' }, { kind: 'addSub', category: '식비', name: '외식' });
  settings = apply(settings, '수입', { kind: 'add', name: '반려동물' });
  const views = mergeHouseholdCategories(settings);
  assert.ok(householdCategoryOptions(views.지출).includes('반려동물'));
  assert.ok(householdCategoryOptions(views.수입).includes('반려동물'));
  assert.ok(!householdCategoryOptions(views.이체).includes('반려동물'));
  assert.deepEqual(householdSubcategoryOptions(views.지출, '식비'), ['외식']);
  assert.throws(() => apply(settings, '지출', { kind: 'add', name: '반려동물' }), /이미 있는/);
  assert.throws(() => apply(settings, '지출', { kind: 'add', name: '식비' }), /이미 있는/);
  assert.throws(() => apply(settings, '지출', { kind: 'addSub', category: '식비', name: ' 외식' }), /이미 있는/);
  assert.throws(() => apply(settings, '지출', { kind: 'add', name: 'x'.repeat(41) }), /40자/);
  assert.throws(() => apply(settings, '지출', { kind: 'add', name: '   ' }), /입력해/);
});

test('보관은 새 선택지에서만 빼고, 기존 거래에 쓰인 분류와 현재 값은 계속 보인다', () => {
  const settings = apply(emptyHouseholdCategories(), '지출', { kind: 'archive', name: '쇼핑' }, { kind: 'add', name: '경조사' }, { kind: 'archive', name: '경조사' });
  const used = [
    { transactionType: '지출', category: '쇼핑' },
    { transactionType: '지출', category: '예전 사용자 분류', subcategory: '세부A' },
    { transactionType: '지출', category: '예전 사용자 분류' },
  ];
  const views = mergeHouseholdCategories(settings, used);
  const options = householdCategoryOptions(views.지출);
  assert.ok(!options.includes('쇼핑'));
  assert.ok(!options.includes('경조사'));
  assert.ok(options.includes('예전 사용자 분류'));
  assert.equal(views.지출.find(v => v.name === '예전 사용자 분류').usedCount, 2);
  assert.equal(views.지출.find(v => v.name === '예전 사용자 분류').inUseOnly, true);
  assert.equal(views.지출.find(v => v.name === '쇼핑').usedCount, 1);
  assert.ok(householdCategoryOptions(views.지출, '쇼핑').includes('쇼핑'));
  // 같은 이름을 다시 추가하면 보관 해제한다.
  const restored = mergeHouseholdCategories(apply(settings, '지출', { kind: 'add', name: '경조사' }));
  assert.ok(householdCategoryOptions(restored.지출).includes('경조사'));
  const unarchived = mergeHouseholdCategories(apply(settings, '지출', { kind: 'unarchive', name: '쇼핑' }));
  assert.ok(householdCategoryOptions(unarchived.지출).includes('쇼핑'));
});

test('이름 바꾸기는 새 분류 추가 + 기존 분류 보관이며 세부분류를 옮기고 거래는 건드리지 않는다', () => {
  const settings = apply(emptyHouseholdCategories(), '지출', { kind: 'add', name: '취미' }, { kind: 'addSub', category: '취미', name: '등산' },
    { kind: 'rename', from: '취미', to: '여가' });
  const views = mergeHouseholdCategories(settings, [{ transactionType: '지출', category: '취미' }]);
  assert.equal(views.지출.find(v => v.name === '취미').archived, true);
  assert.equal(views.지출.find(v => v.name === '취미').usedCount, 1);
  assert.deepEqual(householdSubcategoryOptions(views.지출, '여가'), ['등산']);
  assert.throws(() => apply(settings, '지출', { kind: 'rename', from: '여가', to: '여가' }), /같습니다/);
  // 세부분류 보관·해제
  const sub = mergeHouseholdCategories(apply(settings, '지출', { kind: 'archiveSub', category: '여가', name: '등산' }));
  assert.deepEqual(householdSubcategoryOptions(sub.지출, '여가'), []);
});

test('분류 개수 상한과 손상된 설정 문서를 빈 설정으로 덮어쓰지 않는 규칙', () => {
  let settings = emptyHouseholdCategories();
  for (let i = 0; i < HOUSEHOLD_CATEGORY_LIMITS.categories; i++) settings.types.지출.push({ name: `분류${i}`, subcategories: [], archivedSubcategories: [] });
  assert.throws(() => apply(settings, '지출', { kind: 'add', name: '하나 더' }), /200개/);
  assert.deepEqual(parseHouseholdCategories(undefined), emptyHouseholdCategories());
  assert.throws(() => parseHouseholdCategories({ types: 'broken' }), /읽지 못했습니다/);
  assert.throws(() => parseHouseholdCategories({ types: { 지출: [{ nope: 1 }] } }), /읽지 못했습니다/);
  assert.equal(DEFAULT_HOUSEHOLD_CATEGORIES.지출.length, 11);
});

test('거래처 기억은 정규화 후 정확히 같은 거래처·구분일 때만 찾는다', () => {
  const rules = upsertHouseholdVendorRule({ version: 1, rules: [] }, { type: '지출', vendor: ' 시험  Cafe.강남|1 ', category: '식비', subcategory: '카페' }, 't').rules;
  assert.equal(normalizeHouseholdVendor('시험 CAFE.강남|1'), '시험 cafe.강남|1');
  assert.equal(findHouseholdVendorRule(rules, '지출', '시험 cafe.강남|1')?.category, '식비');
  assert.equal(findHouseholdVendorRule(rules, '지출', '시험 cafe'), undefined);
  assert.equal(findHouseholdVendorRule(rules, '수입', '시험 cafe.강남|1'), undefined);
  // 같은 거래처를 다시 기억하면 하나로 바꾼다.
  const replaced = upsertHouseholdVendorRule({ version: 1, rules }, { type: '지출', vendor: '시험 cafe.강남|1', category: '교통비' }, 't2').rules;
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].category, '교통비');
  assert.equal(replaced[0].subcategory, undefined);
  assert.equal(removeHouseholdVendorRule({ version: 1, rules: replaced }, '지출', replaced[0].vendorKey).rules.length, 0);
  assert.throws(() => upsertHouseholdVendorRule({ version: 1, rules: [] }, { type: '지출', vendor: '  ', category: '식비' }), /거래처가 있는/);
  const full = { version: 1, rules: Array.from({ length: HOUSEHOLD_VENDOR_RULE_LIMIT }, (_, i) => ({ type: '지출', vendorKey: `v${i}`, vendorLabel: `v${i}`, category: '식비', updatedAt: '' })) };
  assert.throws(() => upsertHouseholdVendorRule(full, { type: '지출', vendor: 'new', category: '식비' }), /2000개/);
  assert.throws(() => parseHouseholdVendorRules({ rules: [{ type: '지출' }] }), /읽지 못했습니다/);
});

test('제안은 비어 있거나 자동 기본값인 새 거래에만 채우고 사용자가 고른 분류는 덮지 않는다', () => {
  const rules = upsertHouseholdVendorRule({ version: 1, rules: [] }, { type: '지출', vendor: '단골 식당', category: '식비', subcategory: '외식' }, 't').rules;
  const base = { transactionType: '지출', vendor: '단골 식당', category: '', subcategory: undefined, categorySource: undefined };
  assert.deepEqual(suggestHouseholdCategory(base, rules), { ...base, category: '식비', subcategory: '외식', categorySource: 'rule' });
  assert.equal(suggestHouseholdCategory({ ...base, category: '기타', categorySource: 'import-default' }, rules).category, '식비');
  assert.equal(suggestHouseholdCategory({ ...base, category: '쇼핑', categorySource: 'user' }, rules).category, '쇼핑');
  // 출처가 없는 기존 거래 값(예: 저장된 529건과 같은 형태)도 덮지 않는다.
  assert.equal(suggestHouseholdCategory({ ...base, category: '기타' }, rules).category, '기타');
  assert.equal(suggestHouseholdCategory({ ...base, vendor: '다른 식당' }, rules).category, '');
});

test('은행 파일의 분류는 자동 기본값으로 표시되어 거래처 기억이 그 위에만 적용된다', async () => {
  const row = (time, vendor) => ['', time, '출금', '4,500', '100000', '체크카드결제', vendor, ''];
  const parsed = await parseKakaoBankWorkbook({ SheetNames: ['내역'], Sheets: { 내역: [row('2026.10.05 12:00:00', '단골 식당'), row('2026.10.06 12:00:00', 'Netflix')] } }, { utils: { sheet_to_json: sheet => sheet } }, '합성.xlsx');
  assert.deepEqual(parsed.rows.map(r => [r.entry.category, r.entry.categorySource]), [['기타', 'import-default'], ['구독료', 'import-default']]);
  const rules = upsertHouseholdVendorRule({ version: 1, rules: [] }, { type: '지출', vendor: '단골 식당', category: '식비' }, 't').rules;
  const suggested = parsed.rows.map(r => suggestHouseholdCategory(r.entry, rules));
  assert.deepEqual(suggested.map(e => [e.category, e.categorySource]), [['식비', 'rule'], ['구독료', 'import-default']]);
  // 출처 키·식별자는 분류와 무관하다.
  assert.equal(suggested[0].importSource.key, parsed.rows[0].entry.importSource.key);
  assert.equal(suggested[0].id, parsed.rows[0].entry.id);
});

test('은행 파일 제안 기준은 최신 분류 설정과 규칙을 함께 읽고, 설정을 못 읽으면 규칙을 적용하지 않는다', async () => {
  const rules = upsertHouseholdVendorRule({ version: 1, rules: [] }, { type: '지출', vendor: '단골 식당', category: '쇼핑' }, 't');
  const entry = { id: 'kakao-1', importSource: { key: 'k1' }, transactionType: '지출', vendor: '단골 식당', category: '기타', categorySource: 'import-default' };
  // 파일을 고른 시점에는 보관 전이었더라도, 새로 읽은 설정에서 보관된 분류는 제안하지 않는다.
  const archived = apply(emptyHouseholdCategories(), '지출', { kind: 'archive', name: '쇼핑' });
  const fresh = await readHouseholdSuggestionBasis({ categories: async () => archived, rules: async () => rules });
  assert.equal(fresh.failed, false);
  assert.equal(fresh.settings, archived);
  assert.deepEqual(suggestHouseholdCategory(entry, fresh.rules, fresh.views), entry);
  // 분류 설정 실패: 보관 여부를 모르므로 규칙을 버리고 기본 분류·재시도 안내.
  const noSettings = await readHouseholdSuggestionBasis({ categories: async () => { throw new Error('offline'); }, rules: async () => rules });
  assert.deepEqual([noSettings.failed, noSettings.settings, noSettings.rules], [true, null, []]);
  assert.ok(householdCategoryOptions(noSettings.views.지출).includes('식비'));
  assert.deepEqual(suggestHouseholdCategory(entry, noSettings.rules, noSettings.views), entry);
  // 규칙 실패: 설정은 쓰고 규칙 없이 안내.
  const noRules = await readHouseholdSuggestionBasis({ categories: async () => emptyHouseholdCategories(), rules: async () => { throw new Error('offline'); } });
  assert.deepEqual([noRules.failed, noRules.rules], [true, []]);
  // 둘 다 성공하고 보관되지 않았으면 제안하며, 식별자·원본 키는 그대로다.
  const ok = await readHouseholdSuggestionBasis({ categories: async () => emptyHouseholdCategories(), rules: async () => rules });
  const suggested = suggestHouseholdCategory(entry, ok.rules, ok.views);
  assert.deepEqual([suggested.category, suggested.categorySource, suggested.id, suggested.importSource.key], ['쇼핑', 'rule', 'kakao-1', 'k1']);
});

test('은행 화면의 분류 설정은 계정·편집 세션·수정 번호 경계 안에서만 반영한다', () => {
  const source = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
  const settings = source.slice(source.indexOf('const [householdCategorySettings'), source.indexOf('const householdSavePreview'));
  // 최초 조회: 같은 계정·세션·수정 번호일 때만 반영, 실패 안내도 같은 계정·세션에서만.
  assert.match(settings, /active && ownsHouseholdSession\(uid, session\) && revision === householdCategoryRevision\.current\) keepHouseholdCategories/);
  assert.match(settings, /\.catch\(\(\) => \{ if \(active && ownsHouseholdSession\(uid, session\)\) toast\.info\(/);
  // 직접 추가: 결과·이전 분류명 안내 모두 계정·세션 확인 뒤에만.
  assert.match(settings, /\.then\(settings => \{ if \(ownsHouseholdSession\(uid, session\)\) keepHouseholdCategories/);
  assert.match(settings, /if \(ownsHouseholdSession\(uid, session\) && !\/이미 있는\/\.test/);
  assert.match(settings, /householdCategoryRevision\.current\+\+/);
  // 파일 처리: 렌더 closure의 views가 아니라 새로 읽은 기준을 첫 중복 확인 전에 쓴다.
  const parse = source.slice(source.indexOf('const handleKakaoXlsxDecryptAndParse'), source.indexOf('const recomputeKakaoRowWarning'));
  assert.ok(parse.indexOf('readHouseholdSuggestionBasis') < parse.indexOf('checkHouseholdDuplicates'));
  assert.match(parse, /if \(!ownsHouseholdSession\(uid, session\)\) return;/);
  assert.match(parse, /suggestHouseholdCategory\(row\.entry, basis\.rules, basis\.views\)/);
  assert.doesNotMatch(parse, /householdCategoryViews/);
});
