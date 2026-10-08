// P16 — 여행기록 / 장하늘(29·남·회사원, 제주 3박4일 여행)
import { testImage } from '../runner/assets.mjs';
import {
  openApp, openFormatFromHome, chooseStyle, fillTitle, fillSimple, fillByPlaceholder,
  attachPhotos, saveOriginal, saveWithAi, waitForSayu, pageText,
} from '../runner/driver.mjs';

export const meta = {
  id: 'p16-travel',
  format: '여행기록',
  persona: {
    name: '장하늘', age: 29, gender: '남', job: '회사원(마케팅)',
    device: 'iPhone 모양(Chromium 모바일 에뮬레이션, 390×844)', itLevel: '상', plan: '무료(월 AI 도움 10회)',
    goal: '제주 3박 4일 동안 장소마다 사진과 짧은 글을 남기고, 돌아와서 여행 한 편으로 읽고 싶다.',
  },
  identity: { uid: 'qa-p16-jang-haneul', displayName: '장하늘', email: 'p16@example.invalid', plan: 'free' },
  scenario: [
    '1일차(10/1 낮): 프리미엄 6칸 기록 + 사진 3장 (이모지·괄호가 들어간 제목)',
    '1일차(밤): 같은 날 두 번째 기록 — 간편, 숙소에서 짧게',
    '2일차(10/2): 사진 4장을 한꺼번에 고르기, AI 다듬기 1회',
    '3일차(10/3): 비 오는 날 긴 글(약 4,800자)·줄바꿈·이모지 — AI 다듬기를 먼저 눌러 보고 안 되면 원본으로 저장',
    '4일차(10/4, 귀국 후): 어제(3일차) 못 쓴 저녁 일정을 "어제 날짜"로 남기려 해 본다',
    '마무리: 내 기록(SAYU) 목록·달력에서 여행기록 모음 확인',
  ],
};

const LONG_LINE = (i) => `${i + 1}. 비 오는 날의 제주 — 우비를 입고 한라산 둘레길을 천천히 걸었다. 안개가 걷히며 숲 냄새가 올라왔다. 🌧️`;
const LONG_TEXT = Array.from({ length: 90 }, (_, i) => LONG_LINE(i)).join('\n').slice(0, 4800); // 정확히 4,800자

