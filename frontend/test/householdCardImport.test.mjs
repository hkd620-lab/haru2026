import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseHouseholdCardWorkbook, readHouseholdCardFile } from '../src/app/services/householdCardImport.ts';
import { canSelectCardRow, chooseCardCancellation, validateHouseholdImportSave, isCardPaymentCandidate, cardImportCounts, cardImportCompletion } from '../src/app/services/householdImportReview.ts';
import { HouseholdImportGuide } from '../src/app/components/HouseholdImportGuide.tsx';
import { HOUSEHOLD_IMPORT_SOURCES, householdImportKind } from '../src/app/services/householdImportSources.ts';
import { checkHouseholdDuplicates } from '../src/app/services/householdDuplicates.ts';
import { summarizeHouseholdEntries } from '../src/app/utils/householdSummary.ts';
import { parseKakaoBankWorkbook } from '../src/app/services/householdKakaoImport.ts';
import { cardOptions, cardHeader, cardRow, cardWorkbook, cardBytes } from './fixtures/householdCardSynthetic.mjs';
const parse = wb => parseHouseholdCardWorkbook(wb, XLSX, cardOptions);
const record = entries => [{ id: '2026-10-01_household', data: { household_entries: JSON.stringify(entries) } }];

for (const format of ['xlsx', 'xls']) test(`실제 SheetJS ${format} 바이트 읽기와 개인정보 최소화`, async () => {
  const result = await readHouseholdCardFile(cardBytes(cardWorkbook(), format), cardOptions);
  assert.equal(result.rows[0].entry.amount, '4500');
  assert.equal(result.rows[0].entry.memo, '');
  assert.equal(result.rows[0].entry.paymentMethod, '신용카드');
  assert.equal(result.reviews[0].state, 'ok');
  assert.doesNotMatch(JSON.stringify(result.rows), /4828|SYNTHETIC-APPROVAL|ocrSourceFile|approvalNumber/);
  validateHouseholdImportSave(result.rows.map(r => r.entry), result.context, result.reviews, result.rows.map(r => r.id));
});
test('카드 종류·승인이용내역 사전 확인 없이는 파싱하지 않는다', async () => {
  for (const options of [{...cardOptions, confirmedApproval:false}, {...cardOptions, cardType:''}]) await assert.rejects(parseHouseholdCardWorkbook(cardWorkbook(), XLSX, options));
});
for (const amount of ['$12', 'USD 12', '₩1,000', '12.50', 12.5, '1,00', '5천원', '']) test(`모호한 금액 ${JSON.stringify(amount)} 파일 전체 거부`, async () => {
  await assert.rejects(parse(cardWorkbook([cardRow(), cardRow({2:amount})])));
});
for (const [raw,expected] of [['(1,000)','-1000'], ['-1,000원','-1000'], ['1,000','1000']]) test(`원화 정수 ${raw} 부호 보존`, async () => {
  const result=await parse(cardWorkbook([cardRow({2:raw})])); assert.equal(result.rows[0].entry.amount,expected);
});
for (const [key,value] of [['z','[$USD]0'], ['w','$1000'], ['z','#,##0.00']]) test(`숫자 셀 ${key} 서식의 외화·소수 거부`, async () => {
  const wb=cardWorkbook(); wb.Sheets['합성내역'].C2[key]=value; await assert.rejects(parse(wb));
});
for (const date of ['1005','10-05','2026-02-30','2026-10-05 24:00']) test(`연도 누락·잘못된 날짜 ${date} 거부`, async () => {
  await assert.rejects(parse(cardWorkbook([cardRow({0:date})])));
});
test('엑셀 날짜 셀은 연도가 포함된 실제 날짜로 읽는다', async()=>{
  const wb=cardWorkbook(); wb.Sheets['합성내역'].A2={t:'n',v:46300,z:'yyyy-mm-dd'};
  const result=await parse(wb);assert.match(result.rows[0].entry.date,/^2026-/);
});
for (const kind of ['missing-status','billed','duplicate','unknown-status','invalid-vendor','bad-installment','formula']) test(`잘못된 형식 ${kind} 부분 가져오기 금지`, async()=>{
  let header=[...cardHeader], rows=[cardRow(),cardRow()];
  if(kind==='missing-status')header[3]='알수없는열';
  if(kind==='billed')header.push('이번달 결제금액');
  if(kind==='duplicate')header.push('이용금액');
  if(kind==='unknown-status')rows[1][3]='확인안된상태';
  if(kind==='invalid-vendor')rows[1][1]='';
  if(kind==='bad-installment')rows[1][4]='1/3회차';
  const wb=cardWorkbook(rows,header);if(kind==='formula')wb.Sheets['합성내역'].C3.f='1000+3500';
  await assert.rejects(parse(wb));
});
test('합계는 날짜 없는 명시 합계 행만 제외, 가맹점 이름의 건수·합계는 보존',async()=>{
  const result=await parse(cardWorkbook([cardRow({1:'3건 합계상점'}),['','합계',4500]]));assert.equal(result.rows.length,1);
});
test('외화와 취소양수는 기본 미선택·금액비움, 음수 취소와 할부 원금은 보존',async()=>{
  const result=await parse(cardWorkbook([cardRow({5:'USD',2:''}),cardRow({3:'취소'}),cardRow({2:'(1000)',3:'취소'}),cardRow({2:30000,4:'3개월'})]));
  assert.deepEqual(result.reviews.map(r=>r.state),['blocked','needsChoice','ok','ok']);
  assert.deepEqual(result.rows.map(r=>r.selected),[false,false,true,true]);
  assert.deepEqual(result.rows.map(r=>r.entry.amount),['','','-1000','30000']);
  assert.match(result.rows[3].warning,/구매 전체금액/);
  const selected=result.rows.filter(r=>r.selected);validateHouseholdImportSave(selected.map(r=>r.entry),result.context,result.reviews,selected.map(r=>r.id));
  const counts=cardImportCounts(result.rows,result.reviews,[]);assert.match(cardImportCompletion(counts),/읽은 전체 4건.*저장 선택 2건.*외화 제외 1건.*확인필요 1건.*이미 저장됨 0건.*직접 입력 필요 1건/);
});
test('취소 선택과 실제 선택 행·기대 금액의 저장 검증을 우회할 수 없다',async()=>{
  const result=await parse(cardWorkbook([cardRow({3:'취소'})]));const row=result.rows[0],review=result.reviews[0];
  const validate=(entry,ctx=result.context,reviews=[review],ids=[row.id])=>validateHouseholdImportSave([entry],ctx,reviews,ids);
  assert.equal(canSelectCardRow(review),false);assert.throws(()=>validate(row.entry));
  const negative=chooseCardCancellation(review,'negative'),entry={...row.entry,amount:'-4500'};
  validate(entry,result.context,[negative]);
  for(const bad of [{...entry,amount:'4500'},{...entry,paymentMethod:'체크카드'},{...entry,memo:'변조'},{...entry,importSource:{...entry.importSource,fileDigest:'other'}}]) assert.throws(()=>validate(bad,result.context,[negative]));
  assert.throws(()=>validate(entry,null,[negative]));assert.throws(()=>validate(entry,result.context,[]));assert.throws(()=>validate(entry,result.context,[negative],[]));
  assert.throws(()=>validate({...entry,importSource:undefined},result.context,[negative]));
  assert.throws(()=>validate(entry,{...result.context,cardType:''},[negative]));
  assert.throws(()=>validate(entry,result.context,[chooseCardCancellation(review,'exclude')]));
  assert.equal(canSelectCardRow(chooseCardCancellation(review,'exclude')),false);
  assert.equal(cardImportCounts([row],[review],[row.id]).pending,0);
});
test('같은 파일 재가져오기·정상반복·다른 파일 기간겹침을 구분한다',async()=>{
  const a=await parse(cardWorkbook([cardRow(),cardRow()])),b=await parse(cardWorkbook([cardRow(),cardRow()]));
  assert.notEqual(a.rows[0].id,a.rows[1].id);assert.deepEqual(a.rows.map(r=>r.id),b.rows.map(r=>r.id));
  assert.deepEqual((await checkHouseholdDuplicates(a.rows.map(r=>r.entry),[])).map(r=>r.status),['new','new']);
  assert.deepEqual((await checkHouseholdDuplicates(b.rows.map(r=>r.entry),record(a.rows.map(r=>r.entry)))).map(r=>r.status),['already','already']);
  const c=await parse(cardWorkbook([cardRow(),cardRow({0:'2026-10-06'})]));
  assert.equal((await checkHouseholdDuplicates(c.rows.map(r=>r.entry),record(a.rows.map(r=>r.entry))))[0].status,'suspect');
});
test('카드와 은행 체크카드 거래는 확인만 요구하고 카카오 파서·합계는 불변',async()=>{
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['','2026.10.05 12:00:00','출금',-4500,100000,'체크카드결제','합성 카페']]),'거래');
  const bank=await parseKakaoBankWorkbook(wb,XLSX,'합성.xlsx');const frozen=JSON.stringify(bank.rows);
  validateHouseholdImportSave(bank.rows.map(r=>r.entry),null,[],[]);
  assert.equal(isCardPaymentCandidate(bank.rows[0].entry,false),false);
  const candidate={...bank.rows[0].entry,vendor:'KB 국민카드'};const before=JSON.stringify(candidate);
  assert.equal(isCardPaymentCandidate(candidate,false),true);assert.equal(isCardPaymentCandidate(candidate,true),false);assert.equal(JSON.stringify(candidate),before);
  const card=await parse(cardWorkbook());assert.equal((await checkHouseholdDuplicates(card.rows.map(r=>r.entry),record(bank.rows.map(r=>r.entry))))[0].status,'suspect');
  assert.equal(JSON.stringify(bank.rows),frozen);assert.equal(summarizeHouseholdEntries(bank.rows.map(r=>r.entry)).expense,4500);
});
test('카드 경로는 PDF·빈파일·암호용 CFB 오류를 서버전송 없이 거부한다',async()=>{
  for(const bytes of [new Uint8Array(),new TextEncoder().encode('%PDF fake'),new Uint8Array([0xd0,0xcf,0x11,0xe0,0,0,0,0])])await assert.rejects(readHouseholdCardFile(bytes,cardOptions));
});
test('7기관 안내와 실제 파서 가능 여부를 구분한다',()=>{
  assert.equal(HOUSEHOLD_IMPORT_SOURCES.length,7);
  for(const item of HOUSEHOLD_IMPORT_SOURCES){
    const markup=renderToStaticMarkup(React.createElement(HouseholdImportGuide,{sourceId:item.id,onChange:()=>{},disabled:false}));
    assert.match(markup,/2026-10-29/);
    if(item.status==='guide'){assert.equal(householdImportKind(item.id),null);assert.match(markup,/이 은행 파일은 아직 읽지 않습니다/);assert.match(markup,/① 공식 공개 메뉴/);assert.match(markup,/② 로그인 뒤 확인 전 단계/);}
    if(item.id==='kbcard')assert.match(markup,/지원을 보장하지 않습니다/);
    if(item.id==='kakaobank'){assert.match(markup,/FaqView\/view\/9413/);assert.match(markup,/service-transaction-statement/);}
  }
});

