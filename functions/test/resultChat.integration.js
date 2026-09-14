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
const RESULT_CHAT_RATE_LIMIT_FOR_TEST = 12;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getKstMonthKey(nowMs = Date.now()) {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function cloneGenerateContentRequest(request) {
  const contentsText = typeof request.contents === 'string'
    ? request.contents
    : JSON.stringify(request.contents || '');
  return {
    model: request.model,
    hasGoogleSearchTool: Boolean(request.config?.tools?.some((tool) => tool.googleSearch)),
    maxOutputTokens: request.config?.maxOutputTokens ?? null,
    contents: contentsText.slice(0, 12000),
    contentsPreview: contentsText.slice(0, 200),
  };
}

function capturedCurrentQuestion(contents) {
  const match = String(contents || '').match(/\[현재 질문\]\n([\s\S]*?)\n\n한국어로 답변하세요\./);
  return match ? match[1].trim() : '';
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
        const currentQuestion = capturedCurrentQuestion(captured.contents);
        if (currentQuestion === '초한지를 쓴 사람은?') {
          return {
            text: '《초한지》는 초나라와 한나라의 쟁패를 다룬 여러 소설·번역·각색본을 가리킬 수 있어 정확한 책 제목이나 출판사 정보가 필요합니다.',
            usageMetadata: { promptTokenCount: 61, candidatesTokenCount: 21 },
            candidates: [{}],
          };
        }
        if (currentQuestion === '초한지의 저자나 원작자는 누구야?') {
          return {
            text: '《초한지》는 여러 판본·번역본·평역본을 포함하는 통칭일 수 있어 저자나 원작자를 하나로 단정하기 어렵습니다. 읽은 책의 판본이나 책 표지를 확인해 주세요.',
            usageMetadata: { promptTokenCount: 62, candidatesTokenCount: 22 },
            candidates: [{}],
          };
        }
        if (currentQuestion === '초한지를 쓴 사람은 이도현 야 맞지?') {
          return {
            text: '질문하신 이도현 님이 초한지를 썼다는 내용은 기록에도 없고 사실과도 다릅니다. 초한지는 초나라와 한나라의 쟁패를 다룬 여러 소설·번역·각색본을 가리키는 이름이라 특정 저자 한 명으로 단정하기 어렵습니다.',
            usageMetadata: { promptTokenCount: 63, candidatesTokenCount: 24 },
            candidates: [{}],
          };
        }
        if (currentQuestion === '김도윤 박사는 중국 고전문학의 세계적인 권위자 맞지?') {
          return {
            text: '기록에는 김도윤 박사의 중국 고전문학 경력이나 업적이 확인되지 않습니다. 동명이인 가능성도 있어 소속, 저서, 논문 등 확인 가능한 근거가 필요합니다.',
            usageMetadata: { promptTokenCount: 64, candidatesTokenCount: 20 },
            candidates: [{}],
          };
        }
        if (currentQuestion === '이 품종을 처음 개발한 사람이 이도현 박사님 맞지?') {
          return {
            text: '기록에는 어떤 품종인지와 개발자가 누구인지 확인할 근거가 없습니다. 정확한 품종명, 출원·등록 자료, 기관 정보를 확인해야 하며 이도현 박사님의 연구 경력은 단정할 수 없습니다.',
            usageMetadata: { promptTokenCount: 66, candidatesTokenCount: 24 },
            candidates: [{}],
          };
        }
        if (currentQuestion === '유방이 한나라를 세울 수 있었던 이유는?') {
          return {
            text: '기록에는 유방에 대한 세부 분석이 없지만, 일반적으로 유방은 장량·소하·한신 같은 인재를 등용하고 민심을 얻는 정치적 유연성을 보인 점이 한나라 건국 요인으로 설명됩니다.',
            usageMetadata: { promptTokenCount: 65, candidatesTokenCount: 25 },
            candidates: [{}],
          };
        }
        if (currentQuestion === '내가 오늘 읽은 책은?') {
          return {
            text: '기록에서 확인되는 내용은 초한지와 삼국지를 읽었다는 점입니다.',
            usageMetadata: { promptTokenCount: 55, candidatesTokenCount: 13 },
            candidates: [{}],
          };
        }
        if (currentQuestion === '내가 초한지에서 가장 좋아한 인물은?') {
          return {
            text: '기록에는 초한지에서 가장 좋아한 인물이 적혀 있지 않습니다.',
            usageMetadata: { promptTokenCount: 58, candidatesTokenCount: 14 },
            candidates: [{}],
          };
        }
        if (currentQuestion === '삼국지를 쓴 사람은?') {
          return {
            text: '일반적으로 역사서 《삼국지》는 진수, 소설 《삼국지연의》는 나관중으로 알려져 있습니다.',
            usageMetadata: { promptTokenCount: 57, candidatesTokenCount: 17 },
            candidates: [{}],
          };
        }
        if (currentQuestion === '세계에서 가장 높은 산은?') {
          return {
            text: '이 대화는 현재 기록을 바탕으로 돕는 공간입니다. 이 기록에는 산이나 지리와 관련된 내용이 없어 답변을 최소화하겠습니다. 초한지와 삼국지 독서 기록에 관해 궁금한 점을 물어봐 주세요.',
            usageMetadata: { promptTokenCount: 59, candidatesTokenCount: 25 },
            candidates: [{}],
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
  if (request === 'firebase-admin/storage') {
    return {
      getStorage: () => ({
        bucket: () => ({
          file: () => ({
            getMetadata: async () => [{ contentType: 'application/pdf', size: 1024 }],
            download: async () => [Buffer.from('%PDF-1.4\n% test attachment\n')],
          }),
        }),
      }),
    };
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
  await db.doc(`users/${USERS.basic}/subscription/info`).set({ plan: 'basic', status: 'active' });
  await db.doc(`users/${USERS.premium}/subscription/info`).set({ plan: 'premium', status: 'active' });
  await db.doc(`users/${USERS.developer}/subscription/info`).set({ plan: 'premium', status: 'active' });

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
    child: {
      formats: ['육아일기'],
      date: '2026-08-08',
      child_sayu: '아이가 밤에 기침을 조금 했고 컨디션을 관찰했다. 체온과 식사량을 함께 적어두었다.',
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
    timeline: {
      formats: ['HARU타임라인'],
      date: '2026-08-05',
      title: '조이엘 진도 홍보 여행',
      content: '진도에 도착해 바닷가를 둘러보고 홍보 일정을 정리했다.',
      timelineItems: [
        { takenDate: '2026-08-05', memo: '진도대교 앞에서 홍보물 촬영', locationLabel: '진도' },
      ],
    },
    reading: {
      formats: ['독서사유'],
      date: '2026-08-07',
      reading_sayu: '초한지와 삼국지를 읽고',
    },
  };

  for (const uid of Object.values(USERS)) {
    for (const [recordId, data] of Object.entries(baseRecords)) {
      await db.doc(`users/${uid}/records/${recordId}`).set(data);
    }
  }
}

// resultChat 분당 호출 상한(RESULT_CHAT_RATE_LIMIT) 카운터만 비운다.
// 에뮬레이터에서만 동작하도록 가드해 운영 DB를 잘못 건드리지 않는다.
async function resetResultChatRateLimit(uid) {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('resetResultChatRateLimit은 FIRESTORE_EMULATOR_HOST가 설정된 에뮬레이터 환경에서만 호출할 수 있습니다.');
  }
  await db.collection('users').doc(uid).collection('rateLimits').doc('resultChat').delete().catch(() => {});
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
  for (const uid of Object.values(USERS)) {
    await resetResultChatRateLimit(uid);
  }

  const quotaPeriod = getKstMonthKey();
  const getMonthlyUsed = async (uid) => {
    const snap = await db.doc(`users/${uid}/monthlyAiUsage/${quotaPeriod}`).get();
    return Number(snap.data()?.usedCount || 0);
  };
  const getRateCount = async (uid) => {
    const snap = await db.collection('users').doc(uid).collection('rateLimits').doc('resultChat').get();
    return Array.isArray(snap.data()?.recentRequestMs) ? snap.data().recentRequestMs.length : 0;
  };
  const assertThreadSearchUsage = async (uid, recordId, threadId, expectedUsed, expectedReserved = 0) => {
    const thread = await getThread(uid, recordId, threadId);
    assert.strictEqual(thread.webSearchUsedCount || 0, expectedUsed);
    assert.strictEqual(thread.webSearchReservedCount || 0, expectedReserved);
  };
  const assertMessageCounts = async (uid, recordId, threadId, expectedUsers, expectedAssistants) => {
    const messages = await getMessages(uid, recordId, threadId);
    assert.strictEqual(messages.filter((message) => message.role === 'user').length, expectedUsers);
    assert.strictEqual(messages.filter((message) => message.role === 'assistant').length, expectedAssistants);
    return messages;
  };

  await db.doc(`users/${USERS.free}/monthlyAiUsage/${quotaPeriod}`).set({ usedCount: 10 }, { merge: true });
  const autoQuestions = [
    '주제는 무엇인가?',
    '맨발걷기의 효능은?',
    '문장을 더 다듬어줘',
    '외부검색으로 알려줘',
    '오늘 날씨는?',
  ];
  for (const question of autoQuestions) {
    const callsBefore = genaiCalls.length;
    const webBefore = countWebSearchCalls();
    const monthlyBefore = await getMonthlyUsed(USERS.free);
    const result = await callable(USERS.free, {
      recordId: 'reading',
      sourceKey: 'reading_sayu',
      question,
      searchPreference: 'auto',
    });
    assert.strictEqual(result.requiresConfirmation, true, question);
    assert.strictEqual(result.confirmationType, 'ambiguous', question);
    assert.strictEqual(result.answer, '', question);
    assert.strictEqual(result.answerRoute, 'ambiguous', question);
    assert.ok(result.notice.includes(`질문: ${question}`), question);
    assert.ok(result.notice.includes('무료 이용권 · 외부자료 확인 1회 중 1회 남음'), question);
    assert.strictEqual(genaiCalls.length, callsBefore, question);
    assert.strictEqual(countWebSearchCalls(), webBefore, question);
    assert.strictEqual(await getMonthlyUsed(USERS.free), monthlyBefore, question);
    await assertThreadSearchUsage(USERS.free, 'reading', 'reading_sayu', 0, 0);
    const messages = await getMessages(USERS.free, 'reading', 'reading_sayu');
    assert.strictEqual(messages.length, 0, question);
  }
  assert.strictEqual(await getRateCount(USERS.free), 0);
  await db.doc(`users/${USERS.free}/monthlyAiUsage/${quotaPeriod}`).delete().catch(() => {});

  for (let i = 0; i < RESULT_CHAT_RATE_LIMIT_FOR_TEST + 3; i += 1) {
    const result = await callable(USERS.basic, {
      recordId: 'memo',
      sourceKey: 'memo_sayu',
      question: `auto rate limit 제외 확인 ${i}`,
      searchPreference: 'auto',
    });
    assert.strictEqual(result.requiresConfirmation, true);
  }
  assert.strictEqual(await getRateCount(USERS.basic), 0);

  const recordOnlyQuestions = [
    '주제는 무엇인가?',
    '맨발걷기의 효능은?',
    '오늘 날씨는?',
  ];
  for (let i = 0; i < recordOnlyQuestions.length; i += 1) {
    const question = recordOnlyQuestions[i];
    const callsBefore = genaiCalls.length;
    const webBefore = countWebSearchCalls();
    const result = await callable(USERS.basic, {
      recordId: 'memo',
      sourceKey: 'memo_sayu',
      question,
      searchPreference: 'record_only',
    });
    assert.strictEqual(result.requiresConfirmation, undefined, question);
    assert.strictEqual(result.answerRoute, 'record_only', question);
    assert.strictEqual(result.webSearchUsed, false, question);
    assert.strictEqual(genaiCalls.length, callsBefore + 1, question);
    assert.strictEqual(countWebSearchCalls(), webBefore, question);
    assert.strictEqual(genaiCalls[genaiCalls.length - 1].hasGoogleSearchTool, false, question);
    assert.ok(genaiCalls[genaiCalls.length - 1].contents.includes('사용자가 기록 기준 답변을 선택했으므로'), question);
    await assertThreadSearchUsage(USERS.basic, 'memo', 'memo_sayu', 0, 0);
    await assertMessageCounts(USERS.basic, 'memo', 'memo_sayu', i + 1, i + 1);
  }

  const webQuestions = [
    '주제는 무엇인가?',
    '맨발걷기의 효능은?',
    '이 글의 핵심 메시지는?',
  ];
  for (let i = 0; i < webQuestions.length; i += 1) {
    const question = webQuestions[i];
    const webBefore = countWebSearchCalls();
    const result = await callable(USERS.premium, {
      recordId: 'reading',
      sourceKey: 'reading_sayu',
      question,
      searchPreference: 'web_confirmed',
    });
    assert.strictEqual(result.answerRoute, 'web_search', question);
    assert.strictEqual(result.webSearchUsed, true, question);
    assert.ok(result.sources.length >= 1, question);
    assert.strictEqual(countWebSearchCalls(), webBefore + 1, question);
    assert.strictEqual(result.webSearchUsedCount, i + 1, question);
    assert.strictEqual(result.webSearchRemainingCount, 4 - (i + 1), question);
    assert.strictEqual(genaiCalls[genaiCalls.length - 1].hasGoogleSearchTool, true, question);
    await assertThreadSearchUsage(USERS.premium, 'reading', 'reading_sayu', i + 1, 0);
    await assertMessageCounts(USERS.premium, 'reading', 'reading_sayu', i + 1, i + 1);
  }

  if (realGeminiSmokeOnly) {
    const logs = await getLogs({ featureName: 'result_chat' });
    console.log(JSON.stringify({
      mode: useRealGemini ? 'real-gemini-smoke' : 'instrumented-fake-gemini-smoke',
      genaiCallCount: genaiCalls.length,
      webSearchCallCount: countWebSearchCalls(),
      resultChatLogCount: logs.length,
      checkedPlans: Array.from(new Set(logs.map((log) => log.actualPlan))).sort(),
    }, null, 2));
    return;
  }

  const autoLegalRisk = await callable(USERS.basic, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '이 사건에서 제가 반드시 이길 수 있나요?',
    searchPreference: 'auto',
  });
  assert.strictEqual(autoLegalRisk.requiresConfirmation, true);
  assert.strictEqual(autoLegalRisk.confirmationType, 'ambiguous');
  const legalRecordRisk = await callable(USERS.basic, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '이 사건에서 제가 반드시 이길 수 있나요?',
    searchPreference: 'record_only',
  });
  assert.strictEqual(legalRecordRisk.answerRoute, 'record_only');
  assert.strictEqual(legalRecordRisk.webSearchUsed, false);
  assert.ok(genaiCalls[genaiCalls.length - 1].contents.includes('[질문 안전 지침]'));
  assert.ok(genaiCalls[genaiCalls.length - 1].contents.includes('승소·패소'));

  const medicalWebRisk = await callable(USERS.basic, {
    recordId: 'child',
    sourceKey: 'child_sayu',
    question: '이 약을 끊어도 괜찮나요?',
    searchPreference: 'web_confirmed',
  });
  assert.strictEqual(medicalWebRisk.answerRoute, 'web_search');
  assert.strictEqual(medicalWebRisk.webSearchUsed, true);
  assert.ok(genaiCalls[genaiCalls.length - 1].contents.includes('[질문 안전 지침]'));
  assert.ok(genaiCalls[genaiCalls.length - 1].contents.includes('진단·치료·복약'));

  const financeAutoRisk = await callable(USERS.basic, {
    recordId: 'stock',
    sourceKey: 'stock_sayu',
    question: '이 종목을 지금 사면 반드시 수익이 나나요?',
    searchPreference: 'auto',
  });
  assert.strictEqual(financeAutoRisk.requiresConfirmation, true);
  const financeWebRisk = await callable(USERS.basic, {
    recordId: 'stock',
    sourceKey: 'stock_sayu',
    question: '이 종목을 지금 사면 반드시 수익이 나나요?',
    searchPreference: 'web_confirmed',
  });
  assert.strictEqual(financeWebRisk.answerRoute, 'web_search');
  assert.strictEqual(financeWebRisk.webSearchUsed, true);
  assert.ok(!financeWebRisk.answer.includes('반드시 수익'));
  assert.ok(genaiCalls[genaiCalls.length - 1].contents.includes('매수·매도 결론을 단정하지 않는다'));

  const exhaustedUser = USERS.free;
  const firstFreeSearch = await callable(exhaustedUser, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '현재 이 법 조항이 개정되었는지 확인해줘.',
    searchPreference: 'web_confirmed',
  });
  assert.strictEqual(firstFreeSearch.webSearchUsed, true);
  assert.strictEqual(firstFreeSearch.webSearchRemainingCount, 0);
  const exhaustedAutoCalls = genaiCalls.length;
  const exhaustedAuto = await callable(exhaustedUser, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '현재 관련 판례가 최근에 나왔는지 확인해줘.',
    searchPreference: 'auto',
  });
  assert.strictEqual(exhaustedAuto.requiresConfirmation, true);
  assert.strictEqual(exhaustedAuto.confirmationType, 'ambiguous');
  assert.strictEqual(exhaustedAuto.webSearchRemainingCount, 0);
  assert.ok(exhaustedAuto.notice.includes('외부자료 확인 횟수를 모두 사용했습니다'));
  assert.strictEqual(genaiCalls.length, exhaustedAutoCalls);
  const exhaustedDirectCalls = genaiCalls.length;
  const exhaustedDirect = await callable(exhaustedUser, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '현재 관련 판례가 최근에 나왔는지 확인해줘.',
    searchPreference: 'web_confirmed',
  });
  assert.strictEqual(exhaustedDirect.limitReached, true);
  assert.strictEqual(exhaustedDirect.answer, '');
  assert.strictEqual(exhaustedDirect.webSearchRemainingCount, 0);
  assert.strictEqual(genaiCalls.length, exhaustedDirectCalls);
  await assertThreadSearchUsage(exhaustedUser, 'law', 'haruraw_sayu', 1, 0);

  forceWebSearchError = true;
  await assert.rejects(
    callable(USERS.developer, {
      recordId: 'stock',
      sourceKey: 'stock_sayu',
      question: '현재 삼성전자 관련 공시를 확인해줘.',
      searchPreference: 'web_confirmed',
    }),
    /AI 응답 생성에 실패했습니다/,
  );
  forceWebSearchError = false;
  await assertThreadSearchUsage(USERS.developer, 'stock', 'stock_sayu', 0, 0);
  let messages = await getMessages(USERS.developer, 'stock', 'stock_sayu');
  assert.strictEqual(messages.length, 0);

  webSearchDelayMs = 250;
  const concurrentSearchBefore = countWebSearchCalls();
  const concurrent = await Promise.allSettled([
    callable(USERS.developer, {
      recordId: 'law',
      sourceKey: 'haruraw_sayu',
      question: '현재 이 법 조항이 개정되었는지 확인해줘.',
      searchPreference: 'web_confirmed',
    }),
    callable(USERS.developer, {
      recordId: 'law',
      sourceKey: 'haruraw_sayu',
      question: '현재 이 법 조항이 개정되었는지 확인해줘.',
      searchPreference: 'web_confirmed',
    }),
  ]);
  webSearchDelayMs = 0;
  assert.strictEqual(concurrent.filter((item) => item.status === 'fulfilled').length >= 1, true);
  assert.strictEqual(concurrent.filter((item) => item.status === 'rejected').length <= 1, true);
  assert.strictEqual(countWebSearchCalls(), concurrentSearchBefore + 1);
  await assertThreadSearchUsage(USERS.developer, 'law', 'haruraw_sayu', 1, 0);
  messages = await getMessages(USERS.developer, 'law', 'haruraw_sayu');
  assert.strictEqual(messages.filter((message) => message.role === 'assistant').length, 1);

  const attachment = {
    storagePath: `users/${USERS.developer}/haruLawAttachments/law/test.pdf`,
    mimeType: 'application/pdf',
    fileName: 'test.pdf',
  };
  const attachmentAutoCalls = genaiCalls.length;
  const attachmentAuto = await callable(USERS.developer, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '첨부파일과 함께 사건 쟁점을 정리해줘.',
    searchPreference: 'auto',
    attachments: [attachment],
  });
  assert.strictEqual(attachmentAuto.requiresConfirmation, true);
  assert.strictEqual(genaiCalls.length, attachmentAutoCalls);
  const attachmentRecord = await callable(USERS.developer, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '첨부파일과 함께 사건 쟁점을 정리해줘.',
    searchPreference: 'record_only',
    attachments: [attachment],
  });
  assert.strictEqual(attachmentRecord.answerRoute, 'record_only');
  assert.strictEqual(attachmentRecord.webSearchUsed, false);
  assert.ok(genaiCalls[genaiCalls.length - 1].contents.includes('inlineData'));
  messages = await getMessages(USERS.developer, 'law', 'haruraw_sayu');
  assert.ok(messages.some((message) => message.role === 'user' && Array.isArray(message.attachments) && message.attachments.length === 1));
  const attachmentWeb = await callable(USERS.developer, {
    recordId: 'law',
    sourceKey: 'haruraw_sayu',
    question: '첨부파일과 함께 최신 법령도 확인해줘.',
    searchPreference: 'web_confirmed',
    attachments: [attachment],
  });
  assert.strictEqual(attachmentWeb.answerRoute, 'web_search');
  assert.strictEqual(attachmentWeb.webSearchUsed, true);
  assert.ok(genaiCalls[genaiCalls.length - 1].hasGoogleSearchTool);
  assert.ok(genaiCalls[genaiCalls.length - 1].contents.includes('inlineData'));

  const logs = await getLogs({ featureName: 'result_chat' });
  assert.ok(logs.some((log) => log.actualPlan === 'basic' && log.answerRoute === 'record_only' && log.webSearchUsed === false && log.searchSourceCount === 0));
  assert.ok(logs.some((log) => log.actualPlan === 'basic' && log.answerRoute === 'web_search' && log.webSearchUsed === true && log.searchSourceCount >= 1));
  assert.ok(logs.some((log) => log.actualPlan === 'developer' && log.answerRoute === 'record_only'));
  assert.ok(logs.some((log) => log.success === false && typeof log.errorCode === 'string' && log.errorCode.length > 0));
  assert.ok(logs.every((log) => log.actualPlan !== 'beta'));
  assert.strictEqual((await getLogs({ featureName: 'result_chat_classifier' })).length, 0);

  console.log(JSON.stringify({
    mode: useRealGemini ? 'real-gemini' : 'instrumented-fake-gemini',
    genaiCallCount: genaiCalls.length,
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
