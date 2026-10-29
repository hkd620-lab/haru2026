// 실행: node --import tsx --test test/householdCategories.test.mjs
// 합성 자료만 사용한다. 유형별 사용자 분류·세부분류·보관·이름 바꾸기와 거래처 기억 규칙.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HOUSEHOLD_CATEGORIES, HOUSEHOLD_CATEGORY_LIMITS, applyHouseholdCategoryAction, emptyHouseholdCategories,
  householdCategoryOptions, householdSubcategoryOptions, mergeHouseholdCategories, parseHouseholdCategories,
} from '../src/app/services/householdCategories.ts';
import {
  HOUSEHOLD_VENDOR_RULE_LIMIT, emptyHouseholdSettingsState, findHouseholdVendorRule, householdRuleArchived, householdSuggestionRules,
  mergeLoadedHouseholdSettings, normalizeHouseholdVendor, parseHouseholdVendorRules,
  readHouseholdSuggestionBasis, removeHouseholdVendorRule, resuggestHouseholdCategory, suggestHouseholdCategory, upsertHouseholdVendorRule,
} from '../src/app/services/householdVendorRules.ts';
import { readFileSync } from 'node:fs';
import { mapCategory, parseKakaoBankWorkbook } from '../src/app/services/householdKakaoImport.ts';

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

test('은행 미리보기에서 거래처를 고치면 이전 거래처의 기억 분류·세부분류를 지우고 새 거래처 기준으로 다시 정한다', async () => {
  const row = (time, vendor) => ['', time, '출금', '4,500', '100000', '체크카드결제', vendor, ''];
  const parsed = await parseKakaoBankWorkbook({ SheetNames: ['내역'], Sheets: { 내역: [row('2026.10.05 12:00:00', '단골 식당')] } }, { utils: { sheet_to_json: sheet => sheet } }, '합성.xlsx');
  let rules = upsertHouseholdVendorRule({ version: 1, rules: [] }, { type: '지출', vendor: '단골 식당', category: '식비', subcategory: '외식' }, 't').rules;
  rules = upsertHouseholdVendorRule({ version: 1, rules }, { type: '지출', vendor: '동네 약국', category: '의료비' }, 't').rules;
  const views = mergeHouseholdCategories(emptyHouseholdCategories());
  const original = parsed.rows[0].entry;
  const remembered = suggestHouseholdCategory(original, rules, views);
  assert.deepEqual([remembered.category, remembered.subcategory, remembered.categorySource], ['식비', '외식', 'rule']);
  const change = (entry, vendor) => resuggestHouseholdCategory({ ...entry, vendor }, mapCategory(entry.transactionType, vendor), rules, views);
  const identity = entry => [entry.id, entry.importSource.key, entry.importSource.fileDigest, entry.amount, entry.date, entry.transactionAt, entry.balanceAfter];

  // 규칙 없는 거래처: 첫 선택지(식비)가 아니라 파서 기본값 '기타' + 확인 필요, 이전 세부분류 없음.
  const noRule = change(remembered, '처음 가는 가게');
  assert.deepEqual([noRule.category, noRule.categorySource, 'subcategory' in noRule], ['기타', 'import-default', false]);
  assert.equal(householdCategoryOptions(views.지출)[0], '식비');
  // 파서 기본값은 새 거래처로 다시 계산한다(구독 키워드).
  assert.deepEqual([change(remembered, 'Netflix').category, change(remembered, 'Netflix').categorySource], ['구독료', 'import-default']);
  // 규칙 있는 다른 거래처: 그 규칙으로 다시 제안하고 세부분류가 없는 규칙이면 이전 세부분류를 남기지 않는다.
  const otherRule = change(remembered, '동네 약국');
  assert.deepEqual([otherRule.category, otherRule.categorySource, 'subcategory' in otherRule], ['의료비', 'rule', false]);
  // 원래 거래처로 되돌리면 다시 원래 기억 분류.
  const back = change(noRule, '단골 식당');
  assert.deepEqual([back.category, back.subcategory, back.categorySource], ['식비', '외식', 'rule']);
  // 사용자가 직접 고른 분류·세부분류는 거래처를 바꿔도 그대로다.
  const user = { ...remembered, category: '쇼핑', subcategory: '생활', categorySource: 'user' };
  assert.deepEqual(change(user, '동네 약국'), { ...user, vendor: '동네 약국' });
  // 출처 키·식별자·금액·날짜·잔액은 어떤 경우에도 바뀌지 않는다.
  for (const entry of [noRule, otherRule, back, change(user, 'x')]) assert.deepEqual(identity(entry), identity(original));
  // 원본 객체도 바꾸지 않는다.
  assert.equal(remembered.vendor, '단골 식당');
  assert.equal(remembered.subcategory, '외식');
});