for(const format of ['"CNY "#,##0','"CAD "#,##0','"CHF "#,##0','"₹"#,##0']) test(`실제 XLSX 숫자 셀의 미지원 외화 서식 ${format} 거부`,async()=>{
  const wb=cardWorkbook();wb.Sheets['합성내역'].C2.z=format;
  await assert.rejects(readHouseholdCardFile(cardBytes(wb),cardOptions));
});
for(const format of ['General','0','mm-dd']) test(`숫자 월일 1005를 ${format} 서식에서 연도 있는 날짜로 추정하지 않는다`,async()=>{
  const wb=cardWorkbook();wb.Sheets['합성내역'].A2={t:'n',v:1005,z:format};
  await assert.rejects(readHouseholdCardFile(cardBytes(wb),cardOptions));
});
for(const currency of ['KRW','원','원화']) test(`통화 ${currency}와 해외이용금액 0은 정상 원화로 읽는다`,async()=>{
  const wb=cardWorkbook([cardRow({5:currency})],[...cardHeader,'해외이용금액']);wb.Sheets['합성내역'].I2={t:'n',v:0};wb.Sheets['합성내역']['!ref']='A1:I2';
  const result=await readHouseholdCardFile(cardBytes(wb),cardOptions);
  assert.equal(result.reviews[0].state,'ok');assert.equal(result.rows[0].entry.amount,'4500');assert.equal(result.rows[0].selected,true);
});
