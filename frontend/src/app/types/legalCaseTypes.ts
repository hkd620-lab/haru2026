import type { Timestamp } from 'firebase/firestore';

export interface LegalCase {
  id: string;
  title: string;
  caseNumber: string;
  courtName: string;
  caseType: LegalCaseType;
  partyRole: PartyRole;
  submittedAt: string;
  receiptNumber?: string;
  status: LegalCaseStatus;
  memo?: string;
  lastCheckedAt?: string;
  checklistSubmit: SubmitChecklist;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type LegalCaseType =
  | '지급명령'
  | '소액대여금'
  | '물품대금'
  | '임대차보증금'
  | '기타';

export type PartyRole = '신청인/원고' | '피신청인/피고';

export type LegalCaseStatus =
  | '제출완료'
  | '송달확인중'
  | '보정필요'
  | '추가서류필요'
  | '종결'
  | '보류';

export interface SubmitChecklist {
  confirmedSubmitScreen: boolean;
  savedReceipt: boolean;
  checkedCaseNumber: boolean;
  confirmedFeePayment: boolean;
  savedFinalPdf: boolean;
  checkedAttachments: boolean;
  confirmedMyCaseList: boolean;
}

export interface LegalDocument {
  id: string;
  caseId: string;
  title: string;
  documentType: LegalDocumentType;
  receivedAt?: string;
  dueDateByUserInput?: string;
  requiresAction: boolean;
  actionStatus: ActionStatus;
  actionMemo?: string;
  isCompleted: boolean;
  completedAt?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type LegalDocumentType =
  | '보정명령'
  | '결정문'
  | '기일통지서'
  | '이행권고결정'
  | '준비명령'
  | '판결문'
  | '기타';

export type ActionStatus = '확인전' | '검토중' | '처리완료' | '해당없음';
