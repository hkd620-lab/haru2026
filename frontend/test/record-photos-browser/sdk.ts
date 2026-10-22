export * from '../reading-ai-browser/sdk';
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
