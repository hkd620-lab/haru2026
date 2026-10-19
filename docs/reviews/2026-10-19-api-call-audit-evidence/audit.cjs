// Read-only source extraction + in-memory SDK/AI stubs. No application imports or network clients.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const deps=process.env.HARU_AUDIT_DEPS;
if(!deps)throw Error('Set HARU_AUDIT_DEPS to an existing node_modules directory');
const requireParser=createRequire(path.join(deps,'@babel/parser/package.json'));
const parser=requireParser('./lib/index.js');
const requireEsbuild=createRequire(path.join(deps,'esbuild/package.json'));
const esbuild=requireEsbuild('./lib/main.js');
const repo=path.resolve(__dirname,'../../..');
const filenames={server:'functions/src/index.ts',format:'frontend/src/app/components/FormatModal.tsx',record:'frontend/src/app/pages/RecordPage.tsx',sayu:'frontend/src/app/pages/SayuPage.tsx',detail:'frontend/src/app/components/SayuModal.tsx',voiding:'frontend/src/app/pages/SayuHealthVoidingPage.tsx'};
const files=Object.fromEntries(Object.entries(filenames).map(([k,p])=>[k,{path:p,text:fs.readFileSync(path.join(repo,p),'utf8')}]))
for(const f of Object.values(files))f.ast=parser.parse(f.text,{sourceType:'module',plugins:['typescript','jsx']});
function all(node,predicate,out=[]){if(!node||typeof node!=='object')return out;if(predicate(node))out.push(node);for(const [key,value]of Object.entries(node)){if(['loc','start','end','extra','comments','tokens'].includes(key))continue;if(Array.isArray(value))value.forEach(x=>all(x,predicate,out));else if(value&&typeof value==='object')all(value,predicate,out);}return out;}
function named(file,name,type='VariableDeclarator'){const nodes=all(file.ast,n=>n.type===type&&(n.id?.name===name));assert.equal(nodes.length,1,name);return nodes[0];}
const cut=(file,node)=>file.text.slice(node.start,node.end);
const out={base:'9141f7f37fa9ff7e41baae977f9a594de649d603',method:'AST-extracted current code, isolated vm, fake AI and in-memory records; no cloud/API calls',sources:{},checks:{}};
for(const f of Object.values(files))out.sources[f.path]=crypto.createHash('sha256').update(f.text).digest('hex');
for(const [key,file,name]of [['formatHandleSubmit',files.format,'handleSubmit'],['sayuObserveKwTarget',files.sayu,'observeKwTarget']]){
  const refs=all(file.ast,n=>n.type==='Identifier'&&n.name===name);
  out.checks[key]={identifierOccurrences:refs.length,lines:refs.map(x=>x.loc.start.line)};
  assert.equal(refs.length,1,`${name} expected declaration only`);
}
const statsNode=named(files.server,'STATS_PROMPTS');
out.checks.supportedStatsFormats=statsNode.init.properties.map(x=>x.key.name||x.key.value);
out.checks.newsExportNames=files.server.ast.program.body.filter(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.type==='VariableDeclaration').flatMap(n=>n.declaration.declarations.map(d=>d.id?.name)).filter(name=>/news/i.test(name));
assert.equal(out.checks.newsExportNames.includes('fetchTopNews'),false);
const handlerNode=name=>named(files.server,name).init.arguments.at(-1);
const make=(text,context)=>new vm.Script(esbuild.transformSync(text,{loader:'ts',target:'es2022'}).code).runInNewContext(context);
const statsSource=cut(files.server,statsNode);
const validTitle=cut(files.server,named(files.server,'isValidTitle','FunctionDeclaration'));
const statsFunction=cut(files.server,named(files.server,'analyzeStats','FunctionDeclaration'));
const mapping={'일기':'diary','에세이':'essay','선교보고':'mission','일반보고':'report','업무일지':'work','여행기록':'travel','텃밭일지':'garden','애완동물관찰일지':'pet','육아일기':'child','메모':'memo'};
class HttpsError extends Error{}
const noop=async()=>{};
const common={HttpsError,console:{log(){},warn(){},error(){}},logger:{warn(){},error(){}},AI_USAGE_PLAN:'mock',DEVELOPER_UIDS:new Set(),isInternalDeveloperUid:()=>true,formatPrefixesOf:names=>names.map(x=>mapping[x]),buildFormatPrefixMap:names=>Object.fromEntries(names.map(x=>[x,mapping[x]])),getAiRoute:purpose=>({model:'mock-model',provider:'mock'}),logAiUsage:noop,logPaidServiceUsage:noop,enforceRateLimit:noop,reserveMonthlyAiQuota:async()=>({mock:true}),rollbackMonthlyAiQuotaReservation:noop,getAiUsageErrorCode:()=> 'mock-error',buildAiCommentPrompt:()=> 'synthetic comment prompt'};
function polishHandler(trace){return make(`const ${statsSource};${statsFunction};const handler=${cut(files.server,handlerNode('polishContent'))};handler`,{...common,callAi:async({purpose})=>{trace.push(purpose);return {inputTokens:0,outputTokens:0,text:()=>purpose==='recordStats'?'{"energy_level":3}':purpose==='sayuPolishComment'?'모의 한마디':'모의 본문'};}});}
const filterNodes=all(files.record.ast,n=>n.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&n.callee.property?.name==='forEach'&&n.callee.object?.type==='CallExpression'&&n.callee.object.callee?.object?.name==='Object'&&n.callee.object.callee?.property?.name==='entries'&&n.callee.object.arguments?.[0]?.name==='formatData');
assert.equal(filterNodes.length,1);
const filter=make(`(function(formatData){const updateData={};let hasContent=false;${cut(files.record,filterNodes[0])};return updateData;})`,{});
const generated=all(files.voiding.ast,n=>n.type==='VariableDeclarator'&&n.id?.name==='generated'&&cut(files.voiding,n.init).includes('res.data.result'));
assert.equal(generated.length,1);
const consumeVoiding=make(`(function(res){return ${cut(files.voiding,generated[0].init)}})`,{});
(async()=>{
  const results={};
  for(const format of ['memo','reading','voiding']){
    const trace=[];
    const value=await polishHandler(trace)({auth:{uid:'synthetic-user'},data:{text:'합성 기록입니다.',format,mode:'PREMIUM'}});
    results[format]={calls:trace,returnedFields:Object.keys(value),statsIsNull:value.stats===null,statsType:typeof value.stats,aiComment:value.aiComment};
    assert.equal(trace.length,format==='memo'?3:2);
    if(format==='memo'){
      const persisted=filter({memo_sayu:value.text,memo_stats:value.stats});
      assert.deepEqual(Object.keys(persisted),['memo_sayu']);
      out.checks.statsPersistence={sourceFilterLine:filterNodes[0].loc.start.line,inputFields:['memo_sayu','memo_stats(object)'],retainedFields:Object.keys(persisted)};
    }
    if(format==='voiding'){
      assert.equal(consumeVoiding({data:value}),'');
      out.checks.voidingResponse={consumerLine:generated[0].loc.start.line,serverReturnsText:value.text,consumerReadsResult:consumeVoiding({data:value}),callsBeforeRejectedResponse:trace.length};
    }
  }
  out.checks.polish=results;
  async function backfill(record){
    const trace=[];let writes=0;
    const snapshot={docs:[{id:'synthetic-record',data:()=>({...record}),ref:{update:async value=>{writes++;Object.assign(record,value);}}}]};
    const chain={doc:()=>chain,collection:()=>chain,limit:()=>chain,get:async()=>snapshot};
    const context={...common,db:{collection:()=>chain},callAi:async({purpose})=>{trace.push(purpose);return{text:()=> '모의 제목'};}};
    const fn=make(`${validTitle};const handler=${cut(files.server,handlerNode('generateTitlesForAll'))};handler`,context);
    const first=await fn({auth:{uid:'synthetic-user'}});const firstCalls=trace.length;
    const second=await fn({auth:{uid:'synthetic-user'}});
    return {firstCount:first.count,secondCount:second.count,firstCalls,secondCalls:trace.length-firstCalls,writes,manualTitle:record.memo_title||null,aiTitle:record.memo_ai_title||null};
  }
  out.checks.backfill={noTitle:await backfill({formats:['메모'],memo_simple:'합성 원문입니다.'}),manualTitle:await backfill({formats:['메모'],memo_simple:'합성 원문입니다.',memo_title:'사용자 제목'}),existingAiTitle:await backfill({formats:['메모'],memo_simple:'합성 원문입니다.',memo_ai_title:'기존 생성 제목'})};
  assert.equal(out.checks.backfill.noTitle.firstCalls,1);assert.equal(out.checks.backfill.noTitle.secondCalls,1);
  assert.equal(out.checks.backfill.manualTitle.firstCalls,0);assert.equal(out.checks.backfill.manualTitle.secondCalls,0);
  assert.equal(out.checks.backfill.existingAiTitle.firstCalls,1);
  out.status='all assertions passed';
  fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify(out.checks,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
