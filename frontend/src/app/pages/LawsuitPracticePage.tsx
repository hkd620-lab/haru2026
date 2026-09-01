import { type ReactNode, useMemo, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LegalTermHelp } from '../components/LegalTermHelp';
import { createPracticeDraftLegalCase } from '../services/legalCasesService';
import { useSensitiveConsent } from '../hooks/useSensitiveConsent';
import { SensitiveConsentGate } from '../components/SensitiveConsentGate';
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
type CaseType = 'loan_return' | 'used_goods_refund' | 'goods_payment' | 'service_payment';

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

type PracticePortalNavigationState = {
  practicePortalLoginCompleted?: boolean;
};

type PracticeLoginMethod = 'certificate' | 'simple';
type CauseExampleMode = 'chronology' | 'completed';

type ChronologyExampleItem = {
  date: string;
  event: string;
};

type PracticeCaseTypeConfig = {
  label: string;
  defaultPracticeTitle: string;
  shortDescription: string;
  exampleSituation: string;
  claimantDescription: string;
  opponentDescription: string;
  claimSummaryLabel: string;
  factPrompt: string;
  evidenceExamples: string[];
  chronologyExample: ChronologyExampleItem[];
  completedCauseExample: string[];
  causeWritingChecklist: string[];
  finalTitle: string;
};

