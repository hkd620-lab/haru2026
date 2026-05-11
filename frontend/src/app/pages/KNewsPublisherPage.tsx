import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { functions, storage, db } from '../../firebase';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { CATEGORY_LIST, KNewsCategory } from '../data/kNewsData';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

interface ExtractedMetadata {
  title: string;
  subtitle: string;
  category: KNewsCategory;
  tags: string[];
  sources: string[];
  summary?: string;
  copyrightCheck?: {
    isAIGenerated: boolean;
    brandDetected: boolean;
    publicSource: boolean;
  };
}

const DEFAULT_BALANCE_NOTE = '본 자료는 공공 통계 기반 재구성이며, 특정 매체 콘텐츠와 무관합니다.';

export function KNewsPublisherPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDeveloper = user?.uid === DEVELOPER_UID;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<KNewsCategory>('K-컬처');
  const [tagsText, setTagsText] = useState('');
  const [sourcesText, setSourcesText] = useState('');
  const [balanceNote, setBalanceNote] = useState(DEFAULT_BALANCE_NOTE);
  const [copyrightInfo, setCopyrightInfo] = useState<ExtractedMetadata['copyrightCheck'] | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!isDeveloper) navigate('/');
  }, [user, isDeveloper, navigate]);

  if (!user || !isDeveloper) return null;

  const readAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    setExtracting(true);
    try {
      const base64 = await readAsBase64(file);
      const callable = httpsCallable<{ imageBase64: string; mimeType: string }, ExtractedMetadata>(
        functions,
        'extractKNewsMetadata'
      );
      const result = await callable({ imageBase64: base64, mimeType: file.type });
      const data = result.data;

      setTitle(data.title || '');
      setSubtitle(data.subtitle || '');
      if (CATEGORY_LIST.includes(data.category)) {
        setCategory(data.category);
      }
      setTagsText((data.tags || []).join(', '));
      setSourcesText((data.sources || []).join(', '));
      setCopyrightInfo(data.copyrightCheck || null);
      toast.success('AI 분석 완료. 내용을 검토하고 발행하세요.');
    } catch (err: any) {
      console.error('extractKNewsMetadata 실패', err);
      toast.error(`AI 분석 실패: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setExtracting(false);
    }
  };

  const handlePublish = async () => {
    if (!imageFile) {
      toast.error('이미지를 먼저 업로드해주세요.');
      return;
    }
    if (!title.trim()) {
      toast.error('제목을 입력해주세요.');
      return;
    }

    setPublishing(true);
    try {
      const ext = imageFile.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const storageRef = ref(storage, `k-news/${fileName}`);
      await uploadBytes(storageRef, imageFile);
      const imageUrl = await getDownloadURL(storageRef);

      const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
      const sources = sourcesText.split(',').map((s) => s.trim()).filter(Boolean);

      await addDoc(collection(db, 'k_news'), {
        title: title.trim(),
        subtitle: subtitle.trim(),
        category,
        tags,
        sources,
        imageUrl,
        curator: '허 교장님',
        balanceNote: balanceNote.trim() || DEFAULT_BALANCE_NOTE,
        createdAt: serverTimestamp(),
      });

      toast.success('발행 완료! 원기충전소 K뉴스 탭에 노출됩니다.');
      navigate('/book-studio');
    } catch (err: any) {
      console.error('K뉴스 발행 실패', err);
      toast.error(`발행 실패: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E' }}>
      <PageHeaderActions onClose={() => navigate('/admin/console')} />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <h1 className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
          📰 K뉴스 발행
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          이미지 업로드 → AI 자동 분석 → 검토 후 발행
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* 1. 이미지 업로드 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-sm mb-3">1️⃣ 카드뉴스 이미지</h2>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageChange}
            disabled={extracting || publishing}
            className="block w-full text-sm text-gray-600
              file:mr-3 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          {imagePreview && (
            <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 max-w-sm">
              <img src={imagePreview} alt="미리보기" className="w-full h-auto" />
            </div>
          )}
          {extracting && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-700">
              <div
                className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: '#1A3C6E', borderTopColor: 'transparent' }}
              />
              AI가 이미지를 분석하는 중...
            </div>
          )}
        </section>

        {/* 2. 메타데이터 폼 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-sm">2️⃣ 메타데이터 (AI 자동 입력 · 수정 가능)</h2>

          <div>
            <label className="block text-xs text-gray-600 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="카드뉴스 제목"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">부제 / 요약</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="부제 또는 한 줄 요약"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_LIST.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 text-xs rounded-full border ${
                    category === c
                      ? 'bg-blue-100 text-blue-700 border-blue-700 font-medium'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">태그 (쉼표 구분)</label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="예: 이민자, 다문화, OECD"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">출처 (쉼표 구분)</label>
            <input
              type="text"
              value={sourcesText}
              onChange={(e) => setSourcesText(e.target.value)}
              placeholder="예: OECD, 통계청, KOFICE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">밸런스 안내문</label>
            <textarea
              value={balanceNote}
              onChange={(e) => setBalanceNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            큐레이터: 허 교장님 · 발행일: 자동
          </div>
        </section>

        {/* 3. 저작권 체크 */}
        {copyrightInfo && (
          <section className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-sm mb-3">3️⃣ 저작권 자동 검토</h2>
            <ul className="text-sm space-y-1.5">
              <li>
                {copyrightInfo.isAIGenerated ? '✅' : '⚠️'} AI 생성 이미지: {copyrightInfo.isAIGenerated ? '예' : '불명확'}
              </li>
              <li>
                {copyrightInfo.brandDetected ? '⚠️' : '✅'} 매체 로고/워터마크: {copyrightInfo.brandDetected ? '검출됨 (확인 필요)' : '검출 안 됨'}
              </li>
              <li>
                {copyrightInfo.publicSource ? '✅' : '⚠️'} 공공기관 출처: {copyrightInfo.publicSource ? '명확함' : '불명확 (확인 필요)'}
              </li>
            </ul>
          </section>
        )}

        {/* 4. 발행 버튼 */}
        <button
          onClick={handlePublish}
          disabled={publishing || extracting || !imageFile || !title.trim()}
          className="w-full py-3 rounded-xl text-white font-semibold text-base disabled:opacity-50"
          style={{ backgroundColor: '#1A3C6E' }}
        >
          {publishing ? '발행 중...' : '🚀 발행하기'}
        </button>
      </div>
    </div>
  );
}
