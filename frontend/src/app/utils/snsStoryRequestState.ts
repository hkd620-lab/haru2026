export const SNS_STORY_SYNOPSIS_CALLABLE_TIMEOUT_MS = 570_000;
export const SNS_STORY_FINAL_CALLABLE_TIMEOUT_MS = 330_000;
export const SNS_STORY_FINAL_OPERATION_TTL_MS = 24 * 60 * 60 * 1000;
export const SNS_STORY_FINAL_OPERATION_MAX_ENTRIES = 40;
export const SNS_STORY_FINAL_OPERATION_STORAGE_PREFIX = 'haru:sns-story:final-operations:v1';

export type SnsStoryRangeType = 'all' | 'year' | 'custom';
export type SnsStoryRequestKind = 'synopsis' | 'final';

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

export interface SnsStoryFinalOperationEntry {
  logicalKeyHash: string;
  requestTimestamp: number;
  expiresAt: number;
}

export interface SnsStoryDurableOperationOptions {
  uid: string;
  logicalKey: string;
  memoryFallback: Map<string, number>;
  nowMs?: number;
  ttlMs?: number;
  maxEntries?: number;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  locks?: {
    request<T>(name: string, callback: () => T | Promise<T>): Promise<T>;
  } | null;
}

export interface SnsStoryDurableOperationResult {
  logicalKeyHash: string | null;
  requestTimestamp: number;
  durable: boolean;
}

export interface SnsStoryRequestToken {
  kind: SnsStoryRequestKind;
  generation: number;
  logicalKey: string;
  uid: string;
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

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashSnsStoryLogicalKey(logicalKey: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SHA-256 is unavailable');
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(logicalKey));
  return toHex(digest);
}

export function getSnsStoryFinalOperationStorageKey(uid: string): string {
  return `${SNS_STORY_FINAL_OPERATION_STORAGE_PREFIX}:${uid}`;
}

function getDefaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function getDefaultLocks(): SnsStoryDurableOperationOptions['locks'] {
  try {
    return (globalThis.navigator as Navigator & { locks?: SnsStoryDurableOperationOptions['locks'] })
      ?.locks ?? null;
  } catch {
    return null;
  }
}

function isValidOperationEntry(entry: unknown, nowMs: number): entry is SnsStoryFinalOperationEntry {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<SnsStoryFinalOperationEntry>;
  return typeof candidate.logicalKeyHash === 'string'
    && candidate.logicalKeyHash.length > 0
    && typeof candidate.requestTimestamp === 'number'
    && Number.isFinite(candidate.requestTimestamp)
    && typeof candidate.expiresAt === 'number'
    && Number.isFinite(candidate.expiresAt)
    && candidate.expiresAt > nowMs;
}

function readSnsStoryOperationEntries(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  storageKey: string,
  nowMs: number,
): SnsStoryFinalOperationEntry[] {
  const raw = storage.getItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => isValidOperationEntry(entry, nowMs));
  } catch {
    return [];
  }
}

function writeSnsStoryOperationEntries(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  storageKey: string,
  entries: SnsStoryFinalOperationEntry[],
  maxEntries: number,
) {
  const limitedEntries = [...entries]
    .sort((a, b) => b.expiresAt - a.expiresAt)
    .slice(0, maxEntries);
  storage.setItem(storageKey, JSON.stringify(limitedEntries));
}

function getOrCreateStoredSnsStoryOperation(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  storageKey: string,
  logicalKeyHash: string,
  nowMs: number,
  ttlMs: number,
  maxEntries: number,
): SnsStoryDurableOperationResult {
  const entries = readSnsStoryOperationEntries(storage, storageKey, nowMs);
  const existing = entries.find((entry) => entry.logicalKeyHash === logicalKeyHash);
  if (existing) {
    writeSnsStoryOperationEntries(storage, storageKey, entries, maxEntries);
    return { logicalKeyHash, requestTimestamp: existing.requestTimestamp, durable: true };
  }

  const created = {
    logicalKeyHash,
    requestTimestamp: nowMs,
    expiresAt: nowMs + ttlMs,
  };
  writeSnsStoryOperationEntries(storage, storageKey, [created, ...entries], maxEntries);
  return { logicalKeyHash, requestTimestamp: created.requestTimestamp, durable: true };
}

