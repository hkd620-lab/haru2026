import { type ReactNode, useMemo, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createPracticeDraftLegalCase } from '../services/legalCasesService';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileText,
  RotateCcw,
  Scale,
  UploadCloud,
} from 'lucide-react';

type DocType = '민사소장';
type CaseType = '중고거래';

type LawsuitPracticeState = {
  isLoggedIn: boolean;
  userName: string;
  docType: DocType;
  caseType: CaseType;
  agreed: boolean;
  caseName: string;
  suitAmount: string;
  plaintiffName: string;
  plaintiffBirth: string;
  defendantName: string;
  claimPurpose: string;
  claimReason: string;
  evidenceList: string[];
  mockCaseNumber: string;
};

type ReviewRow = {
  label: string;
  value: string;
};

const INITIAL_STATE: LawsuitPracticeState = {
  isLoggedIn: false,
  userName: '홍길동',
  docType: '민사소장',
  caseType: '중고거래',
  agreed: false,
  caseName: '',
  suitAmount: '',
  plaintiffName: '',
  plaintiffBirth: '',
  defendantName: '',
  claimPurpose: '',
  claimReason: '',
  evidenceList: [],
  mockCaseNumber: '',
};

const STEP_LABELS = [
  '로그인',
  '서류',
  '유형',
  '동의',
  '기본',
  '당사자',
  '청구취지',
  '청구원인',
  '증거',
  '확인',
  '제출',
];

const CASE_CARDS = [
  {
    label: '중고거래 분쟁',
    body: '미배송, 환불 거부, 하자 물품 사건을 연습합니다.',
    enabled: true,
  },
  {
    label: '임대차 보증금',
    body: '다음 버전에서 추가 예정입니다.',
    enabled: false,
  },
  {
    label: '임금 체불',
    body: '다음 버전에서 추가 예정입니다.',
    enabled: false,
  },
];

const PRACTICE_CASE_EXAMPLES = [
  {
    title: '대여금 반환',
    body: '지인에게 300만 원을 빌려주었으나 약속한 날짜까지 돌려받지 못한 경우',
  },
  {
    title: '중고거래 대금 반환',
    body: '중고거래로 물품을 구매했으나 물건을 받지 못했거나 설명과 다른 물건을 받은 경우',
  },
  {
    title: '물품대금 청구',
    body: '물건을 납품했지만 대금을 받지 못한 경우',
  },
  {
    title: '용역대금 청구',
    body: '일을 해주었지만 약속한 비용을 받지 못한 경우',
  },
  {
    title: '임대차보증금 반환',
    body: '계약이 끝났는데 보증금 일부 또는 전부를 돌려받지 못한 경우',
  },
  {
    title: '지급명령 연습',
    body: '증거가 비교적 분명한 금전청구 사건에서 지급명령 절차를 연습하는 경우',
  },
];

const DUMMY_EVIDENCE = [
  '채팅 캡처',
  '입금확인증',
  '판매글 캡처',
  '배송 조회 내역',
  '환불 요청 메시지',
];

const CLAIM_REASON_AI_LIMIT = 3;
const CLAIM_REASON_AI_NOTICE = '본 문장은 연습용 AI 초안이며 실제 법률자문이 아닙니다.';

function formatAmount(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return value.trim() || '금액 미입력';
  return `${Number(digits).toLocaleString('ko-KR')}원`;
}

