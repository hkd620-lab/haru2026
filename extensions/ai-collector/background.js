importScripts('popup.js');

const AI_COLLECTOR_HEALTH_BUILD = '2.9-purpose-folders-1';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Health requests carry no conversation data and never enter a save path.
  if (message?.action === 'collectorHealth') {
    sendResponse({ok:true, kind:'collector-health', build:AI_COLLECTOR_HEALTH_BUILD, extensionId:chrome.runtime.id});
    return;
  }
  if (message?.action === 'haruImportResult') {
    if (message.result?.ok) chrome.storage.local.remove(`haruImport:${message.result.importId}`);
    return;
  }
  if (message?.action === 'saveAiMessage') {
    let host, sourceUrl;
    try {
      const senderUrl = new URL(sender.url);
      const currentUrl = new URL(message.sourceUrl);
      if (senderUrl.protocol !== 'https:' || currentUrl.origin !== senderUrl.origin ||
          typeof message.sourceUrl !== 'string' || message.sourceUrl.length > 2_000) throw new Error('Invalid source URL');
      host = senderUrl.hostname;
      sourceUrl = currentUrl.href;
    } catch {
      sendResponse({ ok: false, error: '현재 대화 주소를 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도하세요.' });
      return;
    }
    if (!['chatgpt.com', 'claude.ai', 'gemini.google.com'].includes(host) ||
        typeof message.content !== 'string' || !message.content.trim()) {
      sendResponse({ ok: false, error: '지원되는 AI 대화 페이지에서 내용이 있을 때만 저장할 수 있습니다.' });
      return;
    }
    saveWithSelectedCategory(message.content, host, sourceUrl)
      .then((saved) => sendResponse({ ok: true, saved }))
      .catch((error) => sendResponse({ ok: false, error: error.message || '저장에 실패했습니다.' }));
    return true;
  }
  if (message?.action !== 'saveSlackMessage') return;

  try {
    const senderUrl = new URL(sender.url);
    if (senderUrl.protocol !== 'https:' || senderUrl.hostname !== 'app.slack.com') {
      sendResponse({ error: 'Slack 페이지에서만 저장할 수 있습니다.' });
      return;
    }
    if (typeof message.content !== 'string' || !message.content.trim()) {
      sendResponse({ error: '저장할 메시지가 없습니다.' });
      return;
    }
  } catch {
    sendResponse({ error: 'Slack 페이지를 확인할 수 없습니다.' });
    return;
  }

  saveWithSelectedCategory(message.content, 'slack', sender.url)
    .then((saved) => sendResponse({ ok: true, saved }))
    .catch((error) => sendResponse({ error: error.message || '저장에 실패했습니다.' }));
  return true;
});