test('은행 미리보기의 거래처·구분 변경은 같은 재제안 경로를 쓰고 이미 저장된 행 잠금을 유지한다', () => {
  const source = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /<input type="text" value=\{row\.entry\.vendor\} disabled=\{rowLocked\}\s+onChange=\{\(e\) => changeKakaoVendor\(group\.month, row\.id, e\.target\.value\)\}/);
  assert.doesNotMatch(source, /updateKakaoRow\([^)]*\{ vendor:/);
  const handlers = source.slice(source.indexOf('const changeKakaoTransactionType'), source.indexOf('const toggleKakaoRowSelected'));
  assert.match(handlers, /resuggestHouseholdCategory\(\{ \.\.\.entry, vendor \}, kakaoDefaultCategory\(entry\.transactionType, vendor\), rules, householdCategoryViews\)/);
  // 구분을 바꿔도 첫 선택지가 아닌 파서 기본값으로 되돌린다.
  assert.doesNotMatch(handlers, /nextOptions\[0\]/);
  assert.match(handlers, /category: kakaoDefaultCategory\(transactionType, rest\.vendor\), categorySource: 'import-default'/);
  // 행 식별자(row.id)·중복 확인 결과(householdChecks)는 그대로 쓰고, 거래 객체만 교체한다.
  const replace = source.slice(source.indexOf('const replaceKakaoEntry'), source.indexOf('const updateKakaoCategory'));
  assert.match(replace, /if \(r\.id !== rowId\) return r;\s+const entry = change\(r\.entry\);\s+return \{ \.\.\.r, entry, warning/);
});

test('규칙의 보관 판정은 분류 목록과 같은 NFKC·공백·대소문자 기준이며 규칙 자체는 지우지 않는다', () => {
  const settings = apply(emptyHouseholdCategories(), '지출',
    { kind: 'add', name: 'Cafe' }, { kind: 'addSub', category: 'Cafe', name: 'Takeout' },
    { kind: 'archiveSub', category: 'Cafe', name: 'Takeout' });
  const views = mergeHouseholdCategories(settings);
  // 규칙이 다른 대소문자·전각으로 저장돼 있어도 보관한 세부분류는 다시 제안하지 않는다.
  const rules = [{ type: '지출', vendorKey: '시험 카페', vendorLabel: '시험 카페', category: 'ＣＡＦＥ', subcategory: ' takeout ', updatedAt: '' }];
  assert.deepEqual(householdRuleArchived(rules[0], views), { category: false, subcategory: true });
  const entry = { transactionType: '지출', vendor: '시험 카페', category: '기타', categorySource: 'import-default' };
  const suggested = suggestHouseholdCategory(entry, rules, views);
  assert.equal(suggested.category, 'ＣＡＦＥ');
  assert.equal('subcategory' in suggested, false);
  // 분류 자체를 보관하면 제안하지 않는다(대소문자 다름).
  const archivedViews = mergeHouseholdCategories(apply(settings, '지출', { kind: 'archive', name: 'cafe' }));
  assert.deepEqual(householdRuleArchived(rules[0], archivedViews).category, true);
  assert.deepEqual(suggestHouseholdCategory(entry, rules, archivedViews), entry);
  assert.equal(rules.length, 1);
  // 분류 병합도 같은 기준으로 하나로 합친다.
  const merged = mergeHouseholdCategories(settings, [{ transactionType: '지출', category: ' ｃａｆｅ ', subcategory: 'TAKEOUT' }]);
  assert.equal(merged.지출.filter(view => view.name.normalize('NFKC').trim().toLowerCase() === 'cafe').length, 1);
  assert.deepEqual(householdSubcategoryOptions(merged.지출, 'Cafe'), []);
});

test('가계부 화면 설정: 분류 조회 실패로 보관 여부를 모르면 현금 입력에 규칙을 쓰지 않고, 캐시·늦은 결과를 구분한다', () => {
  const rules = upsertHouseholdVendorRule({ version: 1, rules: [] }, { type: '지출', vendor: '단골 식당', category: '쇼핑' }, 't');
  const ok = value => ({ status: 'fulfilled', value });
  const fail = { status: 'rejected', reason: new Error('offline') };
  const categories = apply(emptyHouseholdCategories(), '지출', { kind: 'archive', name: '쇼핑' });
  const none = { categories: false, rules: false };
  // 첫 조회에서 분류 설정만 실패: 규칙은 보관하지만 제안에는 쓰지 않는다.
  const partial = mergeLoadedHouseholdSettings(emptyHouseholdSettingsState(), 'u', { categories: fail, rules: ok(rules) }, none);
  assert.deepEqual([partial.categoriesKnown, partial.rules.length, householdSuggestionRules(partial)], [false, 1, []]);
  assert.match(partial.error, /거래처 분류 제안은 쓰지 않고/);
  // 다른 계정의 이전 상태는 캐시로 쓰지 않는다.
  const otherOwner = { ...partial, ownerUid: 'other', categories, categoriesKnown: true };
  assert.equal(mergeLoadedHouseholdSettings(otherOwner, 'u', { categories: fail, rules: ok(rules) }, none).categoriesKnown, false);
  // 같은 계정에서 이미 읽은 설정(캐시)이 있으면 재조회 실패에도 그 설정과 상태를 유지한다.
  const loaded = mergeLoadedHouseholdSettings(emptyHouseholdSettingsState(), 'u', { categories: ok(categories), rules: ok(rules) }, none);
  assert.deepEqual([loaded.categoriesKnown, householdSuggestionRules(loaded).length, loaded.error], [true, 1, '']);
  const cached = mergeLoadedHouseholdSettings(loaded, 'u', { categories: fail, rules: fail }, none);
  assert.deepEqual([cached.categoriesKnown, cached.categories, cached.rules], [true, categories, loaded.rules]);
  assert.match(cached.error, /불러오지 못했습니다/);
  // 조회 시작 뒤 트랜잭션 결과가 반영된 항목은 늦게 도착한 조회 값으로 덮지 않는다.
  const fresh = { ...loaded, categories: emptyHouseholdCategories(), rules: [] };
  const late = mergeLoadedHouseholdSettings(fresh, 'u', { categories: ok(categories), rules: ok(rules) }, { categories: true, rules: true });
  assert.deepEqual([late.categories, late.rules], [fresh.categories, []]);
  // 화면은 이 함수 결과만 쓰고, 현금 입력에는 보관 여부를 아는 경우의 규칙만 넘긴다.
  const page = readFileSync(new URL('../src/app/pages/HouseholdPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /mergeLoadedHouseholdSettings\(previous, uid, \{ categories, rules \}, changed\)/);
  assert.match(page, /const cashRules = householdSuggestionRules\(ownSettings\);/);
  assert.match(page, /<HouseholdCashEntry[\s\S]{0,300}rules=\{cashRules\}/);
  assert.match(page, /const known = patch\.categories \? \{ categoriesKnown: true \} : \{\};/);
});
