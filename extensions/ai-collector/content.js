console.log('[AI_Collector] content.js 로드됨:', window.location.hostname);

// 드래그 선택 캐싱 — 팝업 열리면 페이지 포커스가 사라져 getSelection()이 빈값이 되므로
// mouseup 시점에 미리 저장해둠
let cachedSelection = null;

document.addEventListener('mouseup', async (event) => {
  if (!hasCollectorRuntime() || collectorHealth === 'stale') { stopInvalidCollectorContext(); return; }
  if (event.target instanceof Element && event.target.closest('[data-ai-save-injected]')) return;
  const text = window.getSelection().toString().trim();
  if (text) {
    cachedSelection = text;
    // sendMessage 방식이 실패할 경우를 대비해 storage에도 저장
    try {
      await chrome.storage.local.set({ cachedSelection: text, cachedSelectionSource: window.location.hostname });
    } catch (e) {
      if (!hasCollectorRuntime() || isInvalidCollectorError(e)) stopInvalidCollectorContext();
      console.warn('[AI_Collector] storage 저장 실패:', e.message);
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
    if (!hasCollectorRuntime() || collectorHealth === 'stale') { stopInvalidCollectorContext(); return; }
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
const AI_COLLECTOR_BINDING_VERSION = 'v3.0-auto-folders';
const PROJECT_ID_CS = "my-ai-library-74805";
const chatGptTurnBindings = new WeakMap();
const AI_COLLECTOR_HEALTH_BUILD = '3.0-auto-folders-1';
const collectorInstance = crypto.randomUUID();
const collectorOwnedButtons = new WeakSet();
const collectorRecovery = '수집기 연결이 끊겼습니다. 미전송 입력을 보관한 뒤 이 대화 탭만 새로고침하세요. 저장을 자동 재시도하지 않습니다.';
const collectorDiagnosticHelp = '수집기 연결 확인을 통과하지 못했습니다. 확장 팝업의 ‘연결만 확인 (저장 없음)’에서 상태를 확인하세요. 저장은 시도하지 않았습니다.';
let collectorHealth = 'checking';
let collectorHealthCheck = null;
let collectorObserver;

function hasCollectorRuntime() {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id &&
      typeof chrome.runtime.sendMessage === 'function' && !!chrome.storage?.local;
  } catch { return false; }
}

function isInvalidCollectorError(error) {
  return /Extension context invalidated|Cannot read properties of undefined.*local/i.test(error?.message || '');
}

function setCollectorHealth(state) {
  collectorHealth = state;
  document.documentElement.dataset.aiCollectorHealth = state;
  document.documentElement.dataset.aiCollectorBuild = AI_COLLECTOR_HEALTH_BUILD;
  document.documentElement.dataset.aiCollectorInstance = collectorInstance;
  document.querySelectorAll(`[${SAVE_BTN_ATTR}]`).forEach(button => {
    if (!collectorOwnedButtons.has(button) || button.dataset.aiSaveBusy) return;
    button.disabled = state !== 'connected';
    if (state === 'connected') {
      button.textContent = idleSaveButtonLabel(button);
      button.title = button.closest('.message-row') ? '김비서 답변 저장 · 연결 확인됨' : '답변 저장 · 연결 확인됨';
    } else {
      button.textContent = (state === 'checking' ? '…' : '↻') + (button.dataset.aiCollectorLayout === 'answer-left-2' ? ' 저장' : '');
      button.title = state === 'checking' ? '저장 전 수집기 연결 확인 중' : state === 'stale' ? collectorRecovery : collectorDiagnosticHelp;
    }
  });
}

function stopInvalidCollectorContext() {
  setCollectorHealth('stale');
  collectorObserver?.disconnect();
}

async function checkCollectorConnection() {
  if (!hasCollectorRuntime() || collectorHealth === 'stale') { stopInvalidCollectorContext(); return false; }
  if (collectorHealthCheck) return collectorHealthCheck;
  collectorHealthCheck = (async () => {
    let timer;
    try {
      const extensionId = chrome.runtime.id;
      const response = await Promise.race([
        chrome.runtime.sendMessage({action:'collectorHealth'}),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('health timeout')), 5000); }),
      ]);
      if (collectorHealth === 'stale' || !hasCollectorRuntime() || !response?.ok || response.kind !== 'collector-health' ||
          response.build !== AI_COLLECTOR_HEALTH_BUILD || response.extensionId !== extensionId) {
        throw new Error('health mismatch');
      }
      setCollectorHealth('connected');
      return true;
    } catch (error) {
      if (!hasCollectorRuntime() || isInvalidCollectorError(error)) stopInvalidCollectorContext();
      else setCollectorHealth('unavailable');
      return false;
    } finally { clearTimeout(timer); }
  })();
  try { return await collectorHealthCheck; }
  finally { collectorHealthCheck = null; }
}

