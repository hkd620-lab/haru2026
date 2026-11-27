import { useLocation } from 'react-router';
import { BUSINESS_INFO } from './BusinessInfoNotice';

export function Footer() {
  const location = useLocation();
  if (location.pathname === '/v2') return null;

  return (
    <footer
      className="border-t border-black/10 bg-white px-4 py-4 text-center text-xs leading-relaxed text-gray-600"
      style={{ marginBottom: 'calc(var(--bottomnav-height, 80px) + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 break-keep">
        <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          <span>상호명: {BUSINESS_INFO.company} (HaruLab)</span>
          <span>대표자: {BUSINESS_INFO.representative}</span>
          <span>사업자등록번호: {BUSINESS_INFO.businessNumber}</span>
          <span>통신판매업신고번호: {BUSINESS_INFO.mailOrderNumber}</span>
        </p>
        <p>사업장 주소: {BUSINESS_INFO.address}</p>
        <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          <span>연락처: {BUSINESS_INFO.phone}</span>
          <span>이메일: {BUSINESS_INFO.email}</span>
          <span>사이트: {BUSINESS_INFO.site}</span>
        </p>
        <p>
          하루랩에서 운영하는 사이트에서 판매되는 모든 상품은 하루랩에서 책임지고 있습니다.<br />
          민원 담당자: 허경대 / 연락처: 010-6309-6107
        </p>
        <nav aria-label="서비스 및 사업자 정보" className="flex flex-wrap justify-center gap-x-3 gap-y-1 underline">
          <a className="whitespace-nowrap" href="/subscription">구독/요금</a>
          <a className="whitespace-nowrap" href="/business-info">사업자 정보</a>
          <a className="whitespace-nowrap" href="/terms">이용약관</a>
          <a className="whitespace-nowrap" href="/privacy">개인정보처리방침</a>
          <a className="whitespace-nowrap" href="/refund">환불정책</a>
          <a className="whitespace-nowrap" href={BUSINESS_INFO.ftcUrl} target="_blank" rel="noopener noreferrer">
            공정위 사업자정보 확인
          </a>
        </nav>
      </div>
    </footer>
  );
}
