const sections = [
  {
    title: '환불 가능 조건',
    content: '구독 결제 후 7일 이내이며, 서비스 이용 이력(기록 작성, AI 다듬기, 합본 출력 등)이 없는 경우 전액 환불이 가능합니다.',
  },
  {
    title: '환불 불가 조건',
    content: '서비스 이용 이력이 확인된 경우 환불이 불가합니다.',
  },
  {
    title: '환불 문의',
    content: 'hkd620@gmail.com',
  },
  {
    title: '처리 기간',
    content: '환불 요청 확인 후 영업일 기준 3~5일 이내에 처리됩니다.',
  },
];

import { useNavigate } from 'react-router-dom';

export function RefundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px', fontFamily: 'inherit' }}>
      <button
        onClick={() => navigate('/settings')}
        style={{ position: 'fixed', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1A3C6E', color: 'white', fontSize: '18px', border: 'none', cursor: 'pointer', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >✕</button>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>
        환불 정책
      </h1>
      <p style={{ fontSize: 13, color: '#999', marginBottom: 32 }}>
        시행일: 2026년 1월 1일
      </p>
      {sections.map((section) => (
        <div
          key={section.title}
          style={{
            marginBottom: 24,
            padding: '18px 20px',
            backgroundColor: '#FEFBE8',
            borderRadius: 8,
            border: '1px solid #e5e5e5',
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A3C6E', marginBottom: 6 }}>
            {section.title}
          </h2>
          <p style={{ fontSize: 14, color: '#333', lineHeight: 1.8, margin: 0 }}>
            {section.content}
          </p>
        </div>
      ))}
    </div>
  );
}
