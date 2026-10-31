export type BibleTtsQuality = 'standard' | 'native';

const MAX_CACHE_KEY_LENGTH = 80;
const NATIVE_CACHE_KEY_SUFFIX = '_native';

// 표준 요청은 기존 캐시를 그대로 쓰도록 요청 모양과 cacheKey를 바꾸지 않는다.
// 고음질 표시는 80자 제한에 잘리지 않게 앞부분을 줄여 붙인다.
export function buildBibleTtsRequest(params: {
  prefix: string;
  chapter: number;
  key: string;
  voice: string;
  text: string;
  quality?: BibleTtsQuality;
}) {
  const { prefix, chapter, key, voice, text, quality } = params;
  const baseKey = `bible_${prefix}_${chapter}_${key}_${voice}`;
  if (quality !== 'native') {
    return { text, cacheKey: baseKey.slice(0, MAX_CACHE_KEY_LENGTH), voice };
  }
  return {
    text,
    cacheKey: `${baseKey.slice(0, MAX_CACHE_KEY_LENGTH - NATIVE_CACHE_KEY_SUFFIX.length)}${NATIVE_CACHE_KEY_SUFFIX}`,
    voice,
    quality: 'native' as const,
  };
}
