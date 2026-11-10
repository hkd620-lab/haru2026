const PROJECT_ID_FIRE = 'my-ai-library-74805';
const API_KEY_FIRE = 'AIzaSyBzd4_gQi3fOsEAFTWEalhAoAEhW7yCn7A';
const OWNER_EMAIL = 'hkd620@gmail.com';
const HARU_IMPORT_URL = 'https://haru2026.com/ai-import';
const AI_CATEGORY_STORAGE_KEY = 'aiCollectorCategory';
const AI_CATEGORY_LABELS = Object.freeze({
  'medical-tech': '의료신기술',
  health: '건강상식',
  life: '생활정보',
  investment: '투자정보',
  'ai-tech': 'AI신기술',
});

function normalizeCollectorCategory(value) {
  return typeof value === 'string' && Object.hasOwn(AI_CATEGORY_LABELS, value) ? value : undefined;
}

async function readCollectorCategory() {
  const stored = await chrome.storage.local.get(AI_CATEGORY_STORAGE_KEY);
  return normalizeCollectorCategory(stored[AI_CATEGORY_STORAGE_KEY]);
}

async function saveWithSelectedCategory(content, source, sourceUrl) {
  // Only the extension popup controls this setting. Page messages cannot pick a folder.
  const category = await readCollectorCategory();
  return saveToDestinations(content, source, category, sourceUrl);
}

function extractFromPage() {
  function extractTextWithoutInjectedUi(el) {
    if (!el) return '';
    // innerText needs the rendered DOM to preserve paragraphs, lists and <br>.
    // Hide only our controls synchronously and restore their exact inline styles.
    const controls = [...el.querySelectorAll('[data-ai-save-injected]')];
    const styles = controls.map(button => button.getAttribute('style'));
    try {
      controls.forEach((button, index) => button.setAttribute('style', `${styles[index] || ''};display:none!important`));
      const text = el.innerText;
      if (typeof text === 'string') return text.trim() ? text.replace(/^(?:\r?\n)+|(?:\r?\n)+$/g, '') : '';
      const clone = el.cloneNode(true);
      clone.querySelectorAll('[data-ai-save-injected]').forEach(button => button.remove());
      const fallback = clone.textContent || '';
      return fallback.trim() ? fallback.replace(/^(?:\r?\n)+|(?:\r?\n)+$/g, '') : '';
    } finally {
      controls.forEach((button, index) => {
        if (styles[index] === null) button.removeAttribute('style');
        else button.setAttribute('style', styles[index]);
      });
    }
  }
  const selectors = {
    'gemini.google.com': ['model-response', '.model-response-text', '.response-content'],
    'chatgpt.com': ['[data-message-author-role="assistant"]', '[data-markdown-text-style="assistant-message"]', '.prose'],
    'claude.ai': ['.standard-markdown', '.font-claude-message', '[data-is-streaming]', '.whitespace-pre-wrap'],
  };
  const host = window.location.hostname;
  if (host === 'chatgpt.com' && /^\/dots(?:\/|$)/.test(window.location.pathname)) {
    const answers = [...document.querySelectorAll('.message-row:not(.self) .message-bubble-surface .message-text > [data-markdown-text-style="assistant-message"]')]
      .filter(el => !el.closest('.message-row').querySelector('.message-content-presentation, fieldset, [data-mcp-confirmation-chip], [data-orbit-thread-only]'));
    const last = answers[answers.length - 1];
    if (!last) return { error: '저장할 김비서 답변을 찾을 수 없습니다.' };
    return { data: extractTextWithoutInjectedUi(last), source: 'chatgpt.com', sourceUrl: window.location.href };
  }
  const list = selectors[host];
  if (!list) return { error: '지원되지 않는 사이트입니다.\nChatGPT / Gemini / Claude 에서 사용하세요.' };
  for (const selector of list) {
    const elements = [...document.querySelectorAll(selector)].filter(el =>
      !el.closest('[data-message-author-role="user"], [data-user-message-bubble], .font-user-message, [data-testid="user-message"], [data-ai-save-injected]'));
    if (elements.length > 0) return { data: extractTextWithoutInjectedUi(elements[elements.length - 1]), source: host, sourceUrl: window.location.href };
  }
  return { error: '대화 내용을 찾을 수 없습니다.' };
}

