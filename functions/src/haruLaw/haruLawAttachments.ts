// 하루LAW 첨부 파일 처리(Storage 확인·Gemini File 업로드·정리)와 함수 마감 시간 관리.
// 하루LAW 결과물 AI 대화(index.ts chatWithResult)와 정리 예약 실행(cleanupHaruLawGeminiFiles)이 함께 쓴다.
// index.ts 에 있던 정의를 그대로 옮겼다(동작 같음).
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getHaruLawAttachmentContentError, getHaruLawErrorDescriptor, isAllowedHaruLawAttachmentMime, type HaruLawErrorReason } from '../haruLawErrorCore';
import { GoogleGenAI } from '@google/genai';
import { getStorage } from 'firebase-admin/storage';
import { clampResultChatText } from '../sharedHelpers';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const GEMINI_API_KEY_SECRET = defineSecret('GEMINI_API_KEY');
const bucket = () => getStorage().bucket();

export type HaruLawAttachmentRef = {
  storagePath: string;
  mimeType: string;
  fileName: string;
};
export type HaruLawGeminiFilePart = {
  fileData: {
    mimeType: string;
    fileUri: string;
  };
};
export type PreparedHaruLawAttachment = {
  tempPath: string;
  mimeType: string;
};
export type PreparedHaruLawAttachments = {
  tempDir: string;
  files: PreparedHaruLawAttachment[];
  attachmentMeta: HaruLawAttachmentRef[];
};
export type TrackedHaruLawGeminiFile = {
  name: string;
  cleanupDocRef: FirebaseFirestore.DocumentReference;
};

export const HARULAW_ATTACH_MAX_FILES = 5;
export const HARULAW_ATTACH_MAX_IMAGE_BYTES = 7 * 1024 * 1024;
export const HARULAW_ATTACH_MAX_PDF_BYTES = 50_000_000;
export const HARULAW_ATTACH_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const HARULAW_GEMINI_FILE_CLEANUP_COLLECTION = 'haruLawGeminiFileCleanup';
export const HARULAW_GEMINI_FILE_CLEANUP_DELAY_MS = 10 * 60 * 1000;
export const HARULAW_CALLABLE_TIMEOUT_MS = 90_000;
export const HARULAW_GEMINI_FINALIZATION_RESERVE_MS = 15_000;
export const HARULAW_POST_MODEL_WRITE_BUDGET_MS = 15_000;
export const HARULAW_ROLLBACK_DEADLINE_MARGIN_MS = 5_000;
export const HARULAW_CLEANUP_LEDGER_TIMEOUT_MS = 2_000;
// Finish uploads and attachment-backed model calls before post-model writes,
// while preserving a final 15 seconds for rollback and File cleanup.
export const HARULAW_GEMINI_FILE_TIMEOUT_MS = HARULAW_CALLABLE_TIMEOUT_MS
  - HARULAW_POST_MODEL_WRITE_BUDGET_MS
  - HARULAW_GEMINI_FINALIZATION_RESERVE_MS;
export const HARULAW_GEMINI_FILE_DELETE_TIMEOUT_MS = 10_000;
export const HARULAW_GEMINI_FILE_NAME_PATTERN = /^files\/harulaw-[a-f0-9]{32}$/;

export function getHaruLawRemainingWorkMs(workDeadlineMs: number): number {
  const remainingMs = workDeadlineMs - Date.now();
  if (remainingMs <= 0) {
    throw createHaruLawHttpsError('HARULAW_AI_TEMPORARY_UNAVAILABLE');
  }
  return remainingMs;
}

export function isHaruLawDeadlineAbortError(error: unknown): boolean {
  const candidate = error as { name?: unknown; code?: unknown } | null;
  return candidate?.name === 'AbortError'
    || candidate?.name === 'TimeoutError'
    || candidate?.name === 'GoogleGenerativeAIAbortError'
    || candidate?.code === 20;
}

