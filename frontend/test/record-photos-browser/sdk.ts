export * from '../reading-ai-browser/sdk';
import {httpsCallable as originalCallable} from '../reading-ai-browser/sdk';
export const httpsCallable = (functions: unknown, name: string) => name === 'getMonthlyAiQuotaStatus' ? async () => {
  await new Promise(resolve=>setTimeout(resolve, 2500));
  const scenario = new URLSearchParams(location.search).get('quota');
  if (scenario === 'error') throw new Error('합성 조회 실패');
  return {data:{plan:'basic',used:scenario === 'empty'?100:1,limit:100,remaining:scenario === 'empty'?0:99,freeLimit:10,basicLimit:100,premiumLimit:300}};
} : originalCallable(functions, name);
const key='record-photos-qa';
export const read = () => JSON.parse(localStorage.getItem(key) || '{}');
export const write = (data: any) => localStorage.setItem(key,JSON.stringify({...read(),...data}));
export const getDoc = async () => ({exists:()=>true,data:read});
export const setDoc = async (_ref:any,data:any) => write(data);
export const updateDoc = setDoc;
export const deleteDoc = async () => {};
export const deleteField = () => undefined;
export const arrayRemove = (...args:any[]) => args;
export const listAll = async () => ({items:[],prefixes:[]});
export const uploadBytes = async () => {};
export const getDownloadURL = async (ref:any) => `${location.origin}/photo.svg?id=${encodeURIComponent(String(ref))}`;

export const functions = {};
