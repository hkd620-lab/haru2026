import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
// 에뮬레이터는 firebase-admin 메인 엔트리를 프록시로 갈아끼우는데, 그 과정에서
// admin.firestore 를 bind() 로 감싸 Timestamp 같은 정적 속성이 사라진다.
// 서브모듈에서 직접 가져오면 운영·에뮬레이터 모두에서 같은 클래스를 쓴다.
import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { logAiUsage } from '../aiUsageLogger';
import {
  buildGrammarV2CacheKey,
  BibleSourceError,
  loadCanonicalBibleContext,
} from './bibleSource';
import {
  GRAMMAR_V2_GENERATE_MODEL,
  GRAMMAR_V2_PILOT_PROMPT_VERSION,
  GRAMMAR_V2_PROMPT_VERSION,
  GRAMMAR_V2_SCHEMA_VERSION,
  GRAMMAR_V2_VERIFY_MODEL,
  buildGeminiSemanticPrompt,
  buildGptVerifierPrompt,
} from './grammarV2Prompt';
import {
  GRAMMAR_V2_PILOT_GENERATION_MODELS,
  GrammarV2CacheDocument,
  GrammarV2Input,
  GrammarV2LiteChange,
  GrammarV2LiteVerifierResponse,
  GrammarV2PilotMetrics,
  GrammarV2PilotOptions,
  GrammarV2PilotStageMetrics,
  GrammarV2PilotVariant,
  GrammarV2Request,
  GrammarV2SemanticChunk,
  GrammarV2SemanticPayload,
  GrammarV2ValidatedSemanticPayload,
  GrammarV2VerifierResponse,
  GrammarV2VerifyMode,
  GrammarV2VerifyRun,
} from './grammarV2Types';
import {
  GRAMMAR_V2_PILOT_MAX_NOTE_SENTENCES,
  GrammarV2ValidationError,
  validateGrammarV2SemanticPayload,
} from './grammarV2Validator';
import { isInternalDeveloperUid } from '../internalEntitlements';

if (!admin.apps.length) {
  admin.initializeApp();
}

const GEMINI_API_KEY_SECRET = defineSecret('GEMINI_API_KEY');
const OPENAI_API_KEY_SECRET = defineSecret('OPENAI_API_KEY');
const AI_USAGE_PLAN = 'beta';

const GRAMMAR_V2_SEMANTIC_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    difficulty: { type: SchemaType.STRING },
    styleNote: { type: SchemaType.STRING },
    translationNatural: { type: SchemaType.STRING },
    chunks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          order: { type: SchemaType.NUMBER },
          text: { type: SchemaType.STRING },
          role: { type: SchemaType.STRING },
          level: { type: SchemaType.NUMBER },
          parentId: { type: SchemaType.STRING, nullable: true },
          meaning: { type: SchemaType.STRING },
          note: { type: SchemaType.STRING },
          termIds: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ['id', 'order', 'text', 'role', 'level', 'parentId', 'meaning', 'note', 'termIds'],
      },
    },
    glossary: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          term: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING },
          ipa: { type: SchemaType.STRING },
          hangul: { type: SchemaType.STRING },
          syllables: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          hangulSyllables: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          stressIndex: { type: SchemaType.NUMBER },
          meaningKo: { type: SchemaType.STRING },
          note: { type: SchemaType.STRING },
        },
        required: [
          'id',
          'term',
          'type',
          'ipa',
          'hangul',
          'syllables',
          'hangulSyllables',
          'stressIndex',
          'meaningKo',
          'note',
        ],
      },
    },
    keyPoints: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          order: { type: SchemaType.NUMBER },
          pattern: { type: SchemaType.STRING },
          meaningKo: { type: SchemaType.STRING },
          why: { type: SchemaType.STRING },
          example: {
            type: SchemaType.OBJECT,
            properties: {
              en: { type: SchemaType.STRING },
              ko: { type: SchemaType.STRING },
            },
            required: ['en', 'ko'],
          },
          caution: { type: SchemaType.STRING },
        },
        required: ['order', 'pattern', 'meaningKo', 'why', 'example', 'caution'],
      },
    },
  },
  required: ['difficulty', 'styleNote', 'translationNatural', 'chunks', 'glossary', 'keyPoints'],
} as any;

type TokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  thoughtsTokens?: number | null;
};

