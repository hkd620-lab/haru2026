import { useState } from 'react';
import { Calculator, CircleCheck, FileSearch, Gavel, Home, KeyRound, ShieldCheck, UserPlus, Wallet, type LucideIcon } from 'lucide-react';
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
  const amount = Number(amountText.replace(/[^0-9]/g, ''));
  const rateNumber = Number(rate);
  const validRate = Number.isFinite(rateNumber) && rateNumber > 0 && rateNumber <= 100;
  const deposit = amount > 0 && validRate ? Math.round((amount * rateNumber) / 100) : null;
  const inputStyle = { fontSize: 16 } as const; // 모바일 입력 확대 방지
  return (
    <div className="mt-3 rounded-lg border border-emerald-300 bg-white p-3">
      <p className="flex items-center gap-1 font-bold text-gray-900">
        <Calculator className="size-4" aria-hidden="true" />
        보증금 연습 계산
        <span className="ml-1 rounded bg-gray-800 px-1.5 py-0.5 text-sm font-bold text-white">연습</span>
      </p>
      <p className="mt-1 text-gray-700">입찰하려는 금액을 넣어 보증금이 얼마쯤 되는지 연습해 보세요.</p>
      <label className="mt-2 block font-semibold text-gray-900" htmlFor="onbid-practice-amount">입찰 금액 (원)</label>
      <input
        id="onbid-practice-amount"
        inputMode="numeric"
        autoComplete="off"
        value={amount > 0 ? amount.toLocaleString('ko-KR') : ''}
        onChange={(event) => setAmountText(event.target.value)}
        placeholder="예: 100,000,000"
        style={inputStyle}
        className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
      />
      <label className="mt-2 block font-semibold text-gray-900" htmlFor="onbid-practice-rate">보증금 비율 (%)</label>
      <input
        id="onbid-practice-rate"
        inputMode="decimal"
        autoComplete="off"
        value={rate}
        onChange={(event) => setRate(event.target.value.replace(/[^0-9.]/g, ''))}
        style={inputStyle}
        className="mt-1 min-h-[44px] w-full rounded-md border border-gray-300 px-3"
      />
      <p className="mt-1 text-gray-600">보통 입찰 금액의 10% 안팎이지만, 실제 비율은 물건 공고문이 기준입니다.</p>
      <p aria-live="polite" className="mt-2 rounded-md bg-emerald-50 px-3 py-2 font-bold text-emerald-900">
        {deposit === null ? '입찰 금액을 넣으면 보증금이 계산돼요.' : `연습 계산 보증금: 약 ${deposit.toLocaleString('ko-KR')}원`}
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
    easy: '온비드에 회원가입하고 입찰에 쓸 인증서를 등록하는 단계입니다.',
    userTasks: ['온비드(onbid.co.kr) 회원가입', '온비드가 안내하는 인증서를 \'나의 온비드\'에 등록', '입찰에 쓸 본인 명의 계좌 준비'],
    haruTasks: ['준비할 것 목록 안내', '이 화면에서 물건 조회'],
    note: '가입과 인증서 등록은 온비드 사이트에서 직접 합니다. HARU가 대신하지 않습니다.',
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
    note: '권리 확인은 입찰하는 본인의 몫입니다. HARU는 권리를 판단하거나 입찰 여부를 알려 드리지 않습니다.',
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
    userTasks: ['매각결정과 잔금 납부 기한 확인(물건·공고에 따라 다름)', '기한 안에 납부'],
    haruTasks: ['확인할 것 안내'],
    note: '기한 안에 내지 않으면 매각이 취소되고 보증금을 돌려받지 못할 수 있습니다. 기한은 HARU가 확정하지 않고 공고문·온비드 안내를 따릅니다.',
  },
  {
    short: '소유권 이전·점유 정리', icon: KeyRound, phase: 'finish',
    easy: '소유권을 넘겨받고, 점유하고 있는 사람이 있으면 정리하는 단계입니다.',
    userTasks: ['소유권 이전 절차 확인', '점유자가 있으면 정리(명도) 방법 확인', '필요하면 전문가 상담'],
    haruTasks: ['확인할 것 안내'],
    note: '명도 책임은 물건 종류에 따라 다릅니다. 낙찰자가 직접 해결해야 하는 경우가 많으니 입찰 전에 공고문을 확인하세요.',
  },
];

const SITUATIONS = [
  { label: '처음 알아봐요', index: 0 },
  { label: '물건을 보고 있어요', index: 1 },
  { label: '입찰하려고 해요', index: 3 },
  { label: '낙찰됐어요', index: 5 },
];

export function OnbidFlowMap() {
  return (
    <div className="mb-5">
      <FlowTimeline
        id="onbid-flow"
        title="공매, 한눈에 보는 흐름"
        intro="온비드 공매는 한국자산관리공사(캠코)가 온비드에서 전자로 진행하는 입찰입니다. 법원이 진행하는 법원경매와는 다른 제도예요. 물건마다 다를 수 있어요. 단계를 누르면 자세히 볼 수 있어요."
        phases={PHASES}
        steps={STEPS}
        situations={SITUATIONS}
        footer="이 흐름과 연습 계산은 이해를 돕기 위한 안내입니다. HARU는 입찰을 권유하거나 대신하지 않으며, 낙찰 가능성과 수익을 알려 드리지 않습니다. 실제 입찰은 온비드에서 직접 하고, 물건별 공고문이 기준입니다."
      />
    </div>
  );
}
