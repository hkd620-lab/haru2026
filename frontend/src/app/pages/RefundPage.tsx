const sections = [
  {
    title: '전액 환불 조건',
    content: '구독 결제 후 7일 이내이며, 서비스 이용 이력(기록 작성, AI 다듬기, 합본 출력 등)이 없는 경우 전액 환불이 가능합니다.',
  },
  {
    title: '부분 환불 조건 (연간 구독)',
    content: '연간 구독권의 경우, 결제일로부터 7일 초과 후 환불 요청 시 잔여 이용 기간에 비례한 부분 환불이 가능합니다.\n\n· 부분 환불 금액 = 결제 금액 × (잔여 일수 ÷ 365)\n· 단, 서비스 이용 이력이 있는 경우에도 부분 환불 신청이 가능합니다.',
  },
  {
    title: '부분 환불 조건 (월간 구독)',
    content: '월간 구독권의 경우, 결제일로부터 7일 초과 후 환불 요청 시 잔여 이용 기간에 비례한 부분 환불이 가능합니다.\n\n· 부분 환불 금액 = 결제 금액 × (잔여 일수 ÷ 30)\n· 단, 서비스 이용 이력이 있는 경우에도 부분 환불 신청이 가능합니다.',
  },
  {
    title: '환불 불가 조건',
    content: '구독 만료일이 7일 미만으로 남은 경우 환불이 불가합니다.',
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
          <p style={{ fontSize: 14, color: '#333', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>
            {section.content}
          </p>
        </div>
      ))}
    </div>
  );
}
