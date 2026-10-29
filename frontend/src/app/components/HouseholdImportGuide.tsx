import { DOWNLOAD_NEXT_STEP, HOUSEHOLD_IMPORT_SOURCES, householdImportKind, type HouseholdGuideSourceId } from '../services/householdImportSources';

export function HouseholdImportGuide({ sourceId, onChange, disabled }: {
  sourceId: HouseholdGuideSourceId; onChange: (id: HouseholdGuideSourceId) => void; disabled: boolean;
}) {
  const source = HOUSEHOLD_IMPORT_SOURCES.find(item => item.id === sourceId)!;
  const linkStyle = { color: '#1A3C6E', textDecoration: 'underline' };
  return <section aria-label="은행·카드 파일 다운로드 안내" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
    <label>은행·카드 선택
      <select aria-label="안내할 은행·카드" value={sourceId} disabled={disabled} onChange={e => onChange(e.target.value as HouseholdGuideSourceId)} style={{ display: 'block', width: '100%', fontSize: 16, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', margin: '6px 0 10px' }}>
        {HOUSEHOLD_IMPORT_SOURCES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <strong>{source.status === 'supported' ? '현재지원: 카카오뱅크 PDF·XLSX' : source.status === 'pilot' ? '시범: 카드 이용내역 XLS·XLSX' : '안내만 제공 · 파일 가져오기 미지원'}</strong>
    {sourceId === 'kakaobank' ? <>
      <p><b>엑셀 받기</b><br />계좌 선택 → 계좌관리 → 거래내역 → 거래내역 다운로드에서 기간과 받을 이메일을 입력하세요. 받은 첨부파일을 저장하세요.<br /><a href={source.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>카카오뱅크 공식 엑셀 안내</a></p>
      <p><b>PDF 받기</b><br />전체 → 고객센터 → 증명서 발급 → 거래내역서(국문) → PDF → 기간 조회 후 신청하세요.<br /><a href="https://blog.kakaobank.com/posts/service-transaction-statement" target="_blank" rel="noopener noreferrer" style={linkStyle}>카카오뱅크 공식 PDF 안내</a></p>
      <p>카카오뱅크 텍스트 PDF·XLSX만 읽습니다. 스캔·사진 PDF는 읽지 않습니다. 암호가 있는 엑셀은 기존 암호 해제 서비스를 이용하며, PDF와 암호 없는 엑셀은 기기 안에서 읽습니다.</p>
    </> : <>
      <p><b>① 공식 공개 메뉴</b><br />{source.menu}<br /><a href={source.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{source.name} 공식 사이트 열기</a>{source.loginRequired && <span> · 로그인 화면으로 연결됨</span>}</p>
      <p><b>② 로그인 뒤 확인 전 단계</b><br />{DOWNLOAD_NEXT_STEP}</p>
      {sourceId === 'kbcard' && <>
        <p>로그인 뒤 엑셀 저장 버튼과 앱 다운로드는 확인 전입니다. 실제 국민카드 파일 형식은 확인 전이며, 모든 파일의 지원을 보장하지 않습니다.</p>
        <p><b>카드 이용내역 엑셀 시범 가져오기</b><br />필수 열: 이용일자(또는 이용일), 가맹점명(또는 가맹점), 이용금액, 상태.<br />연도가 있는 날짜와 원화 정수 금액만 읽습니다. 정상·승인·매입·취소·승인취소·매입취소 상태만 읽습니다.</p>
        <p>이용금액(구매 전체금액) 기준입니다. 할부도 전체금액 1건으로 기록하며 월 청구분이 아닙니다. 청구금액·결제원금·회차 열이 있는 청구서, 암호가 있는 카드 엑셀, 카드 PDF는 읽지 않습니다.</p>
      </>}
    </>}
    <p>공식 공개 안내 확인: 2026-10-29</p>
    <p>휴대폰에서는 받은 파일을 아이폰의 ‘파일’ 앱 또는 안드로이드의 다운로드 폴더에 저장한 뒤 파일 선택에서 골라 주세요.</p>
    {!householdImportKind(sourceId) && <p role="status">준비중: 이 은행 파일은 아직 읽지 않습니다. 다운로드 안내와 하루의 파일 읽기 지원 범위는 다릅니다.</p>}
  </section>;
}
