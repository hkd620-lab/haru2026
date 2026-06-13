import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

// 일반 사용자 메뉴에서 숨기는 기록형식/비서 (개발자에게는 그대로 노출)
const HIDDEN_RECORD_FORMATS = new Set(['선교보고', '일반보고', '주식거래일지']);
const HIDDEN_CARD_LABELS = new Set(['주식거래일지', '영어성경']);

export function RecordHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDeveloper = user?.uid === DEVELOPER_UID || user?.email === 'hkd620@gmail.com';

  const lifeRecords: { label: string; format: string }[] = [
    { label: '일기', format: '일기' },
    { label: '에세이', format: '에세이' },
    { label: '여행기록', format: '여행기록' },
    { label: '텃밭일지', format: '텃밭일지' },
    { label: '반려동물', format: '애완동물관찰일지' },
    { label: '육아일기', format: '육아일기' },
  ];
  const workRecords: { label: string; format: string }[] = [
    { label: '선교보고', format: '선교보고' },
    { label: '일반보고', format: '일반보고' },
    { label: '업무일지', format: '업무일지' },
    { label: '메모', format: '메모' },
  ];
  const knowledgeCards: { icon: string; label: string; desc?: string; path: string; isNew?: boolean; accent?: string; state?: { category?: string; format?: string } }[] = [
    { icon: '🔮', label: 'HARU미래전망', path: '/prophecy-hub' },
    { icon: '⚖️', label: '하루LAW', path: '/record', state: { category: '하루LAW' } },
    { icon: '📖', label: '영어성경', path: '/bible' },
    { icon: '✏️', label: '영어일기', path: '/diary-learn' },
    { icon: '📱', label: 'SNS 기록 가져오기', desc: 'Facebook · Instagram 기록 AI로 정리', path: '/sns-records', isNew: true, accent: '#10b981' },
    { icon: '📈', label: '주식거래일지', desc: '캡처 OCR·거래소감 기록', path: '/record', state: { format: '주식거래일지' } },
  ];

  const devToolCards: { icon: string; label: string; desc: string; path: string }[] = [
    { icon: '🤖', label: '하루AI지식창고', desc: 'AI 대화 저장·검색', path: '/admin/console' },
    { icon: '📰', label: '최신외신 3편', desc: '데일리 영문 뉴스', path: '/news' },
    { icon: '✅', label: '배포 체크리스트', desc: '배포 전 점검', path: '/admin/checklist' },
    { icon: '📚', label: '책 만들기', desc: '신규 책 생성', path: '/book-create' },
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
            {lifeRecords.map(({ label, format }) => (
              <button
                key={label}
                type="button"
                onClick={() => navigate('/record', { state: { format } })}
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
            {workRecords
              .filter(({ format }) => !HIDDEN_RECORD_FORMATS.has(format))
              .map(({ label, format }) => (
              <button
                key={label}
                type="button"
                onClick={() => navigate('/record', { state: { format } })}
                style={recordButtonStyle}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* 섹션 3: AI 지식창고 */}
        <section style={{ marginBottom: 28 }}>
          <p style={sectionLabel}>🏛️ HARU 비서실</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {knowledgeCards
              .filter((card) => !HIDDEN_CARD_LABELS.has(card.label))
              .map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => navigate(card.path, card.state ? { state: card.state } : undefined)}
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

        {/* 섹션 4: 개발자 도구 (허 대표님께만 보임) */}
        {isDeveloper && (
          <section style={{ marginBottom: 28 }}>
            <p style={{ ...sectionLabel, color: '#8B4789' }}>🔧 개발자 도구</p>
            <p style={{ fontSize: 11, color: '#999', marginTop: -6, marginBottom: 10 }}>
              허 대표님께만 보임
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              {devToolCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => navigate(card.path)}
                  style={{
                    ...knowledgeCardStyle,
                    border: '0.5px solid #d9c9e8',
                    background: '#FBF8FE',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{card.icon}</span>
                  <span style={{ color: '#5a2d7a' }}>{card.label}</span>
                  <span style={{ fontSize: 11, color: '#888', fontWeight: 400, textAlign: 'center', lineHeight: 1.3 }}>
                    {card.desc}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

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
