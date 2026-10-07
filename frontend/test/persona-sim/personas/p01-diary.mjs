// P01 — 일기 / 김서연(34·여·초등학교 교사)
import { testImage } from '../runner/assets.mjs';
import {
  openApp, openFormatFromHome, openFormatOnRecordPage, chooseStyle, fillTitle, fillSimple, fillByPlaceholder,
  attachPhotos, saveOriginal, saveWithAi, waitForSayu, pageText,
} from '../runner/driver.mjs';

export const meta = {
  id: 'p01-diary',
  format: '일기',
  persona: {
    name: '김서연', age: 34, gender: '여', job: '초등학교 교사',
    device: 'iPhone 모양(Chromium 모바일 에뮬레이션, 390×844)', itLevel: '중', plan: '무료(월 AI 도움 10회)',
    goal: '퇴근 후 폰으로 하루를 짧게 남기고 싶다. 쓰다 보면 습관이 되길 바란다.',
  },
  identity: { uid: 'qa-p01-kim-seoyeon', displayName: '김서연', email: 'p01@example.invalid', plan: 'free' },
  scenario: [
    '1일차: 처음 설치한 사용자 — 첫 안내 화면에서 "바로 첫 기록 쓰기"를 누르고, 제목 없이 저장을 시도했다가 막힌 뒤 제목을 넣어 저장',
    '2일차: 이모지가 섞인 아주 짧은 간편 기록',
    '3일차: "AI 다듬은 글 저장" 사용(월 한도 차감 확인)',
    '4일차: 프리미엄(항목별 4칸) 기록',
    '5일차: 사진 1장을 붙인 기록',
    '6일차: 한 줄짜리 극단적으로 짧은 기록',
    '7일차: 같은 날 아침·저녁 2건 작성 → 내 기록(SAYU) 목록에서 8건 확인',
  ],
};

const DAYS = [
  { date: '2026-10-01', title: '소풍 준비하던 날', text: '오늘 학교에서 아이들이랑 가을 소풍 준비를 했다. 반 아이들이 도시락 메뉴 얘기를 하느라 정신이 없었다. 퇴근하고 나니 목이 좀 아프다.' },
  { date: '2026-10-02', title: '치킨데이', text: '금요일! 오늘은 일찍 퇴근해서 치킨 시켜 먹음 🍗 행복' },
  { date: '2026-10-03', title: '느린 토요일', text: '주말이라 늦잠을 잤다. 오후엔 동네 도서관에 갔는데 읽고 싶던 책이 대출 중이어서 아쉬웠다. 저녁엔 엄마랑 통화했다. 엄마가 김치를 보내주신다고 하셨다.' },
  {
    date: '2026-10-04', title: '일요일 정리',
    premium: {
      '뒷산 산책로': '빨래하고 방 청소, 다음 주 수업 자료 만들기',
      '낙엽소리가': '청소하고 나니 집이 환해져서 기분이 좋았다',
      '이웃에게 인사': '수업 자료를 다 못 만든 것',
      '내일은 천천히': '내일은 일찍 자야지',
    },
  },
  { date: '2026-10-05', title: '교정의 코스모스', text: '오늘 학교 화단에서 코스모스가 피었다. 아이들이 신기해서 한참을 들여다봤다. 사진을 찍어 두었다.' },
  { date: '2026-10-06', title: '피곤', text: '피곤..' },
  { date: '2026-10-07', time: '07:30', title: '비 오는 아침', text: '아침에 일어나 보니 비가 온다. 출근길이 걱정이다.' },
  { date: '2026-10-07', time: '21:40', title: '비에 젖은 퇴근길', text: '퇴근길에 우산이 없어서 흠뻑 젖었다. 감기 걸릴까 걱정.' },
];

const toastMatch = async (ctx, re, ms = 2500) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = await ctx.toasts().catch(() => []);
    if (t.some((x) => re.test(x))) return t;
    await ctx.page.waitForTimeout(150);
  }
  return ctx.toasts().catch(() => []);
};

