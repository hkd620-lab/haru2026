import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowLeft, Camera, Leaf, Loader2, Search, X, Save, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';
import { db, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../services/imageService';

// ===========================================
// 응답 타입 — functions/src/index.ts detectPlantAdvanced 와 동기
// ===========================================
type PlantIdSection = {
  name: string;
  latinName: string;
  confidence: number;          // 0~1
  isPlantProbability: number | null;
  family?: string;
  genus?: string;
  alternatives: { name: string; latinName: string; probability: number }[];
  url: string | null;
};

type PlantNetSection = {
  name: string;
  scientificName: string;
  confidence: number;          // 0~1
  family?: string;
  genus?: string;
  alternatives: { name: string; scientificName: string; score: number }[];
};

type GeminiSection = {
  finalGuess: string;
  finalLatinName: string;
  analysis: string;
  warning: string;
  edible: 'unknown' | 'yes' | 'no';
  poisonousRisk: boolean;
  similarSpecies: string[];
  needMorePhotos: string[];
  confidence: 'high' | 'medium' | 'low';
};

type AdvancedResult = {
  plantId: PlantIdSection | null;
  plantNet: PlantNetSection | null;
  gemini: GeminiSection | null;
  meta: { imageCount: number; plantNetAvailable: boolean; geminiError: string | null };
};

type PhotoItem = {
  id: string;
  previewUrl: string;
  base64: string;
  mimeType: string;
};

const MAX_PHOTOS = 5;

const PHOTO_GUIDE_ITEMS = [
  { icon: '🌿', label: '잎 앞면', hint: '광택·잎맥 확인용' },
  { icon: '🍃', label: '잎 뒷면', hint: '잎털·색감 확인용' },
  { icon: '🪴', label: '줄기', hint: '굵기·가시·털 확인용' },
  { icon: '🌸', label: '꽃', hint: '핀 상태가 있다면 필수' },
  { icon: '🌳', label: '전체 모습', hint: '키·형태 확인용' },
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = typeof reader.result === 'string' ? reader.result : '';
      resolve(r.split(',')[1] || r);
    };
    reader.onerror = () => reject(new Error('FILE_READER_ERROR'));
    reader.readAsDataURL(blob);
  });
}

