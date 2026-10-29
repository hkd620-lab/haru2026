import '../../src/styles/index.css';
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Toaster} from 'sonner';
import {FormatModal} from '../../src/app/components/FormatModal';
import {summarizeHouseholdEntries} from '../../src/app/utils/householdSummary';
import {getFirestore,onSnapshot,collection} from './firestore-sdk';

function App(){
 const [open,setOpen]=useState(false),[summary,setSummary]=useState('아직 저장하지 않았습니다.');
 useEffect(()=>onSnapshot(collection(getFirestore(),'users','household-browser','records'),snapshot=>{
  const entries=snapshot.docs.flatMap(doc=>JSON.parse(doc.data().household_entries||'[]'));
  setSummary(`저장된 거래 ${entries.length}건 · 지출 ${summarizeHouseholdEntries(entries).expense}원`);
 }),[]);
 return <MemoryRouter><div style={{padding:16}}><h1>가계부 중복 저장 검증</h1><p>합성 자료 · 로컬 Firestore 에뮬레이터만 사용</p><button onClick={()=>setOpen(true)}>가계부 작성</button><p aria-label="저장 결과">{summary}</p></div>
 <FormatModal isOpen={open} onClose={()=>setOpen(false)} format="HARU가계부" recordId="2026-10-05" onSave={async data=>{
  throw new Error('가계부는 일반 콜백을 거치면 안 됩니다.');
 }}/><Toaster/></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<App/>);
