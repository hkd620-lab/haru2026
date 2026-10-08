// PR #267(건강성장 페이지 같은 이름 아이 중복 등록 방지, PR #266 후속) 점검 시나리오 — CC 임시 폴더에서 하네스 폴더로 옮겨 보존한 것.
// 수정 후(3a74bef8)는 전부 통과(pass=true), 수정 전(main 2e95144)은 ①~⑦ 모두 기대와 다르게 나온다(pass=false). 대조 ⑧(완전히 새로운 이름)은 둘 다 통과.
// 건강성장 페이지(/child-health/growth)의 같은 이름 아이 중복 등록 점검 시나리오(읽기 전용, 가상 Firebase, 운영 접촉 없음):
// ① 같은 이름 아이가 둘 있을 때 "기존 아이 선택" 목록에서 구분되는지,
// ② "새 아이 이름 입력"에 이미 있는 이름을 쓰면 안내가 뜨고 그 아이의 생년월일·성별이 채워져 잠기는지(없는 이름은 안내 없음),
// ③ 저장하면 새 아이가 만들어지지 않고 기존 아이에 이어서 기록되는지,
// ④ 화면의 목록이 오래된 상태(다른 기기에서 막 등록)에서 같은 이름으로 저장해도 새 아이가 만들어지지 않는지,
// ⑤ 같은 이름 확인(조회)이 실패하면 저장을 멈추고, 연결이 돌아온 뒤 다시 저장하면 기존 아이에 이어서 기록되는지,
// ⑥ 입력한 생년월일·성별이 이미 등록된 아이와 다르면 조용히 바꿔 저장하지 않고 멈추는지,
// ⑦ 서버에 닿지 못해 빈 캐시 결과(fromCache)로 답하는 오프라인 상황에서 저장을 멈추고, 복구 뒤 다시 저장하면 기존 아이에 이어서 기록되는지,
// ⑧ (대조) 서버가 확인한 완전히 새로운 이름은 정상적으로 새 아이로 저장되는지.
// 실행: cd frontend/test/persona-sim && RUN_LABEL=after node scenarios/pr267-verify-health-subject.mjs
//   HARNESS_ROOT=<다른 체크아웃의 frontend/test/persona-sim> 으로 수정 전(main)·수정 후를 같은 스크립트로 비교한다. 결과는 out/scenarios/ 에 남는다.
//   18762 포트에 이미 하네스 서버가 떠 있으면 재사용하므로, 다른 소스와 비교할 때는 서버가 없는지 먼저 확인한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HR = process.env.HARNESS_ROOT || fileURLToPath(new URL('..', import.meta.url));
const LABEL = process.env.RUN_LABEL || 'run';
const OUT = process.env.OUT_DIR || path.join(HR, 'out', 'scenarios', `health-subject-${LABEL}`);
const { startServer, launchBrowser, newPersonaSession, setSimulatedTime, seedDb, BASE_URL, ensureDir } = await import(`${HR}/runner/lib.mjs`);
const driver = await import(`${HR}/runner/driver.mjs`);
const { openApp, pageText } = driver;
ensureDir(OUT);

const uid = 'qa-health-dup';
const identity = { uid, displayName: '건강성장 점검', email: 'health@example.invalid', plan: 'free' };
const hintRe = (name) => new RegExp(`이미 등록된 이름이에요\\. 저장하면 기존 "${name}"에 이어서 기록됩니다\\.`);

