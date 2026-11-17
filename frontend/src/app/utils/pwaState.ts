import { useSyncExternalStore } from 'react';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
type PwaState = { online: boolean; installed: boolean; installEvent: InstallEvent | null; update: (() => Promise<void>) | null };
let state: PwaState = { online: true, installed: false, installEvent: null, update: null };
const listeners = new Set<() => void>();
function publish(next: Partial<PwaState>) { state = { ...state, ...next }; listeners.forEach(fn => fn()); }
let started = false;
export function startPwaState() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const display = window.matchMedia('(display-mode: standalone)');
  const syncDisplay = () => publish({ installed: display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true });
  publish({ online: navigator.onLine });
  syncDisplay();
  if (display.addEventListener) display.addEventListener('change', syncDisplay);
  else display.addListener(syncDisplay);
  window.addEventListener('online', () => publish({ online: true }));
  window.addEventListener('offline', () => publish({ online: false }));
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    publish({ installEvent: event as InstallEvent });
  });
  window.addEventListener('appinstalled', () => publish({ installed: true, installEvent: null }));
}
export function offerPwaUpdate(update: () => Promise<void>) { publish({ update }); }
export async function installPwa() {
  const event = state.installEvent;
  if (!event) return;
  // A browser install event can only be used once, including after dismissal.
  publish({ installEvent: null });
  await event.prompt();
  await event.userChoice;
  // Only appinstalled or display-mode confirms installation, not prompt acceptance.
}
export function usePwaState() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => state, () => state);
}
