import { openApp, openFormatFromHome, chooseStyle, fillTitle, fillSimple, saveOriginal, saveWithAi, waitForSayu } from '../runner/driver.mjs';
import { checkSaved, checkList, checkIsolation } from './batch3-helpers.mjs';

export const meta = {
  id: 'p17-essay', format: '에세이',
  persona: { name: '박정훈', age: 52, gender: '남', job: '중소기업 임원', device: 'Chromium 모바일 390×844', itLevel: '중', plan: '무료', goal: '관찰부터 여백까지 여섯 칸에 긴 글을 쓰고 저장해 다시 읽는다.' },
  identity: { uid: 'qa-p17-park-jeonghun', displayName: '박정훈', email: 'p17@example.invalid', plan: 'free' },
  scenario: ['프리미엄 6칸 합계 4,800자 작성, 모의 5,000자 서버 한도 오류와 입력 유지 확인 후 원본 저장', '다음 날 간편 4,400자 모의 AI 미리보기 저장(품질은 평가하지 않음)', '같은 날 간편 6,000자 원본 저장, 두 기록이 덮어쓰이지 않는지 확인', '재접속 후 에세이 목록과 격리 확인'],
};
const textOf = (n, seed) => `${seed}\n`.repeat(Math.ceil(n / (seed.length + 1))).slice(0, n);
const fields = {
  essay_observation: textOf(800, '출근길 벤치에 앉아 사람들의 발걸음을 바라봤다.'),
  essay_impression: textOf(800, '바쁜 시간에도 잠깐 멈추면 익숙한 풍경이 달라 보인다.'),
  essay_comparison: textOf(800, '작년의 나는 같은 길을 지나며 전화만 보고 있었다.'),
  essay_essence: textOf(800, '오늘은 정해 둔 속도보다 내 호흡을 먼저 살피기로 했다.'),
  essay_closing: textOf(800, '퇴근할 때에도 이 벤치를 다시 바라보려 한다.'),
  essay_space: textOf(800, '여백에 남기는 말: 서두르지 않아도 된다. ✍️'),
};
const placeholders = ['보도블록 틈새', '"와, 정말 작다!', '딱딱한 돌 사이', '아무리 좁고', '어려움에 처하더라도', '자유롭게 작성하세요.'];