const DAYS = [
  { date: '2026-10-01', time: '15:30', title: '제주 1일차 🍊 협재해변(한림)', style: 'premium', photos: 3, save: 'original',
    f: {
      '오전 10시 산사 도착': '오전 11시 제주공항 도착, 렌터카 수령\n오후 2시 협재해변 산책',
      '처마 끝 풍경': '에메랄드빛 바다와 멀리 보이는 비양도\n바람이 시원했다',
      '사찰 인근 식당에서': '한림 근처 갈치조림 정식 (2인 48,000원)\n비린내 없이 칼칼했다',
      '빠르게 걷느라': '여행은 속도를 늦추는 일이라는 말이 오늘은 이해됐다.',
      '길을 안내해 주신': '길을 알려 주신 렌터카 직원분께 감사드린다.',
      '자유롭게 작성하세요.': '내일은 성산일출봉 일출을 보기로 했다.',
    } },
  { date: '2026-10-01', time: '22:30', title: '제주 1일차 밤, 숙소에서', style: 'simple', save: 'original',
    text: '숙소 마당에서 귤 맛 맥주 한 캔. 별이 정말 많다.' },
  { date: '2026-10-02', time: '20:00', title: '제주 2일차, 성산일출봉', style: 'premium', photos: 4, save: 'ai',
    f: {
      '오전 10시 산사 도착': '새벽 5시 기상, 6시 성산일출봉 도착\n정상까지 30분',
      '처마 끝 풍경': '구름 사이로 해가 올라오는 장면이 압도적이었다',
      '사찰 인근 식당에서': '해녀의 집에서 전복죽 (1인 15,000원)',
      '빠르게 걷느라': '사진으로 다 담기지 않는 것들이 있다.',
      '길을 안내해 주신': '정상에서 사진을 찍어 주신 할머니께 감사드린다.',
      '자유롭게 작성하세요.': '다리가 후들거린다.',
    } },
  { date: '2026-10-03', time: '21:10', title: '제주 3일차, 비 오는 날', style: 'simple', save: 'original', tryAiFirst: true, text: LONG_TEXT },
  { date: '2026-10-04', time: '09:00', title: '제주 3일차 저녁(어제 못 쓴 것)', style: 'simple', save: 'original', backdate: true,
    text: '어제 저녁 흑돼지 거리에서 먹은 근고기가 정말 좋았다. 숙소로 돌아와 짐을 쌌다.' },
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

export async function run(ctx) {
  const { page } = ctx;
  const uid = meta.identity.uid;
  let before = 0;
  let aiShot = null;

  for (let i = 0; i < DAYS.length; i += 1) {
    const d = DAYS[i];
    const label = `${i + 1}번째 기록(${d.date} ${d.time})`;
    await ctx.setDay(d.date, d.time);

    await ctx.step(`${label} 진입`, async () => {
      await openApp(page, { onboarding: 'skip' });
      await openFormatFromHome(page, '여행기록');
      await chooseStyle(page, d.style);
    });

    await ctx.step(`${label} 작성`, async () => {
      await fillTitle(page, d.title);
      if (d.backdate) {
        // 어제 날짜로 남길 방법이 있는지 — 날짜 선택 칸이나 "날짜 바꾸기" 같은 버튼이 있는지 찾는다.
        const dateInputs = await page.locator('input[type=date]').count();
        const dateButtons = await page.getByRole('button', { name: /날짜|어제|변경/ }).count();
        const t = await pageText(page);
        const shown = (t.match(/\d{4}\.\d{2}\.\d{2}\s*[월화수목금토일]요일/) || [''])[0];
        aiShot = await ctx.snap('증거-기록 화면의 날짜');
        ctx.check('지난 날짜(어제)로 기록을 남길 수 있는 날짜 선택이 있다', dateInputs + dateButtons > 0, `날짜 입력칸 ${dateInputs}개, 날짜 관련 버튼 ${dateButtons}개, 화면의 날짜 표시 "${shown}"`);
        if (dateInputs + dateButtons === 0) {
          ctx.finding({
            severity: '제안',
            shot: aiShot,
            title: '기록한 날이 항상 "오늘"로 고정되어, 여행 중 못 쓴 날을 나중에 그 날짜로 남길 수 없다',
            detail: `귀국한 다음 날(10/4) 아침에 "제주 3일차 저녁"을 쓰려 했지만 기록 화면에는 날짜를 바꾸는 칸이 없고(화면 표시 "${shown}", 날짜 입력칸 ${dateInputs}개) 저장하면 10/4 기록이 된다. RecordPage.tsx 195줄 currentDate 가 읽기 전용 상태(useState(new Date()))다. 그 결과 SAYU 목록·달력의 여행 기록이 실제 여행일이 아니라 "쓴 날"에 쌓이고, 월별 합본에서도 여행 순서가 어긋날 수 있다. "하루 단위 기록" 철학에 따른 설계일 수 있어 결함이 아니라 제품 결정 사항으로 보고한다(가계부·보조장부는 거래마다 날짜 칸이 있음).`,
          });
        }
      }
      if (d.style === 'simple') await fillSimple(page, d.text);
      else for (const [ph, text] of Object.entries(d.f)) await fillByPlaceholder(page, ph, text);
      if (d.photos) {
        await attachPhotos(page, Array.from({ length: d.photos }, (_, k) => testImage(`p16-trip-${i}-${k}`, 200 + k * 25)));
        const t = await ctx.toasts();
        const counter = (await pageText(page)).match(/사진 추가 \((\d+)\/3\)/);
        const shot = await ctx.snap('증거-사진 첨부 직후');
        if (d.photos > 3) {
          const warned = t.some((x) => /최대|초과|넘|건너|제외|일부|나머지/.test(x));
          ctx.check('사진을 3장 넘게 고르면 넘친 사진이 빠진다는 안내가 나온다', warned, `안내: ${JSON.stringify(t)} / 칸 표시: ${counter ? counter[0] : '없음'} / 고른 사진 ${d.photos}장`);
          if (!warned) {
            ctx.finding({
              severity: '경미', shot,
              title: '사진을 한 번에 최대 장수보다 많이 고르면 넘친 사진이 안내 없이 버려진다',
              detail: `여행 사진 ${d.photos}장을 한꺼번에 고르자 앞의 3장만 올라가고 "${t.join(' / ')}" 안내만 떴다(칸 표시 ${counter ? counter[0] : '없음'}). 빠진 ${d.photos - 3}장에 대한 안내가 없다. 텃밭일지에서도 같은 동작을 확인했다(FormatModal.tsx handleImageUpload).`,
            });
          }
        }
      }
    });

    if (d.tryAiFirst) {
      await ctx.step(`${label} AI 다듬기를 먼저 눌러 보기(긴 글)`, async () => {
        await page.getByRole('button', { name: /AI 다듬은 후 SAYU-나의기록 저장/ }).first().click();
        await page.waitForTimeout(400);
        await page.getByRole('button', { name: 'AI 다듬기 실행' }).click();
        await page.waitForTimeout(2200);
        const t = await ctx.toasts();
        const len = (await page.getByPlaceholder('자유롭게 기록해 주세요').inputValue()).length;
        const shot = await ctx.snap('증거-긴 글 AI 다듬기 안내');
        const failed = t.some((x) => /실패/.test(x));
        if (!failed) throw new Error(`긴 글(${len}자)이 AI 한도 안에 들어가 시나리오 전제가 깨졌다 — 안내: ${JSON.stringify(t)}`);
        const clear = t.some((x) => /글자|자 이내|너무 길|길어|줄여|5,?000/.test(x));
        ctx.check('글이 너무 길어 AI 다듬기가 안 될 때 "너무 길다"는 안내가 나온다', clear, `본문 ${len}자 / 안내: ${JSON.stringify(t)}`);
        ctx.check('AI 다듬기가 실패해도 쓴 글은 그대로 남아 있다', len === d.text.length, `칸 글자 수 ${len} / 입력 ${d.text.length}`, '치명');
        if (!clear) {
          ctx.finding({
            severity: '경미', shot,
            title: '긴 글에서 AI 다듬기가 안 될 때 "AI 연결에 실패했습니다."라고만 나와 원인(글자 수 초과)을 알 수 없다',
            detail: `여행기록 간편 기록에 ${len.toLocaleString()}자를 쓰고 "AI 다듬은 후 저장"을 누르자 "${t.filter((x) => /실패/.test(x)).join(' / ')}"라고만 나온다. 서버(functions/src/index.ts 2350줄)는 안내문을 합친 전체 길이가 5,000자를 넘으면 "텍스트는 5000자 이내여야 합니다."로 거절하는데, 클라이언트(FormatModal.tsx 1381줄)는 월 한도 오류만 따로 안내하고 나머지는 모두 "AI 연결에 실패했습니다."로 바꾼다. 화면에는 글자 수 표시도 없다. 안내문(약 500~600자)이 앞에 붙어 실제로는 본문 약 4,450자부터 실패했다(4,400자 성공, 4,500자 실패). 같은 글로 다시 눌러도 계속 실패하므로 사용자는 네트워크 문제로 오해하기 쉽다. 쓴 글은 사라지지 않고 원본 저장은 된다.`,
          });
        }
      });
    }

    await ctx.step(`${label} ${d.save === 'ai' ? 'AI 다듬어 저장' : '원본 저장'}`, async () => {
      if (d.save === 'ai') await saveWithAi(page); else await saveOriginal(page);
      await waitForSayu(page);
      // 저장 직후 SAYU 화면에 어떤 비서가 추천되는지 읽어 둔다(여행 기록이면 여행 비서가 먼저 나오는지)
      const t = await pageText(page);
      const rec = t.match(/HARU[^\n]{0,12}비서[^\n]*/g) || [];
      const petIdx = t.indexOf('반려동물건강돌봄비서');
      const petMatch = petIdx >= 0 ? t.slice(petIdx).match(/^[\s\S]*?반려동물 건강돌봄비서와 연결/) : null;
      const petText = petMatch ? Array.from(petMatch[0].replace(/\n+/g, ' ⏎ ')).slice(0, 140).join('') : '';
      const allText = d.style === 'simple' ? d.text : Object.values(d.f).join('\n');
      if (petIdx >= 0 && !/강아지|고양이|반려|동물|애견|펫/.test(allText)) {
        const shot = await ctx.snap('증거-추천 비서');
        ctx.finding({
          severity: '제안', shot,
          title: '여행 기록에 "산책"이라고만 써도 반려동물 건강돌봄 비서가 추천된다',
          detail: `반려동물 이야기가 없는 제주 여행 기록("협재해변 산책")을 저장하자 추천 목록이 ${JSON.stringify(rec.slice(0, 4))}로 나왔다. 반려동물 비서의 키워드에 "산책"이 들어 있어(utils/assistantRecommendations.ts 123줄) 사람의 산책에도 반응한다. 화면 문구: "${petText}". 앞서 교사의 학급 일기에 육아일기를 추천한 것(F-10)과 같은 종류의 키워드 규칙 문제다.`,
        });
      }
      return { note: `추천: ${JSON.stringify(rec.slice(0, 4))}` };
    });

    await ctx.step(`${label} 저장 결과 확인`, async () => {
      const recs = await ctx.records(uid);
      ctx.check('기록이 정확히 1건 늘었다', recs.length === before + 1, `이전 ${before}건 → 현재 ${recs.length}건`, '치명');
      before = recs.length;
      const mine = recs.find((r) => r.travel_title === d.title);
      if (!ctx.check('입력한 제목(이모지·괄호 포함)으로 저장된 기록이 있다', !!mine, `저장된 제목: ${JSON.stringify(recs.map((r) => r.travel_title))}`, '치명')) return;
      ctx.check('저장 경로가 users/{uid}/records/{날짜}_{시각} 형태다', new RegExp(`^users/${uid}/records/${d.date}_\\d+$`).test(mine.path), mine.path, '치명');
      ctx.check('date 필드가 YYYY-MM-DD 이고 기록한 날과 같다', mine.date === d.date, `date=${mine.date}`, '치명');
      ctx.check('형식이 ["여행기록"] 로 저장된다', JSON.stringify(mine.formats) === JSON.stringify(['여행기록']), JSON.stringify(mine.formats), '중대');
      if (d.style === 'simple') ctx.check('간편 기록 본문(줄바꿈·이모지 포함)이 그대로 저장된다', mine.travel_simple === d.text, `길이 ${String(mine.travel_simple || '').length} / 원본 ${d.text.length}`, '치명');
      else ctx.check('프리미엄 6칸 내용이 모두 저장된다', ['travel_journey', 'travel_scenery', 'travel_food', 'travel_thought', 'travel_gratitude', 'travel_space'].filter((k) => typeof mine[k] === 'string' && mine[k].length > 0).length === 6, `저장된 키: ${Object.keys(mine).filter((k) => k.startsWith('travel_')).join(',')}`, '중대');
      if (d.photos) {
        let imgs = [];
        try { imgs = JSON.parse(mine.travel_images || '[]'); } catch { /* 아래 check 에서 실패 */ }
        const want = Math.min(d.photos, 3);
        ctx.check(`사진 ${want}장이 기록에 저장된다`, imgs.length === want, `travel_images=${mine.travel_images}`, '중대');
      }
    });
  }

  await ctx.step('내 기록(SAYU) 여행기록 묶음 점검', async () => {
    await openSayuList(page, '여행기록', DAYS[0].title);
    const text = await pageText(page);
    const m = text.match(/이달 결과\s*(\d+)건/);
    ctx.check('내 기록 목록의 "이달 결과"가 실제 저장 건수(5건)와 같다', m && Number(m[1]) === 5, `화면: ${m ? m[0] : '표시 없음'}`, '치명');
    for (const d of DAYS) ctx.check(`내 기록 목록에 "${d.title}" 제목이 보인다`, text.includes(d.title), '', '중대');
    return { note: text.replace(/\n{2,}/g, '\n').slice(0, 400) };
  });

  await ctx.step('내 기록(SAYU) 달력 점검', async () => {
    await page.getByText('달력', { exact: true }).first().click();
    await page.waitForTimeout(1200);
    const dots = await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter((e) => {
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        return e.children.length === 0 && r.width >= 3 && r.width <= 9 && Math.abs(r.width - r.height) < 1 && parseFloat(cs.borderRadius) >= r.width / 2 - 0.5 && r.top > 250;
      });
      return els.length;
    });
    ctx.check('달력에 기록한 4일(10/1~10/4)이 점으로 표시된다', dots === 4, `점 ${dots}개(기대 4개)`, '중대');
  });
}