const server = await startServer();
const browser = await launchBrowser();
let result;
try {
  const warm = await newPersonaSession(browser, { uid: 'qa-health-warm', displayName: '워밍업', email: 'w@example.invalid', plan: 'free' });
  await warm.page.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 120000 });
  await warm.page.waitForTimeout(3000);
  await warm.context.close();

  const s = await newPersonaSession(browser, identity);
  const page = s.page;
  await seedDb(s.context, uid, [
    [`users/${uid}`, { consents: { sensitiveHealth: true } }],
    [`users/${uid}/growthSubjects/subA`, { subjectType: 'child', name: '하준', birthdate: '2025-08-05', gender: 'M', latestRecordDate: '2026-10-02', linkedRecordDates: ['2026-10-01', '2026-10-02'] }],
    [`users/${uid}/growthSubjects/subB`, { subjectType: 'child', name: '하준', latestRecordDate: '2026-10-04', linkedRecordDates: ['2026-10-03', '2026-10-04'] }],
    [`users/${uid}/growthSubjects/subC`, { subjectType: 'child', name: '서윤', birthdate: '2024-01-02', gender: 'F', latestRecordDate: '2026-09-20', linkedRecordDates: ['2026-09-20'] }],
  ]);
  await setSimulatedTime(page, '2026-10-08T21:00:00+09:00');
  const dumpDb = () => page.evaluate(() => (window.__qa && window.__qa.dumpDb ? window.__qa.dumpDb() : []));
  const subjectsOf = (db) => db.filter(([p]) => new RegExp(`^users/${uid}/growthSubjects/[^/]+$`).test(p)).map(([p, d]) => ({ id: p.split('/').pop(), ...d }));
  const recordsOf = (db) => db.filter(([p]) => new RegExp(`^users/${uid}/records/[^/]+$`).test(p)).map(([p, d]) => ({ path: p, ...d }));
  const entriesOf = (db, id) => db.filter(([p]) => new RegExp(`^users/${uid}/growthSubjects/${id}/entries/[^/]+$`).test(p));
  const text = () => pageText(page);
  const toastsNow = () => page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.innerText.trim()));

  await openApp(page, { onboarding: 'skip' });
  await page.goto(`${BASE_URL}/child-health/growth`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const pathNow = () => new URL(page.url()).pathname;
  const onPage = pathNow() === '/child-health/growth';
  const newInput = page.getByPlaceholder('또는 새 아이 이름 입력');
  const dateInput = page.locator('input[type=date]').first();
  const maleBtn = page.getByRole('button', { name: '남아', exact: true });
  const femaleBtn = page.getByRole('button', { name: '여아', exact: true });
  const heightInput = page.getByPlaceholder('예: 85.4');
  const saveBtn = page.getByRole('button', { name: /^저장하기$/ });
  await page.screenshot({ path: `${OUT}/page.png` });

  // ① 목록 글자
  const options = onPage ? await page.locator('select').first().evaluate((el) => [...el.options].map((o) => (o.textContent || '').trim())) : [];

  // ② 안내 문구와 잠긴 생년월일·성별
  const probe = async (name) => {
    await newInput.fill(name);
    await page.waitForTimeout(300);
    return {
      hint: new RegExp('이미 등록된 이름이에요').test(await text()),
      birthdate: await dateInput.inputValue(),
      birthdateLocked: await dateInput.isDisabled(),
      genderLocked: (await maleBtn.isDisabled()) && (await femaleBtn.isDisabled()),
    };
  };
  const existing = await probe('서윤');
  await page.screenshot({ path: `${OUT}/hint.png` });
  const hintExactForSeoyun = hintRe('서윤').test(await text());
  const brandNew = await probe('새아이');
  const twins = await probe('하준');

  // ③ 저장 — 새 아이가 만들어지지 않고 기존 서윤(subC)에 이어서 기록되는지
  const save = async (name, h) => {
    await newInput.fill(name);
    await heightInput.fill(h);
    await saveBtn.click();
    await page.waitForTimeout(1800);
  };
  await save('서윤', '85.4');
  let db = await dumpDb();
  const lastRecord = () => { const r = recordsOf(db).sort((a, b) => a.path.localeCompare(b.path)); return r[r.length - 1] || {}; };
  const afterExisting = {
    subjectCount: subjectsOf(db).length,
    recordSubjectId: lastRecord().growthSubjectId || null,
    recordsCount: recordsOf(db).length,
    subC: (() => { const c = subjectsOf(db).find((x) => x.id === 'subC'); return c ? { birthdate: c.birthdate, gender: c.gender, linkedRecordDates: c.linkedRecordDates } : null; })(),
    subCEntries: entriesOf(db, 'subC').length,
  };

  // ④ 오래된 목록 — 화면이 목록을 불러온 뒤 다른 기기에서 "민아"가 새로 등록된 상황
  await page.evaluate((u) => window.__qa.seedDoc(`users/${u}/growthSubjects/subD`, { subjectType: 'child', name: '민아', birthdate: '2025-03-03', gender: 'F', latestRecordDate: '2026-10-05', linkedRecordDates: ['2026-10-05'] }), uid);
  await newInput.fill('민아');
  await page.waitForTimeout(300);
  const staleHint = new RegExp('이미 등록된 이름이에요').test(await text()); // 오래된 목록이라 화면에서는 모른다(false 가 정상)
  const recordsBefore4 = recordsOf(await dumpDb()).length;
  await heightInput.fill('70.2');
  await saveBtn.click();
  await page.waitForTimeout(1800);
  db = await dumpDb();
  const afterStale = {
    subjectCount: subjectsOf(db).length,
    names: subjectsOf(db).map((x) => x.name),
    recordsAdded: recordsOf(db).length - recordsBefore4,
    recordSubjectId: lastRecord().growthSubjectId || null,
    subD: (() => { const d = subjectsOf(db).find((x) => x.id === 'subD'); return d ? { birthdate: d.birthdate, gender: d.gender, linkedRecordDates: d.linkedRecordDates } : null; })(),
  };

  // ⑤ 조회 실패 — 새 아이를 만들어 저장하지 말고 멈춰야 한다. 연결이 돌아오면 이어서 기록된다.
  await page.evaluate((u) => window.__qa.seedDoc(`users/${u}/growthSubjects/subE`, { subjectType: 'child', name: '해든', birthdate: '2025-05-05', gender: 'M', latestRecordDate: '2026-10-06', linkedRecordDates: ['2026-10-06'] }), uid);
  const subjectsBefore5 = subjectsOf(await dumpDb()).length;
  const recordsBefore5 = recordsOf(await dumpDb()).length;
  await page.evaluate(() => { window.__qa.failQueries = ['growthSubjects']; });
  await save('해든', '81.0');
  db = await dumpDb();
  const failedLookup = {
    toast: (await toastsNow()).find((t) => t.includes('확인하지 못했어요')) || null,
    recordsAdded: recordsOf(db).length - recordsBefore5,
    subjectsAdded: subjectsOf(db).length - subjectsBefore5,
  };
  await page.evaluate(() => { window.__qa.failQueries = []; });
  await saveBtn.click();
  await page.waitForTimeout(1800);
  db = await dumpDb();
  const retried = {
    recordsAdded: recordsOf(db).length - recordsBefore5,
    subjectsAdded: subjectsOf(db).length - subjectsBefore5,
    recordSubjectId: lastRecord().growthSubjectId || null,
  };

  // ⑥ 입력한 생년월일·성별이 이미 등록된 아이와 다름 — 조용히 바꿔 저장하지 말고 멈춰야 한다
  await page.evaluate((u) => window.__qa.seedDoc(`users/${u}/growthSubjects/subF`, { subjectType: 'child', name: '지안', birthdate: '2024-06-06', gender: 'M', latestRecordDate: '2026-10-06', linkedRecordDates: ['2026-10-06'] }), uid);
  await newInput.fill('지안');
  await page.waitForTimeout(200);
  await dateInput.fill('2023-01-01');
  await femaleBtn.click();
  await heightInput.fill('90.1');
  const recordsBefore6 = recordsOf(await dumpDb()).length;
  const subjectsBefore6 = subjectsOf(await dumpDb()).length;
  await saveBtn.click();
  await page.waitForTimeout(1800);
  db = await dumpDb();
  const conflict = {
    toast: (await toastsNow()).find((t) => t.includes('생년월일·성별과 입력한 값이 달라요')) || null,
    recordsAdded: recordsOf(db).length - recordsBefore6,
    subjectsAdded: subjectsOf(db).length - subjectsBefore6,
    subF: (() => { const f = subjectsOf(db).find((x) => x.id === 'subF'); return f ? { birthdate: f.birthdate, gender: f.gender } : null; })(),
  };

  // ⑦ 서버에 닿지 못해 빈 캐시 결과(fromCache)로 답하는 오프라인 — 저장을 멈추고, 복구 뒤 다시 저장하면 기존 아이에 이어서 기록
  await page.evaluate((u) => window.__qa.seedDoc(`users/${u}/growthSubjects/subG`, { subjectType: 'child', name: '도윤', birthdate: '2025-07-07', gender: 'M', latestRecordDate: '2026-10-07', linkedRecordDates: ['2026-10-07'] }), uid);
  const recordsBefore7 = recordsOf(await dumpDb()).length;
  const subjectsBefore7 = subjectsOf(await dumpDb()).length;
  await page.evaluate(() => { window.__qa.cacheOnlyQueries = ['growthSubjects']; });
  await save('도윤', '75.5');
  db = await dumpDb();
  const cacheOnly = {
    toast: (await toastsNow()).find((t) => t.includes('확인하지 못했어요')) || null,
    recordsAdded: recordsOf(db).length - recordsBefore7,
    subjectsAdded: subjectsOf(db).length - subjectsBefore7,
  };
  await page.evaluate(() => { window.__qa.cacheOnlyQueries = []; });
  await saveBtn.click();
  await page.waitForTimeout(1800);
  db = await dumpDb();
  const retriedCache = {
    recordsAdded: recordsOf(db).length - recordsBefore7,
    subjectsAdded: subjectsOf(db).length - subjectsBefore7,
    recordSubjectId: lastRecord().growthSubjectId || null,
  };

  // ⑧ 대조 — 서버가 확인한 완전히 새로운 이름은 정상적으로 새 아이로 저장된다
  const subjectsBefore8 = subjectsOf(await dumpDb()).length;
  await page.evaluate(() => { window.__qa.failQueries = []; window.__qa.cacheOnlyQueries = []; });
  await newInput.fill('새아이');
  await dateInput.fill('2025-11-11');
  await maleBtn.click();
  await heightInput.fill('60.0');
  await saveBtn.click();
  await page.waitForTimeout(1800);
  db = await dumpDb();
  const brandNewSaved = {
    subjectsAdded: subjectsOf(db).length - subjectsBefore8,
    created: (() => { const n = subjectsOf(db).find((x) => x.name === '새아이'); return n ? { birthdate: n.birthdate, gender: n.gender, hasCreatedAt: Boolean(n.createdAt) } : null; })(),
  };

  result = {
    label: LABEL,
    onPage,
    options,
    expectedOptions: ['기존 아이 선택', '하준 (생년월일 없음 · 최근 기록 2026-10-04)', '하준 (생년월일 2025-08-05 · 최근 기록 2026-10-02)', '서윤'],
    existing, hintExactForSeoyun, brandNew, twins,
    afterExisting, staleHint, afterStale, failedLookup, retried, conflict, cacheOnly, retriedCache, brandNewSaved,
    pageErrors: s.events.pageErrors, external: s.blocked.length,
  };
  result.pass = onPage && JSON.stringify(options) === JSON.stringify(result.expectedOptions)
    && existing.hint === true && hintExactForSeoyun && existing.birthdate === '2024-01-02' && existing.birthdateLocked && existing.genderLocked
    && brandNew.hint === false && brandNew.birthdate === '' && !brandNew.birthdateLocked && !brandNew.genderLocked
    && twins.hint === true && twins.birthdate === '2025-08-05' && twins.birthdateLocked
    && afterExisting.subjectCount === 3 && afterExisting.recordSubjectId === 'subC' && afterExisting.subCEntries >= 1
    && afterExisting.subC && afterExisting.subC.birthdate === '2024-01-02' && (afterExisting.subC.linkedRecordDates || []).includes('2026-10-08')
    && staleHint === false
    && afterStale.subjectCount === 4 && afterStale.recordsAdded === 1 && afterStale.recordSubjectId === 'subD'
    && afterStale.subD && afterStale.subD.birthdate === '2025-03-03' && (afterStale.subD.linkedRecordDates || []).includes('2026-10-08')
    && !!failedLookup.toast && failedLookup.recordsAdded === 0 && failedLookup.subjectsAdded === 0
    && retried.recordsAdded === 1 && retried.subjectsAdded === 0 && retried.recordSubjectId === 'subE'
    && !!conflict.toast && conflict.recordsAdded === 0 && conflict.subjectsAdded === 0
    && conflict.subF && conflict.subF.birthdate === '2024-06-06' && conflict.subF.gender === 'M'
    && !!cacheOnly.toast && cacheOnly.recordsAdded === 0 && cacheOnly.subjectsAdded === 0
    && retriedCache.recordsAdded === 1 && retriedCache.subjectsAdded === 0 && retriedCache.recordSubjectId === 'subG'
    && brandNewSaved.subjectsAdded === 1 && brandNewSaved.created && brandNewSaved.created.birthdate === '2025-11-11' && brandNewSaved.created.gender === 'M' && brandNewSaved.created.hasCreatedAt;
  await s.context.close();
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
