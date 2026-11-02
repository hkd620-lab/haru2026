export function isStockOcrQuotaExceeded(error: unknown): boolean {
  return (error as { details?: { reason?: string } } | null)?.details?.reason === 'MONTHLY_STOCK_OCR_QUOTA_EXCEEDED';
}

export const STOCK_OCR_QUOTA_NOTICE = '주식 사진 추출은 월 무료 20장·베이직 100장·프리미엄 300장입니다. 독서 OCR·일반 AI와 별도로 집계하며 실패한 요청은 차감하지 않습니다. 직접 입력·저장은 계속 이용할 수 있습니다.';
