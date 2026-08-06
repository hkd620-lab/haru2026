/* eslint-disable no-console */
const assert = require('assert');
const Module = require('module');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-haru-result-chat';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
process.env.FUNCTIONS_EMULATOR = process.env.FUNCTIONS_EMULATOR || 'true';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required. Start the Firestore emulator first.');
}

const useRealGemini = process.env.HARU_RESULT_CHAT_REAL_GEMINI === '1';
const realGeminiSmokeOnly = process.env.HARU_RESULT_CHAT_REAL_SMOKE === '1';
const realGenai = require('@google/genai');
const genaiCalls = [];
let forceWebSearchError = false;
let webSearchDelayMs = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneGenerateContentRequest(request) {
  return {
    model: request.model,
    hasGoogleSearchTool: Boolean(request.config?.tools?.some((tool) => tool.googleSearch)),
    maxOutputTokens: request.config?.maxOutputTokens ?? null,
    contentsPreview: String(request.contents || '').slice(0, 200),
  };
}

class InstrumentedGoogleGenAI {
  constructor(options) {
    this.inner = useRealGemini ? new realGenai.GoogleGenAI(options) : null;
    this.models = {
      generateContent: async (request) => {
        const captured = cloneGenerateContentRequest(request);
        genaiCalls.push(captured);
        if (captured.hasGoogleSearchTool && webSearchDelayMs > 0) {
          await sleep(webSearchDelayMs);
        }
        if (captured.hasGoogleSearchTool && forceWebSearchError) {
          throw new Error('injected_web_search_failure');
        }
        if (this.inner) {
          return this.inner.models.generateContent(request);
        }
        if (captured.hasGoogleSearchTool) {
          return {
            text: '검색으로 확인한 테스트 답변입니다.',
            usageMetadata: { promptTokenCount: 101, candidatesTokenCount: 23 },
            candidates: [{
              groundingMetadata: {
                webSearchQueries: ['테스트 최신자료 확인'],
                groundingChunks: [{ web: { title: '테스트 출처', uri: 'https://example.test/source' } }],
              },
            }],
          };
        }
        return {
          text: '기록만 바탕으로 정리한 테스트 답변입니다.',
          usageMetadata: { promptTokenCount: 41, candidatesTokenCount: 11 },
          candidates: [{}],
        };
      },
    };
  }
}

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@google/genai') {
    return { ...realGenai, GoogleGenAI: InstrumentedGoogleGenAI };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const admin = require('firebase-admin');
const functions = require('../lib/index.js');
const db = admin.firestore();

const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
const USERS = {
  free: 'result-chat-free-user',
  basic: 'result-chat-basic-user',
  premium: 'result-chat-premium-user',
  developer: DEV_UID,
};

function callable(uid, data) {
  return functions.chatWithResult.run({
    auth: { uid },
    data,
    rawRequest: { headers: {} },
  });
}

async function deleteCollection(path) {
  const ref = db.collection(path);
  const snap = await ref.get();
  await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
}

async function resetUser(uid) {
  const records = await db.collection('users').doc(uid).collection('records').get();
  for (const record of records.docs) {
    const threads = await record.ref.collection('resultThreads').get();
    for (const thread of threads.docs) {
      const messages = await thread.ref.collection('messages').get();
      await Promise.all(messages.docs.map((message) => message.ref.delete()));
      await thread.ref.delete();
    }
    await record.ref.delete();
  }
  await db.collection('users').doc(uid).collection('subscription').doc('info').delete().catch(() => {});
  await db.collection('users').doc(uid).collection('rateLimits').doc('resultChat').delete().catch(() => {});
  await db.collection('users').doc(uid).delete().catch(() => {});
}