// --- 버튼 생성 ---
function createSaveButton() {
  const btn = document.createElement('button');
  collectorOwnedButtons.add(btn);
  btn.dataset.aiCollectorOwner = collectorInstance;
  btn.dataset.aiCollectorBuild = AI_COLLECTOR_HEALTH_BUILD;
  btn.disabled = collectorHealth !== 'connected';
  btn.type = 'button';
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
  const content = extractTextWithoutInjectedUi(body);
  if (!content) return null;
  const author = el.querySelector('.c-message__sender, [data-qa="message_sender_name"]')?.innerText?.trim();
  const lines = ['Slack 메시지', `위치: ${window.location.origin}${window.location.pathname}`];
  if (author) lines.push(`작성자: ${author}`);
  lines.push('', content);
  return lines.join('\n');
}

async function saveSlackContent(btn, content) {
  if (btn.disabled) return;
  btn.disabled = true;
  btn.dataset.aiSaveBusy = 'true';
  if (!await checkCollectorConnection()) {
    delete btn.dataset.aiSaveBusy; setCollectorHealth(collectorHealth); alert(collectorHealth === 'stale' ? collectorRecovery : collectorDiagnosticHelp); return;
  }
  btn.textContent = '⏳';
  try {
    const result = await chrome.runtime.sendMessage({ action: 'saveSlackMessage', content });
    if (!result?.ok) throw new Error(result?.error || '저장에 실패했습니다.');
    btn.textContent = result.saved?.fire ? '✅' : '⚠️';
    alert(`AI 보관함: ${result.saved?.fire ? '저장 성공' : result.saved?.fireError}\nHARU: ${result.saved?.haruQueued ? '로그인 계정 저장 확인 창을 열었습니다.' : result.saved?.haruError}`);
  } catch (error) {
    console.warn('[AI_Collector] Slack 저장 실패:', error.message);
    btn.textContent = '❌';
    if (!hasCollectorRuntime() || isInvalidCollectorError(error)) stopInvalidCollectorContext();
    alert(collectorHealth === 'stale' ? collectorRecovery : `저장 실패: ${error.message}`);
  }
  delete btn.dataset.aiSaveBusy;
  setTimeout(() => { btn.textContent = collectorHealth === 'connected' ? '💾' : '↻'; btn.disabled = collectorHealth !== 'connected'; }, 2500);
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
  document.querySelectorAll(`[${SAVE_BTN_ATTR}]`).forEach(button => {
    if (!collectorOwnedButtons.has(button) && !button.closest('.c-message_kit__message, [data-qa="message_container"]')) button.remove();
  });
  document.querySelectorAll('.c-message_kit__message, [data-qa="message_container"]').forEach((el) => {
    if (el.matches('[data-qa="message_container"]') &&
        (el.querySelector('.c-message_kit__message') || el.closest('.c-message_kit__message'))) return;
    if (!extractSlackMessage(el)) return;
    const existingButtons = [...el.querySelectorAll(`[${SAVE_BTN_ATTR}]`)];
    if (existingButtons.length === 1 && collectorOwnedButtons.has(existingButtons[0])) return;
    existingButtons.forEach(button => button.remove());
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

function extractTextWithoutInjectedUi(el) {
  if (!el) return '';
  // innerText needs the rendered DOM to preserve paragraphs, lists and <br>.
  // Hide only our controls synchronously and restore their exact inline styles.
  const controls = [...el.querySelectorAll(`[${SAVE_BTN_ATTR}]`)];
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

// --- 인덱스로 질문+답변 추출 ---
function extractPairByIndex(index, host) {
  let questions, answers;
  if (host === 'claude.ai') {
    questions = document.querySelectorAll('.font-user-message, [data-testid="user-message"]');
    // Claude.ai는 업데이트마다 클래스명이 바뀌므로 다중 후보 시도
    answers = document.querySelectorAll('.standard-markdown');
  } else if (host === 'gemini.google.com') {
    questions = document.querySelectorAll('user-query');
    answers   = document.querySelectorAll('model-response');
  } else {
    return null;
  }
  const q = extractTextWithoutInjectedUi(questions[index]);
  const a = extractTextWithoutInjectedUi(answers[index]);
  if (!a) return null;
  return q ? `👤 질문\n${q}\n\n🤖 답변\n${a}` : `🤖 답변\n${a}`;
}

// Orbit uses the assistant markdown renderer for both people. Its row is the role boundary.
function getDotAnswer(row) {
  if (!row || row.matches('.self') || row.closest('[data-ai-save-injected]') ||
      row.querySelector('.message-content-presentation, fieldset, [data-mcp-confirmation-chip], [data-orbit-thread-only]')) return null;
  return [...row.querySelectorAll('.message-bubble-surface .message-text > [data-markdown-text-style="assistant-message"]')]
    .find(el => el.closest('.message-row') === row &&
      !el.closest('.message-content-presentation, fieldset, [data-mcp-confirmation-chip], [data-orbit-thread-only]')) || null;
}

function extractDotPair(row, answerEl) {
  const answer = extractTextWithoutInjectedUi(answerEl);
  if (!answer) return null;
  let question = '';
  const list = row.closest('.message-list') || document;
  for (const message of list.querySelectorAll('.message-row.self .message-text')) {
    if (message.compareDocumentPosition(answerEl) & Node.DOCUMENT_POSITION_FOLLOWING) {
      question = extractTextWithoutInjectedUi(message);
    }
  }
  return question ? `👤 질문\n${question}\n\n🤖 답변\n${answer}` : `🤖 답변\n${answer}`;
}

function extractChatGPTPair(turn, answerEl) {
  if (turn.matches?.('.message-row')) return extractDotPair(turn, answerEl);
  const answer = extractTextWithoutInjectedUi(answerEl);
  if (!answer) return null;
  let question = '';
  const userMessages = document.querySelectorAll(
    '[data-message-author-role="user"], [data-user-message-bubble="true"]'
  );
  for (const message of userMessages) {
    const precedesAnswer = Boolean(
      message.compareDocumentPosition(answerEl) & Node.DOCUMENT_POSITION_FOLLOWING
    );
    if (precedesAnswer) question = extractTextWithoutInjectedUi(message);
  }
  return question ? `👤 질문\n${question}\n\n🤖 답변\n${answer}` : `🤖 답변\n${answer}`;
}

// 화면 버튼도 팝업·Slack과 같은 백그라운드 저장 경로를 사용한다.
async function saveAiMessage(text) {
  const result = await chrome.runtime.sendMessage({ action: 'saveAiMessage', content: text, sourceUrl: window.location.href });
  if (!result?.ok) throw new Error(result?.error || '저장에 실패했습니다.');
  return result.saved;
}

// --- 로컬 .md 다운로드는 팝업 버튼으로 처리 (content script에서 제거) ---

// --- 버튼 클릭 처리 ---
async function handleSaveClick(btn, index, host, answerEl, turn = answerEl) {
  if (btn.disabled) return;
  if (turn.matches?.('.message-row') && getDotAnswer(turn) !== answerEl) {
    btn.remove();
    return;
  }
  btn.disabled = true;
  btn.dataset.aiSaveBusy = 'true';
  if (!await checkCollectorConnection()) {
    delete btn.dataset.aiSaveBusy;
    setCollectorHealth(collectorHealth);
    alert(collectorHealth === 'stale' ? collectorRecovery : collectorDiagnosticHelp);
    return;
  }
  const text = host === 'chatgpt.com'
    ? extractChatGPTPair(turn, answerEl)
    : extractPairByIndex(index, host);
  if (!text) {
    delete btn.dataset.aiSaveBusy;
    btn.textContent = '❌'; btn.title = '내용을 찾을 수 없습니다.';
    setTimeout(() => { btn.textContent = idleSaveButtonLabel(btn); btn.disabled = collectorHealth !== 'connected' || !hasCollectorRuntime(); btn.title = ''; }, 2500);
    return;
  }
  btn.textContent = '⏳';
  btn.disabled = true;

  try {
    const saved = await saveAiMessage(text);
    btn.textContent = saved.fire ? '✅' : '⚠️';
    btn.title = saved.fire
      ? 'AI 보관함 저장 성공 · HARU 저장 확인 대기'
      : 'HARU 저장 확인 대기';
    alert(`AI 보관함: ${saved.fire ? '저장 성공' : saved.fireError}\nHARU: ${saved.haruQueued ? '로그인 계정 저장 확인 창을 열었습니다.' : saved.haruError}`);
    setTimeout(() => { btn.textContent = idleSaveButtonLabel(btn); btn.disabled = collectorHealth !== 'connected' || !hasCollectorRuntime(); btn.title = ''; }, 2000);
  } catch (e) {
    console.warn('[AI_Collector] 저장 실패:', e.message);
    if (!hasCollectorRuntime() || isInvalidCollectorError(e)) stopInvalidCollectorContext();
    btn.textContent = '❌';
    alert(collectorHealth === 'stale' ? collectorRecovery : `저장 실패: ${e.message}`);
    setTimeout(() => { btn.textContent = collectorHealth === 'connected' ? idleSaveButtonLabel(btn) : (btn.dataset.aiCollectorLayout === 'answer-left-2' ? '↻ 저장' : '↻'); btn.disabled = collectorHealth !== 'connected'; }, 3000);
  } finally {
    delete btn.dataset.aiSaveBusy;
  }
}

// --- 버튼 삽입 ---
function getChatGptTurn(el) {
  const dotRow = el.closest('.message-row');
  if (dotRow) return dotRow;
  return el.closest('[data-turn-key], [data-testid^="conversation-turn"], article') || el;
}

function getChatGptAnswer(turn, candidate) {
  if (turn.matches?.('[data-message-author-role="assistant"]')) return turn;
  if (turn.matches?.('[data-markdown-text-style="assistant-message"]')) return turn;
  const roleAnswer = turn.querySelector?.(
    '[data-message-author-role="assistant"], [data-markdown-text-style="assistant-message"]'
  );
  if (roleAnswer) return roleAnswer;
  return candidate;
}

function idleSaveButtonLabel(btn) {
  return btn.dataset.aiCollectorLayout === 'answer-left-2' ? '💾 저장' : '💾';
}

function placeAnswerSaveControl(btn) {
  Object.assign(btn.style, {
    position: 'static', display: 'block', margin: '8px auto 0 0',
    width: 'fit-content', maxWidth: '100%', minHeight: '32px', height: 'auto',
    padding: '0 10px', boxSizing: 'border-box', whiteSpace: 'nowrap',
    clear: 'both', alignSelf: 'flex-start', flex: '0 0 auto', zIndex: 'auto',
  });
  btn.dataset.aiCollectorLayout = 'answer-left-2';
  btn.textContent = idleSaveButtonLabel(btn);
}

function bindChatGptTurn(turn, answerEl, index) {
  const buttons = [...turn.querySelectorAll(`[${SAVE_BTN_ATTR}]`)];
  const existing = buttons.find((button) => button.parentElement === answerEl);
  if (chatGptTurnBindings.get(turn) === answerEl &&
      turn.dataset.aiCollectorBound === AI_COLLECTOR_BINDING_VERSION &&
      buttons.length === 1 && existing && collectorOwnedButtons.has(existing)) {
    if (answerEl.lastElementChild !== existing) answerEl.appendChild(existing);
    return;
  }

  buttons.forEach((button) => button.remove());
  turn.dataset.aiCollectorBound = AI_COLLECTOR_BINDING_VERSION;
  chatGptTurnBindings.set(turn, answerEl);
  if (getComputedStyle(answerEl).position === 'static') answerEl.style.position = 'relative';
  const btn = createSaveButton();
  placeAnswerSaveControl(btn);
  if (turn.matches?.('.message-row')) {
    // A separate line reserves space; no absolute overlay on the message text.
    btn.setAttribute('aria-label', '김비서 답변 저장');
    btn.title = '김비서 답변 저장';
  }
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleSaveClick(btn, index, 'chatgpt.com', answerEl, turn);
  });
  answerEl.appendChild(btn);
}

function injectSaveButtons() {
  if (!hasCollectorRuntime() || collectorHealth === 'stale') { stopInvalidCollectorContext(); return; }
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
    selector = [
      '[data-message-author-role="assistant"]',
      '[data-markdown-text-style="assistant-message"]',
      'main .markdown.prose', 'main .markdown', 'main .prose',
      'main [class*="markdown"]', 'main [class*="prose"]',
    ].join(', ');
  }
  else if (host === 'gemini.google.com') selector = 'model-response';
  else return;

  if (host === 'chatgpt.com') {
    // Reconcile stale v2.8 buttons, row reuse, and transitions to card/user rows.
    document.querySelectorAll('.message-row').forEach((row, index) => {
      const answer = getDotAnswer(row);
      if (answer) bindChatGptTurn(row, answer, index);
      else {
        row.querySelectorAll(`[${SAVE_BTN_ATTR}]`).forEach(button => button.remove());
        delete row.dataset.aiCollectorBound;
        chatGptTurnBindings.delete(row);
      }
    });
  }
  const candidates = [...document.querySelectorAll(selector)];
  const scannedTurns = new Set();
  candidates.forEach((el, index) => {
    if (host === 'chatgpt.com') {
      if (el.closest('.message-row, [data-ai-save-injected], [data-message-author-role="user"]')) return;
      const turn = getChatGptTurn(el);
      if (scannedTurns.has(turn)) return;
      scannedTurns.add(turn);
      const answerEl = getChatGptAnswer(turn, el);
      bindChatGptTurn(turn, answerEl, index);
      return;
    }
    // Gemini's native actions are outside message-content. Keep the control in
    // the answer flow, before those actions, and reconcile late/replaced content.
    const buttonHost = host === 'gemini.google.com' ? el.querySelector('message-content') || el : el;
    const existingButtons = [...el.querySelectorAll(`[${SAVE_BTN_ATTR}]`)];
    if (existingButtons.length === 1 && collectorOwnedButtons.has(existingButtons[0]) &&
        (host !== 'gemini.google.com' || existingButtons[0].parentElement === buttonHost)) {
      if (buttonHost.lastElementChild !== existingButtons[0]) buttonHost.appendChild(existingButtons[0]);
      return;
    }
    existingButtons.forEach(button => button.remove());
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const btn = createSaveButton();
    placeAnswerSaveControl(btn);
    if (host === 'gemini.google.com') {
      btn.dataset.aiCollectorPlacement = buttonHost === el ? 'gemini-response-fallback-1' : 'gemini-answer-before-actions-1';
    }
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleSaveClick(btn, index, host, el);
    });
    buttonHost.appendChild(btn);
  });
}

