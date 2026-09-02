import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
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
  GRAMMAR_V2_PROMPT_VERSION,
  GRAMMAR_V2_SCHEMA_VERSION,
  GRAMMAR_V2_VERIFY_MODEL,
  buildGeminiSemanticPrompt,
  buildGptVerifierPrompt,
} from './grammarV2Prompt';
import {
  GrammarV2CacheDocument,
  GrammarV2Input,
  GrammarV2SemanticChunk,
  GrammarV2SemanticPayload,
  GrammarV2ValidatedSemanticPayload,
  GrammarV2VerifierResponse,
} from './grammarV2Types';
import {
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
};

function toGrammarV2Input(data: unknown): GrammarV2Input {
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Request data is required.');
  }
  const value = data as Record<string, unknown>;
  if (value.verseText !== undefined) {
    throw new HttpsError('invalid-argument', 'verseText is not accepted. The server uses canonical Bible source.');
  }
  if (value.version !== 'kjv') {
    throw new HttpsError('invalid-argument', 'Only KJV is supported in this pilot.');
  }
  return {
    version: 'kjv',
    book: String(value.book || '').trim().toLowerCase(),
    chapter: Number(value.chapter),
    verse: Number(value.verse),
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

function isUsableGrammarV2Cache(value: unknown): value is GrammarV2CacheDocument {
  if (!isRecord(value)) return false;
  const verification = value.verification;
  return (
    value.schemaVersion === GRAMMAR_V2_SCHEMA_VERSION &&
    value.promptVersion === GRAMMAR_V2_PROMPT_VERSION &&
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
}): Promise<{ semantic: GrammarV2SemanticPayload; usage: TokenUsage }> {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const model = genAI.getGenerativeModel({
      model: GRAMMAR_V2_GENERATE_MODEL,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: GRAMMAR_V2_SEMANTIC_RESPONSE_SCHEMA,
      } as any,
    });
    const result = await model.generateContent(params.prompt);
    const usage = geminiUsage(result);
    const semantic = parseJsonPayload<GrammarV2SemanticPayload>(result.response.text());
    await logGrammarV2Usage({
      uid: params.uid,
      featureName: 'grammar_v2_generate',
      model: GRAMMAR_V2_GENERATE_MODEL,
      sourceKey: params.sourceKey,
      requestId: params.requestId,
      usage,
      success: true,
      errorCode: null,
    });
    return {
      semantic,
      usage,
    };
  } catch (error: any) {
    await logGrammarV2Usage({
      uid: params.uid,
      featureName: 'grammar_v2_generate',
      model: GRAMMAR_V2_GENERATE_MODEL,
      sourceKey: params.sourceKey,
      requestId: params.requestId,
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
}): Promise<{ response: GrammarV2VerifierResponse; usage: TokenUsage }> {
  let lastError: any = null;
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
      const response = normalizeVerifierResponse(
        parseJsonPayload<GrammarV2VerifierResponse>(res.data.choices[0].message.content || '')
      );
      await logGrammarV2Usage({
        uid: params.uid,
        featureName: 'grammar_v2_verify',
        model: GRAMMAR_V2_VERIFY_MODEL,
        sourceKey: params.sourceKey,
        requestId: params.requestId,
        usage,
        success: true,
        errorCode: null,
      });
      return {
        response,
        usage,
      };
    } catch (error: any) {
      lastError = error;
      await logGrammarV2Usage({
        uid: params.uid,
        featureName: 'grammar_v2_verify',
        model: GRAMMAR_V2_VERIFY_MODEL,
        sourceKey: params.sourceKey,
        requestId: params.requestId,
        success: false,
        errorCode: error?.response?.status ? `openai_${error.response.status}` : error?.message || `gpt_attempt_${attempt}_failed`,
      });
      logger.warn(`[getGrammarExplainV2] GPT verifier attempt ${attempt} failed`, error);
    }
  }
  throw lastError || new Error('GPT verifier failed.');
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
      const input = toGrammarV2Input(request.data);
      const sourceKey = buildGrammarV2CacheKey(input);
      const context = loadCanonicalBibleContext(input);
      const cacheRef = admin.firestore().collection('grammarCache').doc(sourceKey);
      const cached = await cacheRef.get();
      const cachedData = cached.data();
      if (isUsableGrammarV2Cache(cachedData)) return cachedData;

      const requestId = randomUUID();
      const generated = await generateSemanticPayload({
        uid: request.auth.uid,
        sourceKey,
        requestId,
        prompt: buildGeminiSemanticPrompt(context),
      });
      const validatedGemini = validateGrammarV2SemanticPayload(
        context.targetVerse.text,
        generated.semantic
      );

      const verified = await verifyWithGpt({
        uid: request.auth.uid,
        sourceKey,
        requestId,
        prompt: buildGptVerifierPrompt(context, semanticWithoutPositions(validatedGemini)),
      });
      const semanticAfterGpt = verified.response.corrected || validatedGemini;
      const finalSemantic = validateGrammarV2SemanticPayload(
        context.targetVerse.text,
        semanticAfterGpt
      );

      const doc: GrammarV2CacheDocument = {
        schemaVersion: GRAMMAR_V2_SCHEMA_VERSION,
        promptVersion: GRAMMAR_V2_PROMPT_VERSION,
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
          model: GRAMMAR_V2_GENERATE_MODEL,
          inputTokens: generated.usage.inputTokens,
          outputTokens: generated.usage.outputTokens,
          createdAt: admin.firestore.Timestamp.now(),
        },
        verification: {
          model: GRAMMAR_V2_VERIFY_MODEL,
          status: 'passed',
          changes: verified.response.changes,
          inputTokens: verified.usage.inputTokens,
          outputTokens: verified.usage.outputTokens,
        },
      };

      await cacheRef.set(doc);
      return doc;
    } catch (error) {
      const mapped = mapKnownError(error);
      logger.error('[getGrammarExplainV2] failed', error);
      throw mapped;
    }
  }
);
