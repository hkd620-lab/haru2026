// P15 — 텃밭일지 / 윤정숙(63·여·퇴직 후 주말농장 12평)
import { testImage } from '../runner/assets.mjs';
import {
  openApp, openFormatFromHome, chooseStyle, fillTitle, fillSimple, fillByPlaceholder,
  attachPhotos, saveOriginal, saveWithAi, waitForSayu, pageText,
} from '../runner/driver.mjs';

export const meta = {
  id: 'p15-garden',
  format: '텃밭일지',
  persona: {
    name: '윤정숙', age: 63, gender: '여', job: '퇴직 후 주말농장 12평 경작',
    device: 'iPhone 모양(Chromium 모바일 에뮬레이션, 390×844)', itLevel: '하', plan: '무료(월 AI 도움 10회)',
    goal: '주말마다 배추·무·갓 키우는 과정을 사진과 함께 적어 두고, 작물별로 어떻게 자랐는지 나중에 보고 싶다.',
  },
  identity: { uid: 'qa-p15-yoon-jeongsuk', displayName: '윤정숙', email: 'p15@example.invalid', plan: 'free' },
  scenario: [
    '1일차(토): 처음 사용 — 간편 기록, 성장대상 "배추" 새로 추가, 사진 1장',
    '2일차(일): 작물 목록에 배추·무·갓을 넣고 프리미엄 6칸 기록, 성장대상은 "기존 대상 선택"에서 배추',
    '3일차(월): 목록에서 고르는 걸 잊고 "새 대상 추가"에 "배추"를 다시 입력하는 흔한 실수',
    '4일차(화): 사진 5장을 한꺼번에 고르기(최대 3장), 성장대상 목록에서 배추 고르기',
    '5일차(수): AI 다듬기 1회',
    '마무리: 내 기록(SAYU) 목록에서 5건 확인, 1일차 기록을 다시 열어 작물 정보 확인',
  ],
};

const DAYS = [
  { date: '2026-10-03', time: '17:30', title: '김장배추 모종 심기', style: 'simple', newSubject: '배추', photos: 1,
    text: '모종 20포기를 두 줄로 심었다.\n물을 흠뻑 주고 부직포를 덮어 주었다.' },
  { date: '2026-10-04', time: '10:00', title: '배추 물주기와 벌레 잡기', style: 'premium', crops: ['배추', '무', '갓'], existingSubject: '배추',
    f: {
      '토마토, 상추': '배추 20포기, 무 한 이랑',
      '잡초를 제거하고': '배추에 물을 주고 잎에 붙은 벌레를 손으로 잡았다.',
      '토마토에 꽃이': '배추 속잎이 조금씩 오므라들기 시작했다.',
      '고추 잎에': '벌레 구멍이 여러 개 보인다. 약은 치지 않았다.',
      '내일은 지주대를': '다음 주말에는 무 솎아주기를 해야겠다.',
      '자유롭게 작성하세요.': '비 소식이 있어 부직포는 그대로 두었다.',
    } },
  { date: '2026-10-05', time: '20:00', title: '무 솎아주기', style: 'simple', newSubject: '배추', // 목록에서 고르지 않고 이름을 다시 입력
    text: '무 싹이 촘촘해서 튼튼한 것만 남기고 솎아 주었다.' },
  { date: '2026-10-06', time: '18:00', title: '비 온 뒤 텃밭 풍경', style: 'simple', existingSubject: '배추', photos: 5,
    text: '밤새 비가 와서 흙이 촉촉하다. 배추 잎이 한층 푸르게 올라왔다.' },
  { date: '2026-10-07', time: '21:00', title: '갓 파종 마무리', style: 'simple', existingSubject: '배추', ai: true,
    text: '갓 씨앗을 뿌리고 얇게 흙을 덮었다. 모종 사이사이 빈틈에 심었다.' },
];