async function checkPopupConnection() {
  const build = '3.0-auto-folders-1';
  const status = document.getElementById('connectionStatus');
  const show = text => { if (status) status.textContent = text; };
  show(`연결 확인 중 · ${build}`);
  let timer;
  let diagnosis = '';
  try {
    const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
    const extensionId = chrome.runtime.id;
    const result = await Promise.race([
      Promise.all([
        chrome.runtime.sendMessage({action:'collectorHealth'}),
        chrome.tabs.sendMessage(tab.id, {action:'collectorPageHealth'}),
      ]),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('health timeout')), 6000); }),
    ]);
    const [background, page] = result;
    if (!background?.ok || background.kind !== 'collector-health' || background.build !== build || background.extensionId !== extensionId) {
      diagnosis = '확장 백그라운드 버전/응답이 맞지 않습니다. 지식수집기 확장을 새로고침한 뒤 해당 AI 대화 탭을 갱신하세요.';
      throw new Error('background health mismatch');
    }
    if (!page?.ok || page.build !== build || page.extensionId !== extensionId || page.health !== 'connected') {
      diagnosis = '대화 탭의 수집기 버전/연결이 맞지 않습니다. 미전송 입력을 보관한 뒤 해당 대화 탭만 새로고침하세요.';
      throw new Error('page health mismatch');
    }
    show(`연결 확인 완료 · ${build}\n대화 내용 전송·저장 없음. 저장 성공 여부는 별도 확인이 필요합니다.`);
    return true;
  } catch {
    show(`연결 확인 실패 · ${build}\n${diagnosis || '페이지 응답을 확인하지 못했습니다. 미전송 입력을 보관한 뒤 해당 AI 대화 탭을 갱신하고 다시 연결만 확인하세요.'}\n저장은 시도하지 않았습니다.`);
    return false;
  } finally { clearTimeout(timer); }
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

async function queueHaruImport(content, source, sourceUrl, capturedAt, importId, category) {
  const key = `haruImport:${importId}`;
  await chrome.storage.local.set({ [key]: {
    importId, content, source, sourceUrl, capturedAt,
    ...(category ? { category } : {}),
  } });
  await chrome.tabs.create({ url: `${HARU_IMPORT_URL}#${importId}`, active: true });
  return importId;
}

async function saveToDestinations(content, source, category, sourceUrl = '') {
  const selectedCategory = normalizeCollectorCategory(category);
  const capturedAt = new Date().toISOString();
  const importId = await sha256(`${source}\n${sourceUrl || ''}\n${content.trim()}`);
  const results = await Promise.allSettled([
    saveToAiArchive(content, source, selectedCategory || 'unclassified', capturedAt, importId),
    queueHaruImport(content, source, sourceUrl, capturedAt, importId, selectedCategory),
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
  const categoryLabel = AI_CATEGORY_LABELS[normalizeCollectorCategory(category)] || '자동 분류';
  const markdownContent = `# AI Knowledge Collector\n\n- **Date**: ${timestamp}\n- **Source**: ${source}\n- **Category**: ${categoryLabel}\n\n---\n\n${content}`;
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
    return results[0].result;
  } catch {
    alert('페이지에 접근할 수 없습니다.\nChatGPT / Gemini / Claude / Slack 탭에서 사용하세요.');
    return null;
  }
};

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  const categorySelect = document.getElementById('categorySelect');
  const categoryStatus = document.getElementById('categoryStatus');
  const extractButton = document.getElementById('extractBtn');
  // A late settings read must never replace a new user selection.
  let categoryChanged = false;
  let categoryWrite = Promise.resolve();
  categorySelect.disabled = true;
  extractButton.disabled = true;
  readCollectorCategory().then((category) => {
    if (!categoryChanged) categorySelect.value = category || '';
    categorySelect.disabled = false;
    extractButton.disabled = false;
  }).catch(() => {
    categoryStatus.textContent = '저장 폴더 설정을 읽지 못했습니다. 팝업을 다시 열어 주세요. 저장하지 않았습니다.';
  });
  categorySelect.addEventListener('change', () => {
    categoryChanged = true;
    const category = normalizeCollectorCategory(categorySelect.value) || '';
    extractButton.disabled = true;
    categoryWrite = categoryWrite.catch(() => {}).then(() =>
      chrome.storage.local.set({ [AI_CATEGORY_STORAGE_KEY]: category }));
    const currentWrite = categoryWrite;
    currentWrite.then(() => {
      if (currentWrite !== categoryWrite) return;
      categoryStatus.textContent = category ? `${AI_CATEGORY_LABELS[category]}에 직접 저장합니다. 답변 옆 저장 버튼에도 적용되며 자동 분류가 바꾸지 않습니다.` : 'Jev로 자동 분류합니다. 확실한 결과는 폴더에, 애매한 결과는 추천과 함께 보류에 모읍니다.';
      extractButton.disabled = false;
    }).catch(() => {
      if (currentWrite !== categoryWrite) return;
      categoryStatus.textContent = '폴더 선택을 저장하지 못했습니다. 다시 선택해 주세요. 저장하지 않았습니다.';
    });
  });
  document.getElementById('connectionBtn')?.addEventListener('click', () => checkPopupConnection());
  document.getElementById('extractBtn').addEventListener('click', async () => {
    if (!await checkPopupConnection()) return;
    const response = await extract();
    if (!response?.data) return alert(response?.error || '저장할 내용을 찾지 못했습니다.');
    try {
      await categoryWrite;
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