async function withSnsStoryOperationLock<T>(
  uid: string,
  logicalKeyHash: string,
  locks: SnsStoryDurableOperationOptions['locks'],
  callback: () => T | Promise<T>,
): Promise<T> {
  if (!locks?.request) return callback();
  try {
    return await locks.request(`haru:sns-story:final-operation:${uid}:${logicalKeyHash}`, callback);
  } catch {
    return callback();
  }
}

export async function getOrCreateDurableSnsStoryRequestTimestamp({
  uid,
  logicalKey,
  memoryFallback,
  nowMs = Date.now(),
  ttlMs = SNS_STORY_FINAL_OPERATION_TTL_MS,
  maxEntries = SNS_STORY_FINAL_OPERATION_MAX_ENTRIES,
  storage = getDefaultStorage(),
  locks = getDefaultLocks(),
}: SnsStoryDurableOperationOptions): Promise<SnsStoryDurableOperationResult> {
  let logicalKeyHash: string | null = null;
  try {
    logicalKeyHash = await hashSnsStoryLogicalKey(logicalKey);
  } catch {
    return {
      logicalKeyHash: null,
      requestTimestamp: getOrCreateSnsStoryRequestTimestamp(memoryFallback, logicalKey, nowMs),
      durable: false,
    };
  }

  if (!uid || !storage) {
    return {
      logicalKeyHash,
      requestTimestamp: getOrCreateSnsStoryRequestTimestamp(memoryFallback, `sha256:${logicalKeyHash}`, nowMs),
      durable: false,
    };
  }

  const storageKey = getSnsStoryFinalOperationStorageKey(uid);
  try {
    return await withSnsStoryOperationLock(uid, logicalKeyHash, locks, () => (
      getOrCreateStoredSnsStoryOperation(storage, storageKey, logicalKeyHash, nowMs, ttlMs, maxEntries)
    ));
  } catch {
    return {
      logicalKeyHash,
      requestTimestamp: getOrCreateSnsStoryRequestTimestamp(memoryFallback, `sha256:${logicalKeyHash}`, nowMs),
      durable: false,
    };
  }
}

function normalizeCoordinatorUid(uid?: string | null): string {
  return uid ? String(uid) : '';
}

export function createSnsStoryRequestCoordinator(initialUid?: string | null) {
  const generations: Record<SnsStoryRequestKind, number> = { synopsis: 0, final: 0 };
  const logicalKeys: Record<SnsStoryRequestKind, string> = { synopsis: '', final: '' };
  let uid = normalizeCoordinatorUid(initialUid);

  const invalidate = (kind?: SnsStoryRequestKind) => {
    if (kind) {
      generations[kind] += 1;
      logicalKeys[kind] = '';
      return;
    }
    generations.synopsis += 1;
    generations.final += 1;
    logicalKeys.synopsis = '';
    logicalKeys.final = '';
  };

  const setUser = (nextUid?: string | null) => {
    const normalizedUid = normalizeCoordinatorUid(nextUid);
    if (normalizedUid === uid) return;
    uid = normalizedUid;
    invalidate();
  };

  const start = (
    kind: SnsStoryRequestKind,
    logicalKey: string,
    nextUid?: string | null,
  ): SnsStoryRequestToken => {
    setUser(nextUid ?? uid);
    generations[kind] += 1;
    logicalKeys[kind] = logicalKey;
    return { kind, generation: generations[kind], logicalKey, uid };
  };

  const isCurrent = (
    token: SnsStoryRequestToken,
    logicalKey = token.logicalKey,
    nextUid: string | null | undefined = token.uid,
  ): boolean => (
    token.generation === generations[token.kind]
    && logicalKeys[token.kind] === logicalKey
    && token.uid === uid
    && normalizeCoordinatorUid(nextUid) === uid
  );

  return {
    start,
    invalidate,
    setUser,
    isCurrent,
    finish: isCurrent,
  };
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
