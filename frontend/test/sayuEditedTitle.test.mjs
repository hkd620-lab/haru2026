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

function fixture({
  prefix = 'diary', oldTitle = '이전 제목', aiTitle = '과거 AI 제목', editedTitle = '직접 수정한 제목',
  saveFails = false, refreshFails = false, publishFails = false, isPublic = false,
  modalUser = { uid: 'synthetic-user' }, pageUser = { uid: 'synthetic-user' },
  selectedRecordId = 'fixture', selectedKey = prefix, selectedDate = '2026-10-27',
} = {}) {
  const persisted = {
    id: 'fixture', date: '2026-10-27', formats: [prefix === 'memo' ? '메모' : '일기'],
    [`${prefix}_title`]: oldTitle, [`${prefix}_simple`]: '원문 그대로', [`${prefix}_sayu`]: '이전 본문',
    [`${prefix}_ai_comment`]: '기존 한마디', memo_title: prefix === 'memo' ? oldTitle : '다른 형식 제목',
    weather: '흐림', temperature: '추움', mood: '평온', isPublic, specialDays: { [prefix]: false },
  };
  if (aiTitle !== undefined) persisted[`${prefix}_ai_title`] = aiTitle;
  const state = {
    records: [structuredClone(persisted)], errors: [], warnings: [], successes: 0, refreshes: 0, writes: 0,
    editing: true, saving: false, remembered: false, published: null, saveFails, publishFails,
  };
  const toast = { success: () => { state.successes++; }, error: value => state.errors.push(value), warning: value => state.warnings.push(value) };
  // 실제 부모 저장 handler도 실행해, 서버 데이터와 화면 records를 구분한다.
  const onSave = handler(page, 'handleSaveSayu', {
    selectedDate, selectedDateFormats: [{ key: selectedKey, recordId: selectedRecordId }], records: state.records, user: pageUser, toast,
    firestoreService: {
      // 실제 updateRecord처럼 null은 필드 삭제, 점 표기는 맵 하위 필드로 반영한다. 실패하면 아무 필드도 바뀌지 않는다.
      updateRecord: async (uid, id, update) => {
        state.writes++;
        assert.deepEqual([uid, id], ['synthetic-user', 'fixture']);
        if (state.saveFails) throw new Error('save failed');
        for (const [key, value] of Object.entries(update)) {
          const [head, child] = key.split('.');
          if (child) persisted[head] = { ...(persisted[head] || {}), [child]: value };
          else if (value === null) delete persisted[key];
          else persisted[key] = value;
        }
      },
      publishRecordToShared: async () => { if (state.publishFails) throw new Error('publish failed'); state.published = structuredClone(persisted); },
    },
    setRecords: update => { state.records = update(state.records); }, console: { error() {} },
  });
  const save = handler(modal, 'handleSave', {
    currentUser: modalUser, firestoreId: 'fixture', formatKey: prefix, isGrowthTimeline: false,
    editedTitle, savedDraftRef: { current: { title: oldTitle } }, editedContent: '합성 본문',
    editedWeather: '쾌청', editedTemperature: '쾌적', editedMood: '', isSpecialDay: true, onSave,
    onRefresh: async () => { state.refreshes++; if (refreshFails) throw new Error('refresh failed'); state.records = [structuredClone(persisted)]; },
    setIsSaving: value => { state.saving = value; }, setIsEditing: value => { state.editing = value; },
    rememberSavedEdit: () => { state.remembered = true; }, toast, console: { error() {} },
  });
  return { state, persisted, save, prefix };
}

function assertSavedAll(f) {
  const { persisted, prefix } = f;
  assert.equal(persisted[`${prefix}_title`], '직접 수정한 제목');
  assert.equal(Object.hasOwn(persisted, `${prefix}_ai_title`), false);
  assert.equal(persisted[`${prefix}_sayu`], '합성 본문');
  assert.equal(persisted.specialDays[prefix], true);
  assert.equal(persisted.weather, '쾌청'); assert.equal(persisted.temperature, '쾌적');
}

function assertFailedUnchanged(f, before) {
  assert.deepEqual(f.persisted, before);
  assert.deepEqual(f.state.records, [before]);
  assert.equal(f.state.published, null);
  assert.equal(f.state.refreshes, 0); assert.equal(f.state.editing, true); assert.equal(f.state.remembered, false);
  assert.equal(f.state.saving, false); assert.equal(f.state.successes, 0); assert.ok(f.state.errors.length >= 1);
}

