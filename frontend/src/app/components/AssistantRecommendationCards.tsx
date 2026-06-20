import { useMemo, useState } from 'react';
import type { AssistantRecommendation } from '../utils/assistantRecommendations';
import { ASSISTANT_RECOMMENDATION_SAFETY_NOTE } from '../utils/assistantRecommendations';

type AssistantRecommendationCardsProps = {
  recommendations: AssistantRecommendation[];
  title: string;
  description: string;
  privacyNote?: string;
  onSelect: (recommendation: AssistantRecommendation) => void;
};

const CATEGORY_ACCENT: Record<AssistantRecommendation['category'], string> = {
  health: '#0F766E',
  hospital: '#0F766E',
  medicine: '#2563EB',
  law: '#7C2D12',
  finance: '#7A6F5A',
  plant: '#15803D',
  childcare: '#B45309',
  travel: '#0369A1',
  life: '#6D28D9',
  pet: '#B85C2E',
};

const ASSISTANT_CONNECTION_CATEGORIES = new Set<AssistantRecommendation['category']>([
  'health',
  'hospital',
  'medicine',
  'law',
  'plant',
]);

const SAFETY_NOTE_CATEGORIES = new Set<AssistantRecommendation['category']>(['health', 'hospital', 'medicine', 'law', 'finance']);

function formatKeywordQuestion(keywords: string[]) {
  const visibleKeywords = keywords.slice(0, 2).filter(Boolean);
  if (visibleKeywords.length === 0) return '이 기록에서 챙겨볼 이야기가 보여요.';
  const keywordText = visibleKeywords.map((keyword) => `'${keyword}'`).join(', ');
  return `이 기록에서 ${keywordText} 이야기가 보여요.`;
}

export function AssistantRecommendationCards({
  recommendations,
  title,
  description,
  privacyNote,
  onSelect,
}: AssistantRecommendationCardsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const visibleRecommendations = useMemo(
    () => recommendations.filter((recommendation) => !dismissedIds.has(recommendation.id)),
    [recommendations, dismissedIds],
  );

  if (visibleRecommendations.length === 0) return null;

  const showSafetyNote = visibleRecommendations.some((recommendation) => SAFETY_NOTE_CATEGORIES.has(recommendation.category));

  return (
    <section
      style={{
        padding: 14,
        borderRadius: 8,
        border: '1px solid #D7D2E8',
        backgroundColor: '#FFFEF8',
      }}
    >
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#1A3C6E' }}>
        {title}
      </h3>
      <p style={{ margin: '6px 0 12px', fontSize: 12, lineHeight: 1.55, color: '#64748B' }}>
        {description}
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {visibleRecommendations.map((recommendation) => {
          const accent = CATEGORY_ACCENT[recommendation.category];
          const isAssistantConnection = ASSISTANT_CONNECTION_CATEGORIES.has(recommendation.category);
          return (
            <article
              key={recommendation.id}
              style={{
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${accent}22`,
                backgroundColor: '#FFFFFF',
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.6, fontWeight: 800, color: '#1A3C6E' }}>
                {formatKeywordQuestion(recommendation.matchedKeywords)}
              </p>
              <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.55, color: '#334155' }}>
                {isAssistantConnection ? '관련된 비서와 연결해드릴까요?' : '관련 기록 형식으로 정리해볼까요?'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 190px' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: accent }}>
                    {recommendation.title}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.5, color: '#6B7280' }}>
                    감지된 키워드: {recommendation.matchedKeywords.join(', ')}
                  </p>
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.55, color: '#334155' }}>
                {recommendation.description}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => onSelect(recommendation)}
                  aria-label={recommendation.actionLabel}
                  style={{
                    minHeight: 36,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: accent,
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {recommendation.actionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedIds((prev) => new Set(prev).add(recommendation.id))}
                  style={{
                    minHeight: 36,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: `1px solid ${accent}33`,
                    backgroundColor: '#FFFFFF',
                    color: '#64748B',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  지금은 괜찮아요
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {privacyNote && (
        <p style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.5, color: '#64748B' }}>
          {privacyNote}
        </p>
      )}
      {showSafetyNote && (
        <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.5, color: '#8A6B35' }}>
          {ASSISTANT_RECOMMENDATION_SAFETY_NOTE}
        </p>
      )}
    </section>
  );
}
