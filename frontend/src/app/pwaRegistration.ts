import { registerSW } from 'virtual:pwa-register';
import { offerPwaUpdate, startPwaState } from './utils/pwaState';

startPwaState();
if (import.meta.env.PROD) {
  const update = registerSW({
    immediate: true,
    onNeedRefresh() { offerPwaUpdate(() => update(true)); },
    onRegisterError() { /* Online use remains available when caching is unavailable. */ },
  });
}
