importScripts('popup.js');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'haruImportResult') {
    if (message.result?.ok) chrome.storage.local.remove(`haruImport:${message.result.importId}`);
    return;
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

  saveToDestinations(message.content, 'slack', 'general', sender.url)
    .then((saved) => sendResponse({ ok: true, saved }))
    .catch((error) => sendResponse({ error: error.message || '저장에 실패했습니다.' }));
  return true;
});
