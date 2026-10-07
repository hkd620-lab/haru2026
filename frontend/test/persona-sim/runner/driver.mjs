// 페르소나 스크립트가 쓰는 공용 조작 도구.
// 원칙: 실제 사용자처럼 "홈 → 형식 카드 → 작성 → 저장 → SAYU" 순서로 화면을 눌러서 쓴다.
//       (주소창으로 /record 에 바로 들어가면 뒤로 갈 곳이 없어 닫기 동작이 달라진다.)
import path from 'node:path';
import { BASE_URL, ensureDir, readQa } from './lib.mjs';

const slug = (s) => s.replace(/[^0-9A-Za-z가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export const SEVERITY = ['치명', '중대', '경미', '제안', '참고'];

export function createContext({ page, context, events, blocked, outDir, meta }) {
  const steps = [];
  const findings = [];
  const checks = [];
  let shotNo = 0;
  let currentStep = '';
  let stepEvidence = null; // 현재 단계에서 "증거-" 로 찍은 가장 최근 스크린샷
  ensureDir(outDir);

  const ctx = {
    page, meta, steps, findings, checks, events, blocked, outDir,

    toasts: () => page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.innerText.trim())),

    async snap(name) {
      shotNo += 1;
      const file = `${String(shotNo).padStart(2, '0')}-${slug(name)}.png`;
      await page.screenshot({ path: path.join(outDir, file) }).catch(() => {});
      if (name.startsWith('증거')) stepEvidence = file;
      return file;
    },

    async step(name, fn, { shot = true } = {}) {
      currentStep = name;
      stepEvidence = null;
      const findingsBefore = findings.length;
      const t0 = Date.now();
      let ok = true; let error; let note;
      try { const ret = await fn(); if (ret && ret.note) note = ret.note; } catch (e) { ok = false; error = String(e?.message || e).split('\n')[0]; }
      const rec = {
        n: steps.length + 1, name, ok, ms: Date.now() - t0, error, note,
        url: (() => { try { return new URL(page.url()).pathname; } catch { return page.url(); } })(),
        toasts: await ctx.toasts().catch(() => []),
      };
      if (shot) rec.shot = await ctx.snap(name);
      // 이 단계에서 생긴 발견 중 증거 캡처가 없는 것은 단계 마지막 화면을 증거로 쓴다
      for (let k = findingsBefore; k < findings.length; k += 1) if (!findings[k].shot) findings[k].shot = rec.shot || null;
      steps.push(rec);
      return rec;
    },

    finding(f) { findings.push({ step: currentStep, shot: f.shot || stepEvidence || null, ...f }); },

    // 기대와 다르면 failed 로 남기고, severity 를 주면 발견 사항으로도 올린다.
    check(name, ok, detail = '', severity) {
      checks.push({ step: currentStep, name, ok: !!ok, detail });
      if (!ok && severity) ctx.finding({ severity, title: name, detail });
      return !!ok;
    },

    qa: () => readQa(page),
    db: () => page.evaluate(() => (window.__qa && window.__qa.dumpDb ? window.__qa.dumpDb() : [])),
    async records(uid) {
      const all = await ctx.db();
      return all
        .filter(([p]) => new RegExp(`^users/${uid}/records/[^/]+$`).test(p))
        .map(([p, d]) => ({ path: p, ...d }))
        .sort((a, b) => a.path.localeCompare(b.path));
    },

    // 하루 단위 시간 이동 — 한국 시간 저녁에 기록하는 사용자를 흉내 낸다.
    async setDay(dateStr, hhmm = '21:30') {
      const target = new Date(`${dateStr}T${hhmm}:00+09:00`).getTime();
      const setAtReal = Date.now();
      await context.addInitScript(([t, s]) => { window.__QA_BASE__ = { target: t, setAtReal: s }; }, [target, setAtReal]);
      await page.evaluate(([t, s]) => { window.__QA_BASE__ = { target: t, setAtReal: s }; }, [target, setAtReal]).catch(() => {});
    },
  };
  return ctx;
}

