// P14 — HARU보조장부 / 오민석(48·남·동네 카페 사장님, 개인사업자)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  openApp, openFormatFromHome, pageText,
} from '../runner/driver.mjs';

const require = createRequire(import.meta.url);

export const meta = {
  id: 'p14-ledger',
  format: 'HARU보조장부',
  persona: {
    name: '오민석', age: 48, gender: '남', job: '동네 카페 사장님(개인사업자)',
    device: 'iPhone 모양(Chromium 모바일 에뮬레이션, 390×844)', itLevel: '중하', plan: '무료(월 AI 도움 10회)',
    goal: '가게 매출·재료비·접대비를 폰으로 그날그날 적어 두고, 부가세·종합소득세 신고 때 세무사에게 엑셀로 넘기고 싶다.',
  },
  identity: { uid: 'qa-p14-oh-minseok', displayName: '오민석', email: 'p14@example.invalid', plan: 'free' },
  scenario: [
    '1일차(10/1 월초 정리): 지난달 말(9/28~9/30) 거래 3건을 입력 — 카드 매출, 원두 매입(세금계산서), 전기요금',
    '2일차(10/6): 이번 달 거래 5건 입력 — 카드·현금 매출, 원두 매입, 거래처 접대(88만원, 매입세액 불공제), 개인 점심(개인용·증빙 없음). 사업구분을 빠뜨리는 실수 포함',
    '3일차(10/7): 기록합본 화면에서 보조장부 엑셀 저장(이번달/전체), 부가세 신고 준비(2기 예정·10월), 종합소득세 준비를 확인',
  ],
};

// 입력할 거래 — 금액은 사장님이 쓰는 대로(쉼표·원·만원 단위) 적는다.
const SEP = [
  { type: '수입', track: '외부용역', usage: '사업용', category: '매출', date: '2026.09.28', vendor: '카드 매출(주말 마감)', amount: '2,310,000원', payment: '신용카드', proof: '카드매출전표', vatType: '과세', supply: '2,100,000원', vat: '210,000원' },
  { type: '지출', track: '외부용역', usage: '사업용', category: '기타', date: '2026.09.29', vendor: '(주)원두상회', amount: '550,000원', payment: '계좌이체', proof: '전자세금계산서', vatType: '과세', vatDeduction: '공제', supply: '500,000원', vat: '50,000원', hometax: '홈택스 확인' },
  { type: '지출', track: '외부용역', usage: '사업용', category: '기타', date: '2026.09.30', vendor: '한국전력 전기요금', amount: '165,000원', payment: '자동이체', proof: '세금계산서', vatType: '과세', vatDeduction: '공제', supply: '150,000원', vat: '15,000원', hometax: '홈택스 확인' },
];

const OCT = [
  { type: '수입', track: '외부용역', usage: '사업용', category: '매출', date: '2026.10.05', vendor: '카드 매출(일 마감)', amount: '1,100,000원', payment: '신용카드', proof: '카드매출전표', vatType: '과세', supply: '1,000,000원', vat: '100,000원' },
  { type: '수입', track: '외부용역', usage: '사업용', category: '매출', date: '2026.10.06', vendor: '현금 매출', amount: '330,000원', payment: '현금', proof: '현금영수증', vatType: '과세', supply: '300,000원', vat: '30,000원' },
  { type: '지출', track: '외부용역', usage: '사업용', category: '기타', date: '2026.10.05', vendor: '(주)원두상회', amount: '330,000원', payment: '계좌이체', proof: '전자세금계산서', vatType: '과세', vatDeduction: '공제', supply: '300,000원', vat: '30,000원', hometax: '홈택스 확인' },
  { type: '지출', track: '외부용역', usage: '사업용', category: '접대비', date: '2026.10.06', vendor: '한우마을(거래처 접대)', amount: '88만원', payment: '신용카드', proof: '카드매출전표', vatType: '과세', vatDeduction: '불공제', supply: '800,000원', vat: '80,000원' },
  { type: '지출', track: '외부용역', usage: '개인용', category: '식비', date: '2026.10.06', vendor: '개인 점심(칼국수)', amount: '12,000원', payment: '현금', proof: '증빙없음' },
];

