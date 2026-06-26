import { useNavigate } from 'react-router-dom';

const DANGER_KEYWORDS = [
  '포도', '건포도', '초콜릿', '자일리톨', '양파', '마늘', '대파', '쪽파',
  '아보카도', '마카다미아', '카페인', '커피', '알코올', '술',
  '구토', '경련', '발작', '혈변', '피 섞인', '소변 못', '호흡 곤란',
  '숨 가쁨', '무기력', '안 먹', '식욕 없',
];

const WARNING_KEYWORDS = [
  '토했', '토를', '설사', '긁는다', '피부', '털 빠짐', '힘 없',
  '땅콩', '생계란', '생연어', '우유', '치즈',
];

export type PetAlertLevel = 'danger' | 'warning' | null;

export function detectPetAlertLevel(fields: Record<string, string>): PetAlertLevel {
  const text = Object.values(fields).join(' ').toLowerCase();
  if (DANGER_KEYWORDS.some((kw) => text.includes(kw))) return 'danger';
  if (WARNING_KEYWORDS.some((kw) => text.includes(kw))) return 'warning';
  return null;
}

type Props = {
  level: PetAlertLevel;
  onDismiss: () => void;
};

export function PetHealthAlert({ level, onDismiss }: Props) {
  const navigate = useNavigate();
  if (!level) return null;

  const isDanger = level === 'danger';

  return (
    <div style={{
      position: 'fixed',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 480,
      zIndex: 9999,
      borderRadius: 12,
      padding: '14px 16px',
      background: isDanger ? '#fef2f2' : '#fffbeb',
      border: `1px solid ${isDanger ? '#fca5a5' : '#fde68a'}`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>
        {isDanger ? '🚨' : '⚠️'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: isDanger ? '#dc2626' : '#b45309', marginBottom: 4 }}>
          {isDanger
            ? '기록에서 위험 신호가 감지됐습니다'
            : '기록에서 주의 증상이 감지됐습니다'}
        </p>
        <p style={{ fontSize: 12, color: isDanger ? '#ef4444' : '#d97706', lineHeight: 1.5 }}>
          {isDanger
            ? '반려동물 건강돌봄비서에서 확인해보세요.'
            : '증상이 지속되면 동물병원 상담을 권합니다.'}
        </p>
        <button
          onClick={() => { navigate('/pet-health'); onDismiss(); }}
          style={{
            marginTop: 8,
            padding: '5px 12px',
            borderRadius: 6,
            border: 'none',
            background: isDanger ? '#dc2626' : '#d97706',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🐾 건강돌봄비서 확인
        </button>
      </div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, flexShrink: 0, padding: 0 }}
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}
