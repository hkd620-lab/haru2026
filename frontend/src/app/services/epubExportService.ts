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
  base64: string;
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
  const { base64, fileName, count } = result.data;

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/epub+zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { count, fileName };
}
