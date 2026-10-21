// Source-only audit. Evaluates extracted functions with in-memory SDK/storage stubs.
// Never imports application modules, Firebase SDKs, provider SDKs, or credentials.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require(path.join(process.env.HARU_AUDIT_DEPS || '', 'typescript'));
const repo = path.resolve(__dirname, '../../..');
const deployed = process.env.HARU_AUDIT_DEPLOYED_SOURCE;
assert.ok(deployed, 'HARU_AUDIT_DEPLOYED_SOURCE is required');
const result = {base:'8a2bbfd8cb24fd9d381ed75d9e3e5ce31d68fce9', method:'AST extraction; synthetic SDK/AI and memory storage; no network', sources:{}, server:{}, client:{}};
function read(label, filename) {
  const text = fs.readFileSync(filename, 'utf8');
  result.sources[label] = crypto.createHash('sha256').update(text).digest('hex');
  return {text, ast:ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : undefined)};
}
function nodes(root, predicate) { const found=[]; function walk(n) {if(predicate(n))found.push(n);ts.forEachChild(n,walk);} walk(root);return found; }
function unique(file, predicate, label) {const found=nodes(file.ast,predicate);assert.equal(found.length,1,label);return found[0];}
function variable(file,name){return unique(file,n=>ts.isVariableDeclaration(n)&&n.name.getText(file.ast)===name,name);}
function declaration(file,name){return unique(file,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name,name);}
function text(file,node){return node.getText(file.ast);}
function evaluate(source, context) {
  const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  return new vm.Script(compiled).runInNewContext(context,{timeout:1000});
}
function handlerNode(file) {
  const call = nodes(file.ast,n=>ts.isVariableDeclaration(n)&&n.name.getText(file.ast)==='polishContent').map(n=>n.initializer)[0]
    || unique(file,n=>ts.isBinaryExpression(n)&&n.left.getText(file.ast)==='exports.polishContent'&&ts.isCallExpression(n.right),'runtime polishContent').right;
  return call.arguments[call.arguments.length-1];
}
const supported=['diary','essay','mission','report','work','travel','garden','pet','child','memo'];
const fieldMap={'일기':'diary','에세이':'essay','선교보고':'mission','일반보고':'report','업무일지':'work','여행기록':'travel','텃밭일지':'garden','애완동물관찰일지':'pet','육아일기':'child','메모':'memo'};
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
const quiet={log(){},warn(){},error(){}};
const noop=()=>{};
const asyncNoop=async()=>{};
function makeHandler(file, scenario) {
  const trace={calls:[],reserves:0,rollbacks:0,paidLogs:0,rateChecks:0};
  function response(purpose) {
    trace.calls.push(purpose);
    if(scenario.failPurpose===purpose)throw Error('synthetic provider failure');
    const value=purpose==='recordStats' ? (scenario.invalidStats ? 'not json' : '{"positivity_ratio":4,"energy_level":3}') : purpose==='sayuPolishComment' ? '합성 한마디' : '합성 본문';
    return {inputTokens:1,outputTokens:2,text:()=>value,response:{text:()=>value,usageMetadata:{promptTokenCount:1,candidatesTokenCount:2}}};
  }
  class GoogleGenerativeAI {constructor(key){assert.equal(key,'synthetic-key');} getGenerativeModel(config){return {generateContent:async input=>response(config.systemInstruction!==undefined?'sayuPolish':input==='SYNTHETIC_COMMENT'?'sayuPolishComment':'recordStats')};}}
  const common={HttpsError,console:quiet,logger:quiet,AI_USAGE_PLAN:'synthetic',DEVELOPER_UIDS:new Set(),GoogleGenerativeAI,
    GEMINI_API_KEY_SECRET:{value:()=> 'synthetic-key'},getGeminiUsage:()=>({inputTokens:1,outputTokens:2}),
    formatPrefixesOf:formats=>formats.map(f=>fieldMap[f]),getAiRoute:()=>({model:'synthetic-model'}),
    buildAiCommentPrompt:()=> 'SYNTHETIC_COMMENT',logAiUsage:asyncNoop,getAiUsageErrorCode:()=> 'synthetic-error',
    logPaidServiceUsage:async()=>{trace.paidLogs++;},
    enforceRateLimit:async()=>{trace.rateChecks++;if(scenario.rateDenied)throw new HttpsError('resource-exhausted','synthetic rate limit');},
    reserveMonthlyAiQuota:async()=>{trace.reserves++;if(scenario.quotaDenied)throw new HttpsError('resource-exhausted','synthetic quota');return {synthetic:true};},
    rollbackMonthlyAiQuotaReservation:async()=>{trace.rollbacks++;},callAi:async request=>response(request.purpose)};
  const context={...common};
  // Compiled CommonJS functions refer to namespaces such as https_1.HttpsError.
  for(const n of nodes(file.ast,n=>ts.isIdentifier(n)&&/_\d+$/.test(n.text))) {
    context[n.text]=new Proxy({}, {get(_target,key){assert.ok(key in common,`unmocked namespace property ${String(key)}`);return common[key];}});
  }
  const source=`const STATS_PROMPTS=${text(file,variable(file,'STATS_PROMPTS').initializer)};${text(file,declaration(file,'analyzeStats'))};const handler=${text(file,handlerNode(file))};handler;`;
  return {fn:evaluate(source,context),trace};
}
const scenarios=supported.map(format=>({name:`supported:${format}`,format,calls:3})).concat([
  {name:'basic-mode-still-all-outputs',format:'memo',mode:'BASIC',calls:3},
  ...['reading','voiding','unknown',undefined].map(format=>({name:`unsupported:${String(format)}`,format,calls:2})),
  {name:'false-options-currently-ignored',format:'memo',options:{includeStats:false,includeAiComment:false},calls:3},
  {name:'missing-text',noText:true,error:'invalid-argument',calls:0},
  {name:'empty-text',input:'',error:'invalid-argument',calls:0},
  {name:'non-string-text',input:42,error:'invalid-argument',calls:0},
  {name:'over-limit',input:'x'.repeat(5001),error:'invalid-argument',calls:0},
  {name:'unauthenticated',unauthenticated:true,error:'unauthenticated',calls:0},
  {name:'invalid-stats-json',format:'memo',invalidStats:true,calls:3,statsNull:true},
  {name:'stats-provider-failure',format:'memo',failPurpose:'recordStats',calls:3,statsNull:true},
  {name:'comment-provider-failure',format:'memo',failPurpose:'sayuPolishComment',calls:3,commentEmpty:true},
  {name:'body-provider-failure',format:'memo',failPurpose:'sayuPolish',calls:1,error:'internal',rollback:true},
  {name:'rate-limit',rateDenied:true,error:'resource-exhausted',calls:0},
  {name:'monthly-quota',quotaDenied:true,error:'resource-exhausted',calls:0},
]);
const files={main:read('functions/src/index.ts',path.join(repo,'functions/src/index.ts')),
  deployedTs:read('deployed/src/index.ts',path.join(deployed,'src/index.ts')),
  deployedJs:read('deployed/lib/index.js',path.join(deployed,'lib/index.js'))};
