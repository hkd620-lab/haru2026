// firebase/* 와 src/firebase.ts 를 대신하는 인메모리 모의 SDK.
// - Firestore: 문서를 Map에 보관(+localStorage 영속화)하고 where/orderBy/limit·merge·배치·트랜잭션을 흉내 낸다.
// - Functions: fakes.ts 의 결정적 모의 응답만 돌려준다(실제 AI·외부 API 호출 없음).
// - Storage: 올린 파일은 보관하지 않고 업로드 기록만 남긴다.
// 운영 Firebase 에는 어떤 네트워크 요청도 보내지 않는다.
import { qa, persona, user } from './fixture';
import { fakeCallable } from './fakes';

/* ───────── 값 표현 ───────── */

export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static now() { return Timestamp.fromMillis(Date.now()); }
  static fromDate(d: Date) { return Timestamp.fromMillis(d.getTime()); }
  static fromMillis(ms: number) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  toDate() { return new Date(this.toMillis()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  isEqual(o: Timestamp) { return !!o && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; }
  toJSON() { return { __ts: this.toMillis() }; }
}

class FieldSentinel { constructor(public kind: string, public arg?: any) {} }
export const serverTimestamp = () => new FieldSentinel('serverTimestamp');
export const increment = (n: number) => new FieldSentinel('increment', n);
export const arrayUnion = (...v: any[]) => new FieldSentinel('arrayUnion', v);
export const arrayRemove = (...v: any[]) => new FieldSentinel('arrayRemove', v);
export const deleteField = () => new FieldSentinel('deleteField');

const DELETE = Symbol('delete');

function isPlain(v: any): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    && !(v instanceof Timestamp) && !(v instanceof Date) && !(v instanceof FieldSentinel);
}

function clone(v: any): any {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Timestamp) return new Timestamp(v.seconds, v.nanoseconds);
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof FieldSentinel) return v;
  if (Array.isArray(v)) return v.map(clone);
  const out: any = {};
  for (const k of Object.keys(v)) { if (v[k] !== undefined) out[k] = clone(v[k]); }
  return out;
}

function deepEq(a: any, b: any): boolean {
  a = norm(a); b = norm(b);
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a); const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEq(a[k], b[k]));
}

function norm(v: any): any {
  if (v instanceof Timestamp) return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return v;
}

function cmp(a: any, b: any): number {
  a = norm(a); b = norm(b);
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : 1;
}

function getField(data: any, field: string): any {
  let cur = data;
  for (const part of field.split('.')) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setByPath(target: any, parts: string[], value: any) {
  let cur = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!isPlain(cur[parts[i]])) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (value === DELETE) delete cur[last]; else cur[last] = value;
}

function resolveValue(existing: any, incoming: any): any {
  if (incoming instanceof FieldSentinel) {
    switch (incoming.kind) {
      case 'serverTimestamp': return Timestamp.now();
      case 'increment': return (typeof existing === 'number' ? existing : 0) + incoming.arg;
      case 'arrayUnion': {
        const arr = Array.isArray(existing) ? [...existing] : [];
        for (const x of incoming.arg) if (!arr.some((y) => deepEq(x, y))) arr.push(clone(x));
        return arr;
      }
      case 'arrayRemove': {
        const arr = Array.isArray(existing) ? existing : [];
        return arr.filter((y: any) => !incoming.arg.some((x: any) => deepEq(x, y)));
      }
      case 'deleteField': return DELETE;
      default: return undefined;
    }
  }
  if (isPlain(incoming)) return mergeObject(isPlain(existing) ? existing : {}, incoming);
  return clone(incoming);
}

function mergeObject(existing: any, incoming: any): any {
  const out = clone(existing) ?? {};
  for (const k of Object.keys(incoming)) {
    if (incoming[k] === undefined) continue;
    const r = resolveValue(out[k], incoming[k]);
    if (r === DELETE) delete out[k]; else out[k] = r;
  }
  return out;
}

function setNoMerge(incoming: any): any {
  const out: any = {};
  for (const k of Object.keys(incoming)) {
    if (incoming[k] === undefined) continue;
    const r = resolveValue(undefined, incoming[k]);
    if (r !== DELETE) out[k] = r;
  }
  return out;
}

/* ───────── 저장소 ───────── */

const STORE_KEY = `persona-sim-db:${persona.uid}`;
const docs = new Map<string, any>();

function reviver(_k: string, v: any) {
  return v && typeof v === 'object' && '__ts' in v && Object.keys(v).length === 1 ? Timestamp.fromMillis(v.__ts) : v;
}

try {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) for (const [p, d] of JSON.parse(raw, reviver)) docs.set(p, d);
} catch { /* 영속 저장소를 못 읽어도 빈 DB로 시작 */ }

