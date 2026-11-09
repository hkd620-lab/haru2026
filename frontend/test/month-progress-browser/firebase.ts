export const auth = { currentUser: null as null | { uid: string } };
export const db = {};
export const authListeners = new Set<(user: typeof auth.currentUser) => void>();
export const subscriptions: Array<{ next: Function; active: boolean }> = [];
export function setAuth(uid: string | null) {
  auth.currentUser = uid ? { uid } : null;
  authListeners.forEach(fn => fn(auth.currentUser));
}
export function onAuthStateChanged(_auth: unknown, callback: (user: typeof auth.currentUser) => void) {
  authListeners.add(callback);
  queueMicrotask(() => { if (authListeners.has(callback)) callback(auth.currentUser); });
  return () => authListeners.delete(callback);
}
export const collection = (...args: unknown[]) => args;
export const where = (...args: unknown[]) => args;
export const orderBy = (...args: unknown[]) => args;
export const query = (...args: unknown[]) => args;
export function onSnapshot(_query: unknown, _options: unknown, next: Function) {
  const sub = { next, active: true }; subscriptions.push(sub);
  return () => { sub.active = false; };
}