const INITIAL_STATE: LawsuitPracticeState = {
  isLoggedIn: false,
  userName: '홍길동',
  docType: '민사소장',
  caseType: 'used_goods_refund',
  agreed: false,
  caseName: '중고거래 대금 반환 연습',
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

const PRACTICE_CASE_TYPE_CONFIGS: Record<CaseType, PracticeCaseTypeConfig> = {
  loan_return: {
    label: '대여금 반환',
    defaultPracticeTitle: '대여금 반환 연습',
    shortDescription: '빌려준 돈을 약속한 날까지 돌려받지 못한 경우를 연습합니다.',
    exampleSituation: '지인에게 돈을 빌려주었지만 약속한 변제일이 지나도 받지 못한 경우',
    claimantDescription: '돈을 빌려준 사람',
    opponentDescription: '돈을 빌린 사람',
    claimSummaryLabel: '대여금',
    factPrompt: '돈을 빌려준 날짜, 금액, 갚기로 한 날짜, 아직 받지 못한 사정을 날짜 순서로 적어봅니다.',
    evidenceExamples: [
      '차용증',
      '송금내역',
      '돈을 빌려준 사실이 나타나는 문자·메신저',
      '변제하기로 한 날짜가 나타나는 자료',
    ],
    chronologyExample: [
      { date: '2026년 1월 10일', event: '원고가 피고에게 3,000,000원을 빌려주기로 함' },
      { date: '2026년 1월 10일', event: '원고가 피고 계좌로 3,000,000원을 송금함' },
      { date: '2026년 2월 10일', event: '피고가 돈을 갚기로 약속한 날짜가 지남' },
      { date: '2026년 2월 12일', event: '원고가 문자로 돈을 갚아달라고 요청함' },
      { date: '2026년 2월 20일', event: '원고가 다시 변제를 요청했으나 돌려받지 못함' },
    ],
    completedCauseExample: [
      '1. 원고는 2026년 1월 10일 피고에게 3,000,000원을 빌려주기로 하였습니다.',
      '2. 원고는 같은 날 피고가 알려준 계좌로 3,000,000원을 송금하였습니다.',
      '3. 피고는 2026년 2월 10일까지 위 돈을 갚기로 하였습니다.',
      '4. 그러나 피고는 약속한 날짜가 지나도록 위 돈을 갚지 않았습니다.',
      '5. 원고는 2026년 2월 12일과 2026년 2월 20일 피고에게 돈을 갚아달라고 요청하였습니다.',
      '6. 그러나 피고는 현재까지 3,000,000원을 반환하지 않았습니다.',
      '7. 이에 원고는 피고에게 대여금 3,000,000원의 지급을 구합니다.',
    ],
    causeWritingChecklist: [
      '돈을 빌려주기로 한 날짜',
      '실제로 돈을 보낸 날짜',
      '갚기로 약속한 날짜',
      '변제를 요청한 날짜',
      '현재까지 갚지 않은 사실',
    ],
    finalTitle: '대여금 반환 연습 완료',
  },
  used_goods_refund: {
    label: '중고거래 대금 반환',
    defaultPracticeTitle: '중고거래 대금 반환 연습',
    shortDescription:
      '돈을 보냈지만 물건을 받지 못했거나 설명과 다른 물건을 받은 경우를 연습합니다.',
    exampleSituation: '중고 물품 대금을 보냈지만 물건을 받지 못했거나 설명과 다른 물건을 받은 경우',
    claimantDescription: '대금을 보낸 구매자',
    opponentDescription: '판매자',
    claimSummaryLabel: '중고거래 대금',
    factPrompt: '판매글 확인, 대금 송금, 물건 미수령 또는 설명과 다른 물건 수령, 환불 요청 사정을 날짜 순서로 적어봅니다.',
    evidenceExamples: [
      '판매글 또는 상품 설명',
      '송금·결제내역',
      '판매자와 주고받은 대화',
      '실제 받은 물건 사진 또는 미수령 관련 자료',
    ],
    chronologyExample: [
      { date: '2026년 3월 2일', event: '중고거래 앱에서 노트북을 480,000원에 구매하기로 함' },
      { date: '2026년 3월 2일', event: '판매자가 알려준 계좌로 480,000원을 송금함' },
      { date: '2026년 3월 4일', event: '판매자가 약속한 발송일까지 물건을 보내지 않음' },
      { date: '2026년 3월 5일', event: '물건 발송 또는 대금 반환을 요청함' },
      { date: '2026년 3월 7일', event: '다시 반환을 요청했으나 돌려받지 못함' },
    ],
    completedCauseExample: [
      '1. 원고는 2026년 3월 2일 중고거래 앱에서 피고가 판매한 노트북을 480,000원에 구매하기로 하였습니다.',
      '2. 원고는 같은 날 피고가 알려준 계좌로 물품대금 480,000원을 송금하였습니다.',
      '3. 피고는 2026년 3월 4일까지 노트북을 발송하기로 하였습니다.',
      '4. 그러나 피고는 약속한 날짜까지 노트북을 발송하지 않았습니다.',
      '5. 원고는 2026년 3월 5일과 2026년 3월 7일 피고에게 물건을 보내거나 지급한 대금을 돌려달라고 요청하였습니다.',
      '6. 그러나 피고는 현재까지 물건을 보내지 않았고, 원고가 지급한 480,000원도 반환하지 않았습니다.',
      '7. 이에 원고는 피고에게 지급한 물품대금 480,000원의 반환을 구합니다.',
    ],
    causeWritingChecklist: [
      '상품을 구매하기로 한 날짜',
      '상품명과 약속한 금액',
      '실제로 돈을 보낸 날짜',
      '상대방이 약속한 발송 내용과 날짜',
      '물건을 받지 못했거나 설명과 다른 사실',
      '환불이나 반환을 요구한 날짜',
      '현재까지 해결되지 않은 사실',
    ],
    finalTitle: '중고거래 대금 반환 연습 완료',
  },
  goods_payment: {
    label: '물품대금 청구',
    defaultPracticeTitle: '물품대금 청구 연습',
    shortDescription: '물건을 납품했지만 약속한 대금을 받지 못한 경우를 연습합니다.',
    exampleSituation: '주문받은 물건을 전달했지만 약속한 대금을 지급받지 못한 경우',
    claimantDescription: '물건을 납품한 사람',
    opponentDescription: '대금을 지급해야 하는 사람',
    claimSummaryLabel: '물품대금',
    factPrompt: '계약 또는 주문 내용, 납품한 날짜와 물품, 청구한 대금, 아직 받지 못한 사정을 날짜 순서로 적어봅니다.',
    evidenceExamples: [
      '계약서·주문서',
      '납품서·거래명세표',
      '세금계산서 또는 대금 청구자료',
      '물품을 전달한 사실이 나타나는 자료',
    ],
    chronologyExample: [
      { date: '2026년 4월 1일', event: '원고가 피고에게 사무용 의자 20개를 납품하기로 함' },
      { date: '2026년 4월 10일', event: '원고가 사무용 의자 20개를 피고에게 납품함' },
      { date: '2026년 4월 30일', event: '피고가 물품대금 2,000,000원을 지급하기로 한 날짜가 지남' },
      { date: '2026년 5월 3일', event: '원고가 물품대금 지급을 요청함' },
      { date: '2026년 5월 10일', event: '다시 지급을 요청했으나 대금을 받지 못함' },
    ],
    completedCauseExample: [
      '1. 원고는 2026년 4월 1일 피고에게 사무용 의자 20개를 공급하기로 하였습니다.',
      '2. 원고는 2026년 4월 10일 약속한 사무용 의자 20개를 피고에게 납품하였습니다.',
      '3. 피고는 2026년 4월 30일까지 물품대금 2,000,000원을 지급하기로 하였습니다.',
      '4. 그러나 피고는 약속한 지급일까지 물품대금을 지급하지 않았습니다.',
      '5. 원고는 2026년 5월 3일과 2026년 5월 10일 피고에게 물품대금 지급을 요청하였습니다.',
      '6. 그러나 피고는 현재까지 물품대금 2,000,000원을 지급하지 않았습니다.',
      '7. 이에 원고는 피고에게 미지급 물품대금 2,000,000원의 지급을 구합니다.',
    ],
    causeWritingChecklist: [
      '물품을 공급하기로 한 날짜',
      '공급한 물품의 종류와 수량',
      '실제로 납품한 날짜',
      '약속한 물품대금',
      '대금 지급일',
      '지급을 요청한 날짜',
      '현재까지 지급받지 못한 사실',
    ],
    finalTitle: '물품대금 청구 연습 완료',
  },
  service_payment: {
    label: '용역대금 청구',
    defaultPracticeTitle: '용역대금 청구 연습',
    shortDescription: '일을 완료했지만 약속한 비용을 받지 못한 경우를 연습합니다.',
    exampleSituation: '요청받은 일을 마치고 결과물을 전달했지만 비용을 받지 못한 경우',
    claimantDescription: '일을 완료한 사람',
    opponentDescription: '비용을 지급해야 하는 사람',
    claimSummaryLabel: '용역대금',
    factPrompt: '요청받은 업무, 수행한 내용, 완료 또는 결과물 전달, 약속한 비용과 지급일을 날짜 순서로 적어봅니다.',
    evidenceExamples: [
      '계약서·견적서',
      '업무 요청 내용',
      '작업 완료 또는 결과물 전달 자료',
      '비용과 지급일에 관한 대화',
    ],
    chronologyExample: [
      { date: '2026년 5월 1일', event: '원고가 피고의 홈페이지를 제작하기로 함' },
      { date: '2026년 5월 20일', event: '원고가 홈페이지 제작을 완료하고 결과물을 전달함' },
      { date: '2026년 5월 31일', event: '피고가 용역대금 1,500,000원을 지급하기로 한 날짜가 지남' },
      { date: '2026년 6월 2일', event: '원고가 용역대금 지급을 요청함' },
      { date: '2026년 6월 10일', event: '다시 지급을 요청했으나 대금을 받지 못함' },
    ],
    completedCauseExample: [
      '1. 원고는 2026년 5월 1일 피고의 홈페이지를 제작하기로 하였습니다.',
      '2. 원고와 피고는 홈페이지 제작대금을 1,500,000원으로 정하였습니다.',
      '3. 원고는 2026년 5월 20일 홈페이지 제작을 완료하고 결과물을 피고에게 전달하였습니다.',
      '4. 피고는 2026년 5월 31일까지 용역대금 1,500,000원을 지급하기로 하였습니다.',
      '5. 그러나 피고는 약속한 지급일까지 용역대금을 지급하지 않았습니다.',
      '6. 원고는 2026년 6월 2일과 2026년 6월 10일 피고에게 용역대금 지급을 요청하였습니다.',
      '7. 그러나 피고는 현재까지 용역대금 1,500,000원을 지급하지 않았습니다.',
      '8. 이에 원고는 피고에게 미지급 용역대금 1,500,000원의 지급을 구합니다.',
    ],
    causeWritingChecklist: [
      '어떤 일을 하기로 했는지',
      '계약하거나 합의한 날짜',
      '약속한 용역대금',
      '업무를 완료한 날짜',
      '결과물을 전달한 사실',
      '대금 지급일',
      '지급을 요청한 날짜',
      '현재까지 지급받지 못한 사실',
    ],
    finalTitle: '용역대금 청구 연습 완료',
  },
};

const SELECTABLE_CASE_TYPES: CaseType[] = [
  'loan_return',
  'used_goods_refund',
  'goods_payment',
  'service_payment',
];

const DISABLED_CASE_TYPE_CARDS = ['임대차보증금 반환', '임금체불'];
const CAUSE_EXAMPLE_TABS: Array<{ mode: CauseExampleMode; label: string }> = [
  { mode: 'chronology', label: '날짜순 정리 예시' },
  { mode: 'completed', label: '완성된 작성 예시' },
];

const CLAIM_REASON_AI_LIMIT = 3;
const CLAIM_REASON_AI_NOTICE = '본 문장은 연습용 AI 초안이며 실제 법률자문이 아닙니다.';

const PRACTICE_LOGIN_GUIDES: Record<
  PracticeLoginMethod,
  {
    title: string;
    description: string;
    suitableFor: string[];
    steps: string[];
    buttonLabel: string;
  }
> = {
  certificate: {
    title: '공동인증서',
    description:
      '은행이나 인증기관에서 발급받아 컴퓨터, USB 또는 스마트폰 등에 보관하는 전자 신분증입니다. 인증서가 저장된 위치와 인증서 비밀번호를 알고 있어야 합니다.',
    suitableFor: ['이미 공동인증서를 가지고 있음', '저장 위치와 비밀번호를 알고 있음'],
    steps: ['인증서 저장 위치 선택', '본인 인증서 선택', '인증서 비밀번호 입력', '로그인 확인'],
    buttonLabel: '공동인증서 로그인(연습)',
  },
  simple: {
    title: '간편인증',
    description:
      '휴대전화의 인증 앱 등을 이용해 본인임을 확인하는 방식입니다. 휴대전화로 인증 요청을 받은 뒤 앱에서 승인합니다.',
    suitableFor: ['휴대전화 인증이 익숙함', '본인 명의 휴대전화와 인증 앱을 사용함'],
    steps: ['인증 서비스 선택', '본인 정보 확인', '휴대전화 인증 요청 확인', '앱에서 승인', '인증 완료 확인'],
    buttonLabel: '간편인증(연습)',
  },
};

const SIMPLE_AUTH_APP_EXAMPLES = ['통신사 PASS', '카카오톡', '네이버', '토스'];

function makeInitialPracticeState(practicePortalLoginCompleted: boolean): LawsuitPracticeState {
  return practicePortalLoginCompleted ? { ...INITIAL_STATE, isLoggedIn: true } : INITIAL_STATE;
}

function formatAmount(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return value.trim() || '금액 미입력';
  return `${Number(digits).toLocaleString('ko-KR')}원`;
}

function buildClaimPurpose(state: LawsuitPracticeState, caseConfig: PracticeCaseTypeConfig) {
  return `피고는 원고에게 ${caseConfig.claimSummaryLabel} ${formatAmount(
    state.suitAmount,
  )}을 지급하라.`;
}

function buildPracticeTimeline(state: LawsuitPracticeState, caseConfig: PracticeCaseTypeConfig) {
  return [
    {
      title: `${caseConfig.label} 기본정보 확인`,
      body: `${state.caseName || caseConfig.defaultPracticeTitle} 연습기록의 청구하려는 금액을 ${formatAmount(
        state.suitAmount,
      )} 기준으로 확인합니다.`,
    },
    {
      title: '당사자 정보 점검',
      body: `${caseConfig.claimantDescription}인 원고 ${
        state.plaintiffName || '원고명 미입력'
      }와 ${caseConfig.opponentDescription}인 피고 ${
        state.defendantName || '피고명 미입력'
      }의 표시가 맞는지 다시 확인합니다.`,
    },
    {
      title: '청구취지 검토',
      body: state.claimPurpose || buildClaimPurpose(state, caseConfig),
    },
    {
      title: `${caseConfig.label} 사실관계 보완`,
      body: state.claimReason || caseConfig.factPrompt,
    },
    {
      title: '증거 첨부 준비',
      body: state.evidenceList.length
        ? `${state.evidenceList.join(', ')} 자료를 첨부서류 후보로 정리합니다.`
        : `${caseConfig.evidenceExamples.join(', ')} 등을 연습용 증거자료 예시로 확인합니다.`,
    },
  ];
}

function makeMockCaseNumber() {
  return `2026가소${Math.floor(10000 + Math.random() * 90000)}`;
}

export function LawsuitPracticePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const practicePortalLoginCompleted = Boolean(
    (location.state as PracticePortalNavigationState | null)?.practicePortalLoginCompleted,
  );
  const [step, setStep] = useState(practicePortalLoginCompleted ? 1 : 0);
  const [state, setState] = useState<LawsuitPracticeState>(() =>
    makeInitialPracticeState(practicePortalLoginCompleted),
  );
  const [claimReasonAiRemaining, setClaimReasonAiRemaining] = useState(CLAIM_REASON_AI_LIMIT);
  const [isGeneratingClaimReason, setIsGeneratingClaimReason] = useState(false);
  const [isSavingPracticeCase, setIsSavingPracticeCase] = useState(false);
  const [selectedLoginMethod, setSelectedLoginMethod] = useState<PracticeLoginMethod | null>(null);
  const [pendingCaseType, setPendingCaseType] = useState<CaseType | null>(null);
  const [activeCauseExampleMode, setActiveCauseExampleMode] =
    useState<CauseExampleMode | null>(null);
  const { hasConsent, isSaving: isSavingConsent, grantConsent } = useSensitiveConsent('sensitiveLegal');

  const isFinalStep = step === STEP_LABELS.length - 1;
  const isCompleted = Boolean(state.mockCaseNumber);
  const selectedCaseConfig = PRACTICE_CASE_TYPE_CONFIGS[state.caseType];
  const claimExample = useMemo(
    () => buildClaimPurpose(state, selectedCaseConfig),
    [selectedCaseConfig, state.suitAmount],
  );
  const timeline = useMemo(
    () => buildPracticeTimeline(state, selectedCaseConfig),
    [selectedCaseConfig, state],
  );
  const reviewRows = useMemo<ReviewRow[]>(
    () => [
      { label: '사건유형', value: selectedCaseConfig.label },
      { label: '연습 사건 이름', value: state.caseName || selectedCaseConfig.defaultPracticeTitle },
      { label: '청구하려는 금액', value: formatAmount(state.suitAmount) },
      { label: '원고', value: state.plaintiffName || '미입력' },
      { label: '피고', value: state.defendantName || '미입력' },
      { label: '청구취지', value: state.claimPurpose || claimExample },
      { label: '청구원인', value: state.claimReason || '미입력' },
    ],
    [claimExample, selectedCaseConfig.defaultPracticeTitle, selectedCaseConfig.label, state],
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
    setSelectedLoginMethod(null);
    setPendingCaseType(null);
    setActiveCauseExampleMode(null);
  };

  const loginPractice = () => {
    setState((prev) => ({ ...prev, isLoggedIn: true }));
    setStep(1);
  };

  const addEvidence = () => {
    setState((prev) => {
      const seed = selectedCaseConfig.evidenceExamples;
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
      claimPurpose: prev.claimPurpose.trim() || buildClaimPurpose(prev, selectedCaseConfig),
      mockCaseNumber: makeMockCaseNumber(),
    }));
  };

  const hasCaseSpecificInput = () =>
    Boolean(
      state.caseName.trim() !== selectedCaseConfig.defaultPracticeTitle ||
        state.suitAmount.trim() ||
        state.plaintiffName.trim() ||
        state.plaintiffBirth.trim() ||
        state.defendantName.trim() ||
        state.claimPurpose.trim() ||
        state.claimReason.trim() ||
        state.evidenceList.length ||
        state.mockCaseNumber,
    );

  const applyCaseTypeChange = (caseType: CaseType) => {
    const nextCaseConfig = PRACTICE_CASE_TYPE_CONFIGS[caseType];
    setState((prev) => ({
      ...prev,
      caseType,
      caseName: nextCaseConfig.defaultPracticeTitle,
      suitAmount: '',
      plaintiffName: '',
      plaintiffBirth: '',
      defendantName: '',
      claimPurpose: '',
      claimReason: '',
      evidenceList: [],
      mockCaseNumber: '',
    }));
    setIsGeneratingClaimReason(false);
    setPendingCaseType(null);
    setActiveCauseExampleMode(null);
  };

  const handleCaseTypeSelect = (caseType: CaseType) => {
    if (caseType === state.caseType) return;
    if (hasCaseSpecificInput()) {
      setPendingCaseType(caseType);
      return;
    }
    applyCaseTypeChange(caseType);
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
        caseName: state.caseName.trim() || selectedCaseConfig.defaultPracticeTitle,
        suitAmount: state.suitAmount,
        plaintiffName: state.plaintiffName,
        defendantName: state.defendantName,
        claimPurpose: state.claimPurpose.trim() || buildClaimPurpose(state, selectedCaseConfig),
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
      caseType: selectedCaseConfig.label,
      remainingBefore: claimReasonAiRemaining,
    });

    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(functions, 'generateLawsuitClaimReason');
      const result = await fn({
        caseType: selectedCaseConfig.label,
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

  if (hasConsent === false) {
    return <SensitiveConsentGate category="legal" isSaving={isSavingConsent} onAgree={grantConsent} />;
  }

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

        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/lawsuit-practice')}
            className="lawsuit-button inline-flex items-center justify-center border border-[#185FA5] bg-white px-4 text-sm text-[#185FA5]"
          >
            전자소송포털 화면부터 연습하기
          </button>
        </div>

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
                  나홀로{' '}
                  <LegalTermHelp
                    term="전자소송"
                    className="inline align-baseline font-semibold text-white underline decoration-dotted underline-offset-4"
                  />
                  에서 자주 만나는 단순 금전청구 사건을 11단계 흐름으로 연습합니다.
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[#dceeff]">
                  <p>전자소송연습비서는 실제 소송을 대신 진행하는 기능이 아닙니다.</p>
                  <p>
                    <LegalTermHelp
                      term="나홀로소송"
                      className="inline align-baseline font-semibold text-white underline decoration-dotted underline-offset-4"
                    />
                    을 준비하는 사용자가 절차, 서류,{' '}
                    <LegalTermHelp
                      term="증거"
                      className="inline align-baseline font-semibold text-white underline decoration-dotted underline-offset-4"
                    />
                    자료, 송달확인, 보정기한 관리를 미리 연습하도록 돕는 체크리스트 비서입니다.
                  </p>
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
                <div className="mb-5 rounded-lg border border-[#bfd7ef] bg-[#f3f9ff] p-5">
                  <h3 className="text-base font-extrabold text-[#1f2937]">
                    어떤 로그인을 선택해야 하나요?
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(Object.entries(PRACTICE_LOGIN_GUIDES) as Array<[PracticeLoginMethod, typeof PRACTICE_LOGIN_GUIDES[PracticeLoginMethod]]>).map(
                      ([method, guide]) => (
                        <article
                          key={method}
                          className={`rounded-lg border bg-white p-4 ${
                            selectedLoginMethod === method ? 'border-[#185FA5]' : 'border-[#dbe3ec]'
                          }`}
                        >
                          <h4 className="text-sm font-extrabold text-[#185FA5]">{guide.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-[#475569]">{guide.description}</p>
                          <p className="mt-3 text-xs font-extrabold text-[#1f2937]">이런 분께 적합합니다</p>
                          <ul className="mt-1 space-y-1 text-xs leading-5 text-[#64748b]">
                            {guide.suitableFor.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </article>
                      ),
                    )}
                  </div>
                  <p className="mt-4 rounded-md border border-[#dbe3ec] bg-white px-3 py-2 text-xs leading-5 text-[#64748b]">
                    실제 전자소송포털에서 제공하는 인증수단과 진행 순서는 공식 화면에서 다시 확인하세요.
                  </p>
                </div>
                <div className="mb-4 rounded-lg border border-[#fca5a5] bg-[#fff5f5] px-4 py-3 text-sm font-bold leading-6 text-[#b42318]">
                  이 화면은 로그인 과정을 익히는 연습입니다.
                  <br />
                  실제 인증서 비밀번호, 주민등록번호 또는 개인정보를 입력하지 않습니다.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLoginMethod('certificate')}
                    className={`lawsuit-button border px-5 ${
                      selectedLoginMethod === 'certificate'
                        ? 'border-[#185FA5] bg-[#f3f9ff] text-[#185FA5]'
                        : 'border-[#185FA5] bg-white text-[#185FA5]'
                    }`}
                  >
                    공동인증서 로그인(연습)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLoginMethod('simple')}
                    className={`lawsuit-button border px-5 ${
                      selectedLoginMethod === 'simple'
                        ? 'border-[#185FA5] bg-[#0f4f8f] text-white'
                        : 'border-[#185FA5] bg-[#185FA5] text-white'
                    }`}
                  >
                    간편인증(연습)
                  </button>
                </div>
                {selectedLoginMethod && (
                  <div className="mt-5 rounded-lg border border-[#dbe3ec] bg-white p-5">
                    <h3 className="text-base font-extrabold text-[#1f2937]">
                      {PRACTICE_LOGIN_GUIDES[selectedLoginMethod].buttonLabel}을 선택했습니다
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#64748b]">
                      실제 인증 화면으로 이동하지 않고, 아래 순서를 글로만 먼저 익힙니다.
                    </p>
                    <ol className="mt-4 space-y-2">
                      {PRACTICE_LOGIN_GUIDES[selectedLoginMethod].steps.map((item, index) => (
                        <li
                          key={item}
                          className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm leading-6 text-[#475569]"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f2fb] text-xs font-extrabold text-[#185FA5]">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <span>{item}</span>
                            {selectedLoginMethod === 'simple' && index === 0 && (
                              <div className="mt-3 rounded-md border border-[#cbd5e1] bg-white p-3">
                                <p className="text-xs font-extrabold text-[#1f2937]">
                                  간편인증 앱의 예
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  {SIMPLE_AUTH_APP_EXAMPLES.map((example) => (
                                    <span
                                      key={example}
                                      className="min-w-0 rounded-md border border-[#dbe3ec] bg-[#f8fafc] px-2.5 py-2 text-center text-xs font-bold leading-5 text-[#334155]"
                                    >
                                      {example}
                                    </span>
                                  ))}
                                </div>
                                <p className="mt-3 text-xs leading-5 text-[#64748b]">
                                  위 서비스는 간편인증 방식을 이해하기 위한 예시입니다.
                                  <br />
                                  실제 사용할 수 있는 인증수단은 전자소송포털의
                                  <br />
                                  간편인증 선택 화면에서 확인하세요.
                                </p>
                                <p className="mt-2 text-xs leading-5 text-[#64748b]">
                                  평소 사용하는 앱이 실제 선택 목록에 없다면 다른 인증방법을
                                  선택하거나 해당 인증 앱에서 인증서를 먼저 발급받아야 할 수
                                  있습니다.
                                </p>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                    {selectedLoginMethod === 'simple' && (
                      <p className="mt-3 text-xs leading-5 text-[#64748b]">
                        간편인증 서비스의 종류와 제공 여부는 실제 전자소송포털 공식 화면에서 다시 확인해야 합니다.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={loginPractice}
                      className="lawsuit-button mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#185FA5] px-5 text-white"
                    >
                      연습 로그인 완료하고 다음 단계로
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
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
                  title="어떤 사건을 연습할까요?"
                  subtitle="돈을 돌려받거나 대금을 청구하려는 이유와 가장 가까운 항목을 선택하세요."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {SELECTABLE_CASE_TYPES.map((caseType) => {
                    const caseConfig = PRACTICE_CASE_TYPE_CONFIGS[caseType];
                    const selected = state.caseType === caseType;
                    return (
                      <button
                        key={caseType}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => handleCaseTypeSelect(caseType)}
                        className={`min-h-[190px] rounded-lg border p-5 text-left transition ${
                          selected
                            ? 'border-[#185FA5] bg-[#f3f9ff] shadow-[0_14px_28px_-24px_rgba(24,95,165,0.55)]'
                            : 'border-[#dbe3ec] bg-white hover:border-[#9fc8ed]'
                        }`}
                      >
                        <div
                          className={
                            selected
                              ? 'mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#185FA5]'
                              : 'mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#f8fafc] text-[#64748b]'
                          }
                        >
                          <Scale className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 text-base font-extrabold text-[#1f2937]">
                            {caseConfig.label}
                          </div>
                          <span
                            className={
                              selected
                                ? 'inline-flex w-fit rounded bg-[#185FA5] px-3 py-1 text-xs font-bold text-white'
                                : 'inline-flex w-fit rounded border border-[#cbd5e1] px-3 py-1 text-xs font-bold text-[#64748b]'
                            }
                          >
                            {selected ? '선택됨' : '선택 가능'}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#475569]">
                          {caseConfig.shortDescription}
                        </p>
                        <p className="mt-3 rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-xs leading-5 text-[#64748b]">
                          대표 상황: {caseConfig.exampleSituation}
                        </p>
                      </button>
                    );
                  })}
                  {DISABLED_CASE_TYPE_CARDS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      disabled
                      className="min-h-[150px] rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-left opacity-70"
                    >
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#94a3b8]">
                        <Scale className="h-5 w-5" />
                      </div>
                      <div className="text-base font-extrabold text-[#475569]">{label}</div>
                      <div className="mt-2 text-sm leading-5 text-[#64748b]">
                        별도 연습 흐름 준비 중
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-5 rounded-lg border border-[#dbe3ec] bg-[#f8fafc] px-4 py-3 text-xs leading-5 text-[#64748b]">
                  사건유형은 돈을 요구하게 된 원인을 구분하는 항목입니다.
                  <br />
                  실제 법원에서 사용하는 사건명이나 절차는 사건 내용에 따라 다를 수 있으므로 공식 안내를 확인하세요.
                </div>
                <div className="mt-4 rounded-lg border border-[#fca5a5] bg-[#fff5f5] p-5">
                  <h3 className="text-base font-extrabold text-[#b91c1c]">
                    전문가에게 확인하면 좋은 경우
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-[#475569]">
                    아래 요소가 있다면 나홀로소송 가능 여부를 이 화면에서 판단하지 말고, 쟁점을
                    정리해 전문가에게 일부 확인할 수 있습니다.
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
                    전자소송연습비서는 자료 정리와 질문 준비를 돕는 연습 화면이며, 승소 가능성이나
                    적합한 절차를 자동 판단하지 않습니다.
                  </p>
                </div>
                <div className="mt-4 rounded-lg border border-[#dbe3ec] bg-[#f8fafc] px-4 py-3 text-xs leading-5 text-[#64748b]">
                  <p>
                    이 연습은 전자소송 절차를 익히기 위한 예시입니다. 실제 사건에서는 샘플 문장을 그대로 제출하지 말고, 본인의 날짜, 금액, 당사자 정보, 증거자료에 맞게 수정해야 합니다.
                  </p>
                  <p className="mt-2">
                    지연손해금, 보정기한, <LegalTermHelp term="송달" /> 효력은 사건유형과 법원 문서에 따라 달라질 수 있으므로 자동으로 확정하지 않습니다. 반드시 전자소송포털과 법원 안내문을 직접 확인하세요.
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
                <SectionTitle
                  title={`${selectedCaseConfig.label} 기본정보`}
                  subtitle={
                    <>
                      HARU 안에서 구분할 연습기록 제목과 청구하려는 금액을 입력합니다.
                    </>
                  }
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="연습 사건 이름">
                    <input
                      value={state.caseName}
                      onChange={(event) => updateState('caseName', event.target.value)}
                      placeholder={`예: ${selectedCaseConfig.defaultPracticeTitle}`}
                      className="lawsuit-field"
                    />
                    <div className="mt-3 rounded-lg border border-[#dbe3ec] bg-[#f8fafc] px-3 py-3">
                      <p className="text-sm leading-6 text-[#475569]">
                        HARU에서 연습 내용을 구분하기 위한 이름입니다.
                        <br />
                        선택한 사건유형에 따라 자동으로 입력되며, 필요하면 알아보기 쉽게 바꿀
                        수 있습니다.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[#64748b]">
                        이 이름은 HARU 연습기록용 제목이며, 법원이 사용하는 공식 사건명이나
                        사건번호가 아닙니다. 실제 제출 화면에서는 전자소송포털의 안내를
                        확인하세요.
                      </p>
                    </div>
                  </Field>
                  <Field label="청구하려는 금액">
                    <input
                      value={state.suitAmount}
                      onChange={(event) => updateState('suitAmount', event.target.value)}
                      placeholder="예: 480000원"
                      className="lawsuit-field"
                    />
                    <div className="mt-3 rounded-lg border border-[#dbe3ec] bg-[#f8fafc] px-3 py-3">
                      <p className="text-sm font-bold leading-6 text-[#475569]">
                        법률용어로 ‘<LegalTermHelp term="소가" />’라고 합니다.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#64748b]">
                        이번 연습에서 상대방에게 지급해 달라고 요구하려는 금액을 입력하세요.
                        실제 소가 산정은 청구 내용에 따라 달라질 수 있으므로 법원 안내를
                        확인해야 합니다.
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-bold text-[#185FA5]">
                      표시 금액: {formatAmount(state.suitAmount)}
                    </p>
                  </Field>
                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <SectionTitle
                  title="당사자 입력"
                  subtitle={
                    <>
                      원고는 보통 {selectedCaseConfig.claimantDescription}, <LegalTermHelp term="피고" />는
                      보통 {selectedCaseConfig.opponentDescription}에 해당합니다. 실제 표시는 본인 자료로
                      직접 확인하세요.
                    </>
                  }
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={<><LegalTermHelp term="원고" />(나) 이름</>}>
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
                  <Field label={<><LegalTermHelp term="피고" />(상대방) 이름</>}>
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
                <SectionTitle
                  title={<><LegalTermHelp term="청구취지" /> 연습</>}
                  subtitle={`${selectedCaseConfig.label}에서 법원에 구하려는 결론을 짧게 정리합니다.`}
                />
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
                <SectionTitle
                  title={<><LegalTermHelp term="청구원인" /> 연습</>}
                  subtitle={selectedCaseConfig.factPrompt}
                />
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
                  <p className="mt-3 text-xs leading-5 text-[#64748b]">
                    AI 초안은 사용자가 입력한 내용을 정리하는 연습 기능입니다. 초안에
                    입력하지 않은 사실이나 날짜가 포함되지 않았는지 반드시 확인하세요.
                  </p>
                </div>
                <div className="mb-4 rounded-lg border border-[#bfd7ef] bg-[#f3f9ff] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-[#1f2937]">
                        이 연습사례의 작성 예시
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#64748b]">
                        먼저 있었던 일을 날짜순으로 정리하고, 그 내용을 청구원인 문장으로
                        바꾸는 과정을 살펴보세요.
                      </p>
                    </div>
                    {activeCauseExampleMode && (
                      <button
                        type="button"
                        onClick={() => setActiveCauseExampleMode(null)}
                        className="lawsuit-button inline-flex min-h-[38px] items-center justify-center border border-[#cbd5e1] bg-white px-4 text-sm text-[#475569]"
                      >
                        접기
                      </button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {CAUSE_EXAMPLE_TABS.map((tab) => {
                      const selected = activeCauseExampleMode === tab.mode;
                      return (
                        <button
                          key={tab.mode}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setActiveCauseExampleMode((prev) =>
                              prev === tab.mode ? null : tab.mode,
                            )
                          }
                          className={`lawsuit-button min-h-[42px] border px-4 text-sm ${
                            selected
                              ? 'border-[#185FA5] bg-white text-[#185FA5]'
                              : 'border-[#cbd5e1] bg-[#f8fafc] text-[#475569]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                  {activeCauseExampleMode === 'chronology' && (
                    <div className="mt-4 space-y-2">
                      {selectedCaseConfig.chronologyExample.map((item) => (
                        <div
                          key={`${item.date}-${item.event}`}
                          className="rounded-md border border-[#dbe3ec] bg-white p-3"
                        >
                          <div className="text-xs font-extrabold text-[#185FA5]">
                            {item.date}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[#475569]">{item.event}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeCauseExampleMode === 'completed' && (
                    <div className="mt-4 rounded-md border border-[#dbe3ec] bg-white p-4">
                      <div className="space-y-3">
                        {selectedCaseConfig.completedCauseExample.map((item) => (
                          <p key={item} className="whitespace-pre-wrap text-sm leading-7 text-[#475569]">
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeCauseExampleMode && (
                    <>
                      <div className="mt-4 rounded-md border border-[#dbe3ec] bg-white p-4">
                        <p className="text-sm font-extrabold text-[#1f2937]">
                          내 사건에 필요한 내용
                        </p>
                        <ul className="mt-2 space-y-1 text-sm leading-6 text-[#475569]">
                          {selectedCaseConfig.causeWritingChecklist.map((item) => (
                            <li key={item}>- {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-4 rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3 text-xs leading-5 text-[#9a3412]">
                        <p>위 내용은 가상의 연습사례에 맞춘 작성 예시입니다.</p>
                        <p className="mt-2">
                          실제 사건에서는 본인에게 실제로 있었던 사실과 확인 가능한 날짜만
                          입력하세요. 예시의 날짜·금액·상황을 그대로 복사하지 마세요.
                        </p>
                        <p className="mt-2">
                          HARU는 사용자가 입력하지 않은 사실이나 날짜를 임의로 만들어서는 안
                          됩니다.
                        </p>
                        <p className="mt-2">
                          실제 사건의 청구원인은 사건 내용과 증거에 따라 달라질 수 있습니다.
                          제출 전 법원 공식 안내를 확인하고, 필요한 경우 전문가 확인을
                          고려하세요.
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <div className="mb-3 rounded-lg border border-[#dbe3ec] bg-white p-4">
                  <p className="text-sm font-extrabold text-[#1f2937]">
                    이제 내 사건을 적어보세요
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#64748b]">
                    위 예시의 문장을 그대로 복사하지 말고, 본인에게 실제로 있었던 일을
                    날짜순으로 적으세요. 정확한 날짜를 모르면 자료를 다시 확인한 뒤
                    입력하세요.
                  </p>
                </div>
                <textarea
                  value={state.claimReason}
                  onChange={(event) => updateState('claimReason', event.target.value)}
                  placeholder={`예: ${selectedCaseConfig.factPrompt}`}
                  className="lawsuit-field min-h-[190px] resize-none leading-7"
                />
              </div>
            )}

            {step === 8 && (
              <div>
                <SectionTitle
                  title={<><LegalTermHelp term="증거" />·첨부서류</>}
                  subtitle={`${selectedCaseConfig.label}에서 참고할 수 있는 연습용 증거자료 예시를 확인합니다.`}
                />
                <div className="rounded-lg border-2 border-dashed border-[#9fb7d1] bg-[#f8fafc] p-6 text-center">
                  <UploadCloud className="mx-auto mb-3 h-8 w-8 text-[#185FA5]" />
                  <p className="font-extrabold">첨부서류 업로드 영역(연습)</p>
                  <p className="mt-2 text-sm text-[#64748b]">파일은 업로드되지 않습니다.</p>
                </div>
                <div className="mt-4 rounded-lg border border-[#dbe3ec] bg-[#f8fafc] p-4">
                  <p className="text-sm font-extrabold text-[#1f2937]">
                    {selectedCaseConfig.label} 증거자료 예시
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCaseConfig.evidenceExamples.map((item) => (
                      <span
                        key={item}
                        className="rounded bg-white px-3 py-1.5 text-xs font-bold leading-5 text-[#185FA5] ring-1 ring-[#dbe3ec]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#64748b]">
                    위 목록은 연습용 예시입니다. 이 자료만 있으면 충분하다는 뜻은 아니며,
                    실제 제출 전에는 본인의 사건 자료와 공식 안내를 직접 확인하세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addEvidence}
                  className="lawsuit-button mt-4 bg-[#185FA5] px-5 text-white"
                >
                  증거 추가(연습)
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(state.evidenceList.length
                    ? state.evidenceList
                    : selectedCaseConfig.evidenceExamples.slice(0, 2)
                  ).map((item) => (
                    <span
                      key={item}
                      className="rounded bg-[#e8f2fb] px-3 py-1 text-xs font-bold text-[#185FA5]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {step === 9 && (
              <div>
                <SectionTitle
                  title="작성 확인"
                  subtitle={`${selectedCaseConfig.label} 연습에서 입력한 주요 내용을 제출 전 표로 확인합니다.`}
                />
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
                  <h2 className="text-2xl font-extrabold text-[#1f2937]">
                    {selectedCaseConfig.finalTitle}
                  </h2>
                  <p className="mt-1 text-base font-extrabold text-[#475569]">접수완료(연습)</p>
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

      {pendingCaseType && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/42 px-4">
          <div className="w-full max-w-[420px] rounded-xl border border-[#dbe3ec] bg-white p-5 shadow-xl">
            <h3 className="text-base font-extrabold text-[#1f2937]">사건유형 변경</h3>
            <p className="mt-3 text-sm leading-6 text-[#475569]">
              사건유형을 변경하면 이후 단계에서 입력한 사건 내용이 초기화됩니다. 변경할까요?
            </p>
            <p className="mt-2 text-xs leading-5 text-[#64748b]">
              변경할 유형: {PRACTICE_CASE_TYPE_CONFIGS[pendingCaseType].label}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPendingCaseType(null)}
                className="lawsuit-button border border-[#cbd5e1] bg-white px-4 text-[#475569]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => applyCaseTypeChange(pendingCaseType)}
                className="lawsuit-button bg-[#185FA5] px-4 text-white"
              >
                변경하기
              </button>
            </div>
          </div>
        </div>
      )}

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

function SectionTitle({ title, subtitle }: { title: ReactNode; subtitle: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-extrabold tracking-tight text-[#1f2937]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#64748b]">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold text-[#475569]">{label}</span>
      {children}
    </label>
  );
}

export default LawsuitPracticePage;
