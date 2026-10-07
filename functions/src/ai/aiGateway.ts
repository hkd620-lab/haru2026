// AI 호출 창구 — 기능 코드는 회사별 SDK 를 직접 만들지 않고 callAi 하나만 부른다.
// 어느 회사·모델로 보낼지는 aiModels.ts 설정 표가 정한다. 회사별 차이(요청 형식·사용량 필드)는 여기서 맞춘다.
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerateContentRequest, GenerationConfig, ModelParams, Part, RequestOptions } from '@google/generative-ai';
import OpenAI from 'openai';
import { getAiRoute } from './aiModels';
import type { AiProvider, AiPurpose } from './aiModels';

export type AiKeys = { gemini?: string; openai?: string };
// Gemini generateContent 가 받는 입력과 같은 모양(문자열, 문자열·이미지 조각 배열, 또는 { contents } 요청 객체)
export type AiInput = string | Array<string | Part> | GenerateContentRequest;

export interface CallAiRequest {
  purpose: AiPurpose;
  keys: AiKeys;
  input: AiInput;
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
  // Gemini 전용 설정(tools·safetySettings 등). 다른 회사로 보내면 오류로 막는다.
  geminiParams?: Omit<ModelParams, 'model' | 'systemInstruction' | 'generationConfig'>;
  requestOptions?: RequestOptions;
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
  openai: (apiKey: string) => new OpenAI({ apiKey }),
};

const finiteOrNull = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function getGeminiUsage(result: any): { inputTokens: number | null; outputTokens: number | null } {
  const usage = result?.response?.usageMetadata || result?.usageMetadata || {};
  return { inputTokens: finiteOrNull(usage.promptTokenCount), outputTokens: finiteOrNull(usage.candidatesTokenCount) };
}

async function callGemini(model: string, request: CallAiRequest): Promise<CallAiResult> {
  if (!request.keys.gemini) throw new Error(`AI 키 없음: gemini (${request.purpose})`);
  const params: ModelParams = { model, ...request.geminiParams };
  if (request.systemInstruction !== undefined) params.systemInstruction = request.systemInstruction;
  if (request.generationConfig !== undefined) params.generationConfig = request.generationConfig;
  const generativeModel = request.requestOptions
    ? aiClientFactories.gemini(request.keys.gemini).getGenerativeModel(params, request.requestOptions)
    : aiClientFactories.gemini(request.keys.gemini).getGenerativeModel(params);
  const result = await generativeModel.generateContent(request.input);
  const usage = getGeminiUsage(result);
  return { provider: 'gemini', model, ...usage, text: () => result.response.text(), raw: result };
}

function toOpenAiContent(input: AiInput): string | Array<Record<string, unknown>> {
  if (typeof input === 'string') return input;
  if (!Array.isArray(input)) {
    // { contents: [{ role: 'user', parts }] } 요청 객체는 사용자 한 턴일 때만 옮긴다.
    const contents = input.contents || [];
    if (contents.length !== 1 || contents[0].role !== 'user') throw new Error('OpenAI 로 보낼 수 없는 요청 형식입니다.');
    return toOpenAiContent(contents[0].parts as Part[]);
  }
  return input.map((part) => {
    if (typeof part === 'string') return { type: 'text', text: part };
    if ('text' in part && typeof part.text === 'string') return { type: 'text', text: part.text };
    if ('inlineData' in part && part.inlineData) {
      return { type: 'image_url', image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } };
    }
    throw new Error('OpenAI 로 보낼 수 없는 입력 조각입니다.');
  });
}

async function callOpenAi(model: string, request: CallAiRequest): Promise<CallAiResult> {
  if (!request.keys.openai) throw new Error(`AI 키 없음: openai (${request.purpose})`);
  if (request.geminiParams && Object.keys(request.geminiParams).length > 0) {
    throw new Error(`Gemini 전용 설정을 쓰는 기능은 OpenAI 로 옮길 수 없습니다 (${request.purpose})`);
  }
  const messages: Array<Record<string, unknown>> = [];
  if (request.systemInstruction) messages.push({ role: 'system', content: request.systemInstruction });
  messages.push({ role: 'user', content: toOpenAiContent(request.input) });
  const config = request.generationConfig || {};
  const body: Record<string, unknown> = { model, messages };
  if (config.temperature !== undefined) body.temperature = config.temperature;
  if (config.maxOutputTokens !== undefined) body.max_completion_tokens = config.maxOutputTokens;
  if (config.responseMimeType === 'application/json') body.response_format = { type: 'json_object' };
  const res: any = await aiClientFactories.openai(request.keys.openai).chat.completions.create(body as any);
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
  if (route.provider === 'gemini') return callGemini(route.model, request);
  if (route.provider === 'openai') return callOpenAi(route.model, request);
  throw new Error(`지원하지 않는 AI 회사: ${(route as { provider: string }).provider}`);
}
