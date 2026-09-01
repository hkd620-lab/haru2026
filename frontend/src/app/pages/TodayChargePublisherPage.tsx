import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { PageHeaderActions } from '../components/PageHeaderActions';
import {
  getTodayDateKey,
  publishTodayChargeContent,
  type TodayChargeContentType,
} from '../services/todayChargePublishService';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export function TodayChargePublisherPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDeveloper = user?.uid === DEVELOPER_UID;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  const [contentType, setContentType] = useState<TodayChargeContentType>('charge');
  const [publishDate, setPublishDate] = useState(getTodayDateKey());
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (!user) return;
    if (!isDeveloper) navigate('/');
  }, [user, isDeveloper, navigate]);

  if (!user || !isDeveloper) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
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
    if (!publishDate) {
      toast.error('게시 날짜를 선택해주세요.');
      return;
    }

    setPublishing(true);
    try {
      await publishTodayChargeContent({
        imageFile,
        title: title.trim(),
        caption: caption.trim(),
        type: contentType,
        publishDate,
      });

      toast.success(
        contentType === 'ramen'
          ? '하루라면 발행 완료! 오늘의 충전에 노출됩니다.'
          : '오늘의 충전 발행 완료! SAYU-함께보기 오늘의 충전 탭에 노출됩니다.',
      );
      navigate('/sayu-together');
    } catch (err: any) {
      console.error('오늘충전 발행 실패', err);
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
          오늘의 충전 발행
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          이미지 업로드 → 문구 입력 → 발행
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-sm mb-3">1. 이미지</h2>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageChange}
            disabled={publishing}
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
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-sm">2. 발행 내용</h2>

          <div>
            <label className="block text-xs text-gray-600 mb-1">콘텐츠 종류</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as TodayChargeContentType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              style={{ fontSize: 16 }}
            >
              <option value="charge">오늘의 충전</option>
              <option value="ramen">하루라면</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">게시 날짜</label>
            <input
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={contentType === 'ramen' ? '마늘 액젓 라면' : '오늘의 충전 제목'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              {contentType === 'ramen' ? '보조 문구 (선택)' : '캡션 (선택)'}
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder={contentType === 'ramen' ? '감칠맛 폭발! 김치 풍미 가득한 라면' : '짧은 설명이나 오늘의 충전 문구'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            큐레이터: haru2026 · 게시 날짜: {publishDate}
          </div>
        </section>

        <button
          onClick={handlePublish}
          disabled={publishing || !imageFile || !title.trim()}
          className="w-full py-3 rounded-xl text-white font-semibold text-base disabled:opacity-50"
          style={{ backgroundColor: '#1A3C6E' }}
        >
          {publishing ? '발행 중...' : '발행하기'}
        </button>
      </div>
    </div>
  );
}
