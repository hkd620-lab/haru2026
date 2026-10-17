import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {readSelectedRecordPhotos,readSelectedPhotoAttachments} from '../src/app/services/selectedRecordPhoto.ts';
const source=readFileSync(new URL('../src/app/components/FormatModal.tsx',import.meta.url),'utf8');
for(const name of ['handleBookTextOcrUpload','handleStockOcrPhotoSelect','handleLedgerOcrPhotoSelect','handleHouseholdOcrPhotoSelect'])test(`${name} captures before clearing and deferred OCR`,async()=>{
 const handler=source.match(new RegExp(`  const ${name} = [\\s\\S]*?\\n  };`))[0];const code=transformSync(`${handler}\nglobalThis.run=${name};`,{loader:'ts'}).code;
 let started=false,reset=false,selected=[];const choose=v=>{selected=typeof v==='function'?v([]):v;};
 const input={set value(v){assert.equal(started,true);reset=true;}};
 const ctx={readSelectedRecordPhotos,File,Math,format:'독서사유',isStockFormat:true,isLedgerFormat:true,selectedHouseholdOcrFiles:[],setSelectedBookOcrFiles:choose,setSelectedStockOcrFiles:choose,setSelectedLedgerOcrFiles:choose,setSelectedHouseholdOcrFiles:choose,setLedgerOcrResult(){},clearBookOcrInput(){input.value='';},clearStockOcrInput(){input.value='';},clearLedgerOcrInput(){input.value='';},householdOcrInputRef:{current:input},toast:{error(){},warning(){},success(){}}};
 vm.runInNewContext(code,ctx);const picker={name:'camera.heic',type:'',get size(){throw new Error('provider size queried');},get lastModified(){throw new Error('provider timestamp queried');},stream(){assert.equal(reset,false);started=true;return new Blob(['photo']).stream();}};
 await ctx.run({target:{files:[picker]}});assert.equal(selected.length,1);assert.equal(selected[0].type,'image/heic');assert.equal(await selected[0].text(),'photo');
});
test('LAW photos read immediately while PDF identity is preserved',async()=>{const started=[];const photo=i=>({type:'',name:`${i}.heic`,get size(){throw new Error('provider metadata queried');},stream(){started.push(i);return new Blob(['photo']).stream();}});const pdf={type:'application/pdf',name:'original.pdf',size:42};const pending=readSelectedPhotoAttachments([photo(1),pdf,photo(2)]);assert.deepEqual(started,[1,2]);const files=await pending;assert.equal(files[1],pdf);assert.equal(files[0].type,'image/heic');});
test('batch selection retains readable photos alongside failed photos',async()=>{const errors=[];const files=await readSelectedRecordPhotos([{name:'bad.jpg',type:'image/jpeg',stream(){throw new Error('NotReadableError');}},new File(['ok'],'good.jpg',{type:'image/jpeg'})],m=>errors.push(m));assert.equal(files.length,1);assert.equal(errors.length,1);assert.equal(await files[0].text(),'ok');});
