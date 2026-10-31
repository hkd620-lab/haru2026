import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { getFormatKey } from '../src/app/records/formatRegistry.ts';

// FormatModal의 실제 원본 저장 handler와 자동 제목 대상 판정을 원문에서 꺼내 가짜 callable·메모리 저장으로 실행한다.
const source = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
function compile(snippet, name, env) {
  const { code } = transformSync(snippet, { loader: 'ts' });
  return new Function(...Object.keys(env), `${code}\nreturn ${name};`)(...Object.values(env));
}
function topLevelConst(name, env) {
  const found = source.match(new RegExp(`^  const ${name} = .*;$`, 'm'));
  assert.ok(found, name);
  return compile(found[0], name, env);
}
function handler(name, env) {
  const found = source.match(new RegExp(`^  const ${name} = [\\s\\S]*?^  };`, 'm'));
  assert.ok(found, name);
  return compile(found[0], name, env);
}

// 화면을 그릴 때처럼 원문의 getOriginalSaveContext와 ref 갱신 줄을 실행한다(사진·작물·성장 대상 등 formData 밖 입력)
function renderContext(originalSaveContextRef, { recordStyle = 'simple', uploadedImages = [], imageMeta = '[]', selectedCrops = [], growth = {} } = {}) {
  const env = { recordStyle, uploadedImages, selectedCrops, getUploadedImageMetaForSave: () => imageMeta, getGrowthSaveFields: () => growth };
  env.getOriginalSaveContext = topLevelConst('getOriginalSaveContext', env);
  const assign = source.match(/^  originalSaveContextRef\.current = .*;$/m);
  assert.ok(assign, 'originalSaveContextRef 갱신');
  compile(assign[0], 'undefined', { ...env, originalSaveContextRef });
  return env;
}

function fixture({ format = '일기', formData = {}, initialData = {}, extract, context } = {}) {
  const prefix = getFormatKey(format);
  const sayuKey = `${prefix}_sayu`;
  const isStockFormat = topLevelConst('isStockFormat', { format });
  const canAutoTitleOnOriginalSave = topLevelConst('canAutoTitleOnOriginalSave', { format, isStockFormat, initialData, sayuKey, prefix });
  const state = { calls: [], saves: [], warnings: [], errors: [], infos: [], navigations: [], special: [], saving: false, savingSets: [] };
  const formDataRef = { current: formData };
  const photoEditorSessionRef = { current: 1 };
  const isSavingOriginalRef = { current: null };
  const originalSaveContextRef = { current: '' };
  const contextEnv = renderContext(originalSaveContextRef, context);
  const env = {
    format, prefix, sayuKey, formData, formDataRef, initialData, isStockFormat, canAutoTitleOnOriginalSave,
    isLedgerFormat: format === 'HARU보조장부', isHouseholdFormat: format === 'HARU가계부',
    handleSaveLedgerEntries: async () => { state.special.push('ledger'); },
    handleSaveHouseholdEntries: async () => { state.special.push('household'); },
    isCleaningSessionUploadsRef: { current: false }, isSavingOriginalRef, photoEditorSessionRef,
    DIARY_PREMIUM_FIELDS: [], fields: [], ...contextEnv, originalSaveContextRef,
    imagesKey: `${prefix}_images`, imageMetaKey: `${prefix}_imageMeta`,
    setIsSaving: value => { state.saving = value; state.savingSets.push(value); },
    toast: { warning: v => state.warnings.push(v), error: v => state.errors.push(v), success() {}, info: v => state.infos.push(v) },
    console: { warn() {}, error: e => state.errors.push(String(e)) },
    getFunctions: (_app, region) => { assert.equal(region, 'asia-northeast3'); return {}; },
    httpsCallable: (_functions, name) => {
      assert.equal(name, 'extractTitle');
      return async payload => {
        state.calls.push(structuredClone(payload));
        return extract ? extract(payload) : { data: { title: '산책한 날' } };
      };
    },
    onSave: async payload => { state.saves.push(structuredClone(payload)); return 'synthetic-record'; },
    navigate: (path, options) => state.navigations.push({ path, options }),
  };
  // rerender: 화면이 다시 그려진 것처럼 최신 formData로 handler를 다시 만든다(ref·저장소는 공유)
  const rerender = next => { formDataRef.current = next; return handler('handleSaveOriginalAsSayu', { ...env, formData: next }); };
  // changeContext: 기다리는 동안 사진·작물 등이 바뀌어 화면이 다시 그려진 것처럼 ref만 최신 값으로 바꾼다
  const changeContext = next => renderContext(originalSaveContextRef, next);
  return { state, formDataRef, photoEditorSessionRef, isSavingOriginalRef, originalSaveContextRef, rerender, changeContext, save: handler('handleSaveOriginalAsSayu', env) };
}

