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
 await p.user.set({});
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
 await db.doc('users/'+f.owner+'-other').set({});await assert.rejects(f.service({...f.context,uid:f.owner+'-other'},{action:'cancel',manifestHash:plan.manifestHash}),/plan_not_found/);
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

test('exact durable restoration preserves absent/null and arbitrary supported Firestore metadata',async()=>{
 const {Timestamp,GeoPoint}=require('firebase-admin/firestore');
 for(const fields of [{},{aiCategory:null,aiCategorySource:null,aiCategoryAuto:null},{aiCategory:'legacy-value',aiCategorySource:'auto',aiCategoryAuto:{model:'old-model',nested:{empty:[],flag:false,nan:NaN},stamp:new Timestamp(123,456789),location:new GeoPoint(12,34),bytes:Buffer.from([0,3,255]),reference:db.doc('synthetic/reference')}}]){
  const f=await fixture(1);await f.p.record('0').update({...fields,aiCategoryUpdatedAt:new Timestamp(50,20),book:{title:'Synthetic unchanged'},source:'fixture'});
  const before=(await f.p.record('0').get()).data();const plan=await f.prepare();await f.approve(plan);
  const applied=await f.service(f.context,{action:'step',manifestHash:plan.manifestHash});assert.equal(applied.items[0].status,'applied');
  const changed=await f.p.record('0').get();const receiptDoc=await f.p.restoration(plan.manifestHash,'0').get();const receipt=receiptDoc.data();
  assert.ok(changed.updateTime.isEqual(receiptDoc.createTime));assert.ok(receiptDoc.updateTime.isEqual(receiptDoc.createTime));assert.ok(changed.data().aiCategoryAuto.appliedAt.isEqual(receipt.appliedAt));assert.ok(receipt.applied.aiCategoryAuto.appliedAt.isEqual(receipt.appliedAt));
  // Cleanup must not construct a provider or inspect credentials, even when a factory exists.
  await f.p.runtime.set({enabled:false,credentialsReady:false});await f.p.approval(plan.manifestHash).delete();
  const cleanup=createClassificationService({db:()=>db,providerForOwner:()=>{throw Error('provider factory must not be called')}});
  const result=await cleanup(f.context,{action:'restore',manifestHash:plan.manifestHash});assert.equal(result.items[0].restoration.status,'restored');
  assert.deepEqual((await f.p.record('0').get()).data(),before);
  await cleanup(f.context,{action:'restore',manifestHash:plan.manifestHash});assert.deepEqual((await f.p.record('0').get()).data(),before);
  assert.equal(result.reservedMicrousd,2753);assert.equal((await f.p.job(plan.manifestHash).parent.parent.collection('attempts').get()).size,1);assert.equal(f.calls,1);
 }
});
test('durable restore skips manual move, new AI, changed/reverted content, deleted/recreated identical record',async()=>{
 for(const kind of ['manual','new-auto','content','reverted-content','unrelated','delete','recreate']){
  const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);await f.service(f.context,{action:'step',manifestHash:plan.manifestHash});
  const applied=(await f.p.record('0').get()).data();
  if(kind==='manual')await f.p.record('0').update({aiCategory:'health',aiCategorySource:'manual',aiCategoryUpdatedAt:new Date()});
  if(kind==='new-auto')await f.p.record('0').update({'aiCategoryAuto.manifestHash':'newer-job'});
  if(kind==='content'||kind==='reverted-content'){await f.p.record('0').update({content:'Changed synthetic text'});if(kind==='reverted-content')await f.p.record('0').update({content:applied.content});}
  if(kind==='unrelated')await f.p.record('0').update({book:{synthetic:true}});
  if(kind==='delete'||kind==='recreate'){await f.p.record('0').delete();if(kind==='recreate')await f.p.record('0').set(applied);}
  const before=(await f.p.record('0').get()).data();const result=await f.service(f.context,{action:'restore',manifestHash:plan.manifestHash});
  assert.equal(result.items[0].restoration.status,'skipped',kind);assert.deepEqual((await f.p.record('0').get()).data(),before,kind);
  const retry=await f.service(f.context,{action:'restore',manifestHash:plan.manifestHash});assert.deepEqual(retry.items[0].restoration,result.items[0].restoration);
 }
});
test('final apply captures latest pre-state, while oversized metadata refuses application without truncation',async()=>{
 const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);
 f.provider.classify=async()=>{await f.p.record('0').update({aiCategory:'life',aiCategorySource:'auto',aiCategoryAuto:{model:'intervening',extra:[null,{v:2}]}});return {decision:{status:'classified',category:'ai-tech',confidence:.95}}};
 await f.service(f.context,{action:'step',manifestHash:plan.manifestHash});await f.service(f.context,{action:'restore',manifestHash:plan.manifestHash});
 assert.deepEqual((await f.p.record('0').get()).data().aiCategoryAuto,{model:'intervening',extra:[null,{v:2}]});
 const g=await fixture(1);await g.p.record('0').update({aiCategoryAuto:{oversized:'x'.repeat(32768)}});const before=(await g.p.record('0').get()).data();const big=await g.prepare();await g.approve(big);
 const result=await g.service(g.context,{action:'step',manifestHash:big.manifestHash});assert.equal(result.items[0].reason,'restore_snapshot_unavailable');assert.deepEqual((await g.p.record('0').get()).data(),before);assert.equal((await g.p.restoration(big.manifestHash,'0').get()).exists,false);
});
test('legacy or missing durable snapshots explicitly unavailable; new owner cannot restore',async()=>{
 for(const kind of ['legacy','missing','malformed']){const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);await f.service(f.context,{action:'step',manifestHash:plan.manifestHash});
  if(kind==='legacy'){const saved=(await f.p.job(plan.manifestHash).get()).data();delete saved.items[0].recordIdentity;saved.items[0].previous={category:null,source:null,auto:null};await f.p.job(plan.manifestHash).set(saved);}
  if(kind==='missing')await f.p.restoration(plan.manifestHash,'0').delete();
  if(kind==='malformed')await f.p.restoration(plan.manifestHash,'0').update({'before.aiCategory':{present:true}});
  const before=(await f.p.record('0').get()).data();const result=await f.service(f.context,{action:'restore',manifestHash:plan.manifestHash});assert.equal(result.items[0].restoration.status,'unavailable');assert.deepEqual((await f.p.record('0').get()).data(),before);
  await db.doc('users/'+f.owner+'-other').set({});await assert.rejects(f.service({...f.context,uid:f.owner+'-other'},{action:'restore',manifestHash:plan.manifestHash}),/plan_not_found/);
 }
});
test('partial interrupted restore is resumable and racing restore/cancel/recover never reclaims attempts',async()=>{
 const f=await fixture(4);const plan=await f.prepare();await f.approve(plan);await f.service(f.context,{action:'step',manifestHash:plan.manifestHash,limit:5});
 const base=createClassificationStore(db,f.owner);let transactions=0;
 const interrupted={transaction:work=>{if(++transactions===3)throw Error('synthetic interruption');return base.transaction(work)}};
 const runner=new ClassificationRunner(interrupted,{owner:async()=>f.owner},f.provider);
 await assert.rejects(runner.restore(plan.manifest),/synthetic interruption/);
 assert.equal((await f.p.job(plan.manifestHash).get()).data().items.filter(i=>i.restoration?.status==='restored').length,1);
 await Promise.all([f.service(f.context,{action:'restore',manifestHash:plan.manifestHash,limit:2}),f.service(f.context,{action:'restore',manifestHash:plan.manifestHash,limit:2}),f.service(f.context,{action:'cancel',manifestHash:plan.manifestHash}),f.service(f.context,{action:'recover',manifestHash:plan.manifestHash})]);
 const result=await f.service(f.context,{action:'restore',manifestHash:plan.manifestHash});assert.ok(result.items.every(i=>i.restoration.status==='restored'));assert.equal(result.reservedMicrousd,4*2753);
 await f.p.runtime.set({enabled:true,credentialsReady:true});const next=await f.prepare();await f.approve(next);const subsequent=await f.service(f.context,{action:'step',manifestHash:next.manifestHash,limit:5});assert.equal(f.calls,4);assert.ok(subsequent.items.every(i=>i.reason==='prior_attempt_no_retry'));
});
test('restore in flight stops late apply; recreation before permit/result is fenced by creation identity',async()=>{
 const f=await fixture(2);const plan=await f.prepare();await f.approve(plan);await f.service(f.context,{action:'step',manifestHash:plan.manifestHash});
 let release;f.provider.classify=()=>new Promise(resolve=>release=resolve);
 const pending=f.service(f.context,{action:'step',manifestHash:plan.manifestHash});while(!release)await new Promise(r=>setTimeout(r,1));
 await f.service(f.context,{action:'restore',manifestHash:plan.manifestHash});release({decision:{status:'classified',category:'life',confidence:1}});const done=await pending;assert.equal(done.items[0].restoration.status,'restored');assert.notEqual(done.items[1].status,'applied');
 for(const phase of ['permit','apply']){const g=await fixture(1);const plan=await g.prepare();await g.approve(plan);const replace=async()=>{const old=(await g.p.record('0').get()).data();await g.p.record('0').delete();await g.p.record('0').set(old)};
  const base=createClassificationStore(db,g.owner);let count=0;const wrapped={transaction:async work=>{if(++count===3&&phase==='permit')await replace();return base.transaction(work)}};
  if(phase==='apply')g.provider.classify=async()=>{await replace();return {decision:{status:'classified',category:'life',confidence:1}}};
  const runner=new ClassificationRunner(wrapped,{owner:async()=>g.owner},g.provider);const job=await runner.step(plan.manifest);assert.equal(job.items[0].status,'skipped');assert.equal((await g.p.record('0').get()).data().aiCategory,undefined);
 }
});
test('concurrent manual move always wins against category restoration',async()=>{
 for(let i=0;i<3;i++){const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);await f.service(f.context,{action:'step',manifestHash:plan.manifestHash});
  await Promise.all([f.service(f.context,{action:'restore',manifestHash:plan.manifestHash}),f.p.record('0').update({aiCategory:'health',aiCategorySource:'manual'})]);
  const current=(await f.p.record('0').get()).data();assert.equal(current.aiCategory,'health');assert.equal(current.aiCategorySource,'manual');
  await f.service(f.context,{action:'restore',manifestHash:plan.manifestHash});assert.equal((await f.p.record('0').get()).data().aiCategory,'health');
 }
});

