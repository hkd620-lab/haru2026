// 모두 가상 인물·가상 아동이며 실제 개인정보를 사용하지 않는다.
import { openApp, openFormatFromHome, chooseStyle, fillTitle, fillSimple, fillByPlaceholder, saveOriginal, saveWithAi, waitForSayu, pageText, attachPhotos } from '../runner/driver.mjs';
import { testImage } from '../runner/assets.mjs';
export const meta = {
  id: 'p06-child', format: '육아일기',
  persona: { name: '박지우', age: 32, gender: '여', job: '회사원·양육자', goal: '아이의 일상을 일주일 동안 남기고 다시 읽는다.' },
  identity: { uid: 'qa-p06-park-jiwoo', displayName: '박지우', email: 'p06@example.invalid', plan: 'free' },
  scenario: ['7일 7건: 간편 기록 5건, 항목별 기록 2건, 모의 AI 1회, 사진 1장, 새로고침 뒤 목록·본문 보존'],
};
const texts = ['블록을 세 개 쌓았다. 무너져도 웃으며 다시 시도했다.', '바나나 반 개를 먹고 노란색이라고 말했다.', '비가 와서 집에서 그림책을 읽었다. 우산 그림을 좋아했다.', '놀이터에서 친구에게 장난감을 건넸다.', '종이로 만든 왕관을 쓰고 활짝 웃었다.', '낮잠을 짧게 자서 저녁에는 일찍 잠들었다.', '지난주보다 계단을 더 안정적으로 오른다. 천천히 함께 걸었다.'];
export async function run(ctx) {
  const { page } = ctx;
  for (let i = 0; i < 7; i++) {
    const date = `2026-10-0${i + 1}`, title = `하은의 하루 ${i + 1}`, premium = i === 3 || i === 6;
    await ctx.setDay(date);
    await ctx.step(`${i+1}일차 진입·작성`, async () => {
      await openApp(page);
      await openFormatFromHome(page, '육아일기');
      await chooseStyle(page, premium ? 'premium' : 'simple');
      await fillTitle(page, title);
      if (premium) {
        await page.getByPlaceholder("우리 아이 '하은'", { exact: true }).fill('하은');
        await fillByPlaceholder(page, '오늘 처음으로', texts[i]);
        await fillByPlaceholder(page, '아침: 미역국', '밥과 야채를 먹었다.');
        await fillByPlaceholder(page, '놀이터에서 친구들과', '함께 그림책을 읽었다.');
        await fillByPlaceholder(page, '아이가 자라는', '함께한 시간이 고맙다.');
      } else await fillSimple(page, texts[i]);
      if (i === 4) await attachPhotos(page, [testImage('p06-crown', 70)]);
    });
    await ctx.step(`${i+1}일차 저장·검증`, async () => {
      if (i === 2) await saveWithAi(page, 'simple');
      else await saveOriginal(page, premium ? 'premium' : 'simple');
      await waitForSayu(page);
      const recs = await ctx.records(meta.identity.uid), r = recs.find(x => x.child_title === title);
      ctx.check('하루 기록 1건씩 누적', recs.length === i+1, `actual=${recs.length}`, '치명');
      ctx.check('날짜·제목·형식 보존', r?.date === date && r?.formats?.includes('육아일기'), JSON.stringify(r && {date:r.date,title:r.child_title,formats:r.formats}), '중대');
      ctx.check('본문 보존', r?.child_sayu?.includes(texts[i]), r?.child_sayu || '', '중대');
      ctx.check('기록 경로 유지', !!r && r.path.startsWith(`users/${meta.identity.uid}/records/${date}_`), r?.path || '', '치명');
      if (i === 2) ctx.check('모의 AI 표시·통계 저장', r?.child_polished === true && !!r?.child_stats, JSON.stringify(r?.child_stats), '중대');
      if (i === 4) ctx.check('사진 1장 보존', JSON.parse(r?.child_images || '[]').length === 1, r?.child_images || '', '중대');
    });
  }
  await ctx.step('재접속 후 7건 목록 확인', async () => {
    await page.goto(new URL('/sayu', page.url()).href);
    await page.getByRole('tab', { name: '목록', exact: true }).click();
    await page.locator('section > button').filter({ hasText: /^육아일기/ }).click();
    await page.waitForTimeout(1500);
    const text = await pageText(page);
    for (let i=1;i<=7;i++) ctx.check(`목록 제목 ${i}`, text.includes(`하은의 하루 ${i}`), '', '중대');
    ctx.check('새로고침 뒤 7건 보존', (await ctx.records(meta.identity.uid)).length === 7, '', '치명');
  });
}