const BODY = '오늘 아침 공원을 한 바퀴 걸었다.\n바람이 시원했다.';

test('제목 없는 새 일반 기록은 extractTitle 결과를 같은 저장 payload의 제목에 넣는다', async () => {
  const f = fixture({ formData: { diary_simple: BODY } });
  await f.save();
  assert.equal(f.state.calls.length, 1);
  assert.deepEqual(f.state.calls[0], { text: BODY, format: '일기' });
  assert.equal(f.state.saves.length, 1);
  assert.equal(f.state.saves[0].diary_title, '산책한 날');
  assert.equal(f.state.saves[0].diary_sayu, BODY);
  assert.equal(f.state.saves[0].diary_mode, 'ORIGINAL');
  assert.equal(f.state.navigations[0].path, '/sayu');
  assert.deepEqual(f.state.warnings, []);
  assert.equal(f.state.saving, false);
});

test('사용자가 적은 제목은 그대로 저장하고 extractTitle을 부르지 않는다', async () => {
  const f = fixture({ formData: { diary_simple: BODY, diary_title: '내가 붙인 제목' } });
  await f.save();
  assert.equal(f.state.calls.length, 0);
  assert.equal(f.state.saves[0].diary_title, '내가 붙인 제목');
});

test('기존 기록은 제목을 자동으로 바꾸지 않는다', async () => {
  // 기존 제목이 있는 기록은 그 제목으로 저장
  const kept = fixture({ initialData: { diary_title: '원래 제목', diary_sayu: '옛 본문' }, formData: { diary_simple: BODY, diary_title: '원래 제목', diary_sayu: '옛 본문' } });
  await kept.save();
  assert.equal(kept.state.calls.length, 0);
  assert.equal(kept.state.saves[0].diary_title, '원래 제목');

  // 기존 기록(저장된 본문·기존 제목·기록 ID)에서 제목을 비우면 예전처럼 막고 AI를 부르지 않는다
  for (const initialData of [
    { diary_sayu: '옛 본문' },
    { diary_title: '원래 제목' },
    { _recordId: 'existing-record', diary_simple: BODY },
  ]) {
    const f = fixture({ initialData, formData: { ...initialData, diary_title: '', diary_simple: BODY } });
    await f.save();
    assert.equal(f.state.calls.length, 0, JSON.stringify(initialData));
    assert.equal(f.state.saves.length, 0, JSON.stringify(initialData));
    assert.equal(f.state.warnings.length, 1, JSON.stringify(initialData));
  }
});

test('AI 실패·빈 결과·짧은 본문이어도 본문 첫 줄을 제목으로 저장한다', async () => {
  const failed = fixture({ formData: { diary_simple: BODY }, extract: async () => { throw new Error('deadline-exceeded'); } });
  await failed.save();
  assert.equal(failed.state.calls.length, 1);
  assert.equal(failed.state.saves.length, 1);
  assert.equal(failed.state.saves[0].diary_title, '오늘 아침 공원을 한 바퀴 걸었다.'.slice(0, 20));
  assert.equal(failed.state.saving, false);

  const empty = fixture({ formData: { diary_simple: BODY }, extract: async () => ({ data: { title: '' } }) });
  await empty.save();
  assert.equal(empty.state.saves[0].diary_title, '오늘 아침 공원을 한 바퀴 걸었다.'.slice(0, 20));

  const short = fixture({ formData: { diary_simple: '  비 옴 ' } });
  await short.save();
  assert.equal(short.state.calls.length, 0);
  assert.equal(short.state.saves[0].diary_title, '비 옴');
});

