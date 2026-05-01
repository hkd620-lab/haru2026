import { useMemo } from 'react';
import quotes from '../../data/quotes.json';
import bibleQuotes from '../../data/bible_quotes.json';

interface QuoteItem {
  text: string;
  source?: string;
  author?: string;
  reference?: string;
}

interface TodayQuoteProps {
  quoteType?: 'classic' | 'bible' | string;
  pageKey?: number;
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function TodayQuote({ quoteType, pageKey = 0 }: TodayQuoteProps) {
  const isBible = quoteType === 'bible';
  const list = (isBible ? bibleQuotes : quotes) as QuoteItem[];

  const todayQuote = useMemo(() => {
    if (!Array.isArray(list) || list.length === 0) return null;
    const dayOfYear = getDayOfYear(new Date());
    const index = (dayOfYear + pageKey) % list.length;
    return list[index];
  }, [list, pageKey]);

  if (!todayQuote) return null;

  const sourceLabel = todayQuote.source ?? todayQuote.author ?? todayQuote.reference;

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 no-print"
    >
      <div
        className="rounded-xl px-5 py-4 shadow-sm"
        style={{
          backgroundColor: '#FAF9F6',
          border: '1px solid #e8e5de',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontSize: '14px' }}>{isBible ? '✝️' : '💬'}</span>
          <span
            className="text-xs"
            style={{ color: '#888', fontWeight: 600, letterSpacing: '0.04em' }}
          >
            {isBible ? '오늘의 말씀' : '오늘의 명언'}
          </span>
        </div>
        <p
          className="text-sm leading-relaxed"
          style={{ color: '#1A3C6E', fontWeight: 500 }}
        >
          {todayQuote.text}
        </p>
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
  );
}
