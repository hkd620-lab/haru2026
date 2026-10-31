import { getRecordPhotoLimit } from '../src/app/services/recordPhotoLimit.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { readSelectedRecordPhoto } from '../src/app/services/selectedRecordPhoto.ts';
import { compressRecordPhoto } from '../src/app/services/recordPhotoCompression.ts';
import { persistRecordPhoto } from '../src/app/services/recordPhotoUploadCore.ts';
const source=readFileSync(new URL('../src/app/components/SayuModal.tsx',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('  const handleImageUpload = async'),source.indexOf('  const removeTimelineItem'));
const code=transformSync(`${handler}\nglobalThis.run=handleImageUpload;`,{loader:'ts'}).code;
function fixture(images=['old-photo'], formatKey='diary'){
 const state={reads:0,uploads:0,conversions:0,deletes:0,stored:null,committed:null,busy:[],notices:[]};
 const ctx={File,Date,Math,Error,readSelectedRecordPhoto,compressRecordPhoto,persistRecordPhoto,
 currentUser:{uid:'fixture'},firestoreId:'record',formatKey,recordPhotoLimit:getRecordPhotoLimit(formatKey),recordDate:'2026-10-17',isUploadingImage:false,TIMELINE_IMAGE_MAX_WIDTH:1600,TIMELINE_IMAGE_QUALITY:0.82,localImages:images,RECORD_IMAGE_MAX_BYTES:20*1024*1024,
 setIsUploadingImage:v=>state.busy.push(v),storage:{},db:{},isHeicLikeFile:f=>/heic|heif/.test(f.type),isSupportedRecordImage:f=>f.type.startsWith('image/'),
 readOriginalImageMeta:async f=>{assert.equal(await f.text(),'photo');return{takenDate:'2020-01-02'};},
 compressImage:async (f,width,quality)=>{assert.equal(width,1600);assert.equal(quality,0.82);if(state.failLocal&&f.type==='image/heic')throw new Error('unsupported');return new Blob(['jpeg']);},
 convertHeicRecordImage:async f=>{state.conversions++;assert.equal(await f.text(),'photo');return new Blob(['jpeg']);},
 ref:(_,path)=>({fullPath:path}),doc:(...a)=>a,uploadBytes:async()=>{state.uploads++;},getDownloadURL:async()=> 'new-photo',deleteObject:async()=>{state.deletes++;},
 getDoc:async()=>({exists:()=>true,data:()=>({})}),parseUploadedImageMeta:()=>[],updateDoc:async(_,payload)=>{if(state.failSave)throw new Error('save-failed');state.stored=payload;},
 setLocalImages:v=>{state.committed=v;},retryPendingRecordPhotoCleanup:async()=>{},enqueuePendingRecordPhotoCleanup(){},refreshPublicSharedRecord:async()=>{},console:{error(){}},
 toast:Object.fromEntries(['error','warning','success','info'].map(k=>[k,v=>state.notices.push([k,v])]))};
 vm.runInNewContext(code,ctx);
 const picker=(type,name)=>({type,name,get size(){throw new Error('provider metadata queried');},get lastModified(){throw new Error('provider timestamp queried');},stream(){state.reads++;if(state.failRead)throw new Error('NotReadableError');return new Blob(['photo']).stream();}});
 return{state,picker,ctx,run:f=>ctx.run({target:{files:[f],value:'selected'}})};
}
for(const[type,name]of[['image/jpeg','iphone.jpg'],['','android.heic']])test(`edit snapshots ${name} once and commits old/new photos and EXIF`,async()=>{
 const f=fixture();await f.run(f.picker(type,name));assert.equal(f.state.reads,1);assert.equal(f.state.uploads,1);assert.equal(f.state.conversions,0);
 assert.deepEqual(JSON.parse(f.state.stored.diary_images),['old-photo','new-photo']);assert.equal(JSON.parse(f.state.stored.diary_imageMeta)[0].takenDate,'2020-01-02');assert.deepEqual(Array.from(f.state.committed),['old-photo','new-photo']);assert.deepEqual(f.state.busy,[true,false]);
});
test('edit HEIC failure falls back to server exactly once',async()=>{const f=fixture();f.state.failLocal=true;await f.run(f.picker('image/heic','photo.heic'));assert.equal(f.state.conversions,1);assert.equal(f.state.uploads,1);assert.ok(f.state.stored);});
test('read failure uploads nothing and permits retry',async()=>{const f=fixture();f.state.failRead=true;await f.run(f.picker('image/jpeg','photo.jpg'));assert.equal(f.state.uploads,0);assert.equal(f.state.committed,null);assert.deepEqual(f.state.busy,[true,false]);assert.match(f.state.notices.at(-1)[1],/원본을 읽지 못했습니다/);f.state.failRead=false;await f.run(f.picker('image/jpeg','photo.jpg'));assert.equal(f.state.uploads,1);});
test('save failure rolls back only the new object without changing old photos',async()=>{const f=fixture();f.state.failSave=true;await f.run(f.picker('image/jpeg','photo.jpg'));assert.equal(f.state.deletes,1);assert.equal(f.state.committed,null);assert.equal(f.state.notices.some(([k])=>k==='success'),false);});

for (const plan of ['basic', 'premium']) test(`${plan}: edit persists fifth photo, reopens all five and blocks sixth`, async () => {
 const f=fixture(['1','2','3','4']); f.ctx.subscription={plan};
 await f.run(f.picker('image/jpeg','fifth.jpg'));
 const saved=JSON.parse(f.state.stored.diary_images);
 assert.deepEqual(saved,['1','2','3','4','new-photo']);
 const reopened=fixture(saved);
 await reopened.run(reopened.picker('image/jpeg','sixth.jpg'));
 assert.equal(reopened.state.uploads,0);
 assert.match(reopened.state.notices.at(-1)[1],/최대 5장/);
 reopened.ctx.localImages=saved.filter(url=>url!=='3');
 await reopened.run(reopened.picker('image/jpeg','replacement.jpg'));
 assert.equal(JSON.parse(reopened.state.stored.diary_images).length,5);
});
test('existing ledger records retain their ten-photo allowance in edit',async()=>{
 const f=fixture(Array.from({length:9},(_,i)=>String(i)),'ledger');
 await f.run(f.picker('image/jpeg','tenth.jpg'));
 assert.equal(JSON.parse(f.state.stored.ledger_images).length,10);
});