const PILOT_ALLOWED_GENERATION_MODELS: ReadonlySet<string> = new Set(GRAMMAR_V2_PILOT_GENERATION_MODELS);
const PILOT_VERIFY_MODES: ReadonlySet<string> = new Set<GrammarV2VerifyMode>([
  'full',
  'lite',
  'both',
  'gemini',
  'all3',
]);

// 파일럿 모드 = Functions 에뮬레이터 안 + Firestore 에뮬레이터 연결됨.
// 두 조건이 모두 맞지 않으면 파일럿 기능(bsb, 모델 선택, 검증 방식, 캐시 건너뛰기)은 전부 막힌다.
// 이 함수가 운영 Firestore 오염을 막는 코드 가드다.
function isPilotEnvironment(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true' && Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function parsePilotOptions(value: unknown): GrammarV2PilotOptions {
  if (!isRecord(value)) {
    throw new HttpsError('invalid-argument', 'pilot must be an object.');
  }
  const options: GrammarV2PilotOptions = {};

  if (value.generationModel !== undefined) {
    const model = String(value.generationModel);
    if (!PILOT_ALLOWED_GENERATION_MODELS.has(model)) {
      throw new HttpsError(
        'invalid-argument',
        `pilot.generationModel must be one of: ${GRAMMAR_V2_PILOT_GENERATION_MODELS.join(', ')}`
      );
    }
    options.generationModel = model as GrammarV2PilotOptions['generationModel'];
  }

  if (value.verifyMode !== undefined) {
    const mode = String(value.verifyMode);
    if (!PILOT_VERIFY_MODES.has(mode)) {
      throw new HttpsError('invalid-argument', 'pilot.verifyMode must be full, lite, both, gemini, or all3.');
    }
    options.verifyMode = mode as GrammarV2VerifyMode;
  }

  if (value.skipCacheRead !== undefined) {
    if (typeof value.skipCacheRead !== 'boolean') {
      throw new HttpsError('invalid-argument', 'pilot.skipCacheRead must be a boolean.');
    }
    options.skipCacheRead = value.skipCacheRead;
  }

  return options;
}

function toGrammarV2Request(data: unknown): GrammarV2Request {
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Request data is required.');
  }
  const value = data as Record<string, unknown>;
  if (value.verseText !== undefined) {
    throw new HttpsError('invalid-argument', 'verseText is not accepted. The server uses canonical Bible source.');
  }
  if (value.version !== 'kjv' && value.version !== 'bsb') {
    throw new HttpsError('invalid-argument', 'Only KJV is supported in this pilot.');
  }

  // 파일럿 기능을 요구하는 요청은 캐시를 읽기 전에 여기서 막힌다.
  const wantsPilot = value.version !== 'kjv' || value.pilot !== undefined;
  if (wantsPilot && !isPilotEnvironment()) {
    throw new HttpsError(
      'failed-precondition',
      'grammar-v2 pilot features require the local emulator (FUNCTIONS_EMULATOR and FIRESTORE_EMULATOR_HOST).'
    );
  }

  return {
    input: {
      version: value.version,
      book: String(value.book || '').trim().toLowerCase(),
      chapter: Number(value.chapter),
      verse: Number(value.verse),
    },
    pilot: value.pilot === undefined ? null : parsePilotOptions(value.pilot),
  };
}

function parseJsonPayload<T>(raw: string): T {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean) as T;
}

function geminiUsage(result: any): TokenUsage {
  const usage = result?.response?.usageMetadata || result?.usageMetadata;
  return {
    inputTokens: usage?.promptTokenCount ?? null,
    outputTokens: usage?.candidatesTokenCount ?? null,
    // thinking 토큰은 candidatesTokenCount에 포함되지 않아 따로 기록해야 비용이 맞는다.
    thoughtsTokens: usage?.thoughtsTokenCount ?? null,
  };
}

