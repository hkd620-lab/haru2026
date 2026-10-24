const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path');
const repo=path.resolve(process.argv[2] || process.cwd());
const req=createRequire(path.join(repo,'frontend/package.json'));
const {transformSync}=req('esbuild');
const root=path.join(repo,'frontend/src/app/');
const read=p=>fs.readFileSync(root+p,'utf8');
function handler(source,name){const start=source.indexOf('  const '+name+' ='); assert(start>=0); const end=source.indexOf('\n  };',start)+6; assert(end>start); return source.slice(start,end);}
function run(code,context){vm.runInNewContext(transformSync(code,{loader:'ts'}).code,context);}
const parent=handler(read('pages/RecordPage.tsx'),'handleSaveFormatData');
const modal=handler(read('components/FormatModal.tsx'),'handleSaveOriginalAsSayu');
async function saveScenario(kind){
 const records=new Map(), writes=[], messages=[], navigations=[], saving=[], finished=[];
 let first=true;
 const data={_recordId:'synthetic-draft-fixed',_recordDate:'2026-10-24',diary_title:'synthetic retry',diary_simple:'synthetic retained body'};
 const base={console:{error(){},warn(){}},toast:{error:x=>messages.push(x),warning:x=>messages.push(x),success:x=>messages.push(x)}};
 const p={...base,user:{uid:'synthetic-user'},savedDateStr:'2026-10-24',weather:'',temperature:'',mood:'',selectedFormats:['일기'],draftEditorRecordId:data._recordId,db:{},doc:(_, ...path)=>path.join('/'),getDoc:async path=>({exists:()=>records.has(path.split('/').pop())}),setDoc:async(path,value)=>{writes.push(value.id); records.set(value.id,value);},firestoreService:{saveRecord:async(_,value)=>{writes.push(value.id);if(first&&kind==='before'){first=false;throw new Error('synthetic unavailable before commit');}records.set(value.id,value);if(first&&kind==='after'){first=false;throw new Error('synthetic response lost after commit');}return value.id;}},finishDraftAfterSave:id=>finished.push(id)};
 run(parent+'\nglobalThis.save=handleSaveFormatData;',p);
 const m={...base,isCleaningSessionUploadsRef:{current:false},isLedgerFormat:false,isHouseholdFormat:false,isStockFormat:false,formData:data,format:'일기',prefix:'diary',recordStyle:'simple',sayuKey:'diary_sayu',imagesKey:'diary_images',imageMetaKey:'diary_imageMeta',uploadedImages:[],getGrowthSaveFields:()=>({}),getUploadedImageMetaForSave:()=>[],setIsSaving:x=>saving.push(x),onSave:d=>p.save(d),navigate:(...x)=>navigations.push(x)};
 run(modal+'\nglobalThis.save=handleSaveOriginalAsSayu;',m);
 const original=JSON.stringify(data);
 await m.save();
 assert.equal(navigations.length,0);assert.equal(finished.length,0);assert.equal(saving.at(-1),false);assert.equal(JSON.stringify(data),original);assert(messages.includes('저장에 실패했습니다.'));
 await m.save();
 assert.equal(records.size,1);assert.equal(new Set(writes).size,1);assert.equal(finished.length,1);assert.equal(navigations.length,1);assert.equal(navigations[0][0],'/sayu');assert.equal(navigations[0][1].state.openRecordId,data._recordId);assert.equal(records.get(data._recordId).diary_sayu,data.diary_simple);assert.equal(saving.at(-1),false);assert.equal(records.get(data._recordId).date,'2026-10-24');
 console.log('PASS original production handlers: '+kind+' failure -> preserve input, reset saving, retry same ID, one record, original SAYU, correct navigation');
}
async function statsScenario(file){
 const source=read(file);const start=source.indexOf('  useEffect(() => {');const end=source.indexOf('\n  }, [',start);assert(start>=0&&end>start);
 const effect=source.slice(start,end)+'\n  }, []);';let callback;const state={records:undefined,failed:undefined};let fail=true;
 const context={user:{uid:'synthetic-user'},subscriptionLoading:false,locked:false,validFormat:true,previous:{start:'2026-09-01'},range:{end:'2026-10-24'},console:{warn(){}},setRecords:x=>state.records=x,setLoadFailed:x=>state.failed=x,useEffect:fn=>callback=fn,firestoreService:{getRecordsInRange:async(...args)=>{assert.equal(args[3].throwOnError,true);if(fail)throw new Error('synthetic unavailable');return [{id:'test'}];}}};
 run(effect,context); callback();await new Promise(setImmediate);assert.equal(state.failed,true);assert.equal(state.records,null);
 fail=false; callback();await new Promise(setImmediate);assert.equal(state.failed,false);assert.equal(state.records.length,1);
 console.log('PASS production effect '+file+': rejection remains error/null, next effect clears error and recovers records');
}
(async()=>{await saveScenario('before');await saveScenario('after');await statsScenario('pages/StatisticsPage.tsx');await statsScenario('pages/FormatStatisticsPage.tsx');})().catch(e=>{console.error(e);process.exitCode=1;});