function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify([...docs])); } catch { /* 용량 초과 등은 무시 */ }
}

// 러너가 저장 결과를 검증할 수 있게 DB 전체를 내보낸다(하네스 전용).
(qa as any).dumpDb = () => JSON.parse(JSON.stringify([...docs]));

const listeners = new Set<() => void>();
function notify() {
  queueMicrotask(() => listeners.forEach((l) => { try { l(); } catch { /* 리스너 오류는 앱 흐름과 무관 */ } }));
}

function logWrite(op: string, path: string, data?: any, merge?: boolean) {
  qa.writes.push({
    op, path, merge, keys: data && typeof data === 'object' ? Object.keys(data) : [],
    data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)),
  });
}

function parentPath(p: string) { return p.split('/').slice(0, -1).join('/'); }
function autoId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = ''; for (let i = 0; i < 20; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ───────── 참조·쿼리 ───────── */

class DocRef {
  __kind = 'doc';
  constructor(public path: string) {}
  get id() { return this.path.split('/').pop()!; }
  get parent() { return new CollRef(parentPath(this.path)); }
  get firestore() { return db; }
}
class CollRef {
  __kind = 'collection';
  constructor(public path: string) {}
  get id() { return this.path.split('/').pop()!; }
  get parent() { return this.path.includes('/') ? new DocRef(parentPath(this.path)) : null; }
  get firestore() { return db; }
}
type Constraint =
  | { __c: 'where'; field: string; op: string; value: any }
  | { __c: 'orderBy'; field: string; dir: 'asc' | 'desc' }
  | { __c: 'limit'; n: number };
class QueryRef {
  __kind = 'query';
  constructor(public coll: CollRef, public constraints: Constraint[]) {}
}

function joinSegments(base: string, segments: any[]): string {
  return [base, ...segments.map(String)].filter(Boolean).join('/').split('/').filter(Boolean).join('/');
}

export function collection(base: any, ...segments: string[]) {
  const basePath = base instanceof DocRef || base instanceof CollRef ? base.path : '';
  return new CollRef(joinSegments(basePath, segments));
}

export function doc(base: any, ...segments: string[]) {
  if (base instanceof CollRef) {
    return new DocRef(joinSegments(base.path, segments.length ? segments : [autoId()]));
  }
  const basePath = base instanceof DocRef ? base.path : '';
  return new DocRef(joinSegments(basePath, segments));
}

export const where = (field: string, op: string, value: any): Constraint => ({ __c: 'where', field, op, value });
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): Constraint => ({ __c: 'orderBy', field, dir });
export const limit = (n: number): Constraint => ({ __c: 'limit', n });
export function query(ref: any, ...constraints: Constraint[]) {
  const coll = ref instanceof QueryRef ? ref.coll : ref;
  return new QueryRef(coll, [...(ref instanceof QueryRef ? ref.constraints : []), ...constraints]);
}

function matches(data: any, c: Extract<Constraint, { __c: 'where' }>): boolean {
  const v = getField(data, c.field);
  const x = norm(v); const t = norm(c.value);
  switch (c.op) {
    case '==': return deepEq(v, c.value);
    case '!=': return v !== undefined && !deepEq(v, c.value);
    case '<': return v !== undefined && x < t;
    case '<=': return v !== undefined && x <= t;
    case '>': return v !== undefined && x > t;
    case '>=': return v !== undefined && x >= t;
    case 'in': return Array.isArray(c.value) && c.value.some((y: any) => deepEq(v, y));
    case 'not-in': return v !== undefined && Array.isArray(c.value) && !c.value.some((y: any) => deepEq(v, y));
    case 'array-contains': return Array.isArray(v) && v.some((y: any) => deepEq(y, c.value));
    case 'array-contains-any': return Array.isArray(v) && Array.isArray(c.value) && v.some((y: any) => c.value.some((z: any) => deepEq(y, z)));
    default: return true;
  }
}

class DocSnap {
  constructor(public ref: DocRef, private _d: any) {}
  get id() { return this.ref.id; }
  exists() { return this._d !== undefined; }
  data() { return this._d === undefined ? undefined : clone(this._d); }
  get(field: string) { return clone(getField(this._d, field)); }
}
class QuerySnap {
  constructor(public docs: DocSnap[]) {}
  get size() { return this.docs.length; }
  get empty() { return this.docs.length === 0; }
  forEach(cb: (d: DocSnap) => void) { this.docs.forEach(cb); }
  docChanges() { return this.docs.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i })); }
}

function snapDoc(ref: DocRef) { return new DocSnap(ref, docs.get(ref.path)); }

