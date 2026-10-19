# 읽기 전용 성능·계약 진단 원문

Node v26.8.2/Apple M4의 합성문장 로컬 진단. 운영/AI/실제 사용자 데이터 없음. 앱·시험 파일 수정 없음. 기존 검증본의 tsx loader로 최신 main 원문을 읽었다.

## recommendation-baseline.mjs

`node --import /private/tmp/haru-issue281-test-fix-20261019/frontend/node_modules/tsx/dist/loader.mjs /private/tmp/haru-remaining-followups-20261019/recommendation-baseline.mjs`

```javascript
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { getAssistantRecommendations as recommend } from '/private/tmp/haru-issue279-main-audit-20261019/frontend/src/app/utils/assistantRecommendations.ts';
const ids=(text)=>recommend(text,['메모']).map(x=>x.id);
const neutral='오늘은 평범한 하루였다. 창문을 열고 하늘을 보았다. ';
const samples=[];
for(const length of [1000,10000,100000,1000000]) {
 const text=neutral.repeat(Math.ceil(length/neutral.length)).slice(0,length)+' 소송 임대차 보증금';
 for(let i=0;i<5;i++) recommend(text,['메모']);
 const times=[];
 for(let i=0;i<30;i++){const start=performance.now();recommend(text,['메모']);times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);
 const OriginalRegExp=globalThis.RegExp;let count=0;
 try {globalThis.RegExp=class extends OriginalRegExp {constructor(...args){super(...args);count++;}};recommend(text,['메모']);}
 finally {globalThis.RegExp=OriginalRegExp;}
 samples.push({utf16Length:text.length,p50ms:times[14],p95ms:times[28],regexConstructionsPerCall:count,result:ids(text)});
}
const cases=['참기름 냄새가 고소하고 좋다','호박을 수확했다','호박 보석 목걸이','고추를 심었다','고추 참치 캔을 샀다','직원 교육을 받았다','일본 여행을 준비한다','일본어를 공부한다','건강검진표를 받았다','건강검진을 받았다','준비 정리 계획','소송ㅠ','소송 ㅠ','소송ㅋ','소송 ㅋ'].map(text=>({syntheticText:text,result:ids(text)}));
console.log(JSON.stringify({baseline:'4433a043265359f4446a5ffac9d93e942c50464c',runtime:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model,warmupsPerSize:5,samplesPerSize:30,scope:'single-process warm Node microbenchmark; not browser/mobile render E2E or a product budget',samples,cases},null,2));
```

## regex-cost-probe.mjs

`node --import /private/tmp/haru-issue281-test-fix-20261019/frontend/node_modules/tsx/dist/loader.mjs /private/tmp/haru-remaining-followups-20261019/regex-cost-probe.mjs`

```javascript
import {performance} from 'node:perf_hooks';
import {getAssistantRecommendations as recommend} from '/private/tmp/haru-issue279-main-audit-20261019/frontend/src/app/utils/assistantRecommendations.ts';
const Original=globalThis.RegExp;
const results=[];
for(const length of [10000,100000]) {
 const text='오늘은 평범한 하루였다. 창문을 열고 하늘을 보았다. '.repeat(Math.ceil(length/33)).slice(0,length)+' 소송 임대차 보증금';
 for(const mode of ['original','cached-constructor','skip-scan-diagnostic']) {
  const cache=new Map();
  if(mode==='cached-constructor') globalThis.RegExp=class extends Original {constructor(pattern,flags){const key=pattern+'\0'+flags;if(cache.has(key))return cache.get(key);super(pattern,flags);cache.set(key,this);}};
  if(mode==='skip-scan-diagnostic') globalThis.RegExp=class extends Original {test(){return false;}};
  try{
   for(let i=0;i<5;i++)recommend(text,['메모']);
   const times=[];for(let i=0;i<20;i++){const s=performance.now();recommend(text,['메모']);times.push(performance.now()-s);}
   times.sort((a,b)=>a-b);results.push({length:text.length,mode,p50ms:times[9],p95ms:times[18],result:recommend(text,['메모']).map(x=>x.id)});
  }finally{globalThis.RegExp=Original;}
 }
}
console.log(JSON.stringify({scope:'process-memory diagnostics only; cached mode is not an implementation change; skip-scan intentionally does not preserve outputs',results},null,2));
```
