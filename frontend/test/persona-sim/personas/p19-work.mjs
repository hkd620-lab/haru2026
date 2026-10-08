import { openApp, openFormatFromHome, chooseStyle, fillTitle, fillSimple, fillByPlaceholder, saveOriginal, waitForSayu } from '../runner/driver.mjs';
import { checkSaved, checkList, checkIsolation } from './batch3-helpers.mjs';

export const meta = {
  id: 'p19-work', format: '업무일지',
  persona: { name: '강도현', age: 31, gender: '남', job: '스타트업 개발자', device: 'Chromium 모바일 390×844', itLevel: '상', plan: '무료', goal: '시간표와 업무 결과를 줄바꿈 그대로 남기고 다시 확인한다.' },
  identity: { uid: 'qa-p19-kang-dohyeon', displayName: '강도현', email: 'p19@example.invalid', plan: 'free' },
  scenario: ['프리미엄 6칸 시간표·결과·보류·지표·평가·여백 작성', '같은 날 간편 기록으로 23:59 업무 마무리 저장', '다음 날 00:05부터 시작하는 기록, 시간·줄바꿈·특수문자 확인', '재접속 후 업무일지 목록과 격리 확인'],
};
const fields = {
  work_schedule: '09:00 주간 회의\n13:05 배포 점검\n18:30 회고',
  work_result: 'API 응답 200 OK\n이슈 #123 재현 완료\n배포 점검 문서 공유',
  work_pending: '내일 09:00 성능 로그 검토\n[ ] 데이터 확인',
  work_metric: '응답 시간: 120.5ms\n테스트: 12/12 통과',
  work_rating: '★★★★☆\n시간표를 지켰다.',
  work_space: '동료의 설명 덕분에 막힌 문제를 풀었다. 💼',
};
const placeholders = ['09:00 주간 회의', '회의록 배포 완료', '예산 결산 보고서', '오늘 걸음 수:', '★★★★☆', '자유롭게 작성하세요.'];
export async function run(ctx) {
  const { page } = ctx;
  const uid = meta.identity.uid;
  const titles = ['배포 점검 (09:00~18:30)', '23:59 업무 마무리', '00:05 야간 점검'];
  await ctx.setDay('2026-10-03', '18:40');
  await ctx.step('홈 → 업무일지 → 프리미엄 6칸 작성', async () => {
    await openApp(page); await openFormatFromHome(page, meta.format); await chooseStyle(page, 'premium'); await fillTitle(page, titles[0]);
    for (let i = 0; i < placeholders.length; i++) await fillByPlaceholder(page, placeholders[i], Object.values(fields)[i]);
  });
  await ctx.step('업무일지 프리미엄 원본 저장', async () => { await saveOriginal(page); await waitForSayu(page); });
  await ctx.step('시간표·줄바꿈·6칸 저장 검증', () => checkSaved(ctx, { uid, prefix: 'work', format: meta.format, date: '2026-10-03', title: titles[0], count: 1, fields, sayu: Object.values(fields).join('\n\n') }));
  const notes = [
    { date: '2026-10-03', time: '23:59', text: '23:59 마무리\n09:00 회의 후 보류한 일: 내일 처리\n[완료] QA & 체크 ✅' },
    { date: '2026-10-04', time: '00:05', text: '00:05 점검 시작\n01:30 응답 정상\n메모: <로그>는 별도 보관\n다음 회의 09:00' },
  ];
  for (let i = 0; i < notes.length; i++) {
    const d = notes[i];
    await ctx.setDay(d.date, d.time);
    await ctx.step(`${d.date} ${d.time} 간편 업무일지 저장`, async () => {
      await openApp(page); await openFormatFromHome(page, meta.format); await chooseStyle(page, 'simple');
      await fillTitle(page, titles[i + 1]); await fillSimple(page, d.text); await saveOriginal(page); await waitForSayu(page);
    });
    await ctx.step(`${d.time} 시간·본문·날짜 검증`, () => checkSaved(ctx, { uid, prefix: 'work', format: meta.format, date: d.date, title: titles[i + 1], count: i + 2, fields: { work_simple: d.text }, sayu: d.text }));
  }
  await ctx.step('같은 날 두 업무일지가 덮어쓰이지 않는다', async () => {
    ctx.check('10월 3일 기록 2건이 각각 남는다', (await ctx.records(uid)).filter(r => r.date === '2026-10-03').length === 2, '', '치명');
  });
  await ctx.step('재접속 업무일지 목록 확인', () => checkList(ctx, meta.format, titles));
  await ctx.step('격리 확인', () => checkIsolation(ctx));
}
