// 보조장부의 기존 증빙 한도는 유지한다. 구독 등급과 관계없이 적용한다.
export function getRecordPhotoLimit(format?: string): number {
  return format === 'HARU보조장부' || format === 'ledger' ? 10 : 5;
}