test('owner recursive deletion removes every private descendant even with absent root/job parents',async()=>{
 const f=await fixture(1);const other=await fixture(1);const plan=await f.prepare();await f.approve(plan);
 await f.service(f.context,{action:'step',manifestHash:plan.manifestHash});
 const orphan=f.p.root.collection('jobs').doc('absent-parent').collection('restorations').doc('orphan');await orphan.set({synthetic:true});
 assert.equal((await f.p.root.get()).exists,false);assert.equal((await orphan.parent.parent.get()).exists,false);
 const refs=[f.p.runtime,f.p.plan(plan.manifestHash),f.p.review(plan.manifestHash),f.p.approval(plan.manifestHash),f.p.job(plan.manifestHash),f.p.restoration(plan.manifestHash,'0'),orphan,
  ...(await f.p.root.collection('attempts').get()).docs.map(doc=>doc.ref)];
 await f.p.user.update({accountStatus:'pending_deletion',deletionStartedAt:new Date()});
 await db.recursiveDelete(f.p.root);await db.recursiveDelete(f.p.root);
 assert.ok((await db.getAll(...refs)).every(doc=>!doc.exists));assert.equal((await f.p.root.listCollections()).length,0);
 assert.equal((await other.p.runtime.get()).exists,true);assert.equal((await f.p.record('0').get()).exists,true);
});

