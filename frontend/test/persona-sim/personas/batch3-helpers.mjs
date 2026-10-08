import { openApp, pageText } from '../runner/driver.mjs';

// 저장 직후 상세 창 순환(기존 격리 하네스 한계)을 피하고 실제 하단 메뉴로 목록을 연다.
export async function openList(page, format, firstTitle) {
  await openApp(page, { onboarding: 'skip' });
  await page.getByText('SAYU·나의 기록', { exact: false }).first().click();
  await page.waitForTimeout(1500);
  if (!(await pageText(page)).includes(firstTitle)) {
    await page.locator(`text=${format}`).filter({ hasText: new RegExp(`^${format}$`) }).last().click();
    await page.waitForTimeout(1200);
  }
}

export async function checkSaved(ctx, { uid, prefix, format, date, title, count, fields, sayu }) {
  const recs = await ctx.records(uid);
  ctx.check('기록 건수가 기대값과 같다', recs.length === count, `${recs.length}/${count}`, '치명');
  const mine = recs.find(r => r[`${prefix}_title`] === title);
  if (!ctx.check('입력한 제목으로 저장된다', !!mine, JSON.stringify(recs.map(r => r[`${prefix}_title`])), '치명')) return;
  ctx.check('저장 경로가 users/{uid}/records 아래다', new RegExp(`^users/${uid}/records/${date}_\\d+$`).test(mine.path), mine.path, '치명');
  ctx.check('date가 YYYY-MM-DD와 기록한 날을 유지한다', mine.date === date, `date=${mine.date}`, '치명');
  ctx.check('형식이 해당 형식 한 개로 저장된다', JSON.stringify(mine.formats) === JSON.stringify([format]), JSON.stringify(mine.formats), '중대');
  for (const [key, value] of Object.entries(fields)) {
    ctx.check(`${key} 입력값이 그대로 저장된다`, mine[key] === value, `저장 ${String(mine[key] ?? '').length}자 / 입력 ${value.length}자`, '치명');
  }
  if (sayu !== undefined) ctx.check('원본 본문을 SAYU 필드에 그대로 저장한다', mine[`${prefix}_sayu`] === sayu, `저장 ${String(mine[`${prefix}_sayu`] ?? '').length}자 / 기대 ${sayu.length}자`, '치명');
}

export async function checkList(ctx, format, titles) {
  await openList(ctx.page, format, titles[0]);
  const text = await pageText(ctx.page);
  const m = text.match(/이달 결과\s*(\d+)건/);
  ctx.check('재접속 후 목록 건수가 저장 건수와 같다', !!m && Number(m[1]) === titles.length, m?.[0] || '표시 없음', '중대');
  for (const title of titles) ctx.check(`재접속 후 목록에 ${title}가 있다`, text.includes(title), '', '중대');
}

export async function checkIsolation(ctx) {
  const qa = await ctx.qa();
  ctx.check('외부 요청 차단 집계가 0이다', ctx.blocked.length === 0, `차단 ${ctx.blocked.length}건`, '중대');
  ctx.check('모의되지 않은 callable이 없다', qa.unknownCallables.length === 0, JSON.stringify(qa.unknownCallables), '중대');
  ctx.check('페이지 실행 오류가 없다', ctx.events.pageErrors.length === 0, JSON.stringify(ctx.events.pageErrors), '중대');
}
