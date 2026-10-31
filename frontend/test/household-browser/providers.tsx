import { useSyncExternalStore } from 'react';
let uid = 'household-browser';
const listeners = new Set<() => void>();
export function switchHouseholdTestUser() {
  uid = uid === 'household-browser' ? 'household-browser-other' : 'household-browser';
  listeners.forEach(listener => listener());
}
export const useAuth = () => {
  const owner = useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => uid);
  return { user: { uid: owner, email: `${owner}@example.test`, emailVerified: true }, loading: false };
};
