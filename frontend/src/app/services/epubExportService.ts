/**
 * HARU2026 EPUB 내보내기 — 프론트엔드 서비스
 */
import { getFunctions, httpsCallable } from 'firebase/functions';

interface EpubExportRequest {
  startDate: string;
  endDate: string;
  format?: string;
  // 합본 화면·PDF에 보인 기록 ID(순서 그대로). 있으면 서버는 이 기록만 같은 순서로 담는다.
  recordIds?: string[];
  filter?: 'all' | 'special';
  singleRecordId?: string;
}

interface EpubExportResponse {
  success: boolean;
  downloadUrl: string;
  fileName: string;
  count: number;
  skippedPhotos?: number;
  limitedPhotos?: number;
}

export async function exportRecordsToEpub(
  startDate: string,
  endDate: string,
  format?: string,
  recordIds?: string[],
  filter?: 'all' | 'special',
  singleRecordId?: string,
): Promise<{ count: number; fileName: string; downloadUrl: string; skippedPhotos: number; limitedPhotos: number }> {
  const functions = getFunctions(undefined, 'asia-northeast3');
  // 서버 exportEpub 제한(300초)에 맞춰 SDK 기본 70초보다 길게 기다린다(사진 확인·내려받기 시간 포함).
  const exportEpub = httpsCallable<EpubExportRequest, EpubExportResponse>(functions, 'exportEpub', { timeout: 310_000 });

  const result = await exportEpub({ startDate, endDate, ...(format ? { format } : {}), ...(singleRecordId ? { singleRecordId } : {}), ...(recordIds?.length ? { recordIds, ...(filter ? { filter } : {}) } : {}) });
  const { downloadUrl, fileName, count, skippedPhotos = 0, limitedPhotos = 0 } = result.data;

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return { count, fileName, downloadUrl, skippedPhotos, limitedPhotos };
}
