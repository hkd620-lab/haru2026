import { CircleCheck, ClipboardList, FolderOpen, Flag, Gavel, Landmark, Mailbox, MessagesSquare, Send, type LucideIcon } from 'lucide-react';
import { guideSteps } from '../utils/litigationGuideSteps';
import { FlowTimeline, type FlowPhase, type FlowStep } from './FlowTimeline';

// 소송 전체 흐름을 한눈에 보여 주는 단계 흐름도. 설명 문구는 나홀로소송 9단계 안내(litigationGuideSteps)를 그대로 쓴다.
// HARU는 법률 판단·기한 확정·실제 법원 제출을 대신하지 않는다 — 이 화면은 흐름을 이해시키는 안내다.
// 화면 그리기는 공용 FlowTimeline(온비드 공매 흐름도와 같은 컴포넌트)이 맡는다.

type Phase = 'prepare' | 'submit' | 'proceed' | 'finish';

const PHASES: Record<Phase, FlowPhase> = {
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

// guideSteps 문구와 STEP_VIEWS 모양을 합친다. 짝이 없는 단계는 이전처럼 보여 주지 않는다.
const STEPS: FlowStep[] = guideSteps.flatMap((step, index) => {
  const view = STEP_VIEWS[index];
  if (!view) return [];
  return [{
    short: view.short,
    icon: view.icon,
    phase: view.phase,
    action: view.action,
    easy: step.easy,
    userTasks: step.userTasks,
    haruTasks: step.haruTasks,
    note: step.note,
  }];
});

// "지금 내 상황은?" 바로가기 — 현재 위치로 표시할 단계 번호(0부터)
const SITUATIONS = [
  { label: '처음 준비해요', index: 0 },
  { label: '이미 제출했어요', index: 4 },
  { label: '법원에서 문서를 받았어요', index: 5 },
  { label: '판결이 나왔어요', index: 7 },
];

export function LitigationFlowMap() {
  return (
    <FlowTimeline
      id="litigation-flow"
      title="소송, 한눈에 보는 흐름"
      intro="일반적인 소송의 큰 흐름입니다. 사건에 따라 다를 수 있어요. 단계를 누르면 무엇을 하는지 자세히 볼 수 있어요."
      phases={PHASES}
      steps={STEPS}
      situations={SITUATIONS}
      guideLink={{ label: '자세한 전체 과정과 내 사건 점검표 보기', path: '/legal-assistant/guide' }}
      footer="이 흐름은 이해를 돕기 위한 안내입니다. HARU는 법률 판단, 법정 기한 확정, 실제 법원 제출을 대신하지 않습니다. 실제 진행은 법원 문서와 전자소송포털의 안내를 확인하세요."
    />
  );
}