function openAiUsage(data: any): TokenUsage {
  return {
    inputTokens: data?.usage?.prompt_tokens ?? null,
    outputTokens: data?.usage?.completion_tokens ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUsableGrammarV2Cache(
  value: unknown,
  promptVersion: string = GRAMMAR_V2_PROMPT_VERSION
): value is GrammarV2CacheDocument {
  if (!isRecord(value)) return false;
  const verification = value.verification;
  return (
    value.schemaVersion === GRAMMAR_V2_SCHEMA_VERSION &&
    value.promptVersion === promptVersion &&
    isRecord(verification) &&
    verification.status === 'passed'
  );
}

function semanticWithoutPositions(payload: GrammarV2ValidatedSemanticPayload): GrammarV2SemanticPayload {
  return {
    ...payload,
    chunks: payload.chunks.map((chunk) => {
      const semanticChunk: GrammarV2SemanticChunk = {
        id: chunk.id,
        order: chunk.order,
        text: chunk.text,
        role: chunk.role,
        level: chunk.level,
        parentId: chunk.parentId,
        meaning: chunk.meaning,
        note: chunk.note,
        termIds: chunk.termIds,
      };
      return semanticChunk;
    }),
  };
}

// 축소 검증이 고칠 수 있는 필드만 허용한다. 청크 text·id·순서 같은 구조는 코드가 정하므로 손대지 못한다.
const LITE_CHANGE_PATHS: ReadonlyArray<{ re: RegExp; apply: (payload: any, m: RegExpMatchArray, value: string) => void }> = [
  {
    re: /^(difficulty|styleNote|translationNatural)$/,
    apply: (payload, m, value) => {
      payload[m[1]] = value;
    },
  },
  {
    re: /^chunks\[(\d+)\]\.(role|meaning|note)$/,
    apply: (payload, m, value) => {
      payload.chunks[Number(m[1])][m[2]] = value;
    },
  },
  {
    re: /^glossary\[(\d+)\]\.(term|type|ipa|hangul|meaningKo|note)$/,
    apply: (payload, m, value) => {
      payload.glossary[Number(m[1])][m[2]] = value;
    },
  },
  {
    re: /^keyPoints\[(\d+)\]\.(pattern|meaningKo|why|caution)$/,
    apply: (payload, m, value) => {
      payload.keyPoints[Number(m[1])][m[2]] = value;
    },
  },
  {
    re: /^keyPoints\[(\d+)\]\.example\.(en|ko)$/,
    apply: (payload, m, value) => {
      payload.keyPoints[Number(m[1])].example[m[2]] = value;
    },
  },
];

function arrayLengthForPath(payload: GrammarV2SemanticPayload, path: string): number | null {
  if (path.startsWith('chunks[')) return payload.chunks.length;
  if (path.startsWith('glossary[')) return payload.glossary.length;
  if (path.startsWith('keyPoints[')) return payload.keyPoints.length;
  return null;
}

function normalizeLiteVerifierResponse(value: unknown): GrammarV2LiteVerifierResponse {
  if (!isRecord(value) || !Array.isArray(value.changes)) {
    throw new Error('Invalid GPT lite verifier response: changes must be an array.');
  }
  const changes: GrammarV2LiteChange[] = value.changes.map((item, index) => {
    if (!isRecord(item) || typeof item.path !== 'string') {
      throw new Error(`Invalid GPT lite verifier response: changes[${index}].path must be a string.`);
    }
    return {
      path: item.path,
      value: item.value,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    };
  });
  return { changes };
}

/** 변경분을 초안 사본에 적용한다. 허용되지 않은 경로는 건너뛰고 이유를 남긴다. */
function applyLiteChanges(
  draft: GrammarV2SemanticPayload,
  changes: GrammarV2LiteChange[]
): { semantic: GrammarV2SemanticPayload; applied: number; skipped: string[] } {
  const next: GrammarV2SemanticPayload = JSON.parse(JSON.stringify(draft));
  const skipped: string[] = [];
  let applied = 0;

  for (const change of changes) {
    if (typeof change.value !== 'string') {
      skipped.push(`${change.path}: value must be a string`);
      continue;
    }
    const rule = LITE_CHANGE_PATHS.find((candidate) => candidate.re.test(change.path));
    if (!rule) {
      skipped.push(`${change.path}: path not editable`);
      continue;
    }
    const match = change.path.match(rule.re) as RegExpMatchArray;
    const indexed = match[1] !== undefined && /^\d+$/.test(match[1]) ? Number(match[1]) : null;
    const length = arrayLengthForPath(next, change.path);
    if (indexed !== null && length !== null && (indexed < 0 || indexed >= length)) {
      skipped.push(`${change.path}: index out of range`);
      continue;
    }
    try {
      rule.apply(next, match, change.value);
      applied += 1;
    } catch (error: any) {
      skipped.push(`${change.path}: ${error?.message || 'apply failed'}`);
    }
  }

  return { semantic: next, applied, skipped };
}

function normalizeVerifierResponse(value: unknown): GrammarV2VerifierResponse {
  if (!isRecord(value) || !Array.isArray(value.changes)) {
    throw new Error('Invalid GPT verifier response: changes must be an array.');
  }
  value.changes.forEach((change, index) => {
    if (typeof change !== 'string') {
      throw new Error(`Invalid GPT verifier response: changes[${index}] must be a string.`);
    }
  });
  if (value.corrected !== null && (typeof value.corrected !== 'object' || Array.isArray(value.corrected))) {
    throw new Error('Invalid GPT verifier response: corrected must be null or semantic payload.');
  }
  return {
    changes: value.changes,
    corrected: value.corrected as GrammarV2SemanticPayload | null,
  };
}

async function logGrammarV2Usage(params: {
  uid: string;
  featureName: 'grammar_v2_generate' | 'grammar_v2_verify';
  model: string;
  sourceKey: string;
  requestId: string;
  usage?: TokenUsage;
  latencyMs?: number | null;
  success: boolean;
  errorCode: string | null;
}): Promise<void> {
  await logAiUsage({
    uid: params.uid,
    featureName: params.featureName,
    plan: AI_USAGE_PLAN,
    model: params.model,
    inputTokens: params.usage?.inputTokens ?? null,
    outputTokens: params.usage?.outputTokens ?? null,
    thoughtsTokens: params.usage?.thoughtsTokens ?? null,
    latencyMs: params.latencyMs ?? null,
    imageCount: 0,
    externalApiProvider: params.featureName === 'grammar_v2_verify' ? 'openai' : null,
    externalApiCalled: true,
    groundingUsed: false,
    sourceKey: params.sourceKey,
    requestId: params.requestId,
    success: params.success,
    errorCode: params.errorCode,
    isDev: isInternalDeveloperUid(params.uid),
  });
}

async function generateSemanticPayload(params: {
  uid: string;
  sourceKey: string;
  requestId: string;
  prompt: string;
  generationModel: string;
}): Promise<{ semantic: GrammarV2SemanticPayload; usage: TokenUsage; latencyMs: number }> {
  const startedAt = Date.now();
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const model = genAI.getGenerativeModel({
      model: params.generationModel,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: GRAMMAR_V2_SEMANTIC_RESPONSE_SCHEMA,
      } as any,
    });
    const result = await model.generateContent(params.prompt);
    const usage = geminiUsage(result);
    const semantic = parseJsonPayload<GrammarV2SemanticPayload>(result.response.text());
    const latencyMs = Date.now() - startedAt;
    await logGrammarV2Usage({
      uid: params.uid,
      featureName: 'grammar_v2_generate',
      model: params.generationModel,
      sourceKey: params.sourceKey,
      requestId: params.requestId,
      usage,
      latencyMs,
      success: true,
      errorCode: null,
    });
    return {
      semantic,
      usage,
      latencyMs,
    };
  } catch (error: any) {
    await logGrammarV2Usage({
      uid: params.uid,
      featureName: 'grammar_v2_generate',
      model: params.generationModel,
      sourceKey: params.sourceKey,
      requestId: params.requestId,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorCode: error?.code || error?.message || 'gemini_generate_failed',
    });
    throw error;
  }
}

