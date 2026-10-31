export type HouseholdGuideSourceId = 'kakaobank' | 'kbcard' | 'kbbank' | 'shinhan' | 'hana' | 'woori' | 'nh';
export type HouseholdImportSourceId = 'kakaobank' | 'kbcard';
export const DOWNLOAD_NEXT_STEP = '계좌·기간 조회 후 엑셀 저장/다운로드 제공 여부를 확인해 주세요. 없으면 은행 고객센터에 파일 제공 방법을 문의해 주세요.';
export interface HouseholdImportSource {
  id: HouseholdGuideSourceId;
  name: string;
  status: 'supported' | 'pilot' | 'guide';
  menu: string;
  url: string;
  loginRequired?: boolean;
}
export const HOUSEHOLD_IMPORT_SOURCES: readonly HouseholdImportSource[] = [
  { id: 'kbbank', name: 'KB국민은행', status: 'guide', menu: '개인뱅킹 → 조회 → 거래내역 조회', url: 'https://obank.kbstar.com/quics?page=obank' },
  { id: 'kbcard', name: 'KB국민카드', status: 'pilot', menu: '홈페이지 My KB → 카드이용 → 이용내역·매출전표', url: 'https://card.kbcard.com/MKB/DVIEW/HMBMCXPRIMYS0007' },
  { id: 'kakaobank', name: '카카오뱅크', status: 'supported', menu: '아래 엑셀·PDF 안내를 확인해 주세요.', url: 'https://m.kakaobank.com/FaqView/view/9413' },
  { id: 'shinhan', name: '신한은행', status: 'guide', menu: '전체메뉴 → 조회 → 계좌조회 → 예금/신탁', url: 'https://bank.shinhan.com/index.jsp#010101010000', loginRequired: true },
  { id: 'hana', name: '하나은행', status: 'guide', menu: '조회 → 거래내역조회', url: 'https://www.kebhana.com/' },
  { id: 'woori', name: '우리은행', status: 'guide', menu: '개인뱅킹 → 조회', url: 'https://spib.wooribank.com/pib/Dream?withyou=PSINQ0001', loginRequired: true },
  { id: 'nh', name: 'NH농협은행', status: 'guide', menu: '개인 인터넷뱅킹 홈 → 거래내역', url: 'https://banking.nonghyup.com/nhbank.html', loginRequired: true },
];
export function householdImportKind(id: HouseholdGuideSourceId): HouseholdImportSourceId | null {
  return id === 'kakaobank' || id === 'kbcard' ? id : null;
}
