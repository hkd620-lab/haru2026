import { getDocuments, getLegalCases } from './legalCasesService';
import type { LegalCase, LegalDocument } from '../types/legalCaseTypes';

export type LegalTodayTaskType =
  | 'delivery-check'
  | 'due-soon'
  | 'due-overdue'
  | 'action-required'
  | 'checklist-incomplete';

export type LegalTodayTask = {
  id: string;
  type: LegalTodayTaskType;
  caseId: string;
  caseTitle: string;
  documentId?: string;
  title: string;
  message: string;
  dueDateByUserInput?: string;
  dueLabel?: string;
  tab: 'info' | 'checklist' | 'delivery' | 'deadline';
  priority: number;
};

export type UserInputDueMeta = {
  diffDays: number;
  label: string;
  isWithinThreeDays: boolean;
  isOverdue: boolean;
};

export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function getUserInputDueMeta(dateValue?: string, todayValue = getTodayDateString()): UserInputDueMeta | null {
  if (!dateValue) return null;
  const due = new Date(`${dateValue}T00:00:00`);
  const today = new Date(`${todayValue}T00:00:00`);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (Number.isNaN(diffDays)) return null;

  if (diffDays > 0) {
    return {
      diffDays,
      label: `입력된 기한까지 D-${diffDays}`,
      isWithinThreeDays: diffDays <= 3,
      isOverdue: false,
    };
  }

  if (diffDays === 0) {
    return {
      diffDays,
      label: '입력된 기한 당일입니다',
      isWithinThreeDays: true,
      isOverdue: false,
    };
  }

  return {
    diffDays,
    label: '입력된 기한이 지났습니다 (기한 직접 확인 필요)',
    isWithinThreeDays: true,
    isOverdue: true,
  };
}

export function getUserInputDueLabel(dateValue?: string) {
  return getUserInputDueMeta(dateValue)?.label || '기한 미입력';
}

export function isUrgentUserInputDue(dateValue?: string) {
  return Boolean(getUserInputDueMeta(dateValue)?.isWithinThreeDays);
}

function isActiveCase(item: LegalCase) {
  return item.status !== '종결' && item.status !== '보류';
}

function hasIncompleteSubmitChecklist(item: LegalCase) {
  return Object.values(item.checklistSubmit || {}).some((value) => value === false);
}

function buildDocumentTasks(legalCase: LegalCase, documents: LegalDocument[]): LegalTodayTask[] {
  return documents.flatMap((documentItem) => {
    const tasks: LegalTodayTask[] = [];
    const dueMeta = getUserInputDueMeta(documentItem.dueDateByUserInput);

    if (dueMeta && !documentItem.isCompleted && dueMeta.isWithinThreeDays) {
      tasks.push({
        id: `${legalCase.id}:${documentItem.id}:${dueMeta.isOverdue ? 'due-overdue' : 'due-soon'}`,
        type: dueMeta.isOverdue ? 'due-overdue' : 'due-soon',
        caseId: legalCase.id,
        caseTitle: legalCase.title,
        documentId: documentItem.id,
        title: dueMeta.isOverdue ? '사용자가 입력한 기한 경과' : '사용자가 입력한 기한 확인',
        message: dueMeta.isOverdue
          ? '입력된 기한이 지났습니다. 기한을 직접 다시 확인하세요.'
          : `${documentItem.title} 대응 일정을 확인하세요.`,
        dueDateByUserInput: documentItem.dueDateByUserInput,
        dueLabel: dueMeta.label,
        tab: 'deadline',
        priority: dueMeta.isOverdue ? 10 : 20 + Math.max(dueMeta.diffDays, 0),
      });
    }

    if (documentItem.requiresAction && !documentItem.isCompleted) {
      tasks.push({
        id: `${legalCase.id}:${documentItem.id}:action-required`,
        type: 'action-required',
        caseId: legalCase.id,
        caseTitle: legalCase.title,
        documentId: documentItem.id,
        title: '대응 미완료',
        message: `${documentItem.title} 대응 확인이 필요합니다.`,
        dueDateByUserInput: documentItem.dueDateByUserInput,
        dueLabel: dueMeta?.label,
        tab: 'deadline',
        priority: 30,
      });
    }

    return tasks;
  });
}

export async function getLegalTodayTasks(uid: string): Promise<LegalTodayTask[]> {
  const cases = await getLegalCases(uid);
  const today = getTodayDateString();
  const tasksByCase = await Promise.all(
    cases.map(async (item) => {
      const tasks: LegalTodayTask[] = [];

      if (isActiveCase(item) && item.lastCheckedAt !== today) {
        tasks.push({
          id: `${item.id}:delivery-check`,
          type: 'delivery-check',
          caseId: item.id,
          caseTitle: item.title,
          title: '법원 문서 확인 기록 필요',
          message: '오늘 법원 문서 확인 기록이 없습니다.',
          tab: 'delivery',
          priority: 40,
        });
      }

      if (item.status === '제출완료' && hasIncompleteSubmitChecklist(item)) {
        tasks.push({
          id: `${item.id}:checklist-incomplete`,
          type: 'checklist-incomplete',
          caseId: item.id,
          caseTitle: item.title,
          title: '제출 후 체크리스트 미완료',
          message: '제출 후 확인 항목 중 아직 완료되지 않은 내용이 있습니다.',
          tab: 'checklist',
          priority: 50,
        });
      }

      if (!isActiveCase(item)) return tasks;

      const documents = await getDocuments(uid, item.id);
      return [...tasks, ...buildDocumentTasks(item, documents)];
    }),
  );

  return tasksByCase
    .flat()
    .sort((a, b) => a.priority - b.priority || a.caseTitle.localeCompare(b.caseTitle, 'ko'));
}
