import assert from 'node:assert/strict';
import {test, after} from 'node:test';
import {initializeApp, deleteApp} from 'firebase/app';
import {getStorage, connectStorageEmulator, ref, uploadBytes, getBytes, deleteObject} from 'firebase/storage';
const host=process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if(!host || !/^127\.0\.0\.1:\d+$/.test(host))throw Error('loopback Storage emulator required');
const projectId='demo-haru-law-20261105';
const apps=[];
function client(uid){const app=initializeApp({projectId,storageBucket:projectId+'.appspot.com',apiKey:'synthetic-key'},'law-rules-'+(uid||'anon'));apps.push(app);const storage=getStorage(app);const [hostname,port]=host.split(':');connectStorageEmulator(storage,hostname,Number(port),uid?{mockUserToken:{sub:uid,user_id:uid}}:undefined);return storage;}
const owner=client('fixture-law-owner'), stranger=client('fixture-law-stranger'), anon=client(null);
after(async()=>{await Promise.all(apps.map(deleteApp));});
const prefix='users/fixture-law-owner/haruLawAttachments/rules-'+Date.now();
for(const [extension,mimeType]of [['pdf','application/pdf'],['hwp','application/x-hwp'],['hwpx','application/vnd.hancom.hwpx'],['txt','text/plain'],['png','image/png']]){
 test(`본인 ${extension} 업로드·읽기·삭제 허용, 타인·익명 접근 차단`,async()=>{
  const path=prefix+'/fixture.'+extension;
  await uploadBytes(ref(owner,path),new Uint8Array([1,2,3]),{contentType:mimeType});
  assert.equal((await getBytes(ref(owner,path))).byteLength,3);
  for(const storage of [stranger,anon]){
   await assert.rejects(uploadBytes(ref(storage,path),new Uint8Array([1]),{contentType:mimeType}),e=>e.code==='storage/unauthorized');
   await assert.rejects(getBytes(ref(storage,path)),e=>e.code==='storage/unauthorized');
   await assert.rejects(deleteObject(ref(storage,path)),e=>e.code==='storage/unauthorized');
  }
  await deleteObject(ref(owner,path));
 });
}
test('문서 8MiB 초과·임의 ZIP/실행 MIME·다른 경로의 권한 확장은 차단한다',async()=>{
 for(const mimeType of ['text/plain','application/x-hwp','application/vnd.hancom.hwpx'])await assert.rejects(uploadBytes(ref(owner,prefix+'/large'),new Uint8Array(8*1024*1024+1),{contentType:mimeType}),e=>e.code==='storage/unauthorized');
 for(const mimeType of ['application/zip','application/octet-stream','application/x-msdownload'])await assert.rejects(uploadBytes(ref(owner,prefix+'/blocked'),new Uint8Array([1]),{contentType:mimeType}),e=>e.code==='storage/unauthorized');
 await assert.rejects(uploadBytes(ref(owner,'users/other/haruLawAttachments/x/test.txt'),new Uint8Array([1]),{contentType:'text/plain'}),e=>e.code==='storage/unauthorized');
});
