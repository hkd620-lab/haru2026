console.log('[AI_Collector] content.js 로드됨:', window.location.hostname);

// 드래그 선택 캐싱 — 팝업 열리면 페이지 포커스가 사라져 getSelection()이 빈값이 되므로
// mouseup 시점에 미리 저장해둠
let cachedSelection = null;

document.addEventListener('mouseup', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-ai-save-injected]')) return;
  const text = window.getSelection().toString().trim();
  if (text) {
    cachedSelection = text;
    // sendMessage 방식이 실패할 경우를 대비해 storage에도 저장
    try {
      chrome.storage.local.set({ cachedSelection: text, cachedSelectionSource: window.location.hostname });
    } catch (e) {
      console.warn('[AI_Collector] storage 저장 실패 (확장 컨텍스트 무효화):', e.message);
    }
    if (window.location.hostname === 'app.slack.com') {
      showSlackSelectionButton(event, text);
    }
  } else if (slackSelectionButton) {
    slackSelectionButton.remove();
    slackSelectionButton = null;
    slackSelectionText = '';
  }
}, true);

let slackSelectionTimer = null;
if (window.location.hostname === 'app.slack.com') {
  document.addEventListener('selectionchange', () => {
    clearTimeout(slackSelectionTimer);
    slackSelectionTimer = setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || slackSelectionButton?.disabled) return;
      const target = selection.anchorNode?.parentElement || document.body;
      showSlackSelectionButton({ target }, text);
    }, 350);
  });
}

// ================================================================
// 💾 인라인 저장 버튼 시스템
// ================================================================
const SAVE_BTN_ATTR = 'data-ai-save-injected';
const PROJECT_ID_CS = "my-ai-library-74805";

// --- 버튼 생성 ---
function createSaveButton() {
  const btn = document.createElement('button');
  btn.textContent = '💾';
  btn.setAttribute(SAVE_BTN_ATTR, 'true');
  btn.style.cssText = [
    'position:absolute', 'top:8px', 'right:8px',
    'width:28px', 'height:28px', 'padding:0',
    'border:none', 'border-radius:6px',
    'background:rgba(255,255,255,0.75)',
    'box-shadow:0 1px 4px rgba(0,0,0,0.18)',
    'cursor:pointer', 'font-size:14px',
    'line-height:28px', 'text-align:center',
    'z-index:9999', 'transition:background 0.2s'
  ].join(';');
  btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.97)');
  btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.75)');
  return btn;
}

let slackSelectionButton = null;
let slackSelectionText = '';

function showSlackSelectionButton(event, text) {
  if (event.target instanceof Element && event.target.closest('[contenteditable="true"], textarea, input')) return;
  if (slackSelectionButton && slackSelectionText === text) return;
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) return;

  if (slackSelectionButton) slackSelectionButton.remove();
  const btn = createSaveButton();
  slackSelectionButton = btn;
  slackSelectionText = text;
  btn.title = '선택한 Slack 글 저장';
  btn.setAttribute('aria-label', '선택한 Slack 글 저장');
  btn.style.position = 'fixed';
  btn.style.zIndex = '2147483647';
  btn.style.right = 'auto';
  btn.style.top = `${Math.max(8, Math.min(window.innerHeight - 36, rect.bottom + 6))}px`;
  btn.style.left = `${Math.max(8, Math.min(window.innerWidth - 36, rect.right))}px`;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const content = ['Slack에서 선택한 글', `위치: ${window.location.origin}${window.location.pathname}`, '', text].join('\n');
    saveSlackContent(btn, content).finally(() => {
      setTimeout(() => {
        btn.remove();
        if (slackSelectionButton === btn) {
          slackSelectionButton = null;
          slackSelectionText = '';
        }
      }, 2700);
    });
  });
  document.body.appendChild(btn);
}

function extractSlackMessage(el) {
  const body = el.querySelector(
    '.c-message_kit__text, .c-message__body, [data-qa="message-text"], [data-qa="message_content"]'
  );
  const content = body?.innerText?.trim();
  if (!content) return null;
  const author = el.querySelector('.c-message__sender, [data-qa="message_sender_name"]')?.innerText?.trim();
  const lines = ['Slack 메시지', `위치: ${window.location.origin}${window.location.pathname}`];
  if (author) lines.push(`작성자: ${author}`);
  lines.push('', content);
  return lines.join('\n');
}

