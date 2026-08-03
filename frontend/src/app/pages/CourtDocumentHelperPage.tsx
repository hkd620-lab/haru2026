import { FormEvent, type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { addDocument, getLegalCases } from '../services/legalCasesService';
import type { LegalCase, LegalDocumentType } from '../types/legalCaseTypes';

type DocumentHelperForm = {
  caseId: string;
  documentType: LegalDocumentType;
  courtName: string;
  caseNumber: string;
  documentWrittenAt: string;
  receivedAtByUserInput: string;
  dueDateTextFromDocument: string;
  dueDateByUserInput: string;
  userConfirmedDueDate: boolean;
  userMemo: string;
};

const DOCUMENT_TYPES: LegalDocumentType[] = [
  '보정명령',
  '변론기일통지서',
  '답변서',
  '준비서면',
  '송달통지',
  '판결문',
  '결정문',
  '지급명령',
  '이행권고결정',
  '기타',
];

const initialForm: DocumentHelperForm = {
  caseId: '',
  documentType: '보정명령',
  courtName: '',
  caseNumber: '',
  documentWrittenAt: '',
  receivedAtByUserInput: '',
  dueDateTextFromDocument: '',
  dueDateByUserInput: '',
  userConfirmedDueDate: false,
  userMemo: '',
};

function compactList(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function buildActionMemo({
  dueDateTextFromDocument,
  requirements,
  preparationItems,
  userMemo,
}: {
  dueDateTextFromDocument: string;
  requirements: string[];
  preparationItems: string[];
  userMemo: string;
}) {
  const sections: string[] = [];
  if (dueDateTextFromDocument.trim()) {
    sections.push(`[문서에 적힌 기한 원문]\n${dueDateTextFromDocument.trim()}`);
  }
  if (requirements.length > 0) {
    sections.push(`[법원이 요구한 사항]\n${requirements.map((item) => `- ${item}`).join('\n')}`);
  }
  if (preparationItems.length > 0) {
    sections.push(`[준비해야 할 자료]\n${preparationItems.map((item) => `- ${item}`).join('\n')}`);
  }
  if (userMemo.trim()) {
    sections.push(`[사용자 메모]\n${userMemo.trim()}`);
  }
  return sections.join('\n\n') || undefined;
}

export default function CourtDocumentHelperPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [form, setForm] = useState<DocumentHelperForm>(initialForm);
  const [requirements, setRequirements] = useState<string[]>(['']);
  const [preparationItems, setPreparationItems] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === form.caseId) || null,
    [cases, form.caseId],
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user?.uid) return;
    setIsLoading(true);
    getLegalCases(user.uid)
      .then((items) => {
        setCases(items);
        if (items.length > 0) {
          const first = items[0];
          setForm((prev) => ({
            ...prev,
            caseId: prev.caseId || first.id,
            courtName: prev.courtName || first.courtName || '',
            caseNumber: prev.caseNumber || first.caseNumber || '',
          }));
        }
      })
      .catch((error) => {
        console.error('전자소송 사건 목록 로드 실패:', error);
        toast.error('사건 목록을 불러오지 못했습니다.');
      })
      .finally(() => setIsLoading(false));
  }, [user?.uid]);

  const updateForm = <K extends keyof DocumentHelperForm>(key: K, value: DocumentHelperForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectCase = (caseId: string) => {
    const nextCase = cases.find((item) => item.id === caseId);
    setForm((prev) => ({
      ...prev,
      caseId,
      courtName: prev.courtName || nextCase?.courtName || '',
      caseNumber: prev.caseNumber || nextCase?.caseNumber || '',
    }));
  };

  const updateListItem = (
    setter: Dispatch<SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => {
    setter((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const addListItem = (setter: Dispatch<SetStateAction<string[]>>) => {
    setter((prev) => [...prev, '']);
  };

  const removeListItem = (setter: Dispatch<SetStateAction<string[]>>, index: number) => {
    setter((prev) => (prev.length <= 1 ? [''] : prev.filter((_, itemIndex) => itemIndex !== index)));
  };

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!form.caseId) {
      toast.error('문서를 연결할 사건을 선택해 주세요.');
      return;
    }
    if (form.dueDateByUserInput && !form.userConfirmedDueDate) {
      toast.error('제출기한을 직접 확인했다는 항목을 체크해 주세요.');
      return;
    }

    const cleanRequirements = compactList(requirements);
    const cleanPreparationItems = compactList(preparationItems);
    const title = form.documentWrittenAt
      ? `${form.documentType} (${form.documentWrittenAt})`
      : form.documentType;
    const actionMemo = buildActionMemo({
      dueDateTextFromDocument: form.dueDateTextFromDocument,
      requirements: cleanRequirements,
      preparationItems: cleanPreparationItems,
      userMemo: form.userMemo,
    });
    const hasAction = cleanRequirements.length > 0 || Boolean(form.dueDateByUserInput);
    const targetTab =
      hasAction || form.documentType === '보정명령' || form.documentType === '준비명령'
        ? 'deadline'
        : 'delivery';
    const documentData: Omit<LegalDocument, 'id' | 'caseId' | 'createdAt' | 'updatedAt'> = {
      title,
      documentType: form.documentType,
      userConfirmedDueDate: form.userConfirmedDueDate,
      requirements: cleanRequirements,
      preparationItems: cleanPreparationItems,
      requiresAction: hasAction,
      actionStatus: '확인전',
      isCompleted: false,
      ...(form.courtName.trim() && { courtName: form.courtName.trim() }),
      ...(form.caseNumber.trim() && { caseNumber: form.caseNumber.trim() }),
      ...(form.documentWrittenAt && { documentWrittenAt: form.documentWrittenAt }),
      ...(form.receivedAtByUserInput && {
        receivedAt: form.receivedAtByUserInput,
        receivedAtByUserInput: form.receivedAtByUserInput,
      }),
      ...(form.dueDateTextFromDocument.trim() && {
        dueDateTextFromDocument: form.dueDateTextFromDocument.trim(),
      }),
      ...(form.dueDateByUserInput && { dueDateByUserInput: form.dueDateByUserInput }),
      ...(actionMemo && { actionMemo }),
    };

    setIsSaving(true);
    try {
      await addDocument(user.uid, form.caseId, documentData);
      toast.success('법원 문서를 사건에 연결했습니다.');
      navigate(`/legal-cases/${form.caseId}?tab=${targetTab}`);
    } catch (error) {
      console.error('법원 문서 저장 실패:', error);
      toast.error('법원 문서를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <main className="min-h-screen bg-[#FEFBE8] px-4 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-center py-20 text-sm text-gray-500">
          <Loader2 className="mr-2 size-4 animate-spin" />
          법원 문서 도우미를 준비하는 중입니다.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FEFBE8] px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/legal-assistant')} className="px-2">
            <ArrowLeft className="size-4" />
            비서 홈
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-lg font-semibold text-gray-900">법원 문서 도우미</h1>
            <p className="truncate text-xs text-gray-500">원문 확인 · 요구사항 정리 · 사건 연결</p>
          </div>
          <span />
        </header>

        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
          <p className="font-semibold">HARU는 법원의 제출기한이나 요구사항을 법적으로 확정하지 않습니다.</p>
          <p className="mt-1">
            문서 원문과 전자소송 송달내역을 반드시 직접 확인한 뒤, 관리용 제출기한을 사용자가 직접 입력하세요.
          </p>
        </section>

        {cases.length === 0 ? (
          <section className="rounded-lg border border-gray-200 bg-white p-5 text-center shadow-sm">
            <FileText className="mx-auto mb-3 size-8 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">문서를 연결할 사건이 없습니다.</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              이번 MVP에서는 임시 문서 저장 구조를 만들지 않습니다. 사건을 먼저 등록한 뒤 법원 문서를 연결해 주세요.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => navigate('/legal-cases')}>
                사건을 먼저 등록
              </Button>
              <Button variant="outline" onClick={() => navigate('/legal-assistant')}>
                사건 연결 없이 입력 중단
              </Button>
            </div>
          </section>
        ) : (
          <form onSubmit={submitDocument} className="space-y-4">
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">문서에서 확인한 정보</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-gray-700">연결할 사건</span>
                  <select
                    value={form.caseId}
                    onChange={(event) => selectCase(event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                    required
                  >
                    {cases.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · {item.caseNumber || '사건번호 미입력'}
                      </option>
                    ))}
                  </select>
                  {selectedCase && (
                    <span className="block text-xs leading-5 text-gray-500">
                      선택한 사건: {selectedCase.courtName || '법원 미입력'} · {selectedCase.status}
                    </span>
                  )}
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-gray-700">문서 종류</span>
                  <select
                    value={form.documentType}
                    onChange={(event) => updateForm('documentType', event.target.value as LegalDocumentType)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                    required
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-gray-700">법원명</span>
                  <input
                    value={form.courtName}
                    onChange={(event) => updateForm('courtName', event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                    placeholder="문서에 적힌 법원명"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-gray-700">사건번호</span>
                  <input
                    value={form.caseNumber}
                    onChange={(event) => updateForm('caseNumber', event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                    placeholder="문서에 적힌 그대로 입력"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-gray-700">문서 작성일</span>
                  <input
                    type="date"
                    value={form.documentWrittenAt}
                    onChange={(event) => updateForm('documentWrittenAt', event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-gray-700">실제 송달받은 날짜</span>
                  <input
                    type="date"
                    value={form.receivedAtByUserInput}
                    onChange={(event) => updateForm('receivedAtByUserInput', event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>

                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-gray-700">문서에 적힌 기한 원문</span>
                  <textarea
                    value={form.dueDateTextFromDocument}
                    onChange={(event) => updateForm('dueDateTextFromDocument', event.target.value)}
                    className="min-h-20 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                    placeholder="예: 이 명령을 송달받은 날부터 7일 이내"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-gray-700">사용자가 직접 확인한 제출기한</span>
                  <input
                    type="date"
                    value={form.dueDateByUserInput}
                    onChange={(event) => updateForm('dueDateByUserInput', event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                  <span className="block text-xs leading-5 text-red-700">
                    HARU는 기한을 자동 계산하지 않습니다. 원문과 송달내역을 직접 확인한 날짜만 입력하세요.
                  </span>
                </label>

                <label className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm sm:mt-6">
                  <input
                    type="checkbox"
                    checked={form.userConfirmedDueDate}
                    onChange={(event) => updateForm('userConfirmedDueDate', event.target.checked)}
                    className="mt-1 size-4"
                  />
                  <span className="leading-6 text-red-900">
                    제출기한을 법원 문서 원문과 전자소송 송달내역에서 직접 확인했습니다.
                  </span>
                </label>
              </div>
            </section>

            <ListEditor
              title="법원이 요구한 사항"
              placeholder="예: 피고 주소를 보정"
              items={requirements}
              setItems={setRequirements}
              onAdd={addListItem}
              onRemove={removeListItem}
              onChange={updateListItem}
            />

            <ListEditor
              title="준비해야 할 자료"
              placeholder="예: 주민등록초본"
              items={preparationItems}
              setItems={setPreparationItems}
              onAdd={addListItem}
              onRemove={removeListItem}
              onChange={updateListItem}
            />

            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-gray-700">사용자 메모</span>
                <textarea
                  value={form.userMemo}
                  onChange={(event) => updateForm('userMemo', event.target.value)}
                  className="min-h-24 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  placeholder="확인한 내용이나 다음에 할 일을 적어두세요."
                />
              </label>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <ResponsibilityBox
                title="내가 할 것"
                items={[
                  '법원 문서 원문 확인',
                  '실제 송달일 확인',
                  '제출기한 직접 확인',
                  '요구사항과 첨부서류 확인',
                  '전자소송 사이트 또는 법원에 직접 제출',
                  '제출 완료 여부 확인',
                ]}
              />
              <ResponsibilityBox
                title="HARU가 도울 것"
                items={[
                  '문서 정보를 사건에 연결',
                  '요구사항을 체크 가능한 항목으로 정리',
                  '준비자료를 목록으로 관리',
                  '사용자가 입력한 기한을 오늘 할 일에 표시',
                  '사건 기록에 문서와 진행상황을 보관',
                ]}
              />
            </section>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate('/legal-assistant')}>
                취소
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                사건에 연결하기
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function ListEditor({
  title,
  placeholder,
  items,
  setItems,
  onAdd,
  onRemove,
  onChange,
}: {
  title: string;
  placeholder: string;
  items: string[];
  setItems: Dispatch<SetStateAction<string[]>>;
  onAdd: (setter: Dispatch<SetStateAction<string[]>>) => void;
  onRemove: (setter: Dispatch<SetStateAction<string[]>>, index: number) => void;
  onChange: (setter: Dispatch<SetStateAction<string[]>>, index: number, value: string) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => onAdd(setItems)}>
          <Plus className="size-4" />
          추가
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={item}
              onChange={(event) => onChange(setItems, index, event.target.value)}
              className="min-h-10 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
              placeholder={placeholder}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(setItems, index)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResponsibilityBox({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