// --- SPA 대응: 새 메시지 감지 후 버튼 재삽입 ---
let injectTimer = null;
collectorObserver = new MutationObserver((changes) => {
  if (changes.every(change => change.target instanceof Element &&
      (change.target.matches(`[${SAVE_BTN_ATTR}]`) || change.target.closest(`[${SAVE_BTN_ATTR}]`)))) return;
  clearTimeout(injectTimer);
  injectTimer = setTimeout(injectSaveButtons, 600);
});
collectorObserver.observe(document.body, {
  childList: true,
  subtree: true,
  ...(window.location.hostname === 'chatgpt.com' ? {
    attributes: true,
    attributeFilter: ['class', 'data-message-id', 'data-message-author-role',
      'data-markdown-text-style', 'data-mcp-confirmation-chip', 'data-orbit-thread-only'],
  } : {}),
});

injectSaveButtons();
checkCollectorConnection();
window.addEventListener('focus', () => checkCollectorConnection());
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkCollectorConnection(); });

// ================================================================
// Gemini는 여러 선택자를 순서대로 시도
const GEMINI_SELECTORS = [
  'model-response',
  '.model-response-text',
  '.response-content',
  '.markdown'
];

const SELECTORS = {
  'gemini.google.com': 'model-response', // 아래에서 폴백 선택자도 처리
  'chatgpt.com': '[data-message-author-role="assistant"], [data-markdown-text-style="assistant-message"], .prose',
  'claude.ai': '.standard-markdown, .font-claude-message'
};

if (hasCollectorRuntime()) chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collectorPageHealth') {
    checkCollectorConnection().then(ok => sendResponse({ok, build:AI_COLLECTOR_HEALTH_BUILD, instance:collectorInstance, extensionId:hasCollectorRuntime() ? chrome.runtime.id : null, health:collectorHealth}));
    return true;
  }
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
      messages = [...document.querySelectorAll(selector)].filter(el =>
        !el.closest('[data-message-author-role="user"], [data-user-message-bubble], .font-user-message, [data-testid="user-message"], [data-ai-save-injected]'));
      if (host === 'chatgpt.com' && /^\/dots(?:\/|$)/.test(window.location.pathname)) {
        messages = [...document.querySelectorAll('.message-row')].map(getDotAnswer).filter(Boolean);
      }
    }

    if (messages && messages.length > 0) {
      const lastMessage = extractTextWithoutInjectedUi(messages[messages.length - 1]);
      sendResponse({ data: lastMessage, source: host });
    } else {
      sendResponse({ error: "대화 내용을 찾을 수 없습니다." });
    }
  }
  return true;
});
