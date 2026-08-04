import { useLocation } from 'react-router-dom';
import { BUSINESS_INFO } from './BusinessInfoNotice';

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
      <p>
        상호명: 하루랩 (HaruLab) &nbsp;|&nbsp; 대표자: 허경대 &nbsp;|&nbsp;
        사업자등록번호: {BUSINESS_INFO.businessNumber} &nbsp;|&nbsp;
        통신판매업신고번호: {BUSINESS_INFO.mailOrderNumber} &nbsp;|&nbsp;
        <a
          href={`https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS_INFO.businessNumber.replace(/-/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#777', textDecoration: 'underline' }}
        >
          사업자정보확인
        </a>
      </p>
      <p>사업장 주소: 서울특별시 구로구 중앙로5길 62, 3동 305호</p>
      <p>연락처: 050219336740 &nbsp;|&nbsp; 이메일: {BUSINESS_INFO.email} &nbsp;|&nbsp; 사이트: {BUSINESS_INFO.site}</p>
      <p>
        하루랩에서 운영하는 사이트에서 판매되는 모든 상품은 하루랩에서 책임지고 있습니다.<br />
        민원 담당자: 허경대 / 연락처: 010-6309-6107
      </p>
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
