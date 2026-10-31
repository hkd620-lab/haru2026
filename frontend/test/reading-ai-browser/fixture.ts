import { buildReadingMetaCombined } from '../../src/app/types/haruTypes';
const seed = [
  { id: 'qa-old-note', date: '2026-10-01', formats: ['독서사유'], reading_book_title: '합성 기존 책', reading_author: '검증 저자', reading_book_text: '책임은 선택의 결과를 살피는 일이다.', reading_journal: '나는 선택의 책임을 생각했다.', reading_sayu: '기존 독서장', ...buildReadingMetaCombined({ bookTitle: '합성 기존 책', author: '검증 저자', entryType: 'chapter_note' }) },
  { id: 'qa-finished', date: '2026-10-02', formats: ['독서사유'], reading_book_title: '합성 마무리 책', reading_author: '검증 저자', reading_journal: '마무리한 기록', ...buildReadingMetaCombined({ bookTitle: '합성 마무리 책', author: '검증 저자', entryType: 'final_reflection' }) },
];
export const user = { uid: 'reading-qa-synthetic-user', displayName: '합성 검증 사용자', email: null, emailVerified: true };
export const state = {
  records: JSON.parse(localStorage.getItem('reading-qa-records') || 'null') || seed,
  calls: [] as any[], writes: [] as any[], fail: '', used: 0,
};
export const listeners = new Set<() => void>();
export const emit = () => listeners.forEach((listener) => listener());
export function saveRecord(fields: any) {
  if (state.fail === 'save') throw new Error('합성 저장 실패');
  const id = fields._recordId || `qa-final-${Date.now()}`;
  const data = { ...fields, id, date: fields._recordDate || '2026-10-06', formats: ['독서사유'] };
  state.records = state.records.filter((record: any) => record.id !== id).concat(data);
  state.writes.push(data);
  localStorage.setItem('reading-qa-records', JSON.stringify(state.records));
  emit();
}
