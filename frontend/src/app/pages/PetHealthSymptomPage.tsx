import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

type RiskLevel = 'observe' | 'consult' | 'urgent' | 'emergency';

type SymptomRule = {
  keywords: string[];
  level: RiskLevel;
  possibleCauses: string;
  action: string;
  vetSummaryHint: string;
};

const SYMPTOM_RULES: SymptomRule[] = [
  {
    keywords: ['피 섞인 설사', '혈변', '피 설사', '검붉은 변'],
    level: 'urgent',
    possibleCauses: '장 감염, 장 출혈 가능성',
    action: '빠른 시간 안에 동물병원 방문을 권합니다.',
    vetSummaryHint: '혈변 증상이 있습니다.',
  },
  {
    keywords: ['소변을 못', '소변 안', '소변 못 봄', '화장실 못 감', '소변 막힘'],
    level: 'emergency',
    possibleCauses: '요도 폐색 가능성 (특히 수컷 고양이에서 응급)',
    action: '즉시 동물병원에 가세요.',
    vetSummaryHint: '소변을 보지 못하는 증상이 있습니다.',
  },
  {
    keywords: ['호흡', '숨 가쁨', '숨 거칠', '입 벌리고 숨', '호흡 곤란'],
    level: 'emergency',
    possibleCauses: '심폐 문제, 기도 폐색 가능성',
    action: '즉시 동물병원에 가세요.',
    vetSummaryHint: '호흡에 이상이 있습니다.',
  },
  {
    keywords: ['경련', '발작', '떨림', '간질'],
    level: 'emergency',
    possibleCauses: '신경계 문제, 중독 가능성',
    action: '즉시 동물병원에 가세요. 발작 중 자극을 주지 마세요.',
    vetSummaryHint: '경련 또는 발작 증상이 있었습니다.',
  },
  {
    keywords: ['토를', '구토', '토했', '먹은 것을 다시'],
    level: 'consult',
    possibleCauses: '소화기 문제, 이물질 섭취, 감염 가능성',
    action: '하루 이상 지속되거나 혈액이 섞인 경우 병원 상담을 권합니다.',
    vetSummaryHint: '구토 증상이 있습니다.',
  },
  {
    keywords: ['밥을 안', '밥 안 먹', '식욕 없', '사료 안 먹', '안 먹'],
    level: 'observe',
    possibleCauses: '스트레스, 소화기 불편, 통증 가능성',
    action: '24시간 이상 지속되면 병원 상담을 권합니다.',
    vetSummaryHint: '식욕 저하가 있습니다.',
  },
  {
    keywords: ['하루 종일 누워', '움직이지 않', '기력 없', '무기력', '힘 없'],
    level: 'consult',
    possibleCauses: '통증, 감염, 전신 쇠약 가능성',
    action: '하루 이상 지속되면 병원 상담을 권합니다.',
    vetSummaryHint: '무기력 증상이 있습니다.',
  },
  {
    keywords: ['긁는다', '피부 가려움', '털 빠짐', '피부 붉'],
    level: 'observe',
    possibleCauses: '피부 알레르기, 기생충, 피부 감염 가능성',
    action: '증상이 계속되면 피부 검사를 받아보세요.',
    vetSummaryHint: '피부 가려움·발진 증상이 있습니다.',
  },
];

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; emoji: string; desc: string }> = {
  observe:   { label: '관찰',      color: '#10b981', bg: '#f0fdf4', emoji: '👀', desc: '지금 당장 위급하지는 않지만 경과를 지켜보세요.' },
  consult:   { label: '병원 상담', color: '#3b82f6', bg: '#eff6ff', emoji: '🏥', desc: '증상이 지속되거나 악화되면 동물병원에 연락하세요.' },
  urgent:    { label: '빠른 병원', color: '#f59e0b', bg: '#fffbeb', emoji: '⚡', desc: '빠른 시간 안에 동물병원 방문을 권합니다.' },
  emergency: { label: '응급',      color: '#dc2626', bg: '#fef2f2', emoji: '🚨', desc: '즉시 동물병원으로 가세요.' },
};

function findSymptomRule(query: string): SymptomRule | null {
  const normalized = query.toLowerCase();
  return SYMPTOM_RULES.find((rule) =>
    rule.keywords.some((kw) => normalized.includes(kw))
  ) ?? null;
}

export function PetHealthSymptomPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SymptomRule | null | 'not_found'>(null);

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/pet-health');
  };

  const handleCheck = () => {
    if (!query.trim()) return;
    const found = findSymptomRule(query);
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
          🩺 아픈 징조
        </h1>
        <p className="text-sm mt-1" style={{ color: '#666', lineHeight: 1.5 }}>
          이상 증상을 입력하면 위험도와 병원 상담 필요 여부를 안내합니다. 진단을 대신하지 않습니다.
        </p>
      </div>

      <div className="mb-4">
        <textarea
          value={query}
          onChange={(e) => { setQuery(e.target.value); setResult(null); }}
          placeholder="예) 밥을 안 먹고 하루 종일 누워 있어요. / 토를 두 번 했어요."
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
            입력한 증상에 대한 정보를 찾지 못했습니다.<br />
            증상이 이틀 이상 지속되거나 악화되면 동물병원을 방문하세요.
          </p>
        </div>
      )}

      {result && result !== 'not_found' && riskInfo && (
        <div style={{ padding: 16, borderRadius: 10, background: riskInfo.bg, border: `1px solid ${riskInfo.color}33` }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: riskInfo.color, marginBottom: 4 }}>
            {riskInfo.emoji} 위험도: {riskInfo.label}
          </p>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>{riskInfo.desc}</p>

          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>
            <strong>가능한 원인 범주:</strong> {result.possibleCauses}
          </p>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>
            <strong>다음 행동:</strong> {result.action}
          </p>

          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fff', border: '1px dashed #d1d5db' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>📋 수의사에게 보여줄 요약</p>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
              반려동물에게 {result.vetSummaryHint} 가능한 원인: {result.possibleCauses}.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs mt-6" style={{ color: '#aaa', lineHeight: 1.6 }}>
        이 결과는 일반적인 안내이며 진료를 대체하지 않습니다. 응급 상황이라고 판단되면 즉시 동물병원으로 가세요.
      </p>
    </div>
  );
}
