import { useNavigate } from 'react-router-dom';

export function RecordHubPage() {
  const navigate = useNavigate();

  const lifeRecords = ['일기', '에세이', '여행기록', '텃밭일지', '반려동물', '육아일기'];
  const workRecords = ['선교보고', '일반보고', '업무일지', '메모'];
  const knowledgeCards: { icon: string; label: string; desc?: string; path: string; isNew?: boolean; accent?: string }[] = [
    { icon: '🔮', label: 'HARU예언', path: '/prophecy-hub' },
    { icon: '⚖️', label: '하루LAW', path: '/record' },
    { icon: '📖', label: '영어성경', path: '/bible' },
    { icon: '✏️', label: '영어일기', path: '/diary-learn' },
    { icon: '📱', label: 'SNS 기록 가져오기', desc: 'Facebook · Instagram 기록 AI로 정리', path: '/sns-records', isNew: true, accent: '#10b981' },
  ];

  const recordButtonStyle: React.CSSProperties = {
    padding: '14px 12px',
    borderRadius: 10,
    border: '0.5px solid #e5e5e5',
    background: '#fff',
    color: '#1A3C6E',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  };

  const knowledgeCardStyle: React.CSSProperties = {
    padding: '18px 12px',
    borderRadius: 12,
    border: '0.5px solid #e5e5e5',
    background: '#fff',
    color: '#1A3C6E',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.15s',
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#1A3C6E',
    marginBottom: 10,
    letterSpacing: '0.02em',
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px - 80px)',
        background: '#FAF9F6',
        padding: '24px 16px 32px',
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1A3C6E',
              letterSpacing: '-0.01em',
            }}
          >
            📋 기록
          </h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
            무엇을 기록할까요?
          </p>
        </div>

        {/* 섹션 1: 생활기록 */}
        <section style={{ marginBottom: 24 }}>
          <p style={sectionLabel}>📔 생활기록</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {lifeRecords.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => navigate('/record')}
                style={recordButtonStyle}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* 섹션 2: 업무기록 */}
        <section style={{ marginBottom: 24 }}>
          <p style={sectionLabel}>💼 업무기록</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {workRecords.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => navigate('/record')}
                style={recordButtonStyle}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* 섹션 3: AI 지식창고 */}
        <section style={{ marginBottom: 28 }}>
          <p style={sectionLabel}>📚 AI 지식창고</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {knowledgeCards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => navigate(card.path)}
                style={{
                  ...knowledgeCardStyle,
                  position: 'relative',
                  ...(card.accent ? { borderColor: card.accent } : {}),
                }}
              >
                {card.isNew && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: '#10b981',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 999,
                      letterSpacing: '0.04em',
                    }}
                  >
                    NEW
                  </span>
                )}
                <span style={{ fontSize: 22 }}>{card.icon}</span>
                <span>{card.label}</span>
                {card.desc && (
                  <span style={{ fontSize: 11, color: '#666', fontWeight: 400, textAlign: 'center', lineHeight: 1.3 }}>
                    {card.desc}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 하단 CTA: 내 기록 서재 보기 */}
        <button
          type="button"
          onClick={() => navigate('/library')}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            border: 'none',
            background: '#1A3C6E',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px -8px rgba(26,60,110,0.4)',
          }}
        >
          📚 내 기록 서재 보기
        </button>
      </div>
    </div>
  );
}