export async function runHaruLawOperationBeforeDeadline<T>(
  deadlineMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  const remainingMs = getHaruLawRemainingWorkMs(deadlineMs);
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(createHaruLawHttpsError('HARULAW_AI_TEMPORARY_UNAVAILABLE')),
          remainingMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function runHaruLawModelBeforeDeadline<T>(
  deadlineMs: number,
  operation: (options: { timeoutMs: number; abortSignal: AbortSignal }) => Promise<T>,
): Promise<T> {
  const timeoutMs = getHaruLawRemainingWorkMs(deadlineMs);
  const abortSignal = AbortSignal.timeout(timeoutMs);
  try {
    return await operation({ timeoutMs, abortSignal });
  } catch (error) {
    if (abortSignal.aborted || isHaruLawDeadlineAbortError(error)) {
      throw createHaruLawHttpsError('HARULAW_AI_TEMPORARY_UNAVAILABLE');
    }
    throw error;
  }
}

export async function settleHaruLawRollbacksBeforeDeadline(
  deadlineMs: number,
  rollbacks: Promise<unknown>[],
): Promise<void> {
  const remainingMs = Math.max(0, deadlineMs - Date.now());
  if (remainingMs === 0) {
    logger.warn('하루LAW 사용량 롤백이 함수 마감 전 완료되지 않음');
    return;
  }
  let timeout: NodeJS.Timeout | null = null;
  const settled = await Promise.race([
    Promise.allSettled(rollbacks).then(() => true),
    new Promise<boolean>((resolve) => {
      timeout = setTimeout(() => resolve(false), remainingMs);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  if (!settled) {
    logger.warn('하루LAW 사용량 롤백이 함수 마감 전 완료되지 않음');
  }
}

export async function settleHaruLawCleanupLedgerWrite(operation: Promise<unknown>): Promise<void> {
  let timeout: NodeJS.Timeout | null = null;
  await Promise.race([
    operation.catch(() => undefined),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, HARULAW_CLEANUP_LEDGER_TIMEOUT_MS);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
}

export function readHaruLawAttachments(raw: unknown): HaruLawAttachmentRef[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > HARULAW_ATTACH_MAX_FILES) {
    throw new HttpsError('invalid-argument', '첨부파일은 최대 5개까지 추가할 수 있습니다.');
  }
  return raw.map((item) => {
    const source = item as Partial<HaruLawAttachmentRef>;
    const storagePath = clampResultChatText(source?.storagePath, 512);
    const mimeType = clampResultChatText(source?.mimeType, 120).toLowerCase();
    const fileName = clampResultChatText(source?.fileName, 180);
    if (!storagePath || !mimeType || !fileName) {
      throw new HttpsError('invalid-argument', '첨부 파일 정보가 올바르지 않습니다.');
    }
    return { storagePath, mimeType, fileName };
  });
}

export function createHaruLawHttpsError(reason: HaruLawErrorReason): HttpsError {
  const descriptor = getHaruLawErrorDescriptor(reason);
  return new HttpsError(descriptor.code, descriptor.message, descriptor.details);
}

export function getHaruLawAttachmentSizeLimit(mimeType: string): number {
  return mimeType.startsWith('image/') ? HARULAW_ATTACH_MAX_IMAGE_BYTES : HARULAW_ATTACH_MAX_PDF_BYTES;
}

export async function prepareHaruLawAttachments(
  uid: string,
  attachments: HaruLawAttachmentRef[],
  workDeadlineMs: number,
): Promise<PreparedHaruLawAttachments> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'harulaw-attachments-'));
  const preparedFiles: PreparedHaruLawAttachment[] = [];
  const attachmentMeta: HaruLawAttachmentRef[] = [];
  const validatedAttachments: Array<{
    attachment: HaruLawAttachmentRef;
    file: ReturnType<ReturnType<typeof bucket>['file']>;
    effectiveMimeType: string;
    sizeLimit: number;
  }> = [];
  let metadataTotalBytes = 0;

  try {
    for (const att of attachments) {
      if (!att.storagePath.startsWith(`users/${uid}/haruLawAttachments/`)) {
        throw new HttpsError('permission-denied', '허용되지 않은 파일 경로입니다.');
      }
      if (!isAllowedHaruLawAttachmentMime(att.mimeType)) {
        throw createHaruLawHttpsError('ATTACHMENT_UNSUPPORTED_TYPE');
      }

      const file = bucket().file(att.storagePath);
      let metadata: any;
      try {
        [metadata] = await runHaruLawOperationBeforeDeadline(
          workDeadlineMs,
          () => file.getMetadata(),
        );
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.warn('하루LAW 첨부 메타데이터 조회 실패', { errorCode: (error as any)?.code });
        throw new HttpsError('not-found', '첨부 파일을 찾을 수 없습니다.');
      }

      const storedMimeType = String(metadata?.contentType || '').trim().toLowerCase();
      const effectiveMimeType = storedMimeType || att.mimeType;
      if (!isAllowedHaruLawAttachmentMime(effectiveMimeType) || (storedMimeType && storedMimeType !== att.mimeType)) {
        throw createHaruLawHttpsError('ATTACHMENT_UNSUPPORTED_TYPE');
      }

      const sizeLimit = getHaruLawAttachmentSizeLimit(effectiveMimeType);
      const metadataSize = Number(metadata?.size);
      if (!Number.isSafeInteger(metadataSize) || metadataSize < 0) {
        throw new HttpsError('internal', '첨부 파일 크기를 확인하지 못했습니다.');
      }
      if (metadataSize > sizeLimit) {
        throw new HttpsError('invalid-argument', '파일 크기가 허용 범위를 초과했습니다.');
      }
      metadataTotalBytes += metadataSize;
      if (metadataTotalBytes > HARULAW_ATTACH_MAX_TOTAL_BYTES) {
        throw createHaruLawHttpsError('ATTACHMENT_TOTAL_SIZE_EXCEEDED');
      }
      validatedAttachments.push({ attachment: att, file, effectiveMimeType, sizeLimit });
    }

    let downloadedTotalBytes = 0;
    for (let index = 0; index < validatedAttachments.length; index += 1) {
      const { attachment: att, file, effectiveMimeType, sizeLimit } = validatedAttachments[index];
      const tempPath = path.join(tempDir, `${index}.upload`);
      try {
        await runHaruLawOperationBeforeDeadline(
          workDeadlineMs,
          () => file.download({ destination: tempPath }).then(() => undefined),
        );
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.warn('하루LAW 첨부 다운로드 실패', { errorCode: (error as any)?.code });
        throw new HttpsError('not-found', '첨부 파일을 다운로드하지 못했습니다.');
      }
      const actualSize = (await fs.promises.stat(tempPath)).size;
      if (actualSize > sizeLimit) {
        throw new HttpsError('invalid-argument', '파일 크기가 허용 범위를 초과했습니다.');
      }
      downloadedTotalBytes += actualSize;
      if (downloadedTotalBytes > HARULAW_ATTACH_MAX_TOTAL_BYTES) {
        throw createHaruLawHttpsError('ATTACHMENT_TOTAL_SIZE_EXCEEDED');
      }
      const contentError = await getHaruLawAttachmentContentError(
        effectiveMimeType,
        await fs.promises.readFile(tempPath),
      );
      if (contentError) {
        throw createHaruLawHttpsError(contentError);
      }

      preparedFiles.push({ tempPath, mimeType: effectiveMimeType });
      attachmentMeta.push({ storagePath: att.storagePath, mimeType: effectiveMimeType, fileName: att.fileName });
    }

    return { tempDir, files: preparedFiles, attachmentMeta };
  } catch (error) {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function removePreparedHaruLawAttachments(prepared: PreparedHaruLawAttachments | null): Promise<void> {
  if (!prepared) return;
  await fs.promises.rm(prepared.tempDir, { recursive: true, force: true }).catch((error) => {
    logger.warn('하루LAW 로컬 임시 첨부 정리 실패', { errorCode: (error as any)?.code });
  });
}

export function getHaruLawGeminiFileName(uploadGroupId: string, index: number): string {
  const opaqueId = crypto
    .createHash('sha256')
    .update(`harulaw:${uploadGroupId}:${index}`)
    .digest('hex')
    .slice(0, 32);
  return `files/harulaw-${opaqueId}`;
}

export function getHaruLawGeminiCleanupDocRef(fileName: string): FirebaseFirestore.DocumentReference {
  const docId = crypto.createHash('sha256').update(fileName).digest('hex');
  return db.collection(HARULAW_GEMINI_FILE_CLEANUP_COLLECTION).doc(docId);
}

export function isHaruLawGeminiFileNotFound(error: unknown): boolean {
  const candidate = error as { code?: unknown; status?: unknown; response?: { status?: unknown } } | null;
  return Number(candidate?.response?.status ?? candidate?.status ?? candidate?.code) === 404;
}

export async function deleteTrackedHaruLawGeminiFile(
  ai: GoogleGenAI,
  tracked: TrackedHaruLawGeminiFile,
): Promise<boolean> {
  try {
    await ai.files.delete({
      name: tracked.name,
      config: { httpOptions: { timeout: HARULAW_GEMINI_FILE_DELETE_TIMEOUT_MS } },
    });
    await settleHaruLawCleanupLedgerWrite(tracked.cleanupDocRef.delete());
    return true;
  } catch (error) {
    if (isHaruLawGeminiFileNotFound(error)) {
      await settleHaruLawCleanupLedgerWrite(tracked.cleanupDocRef.delete());
      return true;
    }
    await settleHaruLawCleanupLedgerWrite(
      tracked.cleanupDocRef.set({
        cleanupAfter: admin.firestore.Timestamp.fromMillis(Date.now() + HARULAW_GEMINI_FILE_CLEANUP_DELAY_MS),
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: admin.firestore.FieldValue.increment(1),
      }, { merge: true }),
    );
    logger.warn('하루LAW Gemini 임시 File 삭제 실패', {
      errorCode: (error as any)?.code,
      errorStatus: (error as any)?.response?.status ?? (error as any)?.status,
    });
    return false;
  }
}

export async function deleteTrackedHaruLawGeminiFiles(
  ai: GoogleGenAI | null,
  trackedFiles: TrackedHaruLawGeminiFile[],
): Promise<void> {
  if (!ai) return;
  // At most five request-owned Files exist. Delete them concurrently so the
  // 10-second per-delete cap fits inside the 15-second finalization reserve.
  const results = await Promise.all(
    trackedFiles.map(async (tracked) => ({
      tracked,
      deleted: await deleteTrackedHaruLawGeminiFile(ai, tracked),
    })),
  );
  trackedFiles.splice(0, trackedFiles.length, ...results
    .filter((result) => !result.deleted)
    .map((result) => result.tracked));
}

export async function uploadPreparedHaruLawAttachments(
  apiKey: string,
  prepared: PreparedHaruLawAttachments,
  uploadGroupId: string,
  trackedFiles: TrackedHaruLawGeminiFile[],
  workDeadlineMs: number,
): Promise<HaruLawGeminiFilePart[]> {
  const fileParts: HaruLawGeminiFilePart[] = [];
  for (let index = 0; index < prepared.files.length; index += 1) {
    const preparedFile = prepared.files[index];
    const name = getHaruLawGeminiFileName(uploadGroupId, index);
    const cleanupDocRef = getHaruLawGeminiCleanupDocRef(name);
    try {
      getHaruLawRemainingWorkMs(workDeadlineMs);
      await cleanupDocRef.set({
        fileName: name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        cleanupAfter: admin.firestore.Timestamp.fromMillis(Date.now() + HARULAW_GEMINI_FILE_CLEANUP_DELAY_MS),
        attempts: 0,
      });
      trackedFiles.push({ name, cleanupDocRef });
      const remainingUploadMs = Math.min(
        HARULAW_GEMINI_FILE_TIMEOUT_MS,
        getHaruLawRemainingWorkMs(workDeadlineMs),
      );
      const uploadClient = new GoogleGenAI({
        apiKey,
        httpOptions: { timeout: remainingUploadMs },
      });
      const uploaded = await uploadClient.files.upload({
        file: preparedFile.tempPath,
        config: {
          name,
          mimeType: preparedFile.mimeType,
        },
      });
      if (uploaded.name !== name || !uploaded.uri) {
        throw new Error('HARULAW_GEMINI_FILE_UPLOAD_INVALID_RESPONSE');
      }
      fileParts.push({ fileData: { mimeType: preparedFile.mimeType, fileUri: uploaded.uri } });
    } catch (error) {
      logger.warn('하루LAW Gemini 임시 File 업로드 실패', {
        errorCode: (error as any)?.code,
        errorStatus: (error as any)?.response?.status ?? (error as any)?.status,
      });
      throw createHaruLawHttpsError('HARULAW_AI_TEMPORARY_UNAVAILABLE');
    }
  }
  return fileParts;
}

export const cleanupHaruLawGeminiFiles = onSchedule(
  {
    schedule: 'every 30 minutes',
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    const snapshot = await db.collection(HARULAW_GEMINI_FILE_CLEANUP_COLLECTION)
      .where('cleanupAfter', '<=', admin.firestore.Timestamp.now())
      .limit(100)
      .get();
    if (snapshot.empty) return;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY_SECRET.value() });
    let deletedCount = 0;
    let failedCount = 0;
    for (const doc of snapshot.docs) {
      const fileName = String(doc.data()?.fileName || '');
      if (!HARULAW_GEMINI_FILE_NAME_PATTERN.test(fileName)) {
        await doc.ref.delete();
        continue;
      }
      const deleted = await deleteTrackedHaruLawGeminiFile(ai, { name: fileName, cleanupDocRef: doc.ref });
      if (deleted) deletedCount += 1;
      else failedCount += 1;
    }
    logger.info('하루LAW Gemini 임시 File 재정리 완료', { deletedCount, failedCount });
  },
);
