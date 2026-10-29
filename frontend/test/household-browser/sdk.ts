export * from '../record-photos-browser/sdk';
import {httpsCallable as original} from '../record-photos-browser/sdk';
export const httpsCallable=(functions:unknown,name:string)=>name==='decryptKakaoXlsx'?async(input:any)=>({data:{xlsxBase64:input.fileBase64}}):original(functions,name);
