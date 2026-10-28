import '../../src/styles/index.css';
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Toaster} from 'sonner';
import {FormatModal} from '../../src/app/components/FormatModal';
import {SayuModal} from '../../src/app/components/SayuModal';
import {read,write} from './sdk';
import {buildDraftEditorData} from '../../src/app/records/writeBeforeFormat';
const emptyTimeline:any[]=[];
function App(){
const [mode,setMode]=useState(new URLSearchParams(location.search).has('edit')?'edit':''), [format,setFormat]=useState<any>('에세이');
const data=read(), key=format==='일기'?'diary':'essay';
const isDraft=new URLSearchParams(location.search).has('draft');
const draftData=React.useMemo(()=>({...buildDraftEditorData(format, '합성 초안 첫 줄\n작성한 글을 그대로 이어갑니다.', '2026-10-28', 'photo-qa'),[key+'_images']:JSON.stringify([location.origin+'/photo.svg?id=draft'])}),[format,key]);
return <MemoryRouter><div style={{padding:12,fontFamily:'sans-serif'}}><h2>사진 5장 격리 검증</h2><p>합성 사진·로컬 모의 저장, 운영 연결 없음</p>
<select aria-label="기록형식" value={format} onChange={e=>setFormat(e.target.value)}><option>에세이</option><option>일기</option></select>
<button onClick={()=>setMode('new')}>신규 기록</button><button onClick={()=>setMode('edit')}>저장 기록 열기</button>
<p>저장된 사진: {JSON.parse(data[key+'_images']||'[]').length}장</p></div>
<FormatModal isOpen={mode==='new'} onClose={()=>setMode('')} format={format} recordId="photo-qa" initialWritingDraft={isDraft} initialData={isDraft?draftData:data} onSave={async fields=>{write(fields);setMode('');}}/>
<SayuModal timelineItems={emptyTimeline} isOpen={mode==='edit'} onClose={()=>setMode('')} content={data[key+'_sayu']||'합성 시험 본문'} originalData={data} format={format} formatKey={key} dateLabel="2026-10-22" recordDate="2026-10-22" firestoreId="photo-qa" images={JSON.parse(data[key+'_images']||'[]')} onSave={async()=>true}/><Toaster/>
</MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<App/>);
