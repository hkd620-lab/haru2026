// No real Firebase SDK, credentials, network, or user data in this harness.
export const auth = { currentUser: null as any };
export const db = {};
const deferred = () => {
  let resolve: any, reject: any;
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const redirect = deferred();
export const harness = {
  observers: new Set<any>(), listeners: [] as any[], writes: [] as any[], recoveries: [] as any[],
  mounts: [] as string[], renders: [] as string[], alerts: [] as string[], traces: [] as string[],
  logoutFails: false, redirect, traceAccount: null as string | null,
  emitAuth(uid: string | null) {
    auth.currentUser = uid ? { uid, email: `${uid}@example.test`, displayName: uid, photoURL: null, providerData: [], emailVerified: true } : null;
    for (const observer of this.observers) observer(auth.currentUser);
  },
  snapshot(index: number, data: any, metadata = {}) {
    this.listeners[index].next({ data: () => data, metadata: { fromCache: false, hasPendingWrites: false, ...metadata } });
  },
  error(index: number) { this.listeners[index].error({ code: 'permission-denied' }); },
};
(window as any).harness = harness;
window.alert = (message) => { harness.alerts.push(message); };
export function onAuthStateChanged(_: any, observer: any) {
  harness.observers.add(observer);
  return () => harness.observers.delete(observer);
}
export const getRedirectResult = () => redirect.promise;
export async function signOut() {
  if (harness.logoutFails) throw new Error('test logout failure');
  harness.emitAuth(null);
}
export function doc(_: any, ...parts: string[]) { return parts.join('/'); }
export function onSnapshot(path: string, options: any, next: any, error: any) {
  const listener = { path, options, next, error, stopped: false };
  harness.listeners.push(listener);
  return () => { listener.stopped = true; };
}
export function setDoc(path: string, data: any, options: any) {
  const operation = { path, data, options, ...deferred() };
  harness.writes.push(operation);
  return operation.promise;
}
export const serverTimestamp = () => 'server-timestamp';
export class Timestamp { constructor(private value: number) {} toDate() { return new Date(this.value); } }
export const getFunctions = (_: any, region: string) => ({ region });
export const httpsCallable = (functions: any, name: string) => () => {
  const operation = { functions, name, ...deferred() };
  harness.recoveries.push(operation);
  return operation.promise;
};
export const cleanupDuplicateTokens = () => {};
export const markLoginTrace = (mark: string) => harness.traces.push(mark);
// Same call relationships as utils/loginPerformance. AuthContext only branches on the binding result.
export const blockLoginTrace = (reason: string) => harness.traces.push(`blocked:${reason}`);
export const resumeLoginTrace = (reason: string) => harness.traces.push(`resumed:${reason}`);
export function markLoginAccessReady() {
  resumeLoginTrace('required_access_ready');
  markLoginTrace('T6_required_access_ready');
}
export function endLoginTraceForAuthChange() {
  if (harness.traceAccount !== null) blockLoginTrace('account_switch');
  harness.traceAccount = null;
}
export function bindLoginTraceToAccount(uid: string) {
  if (harness.traceAccount === null) { harness.traceAccount = uid; return 'bound'; }
  if (harness.traceAccount === uid) return 'same_account';
  endLoginTraceForAuthChange();
  return 'account_changed';
}
export const invalidateSnsThumbnailAuthSession = () => {};
export const setSnsThumbnailAuthUser = () => {};
export const signInWithEmailAndPassword = async () => { harness.emitAuth('email'); return { user: auth.currentUser }; };
export const createUserWithEmailAndPassword = signInWithEmailAndPassword;
export const EmailAuthProvider = { credential: () => ({}) };
export const linkWithCredential = async () => ({ user: auth.currentUser });
export const sendPasswordResetEmail = async () => {};
export const signInWithRedirect = async () => {};
export const signInWithPopup = async () => ({ user: auth.currentUser });
export const updateProfile = async () => {};
export class GoogleAuthProvider {}
export const sendEmailVerification = async () => {};
export const reload = async () => {};
export const loginWithKakao = async () => auth.currentUser;
export const loginWithNaver = async () => auth.currentUser;
