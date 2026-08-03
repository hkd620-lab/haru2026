import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Edit3, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { LegalCaseProgressMap } from '../components/LegalCaseProgressMap';
import { LegalTermHelp } from '../components/LegalTermHelp';
import { useAuth } from '../contexts/AuthContext';
import {
  addDocument,
  deleteDocument,
  getDocuments,
  getLegalCase,
  updateDocument,
  updateLastCheckedAt,
  updateLegalCase,
  updateSubmitChecklist,
} from '../services/legalCasesService';
import { getUserInputDueLabel, isUrgentUserInputDue } from '../services/legalTodayService';
import {
  type ActionStatus,
  type LegalCase,
  type LegalCaseStatus,
  type LegalDocument,
  type LegalDocumentType,
  type SubmitChecklist,
} from '../types/legalCaseTypes';

type DetailTab = 'info' | 'checklist' | 'delivery' | 'deadline';

type DocumentFormState = {
  title: string;
  documentType: LegalDocumentType;
  receivedAt: string;
  dueDateByUserInput: string;
  requiresAction: boolean;
  actionStatus: ActionStatus;
  actionMemo: string;
  isCompleted: boolean;
  completedAt: string;
};

const checklistRows: Array<{ key: keyof SubmitChecklist; label: string }> = [
  { key: 'confirmedSubmitScreen', label: '제출 완료 화면 확인' },
  { key: 'savedReceipt', label: '접수증 또는 제출내역 저장' },
  { key: 'checkedCaseNumber', label: '사건번호 부여 확인' },
  { key: 'confirmedFeePayment', label: '인지대·송달료 납부 상태 확인' },
  { key: 'savedFinalPdf', label: '제출서류 PDF 최종본 보관' },
  { key: 'checkedAttachments', label: '첨부증거 누락 여부 확인' },
  { key: 'confirmedMyCaseList', label: '나의 사건현황 등록 확인' },
];

const emptyDocumentForm: DocumentFormState = {
  title: '',
  documentType: '보정명령',
  receivedAt: '',
  dueDateByUserInput: '',
  requiresAction: false,
  actionStatus: '확인전',
  actionMemo: '',
  isCompleted: false,
  completedAt: '',
};

const LEGAL_CASE_STATUSES: LegalCaseStatus[] = [
  '제출준비',
  '제출완료',
  '송달확인중',
  '보정필요',
  '추가서류필요',
  '종결',
  '보류',
];

const LEGAL_DOCUMENT_TYPES: LegalDocumentType[] = [
  '보정명령',
  '변론기일통지서',
  '답변서',
  '준비서면',
  '송달통지',
  '지급명령',
  '결정문',
  '기일통지서',
  '이행권고결정',
  '준비명령',
  '판결문',
  '기타',
];

const DELIVERY_EXAMPLES = [
  {
    title: '소장 부본',
    body: '상대방이 법원에 제출한 소장의 복사본을 법원에서 받은 경우',
  },
  {
    title: '보정명령',
    body: '제출한 서류의 부족한 부분을 고치거나 추가하라는 법원 문서를 받은 경우',
  },
  {
    title: '기일통지서',
    body: '재판·변론·심문 날짜와 시간을 알리는 법원 문서를 받은 경우',
  },
  {
    title: '출석요구서',
    body: '법원이 정한 날짜에 출석하도록 알리는 문서를 받은 경우',
  },
  {
    title: '준비명령',
    body: '주장이나 자료를 준비하도록 알리는 법원 문서를 받은 경우',
  },
  {
    title: '결정문·판결문',
    body: '신청이나 재판에 관한 법원의 판단 문서를 받은 경우',
  },
];

const NON_DELIVERY_EXAMPLES = [
  '내가 법원에 제출한 소장',
  '내가 제출한 보정서',
  '내가 제출한 준비서면',
  '내가 제출한 증거자료',
  '법원에 전화한 내용을 적은 개인 메모',
  '내가 임의로 계산한 날짜',
  '아직 제출하지 않은 서류 초안',
];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function statusClassName(status: LegalCaseStatus) {
  switch (status) {
    case '제출준비':
      return 'border-purple-200 bg-purple-50 text-purple-700';
    case '제출완료':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case '송달확인중':
      return 'border-yellow-200 bg-yellow-50 text-yellow-800';
    case '보정필요':
      return 'border-red-200 bg-red-50 text-red-700';
    case '추가서류필요':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case '종결':
      return 'border-gray-200 bg-gray-100 text-gray-700';
    case '보류':
      return 'border-gray-100 bg-gray-50 text-gray-500';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700';
  }
}

