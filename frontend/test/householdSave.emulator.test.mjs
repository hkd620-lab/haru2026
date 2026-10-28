// FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, getDocsFromServer, collection } from 'firebase/firestore';
import { saveHouseholdEntries, loadHouseholdRecords, householdMonthRecordId } from '../src/app/services/householdSaveService.ts';
import { checkHouseholdDuplicates, HouseholdDuplicateReviewRequired } from '../src/app/services/householdDuplicates.ts';
import { summarizeHouseholdEntries } from '../src/app/utils/householdSummary.ts';

const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('로컬 Firestore 에뮬레이터에서만 실행할 수 있습니다.');
const projectId='demo-haru-household-dedup', apps=[];
const runId=crypto.randomUUID().slice(0,8);
const uidFor=name=>`${name}-${runId}`;
function client(uid) { const app=initializeApp({projectId,apiKey:'emulator-only'},`household-${uid}-${apps.length}`); apps.push(app); const db=getFirestore(app); const [hostname,port]=host.split(':'); connectFirestoreEmulator(db,hostname,Number(port),{mockUserToken:{sub:uid,email:`${uid}@example.test`,email_verified:true}}); return db; }
after(async()=>{await Promise.all(apps.map(deleteApp));});
const entry=(overrides={})=>({id:crypto.randomUUID(),date:'2026-10-05',transactionType:'지출',amount:'4500',vendor:'시험 카페',category:'식비',paymentMethod:'체크카드',memo:'기존 메모',...overrides});
const bank=(overrides={})=>entry({id:'bank-row-1',importSource:{kind:'kakao',fileDigest:'file-a',key:'kakao:key-a'},transactionAt:'2026-10-05 12:00:00',...overrides});
async function stored(db,uid) {return (await getDocFromServer(doc(db,'users',uid,'records',householdMonthRecordId('2026-10-05')))).data();}
async function choose(db,uid,entries,action='skip') {const checks=await checkHouseholdDuplicates(entries,await loadHouseholdRecords(db,uid)); return Object.fromEntries(checks.filter(c=>c.status==='suspect').map(c=>[c.entry.id,{token:c.token,action}]));}

test('동일 파일 재저장·응답 유실 후 재시도에도 한 번만 집계',async()=>{
 const uid=uidFor('retry'),db=client(uid),entries=[bank()];
 assert.equal((await saveHouseholdEntries(db,uid,entries)).added,1);
 const before=await stored(db,uid);
 assert.equal((await saveHouseholdEntries(db,uid,entries)).already,1);
 assert.deepEqual(await stored(db,uid),before);
 assert.equal(summarizeHouseholdEntries(JSON.parse(before.household_entries)).expense,4500);
});

test('수동 입력 뒤 은행 가져오기는 확인 전 전체 미저장, 기존 거래 사용 후 재가져오기 제외',async()=>{
 const uid=uidFor('manual-bank'),db=client(uid),manual=entry({id:'manual-1'}),incoming=bank();
 await saveHouseholdEntries(db,uid,[manual]); const before=await stored(db,uid);
 await assert.rejects(saveHouseholdEntries(db,uid,[incoming]),HouseholdDuplicateReviewRequired);
 assert.deepEqual(await stored(db,uid),before);
 const result=await saveHouseholdEntries(db,uid,[incoming],await choose(db,uid,[incoming]));
 assert.equal(result.skipped,1); assert.equal(result.added,0);
 assert.equal((await stored(db,uid)).household_entries,before.household_entries);
 assert.equal((await saveHouseholdEntries(db,uid,[incoming])).already,1);
});

test('은행 가져오기 뒤 수동 입력도 중복 확인하고 별개 거래 선택은 실제로 추가한다',async()=>{
 const uid=uidFor('bank-manual'),db=client(uid),incoming=entry({id:'manual'});
 await saveHouseholdEntries(db,uid,[bank()]);
 await assert.rejects(saveHouseholdEntries(db,uid,[incoming]),HouseholdDuplicateReviewRequired);
 const result=await saveHouseholdEntries(db,uid,[incoming],await choose(db,uid,[incoming],'keep'));
 assert.equal(result.added,1);
 assert.equal(JSON.parse((await stored(db,uid)).household_entries).length,2);
 assert.equal((await saveHouseholdEntries(db,uid,[incoming])).already,1);
});

