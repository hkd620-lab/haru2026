import { CheckCircle2, Circle, PauseCircle } from 'lucide-react';
import { Button } from './ui/button';
import type { LegalCaseStatus } from '../types/legalCaseTypes';

type ProgressStep = '준비' | '제출' | '접수' | '송달' | '대응' | '종결';

const STEPS: ProgressStep[] = ['준비', '제출', '접수', '송달', '대응', '종결'];

const STATUS_STEP_INDEX: Record<Exclude<LegalCaseStatus, '보류'>, number> = {
  제출준비: 0,
  제출완료: 2,
  송달확인중: 3,
  보정필요: 4,
  추가서류필요: 4,
  종결: 5,
};

const NEXT_CHECK_COPY: Record<LegalCaseStatus, string> = {
  제출준비: '작성한 내용과 증거자료를 다시 확인하세요.',
  제출완료: '접수 여부와 제출 후 체크리스트를 확인하세요.',
  송달확인중: '전자송달 문서를 확인하세요.',
  보정필요: '법원 문서에 적힌 보정 요청과 사용자가 입력한 기한을 확인하세요.',
  추가서류필요: '추가로 제출해야 할 자료와 사용자가 입력한 기한을 확인하세요.',
  종결: '종결된 사건의 보관 자료를 확인하세요.',
  보류: '진행이 보류된 사건입니다. 다시 진행할 때 상태를 확인하세요.',
};

export function LegalCaseProgressMap({
  status,
  lastCheckedAt,
  onMarkCheckedToday,
  isSaving,
}: {
  status: LegalCaseStatus;
  lastCheckedAt?: string;
  onMarkCheckedToday?: () => void;
  isSaving?: boolean;
}) {
  const isPaused = status === '보류';
  const currentIndex = isPaused ? -1 : STATUS_STEP_INDEX[status];

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">사건 진행지도</h2>
          <p className="mt-1 text-xs text-gray-500">저장된 상태값을 기준으로 표시합니다.</p>
        </div>
        {isPaused && (
          <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-500">
            <PauseCircle className="size-3.5" />
            진행 정지
          </span>
        )}
      </div>

      <ol className="grid grid-cols-6 gap-1">
        {STEPS.map((step, index) => {
          const isDone = !isPaused && index < currentIndex;
          const isCurrent = !isPaused && index === currentIndex;
          return (
            <li key={step} className="min-w-0">
              <div
                className={`flex min-h-10 items-center justify-center rounded-md border text-xs font-semibold ${
                  isPaused
                    ? 'border-gray-200 bg-gray-50 text-gray-400'
                    : isCurrent
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : isDone
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'
                }`}
              >
                {isDone ? <CheckCircle2 className="mr-1 size-3.5" /> : <Circle className="mr-1 size-3" />}
                <span className="truncate">{step}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 px-3 py-3">
        <p className="text-sm font-semibold text-gray-900">다음으로 확인할 것</p>
        <p className="mt-1 text-sm leading-6 text-gray-700">{NEXT_CHECK_COPY[status]}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">마지막 확인: {lastCheckedAt || '기록 없음'}</p>
          {onMarkCheckedToday && status !== '종결' && status !== '보류' && (
            <Button size="sm" onClick={onMarkCheckedToday} disabled={isSaving}>
              오늘 확인했습니다
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
