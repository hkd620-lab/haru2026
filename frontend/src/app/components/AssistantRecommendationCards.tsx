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
  medicine: '#2563EB',
  law: '#7C2D12',
  finance: '#7A6F5A',
  plant: '#15803D',
  childcare: '#B45309',
  travel: '#0369A1',
  life: '#6D28D9',
};

export function AssistantRecommendationCards({
  recommendations,
  title,
  description,
  privacyNote,
  onSelect,
}: AssistantRecommendationCardsProps) {
  if (recommendations.length === 0) return null;

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
        {recommendations.map((recommendation) => {
          const accent = CATEGORY_ACCENT[recommendation.category];
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 190px' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: accent }}>
                    {recommendation.title}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.5, color: '#6B7280' }}>
                    감지된 키워드: {recommendation.matchedKeywords.join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(recommendation)}
                  style={{
                    minHeight: 34,
                    padding: '0 12px',
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
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.55, color: '#334155' }}>
                {recommendation.description}
              </p>
            </article>
          );
        })}
      </div>
      {privacyNote && (
        <p style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.5, color: '#64748B' }}>
          {privacyNote}
        </p>
      )}
      <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.5, color: '#8A6B35' }}>
        {ASSISTANT_RECOMMENDATION_SAFETY_NOTE}
      </p>
    </section>
  );
}

export function AssistantPendingDialog({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="비서 연결 준비 중"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        backgroundColor: 'rgba(15, 23, 42, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
          padding: 18,
          boxShadow: '0 18px 38px rgba(15, 23, 42, 0.24)',
        }}
      >
        <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#1A3C6E' }}>
          비서 연결 준비 중
        </p>
        <p style={{ margin: '10px 0 16px', fontSize: 13, lineHeight: 1.65, color: '#334155' }}>
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            minHeight: 40,
            borderRadius: 8,
            border: 'none',
            backgroundColor: '#1A3C6E',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}
