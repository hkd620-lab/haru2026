import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import type { LegalCase, LegalDocument, LegalPracticeDraft, SubmitChecklist } from '../types/legalCaseTypes';

function legalCasesCollection(uid: string) {
  return collection(db, 'users', uid, 'legalCases');
}

function legalCaseDoc(uid: string, caseId: string) {
  return doc(db, 'users', uid, 'legalCases', caseId);
}

function documentsCollection(uid: string, caseId: string) {
  return collection(db, 'users', uid, 'legalCases', caseId, 'documents');
}

function legalDocumentDoc(uid: string, caseId: string, documentId: string) {
  return doc(db, 'users', uid, 'legalCases', caseId, 'documents', documentId);
}

export async function getLegalCases(uid: string): Promise<LegalCase[]> {
  const snapshot = await getDocs(query(legalCasesCollection(uid), orderBy('updatedAt', 'desc')));
  return snapshot.docs.map((caseDoc) => ({
    id: caseDoc.id,
    ...(caseDoc.data() as Omit<LegalCase, 'id'>),
  }));
}

export async function getLegalCase(uid: string, caseId: string): Promise<LegalCase | null> {
  const snapshot = await getDoc(legalCaseDoc(uid, caseId));
  if (!snapshot.exists()) return null;
  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<LegalCase, 'id'>),
  };
}

export async function createLegalCase(
  uid: string,
  data: Omit<LegalCase, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const result = await addDoc(legalCasesCollection(uid), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return result.id;
}

export async function updateLegalCase(
  uid: string,
  caseId: string,
  data: Partial<LegalCase>,
): Promise<void> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...safeData } = data;
  await updateDoc(legalCaseDoc(uid, caseId), {
    ...safeData,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteLegalCase(uid: string, caseId: string): Promise<void> {
  const documentsSnapshot = await getDocs(documentsCollection(uid, caseId));
  await Promise.all(documentsSnapshot.docs.map((documentDoc) => deleteDoc(documentDoc.ref)));
  await deleteDoc(legalCaseDoc(uid, caseId));
}

export async function updateSubmitChecklist(
  uid: string,
  caseId: string,
  checklist: Partial<SubmitChecklist>,
): Promise<void> {
  const updates = Object.entries(checklist).reduce<Record<string, boolean>>((acc, [key, value]) => {
    if (typeof value === 'boolean') {
      acc[`checklistSubmit.${key}`] = value;
    }
    return acc;
  }, {});

  await updateDoc(legalCaseDoc(uid, caseId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function updateLastCheckedAt(
  uid: string,
  caseId: string,
  date: string,
): Promise<void> {
  await updateDoc(legalCaseDoc(uid, caseId), {
    lastCheckedAt: date,
    updatedAt: serverTimestamp(),
  });
}

export async function getDocuments(uid: string, caseId: string): Promise<LegalDocument[]> {
  const snapshot = await getDocs(query(documentsCollection(uid, caseId), orderBy('updatedAt', 'desc')));
  return snapshot.docs.map((documentDoc) => ({
    id: documentDoc.id,
    caseId,
    ...(documentDoc.data() as Omit<LegalDocument, 'id' | 'caseId'>),
  }));
}

export async function addDocument(
  uid: string,
  caseId: string,
  data: Omit<LegalDocument, 'id' | 'caseId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const result = await addDoc(documentsCollection(uid, caseId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return result.id;
}

export async function updateDocument(
  uid: string,
  caseId: string,
  documentId: string,
  data: Partial<LegalDocument>,
): Promise<void> {
  const {
    id: _id,
    caseId: _caseId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...safeData
  } = data;

  await updateDoc(legalDocumentDoc(uid, caseId, documentId), {
    ...safeData,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(
  uid: string,
  caseId: string,
  documentId: string,
): Promise<void> {
  await deleteDoc(legalDocumentDoc(uid, caseId, documentId));
}

export { auth };

export async function createSampleLegalCase(uid: string): Promise<string> {
  const sampleMemo = `[간편연습 가이드]
□ 사건명과 사건유형을 확인했다
□ 청구금액을 확인했다
□ 증거자료 목록을 정리했다
□ 제출 전 미리보기를 확인했다
□ 전자서명 필요 여부를 확인했다
□ 인지대·송달료 납부 여부를 확인했다
□ 제출 후 접수증 저장 여부를 확인했다
□ 나의문서함 제출서류 확인 여부를 확인했다
□ 미확인 송달문서 확인 루틴을 만들었다

[증거 예시]
갑 제1호증: 계좌이체내역
갑 제2호증: 변제 약속 문자
갑 제3호증: 독촉 문자

주의: 이 사건번호와 내용은 전자소송 절차 연습을 위한 예시입니다. 실제 사건 제출 전에는 법원 문서와 전자소송포털 안내를 직접 확인하세요.`;

  return createLegalCase(uid, {
    title: '대여금 300만 원 지급명령 연습',
    caseType: '지급명령',
    claimAmount: 3000000,
    status: '제출준비',
    courtName: '연습용 법원',
    caseNumber: '2026차전00000',
    partyRole: '신청인/원고',
    submittedAt: '',
    memo: sampleMemo,
    checklistSubmit: {
      confirmedSubmitScreen: false,
      savedReceipt: false,
      checkedCaseNumber: false,
      confirmedFeePayment: false,
      savedFinalPdf: false,
      checkedAttachments: false,
      confirmedMyCaseList: false,
    },
  });
}

export async function createPracticeDraftLegalCase(
  uid: string,
  draft: Omit<LegalPracticeDraft, 'source' | 'savedAt'>,
): Promise<string> {
  const digits = draft.suitAmount.replace(/[^\d]/g, '');
  const claimAmount = digits ? Number(digits) : undefined;
  const title = draft.caseName.trim() || '전자소송 연습 기록';
  const savedAt = new Date().toISOString();

  return createLegalCase(uid, {
    title,
    caseType: '기타',
    claimAmount,
    status: '제출준비',
    courtName: '연습 기록',
    caseNumber: '연습 기록',
    partyRole: '신청인/원고',
    submittedAt: '',
    memo: '전자소송연습비서에서 저장한 연습 기록입니다. 실제 법원 제출 사건이 아닙니다.',
    checklistSubmit: {
      confirmedSubmitScreen: false,
      savedReceipt: false,
      checkedCaseNumber: false,
      confirmedFeePayment: false,
      savedFinalPdf: false,
      checkedAttachments: false,
      confirmedMyCaseList: false,
    },
    practiceDraft: {
      source: 'lawsuit-practice',
      savedAt,
      ...draft,
    },
  });
}
