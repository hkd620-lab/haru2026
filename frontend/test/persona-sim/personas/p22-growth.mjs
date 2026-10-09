import { openApp, pageText } from '../runner/driver.mjs';
import { checkIsolation } from './batch3-helpers.mjs';
export const meta = {
  id: 'p22-growth', format: '성장기록',
  persona: { name: '윤태호', age: 40, gender: '남', job: '맞벌이 아빠', device: 'Chromium 모바일 390×844', itLevel: '중', plan: '무료', goal: '5세 아들의 키·몸무게를 소수점까지 남기고 백분위와 저장 내용을 확인한다.' },
  identity: { uid: 'qa-p22-yoon-taeho', displayName: '윤태호', email: 'p22@example.invalid', plan: 'free' },
  scenario: ['홈 비서 → 건강정보 동의 → 성장기록', '빈 이름·빈 측정값·0·음수 입력', '키 110.5cm·몸무게 18.2kg 저장·백분위', '재접속 기존 아이 선택·두 번째 기록·SAYU 확인'],
};
export async function run(ctx) {
  const { page } = ctx; const uid = meta.identity.uid;
  const save = async () => { await page.getByRole('button', { name: '저장하기', exact: true }).click(); await page.waitForTimeout(1000); };
  await ctx.setDay('2026-10-03');
  await ctx.step('홈 → 우리아이건강돌봄 → 성장기록·동의', async () => {
    await openApp(page); await page.getByText('HARU우리아이건강돌봄', { exact: true }).click(); await page.waitForTimeout(700);
    const consent = page.getByRole('button', { name: '건강정보 수집·이용에 동의합니다', exact: true });
    if (await consent.isVisible()) { await consent.click(); await page.waitForTimeout(700); }
    await page.getByText('성장기록', { exact: true }).click(); await page.waitForTimeout(900);
    if (await consent.isVisible()) { await consent.click(); await page.waitForTimeout(700); }
    ctx.check('성장기록 화면으로 이동한다', new URL(page.url()).pathname === '/child-health/growth', page.url(), '중대');
  });
  await ctx.step('빈 이름·빈 수치 입력 방지', async () => {
    await save(); ctx.check('빈 아이 이름은 저장되지 않는다', (await ctx.records(uid)).length === 0, '', '중대');
    await page.getByPlaceholder('또는 새 아이 이름 입력').fill('윤도현');
    await page.locator('input[type=date]').first().fill('2021-10-03'); await page.getByRole('button', { name: '남아', exact: true }).click();
    await save(); ctx.check('빈 측정값은 저장되지 않는다', (await ctx.records(uid)).length === 0, '', '중대');
  });
  await ctx.step('0·음수 키 입력 시 저장 방지 확인', async () => {
    for (const value of ['0', '-1']) {
      await page.getByPlaceholder('예: 85.4').fill(value); const before = (await ctx.records(uid)).length;
      const shot = await ctx.snap(`증거-키-${value}-저장직전`); await save();
      const after = await ctx.records(uid);
      const ok = ctx.check('0·음수 성장 측정값은 저장되지 않는다', after.length === before, `입력 ${value}, 이전 ${before}건 → ${after.length}건`);
      if (!ok) ctx.finding({ severity: '중대', title: '성장기록이 0·음수 측정값을 검증하지 않고 저장한다', shot, detail: `키 ${value}를 입력하고 저장하기를 누르자 ${after.length - before}건이 증가했다. 저장 child_height=${after.at(-1)?.child_height}. 브라우저 input의 min=0과 별개로 저장 버튼이 값 유효성을 검사하지 않는다. ChildHealthGrowthPage.tsx handleSave는 빈 문자열만 검사하며, toPositiveNumber는 백분위 표시에서만 사용된다.` });
      // 저장 결과와 무관하게 같은 입력 화면에서 다음 실수/정상 값을 이어 입력한다.
    }
  });
  let subjectId; let normalId;
  await ctx.step('정상 소수점·백분위 표시·저장', async () => {
    await page.getByPlaceholder('예: 85.4').fill('110.5'); await page.getByPlaceholder('예: 12.3').fill('18.2'); await page.getByPlaceholder('예: 48.1').fill('50.1');
    await page.locator('input[type=date]').last().fill('2026-10-02');
    const txt = await pageText(page);
    ctx.check('키·몸무게 분석과 유한한 백분위가 보인다', txt.includes('성장 분석 결과') && txt.includes('키:') && txt.includes('몸무게:') && !/NaN|Infinity/.test(txt) && /상위|하위|딱 중간/.test(txt), txt.slice(-800), '중대');
    const before = (await ctx.records(uid)).length; await save();
    const recs = await ctx.records(uid); const mine = recs.find(r => r.child_height === '110.5'); normalId = mine?.path; subjectId = mine?.growthSubjectId;
    ctx.check('정상 저장은 정확히 1건 추가한다', recs.length === before + 1, '', '치명');
    ctx.check('키·몸무게·머리둘레 소수점과 단위 필드가 유지된다', mine?.child_height === '110.5' && mine?.child_weight === '18.2' && mine?.child_headcircum === '50.1', JSON.stringify(mine), '치명');
    ctx.check('측정일과 기록일을 구분해 보존한다', mine?.child_measuredate === '2026-10-02' && mine?.date === '2026-10-03', '', '중대');
    ctx.check('성장기록 형식과 records 저장 경로가 유지된다', mine?.path.startsWith(`users/${uid}/records/`) && JSON.stringify(mine?.formats) === '["성장기록"]', mine?.path, '치명');
    ctx.check('생년월일·성별·아이 이름이 연결된다', mine?.growthSubjectName === '윤도현' && mine?.growthSubjectBirthdate === '2021-10-03' && mine?.growthSubjectGender === 'M', '', '중대');
  });
  await ctx.setDay('2026-10-04');
  await ctx.step('재접속 기존 아이 선택·두 번째 정상 측정 저장', async () => {
    await openApp(page); await page.getByText('HARU우리아이건강돌봄', { exact: true }).click(); await page.waitForTimeout(500);
    await page.getByText('성장기록', { exact: true }).click(); await page.waitForTimeout(900);
    const select = page.locator('select').first(); await select.selectOption(subjectId);
    ctx.check('기존 아이 생년월일이 복원되고 잠긴다', await page.locator('input[type=date]').first().inputValue() === '2021-10-03' && await page.locator('input[type=date]').first().isDisabled(), '', '중대');
    await page.getByPlaceholder('예: 85.4').fill('110.7'); await page.getByPlaceholder('예: 12.3').fill('18.3'); await save();
    const recs = await ctx.records(uid); const next = recs.find(r => r.child_height === '110.7');
    ctx.check('두 번째 정상 측정도 같은 아이에 연결된다', next?.growthSubjectId === subjectId && next?.date === '2026-10-04', '', '중대');
    ctx.check('첫 정상 측정이 보존된다', recs.some(r => r.path === normalId && r.child_weight === '18.2'), '', '치명');
    const subjects = (await ctx.db()).filter(([p]) => new RegExp(`^users/${uid}/growthSubjects/[^/]+$`).test(p));
    ctx.check('아이 대상은 하나만 존재한다', subjects.length === 1, String(subjects.length), '중대');
    await page.getByRole('button', { name: '나의 기록에서 보기', exact: true }).click(); await page.waitForTimeout(1000);
    ctx.check('저장 후 나의 기록으로 이동한다', new URL(page.url()).pathname === '/sayu', page.url(), '중대');
  });
  await ctx.step('격리 확인', () => checkIsolation(ctx));
}
