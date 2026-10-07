// AI 호출 창구 — 기능 코드는 회사별 SDK 를 직접 만들지 않고 callAi 하나만 부른다.
// 어느 회사·모델로 보낼지는 aiModels.ts 설정 표가 정한다. 회사별 차이(요청 형식·사용량 필드)와 API 키는 여기서 맞춘다.
// 기능 코드는 키를 넘기지 않는다. 함수 선언의 secrets 에 aiSecretsFor(용도...) 를 넣으면 설정 표의 회사 키가 연결된다.
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerateContentRequest, GenerationConfig, ModelParams, Part, RequestOptions, SingleRequestOptions } from '@google/generative-ai';
import type OpenAI from 'openai';
import { defineSecret } from 'firebase-functions/params';
import { getAiRoute } from './aiModels';
import type { AiProvider, AiPurpose } from './aiModels';

type SecretParam = ReturnType<typeof defineSecret>;

// 회사별 API 키(Secret Manager 이름)
export const AI_PROVIDER_SECRETS: Record<AiProvider, SecretParam> = {
  gemini: defineSecret('GEMINI_API_KEY'),
  openai: defineSecret('OPENAI_API_KEY'),
};

// 함수 선언의 secrets 에 넣을 키 목록. 그 함수가 쓰는 용도들의 회사 키만 고른다.
// 설정 표에서 회사를 바꾸고 함수를 다시 배포하면 새 회사의 키가 연결된다.
export function aiSecretsFor(...purposes: AiPurpose[]): SecretParam[] {
  const providers = Array.from(new Set(purposes.map((purpose) => getAiRoute(purpose).provider)));
  return providers.map((provider) => AI_PROVIDER_SECRETS[provider]);
}

// 테스트에서 키 읽기를 바꿔 끼울 수 있다.
export const aiCredentials = {
  get: (provider: AiProvider): string => AI_PROVIDER_SECRETS[provider].value(),
};
// Gemini generateContent 가 받는 입력과 같은 모양(문자열, 문자열·이미지 조각 배열, 또는 { contents } 요청 객체)
export type AiInput = string | Array<string | Part> | GenerateContentRequest;

export interface CallAiRequest {
  purpose: AiPurpose;
  input: AiInput;
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
  // Gemini 전용 설정(tools·safetySettings 등). 다른 회사로 보내면 오류로 막는다.
  geminiParams?: Omit<ModelParams, 'model' | 'systemInstruction' | 'generationConfig'>;
  requestOptions?: RequestOptions;
  // 호출 한 번에만 적용하는 옵션(예: { timeout }). Gemini generateContent 두 번째 인자로 그대로 넘긴다.
  callOptions?: SingleRequestOptions;
}

export interface CallAiResult {
  provider: AiProvider;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  // 응답 본문. Gemini SDK 처럼 읽는 시점에 차단·빈 응답 오류를 낸다(기존 호출부의 순서를 유지하기 위함).
  text(): string;
  raw: unknown; // 회사별 원본 응답(근거 정보 등 회사 전용 값을 읽을 때만 사용)
}

// 테스트에서 SDK 대역을 넣을 수 있게 생성 함수를 바꿔 끼울 수 있다.
export const aiClientFactories = {
  gemini: (apiKey: string) => new GoogleGenerativeAI(apiKey),
  // OpenAI SDK 는 OpenAI 로 보내는 기능이 처음 호출될 때만 불러온다(모든 함수의 시작 시간에 더하지 않기 위함).
  openai: (apiKey: string): OpenAI => {
    const { default: OpenAIClient } = require('openai') as typeof import('openai');
    return new OpenAIClient({ apiKey });
  },
};

const finiteOrNull = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function getGeminiUsage(result: any): { inputTokens: number | null; outputTokens: number | null } {
  const usage = result?.response?.usageMetadata || result?.usageMetadata || {};
  return { inputTokens: finiteOrNull(usage.promptTokenCount), outputTokens: finiteOrNull(usage.candidatesTokenCount) };
}

async function callGemini(model: string, apiKey: string, request: CallAiRequest): Promise<CallAiResult> {
  const params: ModelParams = { model, ...request.geminiParams };
  if (request.systemInstruction !== undefined) params.systemInstruction = request.systemInstruction;
  if (request.generationConfig !== undefined) params.generationConfig = request.generationConfig;
  const generativeModel = request.requestOptions
    ? aiClientFactories.gemini(apiKey).getGenerativeModel(params, request.requestOptions)
    : aiClientFactories.gemini(apiKey).getGenerativeModel(params);
  const result = request.callOptions
    ? await generativeModel.generateContent(request.input, request.callOptions)
    : await generativeModel.generateContent(request.input);
  const usage = getGeminiUsage(result);
  return { provider: 'gemini', model, ...usage, text: () => result.response.text(), raw: result };
}

