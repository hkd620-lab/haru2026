import { useState } from 'react';
import { BookOpen, ChevronDown, Download, Hourglass, Send, Upload } from 'lucide-react';
import { FlowTimeline, type FlowPhase, type FlowStep } from './FlowTimeline';

// SNS 갈무리(Facebook 기록 가져오기)의 큰 순서를 한눈에 보여 주는 흐름도. 정해진 안내문이며 AI를 쓰지 않는다.
// Facebook 화면의 메뉴 이름·순서는 Facebook이 바꿀 수 있어 구체적으로 적지 않고, 설명과 다르면 Facebook 안내를 따르라고 알린다.
// 파일 형식(JSON)·준비 시간·받을 수 있는 기한은 이 화면의 기존 안내(STEP 2)와 같은 내용이다.

const PHASES: Record<string, FlowPhase> = {
  ready: { label: '신청', node: 'bg-blue-600', chip: 'bg-blue-50 text-blue-800 border-blue-200', panel: 'border-blue-200 bg-blue-50/60' },
  wait: { label: '기다림', node: 'bg-amber-700', chip: 'bg-amber-50 text-amber-900 border-amber-200', panel: 'border-amber-200 bg-amber-50/60' },
  upload: { label: '올리기', node: 'bg-emerald-700', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', panel: 'border-emerald-200 bg-emerald-50/60' },
  make: { label: '정리', node: 'bg-violet-600', chip: 'bg-violet-50 text-violet-800 border-violet-200', panel: 'border-violet-200 bg-violet-50/60' },
};

const STEPS: FlowStep[] = [
  {
    short: '내려받기 신청', icon: Send, phase: 'ready',
    easy: 'Facebook에서 내 기록 파일을 받을 수 있게 신청하는 단계입니다.',
    userTasks: ['아래 \'STEP 1\' 상자의 "Facebook 다운로드 신청하기" 버튼 누르기', '받을 내용 고르기', '파일 형식은 JSON으로 선택하기'],
    haruTasks: ['Facebook 다운로드 페이지를 새 탭으로 열어 드림'],
    note: 'Facebook 화면은 바뀔 수 있어요. 설명과 다르면 Facebook 안내를 따라 주세요.',
  },
  {
    short: '파일 준비 기다리기', icon: Hourglass, phase: 'wait',
    easy: 'Facebook이 내 기록 파일을 만들어 주는 동안 기다리는 단계입니다.',
    userTasks: ['준비가 끝났다는 알림(이메일 등) 기다리기', '기다리는 동안은 앱을 닫아도 괜찮아요'],
    haruTasks: ['기다리는 동안 따로 할 일은 없어요'],
    note: '준비에는 보통 1~2시간으로 안내되지만 더 걸릴 수 있어요. 시간은 Facebook 안내가 기준입니다.',
  },
  {
    short: '파일 내려받기', icon: Download, phase: 'wait',
    easy: '준비된 파일을 내 기기에 내려받는 단계입니다.',
    userTasks: ['알림에 적힌 안내대로 파일 내려받기', 'ZIP 파일은 압축을 풀지 않고 그대로 두기', '안내된 기한 안에 내려받기(보통 4일)', '노트북이나 PC에서 하면 더 편해요'],
    haruTasks: ['받은 파일을 올릴 곳 안내'],
    note: '내려받을 수 있는 기간은 Facebook 안내가 기준입니다. 기한이 지나면 다시 신청해야 할 수 있어요.',
  },
  {
    short: 'HARU에 올리기', icon: Upload, phase: 'upload',
    easy: "내려받은 ZIP 파일을 아래 'STEP 3' 상자에서 그대로 올리는 단계입니다.",
    userTasks: ['아래 \'STEP 3\' 상자의 "ZIP 파일 선택하기" 누르기', '내려받은 ZIP 파일 그대로 선택하기'],
    haruTasks: ['올린 파일에서 내 게시물을 찾아 정리'],
  },
  {
    short: '내 이야기로 만들기', icon: BookOpen, phase: 'make',
    easy: '가져온 기록을 보고 나의 이야기로 정리하는 단계입니다.',
    userTasks: ['가져온 기록 살펴보기', '마음에 드는 기록을 골라 정리하기'],
    haruTasks: ['SNS 기록 모아 보기·검색', '이야기로 만드는 일 도와드리기'],
  },
];

const SITUATIONS = [
  { label: '처음이에요', index: 0 },
  { label: '신청해 두었어요', index: 1 },
  { label: '파일을 받았어요', index: 3 },
];

export function SnsImportFlowMap() {
  // 신청·업로드 버튼이 밀리지 않도록 기본은 접어 두고 눌러서 펼친다.
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="sns-import-flow-wrap"
        className="flex min-h-[56px] w-full items-center justify-between gap-2 rounded-lg border border-blue-200 bg-white px-4 py-3 text-left shadow-sm"
      >
        <span className="min-w-0">
          <span className="block text-[17px] font-bold text-gray-900">한눈에 보는 가져오기 순서</span>
          <span className="block text-sm leading-6 text-gray-600">신청부터 내 이야기까지 5단계</span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id="sns-import-flow-wrap" className="mt-3">
          <FlowTimeline
            id="sns-import-flow"
            title="한눈에 보는 가져오기 순서"
            intro="Facebook에 올려 둔 내 기록을 HARU로 가져오는 큰 순서입니다. 단계를 누르면 자세히 볼 수 있어요."
            phases={PHASES}
            steps={STEPS}
            situations={SITUATIONS}
            footer="이 순서는 이해를 돕기 위한 안내입니다. Facebook 화면과 안내는 바뀔 수 있으니, 설명과 다르면 Facebook 안내를 따라 주세요."
          />
        </div>
      )}
    </div>
  );
}
