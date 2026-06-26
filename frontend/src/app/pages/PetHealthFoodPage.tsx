import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { AlertTriangle, ArrowLeft, Loader2, PawPrint, Search } from 'lucide-react';
import { functions } from '../../firebase';
import { petFoodSafetyDB } from '../../data/petFoodSafetyDB';

type PetFoodCheckResult = {
  riskLevel: 'safe' | 'caution' | 'danger' | 'emergency' | 'unknown';
  answer: string;
  reason?: string;
  symptoms?: string[];
  emergency: boolean;
  geminiText?: string | null;
  source?: string | null;
};

const riskStyles: Record<PetFoodCheckResult['riskLevel'], string> = {
  emergency: 'bg-red-100 text-red-700',
  danger: 'bg-orange-100 text-orange-700',
  caution: 'bg-yellow-100 text-yellow-700',
  safe: 'bg-green-100 text-green-700',
  unknown: 'bg-gray-100 text-gray-600',
};

const riskLabels: Record<PetFoodCheckResult['riskLevel'], string> = {
  emergency: '응급',
  danger: '위험',
  caution: '주의',
  safe: '안전',
  unknown: '미등록',
};

export function PetHealthFoodPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<PetFoodCheckResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sampleItems = useMemo(() => petFoodSafetyDB.slice(0, 6).flatMap((item) => item.nameKo.slice(0, 1)), []);

  const handleCheck = async () => {
    const foodName = input.trim();
    if (!foodName) {
      setError('식품명을 입력해주세요.');
      setResult(null);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const petFoodCheck = httpsCallable(functions, 'petFoodCheck');
      const response = await petFoodCheck({ foodName });
      setResult(response.data as PetFoodCheckResult);
    } catch (err) {
      console.error('petFoodCheck failed:', err);
      setError('확인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:py-8" style={{ minHeight: 'calc(100vh - 56px - 80px)' }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E1EA] bg-white text-[#1A3C6E] shadow-sm transition hover:bg-[#FAF9F6]"
        aria-label="뒤로가기"
      >
        <ArrowLeft size={20} aria-hidden />
      </button>

      <section className="rounded-[8px] border border-[#E6E1D8] bg-[#FAF9F6] p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[8px] bg-white text-[#10b981] shadow-sm">
            <PawPrint size={26} aria-hidden />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[#1A3C6E]">HARU PET CARE</div>
            <h1 className="text-2xl font-bold text-[#1A3C6E] md:text-3xl">🐾 먹어도 되나요?</h1>
            <p className="mt-2 text-sm leading-6 text-[#5F666D]">
              HARU 안전 DB에 등록된 식품만 판정하고, AI는 안내문 정리에만 사용합니다.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A949E]" size={18} aria-hidden />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !loading) handleCheck();
              }}
              placeholder="예) 포도, 초콜릿, 당근"
              className="h-12 w-full rounded-[8px] border border-[#D8E1EA] bg-white pl-10 pr-4 text-sm text-[#2C2C2A] outline-none transition placeholder:text-[#A5ADB5] focus:border-[#1A3C6E] focus:ring-2 focus:ring-[#1A3C6E]/15"
            />
          </label>
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[#1A3C6E] px-5 text-sm font-semibold text-white transition hover:bg-[#14305A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Search size={18} aria-hidden />}
            확인하기
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {sampleItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setInput(item)}
              className="rounded-full border border-[#D8E1EA] bg-white px-3 py-1 text-xs font-medium text-[#1A3C6E] transition hover:border-[#10b981] hover:text-[#0F8D68]"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-[8px] border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <section className="mt-4 rounded-[8px] border border-[#E6E1D8] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${riskStyles[result.riskLevel]}`}>
              {riskLabels[result.riskLevel]}
            </span>
            <h2 className="text-xl font-bold text-[#2C2C2A]">{result.answer}</h2>
          </div>

          {result.riskLevel === 'unknown' ? (
            <p className="rounded-[8px] bg-[#F3F4F6] p-4 text-sm leading-6 text-[#4B5563]">
              HARU 안전 DB에 등록되지 않은 식품입니다. 수의사 또는 동물병원에 직접 문의해 주세요.
            </p>
          ) : (
            <div className="space-y-4">
              {result.geminiText && (
                <p className="text-sm leading-7 text-[#374151]">{result.geminiText}</p>
              )}

              {result.reason && (
                <div className="rounded-[8px] bg-[#FAF9F6] p-4 text-sm leading-6 text-[#4B5563]">
                  <span className="font-semibold text-[#1A3C6E]">근거: </span>
                  {result.reason}
                </div>
              )}

              {result.symptoms && result.symptoms.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold tracking-[0.08em] text-[#6B7280]">주의 증상</div>
                  <div className="flex flex-wrap gap-2">
                    {result.symptoms.map((symptom) => (
                      <span key={symptom} className="rounded-full bg-[#EEF4F8] px-3 py-1 text-xs font-medium text-[#1A3C6E]">
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.emergency && (
                <div className="flex items-center gap-2 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  <AlertTriangle size={18} aria-hidden />
                  즉시 동물병원에 연락하세요
                </div>
              )}

              <div className="text-xs leading-5 text-[#6B7280]">
                출처: {result.source || 'ASPCA'} / 수의학 자료 기반 HARU 안전 DB
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-[#EEF0F2] pt-4 text-xs font-medium text-[#6B7280]">
            이 안내는 진료를 대신하지 않습니다.
          </div>
        </section>
      )}
    </div>
  );
}
