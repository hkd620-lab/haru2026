/**
 * HARU2026 EPUB 내보내기 — 프론트엔드 서비스
 */
import { getFunctions, httpsCallable } from 'firebase/functions';

interface EpubExportRequest {
  startDate: string;
  endDate: string;
}

interface EpubExportResponse {
  success: boolean;
  downloadUrl: string;
  fileName: string;
  count: number;
}

export async function exportRecordsToEpub(
  startDate: string,
  endDate: string,
): Promise<{ count: number; fileName: string }> {
  const functions = getFunctions(undefined, 'asia-northeast3');
  const exportEpub = httpsCallable<EpubExportRequest, EpubExportResponse>(functions, 'exportEpub');

  const result = await exportEpub({ startDate, endDate });
  const { downloadUrl, fileName, count } = result.data;

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return { count, fileName };
}
