// P08 — 육아일기 / 한지민(36·여·육아휴직 중 회사원)
import { testImage } from '../runner/assets.mjs';
import {
  openApp, openFormatFromHome, chooseStyle, fillTitle, fillByPlaceholder,
  attachPhotos, saveOriginal, saveWithAi, waitForSayu, pageText,
} from '../runner/driver.mjs';

export const meta = {
  id: 'p08-child',
  format: '육아일기',
  persona: {
    name: '한지민', age: 36, gender: '여', job: '회사원(육아휴직 중)',
    device: 'iPhone 모양(Chromium 모바일 에뮬레이션, 390×844)', itLevel: '중상', plan: '무료(월 AI 도움 10회)',
    goal: '14개월 아들 "하준"의 하루를 항목별로 꼼꼼히 남기고, 사진과 함께 성장 기록으로 모아 두고 싶다.',
  },
  identity: { uid: 'qa-p08-han-jimin', displayName: '한지민', email: 'p08@example.invalid', plan: 'free' },
  scenario: [
    '1일차: 처음 사용 — 프리미엄 5칸 작성, 성장 대상 "하준"(생년월일·성별) 새로 등록, 사진 2장',
    '2일차: 같은 아이를 "기존 대상 선택"으로 불러와 기록',
    '3일차: 이름을 다시 "새 대상 추가" 칸에 직접 입력하는 흔한 실수 — 중복 대상이 생기는지 확인',
    '4일차: AI 다듬기 사용',
    '마무리: 내 기록(SAYU) 목록과 홈의 HARU타임라인에서 아이 기록이 모이는지 확인',
  ],
};

const SUBJECT = { name: '하준', birthdate: '2025-08-05', genderLabel: '남아', genderKey: 'M' };

const DAYS = [
  {
    date: '2026-10-01', title: '하준이 첫 걸음마', newSubject: true, photos: 2,
    f: {
      '우리 아이': '하준이',
      '오늘 처음으로': '오늘 처음으로 혼자 두 발짝을 걸었다. 소파를 잡고 서 있다가 손을 놓고 엄마한테 걸어왔다.',
      '아침: 미역국': '아침: 소고기 이유식, 점심: 바나나와 요거트, 저녁: 닭고기 야채죽',
      '놀이터에서': '아파트 놀이터에서 첫 미끄럼틀을 탔다. 처음엔 울다가 나중엔 깔깔 웃었다.',
      '아이가 자라는': '남편한테 영상을 바로 보냈다. 눈물이 날 만큼 뿌듯했다.',
    },
  },
  {
    date: '2026-10-02', title: '낯가림 시작', existing: true,
    f: {
      '우리 아이': '하준이',
      '오늘 처음으로': '요즘 낯선 사람을 보면 내 다리 뒤로 숨는다. 낯가림이 시작된 것 같다.',
      '아침: 미역국': '입맛이 없는지 이유식을 반만 먹었다',
      '놀이터에서': '문화센터 첫 수업에 다녀왔다',
      '아이가 자라는': '울음을 그치지 않아 당황했지만 안아주니 금방 진정되었다',
    },
  },
  {
    date: '2026-10-03', title: '열이 나서 병원', retypeSubject: true,
    f: {
      '우리 아이': '하준이',
      '오늘 처음으로': '저녁에 열이 38도까지 올라 소아과에 갔다. 감기라고 한다.',
      '아침: 미역국': '미음만 조금 먹었다',
      '놀이터에서': '하루 종일 집에서 안아주며 보냈다',
      '아이가 자라는': '아픈 걸 보니 마음이 아팠다. 내가 대신 아팠으면 좋겠다.',
    },
  },
  {
    date: '2026-10-04', title: '많이 나았다', existing: true, ai: true,
    f: {
      '우리 아이': '하준이',
      '오늘 처음으로': '열이 내렸다. 아침부터 장난감을 던지며 놀았다.',
      '아침: 미역국': '아침: 이유식 한 그릇을 다 먹었다',
      '놀이터에서': '집 앞 공원을 짧게 산책했다',
      '아이가 자라는': '건강하게 웃는 모습을 보니 안심이 된다.',
    },
  },
];

const subjectDocs = (db, uid) => db.filter(([p]) => new RegExp(`^users/${uid}/growthSubjects/[^/]+$`).test(p)).map(([p, d]) => ({ id: p.split('/').pop(), ...d }));

