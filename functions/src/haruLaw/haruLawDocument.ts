import { Worker } from 'worker_threads';
import * as path from 'path';
export { HARULAW_DOCUMENT_MAX_BYTES, isHaruLawDocumentMime } from './haruLawDocumentCore';
// 손상된 CFB/XML의 과도한 CPU·메모리 사용을 제한한다.
export async function readHaruLawDocumentText(mimeType: string, bytes: Buffer, deadlineMs: number): Promise<string> {
  const timeoutMs = Math.min(5000, deadlineMs - Date.now());
  if (timeoutMs <= 0) throw new Error('ATTACHMENT_CONTENT_UNREADABLE');
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'haruLawDocumentWorker.js'), {
      workerData: { mimeType, bytes }, resourceLimits: { maxOldGenerationSizeMb: 96 },
    });
    const fail = () => reject(new Error('ATTACHMENT_CONTENT_UNREADABLE'));
    const timer = setTimeout(() => { void worker.terminate(); fail(); }, timeoutMs);
    worker.once('message', result => {
      clearTimeout(timer); void worker.terminate();
      if (typeof result?.text === 'string') resolve(result.text); else fail();
    });
    worker.once('error', () => { clearTimeout(timer); void worker.terminate(); fail(); });
    worker.once('exit', () => { clearTimeout(timer); fail(); });
  });
}
