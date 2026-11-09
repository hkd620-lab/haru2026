import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AiLibraryClassificationPanel } from '../../src/app/components/AiLibraryClassificationPanel';
import type { ClassificationApi, ClassificationPlan, ClassificationJob } from '../../src/app/services/aiLibraryClassificationService';
const wait = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));
const state = { enabled: true, failCapability: false, changed: false, changedApproval: false, noProgress: false, lost: false, delay: 0, calls: [] as {action:string; data?:any}[], plan: null as ClassificationPlan | null, job: null as ClassificationJob | null };
const api: ClassificationApi = {
 async capability() { state.calls.push({action:'capability'}); if(state.failCapability) throw Error('offline'); return {enabled:state.enabled}; },
 async prepare(input) { state.calls.push({action:'prepare',data:input}); const records = Array.from({length:22},(_,i) => ({id:`synthetic-${i}`,contentHash:`c${i}`,payloadHash:`p${i}`,reason:i===21?'synthetic_excluded':null})); const plan = {manifestHash:'a'.repeat(64),manifest:{owner:'synthetic-classification',model:'jev-1.14.0',policy:'ai-library-reviewed-v1',expiresAt:input.expiresAt,budgetMicrousd:input.budgetMicrousd,records},consentVersion:'typesafe-reviewed-retention-v1',destination:'TypeSafe AI / https://api.typesafe.ai/v1/systemone',retentionNotice:'합성 시험: 기본 계정 무보관 보장 없음',reservationMicrousd:2753}; state.plan=plan; state.job={manifestHash:plan.manifestHash,owner:plan.manifest.owner,cancelled:false,reservedMicrousd:0,items:records.map(row=>({...row,status:row.reason?'skipped':'pending'}))}; return plan; },
 async review(hash,offset) { state.calls.push({action:'review',data:{hash,offset}}); const items=state.plan!.manifest.records.slice(offset,offset+20).map(row=>({...row,payloadHash:state.changed?'wrong':row.payloadHash,text:`실제 개인정보가 없는 합성 전송 본문 ${row.id}`})); return {items,nextOffset:offset+20<22?offset+20:null}; },
 async approve(hash,hashes,consentVersion) { state.calls.push({action:'approve',data:{hash,hashes,consentVersion}}); return {manifestHash:state.changedApproval?'b'.repeat(64):hash,approved:true}; },
 async step(hash) { state.calls.push({action:'step',data:hash}); await wait(state.delay || 5); if(state.lost) throw Error('lost response'); const job=state.job!; if(!job.cancelled && !state.noProgress) {const item=job.items.find(row=>row.status==='pending'); if(item){item.status='applied';job.reservedMicrousd+=2753;}} return structuredClone(job); },
 async status(hash) { state.calls.push({action:'status'}); return {manifestHash:hash,job:structuredClone(state.job)}; },
 async cancel() { state.calls.push({action:'cancel'}); if(state.job)state.job.cancelled=true; return {cancelled:true}; },
 async recover() { state.calls.push({action:'recover'}); return {recovered:true}; },
};
function App(){
 const [revision,setRevision]=useState(0),[uid,setUid]=useState('synthetic-classification'),[results,setResults]=useState<string[]>([]),[testing,setTesting]=useState(false);
 async function run(){
  setTesting(true);const out:string[]=[];
  const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);out.push('PASS '+label);setResults([...out]);};
  const root=()=>document.querySelector('#classification-fixture')!;
  const button=(text:string)=>Array.from(root().querySelectorAll('button')).find(el=>el.textContent===text)!;
  const field=(label:string)=>root().querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
  const change=(label:string,value:string)=>{const el=field(label); const prototype=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
  async function reset(){sessionStorage.removeItem('haru-classification-job:synthetic-classification');state.calls=[];state.plan=null;state.job=null;state.enabled=true;state.failCapability=state.changed=state.changedApproval=state.noProgress=state.lost=false;state.delay=0;setUid('synthetic-classification');setRevision(n=>n+1);await wait();}
  async function prepare(){change('분류 범위','all');change('총 실행 한도 (USD)','1');change('승인 유효 시간','1');await wait();button('전송 계획 만들기').click();await wait();}
  async function approve(){field('이 페이지 본문 검토 확인').click();await wait();button('다음 본문').click();await wait();field('이 페이지 본문 검토 확인').click();await wait();field('정확한 계획 전송 동의').click();await wait();button('검토한 계획 승인').click();await wait();}
  try{
   await reset();state.enabled=false;setRevision(n=>n+1);await wait();check(root().textContent?.includes('잠겨')&&!button('전송 계획 만들기'),'비활성 잠금 및 실행 경로 없음');
   await reset();state.failCapability=true;setRevision(n=>n+1);await wait();check(root().textContent?.includes('잠겨')&&state.calls.every(row=>row.action==='capability'),'서버 미배포/오류 시 기록 읽기 fallback 없음');
   await reset();check(button('전송 계획 만들기').disabled,'범위 예산 만료 직접 선택 전 차단');await prepare();check(button('검토한 계획 승인').disabled&&button('승인 범위 전체 실행').disabled,'검토 동의 승인 없는 실행 차단');
   field('이 페이지 본문 검토 확인').click();await wait();check(field('정확한 계획 전송 동의').disabled,'첫 페이지 확인만으로 전체 동의 불가');button('다음 본문').click();await wait();check(root().textContent?.includes('synthetic_excluded'),'제외 사유 표시');field('이 페이지 본문 검토 확인').click();await wait();field('정확한 계획 전송 동의').click();await wait();button('검토한 계획 승인').click();button('검토한 계획 승인').click();await wait();
   const sent=state.calls.filter(row=>row.action==='approve');check(sent.length===1&&sent[0].data.hashes.length===21&&sent[0].data.consentVersion==='typesafe-reviewed-retention-v1'&&sent[0].data.hash==='a'.repeat(64),'정확한 manifest/payload 해시 동의 및 중복 클릭 차단');
   button('승인 범위 전체 실행').click();button('승인 범위 전체 실행').click();await wait(700);check(state.calls.filter(row=>row.action==='step').length===21&&root().textContent?.includes('반영 21개'),'한 번의 시작으로 순차 전체 실행 및 중복 dispatch 차단');
   const before=state.calls.filter(row=>row.action==='step').length;setRevision(n=>n+1);await wait();check(button('승인 범위 전체 실행').disabled&&state.calls.filter(row=>row.action==='step').length===before,'새로고침 시 자동 재개 없음');
   button('작업 취소 후 새 계획').click();await wait();check(!!button('전송 계획 만들기')&&!sessionStorage.getItem('haru-classification-job:synthetic-classification'),'재로드 작업 취소 후 새 계획 가능');
   await prepare();state.plan!.manifest.expiresAt=1;button('다음 본문').click();await wait();check(button('승인 범위 전체 실행').disabled,'만료 계획 실행 차단');button('작업 취소 후 새 계획').click();await wait();check(!!button('전송 계획 만들기'),'만료 계획 닫고 새 계획 가능');
   await reset();state.changed=true;await prepare();check(!field('이 페이지 본문 검토 확인')&&button('승인 범위 전체 실행').disabled,'변경된 payload 해시 검토 거부');
   await reset();await prepare();state.changedApproval=true;await approve();check(button('승인 범위 전체 실행').disabled&&root().textContent?.includes('확인 필요'),'다른 manifest 승인 응답 거부');
   await reset();await prepare();await approve();state.noProgress=true;button('승인 범위 전체 실행').click();await wait(100);check(state.calls.filter(row=>row.action==='step').length===1,'진행 없는 응답은 반복 호출 없이 중지');
   await reset();await prepare();await approve();state.lost=true;button('승인 범위 전체 실행').click();await wait(150);check(state.calls.filter(row=>row.action==='step').length===1&&state.calls.some(row=>row.action==='status')&&root().textContent?.includes('확인 필요')&&button('승인 범위 전체 실행').disabled,'응답 유실 시 한 번만 dispatch, readonly 상태 조회, 재실행 잠금');
   await reset();await prepare();await approve();state.delay=180;button('승인 범위 전체 실행').click();await wait(20);button('일시 중지').click();await wait(230);check(state.calls.filter(row=>row.action==='step').length===1,'일시 중지는 다음 dispatch 차단');
   button('승인 범위 전체 실행').click();await wait(20);button('작업 취소').click();button('작업 취소').click();await wait(230);check(state.calls.filter(row=>row.action==='cancel').length===1&&state.calls.filter(row=>row.action==='step').length===2&&button('승인 범위 전체 실행').disabled,'진행 중 취소 및 중복 취소 차단');
   button('작업 취소 후 새 계획').click();await wait();check(!!button('전송 계획 만들기'),'취소된 작업에서 새 계획 가능');
   await reset();await prepare();await approve();state.delay=180;button('승인 범위 전체 실행').click();await wait(20);setUid('another-synthetic-user');await wait(230);check(!root().textContent?.includes('반영 1개')&&state.calls.filter(row=>row.action==='step').length===1,'계정 변경 시 다음 dispatch 및 이전 응답 차단');
   out.push('ALL PASSED');
  }catch(error){out.push('FAIL '+(error as Error).message);}
  setResults([...out]);setTesting(false);
 }
 return <main><h1>분류 실행 합성 UI 검증</h1><p>실제 Firebase·기록·AI 네트워크 없음. 명시적 가짜 API만 주입합니다.</p><button disabled={testing} onClick={run}>분류 합성 검증 실행</button><pre id="classification-results">{results.join('\n')}</pre><div id="classification-fixture"><AiLibraryClassificationPanel key={revision} uid={uid} api={api}/></div></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