async function verifyWithGpt(params: {
  uid: string;
  sourceKey: string;
  requestId: string;
  prompt: string;
  mode: 'full' | 'lite';
}): Promise<{
  response: GrammarV2VerifierResponse | GrammarV2LiteVerifierResponse;
  usage: TokenUsage;
  latencyMs: number;
  attempts: number;
}> {
  let lastError: any = null;
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: GRAMMAR_V2_VERIFY_MODEL,
          messages: [{ role: 'user', content: params.prompt }],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY_SECRET.value().replace(/[^\x20-\x7E]/g, '').trim()}`,
            'Content-Type': 'application/json',
          },
          timeout: 25000,
        }
      );
      const usage = openAiUsage(res.data);
      const raw = parseJsonPayload<unknown>(res.data.choices[0].message.content || '');
      const response =
        params.mode === 'lite' ? normalizeLiteVerifierResponse(raw) : normalizeVerifierResponse(raw);
      const latencyMs = Date.now() - startedAt;
      await logGrammarV2Usage({
        uid: params.uid,
        featureName: 'grammar_v2_verify',
        model: GRAMMAR_V2_VERIFY_MODEL,
        sourceKey: params.sourceKey,
        requestId: params.requestId,
        usage,
        latencyMs,
        success: true,
        errorCode: null,
      });
      return {
        response,
        usage,
        latencyMs,
        attempts: attempt,
      };
    } catch (error: any) {
      lastError = error;
      await logGrammarV2Usage({
        uid: params.uid,
        featureName: 'grammar_v2_verify',
        model: GRAMMAR_V2_VERIFY_MODEL,
        sourceKey: params.sourceKey,
        requestId: params.requestId,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorCode: error?.response?.status ? `openai_${error.response.status}` : error?.message || `gpt_attempt_${attempt}_failed`,
      });
      logger.warn(`[getGrammarExplainV2] GPT verifier attempt ${attempt} failed`, error);
    }
  }
  throw lastError || new Error('GPT verifier failed.');
}

// 파일럿 전용: 축소 검증과 같은 프롬프트·같은 변경분 형식을 Gemini 로 돌린다.
// 검증 비용의 대부분이 GPT-4o 입력이라, 같은 일을 훨씬 싼 모델로 할 수 있는지 보려는 것.
const GRAMMAR_V2_LITE_CHANGES_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    changes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          path: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING },
        },
        required: ['path', 'value', 'reason'],
      },
    },
  },
  required: ['changes'],
} as any;

async function verifyWithGemini(params: {
  uid: string;
  sourceKey: string;
  requestId: string;
  prompt: string;
  model: string;
}): Promise<{
  response: GrammarV2LiteVerifierResponse;
  usage: TokenUsage;
  latencyMs: number;
  attempts: number;
}> {
  const startedAt = Date.now();
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const model = genAI.getGenerativeModel({
      model: params.model,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: GRAMMAR_V2_LITE_CHANGES_SCHEMA,
      } as any,
    });
    const result = await model.generateContent(params.prompt);
    const usage = geminiUsage(result);
    const response = normalizeLiteVerifierResponse(parseJsonPayload<unknown>(result.response.text()));
    const latencyMs = Date.now() - startedAt;
    await logGrammarV2Usage({
      uid: params.uid,
      featureName: 'grammar_v2_verify',
      model: params.model,
      sourceKey: params.sourceKey,
      requestId: params.requestId,
      usage,
      latencyMs,
      success: true,
      errorCode: null,
    });
    return { response, usage, latencyMs, attempts: 1 };
  } catch (error: any) {
    await logGrammarV2Usage({
      uid: params.uid,
      featureName: 'grammar_v2_verify',
      model: params.model,
      sourceKey: params.sourceKey,
      requestId: params.requestId,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorCode: error?.code || error?.message || 'gemini_verify_failed',
    });
    throw error;
  }
}

function mapKnownError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof BibleSourceError) return new HttpsError(error.code, error.message);
  if (error instanceof GrammarV2ValidationError) return new HttpsError('failed-precondition', error.message);
  return new HttpsError('internal', 'grammar-v2 generation failed.');
}

export const getGrammarExplainV2 = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET, OPENAI_API_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    if (!isInternalDeveloperUid(request.auth.uid)) {
      throw new HttpsError('permission-denied', 'grammar-v2 pilot is developer-only.');
    }

    try {
      const { input, pilot } = toGrammarV2Request(request.data);

      // 파일럿 실행 여부. 옵션 없는 KJV 요청은 false → 아래 모든 분기가 기존 동작과 같다.
      const isPilotRun = pilot !== null || input.version !== 'kjv';
      const generationModel = pilot?.generationModel ?? GRAMMAR_V2_GENERATE_MODEL;
      const verifyMode: GrammarV2VerifyMode = pilot?.verifyMode ?? 'full';
      const promptVersion = isPilotRun ? GRAMMAR_V2_PILOT_PROMPT_VERSION : GRAMMAR_V2_PROMPT_VERSION;
      // 파일럿에서만 따옴표·공백 정규화 비교와 pattern 어구 검사를 코드로 돌린다.
      const validateOptions = isPilotRun
        ? {
            maxNoteSentences: GRAMMAR_V2_PILOT_MAX_NOTE_SENTENCES,
            normalizeChunkMatching: true,
            rejectSourcePhrasePattern: true,
            rejectGlossaryDuplicates: true,
            rejectFillerGlossary: true,
            rejectDuplicateChunkNotes: true,
            rejectArchaicKoreanTranslation: true,
          }
        : {};
      const skipCacheRead = pilot?.skipCacheRead ?? false;

      const sourceKey = buildGrammarV2CacheKey(input);
      const context = loadCanonicalBibleContext(input);
      const cacheRef = admin.firestore().collection('grammarCache').doc(sourceKey);
      if (!skipCacheRead) {
        const cached = await cacheRef.get();
        const cachedData = cached.data();
        if (isUsableGrammarV2Cache(cachedData, promptVersion)) return cachedData;
      }

      const requestId = randomUUID();
      const prompt = buildGeminiSemanticPrompt(context, { depth: isPilotRun ? 'shallow' : 'standard' });
      const stages: GrammarV2PilotStageMetrics[] = [];

      // 파일럿 모드에서만 검증기 실패 시 생성을 한 번 더 시도한다.
      // 기존 KJV 경로는 maxGenerateAttempts 가 1이라 지금과 같다.
      const maxGenerateAttempts = isPilotRun ? 2 : 1;
      let generated!: Awaited<ReturnType<typeof generateSemanticPayload>>;
      let validatedGemini!: GrammarV2ValidatedSemanticPayload;
      let generateAttempts = 0;

      for (let attempt = 1; attempt <= maxGenerateAttempts; attempt += 1) {
        generateAttempts = attempt;
        generated = await generateSemanticPayload({
          uid: request.auth.uid,
          sourceKey,
          requestId,
          prompt,
          generationModel,
        });
        const stage: GrammarV2PilotStageMetrics = {
          stage: 'generate',
          model: generationModel,
          inputTokens: generated.usage.inputTokens,
          outputTokens: generated.usage.outputTokens,
          thoughtsTokens: generated.usage.thoughtsTokens ?? null,
          latencyMs: generated.latencyMs,
          attempts: attempt,
        };
        stages.push(stage);

        try {
          validatedGemini = validateGrammarV2SemanticPayload(
            context.targetVerse.text,
            generated.semantic,
            validateOptions
          );
          break;
        } catch (error) {
          const isValidationError = error instanceof GrammarV2ValidationError;
          if (!isValidationError || attempt === maxGenerateAttempts) throw error;
          stage.validationFailed = true;
          stage.validationError = (error as GrammarV2ValidationError).message;
          logger.warn(
            `[getGrammarExplainV2] generation attempt ${attempt} failed validation, retrying`,
            { sourceKey, message: stage.validationError }
          );
        }
      }

      const draftForVerifier = semanticWithoutPositions(validatedGemini);
      const variants: GrammarV2PilotVariant[] = [];

      // 'both'·'all3'는 같은 생성 초안에 검증을 각각 돌려 결과와 토큰을 따로 모은다.
      const verifyRuns: GrammarV2VerifyRun[] =
        verifyMode === 'all3'
          ? ['full', 'lite', 'gemini']
          : verifyMode === 'both'
            ? ['full', 'lite']
            : [verifyMode];

      for (const mode of verifyRuns) {
        // Gemini 검증은 축소 검증과 같은 프롬프트를 쓴다.
        const prompt = buildGptVerifierPrompt(context, draftForVerifier, {
          mode: mode === 'full' ? 'full' : 'lite',
        });
        const verifierModel = mode === 'gemini' ? generationModel : GRAMMAR_V2_VERIFY_MODEL;
        const verified =
          mode === 'gemini'
            ? await verifyWithGemini({
                uid: request.auth.uid,
                sourceKey,
                requestId,
                prompt,
                model: verifierModel,
              })
            : await verifyWithGpt({
                uid: request.auth.uid,
                sourceKey,
                requestId,
                prompt,
                mode,
              });

        const stage: GrammarV2PilotStageMetrics = {
          stage: mode === 'full' ? 'verify_full' : mode === 'lite' ? 'verify_lite' : 'verify_gemini',
          model: verifierModel,
          inputTokens: verified.usage.inputTokens,
          outputTokens: verified.usage.outputTokens,
          thoughtsTokens: verified.usage.thoughtsTokens ?? null,
          latencyMs: verified.latencyMs,
          attempts: verified.attempts,
        };

        let semanticAfterGpt: GrammarV2SemanticPayload;
        let changeNotes: string[];
        let changePaths: string[];
        let corrected: boolean;

        if (mode === 'full') {
          const full = verified.response as GrammarV2VerifierResponse;
          semanticAfterGpt = full.corrected || validatedGemini;
          changeNotes = full.changes;
          changePaths = [];
          corrected = full.corrected !== null;
        } else {
          const lite = verified.response as GrammarV2LiteVerifierResponse;
          const outcome = applyLiteChanges(draftForVerifier, lite.changes);
          semanticAfterGpt = outcome.semantic;
          changeNotes = lite.changes.map((c) => `${c.path}: ${c.reason || 'fixed'}`);
          changePaths = lite.changes.map((c) => c.path);
          corrected = outcome.applied > 0;
          stage.changesApplied = outcome.applied;
          if (outcome.skipped.length > 0) stage.changesSkipped = outcome.skipped;
        }

        // 적용 결과가 검증을 통과하지 못하면 변경을 버리고 이미 통과한 초안을 쓴다.
        // (초안은 위에서 검증을 통과했으므로 항상 안전한 대안이다.)
        let validatedForMode: GrammarV2ValidatedSemanticPayload;
        try {
          validatedForMode = validateGrammarV2SemanticPayload(
            context.targetVerse.text,
            semanticAfterGpt,
            validateOptions
          );
        } catch (error) {
          if (!(error instanceof GrammarV2ValidationError)) throw error;
          stage.changesRejected = error.message;
          corrected = false;
          logger.warn('[getGrammarExplainV2] verifier changes rejected by validator', {
            sourceKey,
            mode,
            message: error.message,
          });
          validatedForMode = validatedGemini;
        }

        stage.changes = changeNotes;
        stage.corrected = corrected;
        stages.push(stage);
        variants.push({
          verifyMode: mode,
          model: verifierModel,
          changes: changeNotes,
          changePaths,
          corrected,
          semantic: validatedForMode,
        });
      }

      // 저장본 기준: all3 은 축소 검증(lite) 결과, 그 밖에는 full 이 있으면 full(기존 동작),
      // 없으면 실행한 검증 결과를 쓴다.
      const canonicalMode: GrammarV2VerifyRun | undefined =
        verifyMode === 'all3' ? 'lite' : variants.some((v) => v.verifyMode === 'full') ? 'full' : undefined;
      const canonicalVariant =
        (canonicalMode && variants.find((item) => item.verifyMode === canonicalMode)) || variants[0];
      const finalSemantic = canonicalVariant.semantic;
      const canonicalStageName =
        canonicalVariant.verifyMode === 'full'
          ? 'verify_full'
          : canonicalVariant.verifyMode === 'lite'
            ? 'verify_lite'
            : 'verify_gemini';
      const canonicalStage = stages.find((item) => item.stage === canonicalStageName);

      const doc: GrammarV2CacheDocument = {
        schemaVersion: GRAMMAR_V2_SCHEMA_VERSION,
        promptVersion,
        meta: {
          sourceType: 'bible',
          version: context.version,
          book: context.book,
          chapter: context.chapter,
          verse: context.verse,
          sourceRef: `${context.bookName} ${context.chapter}:${context.verse} (${context.version.toUpperCase()})`,
          difficulty: finalSemantic.difficulty,
          styleNote: finalSemantic.styleNote,
        },
        original: {
          text: context.targetVerse.text,
          translationNatural: finalSemantic.translationNatural,
        },
        chunks: finalSemantic.chunks,
        glossary: finalSemantic.glossary,
        keyPoints: finalSemantic.keyPoints,
        generation: {
          model: generationModel,
          inputTokens: generated.usage.inputTokens,
          outputTokens: generated.usage.outputTokens,
          createdAt: Timestamp.now(),
        },
        verification: {
          model: canonicalVariant.model,
          status: 'passed',
          changes: canonicalVariant.changes,
          inputTokens: canonicalStage?.inputTokens ?? null,
          outputTokens: canonicalStage?.outputTokens ?? null,
        },
      };

      await cacheRef.set(doc);
      if (!isPilotRun) return doc;

      // 파일럿 응답에만 계측·비교 자료를 덧붙인다. 캐시 문서 구조는 그대로 둔다.
      const pilotMetrics: GrammarV2PilotMetrics = {
        promptVersion,
        verifyMode,
        generationModel,
        cacheRead: !skipCacheRead,
        generateAttempts,
        stages,
      };
      return {
        ...doc,
        pilotMetrics,
        pilotDraftSemantic: draftForVerifier,
        pilotVariants: variants,
      };
    } catch (error) {
      const mapped = mapKnownError(error);
      logger.error('[getGrammarExplainV2] failed', error);
      throw mapped;
    }
  }
);
