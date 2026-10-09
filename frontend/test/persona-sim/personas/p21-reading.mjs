import { openApp, openFormatFromHome, pageText } from '../runner/driver.mjs';
import { checkIsolation } from './batch3-helpers.mjs';
export const meta = {
  id: 'p21-reading', format: '독서사유',
  persona: { name: '최민준', age: 21, gender: '남', job: '철학과 대학생', device: 'Chromium 모바일 390×844', itLevel: '상', plan: '무료', goal: '한 책을 세 번 이어 쓰고 초안을 복구한 뒤 마무리한다.' },
  identity: { uid: 'qa-p21-choi-minjun', displayName: '최민준', email: 'p21@example.invalid', plan: 'free' },
  scenario: ['빈 책 제목·저자 검증', '저장 전 초안 복구', '같은 책 3회 누적·제목 저자 잠금', '모의 AI 마무리·완료 후 이어쓰기 차단'],
};
const book = '가상의 철학 입문'; const author = '가상 저자';
const notes = ['질문을 먼저 적고 이유를 찾았다.\n첫 장의 개념을 내 말로 정리했다.', '같은 말도 맥락에 따라 뜻이 달랐다.\n내가 놓친 전제를 적었다.', '세 번째 읽으니 처음 질문이 달라졌다.\n결론보다 이유를 살피기로 했다.'];
export async function run(ctx) {
  const { page } = ctx; const uid = meta.identity.uid;
  await ctx.setDay('2026-10-03');
  await ctx.step('홈 → 독서 새작성·필수 입력 검증', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await page.getByText('새작성', { exact: true }).click();
    await page.getByRole('button', { name: '📖 독서장 추가하기', exact: true }).click();
    ctx.check('빈 책 제목은 저장되지 않는다', (await ctx.records(uid)).length === 0, '', '중대');
    await page.waitForTimeout(250);
    ctx.check('책 제목 입력 안내가 있다', (await ctx.toasts()).some(t => t.includes('책 제목을')), '', '경미');
    await page.getByRole('textbox', { name: '책 제목', exact: true }).fill(book);
    await page.getByRole('button', { name: '📖 독서장 추가하기', exact: true }).click();
    ctx.check('빈 저자는 저장되지 않는다', (await ctx.records(uid)).length === 0, '', '중대');
    await page.getByRole('textbox', { name: '저자', exact: true }).fill(author);
    await page.getByRole('textbox', { name: '내 독서장', exact: true }).fill(notes[0]); await page.waitForTimeout(400);
  });
  await ctx.step('페이지 재접속 → 저장 전 초안 복구', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format);
    await page.getByRole('button', { name: '독서 초안 이어쓰기', exact: true }).click();
    ctx.check('초안 책 제목이 복구된다', (await page.getByRole('textbox', { name: '책 제목', exact: true }).inputValue()) === book, '', '치명');
    ctx.check('초안 저자가 복구된다', (await page.getByRole('textbox', { name: '저자', exact: true }).inputValue()) === author, '', '치명');
    ctx.check('독서장 줄바꿈까지 복구된다', (await page.getByRole('textbox', { name: '내 독서장', exact: true }).inputValue()) === notes[0], '', '치명');
    ctx.check('초안만으로 SAYU에 자동 저장되지 않는다', (await ctx.records(uid)).length === 0, '', '중대');
  });
  let readingId;
  for (let i = 0; i < 3; i++) {
    await ctx.setDay(`2026-10-0${i + 3}`);
    await ctx.step(`${i + 1}회차 독서장 저장`, async () => {
      if (i) {
        await openApp(page); await openFormatFromHome(page, meta.format);
        await page.getByRole('button', { name: new RegExp(`📖 ${book}`) }).click();
        ctx.check('이어쓰기 제목과 저자는 잠겨 있다', await page.getByRole('textbox', { name: '책 제목', exact: true }).evaluate(el => el.readOnly) && await page.getByRole('textbox', { name: '저자', exact: true }).evaluate(el => el.readOnly), '', '중대');
        await page.getByRole('textbox', { name: '내 독서장', exact: true }).fill(notes[i]);
      }
      await page.getByRole('button', { name: '📖 독서장 추가하기', exact: true }).click();
      await page.waitForTimeout(1800);
      const recs = await ctx.records(uid); const mine = recs.find(r => r.reading_journal === notes[i]);
      ctx.check('회차가 정확히 한 건 늘어난다', recs.length === i + 1, `${recs.length}/${i + 1}`, '치명');
      ctx.check('직접 쓴 독서장이 원문 그대로 저장된다', !!mine, JSON.stringify(recs.map(r => r.reading_journal)), '치명');
      if (!mine) return;
      readingId ||= mine.readingId;
      ctx.check('세 회차는 같은 readingId로 묶인다', !!readingId && mine.readingId === readingId, String(mine.readingId), '중대');
      ctx.check('책 제목·저자가 보존된다', mine.bookTitle === book && mine.author === author, '', '중대');
      ctx.check('회차 날짜와 records 경로가 유지된다', mine.date === `2026-10-0${i + 3}` && mine.path.startsWith(`users/${uid}/records/`), mine.path, '치명');
    });
  }
  await ctx.step('모의 AI 마무리 분석과 최종 저장', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await page.getByRole('button', { name: new RegExp(`📖 ${book}`) }).click();
    await page.getByRole('button', { name: '✨ 독서마무리하기', exact: true }).click();
    await page.getByRole('button', { name: '최종 독서사유 저장', exact: true }).click(); await page.waitForTimeout(1800);
    const recs = await ctx.records(uid); const final = recs.find(r => r.reading_status === 'completed');
    ctx.check('마무리는 3회차를 보존하고 최종 기록 1건을 추가한다', recs.length === 4, String(recs.length), '중대');
    ctx.check('마무리도 같은 책 식별자를 유지한다', final?.readingId === readingId, String(final?.readingId), '중대');
    ctx.check('누적 스냅샷은 3회차 원문을 포함한다', notes.every(n => String(final?.reading_entries_snapshot || '').includes(n)), '', '치명');
  });
  await ctx.step('마무리한 책 재접속·이어작성 차단', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format);
    ctx.check('완료한 책은 이어작성 목록에서 빠진다', await page.getByRole('button', { name: new RegExp(`📖 ${book}`) }).count() === 0, '', '중대');
    ctx.check('마무리 1권 안내가 보인다', (await pageText(page)).includes('마무리한 책 1권'), '', '경미');
  });
  await ctx.step('격리 확인', () => checkIsolation(ctx));
}
