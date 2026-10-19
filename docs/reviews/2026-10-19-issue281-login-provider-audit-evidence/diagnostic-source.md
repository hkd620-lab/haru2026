# 읽기 전용 진단 실행 원문

앱·시험·Rules 파일을 수정하지 않고 저장소 밖에서 실행했다. 진단은 원본 시험 통과 증거가 아니다. Node v26.8.2, esbuild는 기존 격리 검증본 의존성을 사용했다. 네트워크·실제 인증·운영 계정·서버 IO 없음.

## diagnose.cjs

실행: `node /private/tmp/haru-issue281-audit-evidence-20261019/diagnose.cjs`

```javascript
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { transformSync } = require('/private/tmp/haru-issue280-test-fix-20261019/frontend/node_modules/esbuild');
const root = '/private/tmp/haru-issue281-audit-20261019';
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const original = read('frontend/test/loginProviderStorage.policy.test.cjs');
const staticResults=[];
vm.runInNewContext(original, {
 require: name => name==='assert' ? (condition) => { staticResults.push(Boolean(condition)); } : require(name),
 __dirname:path.join(root,'frontend/test'), console:{log:()=>{}},
});
const src=read('frontend/src/app/contexts/AuthContext.tsx');
const utility=read('frontend/src/app/utils/loginProvider.ts');
const moduleObj={exports:{}};
const store=new Map();
let denied=false,warnings=0;
vm.runInNewContext(transformSync(utility,{loader:'ts',format:'cjs'}).code, {
 module:moduleObj,exports:moduleObj.exports,
 window:{localStorage:{getItem:key=>{if(denied)throw Error('fixture denied');return store.get(key)??null;},setItem:(key,value)=>{if(denied)throw Error('fixture denied');store.set(key,value);}}},
 console:{warn:()=>{warnings++;}},
});
const lib=moduleObj.exports;
const selectSource=src.match(/const loginProvider = ([^;]+);/)[1];
assert.equal(selectSource,'readRememberedLoginProvider(uid) ?? normalizeLoginProvider(data?.loginProvider)');
assert(src.includes('const uid = user.uid;'));
const select=new Function('uid','data','readRememberedLoginProvider','normalizeLoginProvider',`return ${selectSource};`);
const run=(uid,data)=>select(uid,data,lib.readRememberedLoginProvider,lib.normalizeLoginProvider);
const checks=[];
function check(name,fn){fn();checks.push({name,pass:true});}
check('known aliases normalize',()=>{assert.equal(lib.normalizeLoginProvider(' GOOGLE.com '),'google');assert.equal(lib.normalizeLoginProvider(' NAVER '),'naver');});
check('unknown/non-string normalizes to null',()=>{for(const value of ['unknown',null,3,{},''])assert.equal(lib.normalizeLoginProvider(value),null);});
check('storage key is per uid',()=>{lib.rememberLoginProviderLocally('fixture-a','kakao');assert.equal(store.get('haru.loginProvider.v1:fixture-a'),'kakao');assert.equal(lib.readRememberedLoginProvider('fixture-b'),null);});
check('snapshot local takes precedence over server',()=>assert.equal(run('fixture-a',{loginProvider:'google.com'}),'kakao'));
check('snapshot absent local falls back to normalized server',()=>assert.equal(run('fixture-b',{loginProvider:' GOOGLE.com '}),'google'));
check('snapshot invalid local falls back to server',()=>{store.set('haru.loginProvider.v1:fixture-b','invalid');assert.equal(run('fixture-b',{loginProvider:'naver'}),'naver');});
check('snapshot absent/invalid both returns null',()=>{assert.equal(run('fixture-b',{}),null);assert.equal(run('fixture-b',{loginProvider:'invalid'}),null);assert.equal(run('fixture-b',undefined),null);});
check('storage denied read returns null and selection falls back',()=>{denied=true;assert.equal(run('fixture-a',{loginProvider:'password'}),'password');lib.rememberLoginProviderLocally('fixture-c','naver');denied=false;assert(warnings>=2);assert.equal(store.has('haru.loginProvider.v1:fixture-c'),false);});
const mapSource=src.slice(src.indexOf('const mapUser ='),src.indexOf('\nfunction getAuthErrorMessage'));
const mapUser=new Function('readRememberedLoginProvider','normalizeLoginProvider','mergeProviderIds',transformSync(mapSource,{loader:'ts'}).code+'; return mapUser;')(lib.readRememberedLoginProvider,lib.normalizeLoginProvider,lib.mergeProviderIds);
check('initial mapUser primary Firebase provider precedes remembered',()=>{const user=mapUser({uid:'fixture-a',providerData:[{providerId:'google.com'}],email:null});assert.equal(user.providerId,'google');assert(user.providerIds.includes('kakao'));});
check('initial custom mapUser falls back to remembered',()=>{const user=mapUser({uid:'fixture-a',providerData:[],email:null});assert.equal(user.providerId,'kakao');});
console.log(JSON.stringify({scope:'read-only offline diagnosis; does not change or pass original policy test',staticAssertions:{total:staticResults.length,pass:staticResults.filter(Boolean).length,fail:staticResults.filter(x=>!x).length,failingOrdinal1Based:staticResults.map((v,i)=>v?null:i+1).filter(Boolean)},selectionSource:selectSource,checks},null,2));
```

## history-diagnosis.cjs

실행: `node /private/tmp/haru-issue281-audit-evidence-20261019/history-diagnosis.cjs`

```javascript
const {execFileSync}=require('node:child_process');
const vm=require('node:vm');
const path=require('node:path');
const root='/private/tmp/haru-issue281-audit-20261019';
const get=(ref,p)=>execFileSync('git',['show',`${ref}:${p}`],{cwd:root,encoding:'utf8'});
const results=[];
for(const ref of ['897313a2^','897313a2','75a6d849']) {
 const file='frontend/test/loginProviderStorage.policy.test.cjs';
 const source=get(ref,file);
 try {
  vm.runInNewContext(source,{__dirname:path.join(root,'frontend/test'),require:name=>name==='fs'?{readFileSync:p=>get(ref,path.relative(root,p))}:require(name),console:{log:()=>{}}},{filename:`${ref}/${file}`});
  results.push({ref,pass:true});
 } catch(error) {results.push({ref,pass:false,message:error.message});}
}
console.log(JSON.stringify(results,null,2));
```
