export function Footer() {
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
      <p>상호명: 주식회사 조이엘 &nbsp;|&nbsp; 대표: 허찬미 &nbsp;|&nbsp; 사업자등록번호: 455-87-03270</p>
      <p>주소: 서울특별시 구로구 디지털로31길 41, 611-2-4호(구로동, 이앤씨벤처드림타워6차)</p>
      <p>대표전화: 0502-1916-8643 &nbsp;|&nbsp; 이메일: hkd620@gmail.com</p>
    </footer>
  );
}
