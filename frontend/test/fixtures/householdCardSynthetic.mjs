import * as XLSX from 'xlsx';
export const cardOptions = { confirmedApproval: true, cardType: '신용카드' };
export const cardHeader = ['이용일자', '가맹점명', '이용금액', '상태', '할부개월', '통화', '승인번호', '이용카드'];
export const cardRow = (overrides = {}) => Object.assign(['2026-10-05', '합성 카페', 4500, '승인', '일시불', '', 'SYNTHETIC-APPROVAL-ONLY', 'SYNTHETIC-CARD-4828'], overrides);
export function cardWorkbook(rows = [cardRow()], header = cardHeader) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), '합성내역');
  return wb;
}
export function cardBytes(wb = cardWorkbook(), bookType = 'xlsx') { return new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType })); }
