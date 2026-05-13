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

type RecognizedDrug = {
  extractedName: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  items: DrugItem[];
  totalCount: number;
  searchUsedName?: string;
  fallbackUsed?: boolean;
};

type AnalyzeResponse = {
  success: boolean;
  recognized?: RecognizedDrug[];
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

  // 1) CDATA 마커 제거
  s = s.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');

  // 2) 표 구조 변환: TD 사이 " · ", TR 끝 \n, TBL 끝 \n\n
  s = s.replace(/<\s*\/\s*td\s*>/gi, ' · ');
  s = s.replace(/<\s*td[^>]*>/gi, '');
  s = s.replace(/<\s*\/\s*tr\s*>/gi, '\n');
  s = s.replace(/<\s*tr[^>]*>/gi, '');
  s = s.replace(/<\s*\/\s*(table|tbl|tbody|thead)\s*>/gi, '\n\n');
  s = s.replace(/<\s*(table|tbl|tbody|thead)[^>]*>/gi, '');

  // 3) 기존 문단 태그 → 줄바꿈
  s = s.replace(/<\s*\/?\s*(ARTICLE|PARAGRAPH|CN|TITLE|BR)[^>]*>/gi, '\n');

  // 4) 남은 태그 제거
  s = s.replace(/<[^>]+>/g, '');

  // 5) 엔티티 해제
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  // 6) " · " 가 줄 끝/시작에 위치하면 정리
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\s*·\s*\n/g, '\n');
  s = s.replace(/\n\s*·\s*/g, '\n');
  s = s.replace(/(\s*·\s*){2,}/g, ' · ');

  // 7) 짧은 단독 줄(3자 이하)은 다음 줄과 합치기
  const lines = s.split('\n');
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i].trim();
    if (!cur) {
      merged.push('');
      continue;
    }
    if (cur.length <= 3 && i + 1 < lines.length && lines[i + 1].trim()) {
      merged.push(`${cur} ${lines[i + 1].trim()}`);
      i++;
    } else {
      merged.push(cur);
    }
  }
  s = merged.join('\n');

  // 8) 연속 빈 줄 압축
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

// "텔미누보정40/2.5밀리그램(...)" → "40/2.5밀리그램", sortKey=40
function extractDosage(name?: string): { dosage: string | null; sortKey: number } {
  if (!name) return { dosage: null, sortKey: Number.POSITIVE_INFINITY };
  const m = name.match(/(\d+(?:[./]\d+)*\s*(?:밀리그램|밀리리터|마이크로그램|단위|mg|ml|g|IU|µg|㎍))/i);
  if (!m) return { dosage: null, sortKey: Number.POSITIVE_INFINITY };
  const dosage = m[1].replace(/\s+/g, '');
  const numMatch = dosage.match(/\d+(?:\.\d+)?/);
  const sortKey = numMatch ? parseFloat(numMatch[0]) : Number.POSITIVE_INFINITY;
  return { dosage, sortKey };
}

