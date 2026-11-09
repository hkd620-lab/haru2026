import '../../src/styles/index.css';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { HaruLawPage } from '../../src/app/pages/HaruLawPage';
import { state, emit } from './mocks';
function Controls() {
  const [, update] = useState(0);
  useEffect(() => { const listener = () => update(n => n + 1); window.addEventListener('law-fixture', listener); return () => window.removeEventListener('law-fixture', listener); }, []);
  return <aside style={{padding:8,fontSize:12,background:'#eee'}}>격리 검증 · 운영 연결 없음
    <label><input type="checkbox" onChange={e => { state.failSearch = e.target.checked; }} />검색 실패</label>
    <label><input type="checkbox" onChange={e => { state.failSave = e.target.checked; }} />저장 실패</label>
    <button onClick={() => { const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()); state.records[`users/fixture-law-owner/records/${date}`] = {content:'보존할 기존 원문',formats:['일기'],weather:'비',temperature:'쌀쌀',photoUrls:['기존 사진']}; emit(); }}>기존 기록 준비</button>
    <details><summary>검증 데이터</summary><pre>{JSON.stringify(state,null,2)}</pre></details>
  </aside>;
}
function Home() { const navigate = useNavigate(); return <button onClick={() => navigate('/haru-law'+location.search,{state:{from:'/v2'}})}>하루LAW 열기</button>; }
function Saved() { const location = useLocation(); return <><h1>사유 저장 완료</h1><pre>{JSON.stringify({route:location.state,...state},null,2)}</pre></>; }
createRoot(document.getElementById('root')!).render(<><Controls/><BrowserRouter><Routes><Route path="/v2" element={<Home/>}/><Route path="/sayu" element={<Saved/>}/><Route path="*" element={<HaruLawPage/>}/></Routes></BrowserRouter><Toaster/></>);