export async function run(ctx) {
  const { page } = ctx;
  const uid = meta.identity.uid;
  const titles = ['벤치에서 배운 쉼 ✍️', '회의 전의 10분', '긴 글을 원본으로 남기기'];
  await ctx.setDay('2026-10-03');
  await ctx.step('홈 → 에세이 → 프리미엄 6칸 작성', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await chooseStyle(page, 'premium');
    await fillTitle(page, titles[0]);
    // 따옴표로 시작하는 placeholder도 CSS 문자열 조합 없이 찾는다.
    for (let i = 0; i < placeholders.length; i++) await page.getByPlaceholder(placeholders[i]).first().fill(Object.values(fields)[i]);
    ctx.check('6칸 입력 합계가 4,800자다', Object.values(fields).reduce((n, v) => n + v.length, 0) === 4800);
  });
  await ctx.step('프리미엄 긴 글 모의 AI 한도 오류·입력 유지', async () => {
    await page.getByRole('button', { name: /AI 다듬은 후 SAYU-나의기록 저장/ }).first().click();
    await page.getByRole('button', { name: 'AI 다듬기 실행' }).click();
    await page.waitForTimeout(2200);
    const qa = await ctx.qa();
    ctx.check('모의 서버에서 5,000자 한도 오류가 반환된다', qa.calls.some(c => c.name === 'polishContent' && !c.ok && c.error === 'functions/invalid-argument') && ctx.events.console.some(c => /텍스트는 5000자 이내/.test(c.text)), 'callable 오류 코드와 모의 오류 메시지를 함께 확인', '중대');
    const toasts = await ctx.toasts();
    const clear = toasts.some(t => /5[,.]?000|글자|자 이내|너무 길/.test(t));
    ctx.check('한도 오류 안내가 글자 수 초과를 설명한다', clear, JSON.stringify(toasts));
    if (!clear) ctx.finding({ severity: '경미', existingId: 'F-19', title: '긴 글에서 AI 다듬기가 안 될 때 "AI 연결에 실패했습니다."라고만 나와 원인(글자 수 초과)을 알 수 없다', detail: `기존 F-19 재현. 에세이 6칸 본문 4,800자에 안내문이 붙어 모의 서버가 5,000자 한도 오류를 반환했지만 안내는 ${JSON.stringify(toasts)}였다. 앱 소스는 수정하지 않았다.`, shot: await ctx.snap('증거-기존-F19-에세이') });
    for (let i = 0; i < placeholders.length; i++) {
      const v = await page.getByPlaceholder(placeholders[i]).first().inputValue();
      ctx.check(`오류 후 ${Object.keys(fields)[i]} 입력 유지`, v === Object.values(fields)[i], `입력 ${v.length}자`, '치명');
    }
    ctx.check('실패한 AI 처리로 기록이 저장되지 않는다', (await ctx.records(uid)).length === 0, '', '치명');
  });
  await ctx.step('긴 프리미엄 원본 저장', async () => { await saveOriginal(page); await waitForSayu(page); });
  await ctx.step('프리미엄 6칸 원본 저장 검증', async () => {
    await checkSaved(ctx, { uid, prefix: 'essay', format: meta.format, date: '2026-10-03', title: titles[0], count: 1, fields, sayu: Object.values(fields).join('\n\n') });
  });
  const shorter = textOf(4400, '회의 전에 창밖의 나무를 보며 오늘의 일정을 천천히 정리했다.');
  await ctx.setDay('2026-10-04', '09:00');
  await ctx.step('4,400자 간편 기록 모의 AI 저장', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await chooseStyle(page, 'simple');
    await fillTitle(page, titles[1]); await fillSimple(page, shorter);
    await saveWithAi(page, 'simple', { onPreview: async () => {
      const preview = await page.getByPlaceholder('AI가 다듬은 내용을 자유롭게 수정할 수 있습니다...').inputValue();
      ctx.check('모의 AI 미리보기에 정해진 모의 응답이 표시된다', preview === `[모의 다듬기 결과 — 실제 AI 아님]\n\n${shorter.trim()}`, '미리보기 textarea의 value를 확인. fakes.ts 고정 응답과 대조하며 AI 품질 미평가', '중대');
      await ctx.snap('증거-모의-AI-미리보기');
    } });
    await waitForSayu(page);
  });
  await ctx.step('모의 AI 저장 후 원본·저장 경로 검증', async () => {
    await checkSaved(ctx, { uid, prefix: 'essay', format: meta.format, date: '2026-10-04', title: titles[1], count: 2, fields: { essay_simple: shorter } });
    const r = (await ctx.records(uid)).find(r => r.essay_title === titles[1]);
    const expectedMock = `[모의 다듬기 결과 — 실제 AI 아님]\n\n${shorter.trim()}`;
    ctx.check('모의 다듬기 결과가 SAYU 필드에 저장된다', r?.essay_sayu === expectedMock, '고정 모의 응답과 대조. 실제 AI 품질은 평가하지 않음', '중대');
  });
  const longest = textOf(6000, '마감 후에도 오늘 생각한 문장을 길게 남겼다.');
  await ctx.setDay('2026-10-04', '22:00');
  await ctx.step('같은 날 6,000자 원본 저장', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await chooseStyle(page, 'simple');
    await fillTitle(page, titles[2]); await fillSimple(page, longest); await saveOriginal(page); await waitForSayu(page);
  });
  await ctx.step('긴 글 원본과 같은 날 두 기록 보존 검증', async () => {
    await checkSaved(ctx, { uid, prefix: 'essay', format: meta.format, date: '2026-10-04', title: titles[2], count: 3, fields: { essay_simple: longest }, sayu: longest });
    ctx.check('같은 날 두 기록이 각각 남는다', (await ctx.records(uid)).filter(r => r.date === '2026-10-04').length === 2, '', '치명');
  });
  await ctx.step('재접속 에세이 목록 확인', () => checkList(ctx, meta.format, titles));
  await ctx.step('격리 확인', () => checkIsolation(ctx));
}
