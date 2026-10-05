const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'frontend/src/app/pages/RecordPage.tsx'), 'utf8');
const handlerSource = source.slice(source.indexOf('  const handleSaveLawResult = async () => {'), source.indexOf('\n  const handleAssistantRecommendationSelect'));
const handlerJS = transformSync(handlerSource, { loader: 'ts' }).code;
const dateChangeSource = source.slice(source.indexOf('  const handleLawSaveDateChange'), source.indexOf('  const handleSaveLawResult'));
const dateChangeJS = transformSync(dateChangeSource, { loader: 'ts' }).code;
const dateStateSource = source.slice(source.indexOf('  const [lawSaveDate,'), source.indexOf('  const [lawGuideConfirmed,'));
const dateStateJS = transformSync(dateStateSource, { loader: 'ts' }).code;
const dateLabelOffset = source.indexOf('<label htmlFor="law-save-date"');
const dateInputSource = source.slice(source.lastIndexOf('              <div', dateLabelOffset), source.indexOf('              {/* 검색창 */}', dateLabelOffset));
const dateInputJS = transformSync(`return <>${dateInputSource.trim()}</>;`, { loader: 'tsx' }).code;
const serviceSource = fs.readFileSync(path.join(root, 'frontend/src/app/services/firestoreService.ts'), 'utf8');
const serviceMethod = serviceSource.slice(serviceSource.indexOf('  async saveRecord('), serviceSource.indexOf('  // 결과물 기반 AI 대화'));
const serviceJS = transformSync(`class SaveService { ${serviceMethod} }; return new SaveService();`, { loader: 'ts' }).code;
const noticeSource = source.slice(source.indexOf('              {lawSaveError && ('), source.indexOf('              {/* 저장 버튼 */}'));
const noticeJS = transformSync(`return <>${noticeSource}</>;`, { loader: 'tsx' }).code;

function harness(overrides = {}) {
  const state = { saving: false, saved: false, error: null, steps: [], logs: [], navigations: [], date: overrides.lawSaveDate ?? '2026-10-02' };
  const context = {
    user: { uid: 'fixture-owner' }, lawQuery: 'fixture question', activeLawQuery: 'fixture question',
    lawResults: [{ lawName: 'fixture law', articleStr: '1', title: 'fixture title', content: 'fixture article' }],
    lawSummary: 'fixture summary', currentDate: new Date('2026-10-02T12:00:00Z'),
    lawSaveDate: state.date, uploadingLawFiles: false, lawLoading: false, isSavingLaw: false,
    weather: '쾌청', temperature: '쾌적', mood: '평온', getLocalDateString: () => '2026-10-02',
    lawAttachments: [{ storagePath: 'fixture.pdf', mimeType: 'application/pdf', fileName: 'fixture.pdf' }],
    activeLawAttachments: [{ storagePath: 'fixture.pdf', mimeType: 'application/pdf', fileName: 'fixture.pdf' }],
    db: {}, doc: (...args) => args,
    getDoc: async () => { state.steps.push('getDoc'); return { exists: () => false }; },
    firestoreService: { saveRecord: async () => { state.steps.push('saveRecord'); } },
    setLawSaveError: (value) => { state.error = value; },
    setLawSaveDate: (value) => { state.date = value; },
    setIsSavingLaw: (value) => { state.saving = value; }, setLawSaved: (value) => { state.saved = value; },
    toast: { error: () => {}, success: () => {} },
    console: { error: (...args) => { state.logs.push(args); } },
    setTimeout: (fn) => fn(), navigate: (...args) => state.navigations.push(args),
    ...overrides,
  };
  const inputKeys = ['lawQuery', 'activeLawQuery', 'lawResults', 'lawSummary', 'lawAttachments', 'activeLawAttachments'];
  // Expose destructive setters too: failures must never invoke them.
  for (const key of inputKeys) context[`set${key[0].toUpperCase()}${key.slice(1)}`] = () => assert.fail(`input cleared: ${key}`);
  const inputs = JSON.stringify(inputKeys.map((key) => context[key]));
  const run = new Function(...Object.keys(context), `${handlerJS}; return handleSaveLawResult;`)(...Object.values(context));
  const changeDate = new Function(...Object.keys(context), `${dateChangeJS}; return handleLawSaveDateChange;`)(...Object.values(context));
  const dateInput = () => new Function('React', 'lawSaveDate', 'uploadingLawFiles', 'lawLoading', 'isSavingLaw', 'handleLawSaveDateChange', dateInputJS)(React, state.date, context.uploadingLawFiles, context.lawLoading, context.isSavingLaw, changeDate);
  const notice = (extra = {}) => new Function('React', 'lawSaveError', 'isSavingLaw', 'lawSaved', 'handleSaveLawResult', noticeJS)(React, state.error, extra.saving ?? state.saving, extra.saved ?? state.saved, run);
  return { context, state, run, notice, changeDate, dateInput, assertPreserved: () => assert.equal(JSON.stringify(inputKeys.map((key) => context[key])), inputs) };
}