test('빈 본문은 예전처럼 막고 AI를 부르지 않는다', async () => {
  const f = fixture({ formData: { diary_simple: '   ' } });
  await f.save();
  assert.equal(f.state.calls.length, 0);
  assert.equal(f.state.saves.length, 0);
  assert.equal(f.state.errors.length, 1);
});

test('독서·주식·가계부·보조장부는 기존 저장 계약을 유지하고 AI 제목을 부르지 않는다', async () => {
  const reading = fixture({ format: '독서사유', formData: { reading_simple: BODY, reading_book_title: '합성 책' } });
  await reading.save();
  assert.equal(reading.state.calls.length, 0);
  assert.equal(reading.state.saves[0].reading_title, '합성 책');

  const stock = fixture({ format: '주식거래일지', formData: { stock_simple: BODY, stock_name: '합성전자', stock_type: '매수', stock_quantity: '10' } });
  await stock.save();
  assert.equal(stock.state.calls.length, 0);
  assert.equal(stock.state.saves[0].stock_title, '합성전자 매수 10');

  const stockNoName = fixture({ format: '주식거래일지', formData: { stock_simple: BODY } });
  await stockNoName.save();
  assert.equal(stockNoName.state.calls.length, 0);
  assert.equal(stockNoName.state.saves.length, 0);
  assert.equal(stockNoName.state.warnings.length, 1);

  for (const [format, kind] of [['HARU가계부', 'household'], ['HARU보조장부', 'ledger']]) {
    const f = fixture({ format, formData: {} });
    await f.save();
    assert.deepEqual(f.state.special, [kind]);
    assert.equal(f.state.calls.length, 0);
    assert.equal(f.state.saves.length, 0);
  }
});

test('연속 클릭해도 제목 추출과 저장은 한 번만 일어난다', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture({ formData: { diary_simple: BODY }, extract: async () => { await gate; return { data: { title: '산책한 날' } }; } });
  const first = f.save();
  const second = f.save();
  release();
  await Promise.all([first, second]);
  assert.equal(f.state.calls.length, 1);
  assert.equal(f.state.saves.length, 1);

  // 저장이 끝나면 다시 저장할 수 있다
  await f.save();
  assert.equal(f.state.saves.length, 2);
});

test('제목을 만드는 동안 사용자가 제목을 적으면 그 제목을 저장한다', async () => {
  let f;
  f = fixture({
    formData: { diary_simple: BODY },
    extract: async () => {
      f.formDataRef.current = { diary_simple: BODY, diary_title: '방금 적은 제목' };
      return { data: { title: '산책한 날' } };
    },
  });
  await f.save();
  assert.equal(f.state.saves[0].diary_title, '방금 적은 제목');
});

test('제목을 만드는 동안 본문을 고치면 저장하지 않고 안내하며, 다시 누르면 고친 본문으로 저장한다', async () => {
  const EDITED = `${BODY}\n덧붙인 문장.`;
  let f;
  f = fixture({
    formData: { diary_simple: BODY },
    extract: async () => {
      f.formDataRef.current = { diary_simple: EDITED };
      return { data: { title: '산책한 날' } };
    },
  });
  await f.save();
  assert.equal(f.state.saves.length, 0);
  assert.equal(f.state.navigations.length, 0);
  assert.equal(f.state.infos.length, 1);
  assert.equal(f.formDataRef.current.diary_simple, EDITED, '지금 입력은 그대로 남는다');
  assert.equal(f.isSavingOriginalRef.current, null);
  assert.equal(f.state.saving, false);

  // 다시 그려진 화면에서 다시 누르면 고친 본문으로 저장된다
  const retry = f.rerender({ diary_simple: EDITED });
  await retry();
  assert.equal(f.state.saves.length, 1);
  assert.equal(f.state.saves[0].diary_sayu, EDITED);
  assert.equal(f.state.saves[0].diary_title, '산책한 날');
  assert.equal(f.state.navigations[0].path, '/sayu');
});

