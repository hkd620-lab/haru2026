import { openApp, openFormatFromHome, fillTitle, pageText } from '../runner/driver.mjs';
export const meta = {
  id: 'p11-household', format: 'HARU가계부',
  persona: { name: '이민준', age: 41, gender: '남', job: '회사원', goal: '수입·생활비·이체를 구분해 일주일 지출을 확인한다.' },
  identity: { uid: 'qa-p11-lee-minjun', displayName: '이민준', email: 'p11@example.invalid', plan: 'free' },
  scenario: ['7일 7개 기록/8거래: 필수값 누락, 지출·수입·이체, 다건 거래, 직접 쓴 제목, 지난 날짜 거래, 재접속 합계'],
};
const days = [
  [{type:'지출',amount:'23,500',vendor:'동네마트',category:'식비'}],
  [{type:'수입',amount:'3000000',vendor:'가상회사',category:'월급'}],
  [{type:'이체',amount:'500000',memo:'급여통장 → 생활비통장'}],
  [{type:'지출',amount:'1500',vendor:'버스',category:'교통비'},{type:'지출',amount:'4500',vendor:'동네카페',category:'식비'}],
  [{type:'지출',amount:'12000',vendor:'가상서점',category:'문화생활'}],
  [{type:'지출',amount:'3900',vendor:'동네편의점',category:'식비'}],
  [{type:'지출',amount:'18000',vendor:'동네식당',category:'식비',date:'2026.10.06'}],
];
async function openForm(page) {
  await openApp(page); await openFormatFromHome(page, 'HARU가계부');
  await page.getByRole('button', {name:'새 기록 추가',exact:true}).click();
  await page.getByPlaceholder('50000').first().waitFor();
}
export async function run(ctx) {
  const { page } = ctx;
  for (let i=0;i<7;i++) {
    const date=`2026-10-0${i+1}`, title=`민준 생활비 ${i+1}`;
    await ctx.setDay(date);
    await ctx.step(`${i+1}일차 거래 작성`, async () => {
      await openForm(page);
      await fillTitle(page,title);
      if(i===0) {
        await page.getByRole('button',{name:'거래 저장하기 (1건)',exact:true}).click();
        await page.waitForTimeout(300);
        ctx.check('빈 금액 저장 차단', (await ctx.records(meta.identity.uid)).length===0 && (await ctx.toasts()).some(t=>t.includes('금액이 비어')), JSON.stringify(await ctx.toasts()), '치명');
        await page.getByPlaceholder('50000').fill('23500');
        await page.getByRole('button',{name:'거래 저장하기 (1건)',exact:true}).click();
        await page.waitForTimeout(300);
        ctx.check('사용처 없는 지출 차단', (await ctx.records(meta.identity.uid)).length===0 && (await ctx.toasts()).some(t=>t.includes('사용처가 비어')), JSON.stringify(await ctx.toasts()), '치명');
      }
      for(let j=0;j<days[i].length;j++) {
        const e=days[i][j];
        if(j) await page.getByRole('button',{name:'+ 거래 추가',exact:true}).click();
        // 거래 카드 안에서만 버튼·입력 요소를 찾는다.
        const card=page.getByPlaceholder('50000').nth(j).locator('xpath=../../..');
        await card.getByRole('button',{name: e.type==='수입'?'💰 수입':e.type==='이체'?'🔄 이체':'📤 지출',exact:true}).click();
        await card.getByPlaceholder('2026.06.25').fill(e.date || date.replaceAll('-','.'));
        await card.getByPlaceholder('50000').fill(e.amount);
        if(e.type!=='이체') {
          await card.getByPlaceholder(e.type==='수입'?'회사명, 거래처, 출처 등':'마트, 편의점, 카페 등').fill(e.vendor);
          await card.getByRole('button',{name:e.category,exact:true}).click();
          await card.getByRole('button',{name:'체크카드',exact:true}).click();
        } else await card.getByPlaceholder('어디서 → 어디로 (예: 급여통장 → 생활비통장)').fill(e.memo);
      }
    });
    await ctx.step(`${i+1}일차 거래 저장·검증`, async () => {
      await page.getByRole('button',{name:`거래 저장하기 (${days[i].length}건)`,exact:true}).click();
      await page.waitForFunction(({uid,count})=>window.__qa.dumpDb().filter(([p])=>p.startsWith(`users/${uid}/records/`)).length===count,{uid:meta.identity.uid,count:i+1});
      await page.waitForTimeout(500);
      const recs=await ctx.records(meta.identity.uid), r=recs.find(x=>x.date===date);
      ctx.check('기록 수·형식 보존', recs.length===i+1 && r?.formats?.includes('HARU가계부'), `count=${recs.length},formats=${JSON.stringify(r?.formats)}`, '치명');
      ctx.check('사용자 입력 제목 보존', r?.household_title===title, `입력=${title}, 저장=${r?.household_title}`, '중대');
      const entries=JSON.parse(r?.household_entries || '[]');
      ctx.check('다건 거래 개수 보존', entries.length===days[i].length, `actual=${entries.length}`, '치명');
      days[i].forEach((e,j)=>ctx.check(`거래 ${j+1} 값 보존`, entries[j]?.transactionType===e.type && entries[j]?.amount===e.amount && entries[j]?.date===(e.date||date.replaceAll('-','.')), JSON.stringify(entries[j]), '중대'));
      ctx.check('가계부 본문 생성', !!r?.household_sayu, r?.household_sayu || '', '중대');
    });
  }
  await ctx.step('가계부 재접속·월 합계 확인',async()=>{
    await openApp(page); await openFormatFromHome(page,'HARU가계부');
    await page.waitForTimeout(1000);
    const text=await pageText(page);
    for(const amount of ['3,000,000','500,000','63,400']) ctx.check(`월 합계 ${amount} 표시`,text.includes(amount),text,'중대');
    ctx.check('새로고침 뒤 7개 기록 보존',(await ctx.records(meta.identity.uid)).length===7,'','치명');
  });
}