test('저장 날짜 기본값은 서울 자정 경계를 따르고 특정 시험 날짜에 고정되지 않는다', () => {
  for (const [instant, expected] of [
    ['2026-10-04T14:59:59Z', '2026-10-04'],
    ['2026-10-04T15:00:00Z', '2026-10-05'],
    ['2026-12-31T15:00:00Z', '2027-01-01'],
  ]) {
    const FixedDate = class extends Date { constructor() { super(instant); } };
    const date = new Function('useState', 'Date', `${dateStateJS}; return lawSaveDate;`)((init) => [init(), () => {}], FixedDate);
    assert.equal(date, expected);
  }
});

test('실제 날짜 입력 콜백은 입력·첨부·분석과 공용 날짜를 보존하고 서버 IO 없이 대상만 변경한다', () => {
  const h = harness();
  const currentDate = h.context.currentDate;
  h.state.saved = true;
  h.state.error = { title: 'previous save error' };
  const row = React.Children.toArray(h.dateInput().props.children)[0];
  const [label, input] = React.Children.toArray(row.props.children);
  assert.equal(label.props.htmlFor, input.props.id);
  assert.equal(input.props.type, 'date');
  assert.equal(input.props.disabled, false);
  input.props.onChange({ target: { value: '2026-10-04' } });
  assert.equal(h.state.date, '2026-10-04');
  assert.equal(h.state.saved, false);
  assert.equal(h.state.error, null);
  assert.equal(h.context.currentDate, currentDate);
  assert.deepEqual(h.state.steps, []);
  assert.deepEqual(h.state.navigations, []);
  h.assertPreserved();
});

test('업로드·분석·저장 중에는 날짜 입력과 콜백 모두 변경을 거부한다', () => {
  for (const flag of ['uploadingLawFiles', 'lawLoading', 'isSavingLaw']) {
    const h = harness({ [flag]: true });
    h.state.saved = true;
    const error = h.state.error = { title: 'preserved' };
    const row = React.Children.toArray(h.dateInput().props.children)[0];
    const input = React.Children.toArray(row.props.children)[1];
    assert.equal(input.props.disabled, true, flag);
    input.props.onChange({ target: { value: '2026-10-04' } });
    assert.equal(h.state.date, '2026-10-02');
    assert.equal(h.state.saved, true);
    assert.equal(h.state.error, error);
    assert.deepEqual(h.state.steps, []);
    h.assertPreserved();
  }
});

test('빈 날짜·잘못된 날짜는 조회·저장 없이 안내하고 분석 입력을 보존한다', async () => {
  for (const date of ['', 'not-a-date', '2026-02-30', '2026-1-04']) {
    const h = harness({ lawSaveDate: date });
    await h.run();
    assert.equal(h.state.error.title, '저장 날짜를 선택해 주세요');
    assert.deepEqual(h.state.steps, []);
    assert.equal(h.state.saved, false);
    assert.equal(h.state.saving, false);
    h.assertPreserved();
  }
});

