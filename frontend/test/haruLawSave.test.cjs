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
const serviceSource = fs.readFileSync(path.join(root, 'frontend/src/app/services/firestoreService.ts'), 'utf8');
const serviceMethod = serviceSource.slice(serviceSource.indexOf('  async saveRecord('), serviceSource.indexOf('  // 결과물 기반 AI 대화'));
const serviceJS = transformSync(`class SaveService { ${serviceMethod} }; return new SaveService();`, { loader: 'ts' }).code;
const noticeSource = source.slice(source.indexOf('              {lawSaveError && ('), source.indexOf('              {/* 저장 버튼 */}'));
const noticeJS = transformSync(`return <>${noticeSource}</>;`, { loader: 'tsx' }).code;

function harness(overrides = {}) {
  const state = { saving: false, saved: false, error: null, steps: [], logs: [], navigations: [] };
  const context = {
    user: { uid: 'fixture-owner' }, lawQuery: 'fixture question', activeLawQuery: 'fixture question',
    lawResults: [{ lawName: 'fixture law', articleStr: '1', title: 'fixture title', content: 'fixture article' }],
    lawSummary: 'fixture summary', lawSaveDate: '2026-10-02', currentDate: new Date('2026-10-02T12:00:00Z'),
    weather: '쾌청', temperature: '쾌적', mood: '평온', getLocalDateString: () => '2026-10-02',
    lawAttachments: [{ storagePath: 'fixture.pdf', mimeType: 'application/pdf', fileName: 'fixture.pdf' }],
    activeLawAttachments: [{ storagePath: 'fixture.pdf', mimeType: 'application/pdf', fileName: 'fixture.pdf' }],
    db: {}, doc: (...args) => args,
    getDoc: async () => { state.steps.push('getDoc'); return { exists: () => false }; },
    firestoreService: { saveRecord: async () => { state.steps.push('saveRecord'); } },
    setLawSaveError: (value) => { state.error = value; },
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
  const notice = (extra = {}) => new Function('React', 'lawSaveError', 'isSavingLaw', 'lawSaved', 'handleSaveLawResult', noticeJS)(React, state.error, extra.saving ?? state.saving, extra.saved ?? state.saved, run);
  return { context, state, run, notice, assertPreserved: () => assert.equal(JSON.stringify(inputKeys.map((key) => context[key])), inputs) };
}

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

const dateStateSource = source.slice(source.indexOf('  const [lawSaveDate,'), source.indexOf('  const [lawGuideConfirmed,'));
const dateInputSource = source.slice(source.indexOf('              <label htmlFor="law-save-date"'), source.indexOf('              {/* 검색창 */}', source.indexOf('              <label htmlFor="law-save-date"')));
const dateInputJS = transformSync(`return (${dateInputSource});`, { loader: 'tsx' }).code;
const lockExpression = source.match(/const lawDateLocked = (.+);/)[1];

test('하루LAW 기본 날짜는 기기 시간대와 무관한 서울 오늘이며 공용 날짜는 그대로다', () => {
  const stateJS = transformSync(`${dateStateSource}; return lawSaveDate;`, { loader: 'ts' }).code;
  for (const [instant, expected] of [['2026-10-04T14:59:59Z', '2026-10-04'], ['2026-10-04T15:00:00Z', '2026-10-05']]) {
    class Clock extends Date { constructor() { super(instant); } }
    const initial = new Function('useState', 'Date', stateJS)((init) => [init(), () => {}], Clock);
    assert.equal(initial, expected);
  }
  assert.match(source, /const \[currentDate\] = useState\(new Date\(\)\);/);
  assert.doesNotMatch(handlerSource, /getLocalDateString\(currentDate\)/);
  assert.equal((source.match(/getLocalDateString\(currentDate\)/g) || []).length, 3, '다른 기록 형식의 날짜 동작 유지');
});

test('실제 날짜 입력: 선택만 변경하고 질문·첨부·분석 결과 보존, IO 없음, 처리 중 잠금', () => {
  const h = harness();
  let selected = h.context.lawSaveDate;
  const states = { uploadingLawFiles: false, lawLoading: false, openCard: null, isSavingLaw: false, isSaving: false };
  const locked = (overrides = {}) => {
    const flags = { ...states, ...overrides };
    return new Function(...Object.keys(flags), `return ${lockExpression};`)(...Object.values(flags));
  };
  const renderInput = (busy) => new Function('React', 'lawSaveDate', 'lawDateLocked', 'setLawSaveDate', dateInputJS)(React, selected, busy, (value) => { selected = value; });
  const input = (label) => React.Children.toArray(label.props.children).find((child) => child.type === 'input');
  assert.match(renderToStaticMarkup(renderInput(false)), /저장 날짜/);
  assert.equal(input(renderInput(false)).props.type, 'date');
  assert.equal(input(renderInput(false)).props.disabled, false);
  input(renderInput(false)).props.onChange({ target: { value: '2026-10-04' } });
  assert.equal(input(renderInput(false)).props.value, '2026-10-04');
  input(renderInput(false)).props.onChange({ target: { value: '' } });
  assert.equal(selected, '2026-10-04', '빈 입력으로 저장 경로가 사라지지 않는다');
  for (const flags of [{ uploadingLawFiles: true }, { lawLoading: true }, { openCard: { loading: true } }, { isSavingLaw: true }, { isSaving: true }]) {
    const date = input(renderInput(locked(flags)));
    assert.equal(date.props.disabled, true);
    date.props.onChange({ target: { value: '2026-10-03' } });
    assert.equal(selected, '2026-10-04');
  }
  assert.deepEqual(h.state.steps, []);
  h.assertPreserved();
  assert.match(dateInputSource, /if \(!lawDateLocked && e\.target\.value\) setLawSaveDate\(e\.target\.value\);/);
  assert.equal((dateInputSource.match(/\bset\w+\(/g) || []).length, 1, '날짜 변경은 날짜 setter만 호출');
});

test('선택 날짜의 조회·실제 saveRecord 경로·id/date 일치와 기존 기록 merge 보존', async () => {
  for (const exists of [false, true]) {
    const date = '2026-10-04';
    const selectedPath = `users/fixture-owner/records/${date}`;
    const todayPath = 'users/fixture-owner/records/2026-10-05';
    const records = new Map([[todayPath, { content: 'today untouched', formats: ['메모'] }]]);
    if (exists) records.set(selectedPath, { id: date, date, content: 'preserved diary', formats: ['일기', 'HARUraw'], weather: '비', temperature: '쌀쌀', mood: '울적', memo: 'preserved memo', haruraw_attachments: [{ fileName: 'existing.pdf' }] });
    const readPaths = [], writePaths = [];
    const doc = (_db, ...segments) => segments.join('/');
    const setDoc = async (ref, data, options) => {
      writePaths.push(ref);
      assert.deepEqual(options, { merge: true });
      records.set(ref, { ...records.get(ref), ...data });
    };
    const service = new Function('db', 'doc', 'setDoc', serviceJS)({}, doc, setDoc);
    service.recordPaidServiceUsage = async () => {};
    const h = harness({
      lawSaveDate: date, currentDate: new Date('2026-10-05T12:00:00Z'), getLocalDateString: () => '2026-10-05',
      activeLawAttachments: exists ? [] : [{ fileName: 'new.pdf' }],
      doc, getDoc: async (ref) => { readPaths.push(ref); return { exists: () => records.has(ref), data: () => records.get(ref) }; },
      firestoreService: service,
    });
    await h.run();
    assert.equal(h.state.saved, true);
    assert.deepEqual(readPaths, [selectedPath]);
    assert.deepEqual(writePaths, [selectedPath]);
    const written = records.get(selectedPath);
    assert.equal(written.id, date);
    assert.equal(written.date, date);
    assert.deepEqual(written.formats, exists ? ['일기', 'HARUraw'] : ['HARUraw']);
    assert.equal(written.haruraw_query, h.context.activeLawQuery);
    assert.equal(written.haruraw_summary, h.context.lawSummary);
    if (exists) {
      assert.equal(written.content, 'preserved diary');
      assert.equal(written.weather, '비');
      assert.equal(written.temperature, '쌀쌀');
      assert.equal(written.mood, '울적');
      assert.equal(written.memo, 'preserved memo');
      assert.deepEqual(written.haruraw_attachments, [{ fileName: 'existing.pdf' }]);
    } else assert.deepEqual(written.haruraw_attachments, h.context.activeLawAttachments);
    assert.deepEqual(records.get(todayPath), { content: 'today untouched', formats: ['메모'] });
    h.assertPreserved();
  }
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
