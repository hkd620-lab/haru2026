import { openApp, openFormatFromHome, chooseStyle, fillTitle, fillSimple, fillByPlaceholder, saveOriginal, waitForSayu } from '../runner/driver.mjs';
import { checkSaved, checkList, checkIsolation } from './batch3-helpers.mjs';

export const meta = {
  id: 'p18-memo', format: '메모',
  persona: { name: '임수빈', age: 17, gender: '여', job: '고등학생', device: 'Chromium 모바일 390×844', itLevel: '상', plan: '무료', goal: '짧은 메모와 이모지, 할 일을 빠르게 남기고 다시 본다.' },
  identity: { uid: 'qa-p18-im-subin', displayName: '임수빈', email: 'p18@example.invalid', plan: 'free' },
  scenario: ['제목만 있고 내용이 빈 상태·공백만 입력한 상태에서 저장 방지 확인', '한 글자 메모 저장', '같은 날 이모지 한 개만 저장', '다음 날 체크박스·따옴표·HTML 모양·줄바꿈을 포함한 할 일 저장', '프리미엄 내용·다음 행동·여백 저장, 재접속 목록 확인'],
};
export async function run(ctx) {
  const { page } = ctx;
  const uid = meta.identity.uid;
  const titles = ['한 글자 메모', '기분 🙂', '수행평가 할 일 ✅', '다음 행동 메모'];
  await ctx.setDay('2026-10-03', '17:00');
  await ctx.step('홈 → 메모 → 제목만 입력 후 저장 시도', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await chooseStyle(page, 'simple'); await fillTitle(page, titles[0]);
    await saveOriginal(page); await page.waitForTimeout(300);
    ctx.check('내용이 빈 메모는 저장되지 않는다', (await ctx.records(uid)).length === 0, '', '중대');
    ctx.check('내용을 입력하라는 안내가 나온다', (await ctx.toasts()).some(t => /내용.*없|먼저 작성/.test(t)), JSON.stringify(await ctx.toasts()), '경미');
    await fillSimple(page, '   \n  '); await saveOriginal(page); await page.waitForTimeout(300);
    ctx.check('공백만 있는 메모는 저장되지 않는다', (await ctx.records(uid)).length === 0, '', '중대');
  });
  await ctx.step('한 글자 메모 저장', async () => { await fillSimple(page, '책'); await saveOriginal(page); await waitForSayu(page); });
  await ctx.step('한 글자 메모 저장 검증', () => checkSaved(ctx, { uid, prefix: 'memo', format: meta.format, date: '2026-10-03', title: titles[0], count: 1, fields: { memo_simple: '책' }, sayu: '책' }));
  await ctx.setDay('2026-10-03', '19:00');
  await ctx.step('같은 날 이모지 하나만 저장', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await chooseStyle(page, 'simple');
    await fillTitle(page, titles[1]); await fillSimple(page, '🙂'); await saveOriginal(page); await waitForSayu(page);
  });
  await ctx.step('이모지와 같은 날 메모 보존 검증', () => checkSaved(ctx, { uid, prefix: 'memo', format: meta.format, date: '2026-10-03', title: titles[1], count: 2, fields: { memo_simple: '🙂' }, sayu: '🙂' }));
  const todo = '[ ] 09:00 도서관\n[x] 발표자료 "완료" & 검토\n<준비물> 책·필통\n🙂 ✅ #수행평가';
  await ctx.setDay('2026-10-04');
  await ctx.step('특수문자·줄바꿈 할 일 메모 저장', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await chooseStyle(page, 'simple');
    await fillTitle(page, titles[2]); await fillSimple(page, todo); await saveOriginal(page); await waitForSayu(page);
  });
  await ctx.step('할 일 메모 저장 검증', () => checkSaved(ctx, { uid, prefix: 'memo', format: meta.format, date: '2026-10-04', title: titles[2], count: 3, fields: { memo_simple: todo }, sayu: todo }));
  const fields = { memo_title: titles[3], memo_content: '생물 발표 주제: 식물의 잎 🌿\n자료 2쪽 읽기', memo_action: '내일 08:30 친구에게 초안 보내기\n[ ] 참고 자료 링크 정리', memo_space: '발표는 천천히 🙂' };
  await ctx.setDay('2026-10-05');
  await ctx.step('프리미엄 메모와 다음 행동 저장', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await chooseStyle(page, 'premium');
    await fillTitle(page, titles[3]);
    await fillByPlaceholder(page, '메모할 내용을', fields.memo_content);
    await fillByPlaceholder(page, '이 메모와 관련된', fields.memo_action);
    await fillByPlaceholder(page, '자유롭게 작성하세요.', fields.memo_space);
    await saveOriginal(page); await waitForSayu(page);
  });
  await ctx.step('프리미엄 메모 저장 검증', () => checkSaved(ctx, { uid, prefix: 'memo', format: meta.format, date: '2026-10-05', title: titles[3], count: 4, fields, sayu: Object.values(fields).join('\n\n') }));
  await ctx.step('재접속 메모 목록 확인', () => checkList(ctx, meta.format, titles));
  await ctx.step('격리 확인', () => checkIsolation(ctx));
}
