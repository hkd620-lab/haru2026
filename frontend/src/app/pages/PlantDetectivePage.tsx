import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowLeft, Camera, Leaf, Loader2, Search, X, Save, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, arrayUnion, getDocs, collection, query as fsQuery, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { db, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../services/imageService';

type AlternativeCandidate = {
  name: string;
  latinName?: string;
  probability?: number;
};

type PlantResult = {
  // Kindwise 식별
  plantName?: string;
  latinName?: string;
  identificationConfidence?: number | null; // 0~1
  isPlantProbability?: number | null; // 0~1
  alternativeCandidates?: AlternativeCandidate[];
  taxonomy?: { family?: string; genus?: string };
  kindwiseUrl?: string;
  identifiedBy?: 'kindwise' | 'gemini';
  // Gemini 해설
  condition?: string;
  confidence?: 'high' | 'medium' | 'low';
  findings?: string[];
  actions?: string[];
  warningSigns?: string[];
  note?: string;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = () => reject(new Error('FILE_READER_ERROR'));
    reader.readAsDataURL(blob);
  });
}

export function PlantDetectivePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PlantResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedToToday, setSavedToToday] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [historyHint, setHistoryHint] = useState<string>('');

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setImageBase64('');
    setMimeType('image/jpeg');
    setResult(null);
    setSavedToToday(false);
    setTodayCount(null);
    setHistoryHint('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 오늘 records/{date} 문서에 plantDetective entry 추가 (arrayUnion)
  // 이미지는 Firebase Storage 영구 저장. confidence·후보·해설 모두 동봉.
  const saveToToday = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!result || !imageBase64 || !previewUrl) {
      toast.info('먼저 분석을 완료해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const todayDate = new Date();
      const yyyy = todayDate.getFullYear();
      const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
      const dd = String(todayDate.getDate()).padStart(2, '0');
      const today = `${yyyy}-${mm}-${dd}`;
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const fileName = `plant_${today}_${ts}_${rand}.jpg`;

      // 1. 이미지 Firebase Storage 업로드 (format_photos 폴더 재활용)
      const storage = getStorage();
      const imagePath = `users/${user.uid}/format_photos/${fileName}`;
      const storageRef = ref(storage, imagePath);
      const blob = await fetch(previewUrl).then((r) => r.blob());
      await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
      const imageUrl = await getDownloadURL(storageRef);

      // 2. entry 구성 (undefined 금지 — arrayUnion 호환)
      const entry = {
        createdAt: ts,
        imageUrl,
        plantName: result.plantName || '식물 이름 불확실',
        latinName: result.latinName || '',
        identificationConfidence: typeof result.identificationConfidence === 'number' ? result.identificationConfidence : null,
        isPlantProbability: typeof result.isPlantProbability === 'number' ? result.isPlantProbability : null,
        alternativeCandidates: Array.isArray(result.alternativeCandidates) ? result.alternativeCandidates : [],
        taxonomy: result.taxonomy || null,
        identifiedBy: result.identifiedBy || 'gemini',
        condition: result.condition || '',
        confidence: result.confidence || 'low',
        findings: Array.isArray(result.findings) ? result.findings : [],
        actions: Array.isArray(result.actions) ? result.actions : [],
        warningSigns: Array.isArray(result.warningSigns) ? result.warningSigns : [],
        note: result.note || '',
      };

      // 3. records/{today}.plantDetective 배열에 push (merge:true 로 기존 record 보존)
      const recordRef = doc(db, 'users', user.uid, 'records', today);
      await setDoc(
        recordRef,
        { date: today, plantDetective: arrayUnion(entry) },
        { merge: true },
      );

      // 4. 오늘 record 다시 읽어 현재 plantDetective 카운트 (UX 안내)
      let countToday: number | null = null;
      try {
        const snap = await getDoc(recordRef);
        const arr = (snap.data()?.plantDetective || []) as any[];
        countToday = arr.length;
      } catch {
        // 무시 — 표시 안내 못 해도 저장 자체는 성공
      }
      setTodayCount(countToday);

      // 5. 같은 식물명의 과거 비교 hint (있을 때만, 30일 최근 record 한정 — 비용 제어)
      try {
        const matchName = (result.plantName || '').trim();
        if (matchName) {
          const past30 = new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          const fromKey = `${past30.getFullYear()}-${String(past30.getMonth() + 1).padStart(2, '0')}-${String(past30.getDate()).padStart(2, '0')}`;
          const q = fsQuery(
            collection(db, 'users', user.uid, 'records'),
            where('date', '>=', fromKey),
            where('date', '<', today),
          );
          const snap = await getDocs(q);
          const pastEntries: { confidence: number | null; date: string }[] = [];
          snap.forEach((d) => {
            const arr = (d.data()?.plantDetective || []) as any[];
            arr.forEach((e) => {
              if (typeof e?.plantName === 'string' && e.plantName.trim() === matchName) {
                pastEntries.push({
                  confidence: typeof e?.identificationConfidence === 'number' ? e.identificationConfidence : null,
                  date: d.id,
                });
              }
            });
          });
          if (pastEntries.length > 0) {
            const lastWithConf = [...pastEntries].reverse().find((p) => typeof p.confidence === 'number');
            const nowConf = typeof result.identificationConfidence === 'number' ? result.identificationConfidence : null;
            if (lastWithConf && typeof nowConf === 'number') {
              const diff = Math.round((nowConf - (lastWithConf.confidence || 0)) * 100);
              const arrow = diff > 0 ? '상승' : diff < 0 ? '하락' : '동일';
              setHistoryHint(`같은 이름 과거 기록 ${pastEntries.length}건 발견 — 지난 분석 대비 일치도 ${Math.abs(diff)}%p ${arrow}`);
            } else {
              setHistoryHint(`같은 이름 과거 기록 ${pastEntries.length}건 발견 — SAYU에서 추이 확인 가능`);
            }
          }
        }
      } catch (err) {
        console.warn('과거 비교 조회 실패 (저장은 성공):', err);
      }

      setSavedToToday(true);
      toast.success(`오늘 기록(${today})에 저장되었습니다.`);
    } catch (error: any) {
      console.error('식물탐정 저장 실패:', error);
      toast.error(error?.message || '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('식물 사진 파일을 선택해 주세요.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('사진은 20MB 이하로 선택해 주세요.');
      return;
    }

    setIsPreparing(true);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const compressed = await compressImage(file, 1024, 0.82);
      const base64 = await blobToBase64(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setImageBase64(base64);
      setMimeType(compressed.type || file.type || 'image/jpeg');
      setResult(null);
    } catch (error) {
      console.error('식물 사진 처리 실패:', error);
      toast.error('사진을 처리하지 못했습니다.');
    } finally {
      setIsPreparing(false);
    }
  };

  const analyzePlant = async () => {
    if (!imageBase64) {
      toast.info('분석할 식물 사진을 먼저 선택해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const analyzePlantPhoto = httpsCallable<
        { imageBase64: string; mimeType: string },
        PlantResult
      >(functions, 'analyzePlantPhoto');
      const response = await analyzePlantPhoto({ imageBase64, mimeType });
      setResult(response.data);
    } catch (error: any) {
      console.error('식물 분석 실패:', error);
      toast.error(error?.message || '식물 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

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
            <div style={{ fontSize: 13, color: '#6b7654', fontWeight: 700 }}>GARDEN · 사진 분석</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: 0 }}>하루식물탐정</h1>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '22px 18px 96px' }}>
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 18,
          }}
        >
          <div
            style={{
              border: '1px solid #ded5b8',
              background: '#fffdf4',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div
              style={{
                aspectRatio: '4 / 3',
                borderRadius: 8,
                border: '1px dashed #b8c28c',
                background: '#f6f4df',
                overflow: 'hidden',
                display: 'grid',
                placeItems: 'center',
                marginBottom: 14,
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="식물 사진 미리보기"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#71805a' }}>
                  <Leaf size={42} style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 15, fontWeight: 800 }}>잎, 줄기, 열매가 보이는 사진</div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPreparing || isAnalyzing}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 8,
                  border: '1px solid #4A5A2C',
                  background: '#4A5A2C',
                  color: '#fff',
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Camera size={18} />
                사진 선택
              </button>
              {previewUrl && (
                <button
                  type="button"
                  onClick={clearImage}
                  disabled={isAnalyzing}
                  aria-label="사진 제거"
                  style={{
                    width: 44,
                    height: 44,
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

            <button
              type="button"
              onClick={analyzePlant}
              disabled={!imageBase64 || isPreparing || isAnalyzing}
              style={{
                width: '100%',
                height: 48,
                marginTop: 10,
                borderRadius: 8,
                border: '1px solid #B85C2E',
                background: !imageBase64 || isPreparing || isAnalyzing ? '#e7dfc8' : '#B85C2E',
                color: '#fff',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {isPreparing || isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {isAnalyzing ? '분석 중...' : isPreparing ? '사진 준비 중...' : '식물 탐정 시작'}
            </button>
          </div>

          <div
            style={{
              border: '1px solid #ded5b8',
              background: '#fffdf4',
              borderRadius: 8,
              padding: 18,
              minHeight: 320,
            }}
          >
            {!result ? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#6f775b', textAlign: 'center' }}>
                <div>
                  <Leaf size={34} style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>분석 결과가 여기에 표시됩니다</div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7654', fontWeight: 800, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span>해설 신뢰도: {result.confidence === 'high' ? '높음' : result.confidence === 'medium' ? '보통' : '낮음'}</span>
                  {typeof result.identificationConfidence === 'number' && (
                    <span style={{ padding: '2px 8px', borderRadius: 6, background: '#eef0d8', color: '#4A5A2C' }}>
                      식별 일치도 {Math.round(result.identificationConfidence * 100)}%
                    </span>
                  )}
                  {result.identifiedBy === 'gemini' && (
                    <span style={{ padding: '2px 8px', borderRadius: 6, background: '#fcebd8', color: '#7b3f28', fontSize: 11 }}>
                      Plant.id 미사용 (AI 단독)
                    </span>
                  )}
                </div>
                <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 950 }}>
                  {result.plantName || '식물 이름 불확실'}
                </h2>
                {result.latinName && (
                  <div style={{ margin: '0 0 10px', fontSize: 13, fontStyle: 'italic', color: '#6b7654' }}>
                    {result.latinName}
                    {result.taxonomy?.family && (
                      <span style={{ marginLeft: 8, fontStyle: 'normal', color: '#92996f' }}>
                        · {result.taxonomy.family}
                        {result.taxonomy.genus ? ` / ${result.taxonomy.genus}` : ''}
                      </span>
                    )}
                  </div>
                )}
                <p style={{ margin: '8px 0 16px', color: '#4A5A2C', fontSize: 16, fontWeight: 800 }}>
                  {result.condition || '사진에서 확인 가능한 상태가 제한적입니다.'}
                </p>

                <ResultList title="관찰 내용" items={result.findings} />
                <ResultList title="돌봄 힌트" items={result.actions} />
                <ResultList title="주의 신호" items={result.warningSigns} />

                {result.alternativeCandidates && result.alternativeCandidates.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 900, color: '#24301f' }}>
                      다른 가능성
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: 18, color: '#3d4734', lineHeight: 1.65 }}>
                      {result.alternativeCandidates.slice(0, 3).map((c, i) => (
                        <li key={`alt-${i}`}>
                          <span style={{ fontWeight: 700 }}>{c.name}</span>
                          {c.latinName && (
                            <span style={{ marginLeft: 6, fontStyle: 'italic', color: '#6b7654' }}>{c.latinName}</span>
                          )}
                          {typeof c.probability === 'number' && (
                            <span style={{ marginLeft: 6, color: '#92996f', fontSize: 12 }}>
                              ({Math.round(c.probability * 100)}%)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.note && (
                  <p style={{ marginTop: 14, fontSize: 13, color: '#7a725d', lineHeight: 1.6 }}>
                    {result.note}
                  </p>
                )}
                {result.kindwiseUrl && (
                  <a
                    href={result.kindwiseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#4A5A2C', textDecoration: 'underline' }}
                  >
                    Plant.id 도감에서 자세히 보기 →
                  </a>
                )}

                {/* 60% 미만 — 유묘 단계 안내 */}
                {typeof result.identificationConfidence === 'number' && result.identificationConfidence < 0.6 && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#fff5d6',
                      border: '1px solid #e8d68a',
                      color: '#6e5a16',
                      fontSize: 13,
                      lineHeight: 1.55,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      유묘 단계라 아직 불확실합니다. 일주일 뒤 다시 촬영해 보세요.
                      <br />
                      성장 후 다시 분석하면 더 정확한 결과를 얻을 수 있어요.
                    </div>
                  </div>
                )}

                {/* SAYU에 남기기 버튼 */}
                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    onClick={saveToToday}
                    disabled={isSaving || savedToToday}
                    style={{
                      width: '100%',
                      height: 46,
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
                    title="SAYU의 오늘 날짜 기록에 식별 결과를 누적 저장합니다"
                  >
                    {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                    {savedToToday ? '오늘 기록에 저장됨' : isSaving ? '저장 중...' : '오늘 SAYU에 남기기'}
                  </button>
                  {savedToToday && todayCount && todayCount > 1 && (
                    <div style={{ fontSize: 12, color: '#6b7654' }}>
                      오늘 같은 날짜 기록 {todayCount}번째 — SAYU에서 추이 확인 가능
                    </div>
                  )}
                  {historyHint && (
                    <div style={{ fontSize: 12, color: '#4A5A2C', background: '#eef0d8', padding: '6px 10px', borderRadius: 6 }}>
                      📊 {historyHint}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function ResultList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 900, color: '#24301f' }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#3d4734', lineHeight: 1.65 }}>
        {items.slice(0, 5).map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
