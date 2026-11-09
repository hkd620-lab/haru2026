const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./aiLibraryClassificationSource');
const {createClassificationService, assertClassificationContext} = load('aiLibraryClassificationService');
const context = {uid:'synthetic-owner', email:'hkd620@gmail.com',emailVerified:true,origin:'https://haru2026.com'};
test('auth, origin, route and unconfigured transport deny before any database/record/key access',async()=>{
 let dbReads=0;const service=createClassificationService({db(){dbReads++;throw Error('unexpected')}});
 for (const c of [{...context,uid:undefined},{...context,emailVerified:false},{...context,email:'other@example.com'},...['http://localhost:5173','https://preview.web.app',undefined,'https://haru2026.com.evil'].map(origin=>({...context,origin}))]) await assert.rejects(service(c,{action:'prepare'}));
 await assert.rejects(service(context,{action:'unknown'}));
 await assert.rejects(service(context,{action:'prepare',scope:'all'}),/server_unconfigured/);
 assert.deepEqual(await service(context,{action:'capability'}),{enabled:false,reason:'server_unconfigured'});assert.equal(dbReads,0);
});
test('emulator opt-in rejects non-demo projects and remote hosts',()=>{
 for(const emulator of [{projectId:'haru2026-8abb8',host:'127.0.0.1:8080'},{projectId:'demo-test',host:'remote:8080'},{projectId:'demo-test',host:'127.0.0.1.evil:8080'}]) assert.throws(()=>assertClassificationContext(context,emulator),/unsafe_emulator/);
});
test('missing/disabled/not-credential-ready private runtime stops before records or provider construction',async()=>{
 for(const runtime of [undefined,{enabled:false,credentialsReady:true},{enabled:true,credentialsReady:false}]){
  let factories=0;let reads=0;
  const ref=path=>({path,collection:id=>ref(path+'/'+id),doc:id=>ref(path+'/'+id)});
  const db={collection:id=>ref(id),runTransaction:fn=>fn({get:async r=>{assert.ok(r.path.endsWith('/control/runtime'));reads++;return {data:()=>runtime}},getAll:()=>{throw Error('record read forbidden')}})};
  const service=createClassificationService({db:()=>db,providerForOwner:()=>{factories++;throw Error('credential factory forbidden')}});
  assert.deepEqual(await service(context,{action:'capability'}),{enabled:false});
  await assert.rejects(service(context,{action:'prepare',scope:'all',budgetMicrousd:2753,expiresAt:Date.now()+60000}),/runtime_disabled/);
  assert.equal(factories,0);assert.equal(reads,2);
 }
});
test('snapshot codec preserves native values and refuses unsupported/oversize/deep values without truncation',()=>{
 const {captureCategoryState}=load('aiLibraryClassificationRestore');const {Timestamp,GeoPoint}=require('firebase-admin/firestore');
 const stamp=new Timestamp(1,2),location=new GeoPoint(3,4),bytes=Buffer.from([1,255]);
 const saved=captureCategoryState({aiCategory:null,aiCategoryAuto:{stamp,location,bytes,nested:[NaN,null,false]}});
 assert.deepEqual(saved.aiCategory,{present:true,value:null});assert.deepEqual(saved.aiCategorySource,{present:false});
 assert.equal(saved.aiCategoryAuto.value.stamp,stamp);assert.equal(saved.aiCategoryAuto.value.location,location);assert.equal(saved.aiCategoryAuto.value.bytes,bytes);
 for(const aiCategoryAuto of [undefined,new (class Unsupported {})(),{tooLarge:'x'.repeat(32768)}])assert.equal(captureCategoryState({aiCategoryAuto}),null);
 let deep={};for(let i=0;i<20;i++)deep={deep};assert.equal(captureCategoryState({aiCategoryAuto:deep}),null);
});