async function saveSlackContent(btn, content) {
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    const result = await chrome.runtime.sendMessage({ action: 'saveSlackMessage', content });
    if (!result?.ok) throw new Error(result?.error || '저장에 실패했습니다.');
    btn.textContent = result.saved?.fire ? '✅' : '⚠️';
    alert(`AI 보관함: ${result.saved?.fire ? '저장 성공' : result.saved?.fireError}\nHARU: ${result.saved?.haruQueued ? '로그인 계정 저장 확인 창을 열었습니다.' : result.saved?.haruError}`);
  } catch (error) {
    console.warn('[AI_Collector] Slack 저장 실패:', error.message);
    btn.textContent = '❌';
    alert(`저장 실패: ${error.message}`);
  }
  setTimeout(() => { btn.textContent = '💾'; btn.disabled = false; }, 2500);
}

async function handleSlackSaveClick(btn, el) {
  const content = extractSlackMessage(el);
  if (!content) {
    alert('메시지 내용을 찾지 못했습니다. 메시지 글을 드래그해 선택한 뒤 저장해 주세요.');
    return;
  }
  await saveSlackContent(btn, content);
}

function injectSlackSaveButtons() {
  document.querySelectorAll('.c-message_kit__message, [data-qa="message_container"]').forEach((el) => {
    if (el.matches('[data-qa="message_container"]') &&
        (el.querySelector('.c-message_kit__message') || el.closest('.c-message_kit__message'))) return;
    if (el.querySelector(`[${SAVE_BTN_ATTR}]`) || !extractSlackMessage(el)) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const btn = createSaveButton();
    btn.title = '이 Slack 메시지를 저장';
    btn.setAttribute('aria-label', '이 Slack 메시지를 저장');
    btn.style.opacity = '0';
    el.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    el.addEventListener('mouseleave', () => { if (!btn.disabled) btn.style.opacity = '0'; });
    btn.addEventListener('focus', () => { btn.style.opacity = '1'; });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSlackSaveClick(btn, el);
    });
    el.appendChild(btn);
  });
}

// --- 인덱스로 질문+답변 추출 ---
function extractPairByIndex(index, host) {
  let questions, answers;
  if (host === 'claude.ai') {
    questions = document.querySelectorAll('.font-user-message, [data-testid="user-message"]');
    // Claude.ai는 업데이트마다 클래스명이 바뀌므로 다중 후보 시도
    answers = document.querySelectorAll('.standard-markdown');
  } else if (host === 'chatgpt.com') {
    questions = document.querySelectorAll('[data-message-author-role="user"]');
    let answerSel = '[data-message-author-role="assistant"]';
    for (const s of ['[data-message-author-role="assistant"]', '.markdown.prose', '[class*="prose"]']) {
      if (document.querySelector(s)) { answerSel = s; break; }
    }
    answers = document.querySelectorAll(answerSel);
  } else if (host === 'gemini.google.com') {
    questions = document.querySelectorAll('user-query');
    answers   = document.querySelectorAll('model-response');
  } else {
    return null;
  }
  const q = questions[index]?.innerText?.trim() || '';
  const a = answers[index]?.innerText?.trim()   || '';
  if (!a) return null;
  return q ? `👤 질문\n${q}\n\n🤖 답변\n${a}` : `🤖 답변\n${a}`;
}

