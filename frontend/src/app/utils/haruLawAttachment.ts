import { readSelectedPhotoAttachments } from '../services/selectedRecordPhoto';

export const HARULAW_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
export const HARULAW_ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,.pdf,.hwp,.hwpx,.txt,.text';
export const HARULAW_ATTACHMENT_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
  'application/x-hwp', 'application/vnd.hancom.hwpx', 'text/plain',
]);

export function getHaruLawFileMime(file: Pick<File, 'name' | 'type'>): string {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const documentTypes: Record<string, string> = {
    pdf: 'application/pdf', hwp: 'application/x-hwp', hwpx: 'application/vnd.hancom.hwpx',
    txt: 'text/plain', text: 'text/plain',
  };
  return documentTypes[extension || ''] || file.type.toLowerCase();
}

export function getHaruLawAttachmentLabel(mimeType: string): string {
  return ({ 'application/pdf': 'PDF', 'application/x-hwp': 'HWP', 'application/vnd.hancom.hwpx': 'HWPX', 'text/plain': '텍스트' } as Record<string, string>)[mimeType] || '이미지';
}

// 사진은 기존 Android 선택기 snapshot 경로를 유지한다. 문서는 MIME이 비어도 확장자로 인식한다.
export async function readHaruLawSelectedFiles(sources: File[]): Promise<File[]> {
  const reads = sources.map(async source => {
    const mimeType = getHaruLawFileMime(source);
    if (['application/x-hwp', 'application/vnd.hancom.hwpx', 'text/plain'].includes(mimeType)) {
      if (source.size > HARULAW_DOCUMENT_MAX_BYTES) throw Object.assign(new Error('한글·텍스트 파일은 8MiB 이하로 첨부해 주세요.'), { name: 'HaruLawDocumentSizeError' });
      return new File([await source.arrayBuffer()], source.name, { type: mimeType });
    }
    if (mimeType === 'application/pdf' && source.type !== mimeType) {
      return new File([source], source.name, { type: mimeType });
    }
    const [file] = await readSelectedPhotoAttachments([source]);
    return file;
  });
  // 모든 선택기 읽기를 즉시 시작하고 실패한 뒤에도 나머지 rejection을 회수한다.
  const results = await Promise.allSettled(reads);
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  return results.map(result => (result as PromiseFulfilledResult<File>).value);
}