// 기대 합계 (입력값에서 직접 계산)
const SEP_VAT = { sales: 2100000, outputVat: 210000, purchase: 650000, deductible: 65000, nonDeductible: 0, expected: 145000 };
const OCT_VAT = { sales: 1300000, outputVat: 130000, purchase: 1100000, deductible: 30000, nonDeductible: 80000, expected: 100000 };
const ALL_INCOME = 2310000 + 1100000 + 330000;                 // 3,740,000
const ALL_EXPENSE = 550000 + 165000 + 330000 + 880000 + 12000; // 1,937,000

async function fillLedgerEntry(page, e, { skipTrack = false } = {}) {
  const sel = (optText) => page.locator('select', { has: page.locator('option', { hasText: optText }) }).last();
  await page.getByRole('button', { name: e.type === '수입' ? '💰 수입' : '📤 지출', exact: true }).last().click();
  if (!skipTrack) await page.getByRole('button', { name: e.track, exact: true }).last().click();
  await page.getByRole('button', { name: e.usage ?? '사업용', exact: true }).last().click();
  if (e.category) await page.getByRole('button', { name: e.category, exact: true }).last().click();
  await page.getByPlaceholder('예: 2026.05.18').last().fill(e.date);
  await page.getByPlaceholder('예: (주)민들레').last().fill(e.vendor);
  await page.getByPlaceholder('예: 15,000원').last().fill(e.amount);
  if (e.payment) await page.getByPlaceholder('예: 신용카드').last().fill(e.payment);
  if (e.proof) await sel('카드매출전표').selectOption({ label: e.proof });
  if (e.vatType) await sel('영세율').selectOption({ label: e.vatType });
  if (e.vatDeduction) await sel('불공제').selectOption({ label: e.vatDeduction });
  if (e.supply) await page.getByPlaceholder('예: 100,000원').last().fill(e.supply);
  if (e.vat) await page.getByPlaceholder('예: 10,000원').last().fill(e.vat);
  if (e.hometax) await sel('홈택스 확인').selectOption({ label: e.hometax });
}

async function openLedger(page) {
  await openApp(page, { onboarding: 'skip' });
  await openFormatFromHome(page, 'HARU보조장부');
  await page.waitForTimeout(900);
}

async function gotoMergeLedger(page) {
  await openApp(page, { onboarding: 'skip' });
  const tile = page.getByRole('button', { name: /기록합본/ }).first();
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '업무', exact: true }).first().click();
  await page.getByRole('button', { name: 'HARU보조장부', exact: true }).first().click();
  await page.waitForTimeout(700);
}

// 버튼을 눌러 내려받은 xlsx 를 읽는다. 내려받기가 일어나지 않으면 null.
async function downloadXlsx(page, clickFn) {
  let dl;
  try {
    [dl] = await Promise.all([page.waitForEvent('download', { timeout: 6000 }), clickFn()]);
  } catch { return null; }
  const XLSX = require('xlsx');
  const wb = XLSX.read(fs.readFileSync(await dl.path()), { type: 'buffer' });
  const sheets = {};
  for (const name of wb.SheetNames) sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  return { fileName: dl.suggestedFilename(), sheets };
}

const noXlsxToast = (t) => t.filter((x) => !/파일로 저장되었습니다/.test(x)); // 앞 단계 엑셀 저장 안내가 겹쳐 보이는 것을 뺀다
const num = (s) => Number(String(s).replace(/[^0-9.-]/g, '')) || 0;
function readCards(text, labels) {
  const out = {};
  for (const [key, label] of Object.entries(labels)) {
    const m = text.match(new RegExp(`${label}\\s*(-?[\\d,]+)원`));
    out[key] = m ? Number(m[1].replace(/,/g, '')) : null;
  }
  return out;
}

