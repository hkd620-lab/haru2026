import { useRef } from 'react';
export const db = {};
export const doc = (_db: unknown, ...parts: string[]) => ({ path: parts.join('/'), id: 'fixture-id' });
export const collection = doc;
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const getDocs = async () => ({ docs: [] });
export const query = (reference: unknown) => reference;
export const where = () => ({});
export const setDoc = async () => { throw new Error('QA: direct write forbidden'); };
export const arrayUnion = (...values: unknown[]) => values;
export const serverTimestamp = () => 'fixture-timestamp';
export const useSubscription = () => ({ subscription: { status: 'active', plan: 'basic' } });
export const useHaruLaw = () => ({ lawSaveRef: useRef(false), setLawGuideConfirmed() {} });
export function HaruLawPanel() { return null; }
export function DiaryLearnModal() { return null; }
export function RecordTitleAnimation() { return null; }
// 형식 편집창 자체는 기존 별도 검증 범위. 실제 RecordPage의 초안 수신·저장 처리를 확인한다.
export function FormatModal({ isOpen, format, initialData, onSave, onClose }: any) {
  if (!isOpen) return null;
  return <section role="dialog" aria-label="형식 편집창 수신 검증" style={{ position: 'fixed', inset: 20, zIndex: 100, overflow: 'auto', background: 'white', border: '1px solid', padding: 20 }}>
    <h2>{format} 편집창</h2><output>{JSON.stringify(initialData || {})}</output>
    <button onClick={onClose}>편집창 닫기</button>
    <button onClick={async () => { await onSave(initialData); onClose(); }}>합성 기록 저장</button>
  </section>;
}
