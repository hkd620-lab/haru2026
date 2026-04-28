import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { BIBLE_BOOKS, BibleBook } from '../../data/bibleBooks';

// Vite glob — 빌드 시점에 경로를 정적 분석하므로 순환 의존 없음
const BIBLE_JSON = import.meta.glob('../../data/*.json');

const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

interface CacheItem {
  verseKey: string;
  verifiedByGPT: boolean;
  gptChanges: string[];
  createdAt: any;
}

function formatVerseKey(verseKey: string): string {
  const book = BIBLE_BOOKS.find(b => verseKey.startsWith(b.prefix + '_'));
  if (!book) return verseKey;
  const rest = verseKey.slice(book.prefix.length + 1);
  const [ch, v] = rest.split('_');
  return `${book.ko} ${ch}:${v}`;
}

export default function GrammarDashboard({ uid }: { uid: string }) {
  const [items, setItems] = useState<CacheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CacheItem | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BibleBook>(BIBLE_BOOKS[0]);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ book: string; chapter: number; total: number; done: number } | null>(null);

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

  const totalChapters = BIBLE_BOOKS.reduce((sum, b) => sum + b.chapters, 0);

  async function handleBulkVerify() {
    if (bulkRunning) return;
    setBulkRunning(true);
    let done = 0;
    const fns = getFunctions(undefined, 'asia-northeast3');
    const fn = httpsCallable(fns, 'preloadChapterGrammar', { timeout: 540000 });
    const cachedKeys = new Set(items.map(i => i.verseKey));
    for (const book of BIBLE_BOOKS) {
      for (let ch = 1; ch <= book.chapters; ch++) {
        setBulkProgress({ book: book.ko, chapter: ch, total: totalChapters, done });
        try {
          const loader = BIBLE_JSON[`../../data/${book.prefix}_${ch}.json`];
          if (!loader) { done++; continue; }
          const mod = await loader() as any;
          const verses: string[] = [];
          const verseTexts: Record<string, string> = {};
          (mod.default.verses as { verse: number; text: string }[]).forEach(v => {
            const key = `${book.prefix}_${ch}_${v.verse}`;
            verses.push(key);
            verseTexts[key] = v.text;
          });
          // 캐시 안 된 절만 추려서 전송
          const uncached = verses.filter(k => !cachedKeys.has(k));
          if (uncached.length > 0) {
            const uncachedTexts: Record<string, string> = {};
            uncached.forEach(k => { uncachedTexts[k] = verseTexts[k]; });
            await fn({ book: book.ko, chapter: ch, verses: uncached, verseTexts: uncachedTexts });
          }
        } catch {
          // 실패한 장은 스킵
        }
        done++;
      }
    }
    setBulkRunning(false);
    setBulkProgress(null);
    // 검증 완료 후 목록 새로고침
    const snap = await getDocs(collection(db, 'grammarCache'));
    const data: CacheItem[] = snap.docs.map(doc => ({
      verseKey: doc.id,
      verifiedByGPT: doc.data().verifiedByGPT || false,
      gptChanges: doc.data().gptChanges || [],
      createdAt: doc.data().createdAt,
    }));
    data.sort((a, b) => a.verseKey.localeCompare(b.verseKey));
    setItems(data);
  }

  const totalVerses = selectedBook.verseCount[selectedChapter] ?? 0;
  const verses = Array.from({ length: totalVerses }, (_, i) => `${selectedBook.prefix}_${selectedChapter}_${i + 1}`);
  const chapterItems = items.filter(item => verses.includes(item.verseKey));
  const corrected = chapterItems.filter(i => i.gptChanges.length > 0);
  const clean = chapterItems.filter(i => i.gptChanges.length === 0);

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}
        >
          <h2 style={{ color: '#1A3C6E', fontSize: 20, fontWeight: 700, margin: 0 }}>
            📊 문법 검증 대시보드
          </h2>
          <span style={{ fontSize: 20, color: '#1A3C6E' }}>{collapsed ? '▼' : '▲'}</span>
        </div>
        <button
          onClick={handleBulkVerify}
          disabled={bulkRunning}
          style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: bulkRunning ? 'default' : 'pointer',
            background: bulkRunning ? '#e5e7eb' : '#10b981', color: '#fff',
            fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          {bulkRunning ? '검증 중...' : '⚡ 전체 검증'}
        </button>
      </div>

      {bulkProgress && (
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: '#065f46', marginBottom: 6 }}>
            {bulkProgress.book} {bulkProgress.chapter}장 검증 중... ({bulkProgress.done}/{bulkProgress.total}장)
          </div>
          <div style={{ background: '#d1fae5', borderRadius: 99, height: 6, overflow: 'hidden' }}>
            <div style={{
              background: '#10b981', height: '100%', borderRadius: 99,
              width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {collapsed && (
        <p style={{ fontSize: 13, color: '#888', margin: '8px 0 0 0' }}>
          탭하여 펼치기
        </p>
      )}

      {!collapsed && (
      <>
      {/* 책 선택 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {BIBLE_BOOKS.map((b) => (
          <button
            key={b.prefix}
            onClick={() => { setSelectedBook(b); setSelectedChapter(1); }}
            style={{
              padding: '4px 12px', borderRadius: '6px', border: 'none',
              background: selectedBook.prefix === b.prefix ? '#1A3C6E' : '#e5e7eb',
              color: selectedBook.prefix === b.prefix ? '#fff' : '#374151',
              fontWeight: selectedBook.prefix === b.prefix ? 700 : 400,
              cursor: 'pointer', fontSize: '13px',
            }}
          >
            {b.ko}
          </button>
        ))}
      </div>

      {/* 장 선택 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((ch) => (
          <button
            key={ch}
            onClick={() => setSelectedChapter(ch)}
            style={{
              padding: '4px 10px', borderRadius: '6px', border: 'none',
              background: selectedChapter === ch ? '#1A3C6E' : '#e5e7eb',
              color: selectedChapter === ch ? '#fff' : '#374151',
              fontWeight: selectedChapter === ch ? 700 : 400,
              cursor: 'pointer', fontSize: '13px',
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
                borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>
                  {item.gptChanges.length > 0 ? '⚠️' : '✅'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3C6E' }}>
                  {formatVerseKey(item.verseKey)}
                </span>
              </div>
              <span style={{
                fontSize: 12,
                background: item.gptChanges.length > 0 ? '#fcd34d' : '#d1fae5',
                color: item.gptChanges.length > 0 ? '#92400e' : '#065f46',
                borderRadius: 20, padding: '2px 10px', fontWeight: 600,
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
              {formatVerseKey(selected.verseKey)}
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
