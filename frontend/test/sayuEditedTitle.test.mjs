import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const modal = readFileSync(new URL('../src/app/components/SayuModal.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/app/pages/SayuPage.tsx', import.meta.url), 'utf8');
function handler(source, name, env) {
  const match = source.match(name === 'buildSearchText'
    ? /^  const buildSearchText = [\s\S]*?\.toLowerCase\(\);/m
    : new RegExp(`^  const ${name} = [\\s\\S]*?^  };`, 'm'));
  assert.ok(match, name);
  const { code } = transformSync(match[0], { loader: 'ts' });
  return new Function(...Object.keys(env), `${code}\nreturn ${name};`)(...Object.values(env));
}
const displayEnv = {
  isStructuredAssistantPrefix: () => false, GROWTH_TIMELINE_FORMAT_KEY: 'growthTimeline',
  FORMAT_FIRST_FIELD: { diary: 'diary_simple', memo: 'memo_simple' }, META_SUFFIXES: ['_title', '_ai_title', '_sayu'],
};
const displayTitle = handler(page, 'getRecordDisplayTitle', displayEnv);
const buildSearchText = handler(page, 'buildSearchText', {});

function fixture({ prefix = 'diary', oldTitle = '이전 제목', aiTitle = '과거 AI 제목', editedTitle = '직접 수정한 제목', saveFails = false, refreshFails = false } = {}) {
  const persisted = {
    id: 'fixture', date: '2026-10-27', formats: [prefix === 'memo' ? '메모' : '일기'],
    [`${prefix}_title`]: oldTitle, [`${prefix}_simple`]: '원문 그대로', [`${prefix}_sayu`]: '합성 본문',
    [`${prefix}_ai_comment`]: '기존 한마디', memo_title: prefix === 'memo' ? oldTitle : '다른 형식 제목',
    weather: '쾌청', temperature: '쾌적', mood: '평온', isPublic: false,
  };
  if (aiTitle !== undefined) persisted[`${prefix}_ai_title`] = aiTitle;
  const state = { records: [structuredClone(persisted)], errors: [], warnings: [], refreshes: 0, editing: true, saving: false, remembered: false, published: null };
  const deleted = Symbol('deleteField');
  const user = { uid: 'synthetic-user' };
  const toast = { success() {}, error: value => state.errors.push(value), warning: value => state.warnings.push(value) };
  // 실제 부모 저장 handler도 실행해, 서버 데이터와 화면 records를 구분한다.
  const onSave = handler(page, 'handleSaveSayu', {
    selectedDate: persisted.date, selectedDateFormats: [{ key: prefix, recordId: 'fixture' }], records: state.records, user, toast,
    firestoreService: {
      updateRecord: async (_uid, _id, update) => { if (saveFails) throw new Error('save failed'); Object.assign(persisted, update); },
      publishRecordToShared: async () => { state.published = structuredClone(persisted); },
    },
    setRecords: update => { state.records = update(state.records); }, console: { error() {} },
  });
  const save = handler(modal, 'handleSave', {
    currentUser: user, firestoreId: 'fixture', formatKey: prefix, db: {}, isGrowthTimeline: false,
    doc: (_db, ...parts) => { assert.deepEqual(parts, ['users', 'synthetic-user', 'records', 'fixture']); return {}; },
    deleteField: () => deleted,
    updateDoc: async (_ref, update) => { for (const [key, value] of Object.entries(update)) { if (value === deleted) delete persisted[key]; else persisted[key] = value; } },
    editedTitle, savedDraftRef: { current: { title: oldTitle } }, editedContent: '합성 본문',
    editedWeather: '쾌청', editedTemperature: '쾌적', editedMood: '', isSpecialDay: false, onSave,
    onRefresh: async () => { state.refreshes++; if (refreshFails) throw new Error('refresh failed'); state.records = [structuredClone(persisted)]; },
    setIsSaving: value => { state.saving = value; }, setIsEditing: value => { state.editing = value; },
    rememberSavedEdit: () => { state.remembered = true; }, toast, console: { error() {} },
  });
  return { state, persisted, save, prefix };
}

for (const prefix of ['diary', 'memo']) {
  test(`${prefix}: 수정 제목이 저장·목록·검색·재열기·공개본에 반영되고 본문·다른 형식은 보존된다`, async () => {
    const f = fixture({ prefix }); f.persisted.isPublic = true; f.state.records[0].isPublic = true;
    await f.save();
    assert.equal(f.persisted[`${prefix}_title`], '직접 수정한 제목');
    assert.equal(Object.hasOwn(f.persisted, `${prefix}_ai_title`), false);
    assert.equal(displayTitle(f.state.records[0], prefix, '형식'), '직접 수정한 제목');
    assert.ok(buildSearchText(displayTitle(f.state.records[0], prefix, '형식')).includes('직접 수정한 제목'));
    // 상세 열기는 *_title을 전달하고, 재조회 후 목록은 같은 데이터를 다시 읽는다.
    assert.equal(f.persisted[`${prefix}_title`], displayTitle(structuredClone(f.persisted), prefix, '형식'));
    assert.equal(f.state.published[`${prefix}_title`], '직접 수정한 제목');
    assert.equal(Object.hasOwn(f.state.published, `${prefix}_ai_title`), false);
    assert.equal(f.persisted[`${prefix}_simple`], '원문 그대로');
    assert.equal(f.persisted[`${prefix}_sayu`], '합성 본문');
    assert.equal(f.persisted[`${prefix}_ai_comment`], '기존 한마디');
    assert.equal(f.persisted.mood, '평온');
    if (prefix === 'diary') assert.equal(f.persisted.memo_title, '다른 형식 제목');
    assert.equal(f.state.refreshes, 1); assert.equal(f.state.saving, false); assert.equal(f.state.editing, false);
    assert.deepEqual(f.state.errors, []);
  });
}
for (const editedTitle of ['이전 제목', '  이전 제목  ']) {
  test(`제목을 바꾸지 않은 저장은 과거 AI 제목을 보존한다: ${JSON.stringify(editedTitle)}`, async () => {
    const f = fixture({ editedTitle }); await f.save();
    assert.equal(f.persisted.diary_ai_title, '과거 AI 제목');
    assert.equal(f.persisted.diary_title, '이전 제목');
    assert.equal(f.state.refreshes, 0);
  });
}
test('AI 제목이 없는 기록도 수정 제목으로 조회된다', async () => {
  const f = fixture({ aiTitle: null }); delete f.persisted.diary_ai_title; await f.save();
  assert.equal(displayTitle(f.state.records[0], 'diary', '일기'), '직접 수정한 제목');
});
test('목록 재조회 실패는 저장 실패로 보고하지 않고 경고한다', async () => {
  const f = fixture({ refreshFails: true }); await f.save();
  assert.equal(f.persisted.diary_title, '직접 수정한 제목'); assert.equal(f.state.warnings.length, 1);
  assert.deepEqual(f.state.errors, []); assert.equal(f.state.editing, false); assert.equal(f.state.remembered, true);
});
test('본문 저장 실패 시 성공 후 재조회·편집 완료로 진행하지 않는다', async () => {
  const f = fixture({ saveFails: true }); await f.save();
  assert.equal(f.state.refreshes, 0); assert.equal(f.state.editing, true); assert.equal(f.state.remembered, false);
  assert.equal(f.state.saving, false); assert.equal(f.state.errors.length, 1);
});
