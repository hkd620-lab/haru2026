import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

type RiskLevel = 'safe' | 'small_amount' | 'caution' | 'danger' | 'emergency';

type FoodRule = {
  keywords: string[];
  name: string;
  level: RiskLevel;
  reason: string;
  action: string;
};

const FOOD_RULES: FoodRule[] = [
  {
    keywords: ['포도', '건포도', '청포도'],
    name: '포도 / 건포도',
    level: 'emergency',
    reason: '강아지·고양이 모두 신부전을 유발할 수 있습니다. 소량도 위험합니다.',
    action: '즉시 동물병원에 문의하세요.',
  },
  {
    keywords: ['양파', '파', '대파', '쪽파', '마늘'],
    name: '양파 / 파 / 마늘류',
    level: 'danger',
    reason: '적혈구를 파괴해 빈혈을 유발합니다. 익힌 것도 위험합니다.',
    action: '먹은 양이 많거나 증상이 있으면 병원 상담이 필요합니다.',
  },
  {
    keywords: ['초콜릿', '카카오', '코코아'],
    name: '초콜릿 / 카카오',
    level: 'emergency',
    reason: '테오브로민 성분이 신경계와 심장에 영향을 줍니다. 다크 초콜릿이 특히 위험합니다.',
    action: '즉시 동물병원에 문의하세요.',
  },
  {
    keywords: ['자일리톨', '무설탕 껌'],
    name: '자일리톨 (무설탕 껌·캔디)',
    level: 'emergency',
    reason: '강아지에게 혈당 급강하와 간부전을 일으킬 수 있습니다.',
    action: '즉시 동물병원에 문의하세요.',
  },
  {
    keywords: ['아보카도'],
    name: '아보카도',
    level: 'danger',
    reason: '퍼신 성분이 구토, 설사, 호흡 곤란을 유발할 수 있습니다.',
    action: '먹은 직후라면 병원 상담을 권합니다.',
  },
  {
    keywords: ['커피', '카페인', '녹차', '홍차'],
    name: '카페인 (커피·차)',
    level: 'danger',
    reason: '신경계 과흥분을 유발합니다. 소량도 소형견에게 위험합니다.',
    action: '먹은 양이 많거나 증상이 있으면 병원 상담이 필요합니다.',
  },
  {
    keywords: ['고구마', '삶은 고구마', '찐 고구마'],
    name: '고구마 (삶은 것)',
    level: 'small_amount',
    reason: '소량은 괜찮지만 당 함량이 높아 많이 먹으면 소화 문제가 생길 수 있습니다.',
    action: '소량만 가끔 주세요. 당뇨가 있는 반려동물은 피하세요.',
  },
  {
    keywords: ['참치', '참치 통조림'],
    name: '참치 (통조림)',
    level: 'caution',
    reason: '고양이에게 소량은 괜찮지만, 나트륨과 수은 함량이 높아 자주 주면 좋지 않습니다.',
    action: '가끔 소량만 주세요. 주식으로 삼지 마세요.',
  },
  {
    keywords: ['닭고기', '삶은 닭', '닭 가슴살'],
    name: '닭고기 (삶은 것)',
    level: 'safe',
    reason: '양념 없이 삶은 닭가슴살은 강아지·고양이 모두 좋은 단백질 간식입니다.',
    action: '양념 없이 조리해서 소량씩 주세요.',
  },
  {
    keywords: ['당근', '삶은 당근'],
    name: '당근',
    level: 'safe',
    reason: '저칼로리 채소로 강아지에게 좋은 간식입니다. 고양이는 먹어도 무해합니다.',
    action: '생것은 잘게 썰거나 삶아서 주면 좋습니다.',
  },
];

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; emoji: string }> = {
  safe:         { label: '먹어도 됩니다',    color: '#10b981', bg: '#f0fdf4', emoji: '✅' },
  small_amount: { label: '소량은 괜찮습니다', color: '#3b82f6', bg: '#eff6ff', emoji: '🔵' },
  caution:      { label: '주의가 필요합니다', color: '#f59e0b', bg: '#fffbeb', emoji: '⚠️' },
  danger:       { label: '먹이면 안 됩니다',  color: '#ef4444', bg: '#fff5f5', emoji: '🚫' },
  emergency:    { label: '즉시 병원 문의',    color: '#dc2626', bg: '#fef2f2', emoji: '🚨' },
};

function findFoodRule(query: string): FoodRule | null {
  const normalized = query.toLowerCase().replace(/\s/g, '');
  return FOOD_RULES.find((rule) =>
    rule.keywords.some((kw) => normalized.includes(kw.replace(/\s/g, '')))
  ) ?? null;
}

export function PetHealthFoodPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<FoodRule | null | 'not_found'>(null);

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/pet-health');
  };

  const handleCheck = () => {
    if (!query.trim()) return;
    const found = findFoodRule(query);
    setResult(found ?? 'not_found');
  };

  const riskInfo = result && result !== 'not_found' ? RISK_CONFIG[result.level] : null;

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1A3C6E' }}>
          🍖 먹어도 되나요?
        </h1>
        <p className="text-sm mt-1" style={{ color: '#666', lineHeight: 1.5 }}>
          음식명을 입력하면 반려동물에게 안전한지 확인합니다.
        </p>
      </div>

      <div className="mb-4">
        <textarea
          value={query}
          onChange={(e) => { setQuery(e.target.value); setResult(null); }}
          placeholder="예) 강아지가 포도를 먹었어요. / 고양이가 참치를 먹어도 되나요?"
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #d1d5db',
            fontSize: 14,
            lineHeight: 1.6,
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <button
          onClick={handleCheck}
          disabled={!query.trim()}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            background: query.trim() ? '#7C3AED' : '#e5e7eb',
            color: query.trim() ? '#fff' : '#9ca3af',
            fontSize: 14,
            fontWeight: 700,
            cursor: query.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          확인하기
        </button>
      </div>

      {result === 'not_found' && (
        <div style={{ padding: 16, borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            해당 음식에 대한 정보가 없습니다.<br />
            확실하지 않은 경우 동물병원에 문의하거나, 먹이지 않는 것이 안전합니다.
          </p>
        </div>
      )}

      {result && result !== 'not_found' && riskInfo && (
        <div style={{ padding: 16, borderRadius: 10, background: riskInfo.bg, border: `1px solid ${riskInfo.color}33` }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: riskInfo.color, marginBottom: 4 }}>
            {riskInfo.emoji} {result.name}
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: riskInfo.color, marginBottom: 12 }}>
            {riskInfo.label}
          </p>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>
            <strong>이유:</strong> {result.reason}
          </p>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
            <strong>다음 행동:</strong> {result.action}
          </p>
        </div>
      )}

      <p className="text-xs mt-6" style={{ color: '#aaa', lineHeight: 1.6 }}>
        이 결과는 일반적인 안내이며 진료를 대체하지 않습니다. 증상이 있거나 판단이 어려우면 동물병원에 문의하세요.
      </p>
    </div>
  );
}
