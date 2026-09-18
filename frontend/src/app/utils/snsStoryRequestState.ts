export const SNS_STORY_SYNOPSIS_CALLABLE_TIMEOUT_MS = 570_000;
export const SNS_STORY_FINAL_CALLABLE_TIMEOUT_MS = 330_000;

export type SnsStoryRangeType = 'all' | 'year' | 'custom';

export interface SnsStoryRequestBase {
  rangeType: SnsStoryRangeType;
  year?: string;
  from?: string;
  to?: string;
  excludedRecordIds?: string[];
}

export interface SnsStoryFinalRequestInput extends SnsStoryRequestBase {
  sourceFingerprint: string;
  title: string;
  confirmedSynopsis: string;
}

export function normalizeSnsStoryRequestBase(input: SnsStoryRequestBase) {
  const rangeType = input.rangeType === 'year' || input.rangeType === 'custom' ? input.rangeType : 'all';
  return {
    rangeType,
    year: rangeType === 'year' ? String(input.year || '').trim() : undefined,
    from: rangeType === 'custom' ? String(input.from || '').trim() : undefined,
    to: rangeType === 'custom' ? String(input.to || '').trim() : undefined,
    excludedRecordIds: Array.from(new Set(input.excludedRecordIds || []))
      .map((id) => String(id).trim())
      .filter(Boolean)
      .sort(),
  };
}

export function buildSnsStorySelectionKey(input: SnsStoryRequestBase): string {
  return JSON.stringify(normalizeSnsStoryRequestBase(input));
}

export function buildSnsStoryFinalLogicalKey(input: SnsStoryFinalRequestInput): string {
  return JSON.stringify({
    ...normalizeSnsStoryRequestBase(input),
    sourceFingerprint: String(input.sourceFingerprint || '').trim().toLowerCase(),
    title: String(input.title || '').trim(),
    confirmedSynopsis: String(input.confirmedSynopsis || '').trim(),
  });
}

export function getOrCreateSnsStoryRequestTimestamp(
  timestampsByLogicalKey: Map<string, number>,
  logicalKey: string,
  nowMs = Date.now(),
): number {
  const existing = timestampsByLogicalKey.get(logicalKey);
  if (typeof existing === 'number' && Number.isFinite(existing)) return existing;
  timestampsByLogicalKey.set(logicalKey, nowMs);
  return nowMs;
}

export function isSnsStoryAmbiguousCallableError(error: any): boolean {
  const code = String(error?.code || error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('deadline-exceeded')
    || code.includes('unavailable')
    || message.includes('deadline')
    || message.includes('timeout')
    || message.includes('network')
    || message.includes('offline')
    || message.includes('unavailable');
}
