import { parentPort, workerData } from 'worker_threads';
import { extractHaruLawDocumentText } from './haruLawDocumentCore';
if (parentPort) {
  extractHaruLawDocumentText(workerData.mimeType, Buffer.from(workerData.bytes))
    .then(text => parentPort!.postMessage({ text }))
    .catch(() => parentPort!.postMessage({ error: 'ATTACHMENT_CONTENT_UNREADABLE' }));
}
