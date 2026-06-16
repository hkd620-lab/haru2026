import { useLocation } from 'react-router-dom';

export function Footer() {
  const location = useLocation();
  if (location.pathname === '/v2') return null;
  return (
    <footer style={{
      borderTop: '1px solid rgba(0,0,0,0.08)',
      padding: '20px 16px',
      textAlign: 'center',
      color: '#999',
      fontSize: '11px',
      lineHeight: 1.8,
      background: '#fff',
      marginBottom: 'calc(var(--bottomnav-height, 80px) + env(safe-area-inset-bottom, 0px))',
    }}>
      <p>상호명: 하루랩 (HaruLab) &nbsp;|&nbsp; 대표자: 허경대 &nbsp;|&nbsp; 사업자등록번호: 354-23-02490</p>
      <p>사업장 주소: 서울특별시 구로구 중앙로5길 62</p>
      <p>연락처: 050219336740 &nbsp;|&nbsp; 이메일: harul2026lab@gmail.com</p>
      <p>
        <a href="/subscription" style={{ color: '#777', textDecoration: 'underline' }}>구독/요금</a>
        &nbsp;|&nbsp;
        <a href="/business-info" style={{ color: '#777', textDecoration: 'underline' }}>사업자 정보</a>
        &nbsp;|&nbsp;
        <a href="/terms" style={{ color: '#777', textDecoration: 'underline' }}>이용약관</a>
        &nbsp;|&nbsp;
        <a href="/privacy" style={{ color: '#777', textDecoration: 'underline' }}>개인정보처리방침</a>
        &nbsp;|&nbsp;
        <a href="/refund" style={{ color: '#777', textDecoration: 'underline' }}>환불정책</a>
      </p>
    </footer>
  );
}
