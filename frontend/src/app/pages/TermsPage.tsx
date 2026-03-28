const articles = [
  {
    title: '제1조 (목적)',
    content:
      '이 약관은 JOYEL(이하 "회사")이 제공하는 HARU 서비스(이하 "서비스") 이용에 관한 조건 및 절차를 규정함을 목적으로 합니다.',
  },
  {
    title: '제2조 (서비스 내용)',
    content:
      '회사는 기록 작성, AI 다듬기(SAYU), 합본 출력 등 구독형 서비스를 제공합니다. 일부 기능은 프리미엄 구독 회원에게만 제공됩니다.',
  },
  {
    title: '제3조 (이용 요금)',
    content: [
      '무료 플랜: 기본 기록 기능 제공',
      '프리미엄 월간: 월 3,000원',
      '프리미엄 연간: 연 30,000원',
    ],
  },
  {
    title: '제4조 (계약 해지)',
    content:
      '이용자는 언제든지 구독을 해지할 수 있습니다. 해지 시 다음 결제일부터 요금이 청구되지 않으며, 해지 전 이미 결제된 기간은 계속 이용 가능합니다.',
  },
  {
    title: '제5조 (면책)',
    content:
      '회사는 천재지변, 전쟁, 테러, 해킹, 통신장애 등 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.',
  },
];

import { useNavigate } from 'react-router-dom';

export function TermsPage() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px', fontFamily: 'inherit' }}>
      <button
        onClick={() => navigate('/settings')}
        style={{ position: 'fixed', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1A3C6E', color: 'white', fontSize: '18px', border: 'none', cursor: 'pointer', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >✕</button>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>
        이용약관
      </h1>
      <p style={{ fontSize: 13, color: '#999', marginBottom: 32 }}>
        시행일: 2026년 1월 1일
      </p>
      {articles.map((article) => (
        <div key={article.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>
            {article.title}
          </h2>
          {Array.isArray(article.content) ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {article.content.map((item) => (
                <li key={item} style={{ fontSize: 14, color: '#333', lineHeight: 1.8 }}>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 14, color: '#333', lineHeight: 1.8, margin: 0 }}>
              {article.content}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
