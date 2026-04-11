import { useEffect, useState } from 'react';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

type SourceFilter = 'all' | 'claude' | 'gemini' | 'chatgpt';

const SOURCE_LABELS: Record<string, string> = {
  'claude.ai': 'Claude',
  'gemini.google.com': 'Gemini',
  'chatgpt.com': 'ChatGPT',
};

const FILTER_BUTTONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'chatgpt', label: 'ChatGPT' },
];

export function AiLibraryPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<HaruRecord[]>([]);
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    console.log('[AiLibraryPage] user 상태:', user);
    if (!user || !user.email) {
      console.warn('[AiLibraryPage] user 또는 email 없음 — 로그인 필요');
      setLoading(false);
      return;
    }
    console.log('[AiLibraryPage] getAiLogs 호출, email:', user.email);
    firestoreService.getAiLogs(user.email).then((data) => {
      console.log('[AiLibraryPage] 받은 데이터:', data);
      setLogs(data);
      setLoading(false);
    });
  }, [user]);

  const getSource = (r: HaruRecord): string => {
    if (r.source) return r.source;
    const match = r.title?.match(/^\[([^\]]+)\]/);
    return match ? match[1] : '';
  };

  const filtered = logs.filter((r) => {
    const matchTab = filter === 'all' || getSource(r).includes(filter);
    const kw = keyword.trim().toLowerCase();
    const matchKeyword = !kw
      || r.content?.toLowerCase().includes(kw)
      || r.title?.toLowerCase().includes(kw);
    return matchTab && matchKeyword;
  });

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  };

  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto', paddingBottom: '100px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1A3C6E', marginBottom: '16px' }}>
        AI 학습함
      </h2>

      {/* 필터 버튼 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {FILTER_BUTTONS.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setFilter(btn.value)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: filter === btn.value ? '#1A3C6E' : '#ddd',
              background: filter === btn.value ? '#1A3C6E' : '#fff',
              color: filter === btn.value ? '#fff' : '#555',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* 검색창 */}
      <input
        type="text"
        placeholder="키워드 검색 (제목, 내용)"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '8px 12px', marginBottom: '16px',
          border: '1px solid #ddd', borderRadius: '20px',
          fontSize: '13px', outline: 'none',
        }}
      />

      {/* 목록 */}
      {loading ? (
        <p style={{ color: '#999', fontSize: '14px' }}>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#999', fontSize: '14px' }}>저장된 AI 학습 기록이 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((log) => (
            <div
              key={log.id}
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: '10px',
                padding: '14px',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: '#EEF3FB',
                    color: '#1A3C6E',
                    fontWeight: 600,
                  }}
                >
                  {SOURCE_LABELS[log.source] ?? getSource(log)}
                </span>
                <span style={{ fontSize: '11px', color: '#aaa' }}>
                  {formatDate(log.createdAt)}
                </span>
              </div>
              {log.title && (
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#222', marginBottom: '4px' }}>
                  {log.title}
                </p>
              )}
              <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {expandedId === log.id
                  ? log.content
                  : log.content
                    ? log.content.slice(0, 100) + (log.content.length > 100 ? '...' : '')
                    : ''}
              </p>
              {log.content && log.content.length > 100 && (
                <p style={{ fontSize: '11px', color: '#1A3C6E', marginTop: '6px', textAlign: 'right' }}>
                  {expandedId === log.id ? '▲ 접기' : '▼ 전체보기'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
