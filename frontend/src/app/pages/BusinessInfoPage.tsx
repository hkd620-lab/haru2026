import { useNavigate } from 'react-router-dom';

export function BusinessInfoPage() {
  const navigate = useNavigate();
  const rows = [
    { label: '상호명', value: '주식회사 조이엘' },
    { label: '서비스명', value: 'HARU by JOYEL' },
    { label: '대표자', value: '허찬미' },
    { label: '사업자등록번호', value: '455-87-03270' },
    { label: '주소', value: '서울특별시 구로구 디지털로31길 41, 611-2-4호(구로동, 이앤씨벤처드림타워6차)' },
    { label: '연락처', value: '0502-1916-8643' },
    { label: '이메일', value: 'hkd620@gmail.com' },
    { label: '서비스 URL', value: 'https://haru2026.com' },
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
          {rows.map(({ label, value }) => (
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
              <td style={{ padding: '14px 16px', color: '#333' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
