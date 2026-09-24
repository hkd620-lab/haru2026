import type { HaruLawAttachmentRef } from './resultChatService';

export type HaruLawAttachmentCleanupEntry = HaruLawAttachmentRef & {
  uid: string;
  recordId: string;
  threadId: string;
  verifyReference: boolean;
  notBefore?: number;
};

type CleanupDependencies = {
  deletePath: (storagePath: string) => Promise<void>;
  isReferenced: (entry: HaruLawAttachmentCleanupEntry) => Promise<boolean>;
  now?: () => number;
};

export type HaruLawAttachmentCleanupResult = {
  deletedPaths: string[];
  preservedPaths: string[];
  failedPaths: string[];
  deferredPaths: string[];
  nextRetryAt?: number;
};

const PENDING_HARULAW_ATTACHMENT_CLEANUP_KEY = 'haru2026_pending_harulaw_attachment_cleanup_v1';
const scheduledCleanupRetries = new Map<string, {
  retryAt: number;
  timer: ReturnType<typeof setTimeout>;
}>();

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function cleanupEntryKey(entry: Pick<HaruLawAttachmentCleanupEntry, 'uid' | 'storagePath'>): string {
  return `${entry.uid}\n${entry.storagePath}`;
}

export function isOwnedHaruLawAttachmentPath(uid: string, recordId: string, storagePath: string): boolean {
  if (!uid || !recordId || !storagePath) return false;
  const prefix = `users/${uid}/haruLawAttachments/${recordId}/`;
  if (!storagePath.startsWith(prefix)) return false;
  const fileName = storagePath.slice(prefix.length);
  return Boolean(fileName)
    && !fileName.includes('/')
    && fileName !== '.'
    && fileName !== '..';
}

function normalizeCleanupEntry(raw: unknown): HaruLawAttachmentCleanupEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<HaruLawAttachmentCleanupEntry>;
  const uid = typeof source.uid === 'string' ? source.uid : '';
  const recordId = typeof source.recordId === 'string' ? source.recordId : '';
  const threadId = typeof source.threadId === 'string' ? source.threadId : '';
  const storagePath = typeof source.storagePath === 'string' ? source.storagePath : '';
  const mimeType = typeof source.mimeType === 'string' ? source.mimeType : '';
  const fileName = typeof source.fileName === 'string' ? source.fileName : '';
  if (
    !threadId
    || recordId.includes('/')
    || threadId.includes('/')
    || !mimeType
    || !fileName
    || !isOwnedHaruLawAttachmentPath(uid, recordId, storagePath)
  ) {
    return null;
  }
  const notBefore = Number(source.notBefore);
  return {
    uid,
    recordId,
    threadId,
    storagePath,
    mimeType,
    fileName,
    verifyReference: source.verifyReference === true,
    ...(Number.isFinite(notBefore) && notBefore > 0 ? { notBefore } : {}),
  };
}

function readCleanupQueue(): HaruLawAttachmentCleanupEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PENDING_HARULAW_ATTACHMENT_CLEANUP_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCleanupEntry).filter((entry): entry is HaruLawAttachmentCleanupEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function writeCleanupQueue(entries: HaruLawAttachmentCleanupEntry[]) {
  const storage = getStorage();
  if (!storage) return;
  const deduped = new Map<string, HaruLawAttachmentCleanupEntry>();
  for (const entry of entries) {
    const normalized = normalizeCleanupEntry(entry);
    if (!normalized) continue;
    const key = cleanupEntryKey(normalized);
    const previous = deduped.get(key);
    deduped.set(key, previous
      ? {
        ...normalized,
        verifyReference: previous.verifyReference || normalized.verifyReference,
        notBefore: Math.max(previous.notBefore || 0, normalized.notBefore || 0) || undefined,
      }
      : normalized);
  }
  try {
    storage.setItem(PENDING_HARULAW_ATTACHMENT_CLEANUP_KEY, JSON.stringify([...deduped.values()]));
  } catch {
    // Storage 정리는 최선 시도이며 localStorage 장애가 사용자 흐름을 막아서는 안 된다.
  }
}

export function enqueueHaruLawAttachmentCleanup(entry: HaruLawAttachmentCleanupEntry) {
  const normalized = normalizeCleanupEntry(entry);
  if (!normalized) return;
  writeCleanupQueue([...readCleanupQueue(), normalized]);
}

function isObjectAlreadyDeleted(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code || '').toLowerCase();
  return code === 'storage/object-not-found' || code.includes('object-not-found');
}

