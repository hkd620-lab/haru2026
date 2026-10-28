import '../../src/styles/index.css';
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Toaster} from 'sonner';
import {FormatModal} from '../../src/app/components/FormatModal';
import {saveHouseholdEntries,loadHouseholdRecords} from '../../src/app/services/householdSaveService';
import {summarizeHouseholdEntries} from '../../src/app/utils/householdSummary';
import {getFirestore} from './firestore-sdk';

function App(){
 const [open,setOpen]=useState(false),[summary,setSummary]=useState('아직 저장하지 않았습니다.');
 return <MemoryRouter><div style={{padding:16}}><h1>가계부 중복 저장 검증</h1><p>합성 자료 · 로컬 Firestore 에뮬레이터만 사용</p><button onClick={()=>setOpen(true)}>가계부 작성</button><p aria-label="저장 결과">{summary}</p></div>
 <FormatModal isOpen={open} onClose={()=>setOpen(false)} format="HARU가계부" recordId="2026-10-05" onSave={async data=>{
  if(data.household_saveVersion!=='dedup-v1')throw new Error('중복 검사 없는 저장은 금지');
  const result=await saveHouseholdEntries(getFirestore(),'household-browser',JSON.parse(data.household_entries),JSON.parse(data.household_saveDecisions||'{}'));
  const records=await loadHouseholdRecords(getFirestore(),'household-browser');
  const entries=records.flatMap(r=>JSON.parse(r.data.household_entries||'[]'));
  setSummary(`저장된 거래 ${entries.length}건 · 지출 ${summarizeHouseholdEntries(entries).expense}원 · 신규 ${result.added}건 · 이미 저장 ${result.already}건 · 기존 거래 사용 ${result.skipped}건`);
  return result;
 }}/><Toaster/></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<App/>);
