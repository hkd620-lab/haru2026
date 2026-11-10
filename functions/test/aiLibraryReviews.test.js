const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), crypto = require('node:crypto');
function harness() {
  const records = new Map(), reviews = new Map(); const reads = [];
  const snap = (id, data) => ({ id, data: () => data, exists: !!data });
  const db = { collection(path) { assert.equal(path, 'aiLibraryClassificationPrivate/owner/reviewItems'); return { limit(n) { assert.equal(n,1001);return { get: async()=>({size:reviews.size,docs:[...reviews].map(([id,r])=>snap(id,r))}) }; } }; }, doc(path) { assert(path.startsWith('users/owner/records/'));const id=path.split('/').pop();return { get:async()=>{reads.push(id);return snap(id,records.get(id));} }; } };
  class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
  const code=ts.transpileModule(fs.readFileSync(__dirname+'/../src/aiLibraryReviews.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const exp={};new Function('require','exports',code)(name=>{
    if(name==='firebase-admin')return {firestore:()=>db};if(name==='node:crypto')return crypto;
    if(name==='firebase-functions/v2/https')return {HttpsError,onCall:(_,fn)=>fn};
    if(name==='./aiLibrary')return {requireAiLibraryDeveloper:r=>{if(r.auth?.uid!=='owner'||r.auth?.token?.email!=='hkd620@gmail.com')throw new HttpsError('permission-denied','denied');return 'owner';}};
    if(name==='./aiLibraryCategory')return require('./aiLibraryClassificationSource')('aiLibraryCategory');
    throw Error(name);
  },exp);
  const seed=(id,extra={})=>{const record={type:'ai_log',content:'original '+id,source:'Gemini',...extra};records.set(id,record);reviews.set(id,{status:'pending',recommendation:'health',reason:'low_confidence',contentHash:crypto.createHash('sha256').update(JSON.stringify([record.type,record.content])).digest('hex')});};
  const call=data=>exp.listAiLibraryReviews({auth:{uid:'owner',token:{email:'hkd620@gmail.com'}},data});return {...exp,call,seed,records,reviews,reads};
}
test('review pages have no gaps, metadata does not replace source or content',async()=>{const h=harness();for(let i=0;i<25;i++)h.seed(String(i).padStart(3,'0'));let cursor,ids=[];do{const r=await h.call(cursor?{cursor}:{});assert(r.logs.length<=10);for(const log of r.logs){assert.equal(log.content,'original '+log.id);assert.equal(log.source,'Gemini');assert.equal(log.aiReview.recommendation,'health');}ids.push(...r.logs.map(r=>r.id));cursor=r.nextCursor;}while(cursor);assert.equal(ids.length,25);assert.equal(new Set(ids).size,25);});
test('deleted, edited, manually moved and manually cleared items disappear',async()=>{const h=harness();for(const id of ['deleted','edited','manual','clear','kept'])h.seed(id);h.records.delete('deleted');h.records.get('edited').content='changed';h.records.get('manual').aiCategorySource='manual';h.records.get('manual').aiCategory='life';h.records.get('clear').aiCategorySource='manual';const r=await h.call({});assert.deepEqual(r.logs.map(x=>x.id),['kept']);});
test('invalid recommendations are never returned as a move target',async()=>{const h=harness();h.seed('a');h.reviews.get('a').recommendation='arbitrary';assert.equal((await h.call({})).logs[0].aiReview.recommendation,null);});
test('no read before identity/cursor validation; cross-user/path injection rejected',async()=>{const h=harness();await assert.rejects(h.listAiLibraryReviews({auth:{uid:'other'},data:{}}));for(const cursor of ['bad=',Buffer.from(JSON.stringify({v:1,id:'../other'})).toString('base64url'),Buffer.from(JSON.stringify({v:1,id:'a',extra:1})).toString('base64url')])await assert.rejects(h.call({cursor}));assert.equal(h.reads.length,0);});
test('100 stale entries return an advancing empty page; deleted cursor anchor remains usable',async()=>{const h=harness();for(let i=0;i<105;i++)h.seed(String(i).padStart(3,'0'),i<100?{aiCategorySource:'manual'}:{});const a=await h.call({});assert.equal(a.logs.length,0);assert(a.nextCursor);h.reviews.delete('099');const b=await h.call({cursor:a.nextCursor});assert.equal(b.logs.length,5);assert.equal(b.nextCursor,undefined);});

test('pending harulab recommendation remains a valid move target while original record stays unchanged',async()=>{const h=harness();h.seed('app');h.reviews.get('app').recommendation='harulab';const before=structuredClone(h.records.get('app'));const result=await h.call({});assert.equal(result.logs[0].aiReview.recommendation,'harulab');assert.deepEqual(h.records.get('app'),before);});
