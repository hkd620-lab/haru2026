// PR #266(육아일기 같은 이름 아이 중복 등록, F-07·F-08) 점검 시나리오 — CC 임시 폴더에서 하네스 폴더로 옮겨 보존한 것.
// 실행(대상 브랜치 위에 하네스를 풀어 둔 저장소에서): cd frontend/test/persona-sim && RUN_LABEL=after node scenarios/pr266-verify-subject.mjs
//   HARNESS_ROOT=<다른 체크아웃의 frontend/test/persona-sim> 으로 수정 전(main)·수정 후를 같은 스크립트로 비교한다. 결과는 out/scenarios/ 에 남는다.
//   18762 포트에 이미 하네스 서버가 떠 있으면 재사용하므로, 다른 소스와 비교할 때는 서버가 없는지 먼저 확인한다.
// 시나리오 ①~⑦: 목록 글자 / 안내·잠금 / 기존 아이에 이어서 기록 / 오래된 목록 / 조회 실패(failQueries) / 입력값 충돌 / 오프라인 캐시 응답(cacheOnlyQueries).
// 통과 기준은 파일 끝의 result.pass. 수정 후(0cce5cdc)는 전부 통과(pass=true), 수정 전(main e6139e2)은 ①~⑦ 모두 기대와 다르게 나온다(pass=false). 운영 접촉 없음(가상 Firebase).
// 성장대상 검증(읽기 전용):
// ① 이름이 같은 아이가 이미 둘 있을 때 "기존 대상 선택" 목록에서 구분되는지,
// ② "새 대상 추가"에 이미 있는 이름을 쓰면 안내가 뜨고 그 아이의 생년월일·성별이 채워져 잠기는지(목록에서 고른 것과 같게),
// ③ 저장하면 새 대상이 만들어지지 않고 기존 아이에 이어서 기록되는지(생년월일 유지),
// ④ 화면의 대상 목록이 오래된 상태(다른 기기에서 막 등록)에서 같은 이름으로 저장해도 새 대상이 만들어지지 않는지.
// HARNESS_ROOT 로 하네스 위치를 바꿔 수정 전(main)·수정 후(브랜치)에 똑같이 돌린다. 운영 접촉 없음(가상 Firebase).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HR = process.env.HARNESS_ROOT || fileURLToPath(new URL('..', import.meta.url));
const LABEL = process.env.RUN_LABEL || 'run';
const OUT = process.env.OUT_DIR || path.join(HR, 'out', 'scenarios', `pr266-subject-${LABEL}`);
const { startServer, launchBrowser, newPersonaSession, setSimulatedTime, seedDb, BASE_URL, ensureDir } = await import(`${HR}/runner/lib.mjs`);
const driver = await import(`${HR}/runner/driver.mjs`);
const { openApp, openFormatFromHome, chooseStyle, fillTitle, fillByPlaceholder, pageText } = driver;
ensureDir(OUT);

const uid = 'qa-subject-dup';
const identity = { uid, displayName: '대상 점검', email: 'subject@example.invalid', plan: 'free' };
const hintRe = (name) => new RegExp(`이미 등록된 이름이에요\\. 저장하면 기존 "${name}"에 이어서 기록됩니다\\.`);

