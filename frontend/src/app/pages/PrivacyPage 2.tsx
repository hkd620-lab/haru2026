const sections = [
  {
    title: '1. 수집 항목',
    content: '이메일 주소, 소셜 로그인 정보(Google · 카카오 · 네이버), 서비스 내에서 작성한 기록 데이터',
  },
  {
    title: '2. 수집 목적',
    content: '서비스 제공, 회원 식별, 결제 처리 및 고객 지원',
  },
  {
    title: '3. 보유 기간',
    content: '회원 탈퇴 시까지 보유하며, 탈퇴 즉시 파기합니다. 단, 관계 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 보관합니다.',
  },
  {
    title: '4. 제3자 제공',
    content: '결제 처리를 위해 PortOne(포트원)에 최소한의 정보를 제공합니다. 그 외 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.',
  },
  {
    title: '5. 개인정보 처리 위탁',
    content: '결제 서비스 제공을 위해 아래 업체에 개인정보 처리를 위탁합니다.\n- 수탁업체: (주)코리아포트원\n- 위탁 업무: 결제 연동 처리\n- 보유 및 이용 기간: 위탁 계약 종료 시까지',
  },
  {
    title: '6. 개인정보 관리 책임자',
    content: '성명: 허경대\n문의 이메일: hkd620@gmail.com',
  },
];

import { useNavigate } from 'react-router-dom';

export function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px', fontFamily: 'inherit' }}>
      <button
        onClick={() => navigate('/settings')}
        style={{ position: 'fixed', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1A3C6E', color: 'white', fontSize: '18px', border: 'none', cursor: 'pointer', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >✕</button>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>
        개인정보처리방침
      </h1>
      <p style={{ fontSize: 13, color: '#999', marginBottom: 32 }}>
        시행일: 2026년 1월 1일
      </p>
      {sections.map((section) => (
        <div key={section.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>
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
