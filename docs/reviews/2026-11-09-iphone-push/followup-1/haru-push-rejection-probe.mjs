import { registerDeviceForPush } from '/private/tmp/haru-iphone-push-repair-20261109/frontend/src/app/services/pushDevice.ts';
let earlyRejection=false;
process.once('unhandledRejection',()=>{earlyRejection=true;});
const result=await registerDeviceForPush({
 getPermission:()=> 'default',
 requestPermission:()=>Promise.reject(new Error('synthetic permission request denied')),
 isSupported:()=>new Promise(resolve=>setTimeout(()=>resolve(true),25)),
 getVapidKey:()=> 'synthetic-public-key',
 getSwRegistration:async()=>undefined,
 getToken:async()=> 'synthetic-token',
 saveToken:async()=>{},cacheToken:()=>{}
});
await new Promise(resolve=>setTimeout(resolve,0));
console.log(JSON.stringify({result,earlyUnhandledRejection:earlyRejection,syntheticOnly:true}));
