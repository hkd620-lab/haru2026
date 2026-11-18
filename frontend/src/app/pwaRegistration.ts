import { registerSW } from 'virtual:pwa-register';
import { offerPwaUpdate, startPwaState } from './utils/pwaState';
import { createPwaUpdateController } from './utils/pwaUpdateController';

startPwaState();
if (import.meta.env.PROD) {
  const controller = createPwaUpdateController({
    activate: () => update(true),
    reload: () => window.location.reload(),
    offer: offerPwaUpdate,
  });
  const update = registerSW({
    immediate: true,
    onNeedRefresh: controller.onNeedRefresh,
    onNeedReload: controller.onNeedReload,
    onRegisterError() { /* Online use remains available when caching is unavailable. */ },
  });
}