async function openSayuList(page, groupLabel, firstTitle) {
  // 저장 직후 열려 있는 상세 창에 기대지 않고, 앱을 다시 열어 하단 "SAYU·나의 기록"으로 들어가 목록을 본다.
  await openApp(page, { onboarding: 'skip' });
  await page.getByText('SAYU·나의 기록', { exact: false }).first().click();
  await page.waitForTimeout(1500);
  if (!(await pageText(page)).includes(firstTitle)) {
    await page.locator(`text=${groupLabel}`).filter({ hasText: new RegExp(`^${groupLabel}$`) }).last().click();
    await page.waitForTimeout(1200);
  }
}

const subjectDocs = (db, uid) => db.filter(([p]) => new RegExp(`^users/${uid}/growthSubjects/[^/]+$`).test(p)).map(([p, d]) => ({ id: p.split('/').pop(), ...d }));

export async function run(ctx) {
  const { page } = ctx;
  const uid = meta.identity.uid;
  let before = 0;
  let photoShot = null;

  for (let i = 0; i < DAYS.length; i += 1) {
    const d = DAYS[i];
    const label = `${i + 1}일차(${d.date})`;
    await ctx.setDay(d.date, d.time);

    await ctx.step(`${label} 진입`, async () => {
      await openApp(page, { onboarding: 'skip' });
      await openFormatFromHome(page, '텃밭일지');
      await chooseStyle(page, d.style);
    });

    if (d.crops) {
      await ctx.step(`${label} 작물 목록에 작물 ${d.crops.length}개 추가`, async () => {
        for (const c of d.crops) {
          await page.getByPlaceholder('작물 이름 입력').fill(c);
          await page.getByRole('button', { name: '추가', exact: true }).click();
          await page.waitForTimeout(500);
        }
        const text = await pageText(page);
        ctx.check('추가한 작물이 목록 칩으로 모두 보인다', d.crops.every((c) => text.includes(c)), '', '중대');
        const db = await ctx.db();
        const garden = db.find(([p]) => p === `users/${uid}/settings/garden`);
        ctx.check('작물 목록이 users/{uid}/settings/garden 에 저장된다', JSON.stringify(garden?.[1]?.crops) === JSON.stringify(d.crops), JSON.stringify(garden), '중대');
      });
    }

    await ctx.step(`${label} 작성`, async () => {
      await fillTitle(page, d.title);
      if (d.newSubject) await page.getByPlaceholder('새 대상 추가').fill(d.newSubject);
      if (d.existingSubject) {
        const sel = page.locator('select').first();
        const options = await sel.evaluate((el) => [...el.options].map((o) => ({ value: o.value, label: (o.textContent || '').trim() })));
        const matches = options.filter((o) => o.label.includes(d.existingSubject));
        ctx.check(`"기존 대상 선택" 목록에 "${d.existingSubject}"가 나온다`, matches.length >= 1, `선택지: ${JSON.stringify(options.map((o) => o.label))}`, '중대');
        if (matches.length > 1) {
          ctx.check('이름이 같은 작물이 여럿이어도 목록에서 서로 다른 글자로 구분된다', new Set(matches.map((m) => m.label)).size === matches.length, `선택지: ${JSON.stringify(matches.map((m) => m.label))}`, '경미');
        }
        // 가장 최근 기록 쪽(마지막 항목)이 아니라 첫 항목을 고르는 평범한 사용자
        if (matches[0]) await sel.selectOption(matches[0].value);
      }
      if (d.style === 'simple') await fillSimple(page, d.text);
      else for (const [ph, text] of Object.entries(d.f)) await fillByPlaceholder(page, ph, text);
      if (d.photos) {
        await attachPhotos(page, Array.from({ length: d.photos }, (_, k) => testImage(`p15-garden-${i}-${k}`, 90 + k * 30)));
        const t = await ctx.toasts();
        const counter = (await pageText(page)).match(/사진 추가 \((\d+)\/3\)/);
        photoShot = await ctx.snap('증거-사진 첨부 직후');
        if (d.photos > 3) {
          const warned = t.some((x) => /최대|초과|넘|건너|제외|일부|나머지/.test(x));
          ctx.check('사진을 3장 넘게 고르면 넘친 사진이 빠진다는 안내가 나온다', warned, `안내: ${JSON.stringify(t)} / 칸 표시: ${counter ? counter[0] : '없음'} / 고른 사진 ${d.photos}장`);
          ctx.check('3장까지만 첨부된다', counter && Number(counter[1]) === 3, `칸 표시: ${counter ? counter[0] : '없음'}`, '중대');
          if (!warned) {
            ctx.finding({
              severity: '경미',
              shot: photoShot,
              title: '사진을 한 번에 최대 장수보다 많이 고르면 넘친 사진이 안내 없이 버려진다',
              detail: `${d.photos}장을 한꺼번에 고르자 앞의 3장만 올라가고 "${t.join(' / ')}" 안내만 떴다. 나머지 ${d.photos - 3}장이 빠졌다는 말은 없다. FormatModal.tsx handleImageUpload(1849~1859줄)는 남은 칸이 이미 0일 때만 "최대 N장까지만 업로드할 수 있습니다"를 보여 주고, 한 번에 더 많이 고른 경우에는 slice(0, 남은 칸)로 조용히 잘라 낸다. 사진을 여러 장 고르는 일이 흔한 여행기록·육아일기 등 모든 사진 형식에 해당한다.`,
            });
          }
        }
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
      const mine = recs.find((r) => r.garden_title === d.title);
      if (!ctx.check('입력한 제목으로 저장된 기록이 있다', !!mine, `저장된 제목: ${JSON.stringify(recs.map((r) => r.garden_title))}`, '치명')) return;
      ctx.check('저장 경로가 users/{uid}/records/{날짜}_{시각} 형태다', new RegExp(`^users/${uid}/records/${d.date}_\\d+$`).test(mine.path), mine.path, '치명');
      ctx.check('date 필드가 YYYY-MM-DD 이고 기록한 날과 같다', mine.date === d.date, `date=${mine.date}`, '치명');
      ctx.check('형식이 ["텃밭일지"] 로 저장된다', JSON.stringify(mine.formats) === JSON.stringify(['텃밭일지']), JSON.stringify(mine.formats), '중대');
      ctx.check('기록에 성장 대상(작물) 정보가 연결된다', !!mine.growthSubjectId && mine.growthSubjectName === '배추', `growthSubjectId=${mine.growthSubjectId}, name=${mine.growthSubjectName}`, '중대');
      if (d.style === 'simple' && !d.ai) ctx.check('간편 기록 본문이 그대로 저장된다', mine.garden_simple === d.text, JSON.stringify(mine.garden_simple), '치명');
      if (d.style === 'simple' && !d.ai && i >= 2) {
        ctx.check('간편 기록은 본문에 "작물: …" 줄이 붙지 않고, 저장 필드 garden_crop 에만 작물 목록이 들어간다(작물 목록 사용 중)', !String(mine.garden_sayu || '').startsWith('작물:') && mine.garden_crop === '배추, 무, 갓', `garden_crop="${mine.garden_crop}" / garden_sayu 앞부분="${String(mine.garden_sayu || '').slice(0, 20)}"`);
      }
      if (i === 0) {
        const t = await ctx.toasts();
        const saved = t.filter((x) => /저장/.test(x));
        ctx.check('저장 성공 안내가 한 번만 뜬다', saved.length < 2, `저장 직후 화면의 안내: ${JSON.stringify(saved)}`);
        if (saved.length >= 2) {
          ctx.finding({
            severity: '참고',
            title: '저장할 때 성공 안내가 두 번 뜬다',
            detail: `저장 직후 "${saved.join('" · "')}"가 함께 보인다(FormatModal 의 저장 안내와 RecordPage 의 저장 안내가 둘 다 뜸). 보조장부("보조장부 N건이 저장되었습니다!" + "내용이 저장되었습니다!")와 여행기록에서도 같았다. 기능 문제는 아니고 문구 정리 수준이다.`,
          });
        }
      }
      if (d.photos) {
        let imgs = [];
        try { imgs = JSON.parse(mine.garden_images || '[]'); } catch { /* 아래 check 에서 실패 */ }
        const want = Math.min(d.photos, 3);
        ctx.check(`사진 ${want}장이 기록에 저장된다`, imgs.length === want, `garden_images=${mine.garden_images}`, '중대');
      }
      if (d.style === 'premium') {
        const typedCrop = d.f['토마토, 상추'];
        const sayu = String(mine.garden_sayu || '');
        const dupCrops = sayu.includes(`작물: ${d.crops.join(', ')}`) && sayu.includes(typedCrop);
        ctx.check('"작물" 칸에 직접 쓴 내용이 그대로 저장된다', mine.garden_crop === typedCrop, `garden_crop="${mine.garden_crop}" (직접 쓴 값 "${typedCrop}", 작물 목록 "${d.crops.join(', ')}")`);
        if (mine.garden_crop !== typedCrop) {
          ctx.finding({
            severity: '참고',
            title: '작물 목록을 써 두면 본문 앞에 "작물: …" 줄이 따로 붙고, 저장 필드(garden_crop)는 직접 쓴 글 대신 목록으로 바뀐다',
            detail: `작물 목록에 ${JSON.stringify(d.crops)}를 넣고 프리미엄 "작물" 칸에 "${typedCrop}"라고 썼는데 저장된 garden_crop 은 "${mine.garden_crop}"이다(직접 쓴 글은 garden_sayu 본문에만 남음). 본문(garden_sayu)에는 "작물: ${d.crops.join(', ')}" 줄이 맨 앞에 붙고 바로 이어 직접 쓴 작물 글이 다시 나와 ${dupCrops ? '작물 정보가 두 번 적힌다' : '작물 정보가 겹친다'}(FormatModal.tsx 2755·2784줄).`,
          });
        }
      }
    });
  }

  // ── 성장 대상(작물) 데이터 점검 ──
  await ctx.step('성장 대상(작물) 데이터 점검', async () => {
    const db = await ctx.db();
    const subs = subjectDocs(db, uid);
    const sameName = subs.filter((s) => s.name === '배추');
    ctx.check('작물 대상이 subjectType=garden 으로 등록된다', subs.length > 0 && subs.every((s) => s.subjectType === 'garden'), JSON.stringify(subs.map((s) => ({ id: s.id, type: s.subjectType, name: s.name }))), '중대');
    ctx.check('같은 이름("배추")의 작물이 중복 등록되지 않는다', sameName.length === 1, `"배추" 대상 ${sameName.length}개: ${JSON.stringify(sameName.map((s) => ({ id: s.id, linked: s.linkedRecordDates })))}`);
    if (sameName.length > 1) {
      ctx.finding({
        severity: '참고',
        title: '텃밭일지도 같은 이름을 "새 대상 추가"에 다시 쓰면 같은 작물이 따로 등록된다(육아일기는 최근 수정으로 막힘)',
        detail: `3일차에 목록에서 고르지 않고 "배추"를 새 대상 칸에 다시 입력하자 이름이 같은 작물 대상이 ${sameName.length}개가 됐다. ${sameName.map((s, k) => `대상 ${String.fromCharCode(65 + k)} 연결일: ${JSON.stringify(s.linkedRecordDates || [])}`).join(' / ')}. 육아일기·건강성장 페이지의 같은 이름 아이 중복은 PR #266·#267 로 막았지만 텃밭일지는 범위에 넣지 않았다(작물은 이름이 겹쳐도 다른 밭·다른 시기일 수 있어 "같은 이름 = 같은 작물"로 볼지는 제품 결정 사항). 이 화면에서 만든 작물의 성장과정을 보여 주는 화면은 따로 없다(저장만 됨).`,
      });
    }
    const entries = db.filter(([p]) => new RegExp(`^users/${uid}/growthSubjects/[^/]+/entries/[^/]+$`).test(p));
    ctx.check('기록 5건마다 성장 대상 하위 entries 문서가 생긴다', entries.length === 5, `entries ${entries.length}개`, '중대');
  });

  await ctx.step('내 기록(SAYU) 텃밭일지 묶음 점검', async () => {
    await openSayuList(page, '텃밭일지', DAYS[0].title);
    const text = await pageText(page);
    for (const d of DAYS) ctx.check(`내 기록 목록에 "${d.title}" 제목이 보인다`, text.includes(d.title), '', '중대');
    return { note: text.replace(/\n{2,}/g, '\n').slice(0, 500) };
  });

  await ctx.step('1일차 기록을 다시 열어 작물 정보 확인', async () => {
    await page.getByText(DAYS[0].title, { exact: false }).first().click();
    await waitForSayu(page);
    await page.getByRole('button', { name: '수정하기', exact: false }).click();
    await page.waitForTimeout(900);
    const shot = await ctx.snap('증거-1일차 기록 수정 화면');
    const values = await page.evaluate(() => [...document.querySelectorAll('input, textarea')].map((e) => e.value).filter(Boolean));
    const cropLike = values.find((v) => /배추, 무, 갓/.test(v));
    ctx.check('1일차(작물 목록이 비어 있던 때) 기록의 수정 화면에 나중에 만든 작물 목록이 끼어들지 않는다', !cropLike, `수정 화면 입력값 중 작물 목록과 같은 값: ${cropLike ? JSON.stringify(cropLike) : '없음'}`);
    if (cropLike) {
      ctx.finding({
        severity: '경미',
        shot,
        title: '작물 정보 없이 저장한 옛 텃밭일지를 열면 "지금의" 작물 목록이 그 기록의 작물로 채워진다',
        detail: `1일차(10/3)에는 작물 목록이 비어 있어 garden_crop 없이 저장했는데, 4일 뒤 그 기록의 수정 화면을 열자 입력값에 "${cropLike}"가 들어 있다. SayuModal.tsx 1309줄이 garden_crop 이 없는 기록을 열 때 현재 작물 목록(users/{uid}/settings/garden)을 가져와 채운다. 이 상태로 수정 저장하면 그날 쓰지 않은 작물 정보가 기록에 남는다.`,
      });
    }
  });

  await ctx.step('2일차 기록의 수정 화면에서 작물 칸 확인', async () => {
    await openSayuList(page, '텃밭일지', DAYS[0].title);
    await page.getByText(DAYS[1].title, { exact: false }).first().click();
    await waitForSayu(page);
    await page.getByRole('button', { name: '수정하기', exact: false }).click();
    await page.waitForTimeout(900);
    const values = await page.evaluate(() => [...document.querySelectorAll('input, textarea')].map((e) => e.value).filter(Boolean));
    const typed = DAYS[1].f['토마토, 상추'];
    const hasTyped = values.some((v) => v.includes(typed));
    const hasListOnly = values.some((v) => v === '배추, 무, 갓');
    await ctx.snap('증거-2일차 기록 수정 화면');
    if (!hasTyped) {
      ctx.finding({
        severity: '경미',
        title: '프리미엄 기록을 다시 열어 수정하려 하면 "작물" 칸에 직접 쓴 글이 아니라 작물 목록이 보인다',
        detail: `2일차에 "작물" 칸에 "${typed}"라고 쓰고 저장했는데, 그 기록의 수정 화면 입력값은 ${JSON.stringify(values.map((v) => v.slice(0, 40)))}로 직접 쓴 글이 보이지 않는다(저장 필드 garden_crop 이 작물 목록으로 바뀌어 저장됨). 이 상태로 수정 저장하면 직접 쓴 작물 내용이 본문(garden_sayu)에만 남는다.`,
      });
    }
    ctx.check('2일차 기록의 수정 화면에 작물 칸에 직접 쓴 글이 그대로 보인다', hasTyped, `수정 화면 입력값: ${JSON.stringify(values.map((v) => v.slice(0, 40)))} / 직접 쓴 글 있음=${hasTyped}, 작물 목록만 있는 칸 있음=${hasListOnly}`);
  });
}
