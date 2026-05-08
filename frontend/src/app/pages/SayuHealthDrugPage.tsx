import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

type DrugItem = {
  ITEM_NAME?: string;
  ITEM_SEQ?: string;
  ENTP_NAME?: string;
  ETC_OTC_CODE?: string;
  CHART?: string;
  STORAGE_METHOD?: string;
  VALID_TERM?: string;
  EE_DOC_DATA?: string;
  UD_DOC_DATA?: string;
  NB_DOC_DATA?: string;
  MAIN_INGR?: string;
};

type DrugResponse = {
  success: boolean;
  items: DrugItem[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
  resultCode?: string;
  resultMsg?: string;
  disclaimer?: string;
};

// 식약처 응답의 doc 필드는 XML/HTML 태그가 섞여 있어 사람이 읽을 수 있게 정리
function stripDocTags(raw?: string) {
  if (!raw) return '';
  let s = String(raw);
  // <ARTICLE>, <PARAGRAPH> 등을 줄바꿈으로 치환
  s = s.replace(/<\s*\/?\s*(ARTICLE|PARAGRAPH|CN|TITLE)[^>]*>/gi, '\n');
  // 나머지 태그 제거
  s = s.replace(/<[^>]+>/g, '');
  // HTML 엔티티
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  // 연속 공백·줄바꿈 정리
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

export function SayuHealthDrugPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [itemName, setItemName] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DrugItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searched, setSearched] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const runSearch = async () => {
    const q = itemName.trim();
    if (!q) {
      toast.info('약 이름을 입력하세요.');
      return;
    }
    setLoading(true);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable<any, DrugResponse>(functions, 'getDrugInfo');
      const res = await fn({ itemName: q, pageNo: 1, numOfRows: 10 });
      const data = res.data;
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      setTotalCount(data?.totalCount || list.length);
      setSearched(true);
      setOpenIdx(list.length > 0 ? 0 : null);
      if (list.length === 0) {
        toast.info('검색 결과가 없습니다. 약 이름을 다시 확인해 주세요.');
      }
    } catch (e: any) {
      console.error('[Drug] search failed', e);
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
    runSearch();
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
          💊 약봉지 보고 약정 얻기
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          약 이름을 입력하면 효능·효과, 용법·용량, 주의사항을 식약처 자료로 보여드립니다.
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
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#4A5A2C',
            marginBottom: 6,
          }}
        >
          약 이름
        </div>
        <input
          type="text"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="예) 타이레놀, 게보린, 베아제"
          style={inputStyle}
        />

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
            {loading ? '검색 중…' : '🔍 약정보 검색'}
          </button>
        </div>
      </form>

      {searched && !loading && (
        <div className="mb-3" style={{ fontSize: 13, color: '#666' }}>
          총 <strong style={{ color: '#1A3C6E' }}>{totalCount.toLocaleString()}</strong>건
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((it, idx) => {
          const opened = openIdx === idx;
          return (
            <div
              key={`${it.ITEM_SEQ || idx}`}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: '#fff',
                border: '1px solid #E5DFD0',
                color: '#2C2C2A',
              }}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(opened ? null : idx)}
                className="w-full text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                  {it.ETC_OTC_CODE && (
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
                      {it.ETC_OTC_CODE}
                    </span>
                  )}
                  {it.ENTP_NAME && (
                    <span style={{ fontSize: 11, color: '#888780' }}>
                      {it.ENTP_NAME}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#1A3C6E',
                    lineHeight: 1.35,
                  }}
                >
                  {it.ITEM_NAME || '(제품명 없음)'}
                </div>
                {it.MAIN_INGR && (
                  <div style={{ fontSize: 11, color: '#7A6F5A', marginTop: 4 }}>
                    주성분: {it.MAIN_INGR}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: '#4A5A2C',
                    fontWeight: 600,
                  }}
                >
                  {opened ? '상세 닫기 ▲' : '효능·용법·주의사항 보기 ▼'}
                </div>
              </button>

              {opened && (
                <div className="mt-3 flex flex-col gap-3">
                  <DocBlock title="효능·효과" body={stripDocTags(it.EE_DOC_DATA)} />
                  <DocBlock title="용법·용량" body={stripDocTags(it.UD_DOC_DATA)} />
                  <DocBlock title="주의사항·부작용" body={stripDocTags(it.NB_DOC_DATA)} />
                  {it.STORAGE_METHOD && (
                    <DocBlock title="저장방법" body={it.STORAGE_METHOD} />
                  )}
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
            검색 결과가 없습니다. 약 이름을 다시 확인해 주세요.
          </div>
        )}
      </div>

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
          출처: 식품의약품안전처 의약품 제품 허가정보 (공공데이터포털)
        </div>
        본 정보는 의료 행위·처방을 대체하지 않습니다.
        실제 복용은 의사·약사의 지시를 따르시고,
        부작용이 의심되면 즉시 의료진과 상담하시기 바랍니다.
        HARU2026은 공공데이터 가공 결과의 정확성을 보증하지 않습니다.
      </div>
    </div>
  );
}

function DocBlock({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div
      style={{
        background: '#FAF9F0',
        border: '1px solid #E5DFD0',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#4A5A2C',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#2C2C2A',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'keep-all',
        }}
      >
        {body}
      </div>
    </div>
  );
}

export default SayuHealthDrugPage;
