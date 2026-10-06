import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../../firebase';

export type OriginalAssistantKind = 'pet' | 'legal';
export type OriginalAssistantRecord = { id: string; title: string; fields: { label: string; value: string }[]; origin: string };
const valueText = (value: unknown): string => typeof value === 'string' ? value
  : Array.isArray(value) ? value.filter(item => typeof item === 'string').join('\n') : '';

export function mapOriginalAssistantRecord(id: string, data: Record<string, any>, kind: OriginalAssistantKind): OriginalAssistantRecord {
  const fields: OriginalAssistantRecord['fields'] = [];
  const add = (label: string, value: unknown) => { const text = valueText(value); if (text) fields.push({ label, value: text }); };
  if (kind === 'legal') {
    add('사건번호', data.caseNumber); add('법원', data.courtName); add('사건유형', data.caseType);
    add('현재 상태', data.status); add('제출일', data.submittedAt); add('최근 확인일', data.lastCheckedAt); add('메모', data.memo);
    return { id, title: valueText(data.title) || '사건 기록', fields, origin: `/legal-cases/${encodeURIComponent(id)}` };
  }
  add('반려동물', data.petName); add('확인일', data.checkedAt); add('입력 내용', data.query);
  add('저장된 위험도', data.riskLevel); add('저장된 안내', data.answer);
  return { id, title: valueText(data.petName) || '반려동물 기록', fields, origin: '/pet-health' };
}

export async function loadOriginalAssistantRecords(uid: string, kind: OriginalAssistantKind): Promise<OriginalAssistantRecord[]> {
  if (!uid || uid.includes('/') || auth.currentUser?.uid !== uid) throw new Error('로그인 계정을 확인해 주세요.');
  if (kind !== 'pet' && kind !== 'legal') throw new Error('지원하지 않는 기록 형식입니다.');
  const path = kind === 'pet' ? 'petHealthLogs' : 'legalCases';
  const field = kind === 'pet' ? 'createdAt' : 'updatedAt';
  const snapshot = await getDocs(query(collection(db, 'users', uid, path), orderBy(field, 'desc'), limit(20)));
  if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다.');
  return snapshot.docs.map(document => mapOriginalAssistantRecord(document.id, document.data(), kind));
}
