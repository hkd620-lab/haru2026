import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer } from 'firebase/firestore';
import { saveHouseholdEntries, loadHouseholdRecords } from '../src/app/services/householdSaveService.ts';
import { parseHouseholdCardWorkbook } from '../src/app/services/householdCardImport.ts';
import { summarizeHouseholdEntries } from '../src/app/utils/householdSummary.ts';
import { cardOptions, cardWorkbook, cardRow } from './fixtures/householdCardSynthetic.mjs';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!host||!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw new Error('로컬 에뮬레이터만 허용');
const apps=[],run=crypto.randomUUID().slice(0,8);
function client(uid){const app=initializeApp({projectId:'demo-haru-household-dedup',apiKey:'emulator-only'},`card-${apps.length}-${run}`);apps.push(app);const db=getFirestore(app);const[h,p]=host.split(':');connectFirestoreEmulator(db,h,+p,{mockUserToken:{sub:uid,email:`${uid}@example.test`,email_verified:true}});return db;}
after(async()=>{await Promise.all(apps.map(deleteApp));});
const parsed=async(rows=[cardRow()])=>parseHouseholdCardWorkbook(cardWorkbook(rows),XLSX,cardOptions);
test('529건과 예전 단건·메모·분류·본문은 카드 추가와 재가져오기 후 바이트 보존',async()=>{
  const uid=`card-preserve-${run}`,db=client(uid);
  const baseline=Array.from({length:528},(_,i)=>({id:`old-${i}`,date:'2026-09-05',transactionType:'지출',vendor:'합성 기존상점',amount:String(1000+i),category:'사용자 분류',memo:`기존 메모 ${i}\r\n둘째줄`,paymentMethod:'현금'}));
  const old={date:'2026-09-01',household_entries:JSON.stringify(baseline),household_sayu:'사용자 본문\n보존',household_importKeys:['old-receipt']};
  const legacy={date:'2025-08-04',household_type:'지출',household_amount:'1700',household_vendor:'합성 예전가게',household_category:'예전 분류',household_memo:'예전 메모'};
  await setDoc(doc(db,'users',uid,'records','2026-09-01_household'),old);await setDoc(doc(db,'users',uid,'records','legacy'),legacy);
  const result=await parsed(),entries=result.rows.map(r=>r.entry);
  assert.equal((await saveHouseholdEntries(db,uid,entries)).added,1);
  const saved=await loadHouseholdRecords(db,uid);
  assert.equal((await saveHouseholdEntries(db,uid,entries)).already,1);
  assert.deepEqual(await loadHouseholdRecords(db,uid),saved);
  assert.deepEqual((await getDocFromServer(doc(db,'users',uid,'records','2026-09-01_household'))).data(),old);
  assert.deepEqual((await getDocFromServer(doc(db,'users',uid,'records','legacy'))).data(),legacy);
});
test('사용자 수정한 카드 분류·메모는 동일 파일 재가져오기로 덮어쓰지 않는다',async()=>{
  const uid=`card-edited-${run}`,db=client(uid),entries=(await parsed()).rows.map(r=>r.entry);
  await saveHouseholdEntries(db,uid,entries);
  const ref=doc(db,'users',uid,'records','2026-10-01_household'),saved=(await getDocFromServer(ref)).data();
  const edited={...saved,household_entries:JSON.stringify(entries.map(e=>({...e,category:'직접 분류',subcategory:'세부',categorySource:'user',memo:'내 메모\n그대로'})))};
  await setDoc(ref,edited);assert.equal((await saveHouseholdEntries(db,uid,entries)).already,1);
  assert.deepEqual((await getDocFromServer(ref)).data(),edited);
});
test('같은 카드 파일 두 기기 동시 저장은 한 번만 추가한다',async()=>{
  const uid=`card-concurrent-${run}`,a=client(uid),b=client(uid),entries=(await parsed()).rows.map(r=>r.entry);
  const results=await Promise.all([saveHouseholdEntries(a,uid,entries),saveHouseholdEntries(b,uid,entries)]);
  assert.equal(results.reduce((n,r)=>n+r.added,0),1);assert.equal(results.reduce((n,r)=>n+r.already,0),1);
});
test('차단된 외화 행은 강제 전달해도 SDK 저장 거부, 음수 환불 합계 보존',async()=>{
  const uid=`card-blocked-${run}`,db=client(uid),result=await parsed([cardRow({2:'',5:'USD'})]);
  await assert.rejects(saveHouseholdEntries(db,uid,result.rows.map(r=>r.entry)));
  assert.deepEqual(await loadHouseholdRecords(db,uid),[]);
  const good=(await parsed([cardRow(),cardRow({2:-1000,3:'취소'})])).rows.map(r=>r.entry);
  await saveHouseholdEntries(db,uid,good);
  const stored=(await loadHouseholdRecords(db,uid)).flatMap(r=>JSON.parse(r.data.household_entries));
  assert.equal(stored.length,2);assert.equal(summarizeHouseholdEntries(stored).expense,3500);
  assert.doesNotMatch(JSON.stringify(stored),/SYNTHETIC-APPROVAL|4828/);
});