test('제목을 만드는 동안 제목만 적으면 경고 없이 그 제목으로 저장한다', async () => {
  let f;
  f = fixture({
    formData: { diary_simple: BODY, diary_title: '' },
    extract: async () => {
      f.formDataRef.current = { diary_simple: BODY, diary_title: '내 제목' };
      return { data: { title: '산책한 날' } };
    },
  });
  await f.save();
  assert.deepEqual(f.state.infos, []);
  assert.equal(f.state.saves.length, 1);
  assert.equal(f.state.saves[0].diary_title, '내 제목');
});

test('제목을 기다리는 동안 편집 세션이 바뀌면 저장·이동하지 않고, 새 세션의 잠금은 풀지 않는다', async () => {
  // 1) 화면을 닫거나 언마운트되어 세션만 바뀐 경우: 저장 0, 이동 0, 남은 잠금은 정리
  let closed;
  closed = fixture({
    formData: { diary_simple: BODY },
    extract: async () => { closed.photoEditorSessionRef.current += 1; return { data: { title: '산책한 날' } }; },
  });
  await closed.save();
  assert.equal(closed.state.saves.length, 0);
  assert.equal(closed.state.navigations.length, 0);
  assert.deepEqual(closed.state.infos, []);
  assert.equal(closed.isSavingOriginalRef.current, null);

  // 2) 새 세션이 기다리는 동안 저장을 시작한 경우: 옛 응답은 새 세션의 잠금·저장 중 표시를 풀지 않는다
  let releaseOld;
  const oldGate = new Promise(resolve => { releaseOld = resolve; });
  let releaseNew;
  const newGate = new Promise(resolve => { releaseNew = resolve; });
  let call = 0;
  const f = fixture({
    formData: { diary_simple: BODY },
    extract: async () => { call += 1; if (call === 1) { await oldGate; return { data: { title: '옛 제목' } }; } await newGate; return { data: { title: '새 제목' } }; },
  });
  const oldSave = f.save();
  await Promise.resolve();
  f.photoEditorSessionRef.current += 1;
  const NEW_BODY = '다른 기록의 본문을 적었다.';
  const newSave = f.rerender({ diary_simple: NEW_BODY })();
  await Promise.resolve();
  assert.equal(f.isSavingOriginalRef.current, 2);
  releaseOld();
  await oldSave;
  assert.equal(f.state.saves.length, 0, '옛 응답으로 저장하지 않는다');
  assert.equal(f.state.navigations.length, 0, '옛 응답으로 이동하지 않는다');
  assert.equal(f.isSavingOriginalRef.current, 2, '새 세션 잠금 유지');
  assert.equal(f.state.saving, true, '새 세션 저장 중 표시 유지');
  assert.deepEqual(f.state.savingSets, [true, true]);
  releaseNew();
  await newSave;
  assert.equal(f.state.saves.length, 1);
  assert.equal(f.state.saves[0].diary_sayu, NEW_BODY);
  assert.equal(f.state.saves[0].diary_title, '새 제목');
  assert.equal(f.isSavingOriginalRef.current, null);
  assert.equal(f.state.saving, false);
});

test('callable 응답 title이 문자열이 아니면 첫 줄 제목으로 저장한다', async () => {
  for (const title of [{ text: '객체' }, 123, ['배열'], null]) {
    const f = fixture({ formData: { diary_simple: BODY }, extract: async () => ({ data: { title } }) });
    await f.save();
    assert.equal(f.state.saves[0].diary_title, '오늘 아침 공원을 한 바퀴 걸었다.'.slice(0, 20), JSON.stringify(title));
  }
  const nullData = fixture({ formData: { diary_simple: BODY }, extract: async () => ({ data: null }) });
  await nullData.save();
  assert.equal(nullData.state.saves[0].diary_title, '오늘 아침 공원을 한 바퀴 걸었다.'.slice(0, 20));
});