export async function run(ctx) {
  const { page } = ctx;
  const uid = meta.identity.uid;
  let before = 0;

  for (let i = 0; i < DAYS.length; i += 1) {
    const d = DAYS[i];
    const label = `${i + 1}번째 기록(${d.date})`;
    await ctx.setDay(d.date, '21:00');

    await ctx.step(`${label} 진입`, async () => {
      await openApp(page, { onboarding: 'skip' });
      await openFormatFromHome(page, '육아일기');
      await chooseStyle(page, 'premium');
    });

    await ctx.step(`${label} 작성`, async () => {
      await fillTitle(page, d.title);
      if (d.newSubject || d.retypeSubject) {
        await page.getByPlaceholder('새 대상 추가').fill(SUBJECT.name);
        if (d.newSubject) {
          await page.locator('input[type=date]').first().fill(SUBJECT.birthdate);
          await page.getByRole('button', { name: SUBJECT.genderLabel, exact: true }).click();
        }
      }
      if (d.existing) {
        const sel = page.locator('select').first();
        const options = await sel.evaluate((el) => [...el.options].map((o) => ({ value: o.value, label: (o.textContent || '').trim() })));
        const matches = options.filter((o) => o.label.includes(SUBJECT.name));
        ctx.check('"기존 대상 선택" 목록에 등록한 아이(하준)가 나온다', matches.length >= 1, `선택지: ${JSON.stringify(options.map((o) => o.label))}`, '중대');
        if (matches.length > 1) {
          ctx.finding({
            severity: '경미',
            title: '"기존 대상 선택" 목록에 이름이 같은 아이가 구분 없이 두 번 나온다',
            detail: `3일차의 중복 등록 뒤 4일차에 목록을 열자 선택지가 ${JSON.stringify(options.map((o) => o.label))} 로 보인다. 생년월일 등 구분 정보가 없어 어느 쪽이 원래 아이인지 사용자가 알 수 없다.`,
          });
        }
        if (matches[0]) await sel.selectOption(matches[0].value);
      }
      for (const [ph, text] of Object.entries(d.f)) await fillByPlaceholder(page, ph, text);
      if (d.photos) {
        await attachPhotos(page, Array.from({ length: d.photos }, (_, k) => testImage(`p08-baby-${k}`, 20 + k * 60)));
      }
    });

    await ctx.step(`${label} ${d.ai ? 'AI 다듬어 저장' : '원본 저장'}`, async () => {
      if (d.ai) await saveWithAi(page); else await saveOriginal(page);
      await waitForSayu(page);
    });

    await ctx.step(`${label} 저장 결과 확인`, async () => {
      const recs = await ctx.records(uid);
      ctx.check('기록이 정확히 1건 늘었다', recs.length === before + 1, `이전 ${before}건 → 현재 ${recs.length}건`, '치명');
      before = recs.length;
      const mine = recs.find((r) => r.child_title === d.title);
      if (!ctx.check('입력한 제목으로 저장된 기록이 있다', !!mine, `저장된 제목: ${JSON.stringify(recs.map((r) => r.child_title))}`, '치명')) return;
      ctx.check('저장 경로가 users/{uid}/records/{날짜}_{시각} 형태다', new RegExp(`^users/${uid}/records/${d.date}_\\d+$`).test(mine.path), mine.path, '치명');
      ctx.check('date 필드가 YYYY-MM-DD 이고 기록한 날과 같다', mine.date === d.date, `date=${mine.date}`, '치명');
      ctx.check('형식이 ["육아일기"] 로 저장된다', JSON.stringify(mine.formats) === JSON.stringify(['육아일기']), JSON.stringify(mine.formats), '중대');
      ctx.check('프리미엄 5칸 내용이 모두 저장된다',
        ['child_name', 'child_growth', 'child_meal', 'child_activity', 'child_emotion'].every((k) => typeof mine[k] === 'string' && mine[k].length > 0),
        `저장된 키: ${Object.keys(mine).filter((k) => k.startsWith('child_')).join(',')}`, '중대');
      ctx.check('기록에 성장 대상 정보(growthSubjectId·이름)가 연결된다', !!mine.growthSubjectId && mine.growthSubjectName === SUBJECT.name,
        `growthSubjectId=${mine.growthSubjectId}, name=${mine.growthSubjectName}`, '중대');
      if (d.photos) {
        let imgs = [];
        try { imgs = JSON.parse(mine.child_images || '[]'); } catch { /* 아래 check 에서 실패 */ }
        ctx.check(`사진 ${d.photos}장이 기록에 저장된다`, imgs.length === d.photos, `child_images=${mine.child_images}`, '중대');
      }
    });
  }

  // ── 성장 대상 데이터 점검 ──
  await ctx.step('성장 대상(아이) 데이터 점검', async () => {
    const db = await ctx.db();
    const subs = subjectDocs(db, uid);
    const first = subs.find((s) => s.birthdate === SUBJECT.birthdate) || subs[0];
    ctx.check('아이 대상이 생년월일·성별과 함께 등록된다', !!first && first.name === SUBJECT.name && first.birthdate === SUBJECT.birthdate && first.gender === SUBJECT.genderKey,
      JSON.stringify(subs.map((s) => ({ id: s.id, name: s.name, birthdate: s.birthdate, gender: s.gender }))), '중대');
    // 같은 아이의 기록 날짜가 대상별로 어떻게 나뉘었는지(2일차는 기존 대상 선택, 3일차는 이름 재입력, 4일차는 기존 대상 선택)
    const linkedBySubject = subs.map((x) => ({ id: x.id, birthdate: x.birthdate || '없음', linked: x.linkedRecordDates || [] }));
    ctx.check('아이의 기록 4일이 한 명의 성장 대상에 모두 쌓인다', subs.some((x) => ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].every((y) => (x.linkedRecordDates || []).includes(y))),
      `대상별 연결일: ${JSON.stringify(linkedBySubject)}`);
    // 3일차: 이름을 다시 직접 입력한 실수
    const sameName = subs.filter((s) => s.name === SUBJECT.name);
    if (sameName.length > 1) {
      ctx.finding({
        severity: '경미',
        title: '같은 이름을 "새 대상 추가"에 다시 입력하면 같은 아이가 중복 등록된다',
        detail: `3일차에 "하준"을 새 대상 칸에 다시 입력해 저장하자 이름이 같은 성장 대상이 ${sameName.length}개 생겼다. ${sameName.map((x, k) => `대상 ${String.fromCharCode(65 + k)}: 생년월일 ${x.birthdate || '없음'}, 연결된 기록일 ${(x.linkedRecordDates || []).join('·') || '없음'}`).join(' / ')}. 4일차에는 "기존 대상 선택"에서 첫 번째 "하준"을 골랐지만 기록은 생년월일이 없는 쪽(대상 B)에 쌓였다. 아이의 4일치 기록이 2+2로 갈라져 이후 타임라인·성장 통계가 아이별로 나뉠 수 있다.`,
      });
    }
    ctx.check('같은 이름의 아이가 중복 등록되지 않는다', sameName.length === 1, `"${SUBJECT.name}" 대상 ${sameName.length}개`);
    const entries = db.filter(([p]) => new RegExp(`^users/${uid}/growthSubjects/[^/]+/entries/[^/]+$`).test(p));
    ctx.check('기록 4건마다 성장 대상 하위 entries 문서가 생긴다', entries.length === 4, `entries ${entries.length}개`, '중대');
    const lib = db.filter(([p, v]) => new RegExp(`^users/${uid}/library/`).test(p) && v.type === 'timeline');
    ctx.check('성장타임라인용 library 색인이 만들어진다', lib.length >= 1, `library timeline ${lib.length}개`, '경미');
  });

  await ctx.step('내 기록(SAYU) 육아일기 묶음 점검', async () => {
    const closeBtn = page.getByText('닫기', { exact: true }).last();
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
    await page.waitForTimeout(1200);
    const text = await pageText(page);
    for (const d of DAYS) ctx.check(`내 기록 목록에 "${d.title}" 제목이 보인다`, text.includes(d.title), '', '중대');
    return { note: text.replace(/\n{2,}/g, '\n').slice(0, 700) };
  });

  await ctx.step('홈 HARU타임라인 화면 확인', async () => {
    await page.getByText('HARU', { exact: true }).first().click(); // 하단 홈 탭
    await page.waitForTimeout(1200);
    await page.getByText('HARU타임라인').first().click();
    await page.waitForTimeout(1500);
    const text = await pageText(page);
    const createOnly = /새 성장타임라인 만들기/.test(text) && !text.includes(SUBJECT.name);
    if (createOnly) {
      ctx.finding({
        severity: '제안',
        title: 'HARU타임라인은 갤러리에서 사진을 새로 고르는 화면이라, 육아일기로 쌓은 아이 기록과 이어지지 않는다',
        detail: '육아일기에서 아이 "하준"을 등록하고 4일간 사진·기록을 남겼지만, 홈의 HARU타임라인을 열면 "새 성장타임라인 만들기(사진 선택)"만 나오고 하준의 기록·사진을 불러오는 선택지가 보이지 않는다.',
      });
    }
  });
}
