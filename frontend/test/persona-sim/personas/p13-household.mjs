// P13 — HARU가계부 / 송다은(26·여·사회초년생)
import {
  openApp, openFormatFromHome, fillTitle, pageText,
} from '../runner/driver.mjs';

export const meta = {
  id: 'p13-household',
  format: 'HARU가계부',
  persona: {
    name: '송다은', age: 26, gender: '여', job: '사회초년생(IT 회사 1년 차)',
    device: 'iPhone 모양(Chromium 모바일 에뮬레이션, 390×844)', itLevel: '중상', plan: '무료(월 AI 도움 10회)',
    goal: '월급·카드값·구독료를 한 곳에 적어 두고 이번 달에 얼마 썼는지 한눈에 보고 싶다.',
  },
  identity: { uid: 'qa-p13-song-daeun', displayName: '송다은', email: 'p13@example.invalid', plan: 'free' },
  scenario: [
    '1일차: 홈의 HARU가계부 카드 → 가계부 화면 → "첫 기록 추가"로 월급·지출 3건·계좌이체 1건을 한 번에 입력해 저장하고, 위쪽 합계가 맞는지 확인',
    '2일차: 서두르다 하기 쉬운 입력 — 금액 비움, 사용처 비움, "5천원"처럼 한글 단위 금액, 날짜 비움',
  ],
};

// 1일차에 입력할 거래 — 합계: 수입 2,800,000 / 지출 9,500+1,550+17,000 = 28,050 / 이체 600,000(내 통장끼리)
const DAY1 = [
  { type: '수입', category: '월급', payment: '계좌이체', date: '2026.10.01', amount: '2,800,000', vendor: '(주)한빛소프트' },
  { type: '지출', category: '식비', payment: '체크카드', date: '2026.10.02', amount: '9,500원', vendor: '회사 앞 김밥집' },
  { type: '지출', category: '교통비', payment: '체크카드', date: '2026.10.02', amount: '1550', vendor: '지하철' },
  { type: '지출', category: '구독료', payment: '신용카드', date: '2026.10.03', amount: '17,000', vendor: '넷플릭스' },
  { type: '이체', date: '2026.10.05', amount: '600000', vendor: '급여통장 → 월세통장' }, // 안내 예시와 같은 "내 통장끼리" 이체
];

const DAY1_EXPECT = { income: 2800000, expense: 28050 };

async function fillEntry(page, e) {
  // "이체"는 결제수단 칩("계좌이체")과 이름이 겹치므로 이모지까지 정확히 맞춘다.
  const TYPE_LABEL = { 수입: '💰 수입', 지출: '📤 지출', 이체: '🔄 이체' };
  await page.getByRole('button', { name: TYPE_LABEL[e.type], exact: true }).last().click();
  if (e.category) await page.getByRole('button', { name: e.category, exact: true }).last().click();
  if (e.payment) await page.getByRole('button', { name: e.payment, exact: true }).last().click();
  if (e.date !== undefined && e.date !== '') await page.getByPlaceholder('2026.06.25').last().fill(e.date);
  if (e.amount !== undefined) await page.getByPlaceholder('50000').last().fill(e.amount);
  if (e.vendor) {
    const ph = e.type === '수입' ? '회사명, 거래처, 출처 등' : e.type === '이체' ? '어디서 → 어디로' : '마트, 편의점, 카페 등';
    await page.locator(`input[placeholder^="${ph}"]`).last().fill(e.vendor);
  }
}

async function readDashboard(page) {
  const t = await pageText(page);
  const block = t.slice(t.indexOf('전체수입'), t.indexOf('통계 차트') > 0 ? t.indexOf('통계 차트') : undefined);
  const n = (re) => { const m = block.match(re); return m ? Number(m[1].replace(/,/g, '')) : null; };
  const cnt = t.match(/이번 달 거래 내역 \((\d+)건\)/);
  return {
    income: n(/전체수입\s*([\d,]+)원/), expense: n(/지출\s*([\d,]+)원/), balance: n(/수지\s*(-?[\d,]+)원/),
    count: cnt ? Number(cnt[1]) : null, sub: (block.match(/순수입[^\n]*/) || [''])[0],
  };
}

