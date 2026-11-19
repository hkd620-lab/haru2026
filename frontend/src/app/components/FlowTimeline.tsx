import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';

// 단계 흐름도 공용 화면: 단계마다 아이콘·구간 색·한 줄 설명을 세로 타임라인으로 보여 주고, 눌러서 자세히 펼친다.
// 설명 문구는 호출하는 쪽이 정한다. 이 컴포넌트는 법률·투자 판단을 하지 않고 안내 문구를 그대로 그린다.

export type FlowPhase = { label: string; node: string; chip: string; panel: string };

export type FlowStep = {
  short: string;
  easy: string;
  userTasks: string[];
  haruTasks: string[];
  note?: string;
  icon: LucideIcon;
  phase: string;
  action?: { label: string; path: string };
  extra?: ReactNode;
};

export type FlowSituation = { label: string; index: number };

export function FlowTimeline({ id, title, intro, phases, steps, situations, footer, guideLink }: {
  id: string;
  title: string;
  intro: string;
  phases: Record<string, FlowPhase>;
  steps: FlowStep[];
  situations: FlowSituation[];
  footer: string;
  guideLink?: { label: string; path: string };
}) {
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
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
      <h2 id={`${id}-title`} className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-gray-600">{intro}</p>

      <div className="mt-3">
        <p className="text-sm font-semibold text-gray-900">지금 내 상황은?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {situations.map((situation) => (
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
        {steps.map((step, index) => {
          const phase = phases[step.phase];
          if (!phase) return null;
          const Icon = step.icon;
          const isOpen = openIndex === index;
          const isCurrent = currentIndex === index;
          const isLast = index === steps.length - 1;
          const startsPhase = index === 0 || steps[index - 1]?.phase !== step.phase;
          const panelId = `${id}-step-panel-${index}`;
          return (
            <li key={`${index}-${step.short}`} ref={(element) => { rowRefs.current[index] = element; }} className="relative flex gap-3">
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
                    <span className="block text-[17px] font-bold leading-6 text-gray-900">{step.short}</span>
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
                    {step.extra}
                    {step.action && (
                      <button
                        type="button"
                        onClick={() => navigate(step.action!.path, { state: { resetAssistantScroll: true } })}
                        className="mt-3 flex min-h-[44px] items-center gap-1 rounded-md bg-blue-600 px-4 text-sm font-bold text-white"
                      >
                        {step.action.label}
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

      {guideLink && (
        <button
          type="button"
          onClick={() => navigate(guideLink.path, { state: { resetAssistantScroll: true } })}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-1 rounded-md border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700"
        >
          {guideLink.label}
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      )}

      <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm leading-6 text-red-900">{footer}</p>
    </section>
  );
}
