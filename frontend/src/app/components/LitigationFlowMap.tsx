import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CircleCheck, ClipboardList, FolderOpen, Flag, Gavel, Landmark, Mailbox, MessagesSquare, Send, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { guideSteps } from '../utils/litigationGuideSteps';

// 소송 전체 흐름을 한눈에 보여 주는 단계 흐름도. 설명 문구는 나홀로소송 9단계 안내(litigationGuideSteps)를 그대로 쓴다.
// HARU는 법률 판단·기한 확정·실제 법원 제출을 대신하지 않는다 — 이 화면은 흐름을 이해시키는 안내다.

type Phase = 'prepare' | 'submit' | 'proceed' | 'finish';

const PHASES: Record<Phase, { label: string; node: string; chip: string; panel: string }> = {
  prepare: { label: '준비', node: 'bg-blue-600', chip: 'bg-blue-50 text-blue-800 border-blue-200', panel: 'border-blue-200 bg-blue-50/60' },
  submit: { label: '제출', node: 'bg-emerald-700', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', panel: 'border-emerald-200 bg-emerald-50/60' },
  proceed: { label: '진행', node: 'bg-amber-700', chip: 'bg-amber-50 text-amber-900 border-amber-200', panel: 'border-amber-200 bg-amber-50/60' },
  finish: { label: '마무리', node: 'bg-violet-600', chip: 'bg-violet-50 text-violet-800 border-violet-200', panel: 'border-violet-200 bg-violet-50/60' },
};

type StepView = { short: string; icon: LucideIcon; phase: Phase; action?: { label: string; path: string } };

// guideSteps와 같은 순서(9단계)
const STEP_VIEWS: StepView[] = [
  { short: '사건 정리', icon: ClipboardList, phase: 'prepare', action: { label: '전자소송 연습 시작하기', path: '/lawsuit-practice' } },
  { short: '절차·법원 확인', icon: Landmark, phase: 'prepare' },
  { short: '서류·증거 준비', icon: FolderOpen, phase: 'prepare', action: { label: '전자소송 연습 시작하기', path: '/lawsuit-practice' } },
  { short: '전자 제출', icon: Send, phase: 'submit', action: { label: '전자소송 연습 시작하기', path: '/lawsuit-practice' } },
  { short: '접수 확인', icon: CircleCheck, phase: 'submit', action: { label: '내 사건 체크리스트 열기', path: '/legal-cases' } },
  { short: '송달 확인', icon: Mailbox, phase: 'proceed', action: { label: '내 사건 체크리스트 열기', path: '/legal-cases' } },
  { short: '보정·답변·기일', icon: MessagesSquare, phase: 'proceed', action: { label: '받은 문서 확인하기', path: '/legal-assistant/document-helper' } },
  { short: '판결 확인', icon: Gavel, phase: 'finish' },
  { short: '판결 이후', icon: Flag, phase: 'finish' },
];

// "지금 내 상황은?" 바로가기 — 현재 위치로 표시할 단계 번호(0부터)
const SITUATIONS = [
  { label: '처음 준비해요', index: 0 },
  { label: '이미 제출했어요', index: 4 },
  { label: '법원에서 문서를 받았어요', index: 5 },
  { label: '판결이 나왔어요', index: 7 },
];

export function LitigationFlowMap() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  const chooseSituation = (index: number) => {
    setCurrentIndex(index);
    setOpenIndex(index);
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => rowRefs.current[index]?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }));
  };

  return (
    <section aria-labelledby="litigation-flow-title" className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
      <h2 id="litigation-flow-title" className="text-lg font-bold text-gray-900">소송, 한눈에 보는 흐름</h2>
      <p className="mt-1 text-sm leading-6 text-gray-600">
        일반적인 소송의 큰 흐름입니다. 사건에 따라 다를 수 있어요. 단계를 누르면 무엇을 하는지 자세히 볼 수 있어요.
      </p>

      <div className="mt-3">
        <p className="text-sm font-semibold text-gray-900">지금 내 상황은?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SITUATIONS.map((situation) => (
            <button
              key={situation.label}
              type="button"
              onClick={() => chooseSituation(situation.index)}
              aria-pressed={currentIndex === situation.index}
              className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${
                currentIndex === situation.index ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-800'
              }`}
            >
              {situation.label}
            </button>
          ))}
        </div>
      </div>

      <ol className="mt-5">
        {guideSteps.map((step, index) => {
          const view = STEP_VIEWS[index];
          if (!view) return null;
          const phase = PHASES[view.phase];
          const Icon = view.icon;
          const isOpen = openIndex === index;
          const isCurrent = currentIndex === index;
          const isLast = index === guideSteps.length - 1;
          const startsPhase = index === 0 || STEP_VIEWS[index - 1]?.phase !== view.phase;
          const panelId = `litigation-step-panel-${index}`;
          return (
            <li key={`${index}-${step.title}`} ref={(element) => { rowRefs.current[index] = element; }} className="relative flex gap-3">
              <div className="flex w-12 shrink-0 flex-col items-center">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white ${phase.node} ${isCurrent ? 'ring-4 ring-blue-200' : ''}`}>
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                {!isLast && <span aria-hidden="true" className="my-1 w-1 flex-1 rounded bg-gray-200" />}
              </div>
              <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                {startsPhase && (
                  <span className={`mb-1 inline-block rounded-full border px-2.5 py-0.5 text-sm font-bold ${phase.chip}`}>{phase.label}</span>
                )}
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className={`flex min-h-[56px] w-full items-start gap-2 rounded-lg border px-3 py-2 text-left ${
                    isCurrent ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">{phase.label} · {index + 1}단계</span>
                      {isCurrent && <span className="rounded bg-blue-600 px-1.5 py-0.5 text-sm font-bold text-white">내가 고른 단계</span>}
                    </span>
                    <span className="block text-[17px] font-bold leading-6 text-gray-900">{view.short}</span>
                    <span className="mt-0.5 block text-sm leading-6 text-gray-600">{step.easy}</span>
                  </span>
                  <ChevronDown className={`mt-3 size-5 shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>

                {isOpen && (
                  <div id={panelId} className={`mt-2 rounded-lg border p-3 text-sm leading-6 ${phase.panel}`}>
                    <p className="font-bold text-gray-900">내가 할 일</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-gray-800">
                      {step.userTasks.map((task) => <li key={task}>{task}</li>)}
                    </ul>
                    <p className="mt-3 font-bold text-gray-900">HARU가 도와드리는 일</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-gray-800">
                      {step.haruTasks.map((task) => <li key={task}>{task}</li>)}
                    </ul>
                    {step.note && <p className="mt-3 rounded-md bg-white/80 px-3 py-2 font-semibold text-red-900">{step.note}</p>}
                    {view.action && (
                      <button
                        type="button"
                        onClick={() => navigate(view.action!.path, { state: { resetAssistantScroll: true } })}
                        className="mt-3 flex min-h-[44px] items-center gap-1 rounded-md bg-blue-600 px-4 text-sm font-bold text-white"
                      >
                        {view.action.label}
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => navigate('/legal-assistant/guide', { state: { resetAssistantScroll: true } })}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-1 rounded-md border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700"
      >
        자세한 전체 과정과 내 사건 점검표 보기
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>

      <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm leading-6 text-red-900">
        이 흐름은 이해를 돕기 위한 안내입니다. HARU는 법률 판단, 법정 기한 확정, 실제 법원 제출을 대신하지 않습니다.
        실제 진행은 법원 문서와 전자소송포털의 안내를 확인하세요.
      </p>
    </section>
  );
}