for (const prefix of ['diary', 'memo']) {
  test(`${prefix}: 수정 제목이 저장·목록·검색·재열기·공개본에 반영되고 본문·다른 형식은 보존된다`, async () => {
    const f = fixture({ prefix, isPublic: true });
    await f.save();
    assertSavedAll(f);
    assert.equal(f.state.writes, 1);
    assert.equal(displayTitle(f.state.records[0], prefix, '형식'), '직접 수정한 제목');
    assert.ok(buildSearchText(displayTitle(f.state.records[0], prefix, '형식')).includes('직접 수정한 제목'));
    // 상세 열기는 *_title을 전달하고, 재조회 후 목록은 같은 데이터를 다시 읽는다.
    assert.equal(f.persisted[`${prefix}_title`], displayTitle(structuredClone(f.persisted), prefix, '형식'));
    assert.equal(f.state.published[`${prefix}_title`], '직접 수정한 제목');
    assert.equal(Object.hasOwn(f.state.published, `${prefix}_ai_title`), false);
    assert.equal(f.persisted[`${prefix}_simple`], '원문 그대로');
    assert.equal(f.persisted[`${prefix}_ai_comment`], '기존 한마디');
    assert.equal(f.persisted.mood, '평온');
    if (prefix === 'diary') assert.equal(f.persisted.memo_title, '다른 형식 제목');
    assert.equal(f.state.refreshes, 1); assert.equal(f.state.saving, false); assert.equal(f.state.editing, false);
    assert.deepEqual(f.state.errors, []); assert.deepEqual(f.state.warnings, []);
  });
}
for (const editedTitle of ['이전 제목', '  이전 제목  ']) {
  test(`제목을 바꾸지 않은 저장은 과거 AI 제목을 보존한다: ${JSON.stringify(editedTitle)}`, async () => {
    const f = fixture({ editedTitle }); await f.save();
    assert.equal(f.persisted.diary_ai_title, '과거 AI 제목');
    assert.equal(f.state.records[0].diary_ai_title, '과거 AI 제목');
    assert.equal(f.persisted.diary_title, '이전 제목');
    assert.equal(f.persisted.diary_sayu, '합성 본문');
    assert.equal(f.state.writes, 1); assert.equal(f.state.refreshes, 0);
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
test('원자 저장 실패 시 제목·AI제목·날씨·기분·본문·특별한날이 모두 그대로이고, 같은 초안으로 재시도하면 모두 저장된다', async () => {
  const f = fixture({ saveFails: true });
  const before = structuredClone(f.persisted);
  await f.save();
  assertFailedUnchanged(f, before);
  assert.equal(f.state.writes, 1);
  f.state.saveFails = false; f.state.errors.length = 0;
  await f.save();
  assertSavedAll(f);
  assert.equal(f.persisted.mood, '평온'); assert.equal(f.persisted.diary_simple, '원문 그대로');
  assert.equal(f.state.writes, 2); assert.equal(f.state.editing, false); assert.equal(f.state.remembered, true);
  assert.deepEqual(f.state.errors, []); assert.equal(f.state.refreshes, 1);
});
test('공개본 갱신 실패는 원본 저장 실패와 구분해 경고하고 편집을 완료한다', async () => {
  const f = fixture({ isPublic: true, publishFails: true });
  await f.save();
  assertSavedAll(f);
  assert.equal(f.state.published, null);
  assert.deepEqual(f.state.errors, []); assert.equal(f.state.warnings.length, 1);
  assert.match(f.state.warnings[0], /공개본/);
  assert.equal(f.state.editing, false); assert.equal(f.state.remembered, true);
});
test('저장 화면에 로그인이 없으면 쓰기 없이 실패하고 초안을 유지한다', async () => {
  const f = fixture({ modalUser: null }); const before = structuredClone(f.persisted);
  await f.save();
  assertFailedUnchanged(f, before); assert.equal(f.state.writes, 0);
});
test('부모 저장 handler에 로그인이 없으면 쓰기 없이 실패한다', async () => {
  const f = fixture({ pageUser: null }); const before = structuredClone(f.persisted);
  await f.save();
  assertFailedUnchanged(f, before); assert.equal(f.state.writes, 0);
});
test('선택 날짜가 비어 있으면 쓰기 없이 오류를 안내하고 초안을 유지한다', async () => {
  const f = fixture({ selectedDate: '' }); const before = structuredClone(f.persisted);
  await f.save();
  assertFailedUnchanged(f, before); assert.equal(f.state.writes, 0);
  assert.deepEqual(f.state.errors, ['저장할 기록을 확인하지 못했습니다. 다시 열어 시도해주세요.']);
});
for (const [name, options] of [['다른 기록', { selectedRecordId: 'other-record' }], ['다른 형식', { selectedKey: 'memo' }]]) {
  test(`저장 대상이 ${name}이면 덮어쓰지 않고 실패한다`, async () => {
    const f = fixture(options); const before = structuredClone(f.persisted);
    await f.save();
    assertFailedUnchanged(f, before); assert.equal(f.state.writes, 0);
  });
}
