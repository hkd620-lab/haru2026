import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router';
import { BUSINESS_INFO } from './BusinessInfoNotice';

export function Footer() {
  const location = useLocation();
  const { user } = useAuth();
  if (location.pathname === '/v2') return null;
  return (
    <footer style={{
      borderTop: '1px solid rgba(0,0,0,0.08)',
      padding: '16px',
      textAlign: 'center',
      color: 'var(--haru-muted, #595959)',
      fontSize: '12px',
      lineHeight: 1.8,
      background: 'var(--haru-surface, #fff)',
    }}>
      <details className="haru-business-details" open={!user || location.pathname !== '/'}>
        <summary>하루lab · 사업자 정보</summary>
      <p>
        상호명: 하루랩 (HaruLab) &nbsp;|&nbsp; 대표자: 허경대 &nbsp;|&nbsp;
        사업자등록번호: {BUSINESS_INFO.businessNumber} &nbsp;|&nbsp;
        통신판매업신고번호: {BUSINESS_INFO.mailOrderNumber} &nbsp;|&nbsp;
        <a
          href={BUSINESS_INFO.ftcUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--haru-muted, #595959)', textDecoration: 'underline' }}
        >
          사업자정보확인
        </a>
      </p>
      <p>사업장 주소: {BUSINESS_INFO.address}</p>
      <p>연락처: {BUSINESS_INFO.phone} &nbsp;|&nbsp; 이메일: {BUSINESS_INFO.email} &nbsp;|&nbsp; 사이트: {BUSINESS_INFO.site}</p>
      <p>
        하루랩에서 운영하는 사이트에서 판매되는 모든 상품은 하루랩에서 책임지고 있습니다.<br />
        민원 담당자: 허경대 / 연락처: 010-6309-6107
      </p>
      </details>
      <p>
        <a href="/subscription" style={{ color: 'var(--haru-muted, #595959)', textDecoration: 'underline' }}>구독/요금</a>
        &nbsp;|&nbsp;
        <a href="/business-info" style={{ color: 'var(--haru-muted, #595959)', textDecoration: 'underline' }}>사업자 정보</a>
        &nbsp;|&nbsp;
        <a href="/terms" style={{ color: 'var(--haru-muted, #595959)', textDecoration: 'underline' }}>이용약관</a>
        &nbsp;|&nbsp;
        <a href="/privacy" style={{ color: 'var(--haru-muted, #595959)', textDecoration: 'underline' }}>개인정보처리방침</a>
        &nbsp;|&nbsp;
        <a href="/refund" style={{ color: 'var(--haru-muted, #595959)', textDecoration: 'underline' }}>환불정책</a>
        &nbsp;|&nbsp;
        <a
          href={BUSINESS_INFO.ftcUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--haru-muted, #595959)', textDecoration: 'underline' }}
        >
          공정위 사업자정보 확인
        </a>
      </p>
    </footer>
  );
}
