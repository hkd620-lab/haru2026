import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseKakaoBankWorkbook } from '../src/app/services/householdKakaoImport.ts';
import { checkHouseholdDuplicates, householdDate } from '../src/app/services/householdDuplicates.ts';
import { HouseholdDuplicateReview } from '../src/app/components/HouseholdDuplicateReview.tsx';

const bankRow = (time = '2026.10.05 12:34:56', amount = '4,500') => ['', time, '출금', amount, '100000', '체크카드결제', '시험 카페', ''];
const parse = (rows, name = '내역.xlsx') => parseKakaoBankWorkbook({ SheetNames: ['내역'], Sheets: { 내역: rows } }, { utils: { sheet_to_json: sheet => sheet } }, name);
const record = entries => ({id:'old',data:{household_entries:JSON.stringify(entries)}});

test('같은 파일의 이름을 바꿔도 출처 키가 같고 원본 시각을 보존한다', async () => {
  const a=await parse([bankRow()]); const b=await parse([bankRow()], '이름변경.xlsx');
  assert.equal(a.rows[0].id,b.rows[0].id);
  assert.equal(a.rows[0].entry.importSource.key,b.rows[0].entry.importSource.key);
  assert.equal(a.rows[0].entry.transactionAt,'2026-10-05 12:34:56');
  assert.match(a.rows[0].entry.importSource.fileDigest,/^[a-f0-9]{64}$/);
  const checks=await checkHouseholdDuplicates(b.rows.map(r=>r.entry),[record(a.rows.map(r=>r.entry))]);
  assert.equal(checks[0].status,'already');
});

test('파일 안의 완전히 같은 반복 결제 행도 각각 보존한다', async () => {
  const result=await parse([bankRow(),bankRow()]);
  assert.notEqual(result.rows[0].id,result.rows[1].id);
  const checks=await checkHouseholdDuplicates(result.rows.map(r=>r.entry),[]);
  assert.deepEqual(checks.map(c=>c.status),['new','new']);
});

test('기간이 겹치는 다른 파일은 확정 중복이 아닌 의심으로 비교한다', async () => {
  const a=await parse([bankRow()]); const b=await parse([bankRow(),bankRow('2026.10.06 09:00:00')]);
  const checks=await checkHouseholdDuplicates(b.rows.map(r=>r.entry),[record(a.rows.map(r=>r.entry))]);
  assert.deepEqual(checks.map(c=>c.status),['suspect','new']);
});

test('수동 입력과 은행 거래는 사용처·유형이 달라도 같은 날 금액이 같으면 확인한다', async () => {
  const result=await parse([bankRow()]);
  const manual={...result.rows[0].entry,id:'manual',date:'2026.10.05',vendor:'카페',importSource:undefined};
  const [check]=await checkHouseholdDuplicates(result.rows.map(r=>r.entry),[record([manual])]);
  assert.equal(check.status,'suspect'); assert.equal(check.matches[0].entry.vendor,'카페');
  const markup=renderToStaticMarkup(React.createElement(HouseholdDuplicateReview,{checks:[check],decisions:{},onChoose(){}}));
  assert.match(markup,/기존 거래 사용/); assert.match(markup,/별개 거래로 추가/);
  assert.match(markup,/선택하기 전에는 저장하지 않습니다/);
  assert.doesNotMatch(markup,/aria-pressed="true"/);
});

test('금액 표기는 정규화하고 기존 필드가 바뀌면 확인 토큰을 갱신한다', async () => {
  const result=await parse([bankRow()]);
  const manual={...result.rows[0].entry,id:'manual',amount:'4천5백원',importSource:undefined};
  const [a]=await checkHouseholdDuplicates(result.rows.map(r=>r.entry),[record([manual])]);
  const [b]=await checkHouseholdDuplicates(result.rows.map(r=>r.entry),[record([{...manual,memo:'수정한 메모'}])]);
  assert.equal(a.status,'suspect'); assert.notEqual(a.token,b.token);
});

test('잘못된 날짜와 손상된 기존 내역은 조용히 저장하지 않는다', async () => {
  for(const date of ['2026.02.30','2026.13.01','날짜없음']) assert.throws(()=>householdDate(date));
  await assert.rejects(checkHouseholdDuplicates([], [{id:'broken',data:{household_entries:'잘못된 JSON'}}]));
});

test('비교 후보가 없어진 거래에서는 기존 거래 사용을 선택할 수 없다',async()=>{
 const entry=(await parse([bankRow()])).rows[0].entry;
 const markup=renderToStaticMarkup(React.createElement(HouseholdDuplicateReview,{checks:[{entry,status:'suspect',matches:[],token:'changed'}],decisions:{},onChoose(){}}));
 assert.match(markup,/<button[^>]*disabled=""[^>]*>기존 거래 사용<\/button>/);
 assert.match(markup,/이전에 비교한 거래가 변경됐습니다/);
});
