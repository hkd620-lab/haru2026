import { useLocation } from 'react-router';
import { BUSINESS_INFO } from './BusinessInfoNotice';

export function Footer() {
  const location = useLocation();
  if (location.pathname === '/v2') return null;

  return (
    <footer
      className="bg-white px-4 py-4 text-left text-xs leading-relaxed text-gray-600"
      style={{ marginBottom: 'calc(var(--bottomnav-height, 80px) + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto max-w-3xl break-keep">
        <section
          aria-label="회사정보"
          className="grid grid-cols-2 gap-4 border-y-[3px] border-[#475569] py-3 [overflow-wrap:anywhere]"
        >
          <div className="flex min-w-0 flex-col justify-between gap-1">
            <p>상호명: {BUSINESS_INFO.company} (HaruLab)</p>
            <p>대표자: {BUSINESS_INFO.representative}</p>
            <p>사업자등록번호: {BUSINESS_INFO.businessNumber}</p>
            <p>통신판매업신고번호: {BUSINESS_INFO.mailOrderNumber}</p>
            <p>사업장 주소: {BUSINESS_INFO.address}</p>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-1">
            <p>연락처: {BUSINESS_INFO.phone}</p>
            <p>이메일: {BUSINESS_INFO.email}</p>
            <p>사이트: {BUSINESS_INFO.site}</p>
            <p>하루랩에서 운영하는 사이트에서 판매되는 모든 상품은 하루랩에서 책임지고 있습니다.</p>
            <p>
              민원 담당자: 허경대<br />
              연락처: 010-6309-6107
            </p>
          </div>
        </section>
        <nav aria-label="서비스 및 사업자 정보" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 underline">
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
