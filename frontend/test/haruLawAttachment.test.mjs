import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getHaruLawFileMime, readHaruLawSelectedFiles, HARULAW_DOCUMENT_MAX_BYTES, HARULAW_ATTACHMENT_ACCEPT} from '../src/app/utils/haruLawAttachment.ts';
test('선택기는 PDF·한글·텍스트 확장자를 포함하고 브라우저별 빈 MIME도 인식한다',()=>{
 for(const [name,mime]of [['a.PDF','application/pdf'],['한글.hwp','application/x-hwp'],['한글.hwpx','application/vnd.hancom.hwpx'],['글.txt','text/plain']])assert.equal(getHaruLawFileMime({name,type:''}),mime);
 for(const extension of ['.pdf','.hwp','.hwpx','.txt'])assert.ok(HARULAW_ATTACHMENT_ACCEPT.includes(extension));
});
test('문서 원본 바이트·파일명은 보존하고 업로드 MIME만 정규화한다',async()=>{
 const files=[new File(['한글 본문'],'본문.txt'),new File([new Uint8Array([208,207,17,224])],'원본.hwp'),new File(['PK'],'원본.hwpx')];
 const result=await readHaruLawSelectedFiles(files);
 for(let i=0;i<files.length;i++){assert.equal(result[i].name,files[i].name);assert.deepEqual(await result[i].arrayBuffer(),await files[i].arrayBuffer());}
 assert.equal(result[0].type,'text/plain');assert.equal(result[1].type,'application/x-hwp');
});
test('사진 읽기는 즉시 시작하고 PDF는 기존 identity를 유지한다',async()=>{
 const started=[];const photo={name:'photo.heic',type:'',get size(){throw Error('provider metadata');},stream(){started.push(1);return new Blob(['photo']).stream();}};
 const pdf=new File(['%PDF'],'원본.pdf',{type:'application/pdf'});
 const pending=readHaruLawSelectedFiles([photo,pdf,new File(['본문'],'본문.txt')]);assert.deepEqual(started,[1]);const files=await pending;assert.equal(files[1],pdf);assert.equal(files[0].type,'image/heic');
});
test('한글·텍스트 8MiB 초과는 업로드 전에 거부한다',async()=>{
 await assert.rejects(readHaruLawSelectedFiles([{name:'큰.hwp',type:'',size:HARULAW_DOCUMENT_MAX_BYTES+1}]),/8MiB/);
});