test('선택 날짜 조회·실제 saveRecord의 문서 경로·id·date 일치 및 기존 기록 병합', async () => {
  const target = 'users/fixture-owner/records/2026-10-04';
  const today = 'users/fixture-owner/records/2026-10-02';
  const todayRecord = { content: 'other date diary', formats: ['일기'] };
  const store = new Map([
    [today, todayRecord],
    [target, { content: 'preserved diary', formats: ['일기', 'HARUraw'], weather: '비', temperature: '쌀쌀', mood: '울적', plantDetective: [{ memo: 'preserved plant' }] }],
  ]);
  const reads = [], writes = [];
  const doc = (_db, ...segments) => segments.join('/');
  const setDoc = async (ref, data, options) => {
    writes.push({ ref, data, options });
    assert.equal(options.merge, true);
    store.set(ref, { ...store.get(ref), ...data });
  };
  const service = new Function('db', 'doc', 'setDoc', serviceJS)({}, doc, setDoc);
  service.recordPaidServiceUsage = async () => {};
  for (const selectedDate of ['2026-10-04', '2026-10-07']) {
    const h = harness({
      lawSaveDate: selectedDate, doc, firestoreService: service,
      getDoc: async (ref) => { reads.push(ref); return { exists: () => store.has(ref), data: () => store.get(ref) }; },
    });
    await h.run();
    const path = `users/fixture-owner/records/${selectedDate}`;
    assert.equal(reads.at(-1), path);
    assert.equal(writes.at(-1).ref, path);
    assert.equal(writes.at(-1).data.id, selectedDate);
    assert.equal(writes.at(-1).data.date, selectedDate);
    assert.equal(store.get(path).haruraw_query, h.context.activeLawQuery);
    assert.deepEqual(store.get(path).haruraw_attachments, h.context.activeLawAttachments);
    assert.equal(h.state.saved, true);
    h.assertPreserved();
  }
  assert.equal(store.get(today), todayRecord);
  assert.equal(store.get(target).content, 'preserved diary');
  assert.deepEqual(store.get(target).formats, ['일기', 'HARUraw']);
  assert.equal(store.get(target).weather, '비');
  assert.equal(store.get(target).temperature, '쌀쌀');
  assert.equal(store.get(target).mood, '울적');
  assert.deepEqual(store.get(target).plantDetective, [{ memo: 'preserved plant' }]);
  assert.equal(store.size, 3);
});

function retryButton(notice) {
  const alert = React.Children.toArray(notice.props.children).find((child) => child.props?.role === 'alert');
  return React.Children.toArray(alert.props.children).find((child) => child.type === 'button');
}

test('로그인 부재·빈 결과는 지속 안내를 렌더링하고 IO·입력 초기화 없이 반환한다', async () => {
  for (const [overrides, title] of [[{ user: null }, '로그인이 필요합니다'], [{ lawResults: [] }, '저장할 분석 결과가 없습니다']]) {
    const h = harness(overrides);
    await h.run();
    assert.equal(h.state.error.title, title);
    assert.equal(h.state.error.retryable, false);
    assert.deepEqual(h.state.steps, []);
    assert.equal(h.state.saving, false);
    assert.match(renderToStaticMarkup(h.notice()), /role="alert"/);
    assert.match(renderToStaticMarkup(h.notice()), new RegExp(title));
    assert.doesNotMatch(renderToStaticMarkup(h.notice()), /저장 다시 시도/);
    h.assertPreserved();
  }
});

for (const [stage, title] of [['getDoc', '선택 날짜의 기존 기록을 확인하지 못했습니다'], ['saveRecord', '분석 결과를 기록에 저장하지 못했습니다']]) {
  test(`${stage} 실패 안내·안전 로그·입력 보존·저장만 재시도`, async () => {
    let fail = true;
    const error = { code: 'permission-denied', message: 'secret body token question pdf', uid: 'sensitive' };
    const h = harness({
      getDoc: async () => { if (fail && stage === 'getDoc') throw error; return { exists: () => false }; },
      firestoreService: { saveRecord: async () => { if (fail && stage === 'saveRecord') throw error; } },
    });
    await h.run();
    assert.equal(h.state.error.title, title);
    assert.match(h.state.error.message, /접근 권한 또는 로그인 상태/);
    assert.deepEqual(h.state.logs, [['하루LAW 저장 실패', { stage, code: 'permission-denied' }]]);
    assert.equal(h.state.saved, false);
    assert.equal(h.state.saving, false);
    assert.deepEqual(h.state.navigations, []);
    h.assertPreserved();
    const markup = renderToStaticMarkup(h.notice());
    assert.match(markup, /role="alert"/);
    assert.match(markup, /질문·분석 결과·첨부파일은 그대로 유지/);
    assert.match(markup, /저장 다시 시도/);
    assert.doesNotMatch(markup, /secret|sensitive/);
    assert.equal(retryButton(h.notice({ saving: true })).props.disabled, true);
    assert.equal(retryButton(h.notice({ saved: true })).props.disabled, true);
    // Invoke the actual JSX click callback: it cannot call lawSearch or an AI API.
    fail = false;
    await retryButton(h.notice()).props.onClick();
    assert.equal(h.state.error, null);
    assert.equal(h.state.saved, true);
    assert.equal(h.state.saving, false);
    assert.equal(h.state.navigations[0][0], '/sayu');
    h.assertPreserved();
  });
}

