import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseKakaoBankPdfDocument } from '../src/app/services/householdKakaoPdfImport.ts';

const text=(str,x,y,width=30)=>({str,transform:[1,0,0,1,x,y],width,height:8});
const headers=()=>['거래일시','구분','거래금액','거래 후 잔액','거래내용(메모)','거래구분'].map((s,i)=>text(s,[60,132,192,285,397,512][i],700));
const row=(y=670)=>['2026.10.05 12:34:56','출금','-4,500','100,000','시험 카페','체크카드결제'].map((s,i)=>text(s,[36,131,210,305,363,503][i],y,i===0?73:30));
function document(pages){let cleaned=0;return{numPages:pages.length,getPage:async n=>({getTextContent:async()=>({items:pages[n-1]}),cleanup(){cleaned++;}}),get cleaned(){return cleaned;}};}
const page=()=>[text('카카오뱅크',28,780),text('예금주 :',28,750),text('시험사용자',80,750),...headers(),...row()];

test('실제 PDF.js로 합성 PDF 두 쪽을 읽고 월·수입/지출·본인이체를 매핑한다',async()=>{
 const parse=async name=>{const task=getDocument({data:new Uint8Array(fs.readFileSync(new URL('./fixtures/household-synthetic.pdf',import.meta.url))),isEvalSupported:false,verbosity:0});try{return await parseKakaoBankPdfDocument(await task.promise,name);}finally{await task.destroy();}};
 const a=await parse('내역.pdf'),b=await parse('이름변경.pdf');
 assert.equal(a.rows.length,2);assert.equal(a.rows[0].entry.amount,'4500');assert.equal(a.rows[0].entry.transactionType,'지출');
 assert.equal(a.rows[1].entry.transactionType,'이체');assert.equal(a.rows[1].entry.date,'2026-11-01');
 assert.equal(a.rows[0].entry.paymentMethod,'체크카드');assert.equal(a.rows[0].entry.transactionAt,'2026-10-05 12:34:56');
 assert.deepEqual(a.rows.map(r=>r.id),b.rows.map(r=>r.id));assert.ok(a.rows.every(r=>!r.warning));
});

test('텍스트 내부 순서가 뒤섞여도 표 위치로 반복 거래를 각각 보존한다',async()=>{
 const doc=document([[...page(),...row(644)].reverse()]);
 const result=await parseKakaoBankPdfDocument(doc,'합성.pdf');
 assert.equal(result.rows.length,2);assert.notEqual(result.rows[0].id,result.rows[1].id);assert.equal(doc.cleaned,1);
});

test('금액·날짜·구분 열 누락은 앞쪽 정상 거래까지 부분 가져오지 않는다',async()=>{
 for(const broken of [row().filter((_,i)=>i!==1),row().map((r,i)=>i===2?{...r,str:'읽기 실패'}:r),row().map((r,i)=>i===0?{...r,str:'2026.02.30 12:00:00'}:r)]){
  const doc=document([page(),[...headers(),...broken]]);
  await assert.rejects(parseKakaoBankPdfDocument(doc,'손상.pdf'));assert.equal(doc.cleaned,2);
 }
});

test('스캔 PDF·타 은행·알 수 없는 표와 지나치게 긴 자료는 저장 전 거부한다',async()=>{
 await assert.rejects(parseKakaoBankPdfDocument(document([[]]),'스캔.pdf'),/스캔/);
 await assert.rejects(parseKakaoBankPdfDocument(document([page().filter(r=>r.str!=='카카오뱅크')]),'다른은행.pdf'),/카카오뱅크/);
 await assert.rejects(parseKakaoBankPdfDocument({numPages:201},'긴자료.pdf'),/200쪽/);
});

test('줄바꿈된 거래처를 다음 거래와 섞지 않고 읽는다',async()=>{
 const doc=document([[...page(),text('두번째줄',363,663),...row(644)]]);
 const result=await parseKakaoBankPdfDocument(doc,'줄바꿈.pdf');
 assert.equal(result.rows[0].entry.vendor,'시험 카페 두번째줄');assert.equal(result.rows[1].entry.vendor,'시험 카페');
});

test('예금주와 같은 줄에 다른 정보가 있어도 이름에 계좌번호를 합치지 않는다',async()=>{
 const items=page().map(item=>item.str==='출금'?{...item,str:'입금'}:item.str==='-4,500'?{...item,str:'+4,500'}:item.str==='시험 카페'?{...item,str:'시험사용자'}:item);
 const doc=document([[...items,text('계좌번호 :',250,750),text('0000-00-0000000',350,750)]]);
 const result=await parseKakaoBankPdfDocument(doc,'합성.pdf');assert.equal(result.rows[0].entry.transactionType,'이체');
});
