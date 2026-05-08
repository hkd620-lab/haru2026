import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { compressImage } from '../services/imageService';
import GrapeLoadingMini from '../components/GrapeLoadingMini';

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

type AnalyzeResponse = {
  success: boolean;
  extractedName: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  aiNote: string;
  items: DrugItem[];
  totalCount: number;
  searchUsedName?: string;
  fallbackUsed?: boolean;
  disclaimer: string;
};

type PhotoSlot = {
  id: string;
  previewUrl: string;
  base64: string;
};

const MAX_PHOTOS = 3;

function stripDocTags(raw?: string) {
  if (!raw) return '';
  let s = String(raw);
  s = s.replace(/<\s*\/?\s*(ARTICLE|PARAGRAPH|CN|TITLE)[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(new Error('FILE_READER_ERROR'));
    reader.readAsDataURL(blob);
  });
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

  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AnalyzeResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setAiResult(null);
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

  const onPhotoPick = () => {
    if (photos.length >= MAX_PHOTOS) {
      toast.info(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);

    setPhotoProcessing(true);
    try {
      const newSlots: PhotoSlot[] = [];
      for (const file of toProcess) {
        if (file.size > 20 * 1024 * 1024) {
          toast.warning(`${file.name}은 20MB를 초과하여 건너뜁니다.`);
          continue;
        }
        if (!file.type.startsWith('image/')) {
          toast.warning(`${file.name}은 이미지 파일이 아닙니다.`);
          continue;
        }
        try {
          const compressed = await compressImage(file, 1024, 0.82);
          const base64 = await blobToBase64(compressed);
          const previewUrl = URL.createObjectURL(compressed);
          newSlots.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            previewUrl,
            base64,
          });
        } catch (err) {
          console.error('[Drug] photo compress failed', err);
          toast.error(`${file.name} 처리 실패`);
        }
      }
      if (newSlots.length > 0) {
        setPhotos((prev) => [...prev, ...newSlots]);
        setAiResult(null);
      }
    } finally {
      setPhotoProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
    setAiResult(null);
  };

  const runAiAnalysis = async () => {
    if (photos.length === 0) {
      toast.info('약봉지 사진을 먼저 첨부해 주세요.');
      return;
    }
    setAnalyzing(true);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable<any, AnalyzeResponse>(functions, 'analyzeDrugPhoto');
      const res = await fn({ images: photos.map((p) => p.base64) });
      const data = res.data;
      setAiResult(data);
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      setTotalCount(data?.totalCount || list.length);
      setSearched(true);
      setOpenIdx(list.length > 0 ? 0 : null);

      if (data?.extractedName) {
        setItemName(data.extractedName);
        if (list.length === 0) {
          toast.info(`"${data.extractedName}" 약은 식약처 DB에서 찾지 못했습니다.`);
        } else if (data.fallbackUsed && data.searchUsedName) {
          toast.success(`"${data.extractedName}" 인식 → "${data.searchUsedName}" 시리즈로 검색됨`);
        } else {
          toast.success(`"${data.extractedName}" 인식됨`);
        }
      } else {
        toast.warning(data?.aiNote || '약 이름을 인식하지 못했습니다.');
      }
    } catch (e: any) {
      console.error('[Drug] AI analysis failed', e);
      const msg = e?.message || 'AI 분석 중 오류가 발생했습니다';
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 16,
    border: '1px solid #d8d3c4',
    borderRadius: 10,
    backgroundColor: '#fff',
    color: '#2C2C2A',
  };

  const confidenceLabel: Record<string, string> = {
    high: '높음',
    medium: '보통',
    low: '낮음',
    none: '없음',
  };
  const confidenceColor: Record<string, string> = {
    high: '#1A7A3C',
    medium: '#4A5A2C',
    low: '#B85C2E',
    none: '#888780',
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
          💊 약봉지 보고 약정보 얻기
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          약 이름을 직접 입력하거나, 약봉지 사진을 찍으면 AI가 약 이름을 인식해 식약처 자료를 보여드립니다.
        </p>
      </div>

      {/* === 1. 텍스트 입력 검색 === */}
      <form
        onSubmit={onSubmit}
        className="rounded-2xl p-4 md:p-5 mb-4"
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
          약 이름으로 직접 검색
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
            disabled={loading || analyzing}
            className="rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              backgroundColor: '#4A5A2C',
              color: '#fff',
              opacity: loading || analyzing ? 0.6 : 1,
              cursor: loading || analyzing ? 'wait' : 'pointer',
              boxShadow: '0 4px 10px -6px rgba(74,90,44,0.6)',
            }}
          >
            {loading ? '검색 중…' : '🔍 약정보 검색'}
          </button>
        </div>
      </form>

      {/* === 2. 약봉지 사진 AI 분석 === */}
      <div
        className="rounded-2xl p-4 md:p-5 mb-5"
        style={{
          background: 'linear-gradient(135deg, #F1F5DC 0%, #ffffff 70%)',
          border: '1px solid #D4DEA0',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#4A5A2C' }}>
            📷 약봉지 사진으로 AI 분석 ({photos.length}/{MAX_PHOTOS})
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: '#B85C2E',
            background: '#FBEEE5',
            border: '1px solid #E8B894',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 10,
            lineHeight: 1.55,
          }}
        >
          🔒 <b>촬영 시 환자 이름·생년월일은 가려 주세요.</b> AI는 약 이름만 추출하며,
          환자·의사 등 개인정보는 저장·전송하지 않습니다.
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          {photos.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'relative',
                width: 96,
                height: 96,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #D4DEA0',
                background: '#fff',
              }}
            >
              <img
                src={p.previewUrl}
                alt="약봉지"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                aria-label="사진 삭제"
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: 'none',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={onPhotoPick}
              disabled={photoProcessing}
              style={{
                width: 96,
                height: 96,
                borderRadius: 12,
                border: '1.5px dashed #B7C97A',
                background: '#fff',
                color: '#4A5A2C',
                cursor: photoProcessing ? 'wait' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {photoProcessing ? (
                <GrapeLoadingMini size={20} color="#4A5A2C" />
              ) : (
                <>
                  <span style={{ fontSize: 22 }}>＋</span>
                  <span>사진 추가</span>
                </>
              )}
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={onPhotoChange}
          style={{ display: 'none' }}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={runAiAnalysis}
            disabled={analyzing || loading || photos.length === 0}
            className="rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              backgroundColor: photos.length === 0 ? '#B7C97A' : '#4A5A2C',
              color: '#fff',
              opacity: analyzing || loading ? 0.6 : 1,
              cursor: analyzing || loading || photos.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 10px -6px rgba(74,90,44,0.6)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {analyzing ? (
              <>
                <GrapeLoadingMini size={18} color="#fff" />
                AI 분석 중…
              </>
            ) : (
              <>🔬 AI 약봉지 분석</>
            )}
          </button>
        </div>

        {aiResult && !analyzing && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#FAF9F0',
              border: '1px solid #D4DEA0',
              fontSize: 12,
              lineHeight: 1.6,
              color: '#2C2C2A',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  background: confidenceColor[aiResult.confidence],
                  padding: '2px 7px',
                  borderRadius: 999,
                }}
              >
                AI 신뢰도 {confidenceLabel[aiResult.confidence]}
              </span>
              {aiResult.extractedName && (
                <span style={{ fontWeight: 700, color: '#1A3C6E' }}>
                  인식: {aiResult.extractedName}
                </span>
              )}
            </div>
            {aiResult.aiNote && (
              <div style={{ color: '#7A6F5A', fontSize: 11 }}>{aiResult.aiNote}</div>
            )}
          </div>
        )}
      </div>

      {searched && !loading && !analyzing && (
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

        {searched && !loading && !analyzing && items.length === 0 && (
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
        AI 분석은 참고용이며, 정확한 정보는 식약처 자료를 우선합니다.
        약 이름만 추출하며, 환자·의사 등 개인정보는 저장·전송하지 않습니다.
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
