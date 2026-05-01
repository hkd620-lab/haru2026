import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { db } from '../config/firebase';
import quotes from '../../data/quotes.json';
import bibleQuotes from '../../data/bible_quotes.json';

type QuoteType = 'classic' | 'bible';

interface QuoteItem {
  text: string;
  original?: string;
  source?: string;
  author?: string;
  occupation?: string;
  reference?: string;
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function hashPath(p: string): number {
  let h = 0;
  for (let i = 0; i < p.length; i++) h = ((h << 5) - h + p.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function TodayQuote() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const location = useLocation();
  const [quoteType, setQuoteType] = useState<QuoteType>('classic');

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const ref = doc(db, `users/${user.uid}/settings/settings`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const t = (snap.data() as { quoteType?: QuoteType }).quoteType;
          if (t === 'bible' || t === 'classic') setQuoteType(t);
        }
      } catch (e) {
        console.error('명언 종류 로딩 실패:', e);
      }
    })();
  }, [user?.uid]);

  const isBible = quoteType === 'bible';
  const list = (isBible ? bibleQuotes : quotes) as QuoteItem[];

  const todayQuote = useMemo(() => {
    if (!Array.isArray(list) || list.length === 0) return null;
    const idx = (getDayOfYear(new Date()) + hashPath(location.pathname)) % list.length;
    return list[idx];
  }, [list, location.pathname]);

  const handleQuoteTypeChange = async (next: QuoteType) => {
    if (next === quoteType) return;
    if (next === 'bible' && !isPremium) {
      toast.error('구독자 전용 기능입니다');
      return;
    }
    setQuoteType(next);
    if (!user?.uid) return;
    try {
      const ref = doc(db, `users/${user.uid}/settings/settings`);
      await setDoc(ref, { quoteType: next }, { merge: true });
    } catch (e) {
      console.error('명언 종류 저장 실패:', e);
      toast.error('저장에 실패했습니다.');
    }
  };

  if (!user || !todayQuote) return null;

  const sourceLabel = isBible
    ? todayQuote.reference
    : todayQuote.author && todayQuote.occupation
      ? `${todayQuote.author} (${todayQuote.occupation})`
      : todayQuote.author ?? todayQuote.source;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 no-print">
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{
          backgroundColor: '#FAF9F6',
          border: '1px solid #e8e5de',
        }}
      >
        {/* 탭 토글 */}
        <div
          className="grid grid-cols-2"
          style={{ borderBottom: '1px solid #e8e5de' }}
        >
          <button
            type="button"
            onClick={() => handleQuoteTypeChange('classic')}
            className="py-2.5 text-xs font-semibold transition-colors active:scale-[0.99] touch-manipulation"
            style={{
              backgroundColor: !isBible ? '#1A3C6E' : 'transparent',
              color: !isBible ? '#fff' : 'rgba(26,60,110,0.55)',
            }}
          >
            💬 동서양 명언
          </button>
          <button
            type="button"
            onClick={() => handleQuoteTypeChange('bible')}
            className="py-2.5 text-xs font-semibold transition-colors active:scale-[0.99] touch-manipulation"
            style={{
              backgroundColor: isBible ? '#1A3C6E' : 'transparent',
              color: isBible ? '#fff' : 'rgba(26,60,110,0.55)',
            }}
          >
            ✝️ 성경 말씀
          </button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-4">
          <p
            className="text-sm leading-relaxed"
            style={{ color: '#1A3C6E', fontWeight: 500 }}
          >
            “{todayQuote.text}”
          </p>
          {todayQuote.original && todayQuote.original !== todayQuote.text && (
            <p
              className="text-xs mt-2 leading-relaxed"
              style={{ color: '#666', fontStyle: 'italic' }}
            >
              <span style={{ fontWeight: 600, marginRight: 4 }}>원문:</span>
              {todayQuote.original}
            </p>
          )}
          {sourceLabel && (
            <p
              className="text-xs mt-2 text-right"
              style={{ color: '#666' }}
            >
              — {sourceLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
