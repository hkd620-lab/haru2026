import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

type HospitalItem = {
  yadmNm?: string;       // 요양기관명
  clCdNm?: string;       // 종별 (의원/병원/종합병원)
  addr?: string;         // 주소
  telno?: string;        // 전화번호
  sidoCdNm?: string;     // 시도명
  sgguCdNm?: string;     // 시군구명
  emdongNm?: string;     // 읍면동
  postNo?: string;
  XPos?: string;
  YPos?: string;
  estbDd?: string;       // 개설일
  drTotCnt?: string;     // 의사 총수
};

type HospitalResponse = {
  success: boolean;
  items: HospitalItem[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
  resultCode?: string;
  resultMsg?: string;
  disclaimer?: string;
};

// 심평원 진료과 코드 (자주 쓰는 것 위주, 빈 값 = 전체)
const DGSBJT_LIST = [
  { code: '', label: '전체 진료과' },
  { code: '01', label: '내과' },
  { code: '02', label: '신경과' },
  { code: '03', label: '정신건강의학과' },
  { code: '04', label: '외과' },
  { code: '05', label: '정형외과' },
  { code: '06', label: '신경외과' },
  { code: '07', label: '흉부외과' },
  { code: '08', label: '성형외과' },
  { code: '09', label: '마취통증의학과' },
  { code: '10', label: '산부인과' },
  { code: '11', label: '소아청소년과' },
  { code: '12', label: '안과' },
  { code: '13', label: '이비인후과' },
  { code: '14', label: '피부과' },
  { code: '15', label: '비뇨의학과' },
  { code: '20', label: '재활의학과' },
  { code: '23', label: '가정의학과' },
  { code: '49', label: '치과' },
  { code: '50', label: '한의과' },
];

const SIDO_LIST = [
  '', '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도',
  '경상남도', '제주특별자치도',
];

function formatTel(t?: string) {
  if (!t) return '';
  return String(t).trim();
}

export function SayuHealthHospitalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [dgsbjtCd, setDgsbjtCd] = useState('');
  const [sidoCdNm, setSidoCdNm] = useState('');
  const [sgguCdNm, setSgguCdNm] = useState('');
  const [yadmNm, setYadmNm] = useState('');

  const [pageNo, setPageNo] = useState(1);
  const [numOfRows] = useState(10);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HospitalItem[]>([]);
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
    if (!sidoCdNm && !sgguCdNm.trim() && !yadmNm.trim()) {
      toast.info('시·도 또는 시·군·구, 또는 병원명 중 하나는 입력하세요.');
      return;
    }
    setLoading(true);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable<any, HospitalResponse>(functions, 'getHospitalList');
      const payload: Record<string, string | number> = {
        pageNo: targetPage,
        numOfRows,
      };
      if (dgsbjtCd) payload.dgsbjtCd = dgsbjtCd;
      if (sidoCdNm) payload.sidoCdNm = sidoCdNm;
      if (sgguCdNm.trim()) payload.sgguCdNm = sgguCdNm.trim();
      if (yadmNm.trim()) payload.yadmNm = yadmNm.trim();

      const res = await fn(payload);
      const data = res.data;
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      setTotalCount(data?.totalCount || 0);
      setPageNo(data?.pageNo || targetPage);
      setSearched(true);
      if ((data?.totalCount || 0) === 0) {
        toast.info('검색 결과가 없습니다. 조건을 조정해 보세요.');
      }
    } catch (e: any) {
      console.error('[Hospital] search failed', e);
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
    padding: '12px 14px',
    fontSize: 16, // 모바일 줌 방지
    border: '1px solid #d8d3c4',
    borderRadius: 10,
    backgroundColor: '#fff',
    color: '#2C2C2A',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#4A5A2C',
    marginBottom: 6,
  };

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-2 flex items-center gap-2">
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: '#1A3C6E',
            color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
          }}
        >
          BETA
        </span>
        <span style={{ fontSize: 11, color: '#888780', letterSpacing: '0.04em' }}>
          SAYU · CARE
        </span>
      </div>

      <div className="mb-5">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#1A3C6E' }}
        >
          🏥 심평원 동네병원정보
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          진료과·지역으로 동네 병원을 찾아보세요. 건강보험심사평가원 자료 기반.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl p-4 md:p-5 mb-5"
        style={{
          background: 'linear-gradient(135deg, #E0E8B8 0%, #ffffff 70%)',
          border: '1px solid #D4DEA0',
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div style={labelStyle}>진료과</div>
            <select
              value={dgsbjtCd}
              onChange={(e) => setDgsbjtCd(e.target.value)}
              style={inputStyle}
            >
              {DGSBJT_LIST.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={labelStyle}>시·도</div>
            <select
              value={sidoCdNm}
              onChange={(e) => setSidoCdNm(e.target.value)}
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
              value={sgguCdNm}
              onChange={(e) => setSgguCdNm(e.target.value)}
              placeholder="예) 송파구"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>병원명 (선택)</div>
            <input
              type="text"
              value={yadmNm}
              onChange={(e) => setYadmNm(e.target.value)}
              placeholder="예) 하나, 서울"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              backgroundColor: '#4A5A2C',
              color: '#fff',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 4px 10px -6px rgba(74,90,44,0.6)',
            }}
          >
            {loading ? '검색 중…' : '🔍 병원 찾기'}
          </button>
        </div>
      </form>

      {searched && !loading && (
        <div className="mb-3 flex items-end justify-between">
          <div style={{ fontSize: 13, color: '#666' }}>
            총 <strong style={{ color: '#1A3C6E' }}>{totalCount.toLocaleString()}</strong>건
            {totalCount > 0 && ` · ${pageNo} / ${totalPages} 페이지`}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((it, idx) => {
          const region = [it.sidoCdNm, it.sgguCdNm, it.emdongNm].filter(Boolean).join(' ');
          const tel = formatTel(it.telno);
          return (
            <div
              key={`${it.yadmNm || ''}-${idx}`}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: '#fff',
                border: '1px solid #E5DFD0',
                color: '#2C2C2A',
              }}
            >
              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                {it.clCdNm && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#4A5A2C',
                      backgroundColor: '#F1F5DC',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {it.clCdNm}
                  </span>
                )}
                {region && (
                  <span style={{ fontSize: 11, color: '#888780' }}>
                    {region}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#1A3C6E',
                  lineHeight: 1.35,
                  marginBottom: 6,
                }}
              >
                {it.yadmNm || '(병원명 없음)'}
              </div>
              {it.addr && (
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  📍 {it.addr}
                </div>
              )}
              {tel && (
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <a
                    href={`tel:${tel.replace(/[^0-9]/g, '')}`}
                    style={{
                      color: '#4A5A2C',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    📞 {tel}
                  </a>
                </div>
              )}
              {it.drTotCnt && (
                <div style={{ fontSize: 11, color: '#888780' }}>
                  의사 {it.drTotCnt}명
                </div>
              )}
            </div>
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

      <div
        className="mt-8 rounded-xl p-4"
        style={{
          backgroundColor: '#F5F0E8',
          border: '1px solid #E5DFD0',
          fontSize: 11,
          color: '#7A6F5A',
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#4A5A2C' }}>
          출처: 건강보험심사평가원 의료기관별 정보 (공공데이터포털)
        </div>
        본 정보는 공공데이터를 활용한 참고용이며,
        특정 기관·의사의 평가나 추천이 아닙니다.
        실제 진료 정보는 해당 의료기관에 직접 확인하시기 바랍니다.
        HARU2026은 공공데이터 가공 결과의 정확성을 보증하지 않습니다.
      </div>
    </div>
  );
}

export default SayuHealthHospitalPage;
