const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
function harness(identity={email:'hkd620@gmail.com',emailVerified:true}){let handler,authCalls=0,classifierCalls=0,keyReads=0;const exports={};const code=ts.transpileModule(fs.readFileSync(__dirname+'/../src/aiLibraryAutoTrigger.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','exports',code)(name=>{
if(name==='firebase-admin')return {auth:()=>({getUser:async()=>{authCalls++;return identity;}}),firestore:()=>({doc:()=>({get:async()=>({get:()=>true})})})};
if(name==='firebase-functions/v2/firestore')return {onDocumentCreated:(options,fn)=>{assert.equal(options.region,'asia-northeast3');assert.equal(options.retry,false);assert.equal(options.maxInstances,2);handler=fn;return fn;}};
if(name==='firebase-functions/params')return {defineSecret:()=>({value:()=>{keyReads++;return 'synthetic-not-real';}})};
if(name==='./aiLibrary')return {hasAiLibraryDeveloperEmail:(email,verified)=>email==='hkd620@gmail.com'&&verified===true};
if(name==='./aiLibraryAutoClassification')return {createNewAiLogClassifier:()=>async()=>{classifierCalls++;}};
if(name==='./aiLibraryJevChoice')return {buildJevChoiceRequest:()=>{},parseJevChoiceResponse:()=>{}};
if(name==='./aiLibraryJevTransport')return {createJevChoiceHttpTransport:()=>async()=>{}};
throw Error(name);
},exports);const call=(record={type:'ai_log'})=>handler({params:{uid:'owner',recordId:'new'},data:{id:'new',get:key=>record[key],data:()=>record,createTime:{seconds:100,nanoseconds:0,toMillis:()=>100000}}});return {call,counts:()=>({authCalls,classifierCalls,keyReads})};}
test('only verified enabled developer receives auto processing; no secret access before a real paid classification',async()=>{for(const identity of [{email:'other@example.invalid',emailVerified:true},{email:'hkd620@gmail.com',emailVerified:false},{email:'hkd620@gmail.com',emailVerified:true,disabled:true}]){const h=harness(identity);await h.call();assert.equal(h.counts().classifierCalls,0);assert.equal(h.counts().keyReads,0);}const h=harness();await h.call();assert.equal(h.counts().classifierCalls,1);assert.equal(h.counts().keyReads,0);});
test('ordinary records and manual category choices do not even look up auth or construct the classifier',async()=>{const h=harness();await h.call({type:'diary'});await h.call({type:'ai_log',aiCategorySource:'manual'});assert.deepEqual(h.counts(),{authCalls:0,classifierCalls:0,keyReads:0});});
