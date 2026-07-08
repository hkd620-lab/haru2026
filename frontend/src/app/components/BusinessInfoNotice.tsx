export const BUSINESS_INFO_TEXT =
  '하루랩 | 대표 허경대 | 사업자등록번호 354-23-02490 | 통신판매업신고번호 제2026-서울구로-1247호 | 이메일 harul2026lab@gmail.com';

export const BUSINESS_INFO = {
  company: '하루랩',
  representative: '허경대',
  businessNumber: '354-23-02490',
  mailOrderNumber: '제2026-서울구로-1247호',
  email: 'harul2026lab@gmail.com',
  site: 'https://haru2026.com',
};

type BusinessInfoNoticeProps = {
  className?: string;
};

export function BusinessInfoNotice({ className = '' }: BusinessInfoNoticeProps) {
  return (
    <p className={`text-center text-[11px] leading-5 text-gray-400 ${className}`}>
      {BUSINESS_INFO_TEXT}
    </p>
  );
}