function toOpenAiContent(input: AiInput, purpose: AiPurpose): string | Array<Record<string, unknown>> {
  if (typeof input === 'string') return input;
  if (!Array.isArray(input)) {
    // { contents: [{ role: 'user', parts }] } 요청 객체는 사용자 한 턴만 있을 때만 옮긴다. 다른 필드가 있으면 막는다.
    const extra = Object.keys(input).filter((key) => key !== 'contents');
    if (extra.length > 0) throw new Error(`OpenAI 로 옮길 수 없는 요청 필드입니다 (${purpose}): ${extra.join(', ')}`);
    const contents = input.contents || [];
    if (contents.length !== 1 || contents[0].role !== 'user') throw new Error(`OpenAI 로 보낼 수 없는 요청 형식입니다 (${purpose})`);
    return toOpenAiContent(contents[0].parts as Part[], purpose);
  }
  return input.map((part) => {
    if (typeof part === 'string') return { type: 'text', text: part };
    if ('text' in part && typeof part.text === 'string') return { type: 'text', text: part.text };
    if ('inlineData' in part && part.inlineData) {
      return { type: 'image_url', image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } };
    }
    throw new Error(`OpenAI 로 보낼 수 없는 입력 조각입니다 (${purpose})`);
  });
}

// OpenAI 로 옮길 수 있는 생성 설정. 그 밖의 설정(responseSchema·topP·stopSequences 등)은 말없이 버리지 않고 오류로 막는다.
// 참고: 추론 모델 일부는 temperature 를 받지 않는다. 그런 모델로 바꿀 때는 해당 기능의 temperature 를 함께 점검한다.
const OPENAI_SUPPORTED_GENERATION_CONFIG = new Set(['temperature', 'maxOutputTokens', 'responseMimeType']);

async function callOpenAi(model: string, apiKey: string, request: CallAiRequest): Promise<CallAiResult> {
  const fail = (what: string) => new Error(`OpenAI 로 옮길 수 없는 설정입니다 (${request.purpose}): ${what}`);
  if (request.geminiParams && Object.keys(request.geminiParams).length > 0) {
    throw new Error(`Gemini 전용 설정을 쓰는 기능은 OpenAI 로 옮길 수 없습니다 (${request.purpose})`);
  }
  const config = request.generationConfig || {};
  const unsupportedConfig = Object.keys(config).filter((key) => !OPENAI_SUPPORTED_GENERATION_CONFIG.has(key));
  if (unsupportedConfig.length > 0) throw fail(`generationConfig.${unsupportedConfig.join(', generationConfig.')}`);
  if (config.responseMimeType !== undefined && config.responseMimeType !== 'application/json' && config.responseMimeType !== 'text/plain') {
    throw fail(`responseMimeType ${config.responseMimeType}`);
  }
  // 시간 제한(timeout)·취소 신호(signal)는 OpenAI 요청 옵션으로 그대로 옮긴다. 그 밖의 요청 옵션은 막는다.
  const unsupportedRequestOptions = Object.keys(request.requestOptions || {}).filter((key) => key !== 'timeout');
  if (unsupportedRequestOptions.length > 0) throw fail(`requestOptions.${unsupportedRequestOptions.join(', requestOptions.')}`);
  const unsupportedCallOptions = Object.keys(request.callOptions || {}).filter((key) => key !== 'timeout' && key !== 'signal');
  if (unsupportedCallOptions.length > 0) throw fail(`callOptions.${unsupportedCallOptions.join(', callOptions.')}`);
  const timeout = request.callOptions?.timeout ?? request.requestOptions?.timeout;
  const signal = request.callOptions?.signal;
  const options: Record<string, unknown> = {};
  if (timeout !== undefined) options.timeout = timeout;
  if (signal !== undefined) options.signal = signal;

  const messages: Array<Record<string, unknown>> = [];
  if (request.systemInstruction) messages.push({ role: 'system', content: request.systemInstruction });
  messages.push({ role: 'user', content: toOpenAiContent(request.input, request.purpose) });
  const body: Record<string, unknown> = { model, messages };
  if (config.temperature !== undefined) body.temperature = config.temperature;
  if (config.maxOutputTokens !== undefined) body.max_completion_tokens = config.maxOutputTokens;
  if (config.responseMimeType === 'application/json') body.response_format = { type: 'json_object' };
  const completions = aiClientFactories.openai(apiKey).chat.completions;
  const res: any = Object.keys(options).length > 0
    ? await completions.create(body as any, options as any)
    : await completions.create(body as any);
  return {
    provider: 'openai',
    model,
    inputTokens: finiteOrNull(res?.usage?.prompt_tokens),
    outputTokens: finiteOrNull(res?.usage?.completion_tokens),
    text: () => {
      const content = res?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('OpenAI 응답 본문이 없습니다.');
      return content;
    },
    raw: res,
  };
}

export async function callAi(request: CallAiRequest): Promise<CallAiResult> {
  const route = getAiRoute(request.purpose);
  // 키는 설정 표가 고른 회사의 것을 읽는다. 함수 선언의 secrets 에 aiSecretsFor(용도) 가 없으면 비어 있다.
  const apiKey = aiCredentials.get(route.provider);
  if (!apiKey) throw new Error(`AI 키 없음: ${route.provider} (${request.purpose}) — 함수 secrets 에 aiSecretsFor('${request.purpose}') 를 넣었는지 확인`);
  if (route.provider === 'gemini') return callGemini(route.model, apiKey, request);
  if (route.provider === 'openai') return callOpenAi(route.model, apiKey, request);
  throw new Error(`지원하지 않는 AI 회사: ${(route as { provider: string }).provider}`);
}
