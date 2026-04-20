import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router';

interface NewsData {
  rank: number;
  title: string;
  summary: string;
  originalTitle: string;
  link: string;
  category: string;
  updatedAt?: { seconds: number };
}

export function NewsPage() {
  const navigate = useNavigate();
  const [newsList, setNewsList] = useState<NewsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const docs = ['rank1', 'rank2', 'rank3'];
    const results: (NewsData | null)[] = [null, null, null];
    let loaded = 0;

    const unsubscribers = docs.map((docId, idx) =>
      onSnapshot(doc(db, 'news', docId), (s) => {
        results[idx] = s.exists() ? (s.data() as NewsData) : null;
        loaded++;
        if (loaded === 3) {
          setNewsList(
            (results.filter(Boolean) as NewsData[]).sort((a, b) => a.rank - b.rank)
          );
          setLoading(false);
        }
      })
    );

    return () => unsubscribers.forEach((u) => u());
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'refreshNews');
      await fn({});
    } catch (e) {
      console.warn('새로고침 실패:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return '';
    return new Date(seconds * 1000).toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const rankColors = ['#1A3C6E', '#2d6a4f', '#7b2d8b'];
  const rankLabels = ['1위', '2위', '3위'];

  return (
    <div style={{ backgroundColor: '#FAF9F6', minHeight: '100vh' }}>
      <div style={{ backgroundColor: '#1A3C6E', padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/')} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>🌍 YTN보다 빠른 국제뉴스</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: 0 }}>Al Jazeera · Guardian · NYT 직접 수신 — AI 선별</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ color: '#10b981', background: 'none', border: '1px solid #10b981', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: refreshing ? 0.5 : 1 }}
        >
          {refreshing ? '⏳' : '🔄 새로고침'}
        </button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            <p>뉴스 불러오는 중...</p>
          </div>
        ) : newsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            <p style={{ fontSize: 40 }}>📡</p>
            <p>아직 뉴스가 없습니다.</p>
            <p style={{ fontSize: 12 }}>새로고침 버튼을 눌러주세요.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {newsList.map((news, idx) => (
              <div
                key={news.rank}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  border: `2px solid ${rankColors[idx] || '#1A3C6E'}`,
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ backgroundColor: rankColors[idx] || '#1A3C6E', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    🔥 {rankLabels[idx]}
                  </span>
                  <span style={{ backgroundColor: '#f0f0f0', color: '#555', borderRadius: 20, padding: '3px 10px', fontSize: 11 }}>
                    {news.category}
                  </span>
                </div>
                <p style={{ fontSize: 16, fontWeight: 800, color: rankColors[idx] || '#1A3C6E', lineHeight: 1.5, margin: '0 0 12px' }}>{news.title}</p>
                <p style={{ fontSize: 13, color: '#444', lineHeight: 1.9, margin: '0 0 12px' }}>{news.summary}</p>
                <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: 10 }}>
                  <p style={{ fontSize: 11, color: '#999', margin: '0 0 4px' }}>원문</p>
                  <p style={{ fontSize: 11, color: '#666', fontStyle: 'italic', margin: '0 0 10px' }}>{news.originalTitle}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {news.link && (
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-block', backgroundColor: '#EDE9F5', color: '#1A3C6E', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                      >
                        📰 원문 보기
                      </a>
                    )}
                    <p style={{ fontSize: 10, color: '#ccc', margin: 0 }}>{formatTime(news.updatedAt?.seconds)}</p>
                  </div>
                </div>
              </div>
            ))}
            <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 4 }}>
              30분마다 자동 업데이트 · 출처: Al Jazeera · The Guardian · NYT
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