export async function run(ctx) {
  const { page } = ctx;
  const uid = meta.identity.uid;
  let day2Shot = null;

  /* ───────── 1일차 ───────── */
  await ctx.setDay('2026-10-01', '21:00');
  await ctx.step('1일차 홈에서 HARU보조장부 열기', async () => {
    await openLedger(page);
    const t = await pageText(page);
    ctx.check('보조장부 작성 화면(단건 작성)이 열린다', /HARU보조장부 작성/.test(t) && /거래 1/.test(t), '');
    const trackOptions = ((t.match(/사업구분\s*\*?\s*([\s\S]*?)사용구분/) || [])[1] || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const shot0 = await ctx.snap('증거-사업구분 선택지');
    ctx.check('사업구분 선택지가 두 가지(HARU2026·외부용역)뿐이 아니다', !(trackOptions.length === 2 && trackOptions.includes('HARU2026') && trackOptions.includes('외부용역')), `선택지: ${JSON.stringify(trackOptions)}`);
    if (trackOptions.length === 2 && trackOptions.includes('HARU2026') && trackOptions.includes('외부용역')) {
      ctx.finding({
        severity: '제안',
        shot: shot0,
        title: '보조장부 "사업구분"이 HARU2026·외부용역 두 가지로 고정되어, 일반 개인사업자는 자기 사업을 나타낼 수 없다',
        detail: `화면 안내는 "개인 및 사업자의 수입·지출 기록을 돕기 위한 보조장부"인데, 필수 항목인 사업구분(*)의 선택지는 ${JSON.stringify(trackOptions)} 두 가지뿐이다(저장 시 "사업구분을 선택해주세요. (HARU2026 / 외부용역)", FormatModal.tsx 2134·4483·5188줄). 카페 사장님은 어느 쪽도 자기 사업이 아니라 임의로 하나를 골라야 하고, 엑셀·집계에도 그 값이 그대로 쓰인다. 입력 예시 문구("앱 운영 구독료", "HARU2026 베타테스트 …")도 앱 운영자 기준이다. 일반 사용자에게 열어 둘 기능이라면 사업구분을 직접 입력/추가하게 하거나 비필수로 두는 방안을 검토할 수 있다(제품 방향은 대표님 결정).`,
      });
    }
  });

  await ctx.step('1일차 지난달 말 거래 3건 입력', async () => {
    for (let i = 0; i < SEP.length; i += 1) {
      if (i > 0) { await page.getByRole('button', { name: '+ 거래 추가' }).click(); await page.waitForTimeout(300); }
      await fillLedgerEntry(page, SEP[i]);
    }
    const label = await page.getByRole('button', { name: /거래 저장하기/ }).innerText();
    ctx.check('저장 버튼에 입력한 건수(3건)가 표시된다', /3건/.test(label), label, '경미');
  });

  await ctx.step('1일차 저장', async () => {
    await page.getByRole('button', { name: /거래 저장하기/ }).click();
    await page.waitForTimeout(2500);
    return { note: `저장 후 이동: ${new URL(page.url()).pathname}` };
  });

  await ctx.step('1일차 저장 결과 확인', async () => {
    const recs = await ctx.records(uid);
    ctx.check('기록이 1건 생긴다', recs.length === 1, `records ${recs.length}건`, '치명');
    const r = recs[0];
    if (!r) return;
    let entries = [];
    try { entries = JSON.parse(r.ledger_entries || '[]'); } catch { /* 아래에서 실패 */ }
    ctx.check('거래 3건이 ledger_entries 에 저장된다', entries.length === 3, `entries ${entries.length}건`, '치명');
    ctx.check('저장 경로가 users/{uid}/records/{날짜}_{시각} 형태다', new RegExp(`^users/${uid}/records/2026-10-01_\\d+$`).test(r.path), r.path, '치명');
    ctx.check('입력한 날짜(2026.09.28 등)와 금액이 그대로 보존된다', entries[0]?.date === '2026.09.28' && entries[0]?.amount === '2,310,000원', JSON.stringify(entries[0] && [entries[0].date, entries[0].amount]), '중대');
    return { note: JSON.stringify({ path: r.path, entries: entries.map((x) => [x.date, x.transactionType, x.vendor, x.amount, x.vatTaxType, x.vatDeduction]) }) };
  });

  /* ───────── 2일차 ───────── */
  await ctx.setDay('2026-10-06', '22:30');
  await ctx.step('2일차 보조장부 열고 첫 거래 입력(사업구분을 빠뜨림)', async () => {
    await openLedger(page);
    await fillLedgerEntry(page, OCT[0], { skipTrack: true });
  });

  await ctx.step('2일차 사업구분 없이 저장 시도 → 안내 후 선택', async () => {
    await page.getByRole('button', { name: /거래 저장하기/ }).click();
    await page.waitForTimeout(600);
    const t = await ctx.toasts();
    ctx.check('사업구분을 빠뜨리면 안내 문구로 저장이 막힌다', t.some((x) => /사업구분을 선택해주세요/.test(x)), JSON.stringify(t), '중대');
    ctx.check('저장이 막혀도 화면에서 입력한 값이 남아 있다', (await page.getByPlaceholder('예: (주)민들레').last().inputValue()) === OCT[0].vendor, '', '중대');
    await page.getByRole('button', { name: OCT[0].track, exact: true }).last().click();
  });

  await ctx.step('2일차 나머지 거래 4건 입력', async () => {
    for (let i = 1; i < OCT.length; i += 1) {
      await page.getByRole('button', { name: '+ 거래 추가' }).click();
      await page.waitForTimeout(300);
      await fillLedgerEntry(page, OCT[i]);
    }
    const label = await page.getByRole('button', { name: /거래 저장하기/ }).innerText();
    ctx.check('저장 버튼에 입력한 건수(5건)가 표시된다', /5건/.test(label), label, '경미');
    day2Shot = await ctx.snap('증거-2일차 입력 마지막 거래');
  });

  await ctx.step('2일차 저장', async () => {
    await page.waitForTimeout(2800); // 앞 안내가 사라질 때까지
    await page.getByRole('button', { name: /거래 저장하기/ }).click();
    await page.waitForTimeout(2500);
    return { note: `저장 후 이동: ${new URL(page.url()).pathname}` };
  });

  await ctx.step('2일차 저장 결과 확인', async () => {
    const recs = await ctx.records(uid);
    ctx.check('2일차 기록이 1건 더 생긴다(총 2건)', recs.length === 2, `records ${recs.length}건`, '치명');
    const r = recs[1];
    if (!r) return;
    let entries = [];
    try { entries = JSON.parse(r.ledger_entries || '[]'); } catch { /* 아래에서 실패 */ }
    ctx.check('거래 5건이 저장된다', entries.length === 5, `entries ${entries.length}건`, '치명');
    const rep = entries.find((x) => x.vendor.startsWith('한우마을'));
    ctx.check('"88만원"으로 쓴 금액이 입력한 그대로 저장된다', rep?.amount === '88만원', `amount="${rep?.amount}"`);
    ctx.check('"불공제"로 고른 매입세액 공제 여부가 저장된다', rep?.vatDeduction === 'nonDeductible', `vatDeduction="${rep?.vatDeduction}"`, '중대');
    const personal = entries.find((x) => x.vendor.startsWith('개인 점심'));
    ctx.check('개인용 거래가 개인용으로 저장된다', personal?.usageType === '개인용', `usageType="${personal?.usageType}"`, '중대');
    ctx.check('사업구분이 저장된다(external)', entries.every((x) => x.businessTrack === 'external'), JSON.stringify(entries.map((x) => x.businessTrack)), '중대');
    return { note: JSON.stringify(entries.map((x) => [x.date, x.transactionType, x.vendor, x.amount, x.usageType, x.vatDeduction])) };
  });

  /* ───────── 3일차 ───────── */
  await ctx.setDay('2026-10-07', '09:00');
  await ctx.step('3일차 기록합본에서 보조장부 열기', async () => {
    await gotoMergeLedger(page);
    const t = await pageText(page);
    ctx.check('기록합본 화면에 "보조장부 엑셀 저장"이 보인다', /보조장부 엑셀 저장/.test(t), new URL(page.url()).pathname, '중대');
  });

  let monthXlsx = null;
  await ctx.step('3일차 "이번달" 엑셀 저장', async () => {
    await page.getByRole('button', { name: '이번달', exact: true }).first().click();
    monthXlsx = await downloadXlsx(page, () => page.getByRole('button', { name: '보조장부 엑셀 저장', exact: true }).click());
    ctx.check('이번달 엑셀이 내려받아진다', !!monthXlsx, '', '중대');
    if (!monthXlsx) return;
    const rows = (monthXlsx.sheets['거래상세내역'] || []).slice(1);
    const dates = rows.map((r) => String(r[1]));
    const inOct = dates.filter((d) => d.startsWith('2026.10')).length;
    const inSep = dates.filter((d) => d.startsWith('2026.09')).length;
    ctx.check('이번달(10월) 엑셀에는 10월 거래 5건만 들어간다', rows.length === 5 && inSep === 0, `엑셀 ${rows.length}행 (10월 거래 ${inOct}건, 9월 거래 ${inSep}건) — 파일 ${monthXlsx.fileName}`);
    if (inSep > 0) {
      ctx.finding({
        severity: '중대',
        title: '월별 엑셀이 거래일이 아니라 "입력한 날"로 거른다 — 월초에 지난달 거래를 적으면 이번 달 엑셀에 섞인다',
        detail: `10/1에 9/28~9/30 거래 3건을 입력하고 10/6에 10월 거래 5건을 입력한 뒤 "이번달" 엑셀을 저장하니 ${rows.length}행이 들어갔고 그중 9월 거래가 ${inSep}건이다(기대: 10월 거래 5건). 보조장부 엑셀(exportLedgerToXlsx)은 기록 문서의 저장일(r.date)로 기간을 거르고, 부가세·종합소득세 준비는 거래의 날짜(entry.date)로 거른다. 같은 달이라도 두 화면의 건수·합계가 서로 다르게 나온다.`,
      });
    }
  });

  await ctx.step('3일차 "전체" 엑셀 저장 — 계정과목 집계 확인', async () => {
    await page.getByRole('button', { name: '전체', exact: true }).first().click();
    const allXlsx = await downloadXlsx(page, () => page.getByRole('button', { name: '보조장부 엑셀 저장', exact: true }).click());
    ctx.check('전체 엑셀이 내려받아진다', !!allXlsx, '', '중대');
    if (!allXlsx) return;
    const detail = allXlsx.sheets['거래상세내역'] || [];
    const header = detail[0] || [];
    const rows = detail.slice(1);
    ctx.check('전체 엑셀에 거래 8건이 모두 들어간다', rows.length === 8, `엑셀 ${rows.length}행`, '치명');
    const col = (name) => header.indexOf(name);
    const amountCol = col('원화금액(원)');
    const typeCol = col('수입/지출');
    const sumBy = (t) => rows.filter((r) => r[typeCol] === t).reduce((s, r) => s + num(r[amountCol]), 0);
    const income = sumBy('수입');
    const expense = sumBy('지출');
    ctx.check('상세 시트의 수입 합계가 입력한 매출 합계(3,740,000원)와 같다', income === ALL_INCOME, `엑셀 수입 ${income}원 / 기대 ${ALL_INCOME}원`, '중대');
    ctx.check('상세 시트의 지출 합계가 입력한 지출 합계(1,937,000원)와 같다 — "88만원"이 880,000원으로 계산된다', expense === ALL_EXPENSE, `엑셀 지출 ${expense}원 / 기대 ${ALL_EXPENSE}원`, '중대');

    const summary = allXlsx.sheets['계정과목집계'] || [];
    const grand = summary.find((r) => String(r[0]).replace(/\s/g, '') === '합계');
    const grandTotal = grand ? num(grand[1]) : null;
    const mixed = grandTotal === ALL_INCOME + ALL_EXPENSE;
    const sumShot = await ctx.snap('증거-계정과목집계 계산');
    ctx.check('계정과목 집계 시트의 합계가 수입과 지출을 한데 더하지 않는다', !mixed, `집계 시트 합계 ${grandTotal}원 (수입 ${income} + 지출 ${expense} = ${income + expense}) / 시트 내용: ${JSON.stringify(summary)}`);
    if (mixed) {
      ctx.finding({
        severity: '중대',
        shot: sumShot,
        title: '보조장부 엑셀의 "계정과목집계" 시트가 매출(수입)과 지출을 한 합계로 더한다',
        detail: `수입 ${income.toLocaleString()}원, 지출 ${expense.toLocaleString()}원을 입력했는데 계정과목집계 시트의 합계가 ${grandTotal?.toLocaleString()}원(=수입+지출)이다. 매출이 "잡비" 같은 지출 계정으로 분류되어 지출과 같은 줄에 합산된다(ledgerExportService.ts exportLedgerToXlsx: accountSummary 에 거래 유형과 상관없이 더함). 세무사에게 넘길 자료로는 쓸 수 없다. 시트 내용: ${JSON.stringify(summary)}`,
      });
    }
    // 부가세공제 열
    const dedCol = col('부가세공제');
    const vendorCol = col('거래처');
    const rep = rows.find((r) => String(r[vendorCol]).startsWith('한우마을'));
    const sales = rows.find((r) => String(r[vendorCol]).startsWith('현금 매출'));
    ctx.check('상세 시트의 부가세공제 열이 입력한 "불공제"를 따른다', rep && rep[dedCol] === '불공제', `접대 거래(불공제로 입력)의 엑셀 값: "${rep && rep[dedCol]}" / 매출 거래의 엑셀 값: "${sales && sales[dedCol]}"`);
    if (rep && rep[dedCol] !== '불공제') {
      ctx.finding({
        severity: '중대',
        shot: sumShot,
        title: '엑셀의 "부가세공제" 열이 입력한 공제 여부를 무시하고 거래처·분류로 짐작한 값을 쓴다',
        detail: `접대비 거래를 "불공제"로 입력했는데 엑셀 상세 시트의 부가세공제 열은 "${rep[dedCol]}"이다. 매출(수입) 거래에도 "${sales && sales[dedCol]}"가 적힌다. inferVatDeductible()이 거래처 이름·계정과목만 보고 정하며 거래에 저장된 vatDeduction 은 읽지 않는다(ledgerExportService.ts). 같은 거래가 "부가세 신고 준비" 화면에서는 불공제로 집계되므로 두 자료가 서로 어긋난다.`,
      });
    }
    return { note: JSON.stringify({ header, income, expense, grandTotal }) };
  });

  await ctx.step('3일차 부가세 신고 준비 — 2기 예정(7~9월) 집계', async () => {
    const vat = page.locator('div.mx-3.my-2', { hasText: '부가세 신고 준비' }).first();
    await vat.getByRole('button', { name: '2기 예정 참고' }).click();
    await vat.getByRole('button', { name: '신고 준비 집계' }).click();
    await page.waitForTimeout(900);
    const t = noXlsxToast(await ctx.toasts());
    const text = await pageText(page);
    const got = readCards(text, { sales: '과세매출 공급가액', outputVat: '매출 부가세', purchase: '과세매입 공급가액', deductible: '공제가능 매입세액', nonDeductible: '불공제 매입세액', expected: '예상 차감세액' });
    const shot = await ctx.snap('증거-부가세 2기 예정 집계');
    const ok = Object.keys(SEP_VAT).every((k) => got[k] === SEP_VAT[k]);
    ctx.check('2기 예정(7~9월) 부가세 집계가 입력한 9월 거래 3건과 맞는다', ok, `화면 ${JSON.stringify(got)} / 기대 ${JSON.stringify(SEP_VAT)} / 안내 ${JSON.stringify(t)}`);
    if (!ok) {
      ctx.finding({
        severity: '중대',
        shot,
        title: '부가세 신고 준비 집계가 "2026.09.28" 형식으로 입력한 거래를 한 건도 세지 못한다',
        detail: `보조장부 입력칸 안내 예시("예: 2026.05.18")대로 날짜를 쓰고 9월 거래 3건(매출 공급가액 2,100,000원 등)을 저장한 뒤 "2기 예정 참고" 기간으로 집계하니 ${JSON.stringify(got)}가 나왔고 안내는 ${JSON.stringify(t)}였다(기대 ${JSON.stringify(SEP_VAT)}). 집계 함수(buildLedgerVatReport → isInRange)는 "YYYY-MM-DD" 형식의 날짜만 인정하는데, 직접 입력한 날짜는 입력한 글자 그대로("2026.09.28") 저장된다(정규화는 XLSX 가져오기에서만 한다). 종합소득세 준비도 같은 함수를 쓴다.`,
      });
    }
  });

  await ctx.step('3일차 부가세 신고 준비 — 10월 직접 지정 집계', async () => {
    const vat = page.locator('div.mx-3.my-2', { hasText: '부가세 신고 준비' }).first();
    await vat.getByRole('button', { name: '사용자 지정 기간' }).click();
    const dates = vat.locator('input[type=date]');
    await dates.nth(0).fill('2026-10-01');
    await dates.nth(1).fill('2026-10-31');
    await vat.getByRole('button', { name: '신고 준비 집계' }).click();
    await page.waitForTimeout(900);
    const t = noXlsxToast(await ctx.toasts());
    const text = await pageText(page);
    const got = readCards(text, { sales: '과세매출 공급가액', outputVat: '매출 부가세', purchase: '과세매입 공급가액', deductible: '공제가능 매입세액', nonDeductible: '불공제 매입세액', expected: '예상 차감세액' });
    await ctx.snap('증거-부가세 10월 집계');
    const ok = Object.keys(OCT_VAT).every((k) => got[k] === OCT_VAT[k]);
    ctx.check('10월 부가세 집계가 입력한 10월 거래와 맞는다', ok, `화면 ${JSON.stringify(got)} / 기대 ${JSON.stringify(OCT_VAT)} / 안내 ${JSON.stringify(t)}`);
  });

  await ctx.step('3일차 종합소득세 준비 — 10월 집계', async () => {
    const tax = page.locator('div.mx-3.my-2', { hasText: '종합소득세 준비' }).first();
    await tax.getByRole('button', { name: '종합소득세 집계' }).click();
    await page.waitForTimeout(900);
    const t = noXlsxToast(await ctx.toasts());
    const text = await pageText(page);
    const got = readCards(text, { income: '총 수입', deductible: '필요경비 인정 거래 합계', review: '확인필요 거래 합계' });
    await ctx.snap('증거-종합소득세 10월 집계');
    ctx.check('종합소득세 준비의 총 수입이 10월 사업 매출 합계(1,430,000원)와 같다', got.income === 1430000, `화면 ${JSON.stringify(got)} / 안내 ${JSON.stringify(t)}`);
  });

  await ctx.step('3일차 부가세 준비자료 XLSX 저장(10월)', async () => {
    const vat = page.locator('div.mx-3.my-2', { hasText: '부가세 신고 준비' }).first();
    const x = await downloadXlsx(page, () => vat.getByRole('button', { name: '준비자료 XLSX 저장' }).click());
    const t = await ctx.toasts();
    ctx.check('부가세 준비자료 엑셀이 내려받아진다', !!x, JSON.stringify(t));
    if (x) {
      const rows = Object.fromEntries(Object.entries(x.sheets).map(([k, v]) => [k, v.length]));
      const saidEmpty = t.some((m) => /내보낼 .*거래가 없습니다/.test(m));
      const hasRows = (rows.Sales || 0) > 1 || (rows.Purchases || 0) > 1;
      ctx.check('"내보낼 거래가 없다"고 안내하면 파일은 내려받아지지 않는다', !(saidEmpty && !hasRows), `안내 ${JSON.stringify(t.filter((m) => /내보낼/.test(m)))} / 내려받은 파일 ${x.fileName}의 시트별 줄 수 ${JSON.stringify(rows)}`);
      if (saidEmpty && !hasRows) {
        ctx.finding({
          severity: '경미',
          title: '"내보낼 거래가 없습니다"라고 안내하면서도 거래 없는 빈 엑셀 파일을 내려받게 한다',
          detail: `부가세 준비자료 XLSX 저장을 누르자 "${t.filter((m) => /내보낼/.test(m)).join(' / ')}"라는 안내가 뜨는데, 동시에 파일(${x.fileName})이 내려받아졌다. 시트별 줄 수 ${JSON.stringify(rows)}로 매출·매입 시트는 제목 줄뿐이다(집계 시트만 0원으로 채워짐). 앞의 날짜 형식 문제로 거래가 0건이 된 경우뿐 아니라 거래 없는 기간을 고른 모든 경우에 해당한다(ledgerExportService.ts exportLedgerVatPrepToXlsx 가 건수와 상관없이 파일을 먼저 만든다). 세무사에게 빈 파일을 보내는 실수로 이어질 수 있다.`,
        });
      }
      return { note: JSON.stringify({ file: x.fileName, rows }) };
    }
  });

  /* ───────── 대조: 입력 날짜 형식만 바꿔 같은 집계를 다시 본다 ───────── */
  await ctx.setDay('2026-10-07', '10:00');
  await ctx.step('[대조] 하이픈 날짜(2026-10-07)로 적은 거래 1건 입력·저장', async () => {
    await openLedger(page);
    await fillLedgerEntry(page, { type: '지출', track: '외부용역', usage: '사업용', category: '사무용품', date: '2026-10-07', vendor: '문구점', amount: '22,000원', payment: '신용카드', proof: '카드매출전표', vatType: '과세', vatDeduction: '공제', supply: '20,000원', vat: '2,000원' });
    await page.getByRole('button', { name: /거래 저장하기/ }).click();
    await page.waitForTimeout(2500);
  });

  await ctx.step('[대조] 10월 부가세 집계에 하이픈 날짜 거래만 잡히는지', async () => {
    await gotoMergeLedger(page);
    const vat = page.locator('div.mx-3.my-2', { hasText: '부가세 신고 준비' }).first();
    await vat.getByRole('button', { name: '사용자 지정 기간' }).click();
    const dates = vat.locator('input[type=date]');
    await dates.nth(0).fill('2026-10-01');
    await dates.nth(1).fill('2026-10-31');
    await vat.getByRole('button', { name: '신고 준비 집계' }).click();
    await page.waitForTimeout(900);
    const t = noXlsxToast(await ctx.toasts());
    const got = readCards(await pageText(page), { sales: '과세매출 공급가액', purchase: '과세매입 공급가액', deductible: '공제가능 매입세액' });
    await ctx.snap('증거-대조 하이픈 날짜 집계');
    ctx.check('[대조] 하이픈 날짜("2026-10-07")로 입력한 거래는 집계에 잡힌다 — 날짜 글자 형식이 원인임을 확인', got.purchase === 20000 && got.deductible === 2000, `화면 ${JSON.stringify(got)} / 안내 ${JSON.stringify(t)} (점 날짜 10월 거래 5건은 여전히 빠짐)`);
  });

  await ctx.step('3일차 내 기록(SAYU)에서 보조장부 기록 확인', async () => {
    await openApp(page, { onboarding: 'skip' });
    await page.getByText('SAYU·나의 기록', { exact: false }).first().click();
    await page.waitForTimeout(1500);
    const groupTitle = page.locator('text=HARU보조장부').filter({ hasText: /^HARU보조장부$/ });
    const visibleBefore = (await pageText(page)).includes('카드 매출(주말 마감)');
    if (!visibleBefore && await groupTitle.count()) { await groupTitle.last().click(); await page.waitForTimeout(1200); }
    const text = await pageText(page);
    ctx.check('내 기록 목록에 보조장부 기록 3건(9월 말 입력분·10월 입력분·대조 입력분)이 보인다', /카드 매출\(주말 마감\)/.test(text) && /카드 매출\(일 마감\)/.test(text) && /문구점/.test(text), text.slice(0, 600).replace(/\n+/g, ' ⏎ '), '중대');
    await ctx.snap('증거-내 기록 목록의 보조장부');
  });
}
