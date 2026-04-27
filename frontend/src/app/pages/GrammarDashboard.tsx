import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

interface CacheItem {
  verseKey: string;
  verifiedByGPT: boolean;
  gptChanges: string[];
  createdAt: any;
}

export default function GrammarDashboard({ uid }: { uid: string }) {
  const [items, setItems] = useState<CacheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CacheItem | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);

  useEffect(() => {
    if (uid !== ADMIN_UID) return;
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'grammarCache'));
      const data: CacheItem[] = snap.docs.map(doc => ({
        verseKey: doc.id,
        verifiedByGPT: doc.data().verifiedByGPT || false,
        gptChanges: doc.data().gptChanges || [],
        createdAt: doc.data().createdAt,
      }));
      data.sort((a, b) => a.verseKey.localeCompare(b.verseKey));
      setItems(data);
      setLoading(false);
    };
    fetch();
  }, [uid]);

  if (uid !== ADMIN_UID) return null;

  const CHAPTER_VERSES: Record<number, number> = {
    1:31,2:25,3:24,4:26,5:32,6:22,7:24,8:22,9:29,10:32,
    11:32,12:20,13:18,14:24,15:21,16:16,17:27,18:33,19:38,20:18,
    21:34,22:24,23:20,24:67,25:34,26:35,27:46,28:22,29:35,30:43,
    31:55,32:32,33:20,34:31,35:29,36:43,37:36,38:30,39:23,40:23,
    41:57,42:38,43:34,44:34,45:28,46:34,47:31,48:22,49:33,50:26
  };
  const totalVerses = CHAPTER_VERSES[selectedChapter] ?? 0;
  const verses = Array.from({ length: totalVerses }, (_, i) => `genesis_${selectedChapter}_${i + 1}`);
  const chapterItems = items.filter(item => verses.includes(item.verseKey));
  const corrected = chapterItems.filter(i => i.gptChanges.length > 0);
  const clean = chapterItems.filter(i => i.gptChanges.length === 0);

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', marginBottom: collapsed ? 0 : 16
        }}
      >
        <h2 style={{ color: '#1A3C6E', fontSize: 20, fontWeight: 700, margin: 0 }}>
          📊 문법 검증 대시보드
        </h2>
        <span style={{ fontSize: 20, color: '#1A3C6E' }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </div>

      {collapsed && (
        <p style={{ fontSize: 13, color: '#888', margin: '8px 0 0 0' }}>
          탭하여 펼치기
        </p>
      )}

      {!collapsed && (
      <>

      {/* 장 선택 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {Array.from({ length: 50 }, (_, i) => i + 1).map((ch) => (
          <button
            key={ch}
            onClick={() => setSelectedChapter(ch)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              background: selectedChapter === ch ? '#1A3C6E' : '#e5e7eb',
              color: selectedChapter === ch ? '#fff' : '#374151',
              fontWeight: selectedChapter === ch ? 700 : 400,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {ch}장
          </button>
        ))}
      </div>

      {/* 요약 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 12, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>{chapterItems.length}</div>
          <div style={{ fontSize: 13, color: '#666' }}>전체 절</div>
        </div>
        <div style={{ flex: 1, background: '#fef9c3', borderRadius: 12, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{corrected.length}</div>
          <div style={{ fontSize: 13, color: '#666' }}>GPT 수정</div>
        </div>
        <div style={{ flex: 1, background: '#eff6ff', borderRadius: 12, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1A3C6E' }}>{clean.length}</div>
          <div style={{ fontSize: 13, color: '#666' }}>수정 없음</div>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#888' }}>로딩 중...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chapterItems.map(item => (
            <div
              key={item.verseKey}
              onClick={() => setSelected(selected?.verseKey === item.verseKey ? null : item)}
              style={{
                background: item.gptChanges.length > 0 ? '#fffbeb' : '#f8fafc',
                border: `1px solid ${item.gptChanges.length > 0 ? '#fcd34d' : '#e2e8f0'}`,
                borderRadius: 10,
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>
                  {item.gptChanges.length > 0 ? '⚠️' : '✅'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3C6E' }}>
                  {item.verseKey.replace('genesis_', '창세기 ').replace('_', ':').replace(/_/g, '')}
                </span>
              </div>
              <span style={{
                fontSize: 12,
                background: item.gptChanges.length > 0 ? '#fcd34d' : '#d1fae5',
                color: item.gptChanges.length > 0 ? '#92400e' : '#065f46',
                borderRadius: 20,
                padding: '2px 10px',
                fontWeight: 600,
              }}>
                {item.gptChanges.length > 0 ? `수정 ${item.gptChanges.length}건` : '수정 없음'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 수정 내역 상세 팝업 */}
      {selected && selected.gptChanges.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 24,
            maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ color: '#1A3C6E', fontSize: 16, fontWeight: 700 }}>
                📝 GPT 수정 내역
              </h3>
              <button onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              {selected.verseKey.replace('genesis_', '창세기 ').replace('_', ':').replace(/_/g, '')}
            </p>
            {selected.gptChanges.map((change, i) => (
              <div key={i} style={{
                background: '#fffbeb', border: '1px solid #fcd34d',
                borderRadius: 8, padding: 12, marginBottom: 8,
                fontSize: 13, color: '#333', lineHeight: 1.6,
              }}>
                {i + 1}. {change}
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