async function seed() {
  await deleteCollection('aiUsageLogs');
  for (const uid of Object.values(USERS)) {
    await resetUser(uid);
  }
  await db.doc(`users/${USERS.free}/subscription/info`).set({ plan: 'free' });
  await db.doc(`users/${USERS.basic}/subscription/info`).set({ plan: 'basic' });
  await db.doc(`users/${USERS.premium}/subscription/info`).set({ plan: 'premium' });
  await db.doc(`users/${USERS.developer}/subscription/info`).set({ plan: 'premium' });

  const baseRecords = {
    memo: {
      formats: ['메모'],
      date: '2026-08-06',
      memo_sayu: '오늘 회의에서 캠프 사고 대응 자료를 정리했다. 사실관계, 연락 기록, 준비 서류가 중요하다.',
    },
    law: {
      formats: ['HARUraw'],
      date: '2026-08-06',
      haruraw_sayu: '캠프 중 학생 간 폭력 사고가 발생했고 안전관리 소홀 주장이 있다. 관련 법조문과 준비자료를 정리했다.',
    },
    plant: {
      formats: ['텃밭일지'],
      date: '2026-08-03',
      plantDetective: [{
        title: '수박',
        aiKoName: '수박',
        scientificName: 'Citrullus lanatus',
        note: '잎은 건강하지만 물주기와 순 관리가 궁금하다.',
        geminiAnalysis: { analysis: '사진상 수박으로 보이며 잎 상태는 대체로 양호하다.', careAdvice: '과습을 피하고 오전에 관찰한다.' },
      }],
    },
    stock: {
      formats: ['HARU주식관리'],
      date: '2026-05-13',
      stock_sayu: '삼성전자 매수와 매도 기록이 있다. 매매 이유와 다음 점검 포인트를 남겼다.',
    },
  };

  for (const uid of Object.values(USERS)) {
    for (const [recordId, data] of Object.entries(baseRecords)) {
      await db.doc(`users/${uid}/records/${recordId}`).set(data);
    }
  }
}

async function getThread(uid, recordId, threadId) {
  const ref = db.doc(`users/${uid}/records/${recordId}/resultThreads/${threadId}`);
  const snap = await ref.get();
  return snap.data() || {};
}

async function getMessages(uid, recordId, threadId) {
  const snap = await db.collection(`users/${uid}/records/${recordId}/resultThreads/${threadId}/messages`).get();
  return snap.docs.map((doc) => doc.data());
}

async function getLogs(filter = {}) {
  const snap = await db.collection('aiUsageLogs').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((log) => Object.entries(filter).every(([key, value]) => log[key] === value));
}

function countWebSearchCalls() {
  return genaiCalls.filter((call) => call.hasGoogleSearchTool).length;
}

