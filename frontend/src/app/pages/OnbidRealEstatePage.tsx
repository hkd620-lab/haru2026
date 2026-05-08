import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

type OnbidItem = {
  cltrMngNo?: string;
  pbctCdtnNo?: string | number;
  onbidCltrno?: string | number;
  onbidPbancNo?: string | number;
  pbctNo?: string | number;
  onbidCltrNm?: string;
  prptDivNm?: string;
  dspsMthodNm?: string;
  bidMthodNm?: string;
  cptnMthodNm?: string;
  bidDivNm?: string;
  cltrUsgLclsCtgrNm?: string;
  cltrUsgMclsCtgrNm?: string;
  cltrUsgSclsCtgrNm?: string;
  lctnSdnm?: string;
  lctnSggnm?: string;
  lctnEmdNm?: string;
  apslEvlAmt?: string | number;
  lowstBidPrcIndctCont?: string;
  apslPrcCtrsLowstBidRto?: string | number;
  cltrBidBgngDt?: string;
  cltrBidEndDt?: string;
  usbdNft?: string | number;
  bidPrgnNft?: string | number;
  pvctTrgtYn?: string;
  alcYn?: string;
  landSqms?: string | number;
  bldSqms?: string | number;
  thnlImgUrlAdr?: string;
  pbctStatNm?: string;
  orgNm?: string;
  rqstOrgNm?: string;
};

