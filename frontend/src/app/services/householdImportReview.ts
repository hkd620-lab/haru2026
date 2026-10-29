import type { HouseholdEntry } from '../components/FormatModal';
import type { CardImportContext, CardImportReview } from './householdCardImport';

export function canSelectCardRow(review: CardImportReview | undefined) {
  return !review || review.state === 'ok' || (review.state === 'needsChoice' && review.cancelChoice === 'negative');
}
export function chooseCardCancellation(review: CardImportReview, choice: 'negative' | 'exclude') {
  if (review.state !== 'needsChoice') throw new Error('취소 확인 대상이 아닙니다.');
  return { ...review, cancelChoice: choice };
}
export function validateHouseholdImportSave(entries: HouseholdEntry[], context: CardImportContext | null, reviews: readonly CardImportReview[], selectedIds: readonly string[]) {
  const cards = entries.filter(entry => entry.importSource?.kind === 'card');
  const error = () => { throw new Error('카드 종류·취소 선택·금액을 다시 확인해 주세요. 저장하지 않았습니다.'); };
  if (!cards.length) { if (selectedIds.length) return error(); return; }
  if (!context?.confirmedApproval || !['신용카드', '체크카드'].includes(context.cardType)) return error();
  if (cards.length !== selectedIds.length || new Set(selectedIds).size !== selectedIds.length) return error();
  for (const entry of cards) {
    const review = reviews.find(row => row.entryId === entry.id);
    if (!review || !canSelectCardRow(review) || !selectedIds.includes(entry.id)) return error();
    const expected = review.state === 'needsChoice' ? String(-Math.abs(Number(review.expectedAmount))) : review.expectedAmount;
    if (entry.amount !== expected || entry.paymentMethod !== context.cardType || entry.memo !== '' || entry.transactionType !== '지출' || entry.importSource?.fileDigest !== context.fileDigest || entry.importSource.key !== entry.id) return error();
  }
}
export function isCardPaymentCandidate(entry: HouseholdEntry, already: boolean) {
  return !already && entry.importSource?.kind === 'kakao' && entry.transactionType === '지출' && /국민카드|KB카드/i.test(entry.vendor.replace(/\s/g, ''));
}
export function cardImportCounts(rows: readonly { selected: boolean; entry: HouseholdEntry }[], reviews: readonly CardImportReview[], alreadyIds: readonly string[]) {
  return {
    total: rows.length, selected: rows.filter(row => row.selected).length,
    blocked: reviews.filter(row => row.state === 'blocked').length,
    pending: reviews.filter(row => row.state === 'needsChoice' && !row.cancelChoice && !alreadyIds.includes(row.entryId)).length,
    already: rows.filter(row => alreadyIds.includes(row.entry.id)).length,
  };
}
export function cardImportCountLabel(counts: ReturnType<typeof cardImportCounts>) {
  return `읽은 전체 ${counts.total}건 · 저장 선택 ${counts.selected}건 · 외화 제외 ${counts.blocked}건 · 확인필요 ${counts.pending}건 · 이미 저장됨 ${counts.already}건`;
}
export function cardImportCompletion(counts: ReturnType<typeof cardImportCounts>) {
  return `${cardImportCountLabel(counts)}. 직접 입력 필요 ${counts.blocked}건·확인필요 ${counts.pending}건은 저장되지 않았습니다.`;
}