const format=read('frontend/src/app/components/FormatModal.tsx',path.join(repo,'frontend/src/app/components/FormatModal.tsx'));
const record=read('frontend/src/app/pages/RecordPage.tsx',path.join(repo,'frontend/src/app/pages/RecordPage.tsx'));
const sayu=read('frontend/src/app/components/SayuModal.tsx',path.join(repo,'frontend/src/app/components/SayuModal.tsx'));
const service=read('frontend/src/app/services/firestoreService.ts',path.join(repo,'frontend/src/app/services/firestoreService.ts'));
const types=read('frontend/src/app/types/haruTypes.ts',path.join(repo,'frontend/src/app/types/haruTypes.ts'));
function method(name) {
  const n=unique(service,n=>ts.isMethodDeclaration(n)&&n.name.getText(service.ast)===name,name);
  return evaluate(`(function(${n.parameters.map(p=>p.getText(service.ast)).join(',')})${n.body.getText(service.ast)})`,{console:quiet,ratioToStatScore});
}
const ratioToStatScore=evaluate(`${text(types,declaration(types,'ratioToStatScore')).replace(/^export\s+/,'')};ratioToStatScore`,{});
(async()=>{
  for(const [version,file]of Object.entries(files)) {
    const formats=variable(file,'STATS_PROMPTS').initializer.properties.map(p=>p.name.getText(file.ast).replace(/['"]/g,''));
    assert.deepEqual([...formats].sort(),[...supported].sort());
    const cases=[];
    for(const scenario of scenarios) {
      const {fn,trace}=makeHandler(file,scenario);
      const data={text:scenario.noText?undefined:('input'in scenario?scenario.input:'합성 감사 원문입니다.'),format:scenario.format,mode:scenario.mode||'PREMIUM',...scenario.options};
      let value,error;
      try {value=await fn({auth:scenario.unauthenticated?null:{uid:'synthetic-user'},data});} catch(e){error=e.code;}
      assert.equal(error,scenario.error,`${version}:${scenario.name}:error`);
      assert.equal(trace.calls.length,scenario.calls,`${version}:${scenario.name}:calls`);
      if(!scenario.error) {
        assert.deepEqual(Object.keys(value).sort(),['aiComment','stats','text']);
        assert.equal(typeof value.text,'string');assert.equal(typeof value.aiComment,'string');
        if(supported.includes(scenario.format)&&!scenario.statsNull){assert.equal(typeof value.stats,'object');assert.ok(value.stats!==null&&!Array.isArray(value.stats));}else assert.equal(value.stats,null);
        if(scenario.commentEmpty)assert.equal(value.aiComment,'');
        assert.equal(trace.reserves,1);assert.equal(trace.rollbacks,0);assert.equal(trace.paidLogs,1);
      }
      if(scenario.rollback)assert.equal(trace.rollbacks,1);
      cases.push({name:scenario.name,calls:trace.calls,error:error||null,quotaReservations:trace.reserves,quotaRollbacks:trace.rollbacks,statsKind:value?(value.stats===null?'null':typeof value.stats):null,commentPresent:value?Boolean(value.aiComment):null});
    }
    result.server[version]={supportedFormats:formats,scenarioCount:cases.length,cases};
  }
  // Actual save filter (not a hand-written replica).
  const filterNode=unique(record,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='forEach'&&n.expression.expression.getText(record.ast)==='Object.entries(formatData)','RecordPage string filter');
  const filter=evaluate(`(function(formatData){const updateData={};let hasContent=false;${text(record,filterNode)};return updateData;})`,{});
  const payloads=[];
  const save=evaluate(`(${text(format,variable(format,'handleSaveSayu').initializer)})`,{
    console:quiet,isCleaningSessionUploadsRef:{current:false},toast:{warning:noop,success:noop,error:noop},formData:{memo_simple:'합성 원문',memo_title:'합성 사용자 제목',memo_ai_comment:'기존 합성 한마디'},
    getGrowthSaveFields:()=>({}),sayuKey:'memo_sayu',polishedContent:'합성 본문',imagesKey:'memo_images',uploadedImages:[],imageMetaKey:'memo_imageMeta',getUploadedImageMetaForSave:()=> '[]',prefix:'memo',polishStats:{positivity_ratio:4},sayuMode:'PREMIUM',format:'메모',crops:[],recordStyle:'simple',isStockFormat:false,setIsSaving:noop,setShowPolishModal:noop,navigate:noop,onSave:async value=>{payloads.push(structuredClone(value));return 'synthetic-record';}
  });
  await save();assert.equal(payloads.length,1);assert.equal(typeof payloads[0].memo_stats,'object');
  const retained=filter(payloads[0]);assert.equal('memo_stats'in retained,false);assert.equal(retained.memo_sayu,'합성 본문');assert.equal(retained.memo_title,'합성 사용자 제목');assert.equal(retained.memo_ai_comment,'기존 합성 한마디');
  assert.equal(retained.memo_polished,undefined);assert.equal(typeof retained.memo_polishedAt,'string');
  const stringRetained=filter({memo_sayu:'합성 본문',memo_stats:'{"positivity_ratio":4}'});assert.equal(typeof stringRetained.memo_stats,'string');
  result.client.formatSave={statsInPayload:'object',statsAfterParentFilter:'absent',existingAiCommentPreserved:true,polishedBooleanAfterFilter:'absent',originalAndBodyPreserved:true};
  // Actual repolish handler: text/comment used, stats ignored; empty comment preserves old value.
  for(const empty of [false,true]) {
    const stored={memo_ai_comment:'기존 합성 한마디',memo_stats:{positivity_ratio:2}};let request,patch;
    const repolish=evaluate(`(${text(sayu,variable(sayu,'handleRepolish').initializer)})`,{console:quiet,currentUser:{uid:'synthetic-user'},formatKey:'memo',format:'메모',recordDate:'synthetic-date',firestoreId:'synthetic-record',editedOriginalData:{memo_simple:'합성 원문'},setIsRefining:noop,showLoading:noop,hideLoading:noop,functions:{},db:{},doc:()=>({}),toast:{success:noop,error:noop},setEditedContent:noop,setLocalAiComment:noop,setViewMode:noop,httpsCallable:(_functions,name)=>{assert.equal(name,'polishContent');return async data=>{request=data;return {data:{text:'새 합성 본문',stats:{positivity_ratio:5},aiComment:empty?'':'새 합성 한마디'}};};},updateDoc:async(_ref,value)=>{patch=structuredClone(value);Object.assign(stored,value);}});
    await repolish();assert.ok(patch);assert.equal('memo_stats'in patch,false);assert.equal(stored.memo_stats.positivity_ratio,2);assert.equal(stored.memo_ai_comment,empty?'기존 합성 한마디':'새 합성 한마디');
    result.client[empty?'repolishEmptyComment':'repolishComment']={requestKeys:Object.keys(request),savedKeys:Object.keys(patch),existingStatsPreserved:true,oldCommentPreservedWhenEmpty:empty};
  }
  const bodyReads={};
  for(const name of ['handlePolishWithMode','handleReadingFinishClick','handleSaveChapterNote']) {
    const init=variable(format,name).initializer;
    bodyReads[name]=[...new Set(nodes(init,n=>ts.isPropertyAccessExpression(n)&&n.expression.getText(format.ast)==='responseData').map(n=>n.name.text))].sort();
  }
  assert.deepEqual(bodyReads.handlePolishWithMode,['stats','text']);assert.deepEqual(bodyReads.handleReadingFinishClick,['text']);assert.deepEqual(bodyReads.handleSaveChapterNote,['stats','text']);result.client.formatResponseReads=bodyReads;
  const diary=method('calculateDiaryStats'),basic=method('calculateBasicStats');
  const fixture=[{diary_good:'합성 좋았던 일',diary_conflict:'합성 갈등',diary_learning:'합성 배움'.repeat(20),diary_space:'합성 계획',diary_stats:{positivity_ratio:1,energy_level:1}}];
  const baseline=diary(fixture,'diary');const changed=structuredClone(fixture);changed[0].diary_stats={positivity_ratio:5,energy_level:5};
  assert.equal(JSON.stringify(baseline),JSON.stringify(diary(changed,'diary')));
  const empty=basic([{}],'memo','메모'),metadataOnly=basic([{memo_stats:{positivity_ratio:4}}],'memo','메모');
  assert.equal(empty.positivity_ratio,0);assert.equal(metadataOnly.positivity_ratio,1);
  result.client.statistics={diaryAiStatsValuesDoNotChangeComputedResult:true,basicEmptyPositivity:empty.positivity_ratio,basicMetadataOnlyPositivity:metadataOnly.positivity_ratio,caution:'Generic prefix-field presence can count stats metadata as content; do not widen storage blindly.'};
  assert.deepEqual(result.server.main.cases,result.server.deployedTs.cases);assert.deepEqual(result.server.main.cases,result.server.deployedJs.cases);
  result.status='all assertions passed';result.serverScenarioExecutions=Object.values(result.server).reduce((n,v)=>n+v.scenarioCount,0);
  fs.writeFileSync(process.argv[2]||path.join(__dirname,'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,serverScenarioExecutions:result.serverScenarioExecutions,perVersion:result.server.main.scenarioCount,client:result.client},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
