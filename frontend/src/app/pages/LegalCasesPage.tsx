import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, FilePlus2, Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { createLegalCase, createSampleLegalCase, getLegalCases } from '../services/legalCasesService';
import {
  type LegalCase,
  type LegalCaseStatus,
  type LegalCaseType,
  type PartyRole,
  type SubmitChecklist,
} from '../types/legalCaseTypes';

type CaseFormState = {
  title: string;
  caseNumber: string;
  courtName: string;
  caseType: LegalCaseType;
  partyRole: PartyRole;
  submittedAt: string;
  receiptNumber: string;
  status: LegalCaseStatus;
  memo: string;
};

const initialForm: CaseFormState = {
  title: '',
  caseNumber: '',
  courtName: '',
  caseType: '지급명령',
  partyRole: '신청인/원고',
  submittedAt: new Date().toISOString().slice(0, 10),
  receiptNumber: '',
  status: '제출완료',
  memo: '',
};

const LEGAL_CASE_TYPES: LegalCaseType[] = [
  '지급명령',
  '소액대여금',
  '물품대금',
  '임대차보증금',
  '기타',
];

const PARTY_ROLES: PartyRole[] = ['신청인/원고', '피신청인/피고'];

const LEGAL_CASE_STATUSES: LegalCaseStatus[] = [
  '제출준비',
  '제출완료',
  '송달확인중',
  '보정필요',
  '추가서류필요',
  '종결',
  '보류',
];

const DEFAULT_SUBMIT_CHECKLIST: SubmitChecklist = {
  confirmedSubmitScreen: false,
  savedReceipt: false,
  checkedCaseNumber: false,
  confirmedFeePayment: false,
  savedFinalPdf: false,
  checkedAttachments: false,
  confirmedMyCaseList: false,
};

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

function needsDeliveryCheck(item: LegalCase) {
  return item.status !== '종결' && item.status !== '보류' && item.lastCheckedAt !== getToday();
}