test('같은 파일의 동일 금액 반복 행은 두 건 모두 보존한다',async()=>{
 const uid=uidFor('repeated'),db=client(uid),entries=[bank(),bank({id:'bank-row-2',importSource:{kind:'kakao',fileDigest:'file-a',key:'kakao:key-b'}})];
 assert.equal((await saveHouseholdEntries(db,uid,entries)).added,2);
 assert.equal((await saveHouseholdEntries(db,uid,entries)).already,2);
 assert.equal(JSON.parse((await stored(db,uid)).household_entries).length,2);
});

test('서로 다른 두 클라이언트에서 같은 파일 동시 저장 시 중복·유실 없음',async()=>{
 const uid=uidFor('concurrent'),a=client(uid),b=client(uid),entries=[bank()];
 const results=await Promise.all([saveHouseholdEntries(a,uid,entries),saveHouseholdEntries(b,uid,entries)]);
 assert.equal(results.reduce((sum,r)=>sum+r.added,0),1);
 assert.equal(results.reduce((sum,r)=>sum+r.already,0),1);
 assert.equal(JSON.parse((await stored(a,uid)).household_entries).length,1);
});

test('동시 저장의 서로 다른 신규 거래는 모두 보존한다',async()=>{
 const uid=uidFor('concurrent-distinct'),a=client(uid),b=client(uid);
 await Promise.all([saveHouseholdEntries(a,uid,[entry({amount:'1000'})]),saveHouseholdEntries(b,uid,[entry({amount:'2000'})])]);
 assert.equal(JSON.parse((await stored(a,uid)).household_entries).length,2);
});

test('기존 월별·단건 문서의 거래와 다른 기록 형식은 보존하고 확인 메타데이터만 추가한다',async()=>{
 const uid=uidFor('legacy'),db=client(uid),ref=doc(db,'users',uid,'records','old-record');
 const original={date:'2026-10-01',formats:['HARU가계부','일기'],diary_sayu:'보존할 일기',household_date:'2026.10.05',household_type:'지출',household_amount:'4500',household_vendor:'시험 카페',household_memo:'수정해 둔 메모'};
 await setDoc(ref,original);
 const incoming=bank(); const result=await saveHouseholdEntries(db,uid,[incoming],await choose(db,uid,[incoming]));
 assert.equal(result.skipped,1);
 const after=(await getDocFromServer(ref)).data();
 const {household_importKeys,...rest}=after; assert.deepEqual(rest,original);
 assert.equal(household_importKeys.length,1);
 assert.equal((await getDocsFromServer(collection(db,'users',uid,'records'))).size,1,'빈 영수증용 기록을 만들지 않는다');
});

test('미리보기 이후 기존 메모 변경은 낡은 선택으로 저장하지 않는다',async()=>{
 const uid=uidFor('stale'),db=client(uid); await saveHouseholdEntries(db,uid,[entry({id:'manual'})]);
 const incoming=bank(),decisions=await choose(db,uid,[incoming]); const ref=doc(db,'users',uid,'records',householdMonthRecordId(incoming.date));
 const before=(await getDocFromServer(ref)).data(); const changed=JSON.parse(before.household_entries); changed[0].memo='다른 기기에서 수정';
 await setDoc(ref,{household_entries:JSON.stringify(changed)},{merge:true});
 await assert.rejects(saveHouseholdEntries(db,uid,[incoming],decisions),HouseholdDuplicateReviewRequired);
 assert.equal(JSON.parse((await stored(db,uid)).household_entries).length,1);
});

test('여러 달 중 한 건이라도 미확인 중복이면 모두 미저장, 선택 후 한 번에 반영',async()=>{
 const uid=uidFor('months'),db=client(uid); await saveHouseholdEntries(db,uid,[entry({id:'manual'})]);
 const entries=[bank(),entry({date:'2026-11-01',amount:'9000'})];
 await assert.rejects(saveHouseholdEntries(db,uid,entries),HouseholdDuplicateReviewRequired);
 assert.equal((await getDocFromServer(doc(db,'users',uid,'records',householdMonthRecordId('2026-11-01')))).exists(),false);
 const result=await saveHouseholdEntries(db,uid,entries,await choose(db,uid,entries));
 assert.equal(result.added,1); assert.equal(result.skipped,1);
 const retry=await saveHouseholdEntries(db,uid,entries); assert.equal(retry.already,2);
});

