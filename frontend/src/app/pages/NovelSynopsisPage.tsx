import { useNavigate } from 'react-router';

export function NovelSynopsisPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      maxWidth: 640, margin: '0 auto', padding: '24px 16px',
      minHeight: 'calc(100vh - 56px - 80px)',
      backgroundColor: '#FAF9F6',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>🔮</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A3C6E', margin: 0 }}>HARU예언</h1>
        </div>
        <button
          onClick={() => navigate('/novel-studio')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#6B7280', padding: '6px 10px',
            borderRadius: 8,
          }}
        >
          ← 설정으로
        </button>
      </div>

      {/* 안내 카드 */}
      <div style={{
        background: '#EEF2FF', border: '1px solid #C7D2FE',
        borderRadius: 14, padding: '20px', marginBottom: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔮</div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>
          AI가 당신의 미래를 예언합니다
        </h2>
        <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.7, margin: 0 }}>
          설정하신 내용을 바탕으로<br />
          Gemini AI가 당신만의 미래 서사를 생성합니다.<br />
          사주보다 정확한 AI 예언 — HARU예언
        </p>
      </div>

      {/* 시놉시스 생성 버튼 */}
      <button
        onClick={() => {
          // TODO: Gemini API 호출로 시놉시스 생성
          alert('🔮 시놉시스 생성 기능은 곧 공개됩니다!');
        }}
        style={{
          width: '100%', padding: '16px',
          borderRadius: 12, border: 'none',
          background: '#1A3C6E', color: '#fff',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        🔮 예언 시작하기
      </button>

      <button
        onClick={() => navigate('/novel-studio')}
        style={{
          width: '100%', padding: '14px',
          borderRadius: 12, border: '1.5px solid #d1d5db',
          background: '#fff', color: '#6B7280',
          fontSize: 14, fontWeight: 500, cursor: 'pointer',
        }}
      >
        ← 설정 수정하기
      </button>
    </div>
  );
}