// --- Firestore 직접 저장 (팝업 불필요) ---
async function saveToFirestoreFromPage(text, source) {
  if (!chrome?.storage?.local) {
    throw new Error('chrome.storage.local을 사용할 수 없습니다. 확장을 재설치해주세요.');
  }
  let stored;
  try {
    stored = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['firebaseTokens', 'currentUser'], (result) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(result);
      });
    });
  } catch (e) {
    throw new Error('로그인 정보를 읽을 수 없습니다. 확장을 재로드하고 다시 로그인해주세요.');
  }
  if (!stored.firebaseTokens?.fire || !stored.currentUser) {
    throw new Error('로그인이 필요합니다. 팝업에서 먼저 로그인하세요.');
  }
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID_CS}/databases/(default)/documents/conversations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${stored.firebaseTokens.fire}`
      },
      body: JSON.stringify({
        fields: {
          content:   { stringValue: text },
          source:    { stringValue: source },
          category:  { stringValue: 'general' },
          email:     { stringValue: stored.currentUser.email },
          timestamp: { timestampValue: new Date().toISOString() }
        }
      })
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `저장 실패 (${res.status})`);
  }
}

// --- 로컬 .md 다운로드는 팝업 버튼으로 처리 (content script에서 제거) ---

// --- 버튼 클릭 처리 ---
async function handleSaveClick(btn, index, host) {
  btn.textContent = '⏳';
  btn.disabled = true;

  const text = extractPairByIndex(index, host);
  if (!text) {
    btn.textContent = '❌'; btn.title = '내용을 찾을 수 없습니다.';
    setTimeout(() => { btn.textContent = '💾'; btn.disabled = false; btn.title = ''; }, 2500);
    return;
  }

  try {
    await saveToFirestoreFromPage(text, host);
    chrome.runtime.sendMessage({ action: 'savedFromPage' }).catch(() => {});
    btn.textContent = '✅';
    setTimeout(() => { btn.textContent = '💾'; btn.disabled = false; }, 2000);
  } catch (e) {
    console.warn('[AI_Collector] 저장 실패:', e.message);
    btn.textContent = '❌';
    alert('저장 실패! 확장 아이콘을 클릭하여 다시 로그인해주세요.');
    setTimeout(() => { btn.textContent = '💾'; btn.disabled = false; }, 3000);
  }
}

// --- 버튼 삽입 ---
function injectSaveButtons() {
  const host = window.location.hostname;
  if (host === 'app.slack.com') {
    injectSlackSaveButtons();
    return;
  }
  console.log('[AI_Collector] injectSaveButtons 실행:', host);
  let selector;
  if (host === 'claude.ai') {
    selector = '.standard-markdown';
  } else if (host === 'chatgpt.com') {
    const candidates = [
      '[data-message-author-role="assistant"]',
      '.markdown', '.prose',
      '[class*="markdown"]', '[class*="prose"]',
      'article', 'main'
    ];
    candidates.forEach(sel => {
      const n = document.querySelectorAll(sel).length;
      console.log(`[AI_Collector] ${sel} → ${n}개`);
    });
    for (const sel of candidates) {
      if (document.querySelector(sel)) { selector = sel; break; }
    }
    console.log('[AI_Collector] ChatGPT 최종 셀렉터:', selector);
  }
  else if (host === 'gemini.google.com') selector = 'model-response';
  else return;

  document.querySelectorAll(selector).forEach((el, index) => {
    if (el.querySelector(`[${SAVE_BTN_ATTR}]`)) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const btn = createSaveButton();
    btn.addEventListener('click', (e) => { e.stopPropagation(); handleSaveClick(btn, index, host); });
    el.appendChild(btn);
  });
}

// --- SPA 대응: 새 메시지 감지 후 버튼 재삽입 ---
let injectTimer = null;
new MutationObserver(() => {
  clearTimeout(injectTimer);
  injectTimer = setTimeout(injectSaveButtons, 600);
}).observe(document.body, { childList: true, subtree: true });

injectSaveButtons();

// ================================================================
// Gemini는 여러 선택자를 순서대로 시도
const GEMINI_SELECTORS = [
  'model-response',
  '.model-response-text',
  '.response-content',
  '.markdown'
];

const SELECTORS = {
  'gemini.google.com': null, // 아래에서 별도 처리
  'chatgpt.com': '.prose',
  'claude.ai': '.font-claude-message'
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSelection") {
    console.log('[AI_Collector] getSelection 메시지 수신, cachedSelection:', cachedSelection ? `"${cachedSelection.slice(0, 50)}..."` : '(없음)');
    sendResponse({ data: cachedSelection || null });
    cachedSelection = null;
    try {
      chrome.storage.local.remove(['cachedSelection', 'cachedSelectionSource']);
    } catch (e) {
      console.warn('[AI_Collector] storage 삭제 실패:', e.message);
    }
    return true;
  }

  if (request.action === "extract") {
    const host = window.location.hostname;
    const selector = SELECTORS[host];

    if (!selector) {
      sendResponse({ error: "지원되지 않는 사이트입니다." });
      return;
    }

    let messages;
    if (host === 'gemini.google.com') {
      // 여러 선택자를 순서대로 시도
      for (const sel of GEMINI_SELECTORS) {
        messages = document.querySelectorAll(sel);
        if (messages.length > 0) break;
      }
    } else {
      messages = document.querySelectorAll(selector);
    }

    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1].innerText;
      sendResponse({ data: lastMessage, source: host });
    } else {
      sendResponse({ error: "대화 내용을 찾을 수 없습니다." });
    }
  }
  return true;
});