async function run() {
  await seed();

  const recordOnlyBefore = genaiCalls.length;
  const recordOnly = await callable(USERS.basic, {
    recordId: 'memo',
    sourceKey: 'memo_sayu',
    question: '이 기록의 핵심을 세 문장으로 정리해줘.',
    searchPreference: 'auto',
  });
  assert.strictEqual(recordOnly.answerRoute, 'record_only');
  assert.strictEqual(recordOnly.webSearchUsed, false);
  assert.strictEqual(recordOnly.requiresConfirmation, undefined);
  const recordOnlyCalls = genaiCalls.slice(recordOnlyBefore);
  assert.strictEqual(recordOnlyCalls.length, 1);
  assert.strictEqual(recordOnlyCalls[0].hasGoogleSearchTool, false);
  let thread = await getThread(USERS.basic, 'memo', 'memo_sayu');
  assert.strictEqual(thread.webSearchUsedCount || 0, 0);
  assert.strictEqual(thread.webSearchReservedCount || 0, 0);
  let messages = await getMessages(USERS.basic, 'memo', 'memo_sayu');
  assert.strictEqual(messages.filter((message) => message.role === 'user').length, 1);
  assert.strictEqual(messages.filter((message) => message.role === 'assistant').length, 1);

  const confirmBeforeCalls = genaiCalls.length;
  const confirm = await callable(USERS.basic, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '현재 이 법 조항이 개정되었는지 확인해줘.',
    searchPreference: 'auto',
  });
  assert.strictEqual(confirm.requiresConfirmation, true);
  assert.strictEqual(confirm.confirmationType, 'web_search');
  assert.strictEqual(genaiCalls.length, confirmBeforeCalls);
  thread = await getThread(USERS.basic, 'law', 'haruraw_sayu');
  assert.strictEqual(thread.webSearchUsedCount || 0, 0);
  assert.strictEqual(thread.webSearchReservedCount || 0, 0);
  messages = await getMessages(USERS.basic, 'law', 'haruraw_sayu');
  assert.strictEqual(messages.length, 0);

  const searchBefore = countWebSearchCalls();
  const searched = await callable(USERS.basic, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '현재 이 법 조항이 개정되었는지 확인해줘.',
    searchPreference: 'web_confirmed',
  });
  assert.strictEqual(searched.answerRoute, 'web_search');
  assert.strictEqual(searched.webSearchUsed, true);
  assert.ok(searched.sources.length >= 1);
  assert.strictEqual(countWebSearchCalls(), searchBefore + 1);
  assert.strictEqual(searched.webSearchLimit, 2);
  assert.strictEqual(searched.webSearchUsedCount, 1);
  assert.strictEqual(searched.webSearchRemainingCount, 1);
  thread = await getThread(USERS.basic, 'law', 'haruraw_sayu');
  assert.strictEqual(thread.webSearchUsedCount, 1);
  assert.strictEqual(thread.webSearchReservedCount, 0);
  messages = await getMessages(USERS.basic, 'law', 'haruraw_sayu');
  assert.strictEqual(messages.filter((message) => message.role === 'user').length, 1);
  assert.strictEqual(messages.filter((message) => message.role === 'assistant').length, 1);

  if (realGeminiSmokeOnly) {
    const logs = await getLogs({ featureName: 'result_chat' });
    console.log(JSON.stringify({
      mode: useRealGemini ? 'real-gemini-smoke' : 'instrumented-fake-gemini-smoke',
      genaiCalls,
      webSearchCallCount: countWebSearchCalls(),
      resultChatLogCount: logs.length,
      checkedPlans: Array.from(new Set(logs.map((log) => log.actualPlan))).sort(),
      smoke: {
        recordOnlyRoute: recordOnly.answerRoute,
        recordOnlyGoogleSearchTool: recordOnlyCalls[0].hasGoogleSearchTool,
        webSearchRoute: searched.answerRoute,
        webSearchUsedCount: searched.webSearchUsedCount,
        webSearchRemainingCount: searched.webSearchRemainingCount,
        webSearchSources: searched.sources.length,
      },
    }, null, 2));
    return;
  }

  const cancelProbe = await callable(USERS.premium, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '현재 이 법 조항이 개정되었는지 확인해줘.',
    searchPreference: 'auto',
  });
  assert.strictEqual(cancelProbe.requiresConfirmation, true);
  thread = await getThread(USERS.premium, 'law', 'haruraw_sayu');
  assert.strictEqual(thread.webSearchUsedCount || 0, 0);
  assert.strictEqual(thread.webSearchReservedCount || 0, 0);
  messages = await getMessages(USERS.premium, 'law', 'haruraw_sayu');
  assert.strictEqual(messages.length, 0);

  forceWebSearchError = true;
  await assert.rejects(
    callable(USERS.free, {
      recordId: 'law',
      sourceKey: 'haruraw_sayu',
      question: '현재 이 법 조항이 개정되었는지 확인해줘.',
      searchPreference: 'web_confirmed',
    }),
    /AI 응답 생성에 실패했습니다/,
  );
  forceWebSearchError = false;
  thread = await getThread(USERS.free, 'law', 'haruraw_sayu');
  assert.strictEqual(thread.webSearchUsedCount || 0, 0);
  assert.strictEqual(thread.webSearchReservedCount || 0, 0);
  messages = await getMessages(USERS.free, 'law', 'haruraw_sayu');
  assert.strictEqual(messages.length, 0);

  webSearchDelayMs = 250;
  const concurrentSearchBefore = countWebSearchCalls();
  const concurrent = await Promise.allSettled([
    callable(USERS.premium, {
      recordId: 'stock',
      sourceKey: 'stock_sayu',
      question: '현재 삼성전자 주가가 하락한 이유는?',
      searchPreference: 'web_confirmed',
    }),
    callable(USERS.premium, {
      recordId: 'stock',
      sourceKey: 'stock_sayu',
      question: '현재 삼성전자 주가가 하락한 이유는?',
      searchPreference: 'web_confirmed',
    }),
  ]);
  webSearchDelayMs = 0;
  assert.strictEqual(concurrent.filter((item) => item.status === 'fulfilled').length >= 1, true);
  assert.strictEqual(concurrent.filter((item) => item.status === 'rejected').length <= 1, true);
  assert.strictEqual(countWebSearchCalls(), concurrentSearchBefore + 1);
  thread = await getThread(USERS.premium, 'stock', 'stock_sayu');
  assert.strictEqual(thread.webSearchUsedCount, 1);
  assert.strictEqual(thread.webSearchReservedCount, 0);
  messages = await getMessages(USERS.premium, 'stock', 'stock_sayu');
  assert.strictEqual(messages.filter((message) => message.role === 'assistant').length, 1);

  await callable(USERS.basic, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '현재 관련 판례가 최근에 나왔는지 확인해줘.',
    searchPreference: 'web_confirmed',
  });
  const exhaustedRecordOnly = await callable(USERS.basic, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '지금까지 나눈 내용을 간단히 정리해줘.',
    searchPreference: 'auto',
  });
  assert.strictEqual(exhaustedRecordOnly.answerRoute, 'record_only');
  assert.strictEqual(exhaustedRecordOnly.webSearchUsed, false);
  assert.strictEqual(exhaustedRecordOnly.webSearchRemainingCount, 0);

  const ambiguous = await callable(USERS.basic, {
    recordId: 'plant',
    sourceKey: 'plantDetective',
    sourceIndex: 0,
    question: '이 식물에 물을 얼마나 줘야 하나요?',
    searchPreference: 'auto',
  });
  assert.strictEqual(ambiguous.requiresConfirmation, true);
  assert.strictEqual(ambiguous.confirmationType, 'ambiguous');
  const plantRecordOnly = await callable(USERS.basic, {
    recordId: 'plant',
    sourceKey: 'plantDetective',
    sourceIndex: 0,
    question: '이 식물에 물을 얼마나 줘야 하나요?',
    searchPreference: 'record_only',
  });
  assert.strictEqual(plantRecordOnly.answerRoute, 'record_only');
  assert.strictEqual(plantRecordOnly.webSearchUsed, false);
  const plantWeb = await callable(USERS.basic, {
    recordId: 'plant',
    sourceKey: 'plantDetective',
    sourceIndex: 0,
    question: '이 식물에 물을 얼마나 줘야 하나요?',
    searchPreference: 'web_confirmed',
  });
  assert.strictEqual(plantWeb.answerRoute, 'web_search');
  assert.strictEqual(plantWeb.webSearchUsed, true);

  const legalRisk = await callable(USERS.basic, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '이 사건에서 제가 반드시 이길 수 있나요?',
    searchPreference: 'auto',
  });
  assert.strictEqual(legalRisk.answerRoute, 'high_risk_guidance');
  const financeRisk = await callable(USERS.basic, {
    recordId: 'stock',
    sourceKey: 'stock_sayu',
    question: '이 종목을 지금 사면 반드시 수익이 나나요?',
    searchPreference: 'auto',
  });
  assert.strictEqual(financeRisk.answerRoute, 'high_risk_guidance');

  const developerRecordOnly = await callable(USERS.developer, {
    recordId: 'memo',
    sourceKey: 'memo_sayu',
    question: '이 기록의 핵심을 정리해줘.',
    searchPreference: 'auto',
  });
  assert.strictEqual(developerRecordOnly.plan, 'developer');
  assert.strictEqual(developerRecordOnly.answerRoute, 'record_only');

  const logs = await getLogs({ featureName: 'result_chat' });
  assert.ok(logs.some((log) => log.actualPlan === 'basic' && log.answerRoute === 'record_only' && log.webSearchUsed === false && log.searchSourceCount === 0));
  assert.ok(logs.some((log) => log.actualPlan === 'basic' && log.answerRoute === 'web_search' && log.webSearchUsed === true && log.searchSourceCount >= 1));
  assert.ok(logs.some((log) => log.actualPlan === 'developer' && log.answerRoute === 'record_only'));
  assert.ok(logs.some((log) => log.success === false && typeof log.errorCode === 'string' && log.errorCode.length > 0));
  assert.ok(logs.every((log) => log.actualPlan !== 'beta'));

  console.log(JSON.stringify({
    mode: useRealGemini ? 'real-gemini' : 'instrumented-fake-gemini',
    genaiCalls,
    webSearchCallCount: countWebSearchCalls(),
    resultChatLogCount: logs.length,
    checkedPlans: Array.from(new Set(logs.map((log) => log.actualPlan))).sort(),
  }, null, 2));
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