const server = await startServer();
const browser = await launchBrowser();
let result;
try {
  const warm = await newPersonaSession(browser, { uid: 'qa-subject-warm', displayName: '워밍업', email: 'w@example.invalid', plan: 'free' });
  await warm.page.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 120000 });
  await warm.page.waitForTimeout(3000);
  await warm.context.close();

  const s = await newPersonaSession(browser, identity);
  const page = s.page;
  await seedDb(s.context, uid, [
    // 파일럿에서 생긴 것과 같은 모양의 중복: 같은 이름 "하준" 두 개(하나는 생년월일 없음)
    [`users/${uid}/growthSubjects/subA`, { subjectType: 'child', name: '하준', birthdate: '2025-08-05', gender: 'M', latestRecordDate: '2026-10-02', linkedRecordDates: ['2026-10-01', '2026-10-02'] }],
    [`users/${uid}/growthSubjects/subB`, { subjectType: 'child', name: '하준', latestRecordDate: '2026-10-04', linkedRecordDates: ['2026-10-03', '2026-10-04'] }],
    [`users/${uid}/growthSubjects/subC`, { subjectType: 'child', name: '서윤', birthdate: '2024-01-02', gender: 'F', latestRecordDate: '2026-09-20', linkedRecordDates: ['2026-09-20'] }],
  ]);
  await setSimulatedTime(page, '2026-10-08T21:00:00+09:00');
  const openForm = async () => {
    await openApp(page, { onboarding: 'skip' });
    await openFormatFromHome(page, '육아일기');
    await chooseStyle(page, 'premium');
    await page.waitForTimeout(800);
  };
  const dumpDb = () => page.evaluate(() => (window.__qa && window.__qa.dumpDb ? window.__qa.dumpDb() : []));
  const subjectsOf = (db) => db.filter(([p]) => new RegExp(`^users/${uid}/growthSubjects/[^/]+$`).test(p)).map(([p, d]) => ({ id: p.split('/').pop(), ...d }));
  const recordsOf = (db) => db.filter(([p]) => new RegExp(`^users/${uid}/records/[^/]+$`).test(p)).map(([p, d]) => ({ path: p, ...d }));
  const text = () => pageText(page);

  await openForm();

  // ① 목록 글자
  const options = await page.locator('select').first().evaluate((el) => [...el.options].map((o) => (o.textContent || '').trim()));

  // ② 안내 문구와 잠긴 생년월일·성별 — 이미 있는 이름("서윤")/없는 이름("새아이")/이름이 같은 둘("하준")
  const newInput = page.getByPlaceholder('새 대상 추가');
  const dateInput = page.locator('input[type=date]').first();
  const maleBtn = page.getByRole('button', { name: '남아', exact: true });
  const femaleBtn = page.getByRole('button', { name: '여아', exact: true });
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

  // ③ 저장 — 새 대상이 만들어지지 않고 기존 서윤(subC)에 이어서 기록되는지
  await newInput.fill('서윤');
  await fillTitle(page, '서윤이 새 신발');
  await fillByPlaceholder(page, '우리 아이', '서윤이');
  await driver.saveOriginal(page);
  await driver.waitForSayu(page);
  await page.waitForTimeout(800);
  let db = await dumpDb();
  const afterExisting = {
    subjectCount: subjectsOf(db).length,
    recordSubjectId: (recordsOf(db)[0] || {}).growthSubjectId || null,
    subC: (() => { const c = subjectsOf(db).find((x) => x.id === 'subC'); return c ? { birthdate: c.birthdate, gender: c.gender, linkedRecordDates: c.linkedRecordDates } : null; })(),
  };

  // ④ 오래된 목록 — 화면이 목록을 불러온 뒤 다른 기기에서 "민아"가 새로 등록된 상황
  await openForm();
  await page.evaluate((u) => window.__qa.seedDoc(`users/${u}/growthSubjects/subD`, { subjectType: 'child', name: '민아', birthdate: '2025-03-03', gender: 'F', latestRecordDate: '2026-10-05', linkedRecordDates: ['2026-10-05'] }), uid);
  await newInput.fill('민아');
  await page.waitForTimeout(300);
  const staleHint = new RegExp('이미 등록된 이름이에요').test(await text()); // 오래된 목록이라 화면에서는 모른다(false 가 정상)
  await fillTitle(page, '민아 첫 걸음');
  await fillByPlaceholder(page, '우리 아이', '민아');
  await driver.saveOriginal(page);
  await driver.waitForSayu(page);
  await page.waitForTimeout(800);
  db = await dumpDb();
  const recs = recordsOf(db).sort((a, b) => a.path.localeCompare(b.path));
  const subD = subjectsOf(db).find((x) => x.id === 'subD');
  const afterStale = {
    subjectCount: subjectsOf(db).length,
    names: subjectsOf(db).map((x) => x.name),
    recordSubjectId: (recs[recs.length - 1] || {}).growthSubjectId || null,
    subD: subD ? { birthdate: subD.birthdate, gender: subD.gender, linkedRecordDates: subD.linkedRecordDates } : null,
  };


  // ⑤ 같은 이름 확인(조회)이 실패하는 상황 — 새 대상을 만들어 저장하지 말고 저장을 멈춰야 한다. 연결이 돌아오면 이어서 기록된다.
  const toastsNow = () => page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.innerText.trim()));
  const pathNow = () => new URL(page.url()).pathname;
  await openForm();
  await page.evaluate((u) => window.__qa.seedDoc(`users/${u}/growthSubjects/subE`, { subjectType: 'child', name: '해든', birthdate: '2025-05-05', gender: 'M', latestRecordDate: '2026-10-06', linkedRecordDates: ['2026-10-06'] }), uid);
  await newInput.fill('해든');
  await fillTitle(page, '해든이 첫 이유식');
  await fillByPlaceholder(page, '우리 아이', '해든이');
  const recordsBefore5 = recordsOf(await dumpDb()).length;
  await page.evaluate(() => { window.__qa.failQueries = ['growthSubjects']; });
  await driver.saveOriginal(page);
  await page.waitForTimeout(1800);
  db = await dumpDb();
  const failedLookup = {
    stillOnForm: pathNow() !== '/sayu',
    toast: (await toastsNow()).find((t) => t.includes('확인하지 못했어요')) || null,
    recordsAdded: recordsOf(db).length - recordsBefore5,
    subjectCount: subjectsOf(db).length,
  };
  await page.evaluate(() => { window.__qa.failQueries = []; });
  let retried = { skipped: true }; // 첫 시도에서 이미 저장되어 버렸다면(수정 전 동작) 다시 저장할 화면이 없다
  if (failedLookup.stillOnForm) {
    await driver.saveOriginal(page);
    await driver.waitForSayu(page);
    await page.waitForTimeout(800);
    db = await dumpDb();
    const recs5 = recordsOf(db).sort((a, b) => a.path.localeCompare(b.path));
    retried = {
      subjectCount: subjectsOf(db).length,
      recordSubjectId: (recs5[recs5.length - 1] || {}).growthSubjectId || null,
      recordsAdded: recordsOf(db).length - recordsBefore5,
    };
  }

  // ⑥ 목록이 오래된 상태에서 이미 등록된 아이와 다른 생년월일·성별을 입력하고 저장 — 조용히 바꿔 저장하지 말고 멈춰야 한다
  await openForm();
  await page.evaluate((u) => window.__qa.seedDoc(`users/${u}/growthSubjects/subF`, { subjectType: 'child', name: '지안', birthdate: '2024-06-06', gender: 'M', latestRecordDate: '2026-10-06', linkedRecordDates: ['2026-10-06'] }), uid);
  await newInput.fill('지안');
  await dateInput.fill('2023-01-01');
  await femaleBtn.click();
  await fillTitle(page, '지안이 놀이터');
  await fillByPlaceholder(page, '우리 아이', '지안이');
  const recordsBefore6 = recordsOf(await dumpDb()).length;
  const subjectsBefore6 = subjectsOf(await dumpDb()).length;
  await driver.saveOriginal(page);
  await page.waitForTimeout(1800);
  db = await dumpDb();
  const conflict = {
    stillOnForm: pathNow() !== '/sayu',
    toast: (await toastsNow()).find((t) => t.includes('이미 등록된 "지안"의 생년월일·성별과 입력한 값이 달라요')) || null,
    recordsAdded: recordsOf(db).length - recordsBefore6,
    subjectsAdded: subjectsOf(db).length - subjectsBefore6,
    subF: (() => { const f = subjectsOf(db).find((x) => x.id === 'subF'); return f ? { birthdate: f.birthdate, gender: f.gender } : null; })(),
  };

  // ⑦ 서버에 닿지 못해 조회가 실패하지 않고 빈 캐시 결과(fromCache)로 답하는 상황 — 실제 SDK 의 오프라인 동작.
  //    "없음"으로 보고 새 대상을 만들어 저장하면 안 되고, 저장을 멈춘 뒤 연결이 돌아오면 기존 아이에 이어서 기록돼야 한다.
  await openForm();
  await page.evaluate((u) => window.__qa.seedDoc(`users/${u}/growthSubjects/subG`, { subjectType: 'child', name: '도윤', birthdate: '2025-07-07', gender: 'M', latestRecordDate: '2026-10-07', linkedRecordDates: ['2026-10-07'] }), uid);
  await newInput.fill('도윤');
  await fillTitle(page, '도윤이 첫 계단');
  await fillByPlaceholder(page, '우리 아이', '도윤이');
  const recordsBefore7 = recordsOf(await dumpDb()).length;
  const subjectsBefore7 = subjectsOf(await dumpDb()).length;
  await page.evaluate(() => { window.__qa.cacheOnlyQueries = ['growthSubjects']; });
  await driver.saveOriginal(page);
  await page.waitForTimeout(1800);
  db = await dumpDb();
  const cacheOnly = {
    stillOnForm: pathNow() !== '/sayu',
    toast: (await toastsNow()).find((t) => t.includes('확인하지 못했어요')) || null,
    recordsAdded: recordsOf(db).length - recordsBefore7,
    subjectsAdded: subjectsOf(db).length - subjectsBefore7,
  };
  await page.evaluate(() => { window.__qa.cacheOnlyQueries = []; });
  let retriedCache = { skipped: true }; // 첫 시도에서 이미 저장되어 버렸다면(수정 전 동작) 다시 저장할 화면이 없다
  if (cacheOnly.stillOnForm) {
    await driver.saveOriginal(page);
    await driver.waitForSayu(page);
    await page.waitForTimeout(800);
    db = await dumpDb();
    const recs7 = recordsOf(db).sort((a, b) => a.path.localeCompare(b.path));
    retriedCache = {
      subjectsAdded: subjectsOf(db).length - subjectsBefore7,
      recordSubjectId: (recs7[recs7.length - 1] || {}).growthSubjectId || null,
      recordsAdded: recordsOf(db).length - recordsBefore7,
    };
  }

  result = {
    label: LABEL,
    options,
    expectedOptions: ['기존 대상 선택', '하준 (생년월일 없음 · 최근 기록 2026-10-04)', '하준 (생년월일 2025-08-05 · 최근 기록 2026-10-02)', '서윤'],
    existing, hintExactForSeoyun, brandNew, twins,
    afterExisting, staleHint, afterStale, failedLookup, retried, conflict, cacheOnly, retriedCache,
    pageErrors: s.events.pageErrors, external: s.blocked.length,
  };
  result.pass = JSON.stringify(options) === JSON.stringify(result.expectedOptions)
    && existing.hint === true && hintExactForSeoyun && existing.birthdate === '2024-01-02' && existing.birthdateLocked && existing.genderLocked
    && brandNew.hint === false && brandNew.birthdate === '' && !brandNew.birthdateLocked && !brandNew.genderLocked
    && twins.hint === true && twins.birthdate === '2025-08-05' && twins.birthdateLocked
    && afterExisting.subjectCount === 3 && afterExisting.recordSubjectId === 'subC'
    && afterExisting.subC && afterExisting.subC.birthdate === '2024-01-02' && (afterExisting.subC.linkedRecordDates || []).includes('2026-10-08')
    && staleHint === false
    && afterStale.subjectCount === 4 && afterStale.recordSubjectId === 'subD'
    && afterStale.subD && afterStale.subD.birthdate === '2025-03-03' && (afterStale.subD.linkedRecordDates || []).includes('2026-10-08')
    && failedLookup.stillOnForm && !!failedLookup.toast && failedLookup.recordsAdded === 0 && failedLookup.subjectCount === 5
    && retried.recordSubjectId === 'subE' && retried.subjectCount === 5 && retried.recordsAdded === 1
    && conflict.stillOnForm && !!conflict.toast && conflict.recordsAdded === 0 && conflict.subjectsAdded === 0
    && conflict.subF && conflict.subF.birthdate === '2024-06-06' && conflict.subF.gender === 'M'
    && cacheOnly.stillOnForm && !!cacheOnly.toast && cacheOnly.recordsAdded === 0 && cacheOnly.subjectsAdded === 0
    && retriedCache.recordSubjectId === 'subG' && retriedCache.subjectsAdded === 0 && retriedCache.recordsAdded === 1;
  await s.context.close();
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