function snapQuery(q: CollRef | QueryRef) {
  const coll = q instanceof QueryRef ? q.coll : q;
  const cons = q instanceof QueryRef ? q.constraints : [];
  let items = [...docs].filter(([p]) => parentPath(p) === coll.path);
  for (const c of cons) if (c.__c === 'where') items = items.filter(([, d]) => matches(d, c));
  const orders = cons.filter((c): c is Extract<Constraint, { __c: 'orderBy' }> => c.__c === 'orderBy');
  for (const o of orders) items = items.filter(([, d]) => getField(d, o.field) !== undefined);
  items.sort((a, b) => {
    for (const o of orders) {
      const r = cmp(getField(a[1], o.field), getField(b[1], o.field));
      if (r !== 0) return o.dir === 'desc' ? -r : r;
    }
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; // 기본 정렬: 문서 ID
  });
  const lim = cons.find((c) => c.__c === 'limit') as Extract<Constraint, { __c: 'limit' }> | undefined;
  if (lim) items = items.slice(0, lim.n);
  return new QuerySnap(items.map(([p, d]) => new DocSnap(new DocRef(p), d)));
}

/* ───────── Firestore API ───────── */

export const db: any = { __fake: 'firestore' };
export const getFirestore = (..._a: any[]) => db;
export const initializeFirestore = (..._a: any[]) => db;
export const memoryLocalCache = () => ({});

export async function getDoc(ref: DocRef) { return snapDoc(ref); }
export async function getDocs(q: CollRef | QueryRef) { return snapQuery(q); }
export const getDocsFromServer = getDocs;

function applySet(path: string, data: any, merge?: boolean) {
  const existing = docs.get(path);
  docs.set(path, merge && existing !== undefined ? mergeObject(existing, data) : setNoMerge(data));
}

function applyUpdate(path: string, data: any) {
  const existing = docs.get(path);
  if (existing === undefined) {
    const e: any = new Error(`No document to update: ${path}`); e.code = 'not-found'; throw e;
  }
  const next = clone(existing);
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) continue;
    const parts = k.split('.');
    const r = resolveValue(getField(next, k), data[k]);
    setByPath(next, parts, r);
  }
  docs.set(path, next);
}

export async function setDoc(ref: DocRef, data: any, opts?: { merge?: boolean }) {
  logWrite('set', ref.path, data, opts?.merge);
  applySet(ref.path, data, opts?.merge);
  persist(); notify();
}
export async function updateDoc(ref: DocRef, data: any) {
  logWrite('update', ref.path, data);
  applyUpdate(ref.path, data);
  persist(); notify();
}
export async function addDoc(coll: CollRef, data: any) {
  const ref = new DocRef(`${coll.path}/${autoId()}`);
  logWrite('add', ref.path, data);
  applySet(ref.path, data);
  persist(); notify();
  return ref;
}
export async function deleteDoc(ref: DocRef) {
  logWrite('delete', ref.path);
  docs.delete(ref.path);
  persist(); notify();
}

export function writeBatch(_db?: any) {
  const ops: Array<() => void> = [];
  const batch = {
    set(ref: DocRef, data: any, opts?: { merge?: boolean }) { ops.push(() => { logWrite('batch.set', ref.path, data, opts?.merge); applySet(ref.path, data, opts?.merge); }); return batch; },
    update(ref: DocRef, data: any) { ops.push(() => { logWrite('batch.update', ref.path, data); applyUpdate(ref.path, data); }); return batch; },
    delete(ref: DocRef) { ops.push(() => { logWrite('batch.delete', ref.path); docs.delete(ref.path); }); return batch; },
    async commit() { ops.forEach((op) => op()); persist(); notify(); },
  };
  return batch;
}

export async function runTransaction(_db: any, fn: (tx: any) => Promise<any>) {
  const tx = {
    get: async (ref: DocRef) => snapDoc(ref),
    set: (ref: DocRef, data: any, opts?: { merge?: boolean }) => { logWrite('tx.set', ref.path, data, opts?.merge); applySet(ref.path, data, opts?.merge); return tx; },
    update: (ref: DocRef, data: any) => { logWrite('tx.update', ref.path, data); applyUpdate(ref.path, data); return tx; },
    delete: (ref: DocRef) => { logWrite('tx.delete', ref.path); docs.delete(ref.path); return tx; },
  };
  const result = await fn(tx);
  persist(); notify();
  return result;
}

export function onSnapshot(target: any, ...args: any[]) {
  const fnArg = args.find((a) => typeof a === 'function');
  const objArg = args.find((a) => a && typeof a === 'object' && typeof a.next === 'function');
  const next = fnArg ?? objArg?.next;
  const onError = (typeof args[1] === 'function' ? args[1] : objArg?.error) as ((e: unknown) => void) | undefined;
  const run = () => {
    try { next(target instanceof DocRef ? snapDoc(target) : snapQuery(target)); } catch (e) { onError?.(e); }
  };
  queueMicrotask(run);
  listeners.add(run);
  return () => { listeners.delete(run); };
}

