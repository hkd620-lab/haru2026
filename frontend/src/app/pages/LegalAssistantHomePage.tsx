import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Loader2, Scale, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { getLegalTodayTasks, type LegalTodayTask } from '../services/legalTodayService';

const entranceCards = [
  {
    title: '새로 소송을 준비하고 있어요',
    description: '전자소송 제출 과정을 연습하고 필요한 내용을 준비합니다.',
    path: '/lawsuit-practice',
    icon: Scale,
    enabled: true,
  },
  {
    title: '이미 소송을 제출했어요',
    description: '사건을 등록하고 송달·보정·기일 등 진행 상황을 관리합니다.',
    path: '/legal-cases',
    icon: FileText,
    enabled: true,
  },
  {
    title: '법원에서 문서를 받았어요',
    description: '법원 문서 도우미 준비 중',
    path: '',
    icon: ShieldAlert,
    enabled: false,
  },
];

export default function LegalAssistantHomePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tasks, setTasks] = useState<LegalTodayTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user?.uid) return;
    setIsLoading(true);
    getLegalTodayTasks(user.uid)
      .then(setTasks)
      .catch((error) => {
        console.error('전자소송 오늘 할 일 로드 실패:', error);
        toast.error('오늘 할 일을 불러오지 못했습니다.');
      })
      .finally(() => setIsLoading(false));
  }, [user?.uid]);

  const visibleTasks = tasks.slice(0, 3);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#FEFBE8] px-4 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-center py-20 text-sm text-gray-500">
          <Loader2 className="mr-2 size-4 animate-spin" />
          전자소송비서를 준비하는 중입니다.
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#FEFBE8] px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="px-2">
            <ArrowLeft className="size-4" />
            뒤로가기
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-lg font-semibold text-gray-900">전자소송비서</h1>
            <p className="truncate text-xs text-gray-500">확인 · 기록 · 진행상태 · 다음 행동</p>
          </div>
          <span />
        </header>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">오늘 할 일</h2>
            {tasks.length > 3 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/legal-cases')}>
                전체 보기
              </Button>
            )}
          </div>

          {visibleTasks.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              오늘 바로 확인할 전자소송 할 일이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleTasks.map((task) => (
                <article key={task.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{task.caseTitle}</p>
                      <p className="mt-1 text-sm text-gray-700">{task.message}</p>
                    </div>
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      {task.title}
                    </Badge>
                  </div>
                  {task.dueDateByUserInput && (
                    <p className="mt-2 text-xs leading-5 text-gray-600">
                      사용자가 입력한 기한: {task.dueDateByUserInput}
                      {task.dueLabel ? ` · ${task.dueLabel}` : ''}
                    </p>
                  )}
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => navigate(`/legal-cases/${task.caseId}?tab=${task.tab}`)}
                  >
                    확인하기
                    <ChevronRight className="size-4" />
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3">
          {entranceCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                type="button"
                disabled={!card.enabled}
                onClick={() => card.enabled && navigate(card.path)}
                className={`min-h-[116px] rounded-lg border bg-white p-4 text-left shadow-sm ${
                  card.enabled
                    ? 'border-gray-200 hover:border-blue-300'
                    : 'border-dashed border-gray-300 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-gray-900">{card.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-gray-600">{card.description}</span>
                    {!card.enabled && (
                      <span className="mt-3 inline-flex rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-500">
                        준비 중
                      </span>
                    )}
                  </span>
                  {card.enabled && <ChevronRight className="mt-1 size-4 text-gray-400" />}
                </div>
              </button>
            );
          })}
        </section>

        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
          <p className="font-semibold">전문가 상담이 필요한 사건</p>
          <p className="mt-1">
            상대방이 강하게 다투는 사건, 금액이 큰 사건, 손해배상액 산정이 어려운 사건,
            부동산 명도·가압류·가처분, 가사·형사 연계, 계약 해석이 복잡하거나 법률상 기한 계산이
            중요한 사건은 실제 진행 전 전문가 상담을 권장합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