export async function run(ctx) {
  const { page } = ctx;
  const uid = meta.identity.uid;
  let before = 0;
  let homeSeen = false;

  for (let i = 0; i < DAYS.length; i += 1) {
    const d = DAYS[i];
    const label = `${i + 1}번째 기록(${d.date}${d.time ? ' ' + d.time : ''})`;
    await ctx.setDay(d.date, d.time || '21:30');
    const premium = Boolean(d.premium);

    // ── 진입 ──
    await ctx.step(`${label} 진입`, async () => {
      const { sawOnboarding } = await openApp(page, { onboarding: i === 0 ? 'first-record' : 'skip' });
      if (i === 0) {
        ctx.check('처음 사용자에게 첫 안내 화면이 보인다', sawOnboarding, '/ 접속 시 /onboarding 으로 이동해야 함');
      }
      if (!homeSeen && i > 0) {
        homeSeen = true;
        const text = await pageText(page);
        // 홈 상단 고정 문구가 실제 기록과 맞는지 — 이 사용자는 일기만 써 왔고 텃밭일지는 쓴 적이 없다.
        const hasStaticStreak = /연속 기록 12일째/.test(text);
        const hasStaticGarden = /어젯밤 적어두신\s*‘텃밭일지’/.test(text);
        ctx.check('홈 상단 연속기록·최근기록 문구가 실제 기록과 일치한다', !(hasStaticStreak || hasStaticGarden),
          `이 사용자는 ${i}일째 일기만 기록했는데 홈에는 "연속 기록 12일째"/"어젯밤 적어두신 ‘텃밭일지’" 문구가 그대로 보임`, '중대');
      }
      if (i === 0) await openFormatOnRecordPage(page, '일기');
      else await openFormatFromHome(page, '일기');
      await chooseStyle(page, premium ? 'premium' : 'simple');
    });

    // ── 작성 ──
    await ctx.step(`${label} 작성`, async () => {
      if (i === 0) {
        // 제목 없이 먼저 저장해 보는 초보 사용자
        await fillSimple(page, d.text);
        await saveOriginal(page, 'simple');
        const t = await toastMatch(ctx, /제목을 입력해 주세요/);
        ctx.check('제목 없이 저장하면 안내 문구와 함께 막힌다', t.some((x) => /제목을 입력해 주세요/.test(x)), `토스트: ${JSON.stringify(t)}`, '중대');
        const stillOnRecord = new URL(page.url()).pathname === '/record';
        ctx.check('제목 없는 저장은 기록을 만들지 않는다', stillOnRecord && (await ctx.records(uid)).length === 0, '저장 시도 후에도 /record 에 머무르고 문서가 없어야 함', '치명');
      }
      await fillTitle(page, d.title);
      if (premium) {
        for (const [ph, text] of Object.entries(d.premium)) await fillByPlaceholder(page, ph, text);
      } else if (i !== 0) {
        await fillSimple(page, d.text);
      }
      if (i === 4) {
        await attachPhotos(page, [testImage('p01-cosmos', 140)]);
        const up = (await ctx.qa()).uploads;
        ctx.check('사진 1장이 업로드 처리된다', up.length >= 1, `업로드 기록 ${up.length}건: ${JSON.stringify(up.map((u) => u.path))}`, '중대');
      }
    });

    // ── 저장 ──
    const useAi = i === 2;
    await ctx.step(`${label} ${useAi ? 'AI 다듬어 저장' : '원본 저장'}`, async () => {
      if (useAi) await saveWithAi(page, 'simple');
      else await saveOriginal(page, premium ? 'premium' : 'simple');
      await waitForSayu(page);
    });

    // ── 저장 결과 검증 ──
    await ctx.step(`${label} 저장 결과 확인`, async () => {
      const recs = await ctx.records(uid);
      ctx.check('기록이 정확히 1건 늘었다', recs.length === before + 1, `이전 ${before}건 → 현재 ${recs.length}건`, '치명');
      before = recs.length;
      const r = recs[recs.length - 1] || recs.find((x) => x.diary_title === d.title);
      const mine = recs.find((x) => x.diary_title === d.title) || r;
      ctx.check('저장 경로가 users/{uid}/records/{날짜}_{시각} 형태다', new RegExp(`^users/${uid}/records/${d.date}_\\d+$`).test(mine.path), mine.path, '치명');
      ctx.check('date 필드가 YYYY-MM-DD 이고 기록한 날과 같다', mine.date === d.date, `date=${mine.date}`, '치명');
      ctx.check('형식이 ["일기"] 로 저장된다', JSON.stringify(mine.formats) === JSON.stringify(['일기']), JSON.stringify(mine.formats), '중대');
      ctx.check('입력한 제목이 그대로 저장된다', mine.diary_title === d.title, `diary_title=${mine.diary_title}`, '중대');
      ctx.check('SAYU 본문(diary_sayu)이 비어 있지 않다', typeof mine.diary_sayu === 'string' && mine.diary_sayu.trim().length > 0, '', '치명');
      if (useAi) {
        ctx.check('AI 다듬기 저장은 polished 표시와 통계가 남는다', mine.diary_polished === true && !!mine.diary_stats, `polished=${mine.diary_polished}, stats=${JSON.stringify(mine.diary_stats)}`, '중대');
        const quota = await page.evaluate(() => Number(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('persona-sim-quota:')) || '') || 0));
        ctx.check('월 AI 한도가 1회 차감된다(0→1/10)', quota === 1, `used=${quota}`, '중대');
      } else {
        ctx.check('원본 저장은 diary_mode 가 ORIGINAL 이다(프리미엄 포함)', mine.diary_mode === 'ORIGINAL', `diary_mode=${mine.diary_mode}`, '경미');
      }
      if (i === 4) {
        let imgs = [];
        try { imgs = JSON.parse(mine.diary_images || '[]'); } catch { /* 아래 check 에서 실패 처리 */ }
        ctx.check('사진 URL 1개가 기록에 저장된다', Array.isArray(imgs) && imgs.length === 1 && /^https?:\/\//.test(imgs[0]), `diary_images=${mine.diary_images}`, '중대');
      }
      if (d.date === '2026-10-07' && d.time === '07:30') {
        // 본문은 "비가 온다"인데 날씨 칸을 건드리지 않았다 → 기본값이 그대로 저장되는지
        if (mine.weather === '쾌청') {
          ctx.finding({
            severity: '제안',
            title: '날씨·체감기온·기분 기본값이 선택하지 않아도 저장된다',
            detail: `본문에 "비가 온다"고 썼지만 날씨 칸을 건드리지 않아 weather="${mine.weather}", temperature="${mine.temperature}", mood="${mine.mood}" 로 저장됨. 목록 화면에도 그대로 표시됨.`,
          });
        }
      }
      // 저장 직후 SAYU 화면의 "관련 AI 비서" 추천이 직업 맥락과 맞는지(교사의 '아이들' → 육아 비서)
      if (i === 0) {
        const text = await pageText(page);
        if (/육아일기로 정리/.test(text)) {
          ctx.finding({
            severity: '제안',
            title: '교사의 학급 일기에 육아일기 변환을 추천한다(맥락 검토 제안)',
            detail: '초등학교 교사가 학급 아이들 이야기를 쓴 일기인데 저장 직후 "HARU 육아·교육 비서 — 감지된 키워드: 아이 → 육아일기로 정리"가 추천됨.',
          });
        }
      }
    });
  }

  // ── 7일 뒤 내 기록 목록 점검 ──
  await ctx.step('7일 뒤 내 기록(SAYU) 목록 점검', async () => {
    await ctx.setDay('2026-10-07', '22:10');
    await page.goto(new URL('/sayu', page.url()).href, { waitUntil: 'load' });
    await page.getByRole('tab', { name: '목록', exact: true }).click();
    await page.locator('section > button').filter({ hasText: /^일기/ }).click();
    await page.waitForTimeout(1500);
    const text = await pageText(page);
    const m = text.match(/이달 결과\s*(\d+)건/);
    ctx.check('내 기록 목록의 "이달 결과"가 실제 저장 건수(8건)와 같다', m && Number(m[1]) === 8, `화면: ${m ? m[0] : '표시 없음'}`, '치명');
    for (const d of DAYS) {
      ctx.check(`목록에 "${d.title}" 제목이 보인다`, text.includes(d.title), '', '중대');
    }
  });
}