async function cleanupEntries(
  entries: HaruLawAttachmentCleanupEntry[],
  dependencies: CleanupDependencies,
  enqueueFailures: boolean,
): Promise<HaruLawAttachmentCleanupResult> {
  const uniqueEntries = new Map<string, HaruLawAttachmentCleanupEntry>();
  for (const entry of entries) {
    const normalized = normalizeCleanupEntry(entry);
    if (!normalized) continue;
    uniqueEntries.set(cleanupEntryKey(normalized), normalized);
  }

  const result: HaruLawAttachmentCleanupResult = {
    deletedPaths: [],
    preservedPaths: [],
    failedPaths: [],
    deferredPaths: [],
  };
  const now = dependencies.now?.() ?? Date.now();

  for (const entry of uniqueEntries.values()) {
    if ((entry.notBefore || 0) > now) {
      result.deferredPaths.push(entry.storagePath);
      result.nextRetryAt = Math.min(result.nextRetryAt ?? Number.POSITIVE_INFINITY, entry.notBefore!);
      if (enqueueFailures) enqueueHaruLawAttachmentCleanup(entry);
      continue;
    }
    if (entry.verifyReference) {
      try {
        if (await dependencies.isReferenced(entry)) {
          result.preservedPaths.push(entry.storagePath);
          continue;
        }
      } catch {
        result.failedPaths.push(entry.storagePath);
        if (enqueueFailures) enqueueHaruLawAttachmentCleanup(entry);
        continue;
      }
    }
    try {
      await dependencies.deletePath(entry.storagePath);
      result.deletedPaths.push(entry.storagePath);
    } catch (error) {
      if (isObjectAlreadyDeleted(error)) {
        result.deletedPaths.push(entry.storagePath);
      } else {
        result.failedPaths.push(entry.storagePath);
        if (enqueueFailures) enqueueHaruLawAttachmentCleanup(entry);
      }
    }
  }
  return result;
}

export async function cleanupHaruLawAttachments(
  entries: HaruLawAttachmentCleanupEntry[],
  dependencies: CleanupDependencies,
): Promise<HaruLawAttachmentCleanupResult> {
  return cleanupEntries(entries, dependencies, true);
}

export async function retryPendingHaruLawAttachmentCleanup(
  uid: string,
  dependencies: CleanupDependencies,
): Promise<HaruLawAttachmentCleanupResult> {
  const ownedEntries = readCleanupQueue().filter((entry) => entry.uid === uid);
  const result = await cleanupEntries(ownedEntries, dependencies, false);
  const completedPaths = new Set([...result.deletedPaths, ...result.preservedPaths]);
  const latestQueue = readCleanupQueue();
  writeCleanupQueue(latestQueue.filter((entry) => entry.uid !== uid || !completedPaths.has(entry.storagePath)));
  return result;
}

export function scheduleDeferredHaruLawAttachmentCleanup(
  uid: string,
  retryAt: number,
  dependencies: CleanupDependencies,
) {
  if (!uid || !Number.isFinite(retryAt) || retryAt <= 0) return;
  const existing = scheduledCleanupRetries.get(uid);
  if (existing && existing.retryAt <= retryAt) return;
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    const scheduled = scheduledCleanupRetries.get(uid);
    if (!scheduled || scheduled.timer !== timer) return;
    scheduledCleanupRetries.delete(uid);
    void retryPendingHaruLawAttachmentCleanup(uid, dependencies)
      .then((result) => {
        if (result.nextRetryAt) {
          scheduleDeferredHaruLawAttachmentCleanup(uid, result.nextRetryAt, dependencies);
        }
      })
      .catch(() => {
        // 일반 삭제 실패는 큐에 남으며 다음 모달 진입 때 다시 시도한다.
      });
  }, Math.max(0, retryAt - Date.now()));

  scheduledCleanupRetries.set(uid, { retryAt, timer });
}