/* ───────── Auth ───────── */

const fakeFirebaseUser: any = {
  ...user,
  isAnonymous: false,
  providerData: [{ providerId: 'google.com', uid: persona.uid, email: persona.email, displayName: persona.displayName }],
  metadata: { creationTime: new Date(Date.now() - 20 * 86400000).toUTCString(), lastSignInTime: new Date().toUTCString() },
  getIdToken: async () => 'qa-id-token',
  getIdTokenResult: async () => ({ token: 'qa-id-token', claims: {} }),
  reload: async () => {},
};

export const auth: any = { currentUser: fakeFirebaseUser };
export const getAuth = (..._a: any[]) => auth;
export function onAuthStateChanged(_auth: any, cb: (u: any) => void) {
  queueMicrotask(() => cb(fakeFirebaseUser));
  return () => {};
}
export const signInWithCustomToken = async () => ({ user: fakeFirebaseUser });
export const signInWithPopup = async () => ({ user: fakeFirebaseUser });
export const signInWithRedirect = async () => {};
export const getRedirectResult = async () => null;
export const signInWithEmailAndPassword = async () => ({ user: fakeFirebaseUser });
export const createUserWithEmailAndPassword = async () => ({ user: fakeFirebaseUser });
export const sendEmailVerification = async () => {};
export const sendPasswordResetEmail = async () => {};
export const linkWithCredential = async () => ({ user: fakeFirebaseUser });
export const updateProfile = async () => {};
export const reload = async () => {};
export const signOut = async () => {};
export class GoogleAuthProvider {}
export const EmailAuthProvider = { credential: () => ({}) };
export const User: any = undefined; // 타입 전용 import 호환

/* ───────── App / Messaging ───────── */

const app: any = { name: '[persona-sim]' };
export const initializeApp = (..._a: any[]) => app;
export const getApps = () => [app];
export const getApp = (..._a: any[]) => app;

export const isSupported = async () => false;
export const getMessaging = (..._a: any[]) => ({});
export const getToken = async () => { throw new Error('persona-sim: messaging 미지원'); };
export const onMessage = (..._a: any[]) => () => {};

/* ───────── Functions ───────── */

export const functions: any = { __fake: 'functions' };
export const getFunctions = (..._a: any[]) => functions;
export const httpsCallable = (_fns: any, name: string) => async (data?: any) => {
  const log: any = { name, at: Date.now(), input: summarizeInput(data) };
  qa.calls.push(log);
  try {
    const out = await fakeCallable(name, data);
    log.ok = true;
    return { data: out };
  } catch (e: any) {
    log.ok = false; log.error = String(e?.code || e?.message || e);
    throw e;
  }
};

function summarizeInput(data: any) {
  if (!data || typeof data !== 'object') return data ?? null;
  const out: any = {};
  for (const k of Object.keys(data)) {
    const v = data[k];
    out[k] = typeof v === 'string' && v.length > 300 ? `${v.slice(0, 300)}…(${v.length}자)` : v;
  }
  return out;
}

/* ───────── Storage ───────── */

class StorageRef {
  constructor(public fullPath: string) {}
  get name() { return this.fullPath.split('/').pop()!; }
  get bucket() { return 'qa-bucket'; }
  get parent() { return new StorageRef(parentPath(this.fullPath)); }
  toString() { return `gs://qa-bucket/${this.fullPath}`; }
}

export const storage: any = { __fake: 'storage' };
export const getStorage = (..._a: any[]) => storage;
export function ref(base: any, path?: string) {
  if (path === undefined) return new StorageRef(base instanceof StorageRef ? base.fullPath : '');
  const m = path.match(/\/o\/([^?]+)/);
  return new StorageRef(m ? decodeURIComponent(m[1]) : path.replace(/^gs:\/\/[^/]+\//, ''));
}
export async function uploadBytes(r: StorageRef, data: any, metadata?: any) {
  const size = data?.size ?? data?.byteLength ?? 0;
  qa.uploads.push({ path: r.fullPath, size, contentType: metadata?.contentType ?? data?.type });
  return { ref: r, metadata: { fullPath: r.fullPath, size } };
}
export async function getDownloadURL(r: StorageRef) {
  return `https://qa-storage.invalid/v0/b/qa-bucket/o/${encodeURIComponent(r.fullPath)}?alt=media&token=qa`;
}
export async function deleteObject(r: StorageRef) { qa.deletedObjects.push(r.fullPath); }
export async function listAll(_r: StorageRef) { return { items: [] as StorageRef[], prefixes: [] as StorageRef[] }; }

/* ───────── src/firebase.ts 대체 export ───────── */

export const messaging: null = null;
export const aiLibraryDb: null = null;
export async function loginWithGoogle() { return fakeFirebaseUser; }