/* ───────── 화면 이동 ───────── */

// 홈(/)으로 들어간다. 처음 쓰는 사용자는 첫 안내(/onboarding)가 먼저 나온다.
export async function openApp(page, { onboarding = 'skip' } = {}) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  let sawOnboarding = false;
  if (new URL(page.url()).pathname === '/onboarding') {
    sawOnboarding = true;
    await page.getByText(onboarding === 'first-record' ? '바로 첫 기록 쓰기' : '오늘은 건너뛰기').first().click();
    await page.waitForTimeout(900);
  }
  return { sawOnboarding };
}

// 홈 화면의 기록 카드를 눌러 해당 형식 작성으로 들어간다. (홈에 없는 형식은 openFormatOnRecordPage 사용)
export async function openFormatFromHome(page, label) {
  await page.locator('[data-v2=records-grid] button', { hasText: new RegExp(`^\\s*${label}`) }).first().click();
  await page.waitForTimeout(700);
}

// /record 화면의 형식 버튼으로 연다. category 는 생활(기본)/업무/하루LAW.
export async function openFormatOnRecordPage(page, format, category = '생활') {
  if (category !== '생활') {
    await page.getByRole('button', { name: category, exact: true }).first().click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: format, exact: true }).first().click();
  await page.waitForTimeout(700);
}

export async function chooseStyle(page, style /* 'simple' | 'premium' */) {
  await page.getByText(style === 'simple' ? '간편 기록' : '프리미엄 기록').first().click();
  await page.waitForTimeout(600);
}

/* ───────── 입력 ───────── */

export const fillTitle = (page, title) => page.getByPlaceholder('제목을 입력해 주세요').fill(title);
export const fillSimple = (page, text) => page.getByPlaceholder('자유롭게 기록해 주세요').fill(text);

// 프리미엄 칸은 placeholder 앞부분으로 찾는다(형식별 FORMAT_FIELDS 의 예시 문구).
export async function fillByPlaceholder(page, placeholderStart, text) {
  await page.locator(`textarea[placeholder^="${placeholderStart}"], input[placeholder^="${placeholderStart}"]`).first().fill(text);
}

export async function attachPhotos(page, files) {
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles(files);
  await page.waitForTimeout(1800);
}

/* ───────── 저장 ───────── */

// 형식마다 저장 버튼 이름이 다르다(일기: 간편·프리미엄 모두 "원본 저장"/"AI 다듬은 글 저장",
// 육아일기 등 프리미엄: "다듬지 않고 SAYU-나의기록 저장"/"AI 다듬은 후 SAYU-나의기록 저장").
const ORIGINAL_BTN = /(^원본 저장$|다듬지 않고 SAYU-나의기록 저장)/;
const AI_BTN = /(AI 다듬은 글 저장|AI 다듬은 후 SAYU-나의기록 저장)/;

export async function saveOriginal(page) {
  await page.getByRole('button', { name: ORIGINAL_BTN }).first().click({ timeout: 8000 });
}

// AI 사용 안내 → 실행 → 미리보기 → 저장까지. 한도 초과 등은 호출한 쪽에서 토스트로 판단한다.
export async function saveWithAi(page, { onPreview } = {}) {
  await page.getByRole('button', { name: AI_BTN }).first().click({ timeout: 8000 });
  await page.getByRole('button', { name: 'AI 다듬기 실행' }).click({ timeout: 8000 });
  // 미리보기 창의 저장 버튼 — 형식 화면 아래쪽의 "…SAYU-나의기록 저장" 버튼과 구분하려고 💾 로 찾는다.
  const save = page.getByRole('button', { name: '💾 SAYU-나의기록 저장' });
  await save.waitFor({ timeout: 10000 });
  if (onPreview) await onPreview();
  await save.click();
}

export async function waitForSayu(page) {
  await page.waitForURL('**/sayu', { timeout: 10000 });
  await page.waitForTimeout(1200);
}

export const pageText = (page) => page.evaluate(() => document.body.innerText);
