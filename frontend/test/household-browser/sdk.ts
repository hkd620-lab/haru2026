export * from '../record-photos-browser/sdk';
import {httpsCallable as original} from '../record-photos-browser/sdk';
let calls=0;
const listeners=new Set<()=>void>();
export const householdCallableCount=()=>calls;
export const subscribeHouseholdCalls=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const httpsCallable=(functions:unknown,name:string)=>{
 const invoke=name==='decryptKakaoXlsx'?async(input:any)=>({data:{xlsxBase64:input.fileBase64}}):original(functions,name);
 return async(...args:any[])=>{calls++;listeners.forEach(listener=>listener());return invoke(...args);};
};
