const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const Module = require('node:module');
const {hwp,hwpx}=require('./fixtures/haruLawDocument.cjs');
const fixtures=new Map(), uploads=[];
const fakeFirestore=Object.assign(()=>({collection:()=>({doc:()=>({set:async()=>{},delete:async()=>{}})})}),{FieldValue:{serverTimestamp:()=>0},Timestamp:{fromMillis:x=>x}});
const originalLoad=Module._load;
Module._load=function(name,parent,isMain){
 if(name==='firebase-admin')return {apps:[{}],firestore:fakeFirestore};
 if(name==='firebase-admin/storage')return {getStorage:()=>({bucket:()=>({file:path=>({getMetadata:async()=>[{contentType:fixtures.get(path).mime,size:fixtures.get(path).bytes.length}],download:async({destination})=>fs.writeFile(destination,fixtures.get(path).bytes)})})})};
 if(name==='@google/genai')return {GoogleGenAI:class{files={upload:async({file,config})=>{uploads.push({mime:config.mimeType,text:await fs.readFile(file,'utf8')});return{name:config.name,uri:'https://example.invalid/synthetic-file'};}}}};
 if(name==='firebase-functions/v2/scheduler')return {onSchedule:(_options,fn)=>fn};
 return originalLoad.call(this,name,parent,isMain);
};
const {prepareHaruLawAttachments,removePreparedHaruLawAttachments,uploadPreparedHaruLawAttachments}=require('../lib/haruLaw/haruLawAttachments');
Module._load=originalLoad;
const prefix='users/fixture-owner/haruLawAttachments/draft/';
test('원본 문서 MIME·경로는 보존하고 추출한 한글 본문을 기존 Gemini File 경로에 전달한다',async()=>{
 const docs=[['text/plain','fixture.txt',Buffer.from('텍스트 원문')],['application/x-hwp','fixture.hwp',hwp('한글 원문',1)],['application/vnd.hancom.hwpx','fixture.hwpx',await hwpx('<hp:sec xmlns:hp="urn:fixture"><hp:p><hp:run><hp:t>HWPX 원문</hp:t></hp:run></hp:p></hp:sec>')]];
 const refs=docs.map(([mime,fileName,bytes])=>{const storagePath=prefix+fileName;fixtures.set(storagePath,{mime,bytes});return{storagePath,mimeType:mime,fileName};});
 const originals=docs.map(d=>Buffer.from(d[2]));
 const prepared=await prepareHaruLawAttachments('fixture-owner',refs,Date.now()+10000);
 try{
  assert.deepEqual(prepared.attachmentMeta,refs);
  assert.deepEqual(prepared.files.map(f=>f.mimeType),['text/plain','text/plain','text/plain']);
  const parts=await uploadPreparedHaruLawAttachments('synthetic',prepared,'fixture',[],Date.now()+10000);
  assert.equal(parts.length,3);assert.ok(parts.every(p=>p.fileData.mimeType==='text/plain'));
  for(const [index,word]of ['텍스트 원문','한글 원문','HWPX 원문'].entries()){
   assert.match(uploads[index].text,new RegExp(word));assert.deepEqual(fixtures.get(refs[index].storagePath).bytes,originals[index]);
  }
 }finally{await removePreparedHaruLawAttachments(prepared);}
 await assert.rejects(fs.stat(prepared.tempDir),{code:'ENOENT'});
});
test('타인 경로·손상 문서·8MiB 초과 메타데이터는 AI 전송 전에 거부한다',async()=>{
 await assert.rejects(prepareHaruLawAttachments('other',[{storagePath:prefix+'fixture.txt',mimeType:'text/plain',fileName:'fixture.txt'}],Date.now()+5000),e=>e.code==='permission-denied');
 for(const [name,mime,bytes]of [['bad.hwp','application/x-hwp',Buffer.from('bad')],['large.txt','text/plain',Buffer.alloc(8*1024*1024+1)]]){
  fixtures.set(prefix+name,{mime,bytes});await assert.rejects(prepareHaruLawAttachments('fixture-owner',[{storagePath:prefix+name,mimeType:mime,fileName:name}],Date.now()+5000),e=>e.code==='invalid-argument');
 }
 assert.equal(uploads.length,3);
});