test('pending deletion before permit stops dispatch and keeps the active retry ledger until final sweep',async()=>{
 const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);const base=createClassificationStore(db,f.owner);let transactions=0;
 const wrapped={transaction:async work=>{if(++transactions===3)await f.p.user.update({accountStatus:'pending_deletion'});return base.transaction(work)}};
 const runner=new ClassificationRunner(wrapped,{owner:async()=>f.owner},f.provider);
 await assert.rejects(runner.step(plan.manifest),/account_unavailable/);assert.equal(f.calls,0);
 assert.equal((await f.p.root.collection('attempts').get()).size,1);assert.equal((await f.p.job(plan.manifestHash).get()).data().reservedMicrousd,2753);
 // Cancellation within the grace period restores access, never the paid attempt budget.
 const {FieldValue}=require('firebase-admin/firestore');await f.p.user.update({accountStatus:FieldValue.delete()});
 await runner.recover(plan.manifest);await runner.step(plan.manifest);assert.equal(f.calls,0);
 assert.equal((await f.p.root.collection('attempts').get()).size,1);
});

test('late provider result and stale cleanup cannot recreate a swept tree, including after minimal user recreation',async()=>{
 const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);
 let release;f.provider.classify=()=>new Promise(resolve=>release=resolve);
 const pending=f.service(f.context,{action:'step',manifestHash:plan.manifestHash});
 while(!release)await new Promise(resolve=>setTimeout(resolve,1));
 await f.p.user.update({accountStatus:'pending_deletion',deletionStartedAt:new Date()});await db.recursiveDelete(f.p.root);
 release({decision:{status:'classified',category:'life',confidence:1}});
 await assert.rejects(pending,/account_unavailable/);assert.equal((await f.p.record('0').get()).data().aiCategory,undefined);
 await f.p.user.delete();
 for(const action of ['prepare','review','approve','step','cancel','recover','restore','status']){
  await assert.rejects(f.service(f.context,{action,scope:'all',budgetMicrousd:2753,expiresAt:Date.now()+60000,manifestHash:plan.manifestHash}),/account_unavailable/);
 }
 await f.p.user.set({consents:{synthetic:true}});
 const runner=new ClassificationRunner(createClassificationStore(db,f.owner),{owner:async()=>f.owner},f.provider);
 for(const action of ['step','cancel','recover','restore'])await assert.rejects(runner[action](plan.manifest),/plan_not_found/);
 assert.equal((await f.p.root.listCollections()).length,0);
});

test('concurrent prepare/review/approve/step/cleanup/status serialize with finalization before private sweep',async()=>{
 for(const action of ['prepare','review','approve','step','cancel','recover','restore','status']){
  const f=await fixture(1);const plan=await f.prepare();await f.approve(plan);
  if(action==='restore')await f.service(f.context,{action:'step',manifestHash:plan.manifestHash});
  const input={action,scope:'all',budgetMicrousd:2753,expiresAt:Date.now()+60000,manifestHash:plan.manifestHash,consentVersion:plan.consentVersion,reviewedPayloadHashes:plan.manifest.records.map(r=>r.payloadHash)};
  const results=await Promise.allSettled([f.service(f.context,input),(async()=>{
   await db.runTransaction(async tx=>{await tx.get(f.p.user);tx.update(f.p.user,{accountStatus:'pending_deletion',deletionStartedAt:new Date()})});
   await db.recursiveDelete(f.p.root);
  })()]);
  assert.equal(results[1].status,'fulfilled',action);
  if(results[0].status==='rejected')assert.match(results[0].reason.message,/account_unavailable/,action);
  assert.equal((await f.p.root.listCollections()).length,0,action);
 }
});
