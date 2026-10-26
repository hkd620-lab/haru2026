const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),{execFileSync}=require('node:child_process');
const dir='/private/tmp/haru-polish-preservation-v2';
const paths={old:'/Users/heogyeongdae/Developer/HARU2026',new:'/Users/heogyeongdae/.codex/worktrees/title-luna/HARU2026'};
const req=createRequire(paths.old+'/functions/package.json');const ts=req('typescript');
const {formatPrefixesOf}=req(paths.old+'/functions/lib/formats/formatRegistry.js');
const displays={diary:'일기',essay:'에세이',travel:'여행기록',garden:'텃밭일지',pet:'애완동물관찰일지',child:'육아일기',work:'업무일지',memo:'메모',report:'일반보고'};
function find(ast,name,predicate){let out;function visit(n){if(predicate(n)&&n.name?.getText(ast)===name)out=n;ts.forEachChild(n,visit);}visit(ast);if(!out)throw new Error('Missing '+name);return out;}
function compile(expression){return ts.transpileModule('('+expression+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;}
const code={};
for(const [version,repo] of Object.entries(paths)){
 const server=fs.readFileSync(repo+'/functions/src/index.ts','utf8'),client=fs.readFileSync(repo+'/frontend/src/app/components/FormatModal.tsx','utf8');
 const sa=ts.createSourceFile('index.ts',server,ts.ScriptTarget.Latest,true),ca=ts.createSourceFile('FormatModal.tsx',client,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 code[version]={server:compile(find(sa,'polishContent',ts.isVariableDeclaration).initializer.arguments.at(-1).getText(sa)),client:compile(find(ca,'handlePolishWithMode',ts.isVariableDeclaration).initializer.getText(ca))};
}
async function makeRequest(version,c,mode){
 let payload;
 const noop=()=>{};
 const fctx={isPolishing:false,setSayuMode:noop,setShowModeSelect:noop,setIsPolishing:noop,toast:{info:noop,error:noop,success:noop},getFunctions:()=>({}),httpsCallable:()=>async p=>{payload=p;return{data:{text:'synthetic',stats:null}};},formData:{[c.format+'_simple']:c.text},recordStyle:'simple',prefix:c.format,format:displays[c.format],DIARY_PREMIUM_FIELDS:[],fields:[],setPolishedContent:noop,setPolishStats:noop,setShowPolishModal:noop,console:{error:noop,warn:noop,log:noop}};
 await vm.runInNewContext(code[version].client,fctx)(mode);
 if(!payload)throw new Error('Client request not produced');
 let captured;
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const sctx={HttpsError,formatPrefixesOf,getAiRoute:()=>({model:'capture'}),DEVELOPER_UIDS:new Set(['synthetic-developer']),AI_USAGE_PLAN:'developer',console:{log:noop,warn:noop,error:noop},logger:{warn:noop},enforceRateLimit:async()=>{},reserveMonthlyAiQuota:async()=>({synthetic:true}),rollbackMonthlyAiQuotaReservation:async()=>{},getAiUsageErrorCode:()=>'',logAiUsage:async()=>{},logPaidServiceUsage:async()=>{},analyzeStats:async()=>null,buildAiCommentPrompt:()=>'',callAi:async request=>{captured=request;return {inputTokens:1,outputTokens:1,text:()=> 'synthetic'};}};
 await vm.runInNewContext(code[version].server,sctx)({auth:{uid:'synthetic-developer'},data:payload});
 if(!captured?.systemInstruction)throw new Error('System prompt not captured');
 return {input:captured.input,systemInstruction:captured.systemInstruction,purpose:captured.purpose,clientPayload:payload};
}
const base=JSON.parse(fs.readFileSync('/private/tmp/haru-polish-compare-20261026/cases.json'));
const fresh=[
 {id:'fresh-smell',format:'diary',text:'꽃가게 앞을 지나왔어요. 유리문은 닫혀 있었고 꽃냄새는 맡지 못했어요. 어떤 꽃인지도 잘 모르겠어요. 예쁘다는 생각은 했어요. 딱 그 정도였어요.'},
 {id:'fresh-quote',format:'diary',text:'동생이 "다 괜찮아질 거야"라고 했어요. 제가 그렇게 믿는다는 말은 아니에요. 그냥 동생 말을 들었다는 기록이에요. 지금은 불안한 것도 안심한 것도 아니고, 잘 모르겠어요.'},
 {id:'fresh-dry',format:'essay',text:'버스를 한 대 놓쳤다. 뛰지 않았다. 다음 차를 탔다. 그래서 지각한 건 아니다. 이 일을 여유나 성장 같은 말로 포장할 마음도 없다.'},
 {id:'fresh-future',format:'travel',text:'내일 제주도에 갈까 생각만 했어요. 비행기 표는 안 샀어요. 아직 간 적도 없고요. 친구가 먼저 제안한 여행이라 제 의견은 더 생각해 보고 말하기로 했어요.'},
 {id:'fresh-short',format:'diary',text:'컵을 씻었다. 물은 차갑지 않았다. 기분은 그냥 그랬다.'},
 {id:'fresh-uncertainty',format:'diary',text:'옛집 사진을 봤어요. 사진 속 계절은 모르겠어요. 날씨도 기억이 안 나요. 눈물이 난 건 아니에요. 그 집에서 살던 때가 좋았냐고 물으면, 좋을 때도 싫을 때도 있었다고 답하겠어요.'}
];
const jobs=[];
for(const c of base)for(const version of ['old','new'])for(const repeat of [1,2])for(const provider of ['gemini','openai'])jobs.push({c,version,repeat,provider,mode:'PREMIUM',cohort:'paired'});
for(const c of fresh)for(const repeat of [1,2])for(const provider of ['gemini','openai'])jobs.push({c,version:'new',repeat,provider,mode:'PREMIUM',cohort:'fresh'});
for(const id of ['diary-uncertain','essay-banmal','work-numbers','long-mixed'])jobs.push({c:base.find(c=>c.id===id),version:'new',repeat:1,provider:'openai',mode:'BASIC',cohort:'basic-live'});
// 12*2*2*2 + 6*2*2 + 4 = 124; all inputs are synthetic and both versions include the actual client envelope.
(async()=>{
 const prepared=[];for(const job of jobs)prepared.push({...job,request:await makeRequest(job.version,job.c,job.mode)});
 fs.writeFileSync(dir+'/inputs.json',JSON.stringify({base,fresh,requests:prepared.map(({c,request,...rest})=>({...rest,id:c.id,...request}))},null,2));
 if(process.argv.includes('--dry-run')){console.log(JSON.stringify({calls:prepared.length,cohorts:{paired:96,fresh:24,basicLive:4},newBasicRoute:prepared.find(j=>j.mode==='BASIC').request.purpose,newPrompt:prepared.find(j=>j.version==='new').request.systemInstruction}));return;}
 const keys={};for(const name of ['OPENAI_API_KEY','GEMINI_API_KEY']){try{keys[name]=execFileSync('/opt/homebrew/bin/gcloud',['secrets','versions','access','latest','--secret',name,'--project','haru2026-8abb8'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:25000}).trim();}catch{console.log('Secret access failed');process.exit(2);}}
 const rows=[];const resultPath=dir+'/results.jsonl';fs.writeFileSync(resultPath,'');let cost=0,halt=false;
 for(let i=0;i<prepared.length&&!halt;i+=4){
  const batch=await Promise.all(prepared.slice(i,i+4).map(async({c,request,...job})=>{
   const provider=job.provider,model=provider==='openai'?'gpt-6-luna':'gemini-3.1-flash-lite';
   const url=provider==='openai'?'https://api.openai.com/v1/chat/completions':`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
   const body=provider==='openai'?{model,messages:[{role:'system',content:request.systemInstruction},{role:'user',content:request.input}],reasoning_effort:'none',max_completion_tokens:4096}:{systemInstruction:{parts:[{text:request.systemInstruction}]},contents:[{role:'user',parts:[{text:request.input}]}],generationConfig:{maxOutputTokens:4096}};
   const headers=provider==='openai'?{Authorization:`Bearer ${keys.OPENAI_API_KEY}`}:{'x-goog-api-key':keys.GEMINI_API_KEY};
   const start=Date.now(),base={id:c.id,...job,model,purpose:request.purpose};
   try{const response=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const d=await response.json();if(!response.ok)return {...base,status:response.status,errorCode:d.error?.code||d.error?.status,ms:Date.now()-start};
    const text=(provider==='openai'?d.choices?.[0]?.message?.content:d.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join(''))||'';const u=d.usage||d.usageMetadata||{};const input=provider==='openai'?u.prompt_tokens:u.promptTokenCount,output=provider==='openai'?u.completion_tokens:(u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0),cached=provider==='openai'?(u.prompt_tokens_details?.cached_tokens||0):(u.cachedContentTokenCount||0);const costUsd=((input-cached)*(provider==='openai'?.1:.25)+cached*(provider==='openai'?.01:.025)+output*(provider==='openai'?.5:1.5))/1e6;
    return {...base,status:200,text,ms:Date.now()-start,inputTokens:input,outputTokens:output,costUsd,finish:provider==='openai'?d.choices?.[0]?.finish_reason:d.candidates?.[0]?.finishReason};
   }catch(error){return {...base,error:error.name,ms:Date.now()-start};}
  }));
  for(const r of batch){rows.push(r);fs.appendFileSync(resultPath,JSON.stringify(r)+'\n');cost+=r.costUsd||0;}
  halt=cost>1||batch.some(r=>[401,402,403,404].includes(r.status));console.log(JSON.stringify({completed:rows.length,total:prepared.length,errors:rows.filter(r=>r.status!==200).length,costUsd:cost,halt}));
 }
 const groups=[];for(const version of ['old','new'])for(const provider of ['gemini','openai']){const r=rows.filter(r=>r.version===version&&r.provider===provider);groups.push({version,provider,count:r.length,successful:r.filter(x=>x.status===200).length,costUsd:r.reduce((a,x)=>a+(x.costUsd||0),0),truncated:r.filter(x=>x.status===200&&!['stop','STOP'].includes(x.finish)).length});}
 fs.writeFileSync(dir+'/summary.json',JSON.stringify({calls:rows.length,planned:prepared.length,groups},null,2));console.log(JSON.stringify(groups));
})();
