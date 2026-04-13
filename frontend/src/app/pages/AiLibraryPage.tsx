import { useEffect, useState, useMemo } from 'react';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

type SourceFilter = string;

const SOURCE_LABELS: Record<string, string> = {
  'claude.ai': 'Claude',
  'gemini.google.com': 'Gemini',
  'chatgpt.com': 'ChatGPT',
};

export function AiLibraryPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<HaruRecord[]>([]);
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // 동적 필터 버튼 생성
  const filterButtons = useMemo(() => {
    const sources = new Set<string>();
    logs.forEach(log => {
      const source = getSource(log);
      if (source) sources.add(source);
    });

    const buttons = [{ value: 'all', label: '전체' }];

    Array.from(sources).sort().forEach(source => {
      const label = SOURCE_LABELS[source] || source;
      buttons.push({ value: source, label });
    });

    return buttons;
  }, [logs]);

  const filtered = logs.filter((r) => {
    const matchTab = filter === 'all' || getSource(r) === filter;
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

  const handleToggleDeleteMode = () => {
    if (deleteMode) {
      setSelectedIds(new Set());
    }
    setDeleteMode(!deleteMode);
  };

  const handleSelectCard = (id: string, e: React.MouseEvent) => {
    if (!deleteMode) return;
    e.stopPropagation();

    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleCardClick = (id: string) => {
    if (deleteMode) return;
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedIds.size}개를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await firestoreService.deleteAiLogs(selectedIds);

      // logs 상태에서 삭제된 항목들 제거
      setLogs(prevLogs => prevLogs.filter(log => !selectedIds.has(log.id)));

      // 삭제 모드 종료 및 선택 초기화
      setDeleteMode(false);
      setSelectedIds(new Set());

      alert('삭제되었습니다.');
    } catch (error) {
      console.error('[handleDeleteSelected] 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto', paddingBottom: '100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1A3C6E', margin: 0 }}>
          AI 학습함
        </h2>
        <button
          onClick={handleToggleDeleteMode}
          style={{
            padding: '6px 12px',
            borderRadius: '16px',
            border: deleteMode ? '1px solid #e24b4a' : '1px solid #1A3C6E',
            background: deleteMode ? '#e24b4a' : '#1A3C6E',
            color: '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {deleteMode ? '취소' : '선택 삭제'}
        </button>
      </div>

      {/* 선택 삭제 모드일 때 선택 바 */}
      {deleteMode && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          marginBottom: '16px',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef',
        }}>
          <span style={{ fontSize: '14px', color: '#555' }}>
            {selectedIds.size}개 선택됨
          </span>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: selectedIds.size > 0 ? '#e24b4a' : '#ccc',
              color: '#fff',
              fontSize: '12px',
              cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 500,
            }}
          >
            삭제
          </button>
        </div>
      )}

      {/* 필터 버튼 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {filterButtons.map((btn) => (
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
              onClick={() => handleCardClick(log.id)}
              style={{
                border: `1px solid ${deleteMode && selectedIds.has(log.id) ? '#1A3C6E' : '#e5e5e5'}`,
                borderRadius: '10px',
                padding: '14px',
                background: deleteMode && selectedIds.has(log.id) ? '#f8f9ff' : '#fff',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* 삭제 모드일 때 체크박스 */}
              {deleteMode && (
                <div
                  onClick={(e) => handleSelectCard(log.id, e)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    border: `2px solid ${selectedIds.has(log.id) ? '#1A3C6E' : '#ddd'}`,
                    background: selectedIds.has(log.id) ? '#1A3C6E' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {selectedIds.has(log.id) && (
                    <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', paddingRight: deleteMode ? '30px' : '0' }}>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await navigator.clipboard.writeText(log.content || '');
                      alert('복사되었습니다!');
                    } catch {
                      alert('복사에 실패했습니다.');
                    }
                  }}
                  style={{
                    background: 'none', border: '1px solid #ddd',
                    borderRadius: 6, padding: '4px 10px',
                    fontSize: 12, color: '#666',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  📋 복사
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
