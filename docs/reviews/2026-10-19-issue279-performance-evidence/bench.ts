import { recommend, detail, buildRecommendationTextFromFields, resetCalls, calls, lastLength } from './source-adapter';
export { detail, resetCalls };
export const state = () => ({ calls, lastLength });
export const delay = () => new Promise(resolve => setTimeout(resolve, 0));
const seed = '오늘은 조용히 창밖을 바라보며 지난 시간을 떠올렸다. ';
export function text(n, kind='tail') {
  const body=seed.repeat(Math.ceil(n/seed.length)).slice(0,n);
  if(kind==='none')return body;
  if(kind==='head')return '소송 임대차 보증금. '+body;
  if(kind==='near')return '불안정한 상태. 걱정돼요요. 강아지나라. '.repeat(Math.ceil(n/26)).slice(0,n);
  return body+' 소송 임대차 보증금.';
}
export const stats = (samples:number[]) => {const s=[...samples].sort((a,b)=>a-b);return {p50:s[Math.ceil(s.length*.5)-1],p95:s[Math.ceil(s.length*.95)-1],max:s.at(-1),samples};};
async function measure(fn, n=20, warm=3) {
  for(let i=0;i<warm;i++){fn();await delay();}
  const samples=[]; let output;
  for(let i=0;i<n;i++){const t=performance.now();output=fn();samples.push(performance.now()-t);await delay();}
  return {...stats(samples),ids:output?.map(x=>x.id)};
}
export function fixture(n, ai=false) {
  const raw=text(n);
  const record:any={id:'synthetic',formats:['메모'],memo_content:raw};
  if(ai)record.memo_sayu=text(Math.floor(n/2));
  return {record,modal:{isOpen:true,firestoreId:'synthetic',formatKey:'memo',format:'메모',content:record.memo_sayu||raw,originalData:{memo_content:raw}}};
}
export async function suite(notify=(_message:string)=>{}) {
  const rows=[];
  for(const n of [1000,10000,100000,1000000]){
    notify(`순수 함수 ${n}자`);
    const source=text(n);
    rows.push({kind:'tail',length:source.length,...await measure(()=>recommend(source,['메모']))});
  }
  for(const kind of ['none','head','near']){
    notify(`입력 분포 ${kind}`);const source=text(100000,kind);
    rows.push({kind,length:source.length,...await measure(()=>recommend(source,['메모']))});
  }
  const composition=[];
  for(const n of [10000,100000])for(const ai of [false,true]){
    notify(`상세 결합 ${n}자 AI=${ai}`);const f=fixture(n,ai);
    const result=await measure(()=>detail(f.record,f.modal));
    composition.push({rawLength:f.record.memo_content.length,ai,combinedLength:lastLength,...result});
  }
  // Separate diagnostic. Timer/proxy overhead is excluded from uninstrumented rows.
  const Original=globalThis.RegExp;const originalTest=Original.prototype.test;
  let constructors=0,tests=0,constructionMs=0,searchMs=0;
  globalThis.RegExp=new Proxy(Original,{construct(target,args){const t=performance.now();const r=Reflect.construct(target,args);constructionMs+=performance.now()-t;constructors++;return r;}});
  Original.prototype.test=function(source){const t=performance.now();const r=originalTest.call(this,source);searchMs+=performance.now()-t;tests++;return r;};
  const phaseSource=text(100000);let totalMs=0;
  try{const t=performance.now();recommend(phaseSource,['메모']);totalMs=performance.now()-t;}finally{globalThis.RegExp=Original;Original.prototype.test=originalTest;}
  const phases={length:phaseSource.length,constructors,tests,constructionMs,searchMs,totalMs};
  const caching=[];
  const source=text(100000);const baseline=await measure(()=>recommend(source,['메모']));
  const cache=new Map();
  globalThis.RegExp=new Proxy(Original,{construct(target,args){const key=JSON.stringify(args);if(!cache.has(key))cache.set(key,Reflect.construct(target,args));return cache.get(key);}});
  try{caching.push({mode:'constructors-only',...await measure(()=>recommend(source,['메모']))});}finally{globalThis.RegExp=Original;}
  caching.unshift({mode:'baseline',...baseline});
  const formatting=await measure(()=>[{id:buildRecommendationTextFromFields({one:source,two:source,three:source}).length}],20,3);
  return {rows,composition,phases,caching,joinOnly:formatting};
}