export default function LegalCasesPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingSample, setIsCreatingSample] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<CaseFormState>(initialForm);

  const todayUncheckedCount = useMemo(
    () => cases.filter((item) => needsDeliveryCheck(item)).length,
    [cases],
  );

  const loadCases = async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    try {
      const items = await getLegalCases(user.uid);
      setCases(items);
    } catch (error) {
      console.error('전자소송 사건 목록 로드 실패:', error);
      toast.error('전자소송 사건 목록을 불러오지 못했습니다.');
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
    if (user?.uid) {
      loadCases();
    }
  }, [user?.uid]);

  const updateForm = <K extends keyof CaseFormState>(key: K, value: CaseFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setIsAdding(false);
  };

  const submitCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    const title = form.title.trim();
    const caseNumber = form.caseNumber.trim();
    const courtName = form.courtName.trim();
    if (!title || !caseNumber || !courtName || !form.submittedAt) {
      toast.error('필수 항목을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const caseId = await createLegalCase(user.uid, {
        title,
        caseNumber,
        courtName,
        caseType: form.caseType,
        partyRole: form.partyRole,
        submittedAt: form.submittedAt,
        receiptNumber: form.receiptNumber.trim() || undefined,
        status: form.status,
        memo: form.memo.trim() || undefined,
        checklistSubmit: DEFAULT_SUBMIT_CHECKLIST,
      });
      toast.success('사건을 등록했습니다.');
      resetForm();
      await loadCases();
      navigate(`/legal-cases/${caseId}`);
    } catch (error) {
      console.error('전자소송 사건 등록 실패:', error);
      toast.error('사건을 등록하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const createSampleCase = async () => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setIsCreatingSample(true);
    try {
      const caseId = await createSampleLegalCase(user.uid);
      toast.success('샘플 사건을 생성했습니다.');
      navigate(`/legal-cases/${caseId}`);
    } catch (error) {
      console.error('샘플 사건 생성 실패:', error);
      toast.error('샘플 사건을 생성하지 못했습니다.');
    } finally {
      setIsCreatingSample(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#FEFBE8] px-4 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-center py-20 text-sm text-gray-500">
          <Loader2 className="mr-2 size-4 animate-spin" />
          전자소송 사건 목록을 불러오는 중입니다.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFBE8] px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="px-2">
            <ArrowLeft className="size-4" />
            뒤로가기
          </Button>
          <h1 className="text-center text-lg font-semibold text-gray-900">전자소송 체크리스트</h1>
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="size-4" />
            사건 추가
          </Button>
        </header>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">간편연습 샘플 사건 만들기</p>
          <p className="mt-1 text-xs text-blue-700">
            대여금 300만 원 지급명령 예시 사건으로 전자소송 체크리스트를 연습합니다.
          </p>
          <Button
            className="mt-3"
            size="sm"
            disabled={isCreatingSample}
            onClick={createSampleCase}
          >
            {isCreatingSample ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                샘플 사건 생성 중...
              </>
            ) : (
              '간편연습 샘플 사건 만들기'
            )}
          </Button>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            이 사건은 전자소송 절차를 익히기 위한 연습용 예시입니다. 실제 사건 제출 전에는 법원 문서와 전자소송포털 안내를 직접 확인하세요.
          </p>
        </div>

        {todayUncheckedCount > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
            <Bell className="mt-0.5 size-4 shrink-0" />
            오늘 송달 확인이 기록되지 않은 사건이 {todayUncheckedCount}건 있습니다.
          </div>
        )}

        {isAdding && (
          <form
            onSubmit={submitCase}
            className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">새 사건 등록</h2>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                닫기
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-gray-700">사건명</span>
                <input
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  placeholder="홍길동 대여금 청구"
                  required
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-gray-700">사건번호</span>
                <input
                  value={form.caseNumber}
                  onChange={(event) => updateForm('caseNumber', event.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  placeholder="2026가단12345"
                  required
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-gray-700">법원명</span>
                <input
                  value={form.courtName}
                  onChange={(event) => updateForm('courtName', event.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  placeholder="서울중앙지방법원"
                  required
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-gray-700">제출일</span>
                <input
                  type="date"
                  value={form.submittedAt}
                  onChange={(event) => updateForm('submittedAt', event.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  required
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-gray-700">사건유형</span>
                <select
                  value={form.caseType}
                  onChange={(event) => updateForm('caseType', event.target.value as LegalCaseType)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                >
                  {LEGAL_CASE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-gray-700">현재 상태</span>
                <select
                  value={form.status}
                  onChange={(event) => updateForm('status', event.target.value as LegalCaseStatus)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                >
                  {LEGAL_CASE_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-700">당사자 구분</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PARTY_ROLES.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      checked={form.partyRole === item}
                      onChange={() => updateForm('partyRole', item)}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-gray-700">접수번호</span>
              <input
                value={form.receiptNumber}
                onChange={(event) => updateForm('receiptNumber', event.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                placeholder="선택 입력"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-gray-700">메모</span>
              <textarea
                value={form.memo}
                onChange={(event) => updateForm('memo', event.target.value)}
                className="min-h-24 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                placeholder="중요 확인사항을 기록하세요."
              />
            </label>

            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
              이 기능은 전자소송 진행 중 확인사항을 기록하고 놓치지 않도록 돕는 체크리스트입니다.
              법률 효과, 기한, 법적 판단이 필요한 내용은 전자소송포털, 법원 안내문, 관련 법령을 기준으로 확인해야 합니다.
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                취소
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                등록
              </Button>
            </div>
          </form>
        )}

        {cases.length === 0 ? (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-12 text-center">
            <FilePlus2 className="mx-auto mb-3 size-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-800">등록된 사건이 없습니다.</p>
            <Button className="mt-4" onClick={() => setIsAdding(true)}>
              <Plus className="size-4" />
              사건 추가
            </Button>
          </section>
        ) : (
          <section className="space-y-3">
            {cases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/legal-cases/${item.id}`)}
                className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{item.title}</h2>
                    <p className="mt-1 text-sm text-gray-600">{item.caseNumber}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant="outline" className={statusClassName(item.status)}>
                      {item.status}
                    </Badge>
                    {needsDeliveryCheck(item) && (
                      <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-800">
                        오늘 송달 미확인
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-gray-600 sm:grid-cols-2">
                  <p>법원: {item.courtName}</p>
                  <p>마지막 송달확인일: {item.lastCheckedAt || '기록 없음'}</p>
                </div>
              </button>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
