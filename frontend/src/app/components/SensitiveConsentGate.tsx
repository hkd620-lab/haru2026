import { useNavigate } from 'react-router-dom';

const COPY: Record<'health' | 'legal', { label: string; feature: string }> = {
  health: { label: '건강', feature: 'AI 정리·요약' },
  legal: { label: '법률', feature: 'AI 분석' },
};

// 건강·법률 등 민감정보 기능 최초 진입 시 표시하는 별도 동의 화면.
// 동의하지 않아도 이 화면에서 이전 페이지로 돌아갈 수 있을 뿐, 다른 기능은 그대로 이용 가능하다.
export function SensitiveConsentGate({
  category,
  isSaving,
  onAgree,
}: {
  category: 'health' | 'legal';
  isSaving: boolean;
  onAgree: () => void;
}) {
  const navigate = useNavigate();
  const copy = COPY[category];

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: '28px 22px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: '1px solid #E5E7EB',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A3C6E', marginBottom: 12 }}>
          {copy.label} 정보 수집·이용 동의가 필요합니다
        </h2>
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 6 }}>
          {copy.label} 관련 기록은 민감정보에 해당합니다.
        </p>
        <ul style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, paddingLeft: 18, marginBottom: 20 }}>
          <li>입력하신 내용은 회원님 계정에만 저장되며 다른 이용자에게 공개되지 않습니다</li>
          <li>{copy.feature} 기능을 사용하실 때에만 외부 AI 서비스로 전송되어 처리됩니다</li>
          <li>동의하지 않으셔도 다른 기능은 그대로 이용하실 수 있습니다</li>
        </ul>

        <button
          type="button"
          onClick={onAgree}
          disabled={isSaving}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: isSaving ? '#93c5fd' : '#1A3C6E',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            marginBottom: 10,
          }}
        >
          {isSaving ? '처리 중...' : `${copy.label}정보 수집·이용에 동의합니다`}
        </button>

        <button
          type="button"
          onClick={() => navigate(-1)}
          disabled={isSaving}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            backgroundColor: '#fff',
            color: '#4B5563',
            fontSize: 14,
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          이전으로
        </button>
      </div>
    </div>
  );
}
