import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebase';

type SharedRecordListItem = {
  id: string;
  title?: string;
  nickname?: string;
  recordDate?: string;
  publishedAt?: any;
  formats?: Array<{
    formatKey?: string;
    formatLabel?: string;
    sayuText?: string;
  }>;
};

export function SayuTogetherPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SharedRecordListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fromPath = (location.state as any)?.from as string | undefined;

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  useEffect(() => {
    if (authLoading || !user?.uid) return;
    let cancelled = false;

    const loadSharedRecords = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const sharedQuery = query(
          collection(db, 'shared_records'),
          where('isActive', '==', true),
          limit(20),
        );
        const snapshot = await getDocs(sharedQuery);
        if (cancelled) return;
        const next = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as SharedRecordListItem)
          .sort((a, b) => {
            const aTime = a.publishedAt?.toMillis?.() ?? 0;
            const bTime = b.publishedAt?.toMillis?.() ?? 0;
            return bTime - aTime;
          });
        setItems(next);
      } catch (error) {
        console.error('SAYU-함께보기 공개 글 불러오기 실패:', error);
        if (!cancelled) setErrorMessage('공개된 SAYU 기록을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSharedRecords();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.uid]);

  const formatRecordDate = (date?: string) => {
    if (!date) return '';
    const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  };

  const renderSharedContent = () => {
    if (authLoading || loading) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #D1FAE5' }}>
          <p className="text-sm" style={{ color: '#0F766E' }}>공개된 SAYU 기록을 불러오고 있습니다.</p>
        </div>
      );
    }

    if (!user?.uid) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #D1FAE5' }}>
          <p className="text-sm" style={{ color: '#0F766E', lineHeight: 1.7 }}>
            SAYU-함께보기는 로그인한 HARU 회원만 볼 수 있습니다.
          </p>
        </div>
      );
    }

    if (errorMessage) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #FECACA' }}>
          <p className="text-sm" style={{ color: '#B42318', lineHeight: 1.7 }}>{errorMessage}</p>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, #ECFDF5 0%, #ffffff 70%)',
            border: '1px solid #D1FAE5',
          }}
        >
          <p className="text-sm" style={{ color: '#0F766E', lineHeight: 1.7 }}>
            공개된 기록을 준비하고 있습니다.<br />
            곧 이곳에서 다른 회원들의 SAYU 기록을 만나보실 수 있어요.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item) => {
          const formats = Array.isArray(item.formats) ? item.formats : [];
          const preview = formats
            .map((format) => String(format.sayuText || '').trim())
            .find(Boolean) || '';
          return (
            <article
              key={item.id}
              className="bg-white rounded-xl p-4 shadow-sm"
              style={{ border: '1px solid #D1FAE5' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div style={{ minWidth: 0 }}>
                  <h2 className="text-base font-bold truncate" style={{ color: '#1A3C6E' }}>
                    {item.title || 'SAYU 기록'}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                    {item.nickname || 'HARU 회원'} · {formatRecordDate(item.recordDate)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {formats.map((format) => (
                    <span
                      key={`${item.id}_${format.formatKey || format.formatLabel}`}
                      className="text-[10px] font-bold rounded-full px-2 py-1"
                      style={{ backgroundColor: '#ECFDF5', color: '#0F766E' }}
                    >
                      {format.formatLabel || 'SAYU'}
                    </span>
                  ))}
                </div>
              </div>
              {preview && (
                <p className="text-sm mt-3" style={{ color: '#334155', lineHeight: 1.7 }}>
                  {preview.length > 160 ? `${preview.slice(0, 160)}...` : preview}
                </p>
              )}
            </article>
          );
        })}
      </div>
    );
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
            background: '#0F766E',
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
          SAYU · TOGETHER
        </span>
      </div>

      <div className="mb-5">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#1A3C6E' }}
        >
          🌿 SAYU·함께보기
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          HARU 회원들이 공개한 기록을 함께 읽고 댓글로 마음을 나누는 공간입니다.
        </p>
      </div>

      {renderSharedContent()}
    </div>
  );
}