type OnbidResponse = {
  success: boolean;
  items: OnbidItem[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
  resultCode?: string;
  resultMsg?: string;
  disclaimer?: string;
};

const PROPERTY_TYPES = [
  { code: '', label: '전체' },
  { code: '0007', label: '압류재산' },
  { code: '0010', label: '국유재산' },
  { code: '0005', label: '기타일반재산' },
  { code: '0002', label: '공유재산' },
  { code: '0003', label: '금융권담보재산' },
  { code: '0006', label: '유입재산' },
  { code: '0008', label: '수탁재산' },
  { code: '0011', label: '공공개발재산' },
  { code: '0013', label: '파산재산' },
  { code: '0004', label: '불용품' },
];

const SIDO_LIST = [
  '', '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도',
  '경상남도', '제주특별자치도',
];

function formatYmd(yyyymmdd?: string) {
  if (!yyyymmdd || yyyymmdd.length < 8) return '';
  return `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}`;
}

function formatBidDt(s?: string) {
  if (!s || s.length < 12) return s || '';
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

function formatPrice(v?: string | number) {
  if (v === undefined || v === null || v === '') return '-';
  const num = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(num) || num <= 0) return String(v);
  if (num >= 100000000) {
    const eok = (num / 100000000).toFixed(num % 100000000 === 0 ? 0 : 2);
    return `${eok}억원`;
  }
  if (num >= 10000) {
    return `${Math.round(num / 10000).toLocaleString()}만원`;
  }
  return `${num.toLocaleString()}원`;
}

function todayYmd() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${m}${day}`;
}

export function OnbidRealEstatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [prptDivCd, setPrptDivCd] = useState('0007');
  const [lctnSdnm, setLctnSdnm] = useState('');
  const [lctnSggnm, setLctnSggnm] = useState('');
  const [onbidCltrNm, setOnbidCltrNm] = useState('');
  const [bidPrdYmdStart, setBidPrdYmdStart] = useState(todayYmd());
  const [bidPrdYmdEnd, setBidPrdYmdEnd] = useState('');
  const [lowstBidPrcStart, setLowstBidPrcStart] = useState('');
  const [lowstBidPrcEnd, setLowstBidPrcEnd] = useState('');

  const [pageNo, setPageNo] = useState(1);
  const [numOfRows] = useState(10);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OnbidItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searched, setSearched] = useState(false);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / numOfRows)),
    [totalCount, numOfRows]
  );

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const runSearch = async (targetPage = 1) => {
    setLoading(true);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable<any, OnbidResponse>(functions, 'getOnbidRealEstateList');
      const payload: Record<string, string | number> = {
        pageNo: targetPage,
        numOfRows,
      };
      if (prptDivCd) payload.prptDivCd = prptDivCd;
      if (lctnSdnm) payload.lctnSdnm = lctnSdnm;
      if (lctnSggnm.trim()) payload.lctnSggnm = lctnSggnm.trim();
      if (onbidCltrNm.trim()) payload.onbidCltrNm = onbidCltrNm.trim();
      if (bidPrdYmdStart) payload.bidPrdYmdStart = bidPrdYmdStart;
      if (bidPrdYmdEnd) payload.bidPrdYmdEnd = bidPrdYmdEnd;
      if (lowstBidPrcStart) payload.lowstBidPrcStart = lowstBidPrcStart;
      if (lowstBidPrcEnd) payload.lowstBidPrcEnd = lowstBidPrcEnd;

      const res = await fn(payload);
      const data = res.data;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalCount(data?.totalCount || 0);
      setPageNo(data?.pageNo || targetPage);
      setSearched(true);
      if ((data?.totalCount || 0) === 0) {
        toast.info('검색 결과가 없습니다. 조건을 조정해 보세요.');
      }
    } catch (e: any) {
      console.error('[Onbid] search failed', e);
      const msg = e?.message || '검색 중 오류가 발생했습니다';
      toast.error(msg);
      setItems([]);
      setTotalCount(0);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(1);
  };

  const goPage = (p: number) => {
    if (p < 1 || p > totalPages || p === pageNo || loading) return;
    runSearch(p);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d8d3c4',
    borderRadius: 10,
    backgroundColor: '#fff',
    color: '#2C2C2A',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#5A4E7A',
    marginBottom: 6,
    letterSpacing: '-0.01em',
  };

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#1A3C6E' }}
        >
          🏠 온비드 부동산
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666' }}>
          한국자산관리공사 온비드 공매 부동산을 한눈에 — 입찰 일정·최저가·소재지까지
        </p>
      </div>

      {/* 검색 폼 */}
      <form
        onSubmit={onSubmit}
        className="rounded-2xl p-4 md:p-5 mb-5"
        style={{
          background: 'linear-gradient(135deg, #DDD0E8 0%, #ffffff 70%)',
          border: '1px solid #C9C0DE',
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div style={labelStyle}>재산유형</div>
            <select
              value={prptDivCd}
              onChange={(e) => setPrptDivCd(e.target.value)}
              style={inputStyle}
            >
              {PROPERTY_TYPES.map((p) => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={labelStyle}>시·도</div>
            <select
              value={lctnSdnm}
              onChange={(e) => setLctnSdnm(e.target.value)}
              style={inputStyle}
            >
              {SIDO_LIST.map((s) => (
                <option key={s} value={s}>{s || '전체'}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={labelStyle}>시·군·구</div>
            <input
              type="text"
              value={lctnSggnm}
              onChange={(e) => setLctnSggnm(e.target.value)}
              placeholder="예) 송파구"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>물건명 키워드</div>
            <input
              type="text"
              value={onbidCltrNm}
              onChange={(e) => setOnbidCltrNm(e.target.value)}
              placeholder="예) 아파트, 대지"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>입찰기간 시작 (YYYYMMDD)</div>
            <input
              type="text"
              inputMode="numeric"
              value={bidPrdYmdStart}
              onChange={(e) => setBidPrdYmdStart(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              placeholder="20260508"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>입찰기간 종료 (YYYYMMDD)</div>
            <input
              type="text"
              inputMode="numeric"
              value={bidPrdYmdEnd}
              onChange={(e) => setBidPrdYmdEnd(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              placeholder="20260608"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>최저입찰가 (원, 최소)</div>
            <input
              type="text"
              inputMode="numeric"
              value={lowstBidPrcStart}
              onChange={(e) => setLowstBidPrcStart(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예) 100000000"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>최저입찰가 (원, 최대)</div>
            <input
              type="text"
              inputMode="numeric"
              value={lowstBidPrcEnd}
              onChange={(e) => setLowstBidPrcEnd(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예) 500000000"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              backgroundColor: '#5A4E7A',
              color: '#fff',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 4px 10px -6px rgba(90,78,122,0.6)',
            }}
          >
            {loading ? '검색 중…' : '🔍 검색하기'}
          </button>
        </div>
      </form>

      {/* 결과 헤더 */}
      {searched && !loading && (
        <div className="mb-3 flex items-end justify-between">
          <div style={{ fontSize: 13, color: '#666' }}>
            총 <strong style={{ color: '#1A3C6E' }}>{totalCount.toLocaleString()}</strong>건
            {totalCount > 0 && ` · ${pageNo} / ${totalPages} 페이지`}
          </div>
        </div>
      )}

      {/* 결과 목록 */}
      <div className="flex flex-col gap-3">
        {items.map((it, idx) => {
          const key = `${it.cltrMngNo || it.onbidCltrno || idx}-${it.pbctCdtnNo || idx}`;
          const region = [it.lctnSdnm, it.lctnSggnm, it.lctnEmdNm].filter(Boolean).join(' ');
          const usage = [it.cltrUsgMclsCtgrNm, it.cltrUsgSclsCtgrNm].filter(Boolean).join(' · ');
          const onbidUrl =
            it.onbidCltrno && it.onbidPbancNo
              ? `https://www.onbid.co.kr/op/cta/cltrdtl/collateralRealEstateDetail.do?cltrNo=${it.onbidCltrno}&plnmNo=${it.onbidPbancNo}`
              : 'https://www.onbid.co.kr/';
          return (
            <a
              key={key}
              href={onbidUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl p-4 transition-all hover:shadow-md active:scale-[0.99]"
              style={{
                backgroundColor: '#fff',
                border: '1px solid #E5DFD0',
                textDecoration: 'none',
                color: '#2C2C2A',
              }}
            >
              <div className="flex gap-3">
                {it.thnlImgUrlAdr ? (
                  <img
                    src={it.thnlImgUrlAdr}
                    alt=""
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 12,
                      objectFit: 'cover',
                      backgroundColor: '#F5F0E8',
                      flexShrink: 0,
                    }}
                    onError={(e) => { (e.currentTarget.style.display = 'none'); }}
                  />
                ) : (
                  <div
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 12,
                      backgroundColor: '#F5F0E8',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                    }}
                  >
                    🏠
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                    {it.prptDivNm && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#5A4E7A',
                          backgroundColor: '#EEE8F5',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {it.prptDivNm}
                      </span>
                    )}
                    {it.pbctStatNm && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: it.pbctStatNm === '입찰진행중' ? '#1A7A3C' : '#B85C2E',
                          backgroundColor: it.pbctStatNm === '입찰진행중' ? '#E5F4EA' : '#FBEEE5',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {it.pbctStatNm}
                      </span>
                    )}
                    {it.usbdNft !== undefined && Number(it.usbdNft) > 0 && (
                      <span style={{ fontSize: 10, color: '#888780' }}>
                        유찰 {String(it.usbdNft)}회
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#1A3C6E',
                      lineHeight: 1.35,
                      marginBottom: 4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {it.onbidCltrNm || '(물건명 없음)'}
                  </div>
                  {region && (
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                      📍 {region}
                    </div>
                  )}
                  {usage && (
                    <div style={{ fontSize: 11, color: '#888780', marginBottom: 6 }}>
                      {usage}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ fontSize: 12 }}>
                    <span>
                      <span style={{ color: '#888780' }}>최저입찰가</span>{' '}
                      <strong style={{ color: '#B85C2E' }}>
                        {formatPrice(it.lowstBidPrcIndctCont)}
                      </strong>
                    </span>
                    {it.apslEvlAmt !== undefined && (
                      <span>
                        <span style={{ color: '#888780' }}>감정가</span>{' '}
                        <span>{formatPrice(it.apslEvlAmt)}</span>
                      </span>
                    )}
                    {it.cltrBidEndDt && (
                      <span>
                        <span style={{ color: '#888780' }}>~</span>{' '}
                        <span>{formatBidDt(it.cltrBidEndDt)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          );
        })}

        {searched && !loading && items.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: '#F5F0E8', color: '#888780', fontSize: 14 }}
          >
            검색 결과가 없습니다. 조건을 조정해 다시 검색해 보세요.
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {searched && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => goPage(pageNo - 1)}
            disabled={pageNo <= 1 || loading}
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{
              border: '1px solid #d8d3c4',
              backgroundColor: '#fff',
              opacity: pageNo <= 1 || loading ? 0.4 : 1,
            }}
          >
            ← 이전
          </button>
          <div style={{ fontSize: 13, color: '#666' }}>
            {pageNo} / {totalPages}
          </div>
          <button
            type="button"
            onClick={() => goPage(pageNo + 1)}
            disabled={pageNo >= totalPages || loading}
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{
              border: '1px solid #d8d3c4',
              backgroundColor: '#fff',
              opacity: pageNo >= totalPages || loading ? 0.4 : 1,
            }}
          >
            다음 →
          </button>
        </div>
      )}

      {/* 출처·면책 */}
      <div
        className="mt-8 rounded-xl p-4"
        style={{
          backgroundColor: '#F5F0E8',
          border: '1px solid #E5DFD0',
          fontSize: 11,
          color: '#7A6F5A',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#5A4E7A' }}>
          출처: 한국자산관리공사 온비드 (공공데이터포털 OpenAPI)
        </div>
        본 정보는 공공데이터를 활용한 참고용이며, 실제 입찰·낙찰 등은
        <a
          href="https://www.onbid.co.kr/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1A3C6E', textDecoration: 'underline', margin: '0 4px' }}
        >
          온비드 공식사이트(onbid.co.kr)
        </a>
        에서 직접 확인하시기 바랍니다. HARU2026은 공공데이터 가공 결과의 정확성을 보증하지 않습니다.
        <span style={{ display: 'block', marginTop: 6, color: '#888780' }}>
          기준일자: {formatYmd(todayYmd())}
        </span>
      </div>
    </div>
  );
}

export default OnbidRealEstatePage;