// ITEM_SEQ 기준 중복 제거 + 함량 오름차순 정렬
function dedupAndSort(items: DrugItem[]): { item: DrugItem; dosage: string | null }[] {
  const seen = new Set<string>();
  const unique: DrugItem[] = [];
  for (const it of items) {
    const key = it.ITEM_SEQ || `${it.ITEM_NAME || ''}__${it.ENTP_NAME || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(it);
  }
  const withDosage = unique.map((it) => ({ it, ...extractDosage(it.ITEM_NAME) }));
  withDosage.sort((a, b) => a.sortKey - b.sortKey);
  return withDosage.map(({ it, dosage }) => ({ item: it, dosage }));
}

// "텔미누보정40/2.5mg" → "40/2.5" — 단위 무관한 숫자 키만 추출
function extractDosageNumbers(name?: string): string | null {
  if (!name) return null;
  const m = name.match(/(\d+(?:[./]\d+)*)\s*(?:밀리그램|밀리리터|마이크로그램|단위|mg|ml|g|IU|µg|㎍)/i);
  return m ? m[1].replace(/\s+/g, '') : null;
}

// AI 인식 함량과 일치하는 카드만 matched, 나머지는 others
function filterByDosage(
  items: DrugItem[],
  aiName?: string,
): {
  matched: { item: DrugItem; dosage: string | null }[];
  others: { item: DrugItem; dosage: string | null }[];
  aiDose: string | null;
} {
  const sorted = dedupAndSort(items);
  const aiDose = extractDosageNumbers(aiName);
  if (!aiDose) return { matched: sorted, others: [], aiDose: null };

  const matched: typeof sorted = [];
  const others: typeof sorted = [];
  for (const entry of sorted) {
    const itemDose = extractDosageNumbers(entry.item.ITEM_NAME);
    if (itemDose === aiDose) matched.push(entry);
    else others.push(entry);
  }
  // 매칭 0건이면 안전 fallback: 전체 표시
  if (matched.length === 0) return { matched: sorted, others: [], aiDose };
  return { matched, others, aiDose };
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
  const [recognizedList, setRecognizedList] = useState<RecognizedDrug[]>([]);
  const [searched, setSearched] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showOthersGroups, setShowOthersGroups] = useState<Set<number>>(new Set());

  const toggleOthers = (gIdx: number) => {
    setShowOthersGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gIdx)) next.delete(gIdx);
      else next.add(gIdx);
      return next;
    });
  };

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
      setRecognizedList([
        {
          extractedName: q,
          confidence: 'high',
          items: list,
          totalCount: data?.totalCount || list.length,
        },
      ]);
      setSearched(true);
      setOpenKey(list.length > 0 ? '0-0' : null);
      if (list.length === 0) {
        toast.info('검색 결과가 없습니다. 약 이름을 다시 확인해 주세요.');
      }
    } catch (e: any) {
      console.error('[Drug] search failed', e);
      const msg = e?.message || '검색 중 오류가 발생했습니다';
      toast.error(msg);
      setRecognizedList([]);
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

      // 신 응답(recognized 배열) 우선, 구 응답 폴백
      const recognized: RecognizedDrug[] = Array.isArray(data?.recognized) && data.recognized.length > 0
        ? data.recognized
        : data?.extractedName
          ? [{
              extractedName: data.extractedName,
              confidence: data.confidence,
              items: Array.isArray(data?.items) ? data.items : [],
              totalCount: data?.totalCount || 0,
              searchUsedName: data.searchUsedName,
              fallbackUsed: data.fallbackUsed,
            }]
          : [];

      setRecognizedList(recognized);
      setSearched(true);

      // 첫 번째 약의 첫 번째 결과를 자동으로 펼침
      const firstWithItems = recognized.findIndex((r) => r.items.length > 0);
      setOpenKey(firstWithItems >= 0 ? `${firstWithItems}-0` : null);

      if (recognized.length > 0) {
        // 첫 약 이름은 텍스트 입력란에도 채움 (편의)
        setItemName(recognized[0].extractedName);
        const total = recognized.length;
        const foundCount = recognized.filter((r) => r.items.length > 0).length;
        if (total === 1) {
          const r = recognized[0];
          if (r.items.length === 0) {
            toast.info(`"${r.extractedName}" 약은 식약처 DB에서 찾지 못했습니다.`);
          } else if (r.fallbackUsed && r.searchUsedName) {
            toast.success(`"${r.extractedName}" 인식 → "${r.searchUsedName}" 시리즈로 검색됨`);
          } else {
            toast.success(`"${r.extractedName}" 인식됨`);
          }
        } else {
          toast.success(`약 ${total}개 인식됨${foundCount < total ? ` (식약처 검색 ${foundCount}/${total})` : ''}`);
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

        {aiResult && !analyzing && recognizedList.length > 0 && (
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
            <div style={{ fontWeight: 700, color: '#1A3C6E', marginBottom: 6 }}>
              AI 인식 결과: {recognizedList.length}개 약
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recognizedList.map((r, i) => (
                <span
                  key={`pill-${i}`}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#2C2C2A',
                    background: '#fff',
                    border: `1px solid ${confidenceColor[r.confidence]}`,
                    borderLeft: `4px solid ${confidenceColor[r.confidence]}`,
                    padding: '3px 8px',
                    borderRadius: 6,
                  }}
                >
                  {r.extractedName}
                  <span style={{ color: confidenceColor[r.confidence], marginLeft: 4, fontSize: 10 }}>
                    · {confidenceLabel[r.confidence]}
                  </span>
                </span>
              ))}
            </div>
            {aiResult.aiNote && (
              <div style={{ color: '#7A6F5A', fontSize: 11, marginTop: 6 }}>{aiResult.aiNote}</div>
            )}
          </div>
        )}
      </div>

      {searched && !loading && !analyzing && recognizedList.length > 0 && (
        <div className="mb-3" style={{ fontSize: 13, color: '#666' }}>
          {recognizedList.length === 1 ? (
            <>총 <strong style={{ color: '#1A3C6E' }}>{recognizedList[0].totalCount.toLocaleString()}</strong>건</>
          ) : (
            <>약 <strong style={{ color: '#1A3C6E' }}>{recognizedList.length}</strong>개 / 식약처 총 <strong style={{ color: '#1A3C6E' }}>{recognizedList.reduce((s, r) => s + r.totalCount, 0).toLocaleString()}</strong>건</>
          )}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {recognizedList.map((group, gIdx) => {
          const { matched, others, aiDose } = filterByDosage(group.items, group.extractedName);
          const showOthers = showOthersGroups.has(gIdx);
          const visibleItems = showOthers ? [...matched, ...others] : matched;
          const totalShown = matched.length + others.length;
          const hasOthers = aiDose !== null && others.length > 0;
          return (
          <div key={`grp-${gIdx}-${group.extractedName}`}>
            {recognizedList.length > 1 && (
              <div
                className="rounded-xl px-3 py-2 mb-2"
                style={{
                  background: '#F1F5DC',
                  border: '1px solid #D4DEA0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                    background: '#4A5A2C',
                    padding: '2px 7px',
                    borderRadius: 999,
                  }}
                >
                  약 {gIdx + 1}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1A3C6E' }}>
                  {group.extractedName}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                    background: confidenceColor[group.confidence],
                    padding: '2px 7px',
                    borderRadius: 999,
                  }}
                >
                  AI {confidenceLabel[group.confidence]}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#7A6F5A' }}>
                  {hasOthers
                    ? `함량 ${aiDose} 일치 ${matched.length}건 / 전체 ${totalShown}건`
                    : `식약처 ${totalShown || group.totalCount}건`}
                  {group.fallbackUsed && group.searchUsedName && (
                    <> · "{group.searchUsedName}" 검색</>
                  )}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {visibleItems.map(({ item: it, dosage }, idx) => {
                const key = `${gIdx}-${idx}`;
                const opened = openKey === key;
                return (
                  <div
                    key={`${it.ITEM_SEQ || key}`}
                    className="rounded-2xl p-4"
                    style={{
                      backgroundColor: '#fff',
                      border: '1px solid #E5DFD0',
                      color: '#2C2C2A',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenKey(opened ? null : key)}
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
                      {dosage && (
                        <div style={{ marginBottom: 6 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: 14,
                              fontWeight: 800,
                              color: '#fff',
                              background: '#4A5A2C',
                              padding: '4px 12px',
                              borderRadius: 999,
                              letterSpacing: '0.02em',
                              boxShadow: '0 2px 4px -2px rgba(74,90,44,0.4)',
                            }}
                          >
                            💊 {dosage}
                          </span>
                        </div>
                      )}
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
                        <DocBlock title="효능·효과" body={stripDocTags(it.EE_DOC_DATA)} previewMode="firstSentence" />
                        <DocBlock title="용법·용량" body={stripDocTags(it.UD_DOC_DATA)} previewMode="firstSentence" />
                        <DocBlock title="주의사항·부작용" body={stripDocTags(it.NB_DOC_DATA)} previewMode="lines" />
                        {it.STORAGE_METHOD && (
                          <DocBlock title="저장방법" body={it.STORAGE_METHOD} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {hasOthers && (
                <button
                  type="button"
                  onClick={() => toggleOthers(gIdx)}
                  style={{
                    marginTop: 4,
                    padding: '10px 14px',
                    backgroundColor: '#fff',
                    border: '1px dashed #B7C97A',
                    borderRadius: 12,
                    color: '#4A5A2C',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {showOthers
                    ? `함량 ${aiDose} 일치만 보기 ▲`
                    : `다른 함량도 보기 (${others.length}건) ▼`}
                </button>
              )}

              {group.items.length === 0 && (
                <div
                  className="rounded-2xl p-5 text-center"
                  style={{ backgroundColor: '#F5F0E8', color: '#888780', fontSize: 13 }}
                >
                  "{group.extractedName}" 약은 식약처 DB에서 찾지 못했습니다. 약 이름을 직접 입력해 다시 검색해 보세요.
                </div>
              )}
            </div>
          </div>
          );
        })}

        {searched && !loading && !analyzing && recognizedList.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: '#F5F0E8', color: '#888780', fontSize: 14 }}
          >
            검색 결과가 없습니다. 약 이름을 다시 확인하거나 사진을 더 또렷이 찍어 주세요.
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

// 본문에서 미리보기 텍스트 추출
function getPreview(body: string, mode: 'firstSentence' | 'lines'): string {
  const trimmed = body.trim();
  if (!trimmed) return '';

  if (mode === 'firstSentence') {
    // 한국어 종결("다.", "니다.", "요.") 또는 영어 마침표 기준
    const m = trimmed.match(/^[\s\S]*?(?:니다\.|습니다\.|다\.|요\.|\.\s|\.$)/);
    if (m && m[0].trim().length >= 4) return m[0].trim();
    const firstLine = trimmed.split('\n').find((l) => l.trim().length > 0) || '';
    return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
  }

  // 'lines' — 의미 있는 처음 3줄
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, 3).join('\n');
}

function DocBlock({
  title,
  body,
  previewMode,
}: {
  title: string;
  body: string;
  previewMode?: 'firstSentence' | 'lines';
}) {
  const [expanded, setExpanded] = useState(false);
  if (!body) return null;

  const preview = previewMode ? getPreview(body, previewMode) : body;
  const hasMore = preview.length > 0 && preview !== body.trim();
  const showSafetyNotice = previewMode === 'lines' && hasMore && !expanded;
  const display = expanded || !hasMore ? body : preview;

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

      {showSafetyNotice && (
        <div
          style={{
            fontSize: 11,
            color: '#B85C2E',
            background: '#FBEEE5',
            border: '1px solid #E8B894',
            borderRadius: 6,
            padding: '6px 8px',
            marginBottom: 8,
            lineHeight: 1.55,
          }}
        >
          ⚠️ 일부 미리보기입니다. 복용 전 [전체 보기]에서 모든 주의사항을 반드시 확인하세요.
        </div>
      )}

      <div
        style={{
          fontSize: 13,
          color: '#2C2C2A',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'keep-all',
          textAlign: 'left',
        }}
      >
        {display}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 8,
            background: 'none',
            border: 'none',
            color: '#4A5A2C',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {expanded ? '간단히 보기 ▲' : '전체 보기 ▼'}
        </button>
      )}
    </div>
  );
}

export default SayuHealthDrugPage;
