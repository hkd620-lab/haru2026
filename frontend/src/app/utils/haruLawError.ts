export type HaruLawUserError = {
  reason: string;
  title: string;
  message: string;
  retryable: boolean;
  actionLabel?: string;
};

export const HARULAW_ATTACH_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const HARULAW_ATTACH_MAX_PDF_BYTES = 50_000_000;

const ERROR_MESSAGES: Record<string, HaruLawUserError> = {
  LAW_API_TEMPORARY_UNAVAILABLE: {
    reason: 'LAW_API_TEMPORARY_UNAVAILABLE',
    title: '공식 법령 서버에 잠시 연결할 수 없습니다',
    message: '질문과 첨부파일은 그대로 유지했습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
    actionLabel: '다시 시도',
  },
  ATTACHMENT_PDF_UNREADABLE: {
    reason: 'ATTACHMENT_PDF_UNREADABLE',
    title: '이 PDF를 읽을 수 없습니다',
    message: '파일이 손상되었거나 암호가 설정됐을 수 있습니다. 문제가 있는 첨부를 제거한 뒤 PDF를 다시 저장하거나 다른 파일을 첨부해 주세요.',
    retryable: false,
  },
  ATTACHMENT_TOTAL_SIZE_EXCEEDED: {
    reason: 'ATTACHMENT_TOTAL_SIZE_EXCEEDED',
    title: '첨부파일의 전체 크기가 너무 큽니다',
    message: '한 번에 첨부할 수 있는 파일의 전체 크기는 50MiB입니다. 파일 수나 크기를 줄인 뒤 다시 시도해 주세요.',
    retryable: false,
  },
  ATTACHMENT_UNSUPPORTED_TYPE: {
    reason: 'ATTACHMENT_UNSUPPORTED_TYPE',
    title: '지원하지 않는 파일 형식입니다',
    message: 'PNG, JPEG, WebP, HEIC 또는 PDF 파일로 다시 첨부해 주세요.',
    retryable: false,
  },
  ATTACHMENT_CONTENT_UNREADABLE: {
    reason: 'ATTACHMENT_CONTENT_UNREADABLE',
    title: '파일에서 내용을 읽지 못했습니다',
    message: '스캔 상태가 흐리거나 내용이 없는 파일일 수 있습니다. 더 선명한 파일을 첨부하거나 질문에 핵심 내용을 직접 입력해 주세요.',
    retryable: false,
  },
  HARULAW_AI_TEMPORARY_UNAVAILABLE: {
    reason: 'HARULAW_AI_TEMPORARY_UNAVAILABLE',
    title: 'AI 분석이 잠시 원활하지 않습니다',
    message: '질문과 첨부파일은 그대로 유지했습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
    actionLabel: '다시 시도',
  },
  HARULAW_PROCESSING_FAILED: {
    reason: 'HARULAW_PROCESSING_FAILED',
    title: '하루LAW 처리를 완료하지 못했습니다',
    message: '질문과 첨부파일은 그대로 유지했습니다. 잠시 후 다시 시도해 주세요. 같은 문제가 계속되면 첨부파일을 제거한 뒤 다시 확인해 주세요.',
    retryable: true,
    actionLabel: '다시 시도',
  },
};

function readReason(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const candidate = error as {
    details?: unknown;
    customData?: { details?: unknown };
  };
  const details = candidate.details ?? candidate.customData?.details;
  if (!details || typeof details !== 'object') return '';
  const reason = (details as { reason?: unknown }).reason;
  return typeof reason === 'string' ? reason : '';
}

export function getHaruLawUserErrorByReason(reason: string): HaruLawUserError {
  return ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.HARULAW_PROCESSING_FAILED;
}

export function getHaruLawUserError(error: unknown): HaruLawUserError {
  return getHaruLawUserErrorByReason(readReason(error));
}

export function getHaruLawPdfReadErrorName(error: unknown): string {
  if (!error || typeof error !== 'object') return 'UnknownError';
  try {
    const name = (error as { name?: unknown }).name;
    switch (name) {
      case 'NotReadableError':
      case 'SecurityError':
      case 'AbortError':
      case 'InvalidStateError':
      case 'TypeError':
        return name;
      default:
        return 'UnknownError';
    }
  } catch {
    return 'UnknownError';
  }
}

export function hasReadableHaruLawPdfHeader(bytes: Uint8Array): boolean {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return bytes.length >= 8 && signature.every((value, index) => bytes[index] === value);
}