test('오류 코드 allowlist와 네트워크 안내: 오류 원문·임의 code가 UI/로그에 유출되지 않는다', async () => {
  for (const [raw, expected] of [['unavailable', 'unavailable'], ['firestore/deadline-exceeded', 'deadline-exceeded'], ['secret-uid-token', 'unknown'], [123, 'unknown'], [undefined, 'unknown']]) {
    const h = harness({ getDoc: async () => { throw { code: raw, message: 'secret body' }; } });
    await h.run();
    assert.equal(h.state.logs[0][1].code, expected);
    assert.doesNotMatch(JSON.stringify(h.state.logs) + renderToStaticMarkup(h.notice()), /secret/);
    if (expected !== 'unknown') assert.match(h.state.error.message, /네트워크 연결/);
    h.assertPreserved();
  }
});

test('저장 진행 중 중복 재시도를 막고 완료 전 성공 표시를 하지 않는다', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const h = harness({ getDoc: () => pending });
  const run = h.run();
  assert.equal(h.state.saving, true);
  assert.equal(h.state.saved, false);
  assert.deepEqual(h.state.navigations, []);
  release({ exists: () => false });
  await run;
  assert.equal(h.state.saving, false);
  assert.equal(h.state.saved, true);
});

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
test('로컬 Rules: 없는 날짜 → 실제 저장, 기존 기록 병합, 전체 권한 정책 전후 비교', { skip: !emulatorHost }, async (t) => {
  assert.match(emulatorHost, /^(127\.0\.0\.1|localhost):\d+$/, 'production connections are forbidden');
  const { initializeApp, deleteApp } = require('firebase/app');
  const { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const baseline = process.env.HARULAW_BASELINE_RULES
    ? fs.readFileSync(process.env.HARULAW_BASELINE_RULES, 'utf8')
    : execFileSync('git', ['show', 'origin/main:firestore.rules'], { cwd: root, encoding: 'utf8' });
  const added = "!exists(/databases/$(database)/documents/users/$(userId)/records/$(recordId))\n          || ";
  assert.equal(rules.replace(added, ''), baseline, 'only the missing-document get clause may change');
  const [host, port] = emulatorHost.split(':');
  const apps = [];
  const matrices = [];
  const evidence = [];
  async function allowed(fn) {
    try { const result = await fn(); return { allowed: true, ...(result?.exists ? { exists: result.exists() } : {}) }; }
    catch (err) { assert.equal(err.code, 'permission-denied'); return { allowed: false }; }
  }
  try {
    for (const [version, content] of [['before', baseline], ['after', rules]]) {
      const projectId = `demo-harulaw-save-${version}`;
      const uploaded = await fetch(`http://${emulatorHost}/emulator/v1/projects/${projectId}:securityRules`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }),
      });
      assert.equal(uploaded.status, 200, 'rules must compile');
      const contexts = {};
      for (const [actor, claims] of [
        ['owner', { sub: 'fixture-owner', email: 'fixture@example.invalid', email_verified: true }],
        ['developer', { sub: 'fixture-owner', email: 'hkd620@gmail.com', email_verified: true }],
        ['unverified', { sub: 'fixture-owner', email: 'hkd620@gmail.com', email_verified: false }],
        ['noVerification', { sub: 'fixture-owner', email: 'hkd620@gmail.com' }],
        ['other', { sub: 'fixture-other', email: 'hkd620@gmail.com', email_verified: true }],
        ['anonymous', null],
      ]) {
        const app = initializeApp({ projectId, apiKey: 'emulator-only' }, `${version}-${actor}`);
        apps.push(app);
        const db = getFirestore(app);
        connectFirestoreEmulator(db, host, Number(port), claims ? { mockUserToken: claims } : {});
        contexts[actor] = db;
      }
      const fixture = (db, id) => doc(db, 'users/fixture-owner/records', id);
      // Seed via the existing verified-developer exception, never an admin/production credential.
      for (const [id, data] of [['normal', { type: 'diary', content: 'fixture' }], ['legacy', { content: 'fixture' }], ['ai', { type: 'ai_log', content: 'fixture' }]]) {
        await setDoc(fixture(contexts.developer, id), data);
      }
      const matrix = {};
      const expectAccess = async (name, expected, fn) => {
        const result = await allowed(fn);
        assert.equal(result.allowed, expected, `${version}: ${name}`);
        matrix[name] = result;
      };
      for (const [actor, db] of Object.entries(contexts)) {
        const owner = !['other', 'anonymous'].includes(actor);
        const developer = actor === 'developer';
        const missing = await allowed(() => getDoc(fixture(db, 'missing')));
        assert.equal(missing.allowed, owner && (version === 'after' || developer), `${version}: ${actor} missing get`);
        if (missing.allowed) assert.equal(missing.exists, false);
        evidence.push({ version, case: `${actor} missing get`, ...missing });
        await expectAccess(`${actor} list`, owner, () => getDocs(collection(db, 'users/fixture-owner/records')));
        for (const type of ['normal', 'legacy', 'ai']) {
          const can = owner && (type !== 'ai' || developer);
          await expectAccess(`${actor} ${type} get`, can, () => getDoc(fixture(db, type)));
          const ref = fixture(db, `${actor}-${type}`);
          const data = type === 'ai' ? { type: 'ai_log', content: 'fixture' } : type === 'normal' ? { type: 'diary', content: 'fixture' } : { content: 'fixture' };
          await expectAccess(`${actor} ${type} create`, can, () => setDoc(ref, data));
          if (!can) await setDoc(fixture(contexts.developer, `${actor}-${type}`), data);
          await expectAccess(`${actor} ${type} update`, can, () => updateDoc(ref, { content: 'updated fixture' }));
          await expectAccess(`${actor} ${type} delete`, can, () => deleteDoc(ref));
        }
        await setDoc(fixture(contexts.developer, `${actor}-normal-to-ai`), { type: 'diary' });
        await expectAccess(`${actor} normal to ai`, developer, () => updateDoc(fixture(db, `${actor}-normal-to-ai`), { type: 'ai_log' }));
        await setDoc(fixture(contexts.developer, `${actor}-ai-to-normal`), { type: 'ai_log' });
        await expectAccess(`${actor} ai to normal`, developer, () => updateDoc(fixture(db, `${actor}-ai-to-normal`), { type: 'diary' }));
      }
      // This is the repository's exact saveRecord method. Only paid usage is stubbed to avoid unrelated writes.
      const service = new Function('db', 'doc', 'setDoc', serviceJS)(contexts.owner, doc, setDoc);
      service.recordPaidServiceUsage = async () => {};
      const save = harness({ db: contexts.owner, doc, getDoc, firestoreService: service });
      await save.run();
      if (version === 'before') {
        assert.equal(save.state.saved, false);
        assert.equal(save.state.logs[0][1].stage, 'getDoc');
        assert.equal(save.state.logs[0][1].code, 'permission-denied');
        const missing = await getDoc(fixture(contexts.developer, '2026-10-02'));
        assert.equal(missing.exists(), false);
      } else {
        assert.equal(save.state.error, null);
        assert.equal(save.state.saved, true);
        assert.equal(save.state.navigations[0][0], '/sayu');
        const written = (await getDoc(fixture(contexts.owner, '2026-10-02'))).data();
        assert.equal(written.date, '2026-10-02');
        assert.deepEqual(written.formats, ['HARUraw']);
        assert.equal(written.haruraw_query, 'fixture question');
        assert.deepEqual(written.haruraw_attachments, save.context.activeLawAttachments);
      }
      save.assertPreserved();
      // Existing normal daily record must retain its content, formats and environmental values.
      await setDoc(fixture(contexts.owner, '2026-10-02'), { content: 'preserved diary', formats: ['일기'], weather: '비', temperature: '쌀쌀', mood: '울적' }, { merge: true });
      const existing = harness({ db: contexts.owner, doc, getDoc, firestoreService: service });
      await existing.run();
      assert.equal(existing.state.saved, true);
      const written = (await getDoc(fixture(contexts.owner, '2026-10-02'))).data();
      assert.equal(written.content, 'preserved diary');
      assert.deepEqual(written.formats, ['일기', 'HARUraw']);
      assert.equal(written.weather, '비'); assert.equal(written.temperature, '쌀쌀'); assert.equal(written.mood, '울적');
      existing.assertPreserved();
      evidence.push({ version, case: 'exact handler + saveRecord missing date', saved: save.state.saved });
      evidence.push({ version, case: 'exact handler + saveRecord existing date', saved: existing.state.saved });
      matrices.push(matrix);
    }
    assert.deepEqual(matrices[1], matrices[0], 'all existing get/list/create/update/delete decisions must remain unchanged');
    t.diagnostic(`${Object.keys(matrices[0]).length} existing permission decisions unchanged; 12 missing reads and 4 exact-handler saves checked`);
    if (process.env.HARULAW_TEST_EVIDENCE) fs.writeFileSync(process.env.HARULAW_TEST_EVIDENCE, JSON.stringify({ evidence, before: matrices[0], after: matrices[1] }, null, 2));
  } finally { await Promise.all(apps.map(deleteApp)); }
});
