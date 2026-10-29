// 실제 SDK와 로컬 Rules 에뮬레이터를 사용한다. 운영 연결 금지.
import {initializeApp} from '../../node_modules/firebase/app/dist/index.mjs';
import {getFirestore as realFirestore,connectFirestoreEmulator} from '../../node_modules/firebase/firestore/dist/index.mjs';
export * from '../../node_modules/firebase/firestore/dist/index.mjs';
const app=initializeApp({projectId:'demo-haru-household-dedup',apiKey:'emulator-only'},'household-browser');
const db=realFirestore(app);
connectFirestoreEmulator(db,'127.0.0.1',18867,{mockUserToken:{sub:'household-browser',email:'household-browser@example.test',email_verified:true}});
export const getFirestore=()=>db;