function splitEvidence(value: string) {
  return value
    .split(/[,/·\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildClaimPurpose(state: LawsuitPracticeState) {
  return `피고는 원고에게 금 ${formatAmount(state.suitAmount)}을 지급하라.`;
}

function buildPracticeTimeline(state: LawsuitPracticeState) {
  return [
    {
      title: '소장 기본정보 확인',
      body: `${state.caseName || '사건명 미입력'} 사건의 소가를 ${formatAmount(
        state.suitAmount,
      )} 기준으로 확인합니다.`,
    },
    {
      title: '당사자 정보 점검',
      body: `원고 ${state.plaintiffName || '원고명 미입력'}와 피고 ${
        state.defendantName || '피고명 미입력'
      }의 표시가 맞는지 다시 확인합니다.`,
    },
    {
      title: '청구취지 검토',
      body: state.claimPurpose || buildClaimPurpose(state),
    },
    {
      title: '청구원인 보완',
      body:
        state.claimReason ||
        '거래 경위, 대금 지급, 미배송 또는 환불 거부 사정을 날짜 순서로 보완합니다.',
    },
    {
      title: '증거 첨부 준비',
      body: state.evidenceList.length
        ? `${state.evidenceList.join(', ')} 자료를 첨부서류 후보로 정리합니다.`
        : '채팅 캡처, 입금확인증, 판매글 캡처 등 증거자료를 첨부 후보로 준비합니다.',
    },
  ];
}

function makeMockCaseNumber() {
  return `2026가소${Math.floor(10000 + Math.random() * 90000)}`;
}

export function LawsuitPracticePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<LawsuitPracticeState>(INITIAL_STATE);
  const [claimReasonAiRemaining, setClaimReasonAiRemaining] = useState(CLAIM_REASON_AI_LIMIT);
  const [isGeneratingClaimReason, setIsGeneratingClaimReason] = useState(false);
  const [isSavingPracticeCase, setIsSavingPracticeCase] = useState(false);

  const isFinalStep = step === STEP_LABELS.length - 1;
  const isCompleted = Boolean(state.mockCaseNumber);
  const claimExample = useMemo(() => buildClaimPurpose(state), [state.suitAmount]);
  const timeline = useMemo(() => buildPracticeTimeline(state), [state]);
  const reviewRows = useMemo<ReviewRow[]>(
    () => [
      { label: '사건명', value: state.caseName || '미입력' },
      { label: '소가', value: formatAmount(state.suitAmount) },
      { label: '원고', value: state.plaintiffName || '미입력' },
      { label: '피고', value: state.defendantName || '미입력' },
      { label: '청구취지', value: state.claimPurpose || claimExample },
      { label: '청구원인', value: state.claimReason || '미입력' },
    ],
    [claimExample, state],
  );

  const updateState = <K extends keyof LawsuitPracticeState>(
    key: K,
    value: LawsuitPracticeState[K],
  ) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const resetPractice = () => {
    setStep(0);
    setState(INITIAL_STATE);
    setClaimReasonAiRemaining(CLAIM_REASON_AI_LIMIT);
    setIsGeneratingClaimReason(false);
  };

  const loginPractice = () => {
    setState((prev) => ({ ...prev, isLoggedIn: true }));
    setStep(1);
  };

  const addEvidence = () => {
    setState((prev) => {
      const seed = splitEvidence(DUMMY_EVIDENCE.join(', '));
      const nextItem = seed[prev.evidenceList.length % seed.length] || '증거자료';
      return { ...prev, evidenceList: [...prev.evidenceList, nextItem] };
    });
  };

  const moveNext = () => {
    if (step === 3 && !state.agreed) return;
    if (step === 6 && !state.claimPurpose.trim()) {
      updateState('claimPurpose', claimExample);
    }
    setStep((prev) => Math.min(prev + 1, STEP_LABELS.length - 1));
  };

  const moveBack = () => {
    if (isCompleted) {
      updateState('mockCaseNumber', '');
      return;
    }
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const submitPractice = () => {
    setState((prev) => ({
      ...prev,
      claimPurpose: prev.claimPurpose.trim() || buildClaimPurpose(prev),
      mockCaseNumber: makeMockCaseNumber(),
    }));
  };

  const savePracticeAsCase = async () => {
    if (!user?.uid) {
      alert('로그인이 필요합니다. 로그인 후 다시 시도해주세요.');
      navigate('/login');
      return;
    }

    setIsSavingPracticeCase(true);
    try {
      const caseId = await createPracticeDraftLegalCase(user.uid, {
        caseName: state.caseName.trim() || '전자소송 연습 기록',
        suitAmount: state.suitAmount,
        plaintiffName: state.plaintiffName,
        defendantName: state.defendantName,
        claimPurpose: state.claimPurpose.trim() || buildClaimPurpose(state),
        claimReason: state.claimReason,
        evidenceList: state.evidenceList,
      });
      alert('연습 내용을 사건으로 저장했습니다. 상태는 제출준비로 기록됩니다.');
      navigate(`/legal-cases/${caseId}`);
    } catch (error) {
      console.error('전자소송 연습 결과 저장 실패:', error);
      alert('연습 내용을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSavingPracticeCase(false);
    }
  };

  const generateClaimReasonDraft = async () => {
    if (isGeneratingClaimReason || claimReasonAiRemaining <= 0) return;
    if (
      state.claimReason.trim() &&
      !window.confirm('이미 작성하신 청구원인이 있습니다. AI 초안으로 교체하시겠습니까?')
    ) {
      return;
    }

    setIsGeneratingClaimReason(true);
    console.log('전자소송연습비서 청구원인 AI 초안 요청', {
      caseType: state.caseType,
      remainingBefore: claimReasonAiRemaining,
    });

    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(functions, 'generateLawsuitClaimReason');
      const result = await fn({
        caseType: state.caseType,
        caseName: state.caseName || '',
        suitAmount: state.suitAmount || '',
        plaintiffName: state.plaintiffName || '',
        defendantName: state.defendantName || '',
        claimPurpose: state.claimPurpose || claimExample,
      });
      const responseData = result.data as { claimReasonText?: string; quotaRemaining?: number };
      const claimReasonText = (responseData.claimReasonText || '').trim();
      if (!claimReasonText) {
        throw new Error('EMPTY_CLAIM_REASON_TEXT');
      }

      updateState('claimReason', `${CLAIM_REASON_AI_NOTICE}\n\n${claimReasonText}`);
      setClaimReasonAiRemaining((prev) =>
        typeof responseData.quotaRemaining === 'number'
          ? Math.max(responseData.quotaRemaining, 0)
          : Math.max(prev - 1, 0),
      );
      console.log('전자소송연습비서 청구원인 AI 초안 완료', {
        remainingAfter:
          typeof responseData.quotaRemaining === 'number'
            ? Math.max(responseData.quotaRemaining, 0)
            : Math.max(claimReasonAiRemaining - 1, 0),
      });
    } catch (error) {
      console.error('전자소송연습비서 청구원인 AI 초안 실패:', error);
      alert('청구원인 AI 초안 작성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsGeneratingClaimReason(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f2937] px-4 py-5 sm:px-6">
      <style>{`
        .lawsuit-shell {
          max-width: 980px;
          margin: 0 auto;
          padding-bottom: 176px;
        }
        .lawsuit-card {
          background: #fff;
          border: 1px solid #dbe3ec;
          border-radius: 12px;
          box-shadow: 0 18px 44px -34px rgba(24, 95, 165, 0.34);
        }
        .lawsuit-button {
          min-height: 46px;
          border-radius: 8px;
          font-weight: 700;
          transition: transform 120ms ease, background 160ms ease, border-color 160ms ease;
        }
        .lawsuit-button:active {
          transform: scale(0.99);
        }
        .lawsuit-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .lawsuit-timeline {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr);
          gap: 12px;
        }
        .lawsuit-field {
          width: 100%;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #fff;
          padding: 12px 14px;
          color: #1f2937;
          outline: none;
        }
        .lawsuit-field:focus {
          border-color: #185FA5;
          box-shadow: 0 0 0 3px rgba(24, 95, 165, 0.12);
        }
        @media (max-width: 720px) {
          .lawsuit-shell {
            padding-bottom: 192px;
          }
          .lawsuit-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="lawsuit-shell">
        <div className="sticky top-0 z-20 -mx-4 mb-4 bg-[#b42318] px-4 py-2 text-center text-xs font-extrabold text-white shadow-sm sm:-mx-6">
          연습용 모의 화면입니다. 실제 법원에 제출되지 않습니다
        </div>

        <header className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/v2')}
            className="lawsuit-button inline-flex items-center gap-2 border border-[#cbd5e1] bg-white px-4 text-sm text-[#185FA5]"
          >
            <ArrowLeft className="h-4 w-4" />
            HARU 홈
          </button>
          <button
            type="button"
            onClick={resetPractice}
            className="lawsuit-button inline-flex items-center gap-2 border border-[#cbd5e1] bg-white px-4 text-sm text-[#475569]"
          >
            <RotateCcw className="h-4 w-4" />
            초기화
          </button>
        </header>

        <section className="lawsuit-card overflow-hidden">
          <div className="bg-[#185FA5] px-5 py-5 text-white sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded bg-white/14 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-white">
                  <Scale className="h-3.5 w-3.5" />
                  LAWSUIT PRACTICE V2
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  전자소송연습비서
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#dceeff]">
                  나홀로 전자소송에서 자주 만나는 단순 금전청구 사건을 11단계 흐름으로 연습합니다.
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[#dceeff]">
                  <p>전자소송연습비서는 실제 소송을 대신 진행하는 기능이 아닙니다.</p>
                  <p>나홀로 전자소송을 준비하는 사용자가 절차, 서류, 증거자료, 송달확인, 보정기한 관리를 미리 연습하도록 돕는 체크리스트 비서입니다.</p>
                  <p>단순한 금전청구 사건은 연습을 통해 실제 나홀로 전자소송 준비에 도움을 받을 수 있습니다. 다만 실제 제출 전에는 반드시 법원 문서, 전자소송포털 안내, 본인의 증거자료를 직접 확인해야 합니다.</p>
                </div>
              </div>
              {state.isLoggedIn && (
                <div className="rounded bg-white px-3 py-2 text-sm font-extrabold text-[#185FA5]">
                  {state.userName}님(연습)
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-[#dbe3ec] bg-white px-4 py-4 sm:px-6">
            <div className="grid grid-cols-11 gap-1">
              {STEP_LABELS.map((label, index) => {
                const status =
                  index === step ? 'current' : index < step || isCompleted ? 'done' : 'todo';
                return (
                  <div key={label} className="min-w-0">
                    <div
                      className={
                        status === 'current'
                          ? 'h-2 rounded-full bg-[#185FA5]'
                          : status === 'done'
                            ? 'h-2 rounded-full bg-[#9fc8ed]'
                            : 'h-2 rounded-full bg-[#d8dee7]'
                      }
                    />
                    <div
                      className={
                        status === 'current'
                          ? 'mt-2 truncate text-center text-[10px] font-extrabold text-[#185FA5]'
                          : 'mt-2 truncate text-center text-[10px] font-bold text-[#64748b]'
                      }
                    >
                      {index + 1}. {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-5 py-6 sm:px-7">
            {step === 0 && (
              <div>
                <SectionTitle title="로그인" subtitle="연습용 인증 버튼 중 하나를 선택하세요." />
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={loginPractice}
                    className="lawsuit-button border border-[#185FA5] bg-white px-5 text-[#185FA5]"
                  >
                    공동인증서 로그인(연습)
                  </button>
                  <button
                    type="button"
                    onClick={loginPractice}
                    className="lawsuit-button bg-[#185FA5] px-5 text-white"
                  >
                    간편인증(연습)
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <SectionTitle title="서류 선택" subtitle="이번 V2에서는 민사 소장만 활성화됩니다." />
                <div className="grid gap-3 sm:grid-cols-4">
                  {['민사 소장', '지급명령', '답변서', '준비서면'].map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      disabled={index !== 0}
                      className={
                        index === 0
                          ? 'min-h-[132px] rounded-lg border border-[#185FA5] bg-[#f3f9ff] p-4 text-left'
                          : 'min-h-[132px] rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-left opacity-70'
                      }
                    >
                      <FileText className={index === 0 ? 'mb-4 h-6 w-6 text-[#185FA5]' : 'mb-4 h-6 w-6 text-[#94a3b8]'} />
                      <div className="font-extrabold">{label}</div>
                      <div className="mt-2 text-sm text-[#64748b]">
                        {index === 0 ? '선택됨' : '다음 버전 예정'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <SectionTitle
                  title="사건유형 선택"
                  subtitle="현재 입력 흐름은 중고거래 예시로 진행하며, 아래 단순 금전청구 사례도 절차 연습용으로 함께 참고합니다."
                />
                <div className="lawsuit-grid">
                  {CASE_CARDS.map((card) => (
                    <button
                      key={card.label}
                      type="button"
                      disabled={!card.enabled}
                      className={
                        card.enabled
                          ? 'min-h-[150px] rounded-lg border border-[#185FA5] bg-[#f3f9ff] p-5 text-left'
                          : 'min-h-[150px] rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-left opacity-70'
                      }
                    >
                      <div className={card.enabled ? 'mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#185FA5]' : 'mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#94a3b8]'}>
                        <Scale className="h-5 w-5" />
                      </div>
                      <div className="text-base font-extrabold">{card.label}</div>
                      <div className="mt-2 text-sm leading-5 text-[#64748b]">{card.body}</div>
                      <div className={card.enabled ? 'mt-4 inline-flex rounded bg-[#185FA5] px-3 py-1 text-xs font-bold text-white' : 'mt-4 inline-flex rounded border border-[#cbd5e1] px-3 py-1 text-xs font-bold text-[#64748b]'}>
                        {card.enabled ? '선택됨' : '다음 버전 예정'}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-6 rounded-lg border border-[#dbe3ec] bg-[#f8fafc] p-5">
                  <h3 className="text-base font-extrabold text-[#1f2937]">
                    나홀로 전자소송에서 자주 만나는 연습 사례
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {PRACTICE_CASE_EXAMPLES.map((item) => (
                      <div key={item.title} className="rounded-lg border border-[#e2e8f0] bg-white p-4">
                        <div className="text-sm font-extrabold text-[#185FA5]">{item.title}</div>
                        <p className="mt-2 text-sm leading-6 text-[#475569]">예: {item.body}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[#64748b]">
                    이 사례들은 전자소송 절차를 익히기 위한 연습용 예시입니다. 실제 사건에서는 계약서, 계좌이체내역, 문자, 내용증명, 법원 안내문 등을 직접 확인해야 합니다.
                  </p>
                </div>
                <div className="mt-4 rounded-lg border border-[#fca5a5] bg-[#fff5f5] p-5">
                  <h3 className="text-base font-extrabold text-[#b91c1c]">
                    전문가 상담이 필요한 사건
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-[#475569]">
                    아래 사건은 이 연습비서만 믿고 혼자 진행하기보다 전문가 상담이 필요한 유형입니다.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm leading-6 text-[#475569]">
                    <li>• 상대방이 강하게 다투는 사건</li>
                    <li>• 금액이 큰 사건</li>
                    <li>• 손해배상액 산정이 어려운 사건</li>
                    <li>• 부동산 명도, 가압류, 가처분 등 절차상 위험이 큰 사건</li>
                    <li>• 이혼, 상속, 가사 사건</li>
                    <li>• 형사 문제와 연결된 사건</li>
                    <li>• 계약 해석이 복잡한 사건</li>
                    <li>• 법률상 기한 계산이 중요한 사건</li>
                  </ul>
                  <p className="mt-3 text-xs leading-5 text-[#b91c1c]">
                    이런 사건은 전자소송연습비서를 자료 정리와 질문 준비용으로만 활용하고, 실제 진행 전에는 전문가 상담을 권장합니다.
                  </p>
                </div>
                <div className="mt-4 rounded-lg border border-[#dbe3ec] bg-[#f8fafc] px-4 py-3 text-xs leading-5 text-[#64748b]">
                  <p>
                    이 연습은 전자소송 절차를 익히기 위한 예시입니다. 실제 사건에서는 샘플 문장을 그대로 제출하지 말고, 본인의 날짜, 금액, 당사자 정보, 증거자료에 맞게 수정해야 합니다.
                  </p>
                  <p className="mt-2">
                    지연손해금, 보정기한, 송달 효력은 사건유형과 법원 문서에 따라 달라질 수 있으므로 자동으로 확정하지 않습니다. 반드시 전자소송포털과 법원 안내문을 직접 확인하세요.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <SectionTitle title="전자소송 동의" subtitle="연습 화면임을 확인해야 다음 단계로 이동할 수 있습니다." />
                <div className="rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-5 text-sm leading-7 text-[#475569]">
                  본 화면은 전자소송 절차를 익히기 위한 모의 작성 화면입니다. 입력한 내용은
                  법원에 제출되지 않으며, AI 초안과 연습 기록 저장도 실제 법원 제출이 아닙니다.
                </div>
                <label className="mt-5 flex items-center gap-3 text-sm font-extrabold text-[#1f2937]">
                  <input
                    type="checkbox"
                    checked={state.agreed}
                    onChange={(event) => updateState('agreed', event.target.checked)}
                    className="h-5 w-5 accent-[#185FA5]"
                  />
                  동의합니다
                </label>
                {!state.agreed && (
                  <p className="mt-3 text-sm font-bold text-[#b42318]">
                    체크 후 다음 단계로 이동할 수 있습니다.
                  </p>
                )}
              </div>
            )}

            {step === 4 && (
              <div>
                <SectionTitle title="사건기본정보" subtitle="사건명과 소가를 입력합니다." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="사건명">
                    <input
                      value={state.caseName}
                      onChange={(event) => updateState('caseName', event.target.value)}
                      placeholder="예: 중고 노트북 대금반환 청구"
                      className="lawsuit-field"
                    />
                  </Field>
                  <Field label="소가(소송금액)">
                    <input
                      value={state.suitAmount}
                      onChange={(event) => updateState('suitAmount', event.target.value)}
                      placeholder="예: 480000원"
                      className="lawsuit-field"
                    />
                    <p className="mt-2 text-sm font-bold text-[#185FA5]">
                      표시 금액: {formatAmount(state.suitAmount)}
                    </p>
                  </Field>
                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <SectionTitle title="당사자 입력" subtitle="피고 실명은 상대방 특정자료와 별도로 입력합니다." />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="원고(나) 이름">
                    <input
                      value={state.plaintiffName}
                      onChange={(event) => updateState('plaintiffName', event.target.value)}
                      placeholder="예: 홍길동"
                      className="lawsuit-field"
                    />
                  </Field>
                  <Field label="원고 생년월일">
                    <input
                      value={state.plaintiffBirth}
                      onChange={(event) => updateState('plaintiffBirth', event.target.value)}
                      placeholder="예: 1990.01.01"
                      className="lawsuit-field"
                    />
                  </Field>
                  <Field label="피고(상대방) 이름">
                    <input
                      value={state.defendantName}
                      onChange={(event) => updateState('defendantName', event.target.value)}
                      placeholder="예: 김철수"
                      className="lawsuit-field"
                    />
                  </Field>
                </div>
              </div>
            )}

            {step === 6 && (
              <div>
                <SectionTitle title="청구취지" subtitle="법원에 구하는 결론을 짧게 정리합니다." />
                <div className="mb-4 rounded-lg border border-[#bfd7ef] bg-[#f3f9ff] p-4 text-sm leading-6 text-[#185FA5]">
                  예시: {claimExample}
                </div>
                <textarea
                  value={state.claimPurpose}
                  onChange={(event) => updateState('claimPurpose', event.target.value)}
                  placeholder={claimExample}
                  className="lawsuit-field min-h-[150px] resize-none leading-7"
                />
              </div>
            )}

            {step === 7 && (
              <div>
                <SectionTitle title="청구원인" subtitle="왜 소송을 하는지 거래 경위와 분쟁 사정을 적습니다." />
                <div className="mb-4 rounded-lg border border-[#dbe3ec] bg-[#f8fafc] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-[#1f2937]">청구원인 AI 초안</p>
                      <p className="mt-1 text-sm leading-6 text-[#64748b]">
                        입력한 사건 정보만 바탕으로 연습용 초안을 작성합니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={generateClaimReasonDraft}
                      disabled={isGeneratingClaimReason || claimReasonAiRemaining <= 0}
                      className="lawsuit-button inline-flex items-center justify-center bg-[#185FA5] px-5 text-white disabled:bg-[#94a3b8]"
                    >
                      {isGeneratingClaimReason
                        ? '작성 중...'
                        : state.claimReason.trim()
                          ? `재생성 (${claimReasonAiRemaining}회 남음)`
                          : `AI 초안 작성 (${claimReasonAiRemaining}회 남음)`}
                    </button>
                  </div>
                  {claimReasonAiRemaining <= 0 && (
                    <p className="mt-3 text-sm font-bold text-[#b42318]">
                      AI 초안 사용 횟수를 모두 사용했습니다.
                    </p>
                  )}
                </div>
                <textarea
                  value={state.claimReason}
                  onChange={(event) => updateState('claimReason', event.target.value)}
                  placeholder="예: 원고는 피고에게 중고 노트북 대금을 송금했으나, 피고는 물건을 보내지 않고 환불도 거부하고 있습니다."
                  className="lawsuit-field min-h-[190px] resize-none leading-7"
                />
              </div>
            )}

            {step === 8 && (
              <div>
                <SectionTitle title="증거·첨부서류" subtitle="실제 업로드 없이 연습용 증거 항목만 추가합니다." />
                <div className="rounded-lg border-2 border-dashed border-[#9fb7d1] bg-[#f8fafc] p-6 text-center">
                  <UploadCloud className="mx-auto mb-3 h-8 w-8 text-[#185FA5]" />
                  <p className="font-extrabold">첨부서류 업로드 영역(연습)</p>
                  <p className="mt-2 text-sm text-[#64748b]">파일은 업로드되지 않습니다.</p>
                </div>
                <button
                  type="button"
                  onClick={addEvidence}
                  className="lawsuit-button mt-4 bg-[#185FA5] px-5 text-white"
                >
                  증거 추가(연습)
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(state.evidenceList.length ? state.evidenceList : ['채팅 캡처', '입금확인증']).map(
                    (item) => (
                      <span
                        key={item}
                        className="rounded bg-[#e8f2fb] px-3 py-1 text-xs font-bold text-[#185FA5]"
                      >
                        {item}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}

            {step === 9 && (
              <div>
                <SectionTitle title="작성 확인" subtitle="입력한 주요 내용을 제출 전 표로 확인합니다." />
                <div className="overflow-hidden rounded-lg border border-[#cbd5e1]">
                  {reviewRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[120px_minmax(0,1fr)] border-b border-[#e2e8f0] last:border-b-0">
                      <div className="bg-[#f8fafc] px-4 py-3 text-sm font-extrabold text-[#475569]">
                        {row.label}
                      </div>
                      <div className="whitespace-pre-wrap px-4 py-3 text-sm leading-6 text-[#1f2937]">
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 10 && !isCompleted && (
              <div>
                <SectionTitle title="전자서명·제출" subtitle="연습용 제출 버튼을 누르면 모의 사건번호가 생성됩니다." />
                <button
                  type="button"
                  onClick={submitPractice}
                  className="lawsuit-button inline-flex w-full items-center justify-center gap-2 bg-[#185FA5] px-5 text-white"
                >
                  소장 제출하기(연습)
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 10 && isCompleted && (
              <div>
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f5e9] text-[#2f7d32]">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-[#1f2937]">접수완료(연습)</h2>
                  <p className="mt-2 text-lg font-extrabold text-[#185FA5]">
                    모의 사건번호: {state.mockCaseNumber}
                  </p>
                </div>

                <div className="rounded-lg border border-[#dbe3ec] bg-[#f8fafc] p-5">
                  <h3 className="mb-4 font-extrabold">앞으로의 진행 안내</h3>
                  <div className="space-y-5">
                    {timeline.map((item, index) => (
                      <div key={item.title} className="lawsuit-timeline">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#185FA5] text-sm font-extrabold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-base font-extrabold">{item.title}</div>
                          <p className="mt-1 text-sm leading-6 text-[#475569]">{item.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-[#bfd7ee] bg-[#f3f9ff] p-5">
                  <p className="text-sm leading-6 text-[#475569]">
                    전자소송 절차를 익혔다면, 지금 작성한 내용을 연습 기록으로 저장해 제출 전 준비 상태에서 이어서 확인할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={savePracticeAsCase}
                    disabled={isSavingPracticeCase}
                    className="lawsuit-button mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#185FA5] px-5 text-white disabled:bg-[#94a3b8]"
                  >
                    {isSavingPracticeCase ? '저장 중...' : '이 내용으로 사건 만들기'}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/legal-cases')}
                    className="lawsuit-button mt-3 inline-flex w-full items-center justify-center gap-2 border border-[#185FA5] bg-white px-5 text-[#185FA5]"
                  >
                    전자소송 체크리스트 비서로 이동
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetPractice}
                  className="lawsuit-button mt-6 inline-flex w-full items-center justify-center gap-2 border border-[#185FA5] bg-white px-5 text-[#185FA5]"
                >
                  처음부터 다시 연습
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <div
        className="fixed inset-x-0 z-20 border-t border-[#dbe3ec] bg-white/96 px-4 py-3 backdrop-blur"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-[980px] justify-between gap-3">
          <button
            type="button"
            onClick={moveBack}
            disabled={step === 0}
            className="lawsuit-button inline-flex min-w-[120px] items-center justify-center gap-2 border border-[#cbd5e1] bg-white px-5 text-[#185FA5] disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            이전
          </button>
          {step !== 0 && !isFinalStep && (
            <button
              type="button"
              onClick={moveNext}
              disabled={step === 3 && !state.agreed}
              className="lawsuit-button inline-flex min-w-[120px] items-center justify-center gap-2 bg-[#185FA5] px-5 text-white disabled:bg-[#94a3b8]"
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-extrabold tracking-tight text-[#1f2937]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#64748b]">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold text-[#475569]">{label}</span>
      {children}
    </label>
  );
}

export default LawsuitPracticePage;
