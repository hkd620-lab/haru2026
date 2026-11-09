// MUST be run only against an explicit isolated demo emulator; never default credentials/production.
const {test,after} = require('node:test');
const assert = require('node:assert/strict');
const projectId = process.env.AI_LIBRARY_TEST_PROJECT;
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (projectId !== 'demo-haru-ai-classification' || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host ?? '')) throw Error('Explicit demo project and loopback emulator required BEFORE Firebase initialization');
const {initializeApp,deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const load = require('./aiLibraryClassificationSource');
const {createClassificationService} = load('aiLibraryClassificationService');
const {classificationPaths,createClassificationStore} = load('aiLibraryClassificationStore');
const {ClassificationRunner} = load('aiLibraryClassification');
const app=initializeApp({projectId},'classification-synthetic-'+Date.now());const db=getFirestore(app);
after(()=>deleteApp(app));
let seq=0;
async function fixture(count=2){
 const owner='synthetic-'+Date.now()+'-'+(++seq); const p=classificationPaths(db,owner); let calls=0;
 const context={uid:owner,email:'hkd620@gmail.com',emailVerified:true,origin:'https://haru2026.com'};
 const provider={model:'jev-1.14.0',maxRequestCostMicrousd:2753,classify:async()=>{calls++;return {decision:{status:'classified',category:'ai-tech',confidence:.95}}}};
 const options={db:()=>db,provider};const service=createClassificationService(options);
 await p.runtime.set({enabled:true,credentialsReady:true});
 for(let i=0;i<count;i++)await p.record(String(i)).set({type:'ai_log',content:'Synthetic public AI article '+i,date:'preserve'});
 const prepare=()=>service(context,{action:'prepare',scope:'all',budgetMicrousd:count*2753,expiresAt:Date.now()+600000});
 const approve=async plan=>{let offset=0;while(offset!==null){const page=await service(context,{action:'review',manifestHash:plan.manifestHash,offset});offset=page.nextOffset;}
 return service(context,{action:'approve',manifestHash:plan.manifestHash,consentVersion:plan.consentVersion,reviewedPayloadHashes:[...new Set(plan.manifest.records.filter(r=>!r.reason).map(r=>r.payloadHash))]});};
 return {owner,p,context,provider,options,service,prepare,approve,get calls(){return calls}};
}
test('durable service review consent budget; changed manifest/restarted store cannot repeat global attempt',async()=>{
 const f=await fixture();const plan=await f.prepare();
 await assert.rejects(f.service(f.context,{action:'approve',manifestHash:plan.manifestHash,consentVersion:plan.consentVersion,reviewedPayloadHashes:plan.manifest.records.map(r=>r.payloadHash)}),/review_required/);
 await f.approve(plan); await f.service(f.context,{action:'step',manifestHash:plan.manifestHash,limit:1});
 const restarted=createClassificationService(f.options);await restarted(f.context,{action:'step',manifestHash:plan.manifestHash,limit:5});assert.equal(f.calls,2);
 const next=await f.prepare();await f.approve(next);const result=await restarted(f.context,{action:'step',manifestHash:next.manifestHash,limit:5});assert.equal(f.calls,2);assert.ok(result.items.every(r=>r.reason==='prior_attempt_no_retry'));
 assert.equal((await f.p.record('0').get()).data().date,'preserve');
 const stored=JSON.stringify((await f.p.job(plan.manifestHash).get()).data());assert.ok(!stored.includes('Synthetic public'));
});
test('manual clear and approval revocation during provider response block result application',async()=>{
 for(const kind of ['manual','revoke']){const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);
 f.provider.classify=async()=>{if(kind==='manual')await f.p.record('0').update({aiCategory:null,aiCategorySource:'manual'});else await f.p.approval(plan.manifestHash).delete();return {decision:{status:'classified',category:'ai-tech',confidence:.95}}};
 const job=await f.service(f.context,{action:'step',manifestHash:plan.manifestHash});assert.equal(job.items[0].status,kind==='manual'?'skipped':'unknown');assert.notEqual((await f.p.record('0').get()).data().aiCategory,'ai-tech');}
});
test('runtime disable before permit, concurrent workers and uncertain outcome never retry; owner cleanup remains',async()=>{
 const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);
 let calls=0;f.provider.classify=async()=>{calls++;throw Error('synthetic timeout')};
 await Promise.all([f.service(f.context,{action:'step',manifestHash:plan.manifestHash}),f.service(f.context,{action:'step',manifestHash:plan.manifestHash})]);assert.equal(calls,1);
 await f.p.runtime.set({enabled:false,credentialsReady:false});await f.p.approval(plan.manifestHash).delete();
 await f.service(f.context,{action:'recover',manifestHash:plan.manifestHash});await f.service(f.context,{action:'cancel',manifestHash:plan.manifestHash});
 await assert.rejects(f.service({...f.context,uid:'synthetic-other'},{action:'cancel',manifestHash:plan.manifestHash}),/plan_not_found/);
 await assert.rejects(f.service(f.context,{action:'prepare',scope:'all',budgetMicrousd:2753,expiresAt:Date.now()+60000}),/runtime_disabled/);assert.equal(calls,1);
});
test('transaction authorization is reread after revocation before permit',async()=>{
 const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);const base=createClassificationStore(db,f.owner);let transactions=0;
 const wrapped={transaction:async work=>{transactions++;if(transactions===3)await f.p.approval(plan.manifestHash).delete();return base.transaction(work)}};
 const runner=new ClassificationRunner(wrapped,{owner:async()=>f.owner},f.provider);
 const job=await runner.step(plan.manifest,1);assert.equal(f.calls,0);assert.equal(job.items[0].status,'unknown');
});
test('budget stops before second dispatch and cancellation before first step stays cancelled',async()=>{
 const f=await fixture(2);const plan=await f.service(f.context,{action:'prepare',scope:'all',budgetMicrousd:2753,expiresAt:Date.now()+60000});await f.approve(plan);
 const job=await f.service(f.context,{action:'step',manifestHash:plan.manifestHash,limit:5});assert.equal(f.calls,1);assert.equal(job.reservedMicrousd,2753);assert.equal(job.items.filter(r=>r.status==='pending').length,1);
 const g=await fixture(1);const pending=await g.prepare();await g.service(g.context,{action:'cancel',manifestHash:pending.manifestHash});await assert.rejects(g.approve(pending),/cancelled/);assert.equal(g.calls,0);
 const status=await g.service(g.context,{action:'status',manifestHash:pending.manifestHash});assert.equal(status.job.cancelled,true);
});
test('delete/edit/manual-clear immediately before durable permit block transmission and retain attempt',async()=>{
 for(const kind of ['delete','edit','manual']){
  const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);const base=createClassificationStore(db,f.owner);let transactions=0;
  const wrapped={transaction:async work=>{transactions++;if(transactions===3){
   if(kind==='delete')await f.p.record('0').delete();
   else await f.p.record('0').update(kind==='edit'?{content:'Changed public text'}:{aiCategory:null,aiCategorySource:'manual'});
  }return base.transaction(work)}};
  const runner=new ClassificationRunner(wrapped,{owner:async()=>f.owner},f.provider);
  const job=await runner.step(plan.manifest,1);assert.equal(f.calls,0);assert.equal(job.items[0].status,'skipped');
  assert.equal(job.items[0].reason,'record_changed_before_permit');assert.equal(job.items[0].permittedAt,undefined);
  assert.equal(job.reservedMicrousd,2753);await runner.step(plan.manifest,1);assert.equal(f.calls,0);
 }
});