function pctText(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

export function PlantDetectivePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AdvancedResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedToToday, setSavedToToday] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const clearAll = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setResult(null);
    setSavedToToday(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
    setResult(null);
    setSavedToToday(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const slotsLeft = MAX_PHOTOS - photos.length;
    if (slotsLeft <= 0) {
      toast.warning(`사진은 최대 ${MAX_PHOTOS}장까지 업로드할 수 있어요.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const incoming = Array.from(fileList).slice(0, slotsLeft);

    setIsPreparing(true);
    const next: PhotoItem[] = [];
    try {
      for (const file of incoming) {
        if (!file.type.startsWith('image/')) {
          toast.error(`'${file.name}' 은 사진 파일이 아니에요.`);
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`'${file.name}' 은 20MB를 초과해요.`);
          continue;
        }
        const compressed = await compressImage(file, 1024, 0.82);
        const base64 = await blobToBase64(compressed);
        next.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          previewUrl: URL.createObjectURL(compressed),
          base64,
          mimeType: compressed.type || file.type || 'image/jpeg',
        });
      }
      if (next.length > 0) {
        setPhotos((prev) => [...prev, ...next]);
        setResult(null);
        setSavedToToday(false);
      }
    } catch (e) {
      console.error('사진 처리 실패:', e);
      toast.error('사진을 처리하지 못했습니다.');
    } finally {
      setIsPreparing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const analyzePlant = async () => {
    if (photos.length === 0) {
      toast.info('사진을 1장 이상 선택해 주세요.');
      return;
    }
    setIsAnalyzing(true);
    try {
      const detect = httpsCallable<
        { images: { imageBase64: string; mimeType: string }[] },
        AdvancedResult
      >(functions, 'detectPlantAdvanced');
      const response = await detect({
        images: photos.map((p) => ({ imageBase64: p.base64, mimeType: p.mimeType })),
      });
      setResult(response.data);
      if (response.data.meta && !response.data.meta.plantNetAvailable) {
        toast.info('PlantNet 키가 설정되지 않아 Plant.id + Gemini 결과만 표시됩니다.');
      }
    } catch (error: any) {
      console.error('식물 분석 실패:', error);
      toast.error(error?.message || '식물 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 양쪽 저장 — records/{date}.plantDetective[] (legacy) + plants/{plantId} (신규)
  const saveToToday = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!result || photos.length === 0) {
      toast.info('먼저 분석을 완료해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const today = `${yyyy}-${mm}-${dd}`;
      const ts = Date.now();
      const plantId = `plant_${today}_${ts}_${Math.random().toString(36).slice(2, 8)}`;

      // 1) Storage에 사진들 업로드
      const storage = getStorage();
      const imageUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const fileName = `${plantId}_${i + 1}.jpg`;
        const path = `users/${user.uid}/format_photos/${fileName}`;
        const storageRef = ref(storage, path);
        const blob = await fetch(p.previewUrl).then((r) => r.blob());
        await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
        const url = await getDownloadURL(storageRef);
        imageUrls.push(url);
      }

      // 2) 표시용 식물명 — Gemini finalGuess 우선, 없으면 plantId/plantNet top
      const displayName =
        result.gemini?.finalGuess ||
        result.plantId?.name ||
        result.plantNet?.name ||
        '식물 이름 불확실';
      const displayLatin =
        result.gemini?.finalLatinName ||
        result.plantId?.latinName ||
        result.plantNet?.scientificName ||
        '';
      const topConfidence =
        result.plantId?.confidence ??
        result.plantNet?.confidence ??
        null;

      // 3) 신규 컬렉션 — users/{uid}/plants/{plantId}
      const plantDocRef = doc(db, 'users', user.uid, 'plants', plantId);
      await setDoc(plantDocRef, {
        plantId,
        createdAt: ts,
        date: today,
        imageUrls,
        finalGuess: displayName,
        finalLatinName: displayLatin,
        confidence: topConfidence,
        plantId_result: result.plantId,
        plantNet_result: result.plantNet,
        gemini_result: result.gemini,
        meta: result.meta,
      });

      // 4) 기존 호환 — records/{today}.plantDetective[] 에도 누적 저장
      const recordRef = doc(db, 'users', user.uid, 'records', today);
      const legacyEntry = {
        createdAt: ts,
        plantId,
        imageUrl: imageUrls[0] || '',
        imageUrls,
        plantName: displayName,
        latinName: displayLatin,
        identificationConfidence:
          typeof result.plantId?.confidence === 'number' ? result.plantId.confidence : null,
        isPlantProbability:
          typeof result.plantId?.isPlantProbability === 'number'
            ? result.plantId.isPlantProbability
            : null,
        alternativeCandidates: Array.isArray(result.plantId?.alternatives)
          ? result.plantId!.alternatives
          : [],
        taxonomy:
          result.plantId?.family || result.plantId?.genus
            ? { family: result.plantId.family, genus: result.plantId.genus }
            : null,
        identifiedBy: result.plantId ? 'kindwise' : result.plantNet ? 'plantnet' : 'gemini',
        condition: result.gemini?.analysis || '',
        confidence: result.gemini?.confidence || 'low',
        findings: [],
        actions: [],
        warningSigns: result.gemini?.warning ? [result.gemini.warning] : [],
        note: result.gemini?.warning || '',
      };
      await setDoc(
        recordRef,
        { date: today, plantDetective: arrayUnion(legacyEntry) },
        { merge: true },
      );

      setSavedToToday(true);
      toast.success(`오늘 기록(${today})에 저장되었습니다.`);
    } catch (error: any) {
      console.error('식물탐정 저장 실패:', error);
      toast.error(error?.message || '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const gemini = result?.gemini;
  const showPoisonAlert = Boolean(gemini?.poisonousRisk || gemini?.warning);

  return (
    <div style={{ minHeight: '100vh', background: '#FEFBE8', color: '#24301f' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(254, 251, 232, 0.94)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e6dfc7',
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: '1px solid #d7cfb5',
              background: '#fffdf4',
              color: '#4A5A2C',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <div style={{ fontSize: 13, color: '#6b7654', fontWeight: 700 }}>GARDEN · 교차검증</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: 0 }}>하루식물탐정</h1>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '18px 16px 96px' }}>
        {/* ========== 촬영 가이드 ========== */}
        <section
          style={{
            border: '1px solid #ded5b8',
            background: '#fffdf4',
            borderRadius: 10,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: '#4A5A2C',
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            <span>📸 더 정확한 식별을 위한 촬영 가이드</span>
            {showGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showGuide && (
            <>
              <ul
                style={{
                  marginTop: 10,
                  paddingLeft: 0,
                  listStyle: 'none',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 8,
                }}
              >
                {PHOTO_GUIDE_ITEMS.map((g) => (
                  <li
                    key={g.label}
                    style={{
                      border: '1px dashed #cfc69a',
                      borderRadius: 8,
                      padding: '8px 10px',
                      background: '#f8f4dd',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#3d4734' }}>
                      <span style={{ marginRight: 6 }}>{g.icon}</span>
                      {g.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7654', marginTop: 2 }}>{g.hint}</div>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 11, color: '#7a725d', marginTop: 8, lineHeight: 1.55 }}>
                여러 각도에서 최대 {MAX_PHOTOS}장까지 올릴 수 있어요. 부위가 다양할수록 교차검증 정확도가 올라갑니다.
              </p>
            </>
          )}
        </section>

        {/* ========== 사진 업로드 ========== */}
        <section
          style={{
            border: '1px solid #ded5b8',
            background: '#fffdf4',
            borderRadius: 10,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}
          >
            {photos.map((p) => (
              <div
                key={p.id}
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #cfc69a',
                  background: '#f6f4df',
                }}
              >
                <img
                  src={p.previewUrl}
                  alt="식물 사진"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  aria-label="사진 제거"
                  disabled={isAnalyzing}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(123, 63, 40, 0.92)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPreparing || isAnalyzing}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 8,
                  border: '1px dashed #b8c28c',
                  background: '#f6f4df',
                  color: '#71805a',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: 8,
                }}
              >
                <div>
                  {isPreparing ? <Loader2 size={22} className="animate-spin" style={{ margin: '0 auto 4px' }} /> : <Camera size={22} style={{ margin: '0 auto 4px' }} />}
                  <div style={{ fontSize: 12, fontWeight: 800 }}>사진 추가</div>
                  <div style={{ fontSize: 10, color: '#92996f', marginTop: 2 }}>
                    {photos.length}/{MAX_PHOTOS}
                  </div>
                </div>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={analyzePlant}
              disabled={photos.length === 0 || isPreparing || isAnalyzing}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 8,
                border: '1px solid #B85C2E',
                background:
                  photos.length === 0 || isPreparing || isAnalyzing ? '#e7dfc8' : '#B85C2E',
                color: '#fff',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {isAnalyzing ? '교차검증 중...' : '식물 탐정 시작'}
            </button>
            {photos.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                disabled={isAnalyzing}
                aria-label="모두 지우기"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  border: '1px solid #d7cfb5',
                  background: '#fff',
                  color: '#7b3f28',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </section>

        {/* ========== 결과 영역 ========== */}
        {!result ? (
          <div
            style={{
              border: '1px solid #ded5b8',
              background: '#fffdf4',
              borderRadius: 10,
              padding: 28,
              textAlign: 'center',
              color: '#6f775b',
            }}
          >
            <Leaf size={36} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 900 }}>분석 결과가 여기에 표시됩니다</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Plant.id · PlantNet · HARU AI가 함께 분석합니다.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* ========== 독초 경고 ========== */}
            {showPoisonAlert && (
              <div
                style={{
                  border: '2px solid #B91C1C',
                  background: '#FEF2F2',
                  borderRadius: 10,
                  padding: 14,
                  color: '#7F1D1D',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>
                    ⚠️ 독초·섭취 주의
                  </div>
                  {gemini?.warning && (
                    <div style={{ fontSize: 13, marginBottom: 6 }}>{gemini.warning}</div>
                  )}
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                    <li>⚠ AI 결과만으로 섭취 금지</li>
                    <li>⚠ 유사 독초 가능성 존재 — 전문가 확인 필수</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ========== HARU AI 최종 분석 ========== */}
            {gemini && (
              <ResultCard
                title="🌿 HARU AI 최종 분석"
                accent="#4A5A2C"
                bg="#F1F4DC"
              >
                <div style={{ fontSize: 13, color: '#6b7654', fontWeight: 800, marginBottom: 4 }}>
                  최종 추정 · 신뢰도 {gemini.confidence === 'high' ? '높음' : gemini.confidence === 'medium' ? '보통' : '낮음'}
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 950 }}>
                  {gemini.finalGuess}
                </h3>
                {gemini.finalLatinName && (
                  <div style={{ fontSize: 13, fontStyle: 'italic', color: '#6b7654', marginBottom: 8 }}>
                    {gemini.finalLatinName}
                  </div>
                )}
                {gemini.analysis && (
                  <p style={{ margin: '6px 0 0', fontSize: 14, color: '#3d4734', lineHeight: 1.6 }}>
                    {gemini.analysis}
                  </p>
                )}
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge
                    text={
                      gemini.edible === 'yes'
                        ? '식용 가능성 있음'
                        : gemini.edible === 'no'
                        ? '식용 불가 가능성'
                        : '식용 여부 불확실'
                    }
                    color={
                      gemini.edible === 'yes'
                        ? '#166534'
                        : gemini.edible === 'no'
                        ? '#7F1D1D'
                        : '#6b7654'
                    }
                    bg={
                      gemini.edible === 'yes'
                        ? '#DCFCE7'
                        : gemini.edible === 'no'
                        ? '#FEE2E2'
                        : '#EDF0DA'
                    }
                  />
                  {gemini.poisonousRisk && (
                    <Badge text="독성 위험 있음" color="#7F1D1D" bg="#FEE2E2" />
                  )}
                </div>
              </ResultCard>
            )}

            {/* ========== Plant.id 결과 ========== */}
            <ResultCard title="🧪 Plant.id 결과" accent="#1A3C6E" bg="#EEF3FA">
              {result.plantId ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                      {result.plantId.name || '식물 이름 불확실'}
                    </h4>
                    <span style={{ fontSize: 12, color: '#6b7654', fontStyle: 'italic' }}>
                      {result.plantId.latinName}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#1A3C6E', fontWeight: 700 }}>
                    일치도 {pctText(result.plantId.confidence)}
                    {result.plantId.family && (
                      <span style={{ marginLeft: 8, color: '#6b7654', fontWeight: 500 }}>
                        · {result.plantId.family}
                        {result.plantId.genus ? ` / ${result.plantId.genus}` : ''}
                      </span>
                    )}
                  </div>
                  {result.plantId.alternatives.length > 0 && (
                    <CandList
                      label="다른 가능성"
                      items={result.plantId.alternatives.map((c) => ({
                        name: c.name,
                        sub: c.latinName,
                        score: c.probability,
                      }))}
                    />
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#6b7654' }}>Plant.id 결과를 가져오지 못했습니다.</div>
              )}
            </ResultCard>

            {/* ========== PlantNet 결과 ========== */}
            <ResultCard title="🌍 PlantNet 결과 (k-world-flora)" accent="#0F766E" bg="#ECFDF5">
              {result.plantNet ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                      {result.plantNet.name || '식물 이름 불확실'}
                    </h4>
                    <span style={{ fontSize: 12, color: '#6b7654', fontStyle: 'italic' }}>
                      {result.plantNet.scientificName}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#0F766E', fontWeight: 700 }}>
                    일치도 {pctText(result.plantNet.confidence)}
                    {result.plantNet.family && (
                      <span style={{ marginLeft: 8, color: '#6b7654', fontWeight: 500 }}>
                        · {result.plantNet.family}
                        {result.plantNet.genus ? ` / ${result.plantNet.genus}` : ''}
                      </span>
                    )}
                  </div>
                  {result.plantNet.alternatives.length > 0 && (
                    <CandList
                      label="다른 가능성"
                      items={result.plantNet.alternatives.map((c) => ({
                        name: c.name,
                        sub: c.scientificName,
                        score: c.score,
                      }))}
                    />
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#6b7654' }}>
                  {result.meta?.plantNetAvailable === false
                    ? 'PlantNet API 키가 아직 설정되지 않았어요. Plant.id 결과만으로 분석했습니다.'
                    : 'PlantNet 결과를 가져오지 못했습니다 (식물 특징이 부족하거나 일시적 오류).'}
                </div>
              )}
            </ResultCard>

            {/* ========== 유사종 ========== */}
            {gemini && gemini.similarSpecies.length > 0 && (
              <ResultCard title="🔍 유사종 비교" accent="#7C3AED" bg="#F5F0FF">
                <ul style={{ margin: 0, paddingLeft: 18, color: '#3d4734', lineHeight: 1.7 }}>
                  {gemini.similarSpecies.map((s, i) => (
                    <li key={`sim-${i}`}>{s}</li>
                  ))}
                </ul>
              </ResultCard>
            )}

            {/* ========== 추가 사진 요청 ========== */}
            {gemini && gemini.needMorePhotos.length > 0 && (
              <ResultCard title="📷 더 정확하게 알려면" accent="#B45309" bg="#FEF8E7">
                <ul style={{ margin: 0, paddingLeft: 18, color: '#3d4734', lineHeight: 1.7 }}>
                  {gemini.needMorePhotos.map((s, i) => (
                    <li key={`np-${i}`}>{s}</li>
                  ))}
                </ul>
              </ResultCard>
            )}

            {/* ========== 저장 버튼 ========== */}
            <button
              type="button"
              onClick={saveToToday}
              disabled={isSaving || savedToToday}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 8,
                border: '1px solid #4A5A2C',
                background: savedToToday ? '#e7dfc8' : isSaving ? '#7b8b4b' : '#4A5A2C',
                color: '#fff',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: isSaving || savedToToday ? 'not-allowed' : 'pointer',
              }}
              title="오늘 기록 + 식물 도감(plants/)에 함께 저장합니다"
            >
              {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {savedToToday ? '오늘 기록에 저장됨' : isSaving ? '저장 중...' : '오늘 SAYU + 도감에 저장'}
            </button>

            <p style={{ fontSize: 11, color: '#7a725d', textAlign: 'center', lineHeight: 1.55 }}>
              본 결과는 AI 참고용이며, 섭취·약용은 반드시 전문가 확인 후 진행해 주세요.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ===========================================
// 작은 표시 컴포넌트들
// ===========================================
function ResultCard({
  title,
  accent,
  bg,
  children,
}: {
  title: string;
  accent: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: `1px solid ${accent}33`,
        background: bg,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: accent,
          marginBottom: 8,
          letterSpacing: 0.2,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 999,
        color,
        background: bg,
      }}
    >
      {text}
    </span>
  );
}

function CandList({
  label,
  items,
}: {
  label: string;
  items: { name: string; sub?: string; score?: number }[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#3d4734', marginBottom: 4 }}>
        {label}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#3d4734', lineHeight: 1.6 }}>
        {items.slice(0, 3).map((c, i) => (
          <li key={`c-${i}`} style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>{c.name}</span>
            {c.sub && (
              <span style={{ marginLeft: 6, fontStyle: 'italic', color: '#6b7654', fontSize: 12 }}>
                {c.sub}
              </span>
            )}
            {typeof c.score === 'number' && (
              <span style={{ marginLeft: 6, color: '#92996f', fontSize: 11 }}>
                ({pctText(c.score)})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
