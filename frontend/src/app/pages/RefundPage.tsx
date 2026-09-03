const sections = [
  {
    title: '적용 상품',
    content:
      'HARU2026 환불정책은 베이직·프리미엄의 1개월 월간 구독 및 이용권에 적용됩니다.',
  },
  {
    title: '전액 환불',
    content:
      '결제 시각부터 7일(168시간) 이내이고, 유료 기능 이용 이력(기록 작성, AI 다듬기, 합본 출력, PDF 저장 등)이 없는 경우 전액 환불해 드립니다.',
  },
  {
    title: '부분 환불 (산정 기준)',
    content:
      '전액 환불 조건에 해당하지 않는 경우, 아래 계산식에 따라 환불해 드립니다.\n\n환불액 = 결제금액 − (결제금액 ÷ 30일 × 이용경과일수)\n\n· 이용경과일수는 결제일부터 환불 신청일까지로 계산합니다.\n· 원 단위 미만은 이용자에게 유리하도록 절상합니다.\n· 이용 이력이 있는 경우에도 위 계산식에 따라 동일하게 환불합니다.\n\n[예시] 베이직(4,000원) 결제 후 10일 사용 시\n4,000 − (4,000 ÷ 30 × 10) = 2,667원 환불',
  },
  {
    title: '환불 불가 기준',
    content:
      '구독 만료까지 남은 기간이 7일 미만인 경우에는 환불이 어렵습니다.',
  },
  {
    title: '정기결제 구독 해지',
    content:
      '정기결제 구독은 설정 > 구독 관리에서 언제든 해지하실 수 있습니다. 해지하시면 다음 결제일부터 청구되지 않으며, 이미 결제된 이용 기간은 종료일까지 계속 이용하실 수 있습니다.',
  },
  {
    title: '회사의 귀책사유가 있는 경우',
    content:
      '회사의 귀책사유로 서비스가 정상적으로 제공되지 못한 경우, 또는 표시·광고의 내용과 다르게 서비스가 제공된 경우에는 결제 기록 확인 후 관련 법령과 서비스 정책에 따라 환불을 안내합니다.',
  },
  {
    title: '중복결제·과오금',
    content:
      '중복결제, 과오금 또는 결제 시스템 오류로 요금이 잘못 부과된 경우, 결제 기록 확인 후 해당 금액의 환급을 안내합니다.',
  },
  {
    title: '환불 방법 및 처리 기간',
    content:
      '환불은 결제하신 수단과 동일한 방법으로 처리함을 원칙으로 합니다. 동일한 방법으로 환불이 불가능한 경우 사전에 안내해 드립니다.\n\n환불 요청 확인 후 3~5영업일 이내에 처리됩니다.',
  },
  {
    title: '환불 문의',
    content: '· 이메일: harul2026lab@gmail.com\n· 전화: 0502-1933-6740',
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
        구독 및 이용권 환불 정책
      </h1>
      <p style={{ fontSize: 13, color: '#999', marginBottom: 32 }}>
        시행일: 2026년 8월 20일 · HARU2026 1개월 월간 상품 기준
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