test('권한 실패는 빈 기존 내역으로 간주하지 않고 저장 전체를 차단한다',async()=>{
 const db=client('not-owner');
 await assert.rejects(saveHouseholdEntries(db,'another-owner',[bank()]),error=>error.code==='permission-denied');
});

test('사용자가 수정한 은행 거래는 같은 원본을 다시 가져와도 덮어쓰지 않는다',async()=>{
 const uid=uidFor('corrected'),db=client(uid),incoming=bank();
 await saveHouseholdEntries(db,uid,[incoming]);
 const ref=doc(db,'users',uid,'records',householdMonthRecordId(incoming.date));
 const data=(await getDocFromServer(ref)).data(),rows=JSON.parse(data.household_entries);
 rows[0].category='문화생활';rows[0].memo='내가 수정한 메모';rows[0].amount='4200';
 await setDoc(ref,{household_entries:JSON.stringify(rows),household_title:'보존할 제목',household_sayu:'보존할 사용자 본문'},{merge:true});
 const before=(await getDocFromServer(ref)).data();
 assert.equal((await saveHouseholdEntries(db,uid,[incoming])).already,1);
 assert.deepEqual((await getDocFromServer(ref)).data(),before);
 await saveHouseholdEntries(db,uid,[entry({amount:'9000'})]);
 const after=(await getDocFromServer(ref)).data();
 assert.equal(after.household_title,'보존할 제목');
 assert.ok(after.household_sayu.startsWith('보존할 사용자 본문\n\n'));
 assert.deepEqual(JSON.parse(after.household_entries)[0],rows[0]);
});

test('월 저장 문서에 다른 형식이 있어도 해당 내용과 형식 목록을 보존한다',async()=>{
 const uid=uidFor('formats'),db=client(uid),ref=doc(db,'users',uid,'records',householdMonthRecordId('2026-10-05'));
 await setDoc(ref,{date:'2026-10-01',formats:['일기'],diary_sayu:'보존할 기록'});
 await saveHouseholdEntries(db,uid,[bank()]);
 const data=(await getDocFromServer(ref)).data();
 assert.equal(data.diary_sayu,'보존할 기록');
 assert.deepEqual(data.formats,['일기','HARU가계부']);
});

test('한 번에 입력한 수동 거래끼리 겹쳐 하나를 제외해도 재시도 시 모두 처리 완료로 인식한다',async()=>{
 const uid=uidFor('within-batch'),db=client(uid),entries=[entry({id:'first'}),entry({id:'second'})];
 const checks=await checkHouseholdDuplicates(entries,[]),check=checks[1];
 assert.equal(check.status,'suspect');
 const result=await saveHouseholdEntries(db,uid,entries,{second:{token:check.token,action:'skip'}});
 assert.equal(result.added,1);assert.equal(result.skipped,1);
 assert.equal((await saveHouseholdEntries(db,uid,entries)).already,2);
});

test('비교한 거래의 금액이 바뀌어 후보에서 빠져도 낡은 선택을 무시하고 추가하지 않는다',async()=>{
 const uid=uidFor('changed-amount'),db=client(uid);await saveHouseholdEntries(db,uid,[entry({id:'manual'})]);
 const incoming=bank(),decisions=await choose(db,uid,[incoming]);
 const ref=doc(db,'users',uid,'records',householdMonthRecordId(incoming.date));
 const data=(await getDocFromServer(ref)).data(),rows=JSON.parse(data.household_entries);rows[0].amount='4200';
 await setDoc(ref,{household_entries:JSON.stringify(rows)},{merge:true});
 let current;
 await assert.rejects(saveHouseholdEntries(db,uid,[incoming],decisions),error=>{current=error.checks?.[0];return error instanceof HouseholdDuplicateReviewRequired;});
 assert.equal((await allEntries()).length,1);
 const result=await saveHouseholdEntries(db,uid,[incoming],{[incoming.id]:{token:current.token,action:'skip'}});
 assert.equal(result.added,0);assert.equal(result.skipped,1);
 async function allEntries(){return JSON.parse((await stored(db,uid)).household_entries);}
});
