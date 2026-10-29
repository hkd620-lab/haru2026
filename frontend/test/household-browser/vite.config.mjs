import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const prior=path.join(root,'../record-photos-browser');
export default defineConfig({root,envDir:root,plugins:[{name:'household-isolation',enforce:'pre',resolveId(source,importer){
  if(source==='firebase/firestore')return path.join(root,'firestore-sdk.ts');
  if(source.startsWith('firebase/'))return path.join(root,'sdk.ts');
  if(!importer||!source.startsWith('.'))return;
  const resolved=path.resolve(path.dirname(importer.split('?')[0]),source);
  if(/\/firebase(?:\.ts)?$/.test(resolved))return path.join(root,'sdk.ts');
  if(/\/AuthContext(?:\.tsx?)?$/.test(resolved))return path.join(root,'providers.tsx');
  if(/\/firestoreService(?:\.ts)?$/.test(resolved))return path.join(root,'firestore.ts');
  if(/\/(useSubscription|LoadingContext)(?:\.tsx?)?$/.test(resolved))return path.join(prior,'providers.tsx');
}},react(),tailwindcss()],resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:18767,strictPort:true,fs:{allow:[path.resolve(root,'../..')]}}});
