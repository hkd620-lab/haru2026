import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { BUSINESS_INFO } from '../components/BusinessInfoNotice';

export function BusinessInfoPage() {
  const navigate = useNavigate();
  const rows: { label: string; value: ReactNode; href?: string }[] = [
    { label: '상호명', value: '하루랩 (HaruLab)' },
    { label: '서비스명', value: 'HARU2026' },
    { label: '대표자', value: BUSINESS_INFO.representative },
    {
      label: '사업자등록번호',
      value: (
        <>
          {BUSINESS_INFO.businessNumber}{' '}
          <a
            href={BUSINESS_INFO.ftcUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#1A3C6E', textDecoration: 'underline' }}
          >
            사업자정보확인
          </a>
        </>
      ),
    },
    { label: '통신판매업신고번호', value: BUSINESS_INFO.mailOrderNumber },
    { label: '사업장 주소', value: BUSINESS_INFO.address },
    { label: '연락처', value: BUSINESS_INFO.phone },
    { label: '이메일', value: BUSINESS_INFO.email },
    { label: '서비스 URL', value: BUSINESS_INFO.site },
    { label: '공정위 사업자정보 확인', value: BUSINESS_INFO.ftcUrl, href: BUSINESS_INFO.ftcUrl },
  ];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px', fontFamily: 'inherit' }}>
      <button
        onClick={() => navigate('/settings')}
        style={{ position: 'fixed', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1A3C6E', color: 'white', fontSize: '18px', border: 'none', cursor: 'pointer', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >✕</button>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A3C6E', marginBottom: 24 }}>
        사업자 정보
      </h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <tbody>
          {rows.map(({ label, value, href }) => (
            <tr key={label} style={{ borderBottom: '1px solid #e5e5e5' }}>
              <td
                style={{
                  padding: '14px 16px',
                  fontWeight: 600,
                  color: '#555',
                  backgroundColor: '#FEFBE8',
                  width: '35%',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </td>
              <td style={{ padding: '14px 16px', color: '#333' }}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1A3C6E', textDecoration: 'underline' }}
                  >
                    {value}
                  </a>
                ) : (
                  value
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
