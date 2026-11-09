const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Always test current TS source, never a potentially stale checked-in lib/ build.
const ts = require('typescript');
const Module = require('node:module');
const sourceCache = new Map();
function loadSource(name) {
  if (sourceCache.has(name)) return sourceCache.get(name);
  const filename = path.join(__dirname, '../src', name + '.ts');
  const mod = new Module(filename, module); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = request => request.startsWith('./aiLibrary') ? loadSource(request.slice(2)) : original(request);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true }
  }).outputText, filename);
  sourceCache.set(name, mod.exports); return mod.exports;
}
const { ClassificationRunner, planClassification, classificationManifestHash, prepareClassificationPayload } = loadSource('aiLibraryClassification');
const clone = x => structuredClone(x);
function fixture(n = 1, extra = {}) {
  const records = new Map(Array.from({ length: n }, (_, i) => [String(i), { type: 'ai_log', content: `Synthetic public machine learning article ${i}`, date: 'preserve', source: 'preserve', book: { preserve: true }, ...extra }]));
  const jobs = new Map(); const attempts = new Map(); let serial = Promise.resolve(); let calls = 0; let enabled = true; let approved = true; let now = 1; let owner = 'owner';
  const manifest = planClassification(owner, [...records].map(([id, record]) => ({ id, record })), 1000, n * 2753);
  let reviewed = manifest.records.map(r => r.payloadHash);
  const manifests = [manifest]; let beforeTransaction = () => {}; let transactionNumber = 0;
  const store = { transaction(work) {
    const promise = serial.then(async () => {
      beforeTransaction(++transactionNumber);
      const j = new Map([...jobs].map(([k,v]) => [k,clone(v)])); const r = new Map([...records].map(([k,v]) => [k,clone(v)]));
      const a = new Map(attempts);
      const result = await work({ getAuthorization: key => {
        const m = manifests.find(m => classificationManifestHash(m) === key);
        return {enabled,approval: approved && m ? {owner:'owner',manifestHash:key,expiresAt:m.expiresAt,reviewedPayloadHashes:reviewed} : null};
      }, getAttempt: key => a.get(key), putAttempt: (key,value) => a.set(key,value), getJob: key => j.get(key), putJob: (key, job) => j.set(key,clone(job)), getRecord: (uid,id) => uid === 'owner' ? r.get(id) : undefined,
        patchRecord: (uid,id,patch) => { assert.equal(uid,'owner'); r.set(id,{...r.get(id),...clone(patch)}); } });
      attempts.clear(); for (const [k,v] of a) attempts.set(k,v);
      jobs.clear(); for (const [k,v] of j) jobs.set(k,v); records.clear(); for (const [k,v] of r) records.set(k,v);
      return clone(result);
    }); serial = promise.catch(() => {}); return promise;
  }};
  const authority = { owner: async () => owner };
  let classify = async () => ({ decision:{ status:'classified',category:'ai-tech',confidence:0.95 } });
  const provider = { model:'jev-1.14.0',maxRequestCostMicrousd:2753,classify: async text => { calls++; return classify(text); } };
  const runner = new ClassificationRunner(store,authority,provider,() => now);
  return { runner,store,manifest,manifests,records,jobs,provider,set beforeTransaction(f){beforeTransaction=f},get calls(){return calls}, set classify(f){classify=f}, set enabled(v){enabled=v},set approved(v){approved=v},set now(v){now=v},set owner(v){owner=v},set reviewed(v){reviewed=v} };
}
test('745 items resumable, exact category-only patch, duplicate workers/jobs never double-dispatch', async () => {
  const f = fixture(745); for(let i=0;i<30;i++) await Promise.all([f.runner.step(f.manifest,25),f.runner.step(f.manifest,25)]);
  assert.equal(f.calls,745); const job=await f.runner.step(f.manifest); assert.equal(job.items.filter(x=>x.status==='applied').length,745);
  assert.equal(job.reservedMicrousd,745*2753); assert.equal(f.records.get('0').date,'preserve'); assert.deepEqual(f.records.get('0').book,{preserve:true});
  assert.equal(JSON.stringify(job).includes('Synthetic public'),false); assert.equal(JSON.stringify(job).includes('preserve'),false);
});
test('denied, disabled, expired, wrong owner, tampered manifest, unreviewed payload: zero calls', async () => {
  for(const mutate of [f=>f.approved=false,f=>f.enabled=false,f=>f.now=1000,f=>f.owner='attacker',f=>f.reviewed=[]]) {
    const f=fixture();mutate(f);await assert.rejects(f.runner.step(f.manifest),/approval_required/);assert.equal(f.calls,0);
  }
  const f=fixture();await assert.rejects(f.runner.step({...f.manifest,budgetMicrousd:99999}),/approval_required/);assert.equal(f.calls,0);
});
test('manual unclassified, privacy and long text are excluded before any transmission', async () => {
  for(const extra of [{aiCategorySource:'manual'},{content:'My diagnosis is confidential'},{content:'x'.repeat(16001)+' password: hidden'}]) {
    const f=fixture(1,extra);await f.runner.step(f.manifest);assert.equal(f.calls,0);
  }
  assert.deepEqual(prepareClassificationPayload({type:'ai_log',content:'uid: private\n2026-11-09 hello a@b.com https://example.com'}),{text:'hello',reason:null});
});
test('edit, manual clear, delete during provider response block apply', async () => {
  for(const change of [f=>f.records.set('0',{...f.records.get('0'),content:'Edited'}),f=>f.records.set('0',{...f.records.get('0'),aiCategorySource:'manual',aiCategory:undefined}),f=>f.records.delete('0')]) {
    const f=fixture();f.classify=async()=>{change(f);return {decision:{status:'classified',category:'life',confidence:0.99}}};
    const job=await f.runner.step(f.manifest);assert.equal(job.items[0].status,'skipped'); assert.notEqual(f.records.get('0')?.aiCategory,'life');
  }
});
test('review result and malformed/low confidence cannot be applied',async()=>{
  for(const decision of [{status:'review',reason:'out_of_scope'},{status:'review',reason:'ambiguous'},{status:'classified',category:'life',confidence:.2},{status:'classified',category:'bad',confidence:1}]) {
    const f=fixture();f.classify=async()=>({decision});const job=await f.runner.step(f.manifest);assert.equal(job.items[0].status,'review');assert.equal(f.records.get('0').aiCategory,undefined);
  }
});
test('hard budget race, conservative price floor, overflow rejected',async()=>{
  const f=fixture(5);f.manifest.budgetMicrousd=2753;
  await Promise.all(Array.from({length:10},()=>f.runner.step(f.manifest)));assert.equal(f.calls,1);assert.equal([...f.jobs.values()][0].reservedMicrousd,2753);
  const cheap=fixture();cheap.provider.maxRequestCostMicrousd=1;await assert.rejects(cheap.runner.step(cheap.manifest));
  const huge=fixture();huge.manifest.budgetMicrousd=Number.MAX_SAFE_INTEGER+1;await assert.rejects(huge.runner.step(huge.manifest));assert.equal(huge.calls,0);
});
test('uncertain dispatch never retried; reservation retained across restart/recovery',async()=>{
  const f=fixture();f.classify=async()=>{throw Error('network outcome unknown, do not log raw secret')};
  let job=await f.runner.step(f.manifest);assert.equal(job.items[0].status,'unknown');
  await f.runner.recover(f.manifest);job=await f.runner.step(f.manifest);assert.equal(f.calls,1);assert.equal(job.reservedMicrousd,2753);
  assert.equal(JSON.stringify(job).includes('secret'),false);
});
test('process crash checkpoint: dispatched entry recovery never resends',async()=>{
  const f=fixture();let release;f.classify=()=>new Promise(resolve=>release=resolve);
  const pending=f.runner.step(f.manifest);while(!release) await new Promise(r=>setImmediate(r));
  await f.runner.recover(f.manifest);await f.runner.step(f.manifest);assert.equal(f.calls,1);
  release({decision:{status:'classified',category:'life',confidence:1}});await pending;
  assert.equal(f.records.get('0').aiCategory,undefined);assert.equal([...f.jobs.values()][0].items[0].status,'unknown');
});
test('revocation/expiry before apply blocks changes; cancellation is sticky',async()=>{
  for(const action of [f=>f.approved=false,f=>f.enabled=false,f=>f.now=1001]){
    const f=fixture();f.classify=async()=>{action(f);return {decision:{status:'classified',category:'life',confidence:1}}};
    const job=await f.runner.step(f.manifest,1);assert.equal(job.items[0].status,'unknown');assert.equal(f.records.get('0').aiCategory,undefined);
  }
  const f=fixture(2);await f.runner.step(f.manifest,1);await f.runner.cancel(f.manifest);await f.runner.step(f.manifest);assert.equal(f.calls,1);
});
test('duplicate planning rejected; core stays dependency-injected and callable is explicitly wired',()=>{
  assert.throws(()=>planClassification('owner',[{id:'1',record:{}},{id:'1',record:{}}],100,10),/duplicate/);
  const index=fs.readFileSync(path.join(__dirname,'../src/index.ts'),'utf8');assert.match(index,/aiLibraryClassificationCallable/);
  const source=fs.readFileSync(path.join(__dirname,'../src/aiLibraryClassification.ts'),'utf8');assert.doesNotMatch(source,/firebase-admin|onCall\(|onRequest\(|onSchedule\(|fetch\(|process\.env/);
});

test('cross-manifest claims prevent duplicate concurrent or unknown paid requests',async()=>{
  const f=fixture(); f.classify=async()=>{throw Error('unknown')};
  await f.runner.step(f.manifest); f.manifest.expiresAt=2000;
  const next=await f.runner.step(f.manifest);assert.equal(f.calls,1);assert.equal(next.items[0].reason,'prior_attempt_no_retry');
  const g=fixture();await g.runner.step(g.manifest);g.manifest.budgetMicrousd*=2;
  await g.runner.step(g.manifest);assert.equal(g.calls,1);
});
test('adapter uncertain transport and parse outcomes stay unknown with reserved cost',async()=>{
  for(const reason of ['transport_error','invalid_response']) {
    const f=fixture();f.classify=async()=>({decision:{status:'review',reason}});
    const job=await f.runner.step(f.manifest);assert.equal(job.items[0].status,'unknown');assert.equal(job.reservedMicrousd,2753);
    await f.runner.step(f.manifest);assert.equal(f.calls,1);
  }
});
test('two independently approved manifests race on one global attempt ledger',async()=>{
  const f=fixture();const other={...f.manifest,expiresAt:2000};f.manifests.push(other);
  const authority={enabled:async()=>true,owner:async()=> 'owner',approval:async key=>{
    const m=[f.manifest,other].find(m=>classificationManifestHash(m)===key);
    return m?{owner:'owner',manifestHash:key,expiresAt:m.expiresAt,reviewedPayloadHashes:m.records.map(r=>r.payloadHash)}:null;
  }};
  const second=new ClassificationRunner(f.store,authority,f.provider,()=>1);
  await Promise.all([f.runner.step(f.manifest),second.step(other)]);assert.equal(f.calls,1);
});
test('cancelling an in-flight request never applies its late result',async()=>{
  const f=fixture();let release;f.classify=()=>new Promise(resolve=>release=resolve);
  const pending=f.runner.step(f.manifest);while(!release)await new Promise(r=>setImmediate(r));
  await f.runner.cancel(f.manifest);release({decision:{status:'classified',category:'life',confidence:1}});
  const job=await pending;assert.equal(job.items[0].status,'skipped');assert.equal(f.records.get('0').aiCategory,undefined);
});
test('transaction-visible revocation/runtime fence blocks permit and result apply races',async()=>{
  for (const transactionNumber of [3,4]) {
    for (const revoke of [f=>f.approved=false,f=>f.enabled=false,f=>f.now=1001]) {
      const f=fixture();
      f.beforeTransaction=n=>{if(n===transactionNumber)revoke(f)};
      const job=await f.runner.step(f.manifest,1);
      assert.equal(f.calls,transactionNumber===3?0:1);
      assert.equal(f.records.get('0').aiCategory,undefined);
      assert.equal(job.items[0].status,'unknown');
      assert.equal(job.reservedMicrousd,2753);
    }
  }
});
test('transaction-visible revocation before claim makes no reservation or attempt',async()=>{
  const f=fixture();f.beforeTransaction=n=>{if(n===2)f.approved=false};
  await assert.rejects(f.runner.step(f.manifest),/approval_required/);
  assert.equal(f.calls,0);assert.equal([...f.jobs.values()][0].reservedMicrousd,0);
});
test('owner can cancel/recover after approval revoked, runtime disabled or expiry; others cannot',async()=>{
  for (const revoke of [f=>f.approved=false,f=>f.enabled=false,f=>f.now=1001]) {
    const f=fixture();await f.runner.step(f.manifest,1);
    const saved=[...f.jobs.values()][0];saved.items[0].status='dispatched';revoke(f);
    await f.runner.cancel(f.manifest);await f.runner.recover(f.manifest);
    const job=[...f.jobs.values()][0];assert.equal(job.cancelled,true);assert.equal(job.items[0].status,'unknown');
    assert.equal(job.reservedMicrousd,2753);assert.equal(f.calls,1);
    f.owner='attacker';await assert.rejects(f.runner.cancel(f.manifest),/approval_required/);
    await assert.rejects(f.runner.recover(f.manifest),/approval_required/);
  }
});
test('delete/edit/manual-clear immediately before atomic permit prevent transmission',async()=>{
  for(const mutate of [f=>f.records.delete('0'),f=>f.records.get('0').content='Changed public text',f=>Object.assign(f.records.get('0'),{aiCategory:null,aiCategorySource:'manual'})]){
    const f=fixture();f.beforeTransaction=n=>{if(n===3)mutate(f)};
    const job=await f.runner.step(f.manifest,1);
    assert.equal(f.calls,0);assert.equal(job.items[0].status,'skipped');
    assert.equal(job.items[0].reason,'record_changed_before_permit');assert.equal(job.items[0].permittedAt,undefined);
    assert.equal(job.reservedMicrousd,2753);await f.runner.step(f.manifest,1);assert.equal(f.calls,0);
  }
});
