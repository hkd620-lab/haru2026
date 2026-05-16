import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowLeft, Camera, Leaf, Loader2, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { functions } from '../../firebase';
import { compressImage } from '../services/imageService';

type PlantResult = {
  plantName?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PlantResult | null>(null);

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setImageBase64('');
    setMimeType('image/jpeg');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
                <div style={{ fontSize: 13, color: '#6b7654', fontWeight: 800, marginBottom: 8 }}>
                  신뢰도: {result.confidence === 'high' ? '높음' : result.confidence === 'medium' ? '보통' : '낮음'}
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 950 }}>
                  {result.plantName || '식물 이름 불확실'}
                </h2>
                <p style={{ margin: '0 0 16px', color: '#4A5A2C', fontSize: 16, fontWeight: 800 }}>
                  {result.condition || '사진에서 확인 가능한 상태가 제한적입니다.'}
                </p>

                <ResultList title="관찰 내용" items={result.findings} />
                <ResultList title="돌봄 힌트" items={result.actions} />
                <ResultList title="주의 신호" items={result.warningSigns} />

                {result.note && (
                  <p style={{ marginTop: 14, fontSize: 13, color: '#7a725d', lineHeight: 1.6 }}>
                    {result.note}
                  </p>
                )}
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
