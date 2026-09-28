const ALLOWED_ORIGINS = new Set(['https://haru2026.com', 'https://haru2026-8abb8.web.app']);
const IMPORT_ID_PATTERN = /^[a-f0-9]{64}$/;

if (ALLOWED_ORIGINS.has(window.location.origin)) {
  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.type === 'haru:ai-import-result') {
      const result = event.data.result;
      if (!IMPORT_ID_PATTERN.test(result?.importId)) return;
      chrome.runtime.sendMessage({ action: 'haruImportResult', result }).catch(() => {});
      return;
    }
    if (event.data?.type !== 'haru:ai-import-request') return;
    const importId = event.data.importId;
    if (!IMPORT_ID_PATTERN.test(importId) || window.location.hash !== `#${importId}`) return;
    const key = `haruImport:${importId}`;
    const stored = await chrome.storage.local.get(key);
    const payload = stored[key];
    if (!payload || payload.importId !== importId) return;
    window.postMessage({ type: 'haru:ai-import-payload', payload }, window.location.origin);
  });
}
