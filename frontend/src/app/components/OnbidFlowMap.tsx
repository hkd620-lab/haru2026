import { useState } from 'react';
import { Calculator, ChevronDown, CircleCheck, FileSearch, Gavel, Home, KeyRound, ShieldCheck, UserPlus, Wallet } from 'lucide-react';
import { calculateOnbidDeposit } from '../utils/onbidDeposit';
import { FlowTimeline, type FlowPhase, type FlowStep } from './FlowTimeline';

// 온비드 공매 입찰 흐름도 + 보증금 연습 계산. 문구는 정해진 안내문이며 AI를 쓰지 않는다.
// 기한·보증금 비율·명도 책임처럼 물건과 공고마다 다른 값은 단정하지 않고 '공고문이 기준'으로 안내한다.
// HARU는 입찰을 권유하거나 대신하지 않고, 낙찰 가능성·수익을 알려 주지 않는다.

const PHASES: Record<string, FlowPhase> = {
  prepare: { label: '준비', node: 'bg-blue-600', chip: 'bg-blue-50 text-blue-800 border-blue-200', panel: 'border-blue-200 bg-blue-50/60' },
  bid: { label: '입찰', node: 'bg-emerald-700', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', panel: 'border-emerald-200 bg-emerald-50/60' },
  result: { label: '결과', node: 'bg-amber-700', chip: 'bg-amber-50 text-amber-900 border-amber-200', panel: 'border-amber-200 bg-amber-50/60' },
  finish: { label: '마무리', node: 'bg-violet-600', chip: 'bg-violet-50 text-violet-800 border-violet-200', panel: 'border-violet-200 bg-violet-50/60' },
};

function DepositPractice() {
  const [amountText, setAmountText] = useState('');
  const [rate, setRate] = useState('10');
  // 숫자만 받고 15자리까지로 제한한다(자바스크립트 정수 정밀도 한계 안). '1억'처럼 글자를 넣으면 안내한다.
  const digits = amountText.replace(/[^0-9]/g, '').slice(0, 15);
  const amount = digits ? Number(digits) : 0;
  const hasNonNumeric = /[^0-9,\s]/.test(amountText);
  // 비율은 입력한 글자 그대로 검사한다. '-10'·'1e2'처럼 기호를 지워 다른 숫자로 바꾸지 않고 안내한다.
  const deposit = calculateOnbidDeposit(amount, rate);
  const inputStyle = { fontSize: 16 } as const; // 모바일 입력 확대 방지
  return (
    <div className="mt-3 rounded-lg border border-emerald-300 bg-white p-3">
      <p className="flex items-center gap-1 font-bold text-gray-900">
        <Calculator className="size-4" aria-hidden="true" />
        보증금 연습 계산
        <span className="ml-1 rounded bg-gray-800 px-1.5 py-0.5 text-sm font-bold text-white">연습</span>
      </p>
      <p className="mt-1 text-gray-700">금액을 넣어 보증금이 얼마쯤 되는지 연습해 보세요.</p>
      <label className="mt-2 block font-semibold text-gray-900" htmlFor="onbid-practice-amount">기준 금액 (원) — 예: 최저입찰가(매각예정가격)</label>
      <input
        id="onbid-practice-amount"
        inputMode="numeric"
        autoComplete="off"
        value={amount > 0 ? amount.toLocaleString('ko-KR') : ''}
        onChange={(event) => setAmountText(event.target.value)}
        aria-describedby="onbid-practice-amount-help"
        placeholder="예: 100,000,000"
        style={inputStyle}
        className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
      />
      <p id="onbid-practice-amount-help" className={`mt-1 ${hasNonNumeric ? 'font-bold text-red-800' : 'text-gray-600'}`}>
        숫자만 입력해 주세요. 예: 100000000 (1억 원)
      </p>
      <label className="mt-2 block font-semibold text-gray-900" htmlFor="onbid-practice-rate">보증금 비율 (%)</label>
      <input
        id="onbid-practice-rate"
        inputMode="decimal"
        autoComplete="off"
        value={rate}
        onChange={(event) => setRate(event.target.value)}
        style={inputStyle}
        className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
      />
      <p className="mt-1 text-gray-600">
        보증금 비율과 무엇을 기준으로 계산하는지(최저입찰가, 입찰 금액 등)는 물건 공고문에 적혀 있습니다. 10%는 연습용 예시입니다. 실제 보증금과 잔금 납부기한은 해당 물건의 공고문을 확인하세요. 입력한 금액에 비율을 곱한 뒤, 원 미만 금액이 있으면 1원 단위로 올립니다.
      </p>
      <p aria-live="polite" className="mt-2 rounded-md bg-emerald-50 px-3 py-2 font-bold text-emerald-900">
        {deposit === null
          ? '보증금 비율은 0보다 크고 100 이하의 숫자로 넣어 주세요.'
          : hasNonNumeric
            ? '금액은 숫자로만 넣어 주세요. 예: 100000000'
            : amount === 0
              ? '기준 금액을 넣으면 보증금이 계산돼요.'
              : `연습 계산 보증금: 약 ${deposit.toLocaleString('ko-KR')}원`}
      </p>
      <p className="mt-2 text-gray-700">
        보증금 말고도 낙찰 후 나머지 대금과 점유 정리·수리 등 별도 비용이 들 수 있어요. 이 계산은 연습이며 실제 금액이 아닙니다.
      </p>
    </div>
  );
}

const STEPS: FlowStep[] = [
  {
    short: '가입·인증서 준비', icon: UserPlus, phase: 'prepare',
    easy: '온비드에 회원가입하고 입찰서에 전자서명할 방법을 준비합니다.',
    userTasks: ['온비드 회원가입', '개인회원은 간편인증서로 별도 등록 없이 입찰서에 전자서명 가능', '공동인증서를 쓰려면 본인 또는 사업자 명의의 전자거래 범용 공동인증서나 온비드 전용 공동인증서를 미리 등록', '입찰에 쓸 본인 명의 계좌 준비'],
    haruTasks: ['준비할 것 목록 안내', '이 화면에서 물건 조회'],
    note: '은행용·증권용 등 용도가 제한된 공동인증서는 입찰에 사용할 수 없습니다. 회원가입과 입찰 준비는 온비드에서 진행하세요.',
  },
  {
    short: '물건 고르기', icon: Home, phase: 'prepare',
    easy: '관심 있는 물건을 찾고 공고 내용을 읽어 보는 단계입니다.',
    userTasks: ['재산 유형·소재지·최저입찰가 확인', '입찰 기간과 입찰 방법 확인', '물건 공고문을 끝까지 읽기'],
    haruTasks: ['이 화면의 물건 조회(재산유형·지역별)', '입찰 일정·최저가·소재지 보기'],
    note: '같은 공매라도 물건 종류(압류재산·국유재산 등)마다 조건이 다릅니다. 공고문이 기준입니다.',
  },
  {
    short: '권리 확인', icon: FileSearch, phase: 'prepare',
    easy: '낙찰 뒤에 내가 떠안게 될 권리나 사정이 있는지 확인하는 단계입니다.',
    userTasks: ['등기부 등 권리관계 확인', '임차인·점유 현황 확인', '공고문의 유의사항 확인', '필요하면 전문가 상담'],
    haruTasks: ['확인할 항목 안내'],
    note: '사는 사람이 있으면 낙찰 뒤 내보내는 일(명도)이 내 책임이 될 수 있어요. 입찰 전에 꼭 확인하세요. 권리 확인은 입찰하는 본인의 몫입니다. HARU는 권리를 판단하거나 입찰 여부를 알려 드리지 않습니다.',
  },
  {
    short: '입찰보증금 준비', icon: Wallet, phase: 'bid',
    easy: '입찰할 때 함께 내는 보증금을 준비하는 단계입니다.',
    userTasks: ['공고문에서 보증금 비율 확인', '본인 명의 계좌로 준비(타인 명의는 문제가 될 수 있음)', '입찰 마감 전에 납부'],
    haruTasks: ['보증금 연습 계산(아래)'],
    note: '정확한 비율과 납부 방법은 물건 공고문과 온비드 안내가 기준입니다.',
    extra: <DepositPractice />,
  },
  {
    short: '전자 입찰', icon: ShieldCheck, phase: 'bid',
    easy: '입찰 기간 안에 온비드에서 입찰서를 전자로 제출하는 단계입니다.',
    userTasks: ['입찰 기간 안에 입찰 금액 입력·제출', '보증금 납부 확인', '제출한 내용 다시 확인'],
    haruTasks: ['제출 전 확인할 것 안내'],
    note: '실제 입찰은 온비드에서 직접 합니다. HARU는 입찰을 권유하거나 대신하지 않습니다.',
  },
  {
    short: '개찰·낙찰', icon: Gavel, phase: 'result',
    easy: '입찰이 마감된 뒤 결과가 나오는 단계입니다.',
    userTasks: ['\'나의 온비드\'에서 입찰 결과 확인', '낙찰 여부와 이후 일정 확인'],
    haruTasks: ['결과 확인 방법 안내'],
    note: '낙찰 결과와 이후 일정은 온비드 안내가 기준입니다. HARU는 낙찰 가능성을 알려 드리지 않습니다.',
  },
  {
    short: '잔금 납부', icon: CircleCheck, phase: 'result',
    easy: '낙찰된 뒤 정해진 기한 안에 나머지 대금을 내는 단계입니다.',
    userTasks: ['매각결정(또는 계약 체결)과 잔금 납부 기한 확인(물건·공고에 따라 다름)', '기한 안에 납부'],
    haruTasks: ['확인할 것 안내'],
    note: '기한이 짧을 수 있어요. 압류재산은 매각결정일부터 7일 이내가 원칙이고, 30일 범위에서 늘어날 수 있습니다. 입찰 전에 잔금 마련 계획을 세워 두세요. 기한 안에 내지 않으면 매각이 취소되고 보증금을 돌려받지 못할 수 있습니다. 실제 기한은 HARU가 확정하지 않고 공고문·온비드 안내를 따릅니다.',
  },
  {
    short: '소유권 이전·점유 정리', icon: KeyRound, phase: 'finish',
    easy: '소유권을 넘겨받고, 점유하고 있는 사람이 있으면 정리하는 단계입니다.',
    userTasks: ['소유권 이전 절차 확인', '점유자가 있으면 정리(명도) 방법 확인', '필요하면 전문가 상담'],
    haruTasks: ['확인할 것 안내'],
    note: '압류재산 공매는 점유자 정리(명도)를 낙찰자가 책임지는 것이 원칙입니다. 협의로 풀리는 경우도 있지만, 법원경매와 달리 인도명령 제도가 없어 명도소송이 필요할 수 있어요. 수탁재산처럼 책임이 다르게 정해진 물건도 있으니 공고문의 명도 책임 항목을 확인하세요.',
  },
];

const SITUATIONS = [
  { label: '처음 알아봐요', index: 0 },
  { label: '물건을 보고 있어요', index: 1 },
  { label: '입찰하려고 해요', index: 3 },
  { label: '낙찰됐어요', index: 6 },
];

export function OnbidFlowMap() {
  // 검색 폼이 첫 화면에서 밀려나지 않도록 기본은 접어 두고, 눌러서 펼친다.
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="onbid-flow-wrap"
        className="flex min-h-[56px] w-full items-center justify-between gap-2 rounded-lg border border-blue-200 bg-white px-4 py-3 text-left shadow-sm"
      >
        <span className="min-w-0">
          <span className="block text-[17px] font-bold text-gray-900">공매, 한눈에 보는 흐름</span>
          <span className="block text-sm leading-6 text-gray-600">가입부터 잔금까지 8단계 · 보증금 연습 계산</span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id="onbid-flow-wrap" className="mt-3">
          <FlowTimeline
            id="onbid-flow"
            title="공매, 한눈에 보는 흐름"
            intro="온비드 공매는 한국자산관리공사(캠코)가 운영하는 온비드에서 캠코와 공공기관 등이 전자로 진행하는 입찰입니다. 법원이 진행하는 법원경매와는 다른 제도예요. 물건마다 다를 수 있어요. 단계를 누르면 자세히 볼 수 있어요."
            phases={PHASES}
            steps={STEPS}
            situations={SITUATIONS}
            footer="이 흐름과 연습 계산은 이해를 돕기 위한 안내입니다. HARU는 입찰을 권유하거나 대신하지 않으며, 낙찰 가능성과 수익을 알려 드리지 않습니다. 실제 입찰은 온비드에서 직접 하고, 물건별 공고문이 기준입니다."
          />
        </div>
      )}
    </div>
  );
}
