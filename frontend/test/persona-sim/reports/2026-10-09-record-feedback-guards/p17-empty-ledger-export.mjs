import { openApp } from '../runner/driver.mjs';
export const meta = {
  id: 'p17-empty-ledger-export', format: 'HARU보조장부',
  persona: { name: '빈 기간 회귀', age: 40, gender: '가상', job: 'QA' },
  identity: { uid: 'qa-empty-ledger', displayName: '빈 기간 회귀', email: 'empty@example.invalid', plan: 'free' },
};
export async function run(ctx) {
  const { page } = ctx;
  await page.context().addInitScript(() => {
    localStorage.setItem('persona-sim-db:qa-empty-ledger', JSON.stringify([
      ['users/qa-empty-ledger/records/2026-09-28', {
        date: '2026-09-28', formats: ['HARU보조장부'],
        ledger_entries: JSON.stringify([{ date: '2026-09-28', transactionType: '지출', usageType: '사업용', amount: '11000', vendor: '가상문구점' }]),
      }],
    ]));
  });
  let downloads = 0;
  page.on('download', () => downloads++);
  await ctx.step('기록합본에서 거래 없는 기간 지정', async () => {
    await openApp(page, { onboarding: 'skip' });
    await page.getByRole('button', { name: /기록합본/ }).first().click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: '업무', exact: true }).first().click();
    await page.getByRole('button', { name: 'HARU보조장부', exact: true }).first().click();
    const vat = page.locator('div.mx-3.my-2', { hasText: '부가세 신고 준비' }).first();
    await vat.getByRole('button', { name: '사용자 지정 기간' }).click();
    await vat.locator('input[type=date]').nth(0).fill('2025-01-01');
    await vat.locator('input[type=date]').nth(1).fill('2025-01-31');
  });
  for (const [title, warning] of [['부가세 신고 준비', '내보낼 사업용 매출·매입 거래가 없습니다.'], ['종합소득세 준비', '내보낼 지출 거래가 없습니다.']]) {
    await ctx.step(`${title} 0건 다운로드 차단`, async () => {
      const panel = page.locator('div.mx-3.my-2', { hasText: title }).first();
      await panel.getByRole('button', { name: '준비자료 XLSX 저장' }).click();
      await page.waitForTimeout(1000);
      ctx.check(`${title}: 0건 안내`, (await ctx.toasts()).includes(warning), JSON.stringify(await ctx.toasts()), '중대');
      ctx.check(`${title}: 파일 다운로드 없음`, downloads === 0, `downloads=${downloads}`, '중대');
      await ctx.snap(`증거-${title}-0건`);
    });
  }
}
