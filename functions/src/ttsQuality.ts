import * as crypto from 'crypto';

export type TtsQuality = 'standard' | 'native';

export const TTS_QUALITY_SETTINGS: Record<TtsQuality, { model: string; speed: number }> = {
  standard: { model: 'tts-1', speed: 0.95 },
  native: { model: 'tts-1-hd', speed: 0.92 },
};

// 명시적으로 native를 고른 요청만 고음질로 처리한다.
export function normalizeTtsQuality(value: unknown): TtsQuality {
  return value === 'native' ? 'native' : 'standard';
}

// 표준 음성은 기존 캐시 객체를 그대로 쓰도록 경로를 바꾸지 않는다.
// 고음질은 음성·모델·속도·본문을 해시한 별도 경로에 저장해 표준 음성과 섞이지 않게 하고,
// 해시에 밑줄이 없어 `${cacheKey}_${voice}.mp3` 형태의 표준 경로와도 겹치지 않는다.
export function buildTtsCachePath(params: {
  cacheKey: unknown;
  voice: string;
  quality: TtsQuality;
  text: unknown;
}): string {
  const { cacheKey, voice, quality, text } = params;
  if (quality === 'standard') return `ttsCache/${cacheKey}_${voice}.mp3`;
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...TTS_QUALITY_SETTINGS[quality], voice, text }))
    .digest('hex');
  return `ttsCache/native/${hash}.mp3`;
}