export async function run(ctx) {
  const { page } = ctx;
  const uid = meta.identity.uid;
  let titleShot = null; // 제목 입력 화면 증거

  /* ───────── 1일차 ───────── */
  await ctx.setDay('2026-10-01', '21:00');
  await ctx.step('1일차 홈에서 HARU가계부 열기', async () => {
    await openApp(page, { onboarding: 'skip' });
    await openFormatFromHome(page, 'HARU가계부');
    await page.waitForTimeout(1000);
    ctx.check('HARU가계부 카드를 누르면 가계부 화면(/household)이 열린다', new URL(page.url()).pathname === '/household', page.url(), '중대');
    const t = await pageText(page);
    ctx.check('기록이 없을 때 "이번 달 기록이 없습니다." 안내가 보인다', /이번 달 기록이 없습니다/.test(t), '', '경미');
  });

  await ctx.step('1일차 "첫 기록 추가"로 거래 5건 입력', async () => {
    await page.getByText('첫 기록 추가').first().click();
    await page.waitForTimeout(900);
    await fillTitle(page, '10월 생활비');
    await page.getByPlaceholder('제목을 입력해 주세요').scrollIntoViewIfNeeded();
    titleShot = await ctx.snap('증거-제목 입력');
    for (let i = 0; i < DAY1.length; i += 1) {
      if (i > 0) { await page.getByRole('button', { name: '+ 거래 추가' }).click(); await page.waitForTimeout(300); }
      await fillEntry(page, DAY1[i]);
    }
    const saveLabel = await page.getByRole('button', { name: /거래 저장하기/ }).innerText();
    ctx.check('저장 버튼에 입력한 건수(5건)가 표시된다', /5건/.test(saveLabel), saveLabel, '경미');
  });

  await ctx.step('1일차 저장', async () => {
    await page.getByRole('button', { name: /거래 저장하기/ }).click();
    await page.waitForTimeout(2200);
    const back = new URL(page.url()).pathname;
    ctx.check('"첫 기록 추가"로 저장한 뒤 가계부 화면(/household)으로 돌아온다', back === '/household', `저장 후 이동한 화면: ${back}`);
    if (back !== '/household') {
      ctx.finding({
        severity: '경미',
        title: '"첫 기록 추가"로 저장하면 가계부 화면이 아니라 홈으로 돌아간다 ("+" 버튼과 동작이 다름)',
        detail: `빈 가계부 화면의 "첫 기록 추가"로 거래를 저장하면 ${back} (홈)로 이동해 방금 입력한 합계를 바로 볼 수 없다. 오른쪽 아래 "+" 버튼은 저장 후 /household 로 돌아온다. HouseholdPage.tsx 363줄(첫 기록 추가)은 from 값을 넘기지 않고 387줄(+)은 from:'/household' 를 넘긴다.`,
      });
    }
  });

  await ctx.step('1일차 저장 결과·합계 확인', async () => {
    const recs = await ctx.records(uid);
    ctx.check('기록이 1건 생긴다(거래 5건이 한 문서에 담김)', recs.length === 1, `records ${recs.length}건`, '치명');
    const r = recs[0];
    if (!r) return;
    ctx.check('저장 경로가 users/{uid}/records/{날짜}_{시각} 형태다', new RegExp(`^users/${uid}/records/2026-10-01_\\d+$`).test(r.path), r.path, '치명');
    ctx.check('형식이 ["HARU가계부"] 로 저장된다', JSON.stringify(r.formats) === JSON.stringify(['HARU가계부']), JSON.stringify(r.formats), '중대');
    let entries = [];
    try { entries = JSON.parse(r.household_entries || '[]'); } catch { /* 아래 check 에서 실패 */ }
    ctx.check('거래 5건이 household_entries 에 모두 저장된다', entries.length === 5, `entries ${entries.length}건`, '치명');
    ctx.check('입력한 제목("10월 생활비")이 그대로 저장된다', r.household_title === '10월 생활비', `household_title="${r.household_title}"`);
    if (r.household_title !== '10월 생활비') {
      ctx.finding({
        severity: '경미',
        shot: titleShot,
        title: '가계부에서 직접 입력한 제목이 저장되지 않고 자동 제목으로 바뀐다',
        detail: `제목 칸에 "10월 생활비"를 입력해 저장했지만 저장된 제목은 "${r.household_title}" (첫 거래의 날짜·유형·사용처로 자동 생성). 제목 입력칸이 화면에 있는데 쓰이지 않는다(FormatModal.tsx 2489·2509줄).`,
      });
    }
    // 위쪽 합계 — 저장 뒤 홈으로 돌아왔다면 가계부 카드를 다시 눌러 들어간다
    if (new URL(page.url()).pathname !== '/household') {
      await openFormatFromHome(page, 'HARU가계부');
      await page.waitForTimeout(1200);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const totalsShot = await ctx.snap('증거-1일차 합계');
    const d = await readDashboard(page);
    ctx.check('이번 달 수입 합계가 입력한 월급(2,800,000원)과 같다', d.income === DAY1_EXPECT.income, `화면 전체수입 ${d.income}원 (${d.sub}) / 기대 ${DAY1_EXPECT.income}원`);
    ctx.check('이번 달 지출 합계가 입력한 지출 3건의 합(28,050원)과 같다', d.expense === DAY1_EXPECT.expense, `화면 지출 ${d.expense}원 / 기대 ${DAY1_EXPECT.expense}원`, '치명');
    ctx.check('이번 달 거래 내역 건수가 5건이다', d.count === 5, `화면 ${d.count}건`, '중대');
    const expectedBalance = DAY1_EXPECT.income - DAY1_EXPECT.expense;
    ctx.check('수지(수입−지출)가 2,771,950원이다 — 내 통장끼리 이체는 수지를 바꾸지 않아야 한다', d.balance === expectedBalance, `화면 수지 ${d.balance}원 / 기대 ${expectedBalance}원 / 전체수입 ${d.income}원 (${d.sub})`);
    if (d.income !== DAY1_EXPECT.income || d.balance !== expectedBalance) {
      ctx.finding({
        severity: '중대',
        shot: totalsShot,
        title: '이체가 "충전"으로 전체수입·수지에 더해져, 안내 예시대로 내 통장끼리 옮기면 합계가 부풀려 보인다',
        detail: `입력 안내 예시("급여통장 → 생활비통장")대로 내 통장끼리의 이체 600,000원을 기록하자, 월급 2,800,000원만 벌었는데 화면의 전체수입은 ${d.income?.toLocaleString()}원(${d.sub}), 수지는 ${d.balance?.toLocaleString()}원으로 표시된다(내 통장끼리의 이동이라면 수지는 ${expectedBalance.toLocaleString()}원이어야 한다). HouseholdPage.tsx 에서 balance = income + transfer − expense 로 계산한다. 이체를 "충전(수입에 합산)"으로 보는 설계 의도일 수 있으나, 입력칸 안내("급여통장 → 생활비통장")는 내 통장 간 이동이라 서로 충돌한다 — 의도 확인이 필요하다.`,
      });
    }
    return { note: JSON.stringify(d) };
  });

  /* ───────── 2일차 ───────── */
  await ctx.setDay('2026-10-06', '22:00');
  await ctx.step('2일차 가계부 열고 "+"로 새 기록', async () => {
    await openApp(page, { onboarding: 'skip' });
    await openFormatFromHome(page, 'HARU가계부');
    await page.waitForTimeout(900);
    await page.locator('button').filter({ hasText: /^\+$/ }).last().click(); // 오른쪽 아래 새 기록(+) 버튼
    await page.waitForTimeout(900);
  });

  await ctx.step('2일차 입력 실수 — 금액 비움 / 사용처 비움', async () => {
    await fillTitle(page, '10월 둘째 주');
    await page.getByRole('button', { name: /거래 저장하기/ }).click();
    await page.waitForTimeout(600);
    let t = await ctx.toasts();
    ctx.check('금액을 비우고 저장하면 안내 문구로 막힌다', t.some((x) => /금액이 비어 있는 거래/.test(x)), JSON.stringify(t), '중대');
    await page.getByPlaceholder('50000').last().fill('4300');
    await page.waitForTimeout(2800); // 앞 토스트가 사라질 때까지
    await page.getByRole('button', { name: /거래 저장하기/ }).click();
    await page.waitForTimeout(600);
    t = await ctx.toasts();
    ctx.check('사용처를 비우고 저장하면 안내 문구로 막힌다', t.some((x) => /사용처가 비어 있는 지출 거래/.test(x)), JSON.stringify(t), '중대');
  });

  await ctx.step('2일차 거래 2건 저장 — "5천원" 금액, 날짜 비움', async () => {
    await page.getByRole('button', { name: '식비', exact: true }).last().click();
    await page.getByRole('button', { name: '카카오페이', exact: true }).last().click();
    await page.getByPlaceholder('2026.06.25').last().fill('2026.10.06');
    await page.getByPlaceholder('50000').last().fill('5천원'); // 한글 단위로 적은 금액
    await page.locator('input[placeholder^="마트, 편의점"]').last().fill('편의점');
    await page.getByRole('button', { name: '+ 거래 추가' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '교통비', exact: true }).last().click();
    await page.getByPlaceholder('50000').last().fill('3000');   // 날짜는 비워 둔 채
    await page.locator('input[placeholder^="마트, 편의점"]').last().fill('버스');
    await page.getByRole('button', { name: /거래 저장하기/ }).click();
    await page.waitForTimeout(2500);
  });

  await ctx.step('2일차 저장 결과·합계 확인', async () => {
    const recs = await ctx.records(uid);
    ctx.check('2일차 기록이 1건 더 생긴다(총 2건)', recs.length === 2, `records ${recs.length}건`, '치명');
    if (recs.length < 2) return; // 앞 단계가 실패했으면 아래 합계 판단은 의미가 없다
    const r = recs[1];
    let entries = [];
    try { entries = JSON.parse(r?.household_entries || '[]'); } catch { /* 무시 */ }
    const five = entries.find((e) => e.vendor === '편의점');
    const bus = entries.find((e) => e.vendor === '버스');
    ctx.check('날짜를 비운 거래도 저장은 된다', !!bus, JSON.stringify(entries.map((e) => [e.vendor, e.date, e.amount])));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const day2Totals = await ctx.snap('증거-2일차 합계');
    await page.getByText('편의점').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    const day2List = await ctx.snap('증거-2일차 거래 목록');
    const d = await readDashboard(page);
    const expectedExpense = DAY1_EXPECT.expense + 5000 + 3000;
    ctx.check('지출 합계에 "5천원"이 5,000원으로 반영된다', d.expense !== null && d.expense >= DAY1_EXPECT.expense + 5000, `화면 지출 ${d.expense}원 / 기대 ${expectedExpense}원 (5천원→${five ? `저장값 "${five.amount}"` : '미저장'})`);
    ctx.check('날짜를 비운 거래(버스 3,000원)가 이번 달 합계에 포함된다', d.count === 7, `화면 거래 ${d.count}건 / 기대 7건(1일차 5건 + 2일차 2건)`);
    if (d.expense !== null && d.expense < DAY1_EXPECT.expense + 5000) {
      ctx.finding({
        severity: '중대',
        shot: day2List,
        title: '금액을 "5천원"처럼 한글 단위로 쓰면 5원으로 계산되어 합계에 조용히 반영된다',
        detail: `금액 칸에 "5천원"을 입력해도 저장은 되지만 합계 계산(parseAmount)이 숫자만 뽑아 5원으로 처리한다. 입력 안내 예시는 "50000"이지만 사용자는 "5천원", "1만5천원"(→15원)처럼 쓰기 쉽다. 화면 지출 ${d.expense?.toLocaleString()}원 / 기대 ${expectedExpense.toLocaleString()}원.`,
      });
    }
    if (d.count !== null && d.count < 7) {
      ctx.finding({
        severity: '중대',
        shot: day2Totals,
        title: '날짜를 비워 두고 저장한 거래가 가계부 합계·목록에서 사라진다',
        detail: `날짜 칸을 비운 채 저장한 거래("버스 3,000원")는 저장은 성공하지만 이번 달 거래 내역에 집계되지 않는다(화면 ${d.count}건, 기대 7건). 날짜 입력은 필수 표시나 안내가 없고, 저장 시 오늘 날짜로 채워지지도 않는다(월 집계가 거래 날짜 문자열로 이뤄짐).`,
      });
    }
    return { note: JSON.stringify({ dashboard: d, entries: entries.map((e) => [e.vendor, e.date, e.amount]) }) };
  });
}