export default function LegalCaseDetailPage() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState<LegalCaseStatus>('제출완료');
  const [memoDraft, setMemoDraft] = useState('');
  const [deliveryFormOpen, setDeliveryFormOpen] = useState(false);
  const [deadlineFormOpen, setDeadlineFormOpen] = useState(false);
  const [showDeliveryExamples, setShowDeliveryExamples] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState<DocumentFormState>({
    ...emptyDocumentForm,
    documentType: '기일통지서',
  });
  const [deadlineForm, setDeadlineForm] = useState<DocumentFormState>({
    ...emptyDocumentForm,
    requiresAction: true,
  });
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [documentEditForm, setDocumentEditForm] = useState<DocumentFormState>(emptyDocumentForm);

  const checklistComplete = useMemo(() => {
    if (!legalCase) return false;
    return checklistRows.every((row) => legalCase.checklistSubmit?.[row.key]);
  }, [legalCase]);

  const deadlineDocuments = useMemo(
    () =>
      documents.filter(
        (item) =>
          item.requiresAction ||
          Boolean(item.dueDateByUserInput) ||
          item.documentType === '보정명령' ||
          item.documentType === '준비명령',
      ),
    [documents],
  );

  const loadDetail = async () => {
    if (!user?.uid || !caseId) return;
    setIsLoading(true);
    try {
      const [caseData, documentItems] = await Promise.all([
        getLegalCase(user.uid, caseId),
        getDocuments(user.uid, caseId),
      ]);
      if (!caseData) {
        toast.error('사건 정보를 찾지 못했습니다.');
        navigate('/legal-cases');
        return;
      }
      setLegalCase(caseData);
      setStatusDraft(caseData.status);
      setMemoDraft(caseData.memo || '');
      setDocuments(documentItems);
    } catch (error) {
      console.error('전자소송 사건 상세 로드 실패:', error);
      toast.error('사건 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (user?.uid && caseId) {
      loadDetail();
    }
  }, [user?.uid, caseId]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'info' || tab === 'checklist' || tab === 'delivery' || tab === 'deadline') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const selectTab = (tab: DetailTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const markCheckedToday = async () => {
    if (!user?.uid || !caseId) return;
    setIsSaving(true);
    try {
      const today = getToday();
      await updateLastCheckedAt(user.uid, caseId, today);
      setLegalCase((prev) => (prev ? { ...prev, lastCheckedAt: today } : prev));
      toast.success('오늘 법원 문서 확인 기록을 저장했습니다.');
    } catch (error) {
      console.error('송달확인일 업데이트 실패:', error);
      toast.error('송달확인일을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveStatus = async () => {
    if (!user?.uid || !caseId || !legalCase) return;
    setIsSaving(true);
    try {
      await updateLegalCase(user.uid, caseId, { status: statusDraft });
      setLegalCase({ ...legalCase, status: statusDraft });
      toast.success('상태를 변경했습니다.');
    } catch (error) {
      console.error('상태 변경 실패:', error);
      toast.error('상태를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveMemo = async () => {
    if (!user?.uid || !caseId || !legalCase) return;
    setIsSaving(true);
    try {
      const nextMemo = memoDraft.trim();
      await updateLegalCase(user.uid, caseId, { memo: nextMemo || undefined });
      setLegalCase({ ...legalCase, memo: nextMemo || undefined });
      toast.success('메모를 저장했습니다.');
    } catch (error) {
      console.error('메모 저장 실패:', error);
      toast.error('메모를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleChecklist = async (key: keyof SubmitChecklist, checked: boolean) => {
    if (!user?.uid || !caseId || !legalCase) return;
    const nextChecklist = { ...legalCase.checklistSubmit, [key]: checked };
    setLegalCase({ ...legalCase, checklistSubmit: nextChecklist });
    try {
      await updateSubmitChecklist(user.uid, caseId, { [key]: checked });
    } catch (error) {
      console.error('체크리스트 저장 실패:', error);
      setLegalCase(legalCase);
      toast.error('체크리스트를 저장하지 못했습니다.');
    }
  };

  const updateDeliveryForm = <K extends keyof DocumentFormState>(
    key: K,
    value: DocumentFormState[K],
  ) => {
    setDeliveryForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateDeadlineForm = <K extends keyof DocumentFormState>(
    key: K,
    value: DocumentFormState[K],
  ) => {
    setDeadlineForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateDocumentEditForm = <K extends keyof DocumentFormState>(
    key: K,
    value: DocumentFormState[K],
  ) => {
    setDocumentEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitDocument = async (
    event: FormEvent<HTMLFormElement>,
    form: DocumentFormState,
    close: () => void,
    reset: () => void,
  ) => {
    event.preventDefault();
    if (!user?.uid || !caseId) return;
    const title = form.title.trim();
    if (!title) {
      toast.error('문서명을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await addDocument(user.uid, caseId, {
        title,
        documentType: form.documentType,
        receivedAt: form.receivedAt || undefined,
        dueDateByUserInput: form.dueDateByUserInput || undefined,
        requiresAction: form.requiresAction,
        actionStatus: form.actionStatus,
        actionMemo: form.actionMemo.trim() || undefined,
        isCompleted: form.isCompleted,
        completedAt: form.completedAt || undefined,
      });
      toast.success('문서 기록을 추가했습니다.');
      reset();
      close();
      await loadDetail();
    } catch (error) {
      console.error('문서 기록 추가 실패:', error);
      toast.error('문서 기록을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDocumentComplete = async (documentItem: LegalDocument, checked: boolean) => {
    if (!user?.uid || !caseId) return;
    try {
      await updateDocument(user.uid, caseId, documentItem.id, {
        isCompleted: checked,
        actionStatus: checked ? '처리완료' : '검토중',
        completedAt: checked ? getToday() : undefined,
      });
      await loadDetail();
    } catch (error) {
      console.error('문서 처리상태 변경 실패:', error);
      toast.error('처리상태를 저장하지 못했습니다.');
    }
  };

  const startDocumentEdit = (documentItem: LegalDocument) => {
    setEditingDocumentId(documentItem.id);
    setDocumentEditForm({
      title: documentItem.title,
      documentType: documentItem.documentType,
      receivedAt: documentItem.receivedAt || '',
      dueDateByUserInput: documentItem.dueDateByUserInput || '',
      requiresAction: documentItem.requiresAction,
      actionStatus: documentItem.actionStatus,
      actionMemo: documentItem.actionMemo || '',
      isCompleted: documentItem.isCompleted,
      completedAt: documentItem.completedAt || '',
    });
  };

  const submitDocumentEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.uid || !caseId || !editingDocumentId) return;
    const title = documentEditForm.title.trim();
    if (!title) {
      toast.error('문서명을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await updateDocument(user.uid, caseId, editingDocumentId, {
        title,
        documentType: documentEditForm.documentType,
        receivedAt: documentEditForm.receivedAt || undefined,
        dueDateByUserInput: documentEditForm.dueDateByUserInput || undefined,
        requiresAction: documentEditForm.requiresAction,
        actionStatus: documentEditForm.actionStatus,
        actionMemo: documentEditForm.actionMemo.trim() || undefined,
        isCompleted: documentEditForm.isCompleted,
        completedAt: documentEditForm.completedAt || undefined,
      });
      toast.success('문서 기록을 수정했습니다.');
      setEditingDocumentId(null);
      setDocumentEditForm(emptyDocumentForm);
      await loadDetail();
    } catch (error) {
      console.error('문서 기록 수정 실패:', error);
      toast.error('문서 기록을 수정하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeDocument = async (documentItem: LegalDocument) => {
    if (!user?.uid || !caseId) return;
    const firstConfirm = window.confirm(`'${documentItem.title}' 문서 기록을 삭제하시겠습니까?`);
    if (!firstConfirm) return;

    setIsSaving(true);
    try {
      await deleteDocument(user.uid, caseId, documentItem.id);
      toast.success('문서 기록을 삭제했습니다.');
      if (editingDocumentId === documentItem.id) {
        setEditingDocumentId(null);
      }
      await loadDetail();
    } catch (error) {
      console.error('문서 기록 삭제 실패:', error);
      toast.error('문서 기록을 삭제하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#FEFBE8] px-4 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-center py-20 text-sm text-gray-500">
          <Loader2 className="mr-2 size-4 animate-spin" />
          전자소송 사건 정보를 불러오는 중입니다.
        </div>
      </div>
    );
  }

  if (!legalCase) return null;

  return (
    <div className="min-h-screen bg-[#FEFBE8] px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/legal-cases')} className="px-2">
            <ArrowLeft className="size-4" />
            목록
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-lg font-semibold text-gray-900">{legalCase.title}</h1>
            <p className="truncate text-xs text-gray-500">{legalCase.caseNumber}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadDetail}>
            <RefreshCw className="size-4" />
          </Button>
        </header>

        <LegalCaseProgressMap
          status={legalCase.status}
          lastCheckedAt={legalCase.lastCheckedAt}
          onMarkCheckedToday={markCheckedToday}
          isSaving={isSaving}
        />

        <nav className="grid grid-cols-4 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-sm">
          {[
            ['info', '사건정보'],
            ['checklist', '체크리스트'],
            ['delivery', '송달기록'],
            ['deadline', '보정·기한'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => selectTab(value as DetailTab)}
              className={`rounded-md px-2 py-2 font-medium ${
                activeTab === value ? 'bg-gray-900 text-white' : 'text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {activeTab === 'info' && (
          <section className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900">사건정보</h2>
                <Badge variant="outline" className={statusClassName(legalCase.status)}>
                  {legalCase.status}
                </Badge>
                {legalCase.practiceDraft && (
                  <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                    연습 기록
                  </Badge>
                )}
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">사건명</dt>
                  <dd className="font-medium text-gray-900">{legalCase.title}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">
                    <LegalTermHelp term="사건번호" />
                  </dt>
                  <dd className="font-medium text-gray-900">{legalCase.caseNumber}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">법원</dt>
                  <dd className="font-medium text-gray-900">{legalCase.courtName}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">사건유형</dt>
                  <dd className="font-medium text-gray-900">{legalCase.caseType}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">당사자 구분</dt>
                  <dd className="font-medium text-gray-900">{legalCase.partyRole}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">제출일</dt>
                  <dd className="font-medium text-gray-900">{legalCase.submittedAt}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">접수번호</dt>
                  <dd className="font-medium text-gray-900">{legalCase.receiptNumber || '미입력'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">마지막 송달확인일</dt>
                  <dd className="font-medium text-gray-900">{legalCase.lastCheckedAt || '기록 없음'}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">상태 변경</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as LegalCaseStatus)}
                  className="min-h-10 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                >
                  {LEGAL_CASE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <Button onClick={saveStatus} disabled={isSaving}>
                  상태 변경
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">송달확인</h3>
                  <p className="text-xs text-gray-500">마지막 확인일: {legalCase.lastCheckedAt || '기록 없음'}</p>
                </div>
                <Button onClick={markCheckedToday} disabled={isSaving}>
                  <CheckCircle2 className="size-4" />
                  오늘 확인했어요
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">메모</h3>
              <textarea
                value={memoDraft}
                onChange={(event) => setMemoDraft(event.target.value)}
                className="min-h-28 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                placeholder="사건 관련 메모를 입력하세요."
              />
              <div className="mt-2 flex justify-end">
                <Button onClick={saveMemo} disabled={isSaving}>
                  메모 저장
                </Button>
              </div>
            </div>

            <div className="rounded-md bg-gray-100 px-3 py-2 text-xs leading-5 text-gray-600">
              전자송달 문서는 정기적으로 확인해야 합니다.
              문서를 열람하지 않아도 법령상 일정 기간이 지나면 송달된 것으로 간주될 수 있습니다.
              정확한 효력과 기간은 전자소송포털, 법원 안내문, 관련 법령을 기준으로 확인해야 합니다.
            </div>
          </section>
        )}

        {activeTab === 'checklist' && (
          <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">제출 후 확인 체크리스트</h2>
              {checklistComplete && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  전체 완료
                </Badge>
              )}
            </div>
            {checklistComplete && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                제출 후 확인 체크리스트가 모두 완료되었습니다.
              </div>
            )}
            <div className="space-y-2">
              {checklistRows.map((row) => (
                <label
                  key={row.key}
                  className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(legalCase.checklistSubmit?.[row.key])}
                    onChange={(event) => toggleChecklist(row.key, event.target.checked)}
                    className="size-4"
                  />
                  {row.label}
                </label>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'delivery' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">
                <LegalTermHelp term="송달" />
                기록
              </h2>
              <Button size="sm" onClick={() => setDeliveryFormOpen(true)}>
                <Plus className="size-4" />
                새 기록 추가
              </Button>
            </div>

            <DeliveryGuide
              showMore={showDeliveryExamples}
              onToggleMore={() => setShowDeliveryExamples((prev) => !prev)}
            />

            {deliveryFormOpen && (
              <DocumentForm
                title="송달문서 기록"
                form={deliveryForm}
                setForm={updateDeliveryForm}
                onCancel={() => setDeliveryFormOpen(false)}
                onSubmit={(event) =>
                  submitDocument(
                    event,
                    deliveryForm,
                    () => setDeliveryFormOpen(false),
                    () => setDeliveryForm({ ...emptyDocumentForm, documentType: '기일통지서' }),
                  )
                }
                isSaving={isSaving}
                mode="delivery"
              />
            )}

            <DocumentList
              documents={documents}
              emptyText="아직 HARU에 기록한 법원 문서가 없습니다."
              onToggleComplete={toggleDocumentComplete}
              onEdit={startDocumentEdit}
              onDelete={removeDocument}
              editingDocumentId={editingDocumentId}
              editForm={documentEditForm}
              setEditForm={updateDocumentEditForm}
              onCancelEdit={() => setEditingDocumentId(null)}
              onSubmitEdit={submitDocumentEdit}
              isSaving={isSaving}
              showDue={false}
              mode="delivery"
            />

            <div className="rounded-md bg-gray-100 px-3 py-2 text-xs leading-5 text-gray-600">
              송달 효력 발생일과 간주송달 기간은 사건유형과 적용 법령에 따라 달라질 수 있습니다.
              비서는 이를 자동 확정하지 않습니다. 전자소송포털 안내와 법원 문서를 기준으로 확인하세요.
            </div>
          </section>
        )}

        {activeTab === 'deadline' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">
                <LegalTermHelp term="보정명령" />
                ·기한
              </h2>
              <Button size="sm" onClick={() => setDeadlineFormOpen(true)}>
                <Plus className="size-4" />
                새 기록 추가
              </Button>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <p className="font-semibold">송달기록과 보정·기한은 이렇게 구분합니다.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md bg-white px-3 py-2">
                  <p className="font-semibold">송달기록</p>
                  <p className="text-xs leading-5 text-blue-800">법원에서 받은 문서를 확인하고 남기는 곳입니다.</p>
                </div>
                <div className="rounded-md bg-white px-3 py-2">
                  <p className="font-semibold">보정·기한</p>
                  <p className="text-xs leading-5 text-blue-800">받은 문서 중에서 내가 준비하거나 처리해야 할 일을 관리하는 곳입니다.</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5">
                보정명령처럼 대응이 필요한 문서는 송달기록에도 남고, 보정·기한에서도 처리상태를 관리할 수 있습니다.
              </p>
            </div>

            {deadlineFormOpen && (
              <DocumentForm
                title="보정·기한 기록"
                form={deadlineForm}
                setForm={updateDeadlineForm}
                onCancel={() => setDeadlineFormOpen(false)}
                onSubmit={(event) =>
                  submitDocument(
                    event,
                    deadlineForm,
                    () => setDeadlineFormOpen(false),
                    () => setDeadlineForm({ ...emptyDocumentForm, requiresAction: true }),
                  )
                }
                isSaving={isSaving}
                mode="deadline"
              />
            )}

            <DocumentList
              documents={deadlineDocuments}
              emptyText="기록된 보정·기한 항목이 없습니다."
              onToggleComplete={toggleDocumentComplete}
              onEdit={startDocumentEdit}
              onDelete={removeDocument}
              editingDocumentId={editingDocumentId}
              editForm={documentEditForm}
              setEditForm={updateDocumentEditForm}
              onCancelEdit={() => setEditingDocumentId(null)}
              onSubmitEdit={submitDocumentEdit}
              isSaving={isSaving}
              showDue
              mode="deadline"
            />

            <div className="rounded-md bg-gray-100 px-3 py-2 text-xs leading-5 text-gray-600">
              기한은 사용자가 법원 문서를 확인한 뒤 직접 입력합니다.
              비서는 기한을 자동 확정하지 않습니다.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DeliveryGuide({ showMore, onToggleMore }: { showMore: boolean; onToggleMore: () => void }) {
  const visibleExamples = showMore ? DELIVERY_EXAMPLES : DELIVERY_EXAMPLES.slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <p className="font-semibold">송달기록이란?</p>
        <p className="mt-1">
          법원이 나에게 공식적으로 보낸 문서와, 그 문서를 언제 확인했는지 남기는 기록입니다.
        </p>
        <p className="mt-1 font-semibold">새 문서가 도착했는지는 전자소송포털에서 직접 확인해야 합니다.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">송달기록에 해당하는 예</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">예시입니다. 실제 사건 기록이 아닙니다.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onToggleMore}>
            {showMore ? '예시 접기' : '예시 더 보기'}
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {visibleExamples.map((item) => (
            <article key={item.title} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-sm font-semibold text-gray-900">
                {item.title === '보정명령' ? <LegalTermHelp term="보정명령" /> : item.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-600">{item.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">다음은 송달기록이 아닙니다</h3>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          법원에서 받은 것은 송달기록, 내가 법원에 낸 것은 제출기록으로 구분합니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {NON_DELIVERY_EXAMPLES.map((item) => (
            <span key={item} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentForm({
  title,
  form,
  setForm,
  onCancel,
  onSubmit,
  isSaving,
  mode,
}: {
  title: string;
  form: DocumentFormState;
  setForm: <K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  mode: 'delivery' | 'deadline';
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          닫기
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">문서명</span>
          <input
            value={form.title}
            onChange={(event) => setForm('title', event.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">문서 유형</span>
          <select
            value={form.documentType}
            onChange={(event) => setForm('documentType', event.target.value as LegalDocumentType)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
          >
            {LEGAL_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">수령·열람일</span>
          <input
            type="date"
            value={form.receivedAt}
            onChange={(event) => setForm('receivedAt', event.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">대응 기한</span>
          <input
            type="date"
            value={form.dueDateByUserInput}
            onChange={(event) => setForm('dueDateByUserInput', event.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
          />
          {mode === 'deadline' && (
            <span className="block text-xs leading-5 text-gray-500">
              기한은 사용자가 법원 문서를 확인한 뒤 직접 입력합니다. 비서는 기한을 자동 확정하지 않습니다.
            </span>
          )}
        </label>
      </div>
      <label className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={form.requiresAction}
          onChange={(event) => setForm('requiresAction', event.target.checked)}
          className="size-4"
        />
        대응 필요
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">처리 상태</span>
          <select
            value={form.actionStatus}
            onChange={(event) => setForm('actionStatus', event.target.value as ActionStatus)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
          >
            {(['확인전', '검토중', '처리완료', '해당없음'] as ActionStatus[]).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-gray-700">처리 완료일</span>
          <input
            type="date"
            value={form.completedAt}
            onChange={(event) => setForm('completedAt', event.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={form.isCompleted}
          onChange={(event) => setForm('isCompleted', event.target.checked)}
          className="size-4"
        />
        처리 완료
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-gray-700">{mode === 'deadline' ? '해야 할 내용 및 메모' : '메모'}</span>
        <textarea
          value={form.actionMemo}
          onChange={(event) => setForm('actionMemo', event.target.value)}
          className="min-h-24 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          저장
        </Button>
      </div>
    </form>
  );
}

function DocumentList({
  documents,
  emptyText,
  onToggleComplete,
  onEdit,
  onDelete,
  editingDocumentId,
  editForm,
  setEditForm,
  onCancelEdit,
  onSubmitEdit,
  isSaving,
  showDue,
  mode,
}: {
  documents: LegalDocument[];
  emptyText: string;
  onToggleComplete: (documentItem: LegalDocument, checked: boolean) => void;
  onEdit: (documentItem: LegalDocument) => void;
  onDelete: (documentItem: LegalDocument) => void;
  editingDocumentId: string | null;
  editForm: DocumentFormState;
  setEditForm: <K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  showDue: boolean;
  mode: 'delivery' | 'deadline';
}) {
  if (documents.length === 0) {
    if (mode === 'delivery') {
      return <DeliveryEmptyState emptyText={emptyText} />;
    }

    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((item) => {
        const urgent = showDue && isUrgentUserInputDue(item.dueDateByUserInput);
        return (
          <div key={item.id} className="space-y-2">
            <article
              className={`rounded-lg border bg-white p-4 shadow-sm ${
                urgent ? 'border-red-200' : 'border-gray-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {item.documentType} · 수령일 {item.receivedAt || '미입력'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {item.requiresAction && (
                    <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                      대응 필요
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      item.isCompleted
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                    }
                  >
                    {item.actionStatus}
                  </Badge>
                </div>
              </div>
              {showDue && (
                <p className={`mt-3 text-sm ${urgent ? 'font-semibold text-red-700' : 'text-gray-600'}`}>
                  {getUserInputDueLabel(item.dueDateByUserInput)}
                </p>
              )}
              {item.dueDateTextFromDocument && (
                <p className="mt-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
                  문서에 적힌 기한 원문: {item.dueDateTextFromDocument}
                </p>
              )}
              {item.requirements && item.requirements.length > 0 && (
                <div className="mt-3 rounded-md border border-orange-100 bg-orange-50 px-3 py-2">
                  <p className="text-xs font-semibold text-orange-800">법원이 요구한 사항</p>
                  <ul className="mt-1 space-y-1 text-xs leading-5 text-orange-900">
                    {item.requirements.map((requirement) => (
                      <li key={requirement}>- {requirement}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.preparationItems && item.preparationItems.length > 0 && (
                <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                  <p className="text-xs font-semibold text-blue-800">준비해야 할 자료</p>
                  <ul className="mt-1 space-y-1 text-xs leading-5 text-blue-900">
                    {item.preparationItems.map((preparationItem) => (
                      <li key={preparationItem}>- {preparationItem}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.actionMemo && <p className="mt-3 text-sm leading-6 text-gray-700">{item.actionMemo}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={(event) => onToggleComplete(item, event.target.checked)}
                    className="size-4"
                  />
                  처리 완료
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item)}>
                    <Edit3 className="size-4" />
                    수정
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(item)}>
                    <Trash2 className="size-4" />
                    삭제
                  </Button>
                </div>
              </div>
            </article>
            {editingDocumentId === item.id && (
              <DocumentForm
                title="문서 기록 수정"
                form={editForm}
                setForm={setEditForm}
                onCancel={onCancelEdit}
                onSubmit={onSubmitEdit}
                isSaving={isSaving}
                mode={mode}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DeliveryEmptyState({ emptyText }: { emptyText: string }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        <p>{emptyText}</p>
        <p className="mt-2 leading-6">
          법원에서 문서를 받았다면 문서명, 받은 날짜, 사용자가 직접 확인한 기한과 처리상태를 기록해 보세요.
        </p>
      </div>
      <article className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <p className="text-xs font-semibold text-blue-700">예시 · 실제 사건 기록이 아닙니다</p>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-blue-700">문서명</dt>
            <dd className="font-semibold">보정명령</dd>
          </div>
          <div>
            <dt className="text-xs text-blue-700">받은 날짜</dt>
            <dd className="font-semibold">2026년 8월 1일</dd>
          </div>
          <div>
            <dt className="text-xs text-blue-700">대응 필요</dt>
            <dd className="font-semibold">예</dd>
          </div>
          <div>
            <dt className="text-xs text-blue-700">확인할 내용</dt>
            <dd className="font-semibold">주소 관련 자료 보완</dd>
          </div>
          <div>
            <dt className="text-xs text-blue-700">사용자가 확인한 기한</dt>
            <dd className="font-semibold">2026년 8월 8일</dd>
          </div>
          <div>
            <dt className="text-xs text-blue-700">상태</dt>
            <dd className="font-semibold">준비 중</dd>
          </div>
        </dl>
      </article>
    </div>
  );
}
