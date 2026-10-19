import React,{useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {suite,fixture,detail,resetCalls,state,stats,delay,text} from './bench';
const root=createRoot(document.getElementById('probe'));
function Baseline({f,tick}){const r=detail(f.record,f.modal);return <span>{tick}:{r.map(x=>x.id).join(',')}</span>;}
function MemoProbe({f,tick}){const r=useMemo(()=>detail(f.record,f.modal),[f.record,f.modal]);return <span>{tick}:{r.map(x=>x.id).join(',')}</span>;}
async function renders(){
  const rows=[];
  for(const mode of ['baseline','memo-stable','memo-cloned-record','closed-retained','closed-reset']){
    const base=fixture(100000);const Component=mode.startsWith('memo')?MemoProbe:Baseline;
    if(mode==='closed-retained')base.modal.isOpen=false;
    if(mode==='closed-reset'){base.record=undefined;base.modal={isOpen:false,content:''} as any;}
    flushSync(()=>root.render(null));resetCalls();const durations=[];
    for(let i=0;i<6;i++){
      const f=mode==='memo-cloned-record'?{...base,record:{...base.record}}:base;
      const t=performance.now();flushSync(()=>root.render(<Component f={f} tick={i}/>));durations.push(performance.now()-t);await delay();
    }
    rows.push({mode,renderCount:6,...state(),...stats(durations)});
  }
  // Verify that changing the same record's text through immutable input triggers a fresh result.
  const f=fixture(10000);flushSync(()=>root.render(null));resetCalls();
  flushSync(()=>root.render(<MemoProbe f={f} tick={0}/>));
  const g={...f,record:{...f.record,memo_content:'강아지'},modal:{...f.modal,content:'강아지',originalData:{memo_content:'강아지'}}};
  flushSync(()=>root.render(<MemoProbe f={g} tick={1}/>));
  const invalidation={...state(),visible:document.getElementById('probe').textContent};
  return {rows,invalidation};
}
document.getElementById('run').onclick=async()=>{
  const button=document.getElementById('run') as HTMLButtonElement;button.disabled=true;
  const status=document.getElementById('status');const longTasks=[];
  const observer='PerformanceObserver'in window?new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(x=>({startTime:x.startTime,duration:x.duration})))):null;
  if(PerformanceObserver.supportedEntryTypes.includes('longtask'))observer.observe({type:'longtask',buffered:false});
  try{
    const result=await suite(message=>status.textContent=message);
    const renderResult=await renders();await new Promise(resolve=>setTimeout(resolve,100));observer?.disconnect();
    const output={userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,viewport:{width:innerWidth,height:innerHeight},fixture:'synthetic memo; exact extracted detail recommendation expression; production React; not full SayuPage E2E',results:result,renders:renderResult,longTasks};
    document.getElementById('results').textContent=JSON.stringify(output,null,2);
    const response=await fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(output)});
    if(!response.ok)throw Error('Result write failed');status.textContent='완료: Chrome 계측 결과 저장됨';
  }catch(error){status.textContent=String(error);throw error;}
};