test('AI에는 서버가 쓰는 앞 600자만 보낸다', async () => {
  const long = '가'.repeat(900);
  const f = fixture({ formData: { diary_simple: long } });
  await f.save();
  assert.equal(f.state.calls[0].text, long.slice(0, 600));
  assert.equal(f.state.saves[0].diary_sayu, long);
});

test('formData 밖 입력의 비교값은 원문 계산식대로 기록 방식·사진·사진 정보·작물·성장 대상을 담는다', () => {
  const ref = { current: '' };
  const growth = { _growthSubjectName: '합성 아이', _growthSubjectGender: 'girl' };
  renderContext(ref, { recordStyle: 'premium', uploadedImages: ['https://synthetic/a.jpg'], imageMeta: '[{"url":"https://synthetic/a.jpg"}]', selectedCrops: ['상추'], growth });
  assert.deepEqual(JSON.parse(ref.current), ['premium', ['https://synthetic/a.jpg'], '[{"url":"https://synthetic/a.jpg"}]', ['상추'], growth]);
});

test('제목을 만드는 동안 사진·사진 정보·작물·성장 대상·기록 방식이 바뀌면 저장하지 않고 안내한다', async () => {
  const BASE = { uploadedImages: ['https://synthetic/a.jpg'], imageMeta: '[{"url":"https://synthetic/a.jpg"}]', selectedCrops: ['상추'], growth: { _growthSubjectName: '합성 아이' } };
  const changes = {
    사진: { uploadedImages: ['https://synthetic/a.jpg', 'https://synthetic/b.jpg'] },
    사진정보: { imageMeta: '[{"url":"https://synthetic/a.jpg","caption":"새 설명"}]' },
    작물: { selectedCrops: ['상추', '토마토'] },
    성장대상: { growth: { _growthSubjectName: '다른 아이' } },
    성별생일: { growth: { _growthSubjectName: '합성 아이', _growthSubjectGender: 'boy', _growthSubjectBirthdate: '2020-01-01' } },
    기록방식: { recordStyle: 'premium' },
  };
  for (const [label, change] of Object.entries(changes)) {
    let f;
    f = fixture({
      formData: { diary_simple: BODY },
      context: BASE,
      extract: async () => { f.changeContext({ ...BASE, ...change }); return { data: { title: '산책한 날' } }; },
    });
    await f.save();
    assert.equal(f.state.saves.length, 0, label);
    assert.equal(f.state.navigations.length, 0, label);
    assert.equal(f.state.infos.length, 1, label);
    assert.equal(f.isSavingOriginalRef.current, null, label);
    assert.equal(f.state.saving, false, label);
  }
});

test('제목을 기다리는 동안 다시 그려져도 사진·작물 등이 그대로면 기존처럼 저장한다', async () => {
  const BASE = { uploadedImages: ['https://synthetic/a.jpg'], imageMeta: '[{"url":"https://synthetic/a.jpg"}]', selectedCrops: ['상추'], growth: { _growthSubjectName: '합성 아이' } };
  let f;
  f = fixture({
    formData: { diary_simple: BODY },
    context: BASE,
    extract: async () => {
      f.changeContext({ ...BASE, uploadedImages: [...BASE.uploadedImages], selectedCrops: [...BASE.selectedCrops] });
      f.formDataRef.current = { diary_simple: BODY, diary_title: '내 제목' };
      return { data: { title: '산책한 날' } };
    },
  });
  await f.save();
  assert.deepEqual(f.state.infos, []);
  assert.equal(f.state.saves.length, 1);
  assert.equal(f.state.saves[0].diary_title, '내 제목');
  assert.equal(f.state.saves[0].diary_images, JSON.stringify(BASE.uploadedImages));
  assert.equal(f.state.saves[0]._growthSubjectName, '합성 아이');
  assert.equal(f.state.navigations[0].path, '/sayu');
});
