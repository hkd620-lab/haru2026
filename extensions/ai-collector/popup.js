const PROJECT_ID_FIRE = 'my-ai-library-74805';
const API_KEY_FIRE = 'AIzaSyBzd4_gQi3fOsEAFTWEalhAoAEhW7yCn7A';
const OWNER_EMAIL = 'hkd620@gmail.com';
const HARU_IMPORT_URL = 'https://haru2026.com/ai-import';

function extractFromPage() {
  const selectors = {
    'gemini.google.com': ['model-response', '.model-response-text', '.response-content'],
    'chatgpt.com': ['.prose', '[data-message-author-role="assistant"]'],
    'claude.ai': ['.font-claude-message', '[data-is-streaming]', '.whitespace-pre-wrap'],
  };
  const host = window.location.hostname;
  const list = selectors[host];
  if (!list) return { error: '지원되지 않는 사이트입니다.\nChatGPT / Gemini / Claude 에서 사용하세요.' };
  for (const selector of list) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) return { data: elements[elements.length - 1].innerText, source: host };
  }
  return { error: '대화 내용을 찾을 수 없습니다.' };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function saveToAiArchive(content, source, category, capturedAt, importId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID_FIRE}/databases/(default)/documents/conversations?documentId=${importId}&key=${API_KEY_FIRE}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      content: { stringValue: content },
      source: { stringValue: source },
      category: { stringValue: category },
      email: { stringValue: OWNER_EMAIL },
      timestamp: { timestampValue: capturedAt },
    } }),
  });
  if (!response.ok && response.status !== 409) throw new Error(`AI 보관함 HTTP ${response.status}`);
}

async function queueHaruImport(content, source, sourceUrl, capturedAt, importId) {
  const key = `haruImport:${importId}`;
  await chrome.storage.local.set({ [key]: { importId, content, source, sourceUrl, capturedAt } });
  await chrome.tabs.create({ url: `${HARU_IMPORT_URL}#${importId}`, active: true });
  return importId;
}

async function saveToDestinations(content, source, category, sourceUrl = '') {
  const capturedAt = new Date().toISOString();
  const importId = await sha256(`${source}\n${sourceUrl || ''}\n${content.trim()}`);
  const results = await Promise.allSettled([
    saveToAiArchive(content, source, category, capturedAt, importId),
    queueHaruImport(content, source, sourceUrl, capturedAt, importId),
  ]);
  const fire = results[0].status === 'fulfilled';
  const haruQueued = results[1].status === 'fulfilled';
  if (!fire && !haruQueued) throw new Error('어느 저장소에도 저장을 시작하지 못했습니다.');
  const reason = (result) => result.status === 'rejected' ? result.reason?.message || '네트워크 오류' : null;
  return { fire, fireError: reason(results[0]), haru: false, haruQueued, haruError: reason(results[1]) };
}

function downloadAsFile(content, source, category) {
  const timestamp = new Date().toLocaleString();
  const filename = `AI_Knowledge_${new Date().toISOString().slice(0, 10)}_${Date.now()}.md`;
  const markdownContent = `# AI Knowledge Collector\n\n- **Date**: ${timestamp}\n- **Source**: ${source}\n- **Category**: ${category}\n\n---\n\n${content}`;
  const blob = new Blob([markdownContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const extract = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return { error: '현재 탭을 찾지 못했습니다.' };
  if (tab.url?.startsWith('https://app.slack.com/')) {
    try {
      const selection = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
      return selection?.data ? { data: selection.data, source: 'slack', sourceUrl: tab.url }
        : { error: 'Slack에서 저장할 메시지 글을 먼저 드래그해 선택하세요.' };
    } catch {
      return { error: 'Slack 페이지를 새로고침한 뒤 다시 시도하세요.' };
    }
  }
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractFromPage });
    return { ...results[0].result, sourceUrl: tab.url };
  } catch {
    alert('페이지에 접근할 수 없습니다.\nChatGPT / Gemini / Claude / Slack 탭에서 사용하세요.');
    return null;
  }
};

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('extractBtn').addEventListener('click', async () => {
    const response = await extract();
    if (!response?.data) return alert(response?.error || '저장할 내용을 찾지 못했습니다.');
    try {
      const category = document.getElementById('categorySelect').value;
      const saved = await saveToDestinations(response.data, response.source, category, response.sourceUrl);
      alert(`AI 보관함: ${saved.fire ? '저장 성공' : saved.fireError}\nHARU: ${saved.haruQueued ? '로그인 계정 저장 확인 창을 열었습니다.' : saved.haruError}`);
    } catch (error) {
      alert(`저장 실패: ${error.message}`);
    }
  });
  document.getElementById('downloadBtn').addEventListener('click', async () => {
    const response = await extract();
    if (!response?.data) return alert(response?.error || '저장할 내용을 찾지 못했습니다.');
    downloadAsFile(response.data, response.source, document.getElementById('categorySelect').value);
    alert('✅ 내 컴퓨터에 마크다운 파일로 저장되었습니다!');
  });
});
