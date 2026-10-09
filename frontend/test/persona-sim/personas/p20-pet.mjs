import { openApp, openFormatFromHome, chooseStyle, fillTitle, fillSimple, fillByPlaceholder, saveOriginal, waitForSayu, attachPhotos } from '../runner/driver.mjs';
import { testImage } from '../runner/assets.mjs';
import { checkSaved, checkList, checkIsolation } from './batch3-helpers.mjs';

export const meta = {
  id: 'p20-pet', format: '애완동물관찰일지',
  persona: { name: '정하윤', age: 29, gender: '여', job: '프리랜서 디자이너', device: 'Chromium 모바일 390×844', itLevel: '상', plan: '무료', goal: '뭉치의 접종과 산책을 이름·사진과 함께 보존한다.' },
  identity: { uid: 'qa-p20-jung-hayun', displayName: '정하윤', email: 'p20@example.invalid', plan: 'free' },
  scenario: ['간편 산책 기록', '프리미엄 이름·접종·건강·돌봄 6칸과 사진 1장', '다음 날 같은 반려견의 기록, 재접속 목록'],
};
export async function run(ctx) {
  const { page } = ctx; const uid = meta.identity.uid;
  const titles = ['뭉치 첫 산책 🐶', '뭉치 예방접종', '뭉치 접종 다음 날'];
  const simple = '뭉치와 30분 산책했다.\n물 200ml를 마셨다. 🐾';
  await ctx.setDay('2026-10-03');
  await ctx.step('홈 → 간편 반려동물 기록 저장', async () => {
    await openApp(page); await openFormatFromHome(page, '반려동물'); await chooseStyle(page, 'simple');
    await fillTitle(page, titles[0]); await fillSimple(page, simple); await saveOriginal(page); await waitForSayu(page);
  });
  await ctx.step('간편 저장 확인', () => checkSaved(ctx, { uid, prefix: 'pet', format: meta.format, date: '2026-10-03', title: titles[0], count: 1, fields: { pet_simple: simple }, sayu: simple }));
  for (const [i, date] of ['2026-10-04', '2026-10-05'].entries()) {
    const fields = { pet_title: titles[i + 1], pet_name: '뭉치', pet_health: i ? '식욕 회복, 체중 5.2kg' : '접종 후 잠이 많았다. 체중 5.2kg', pet_behavior: '앉아 신호에 반응했다.\n짖음 2회', pet_care: i ? '산책 20분, 물 250ml' : '예방접종 1회, 산책은 쉬었다.', pet_special: '다른 강아지에게 인사했다. 🐶', pet_space: '다음 달 접종 날짜 확인' };
    await ctx.setDay(date);
    await ctx.step(`${date} 이름·접종·돌봄 기록 저장`, async () => {
      await openApp(page); await openFormatFromHome(page, '반려동물'); await chooseStyle(page, 'premium'); await fillTitle(page, fields.pet_title);
      for (const [ph, val] of [["우리 강아지", fields.pet_name], ['식욕이', fields.pet_health], ['오늘 처음으로', fields.pet_behavior], ['산책 30분', fields.pet_care], ['동네 친구', fields.pet_special], ['자유롭게 작성하세요.', fields.pet_space]]) await fillByPlaceholder(page, ph, val);
      if (!i) await attachPhotos(page, [testImage('p20-pet', 50)]);
      await saveOriginal(page); await waitForSayu(page);
    });
    await ctx.step(`${date} 이름·6칸 보존 확인`, async () => {
      await checkSaved(ctx, { uid, prefix: 'pet', format: meta.format, date, title: fields.pet_title, count: i + 2, fields, sayu: Object.entries(fields).filter(([key]) => key !== 'pet_title').map(([, value]) => value).join('\n\n') });
      if (!i) { const rec = (await ctx.records(uid)).find(r => r.pet_title === fields.pet_title); ctx.check('사진 1장이 보존된다', JSON.parse(rec?.pet_images || '[]').length === 1, '', '중대'); }
    });
  }
  await ctx.step('재접속 목록 확인', () => checkList(ctx, meta.format, titles));
  await ctx.step('격리 확인', () => checkIsolation(ctx));
}
