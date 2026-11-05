import { useLayoutEffect, useRef } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { HaruLawPanel, useHaruLaw } from '../assistants/haruLaw/HaruLawPanel';
import { useSubscription } from '../hooks/useSubscription';
import { getOrigin } from '../services/v2Origin';

export function HaruLawPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscription } = useSubscription();
  const lawEntrySectionRef = useRef<HTMLElement>(null);
  const law = useHaruLaw({
    lawEntrySectionRef,
    isLawPaidUser: subscription.status === 'active' && subscription.plan !== 'free',
    // 선택하지 않은 날씨·기온·기분을 새 기록에 채우지 않는다.
    weather: '', temperature: '', mood: '',
  });

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.key]);

  const goHome = () => {
    if (law.lawSaveRef.current) {
      toast.info('저장 중입니다. 완료 후 돌아갈 수 있습니다.');
      return;
    }
    navigate((location.state as { from?: string } | null)?.from || getOrigin() || '/');
  };

  return (
    <main className="min-h-screen bg-[#EDE9F5] px-4 pt-4 pb-24 text-[#1A3C6E]">
      <div className="mx-auto max-w-3xl space-y-4">
        <header>
          <button type="button" onClick={goHome} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> 홈으로
          </button>
          <h1 className="mt-4 flex items-center gap-2 text-2xl font-semibold"><Scale className="h-6 w-6" /> 하루LAW</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">상황을 적으면 관련 법령과 AI의 쉬운 설명을 확인할 수 있습니다.</p>
        </header>
        <section ref={lawEntrySectionRef} aria-label="하루LAW 질문과 결과" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <p className="mb-4 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-slate-600">
            공식 법령 데이터와 AI 설명을 구분해 확인해 주세요. AI 설명에는 오류가 있을 수 있으며, 법률 정보는 전문가의 판단을 대신하지 않습니다.
          </p>
          <HaruLawPanel law={law} standalone />
        </section>
      </div>
    </main>
  );
}
