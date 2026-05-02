import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  collection,
  getDocs,
  orderBy,
  query,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { firestoreService } from '../services/firestoreService';
import { GrapeAnimation } from './GrapeAnimation';

const COLOR_BLUE = '#1A3C6E';
const COLOR_GREEN = '#10b981';
const COLOR_BORDER = '#e5e7eb';
const PAGE_SIZE = 10;

type TypeFilter = 'all' | 'text' | 'photo' | 'video';
type SourceFilter = 'all' | 'facebook' | 'instagram';

interface SnsRecord {
  id: string;
  source: 'facebook' | 'instagram';
  timestamp: number;
  text: string;
  thumbnails?: string[];
}

interface SearchCondition {
  keyword: string;
  dateFrom: string;
  dateTo: string;
  typeFilter: TypeFilter;
  sourceFilter: SourceFilter;
}

interface SavedSearch extends SearchCondition {
  id: string;
  label?: string;
}

const EMPTY_COND: SearchCondition = {
  keyword: '',
  dateFrom: '',
  dateTo: '',
  typeFilter: 'all',
  sourceFilter: 'all',
};

export function SnsHaruTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useSubscription();

  const [records, setRecords] = useState<SnsRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  const [draftCond, setDraftCond] = useState<SearchCondition>(EMPTY_COND);
  const [appliedCond, setAppliedCond] = useState<SearchCondition>(EMPTY_COND);
  const [page, setPage] = useState(1);

  const [convertingId, setConvertingId] = useState<string | null>(null);

  // SNS 기록 + 즐겨찾기 로드
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoadingRecords(true);
      try {
        const colRef = collection(db, 'users', user.uid, 'snsRecords');
        const snap = await getDocs(query(colRef, orderBy('timestamp', 'desc')));
        if (cancelled) return;
        const seen = new Set<string>();
        const list: SnsRecord[] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const ts = typeof data.timestamp === 'number' ? data.timestamp : 0;
          const text = data.text || '';
          const key = `${ts}__${text}`;
          if (seen.has(key)) return;
          seen.add(key);
          list.push({
            id: d.id,
            source: (data.source as 'facebook' | 'instagram') || 'facebook',
            timestamp: ts,
            text,
            thumbnails: Array.isArray(data.thumbnails) ? data.thumbnails : [],
          });
        });
        setRecords(list);
      } catch (e) {
        console.error('SNS 기록 조회 실패:', e);
      } finally {
        if (!cancelled) setLoadingRecords(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadSaved = async () => {
      try {
        const colRef = collection(db, 'users', user.uid, 'savedSearches');
        const snap = await getDocs(colRef);
        if (cancelled) return;
        const list: SavedSearch[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            label: data.label || '',
            keyword: data.keyword || '',
            dateFrom: data.dateFrom || '',
            dateTo: data.dateTo || '',
            typeFilter: (data.typeFilter as TypeFilter) || 'all',
            sourceFilter: (data.sourceFilter as SourceFilter) || 'all',
          };
        });
        setSavedSearches(list);
      } catch (e) {
        console.error('저장된 검색 로드 실패:', e);
      }
    };
    loadSaved();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // 검색 조건 적용해 필터링
  const filteredRecords = useMemo(() => {
    const kw = appliedCond.keyword.trim().toLowerCase();
    const fromMs = appliedCond.dateFrom ? new Date(appliedCond.dateFrom + 'T00:00:00').getTime() : 0;
    const toMs = appliedCond.dateTo ? new Date(appliedCond.dateTo + 'T23:59:59').getTime() : 0;
    return records.filter((r) => {
      if (appliedCond.sourceFilter !== 'all' && r.source !== appliedCond.sourceFilter) return false;
      const hasPhoto = (r.thumbnails?.length ?? 0) > 0;
      if (appliedCond.typeFilter === 'text' && hasPhoto) return false;
      if (appliedCond.typeFilter === 'photo' && !hasPhoto) return false;
      if (appliedCond.typeFilter === 'video') return false;
      const tsMs = r.timestamp * (r.timestamp < 1e12 ? 1000 : 1);
      if (fromMs && tsMs < fromMs) return false;
      if (toMs && tsMs > toMs) return false;
      if (kw && !r.text.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [records, appliedCond]);

  useEffect(() => {
    setPage(1);
  }, [appliedCond]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pageRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = () => {
    setAppliedCond(draftCond);
  };

  const handleSaveSearch = async () => {
    if (!user) return;
    if (
      !draftCond.keyword &&
      !draftCond.dateFrom &&
      !draftCond.dateTo &&
      draftCond.typeFilter === 'all' &&
      draftCond.sourceFilter === 'all'
    ) {
      toast.info('저장할 검색 조건이 없어요.');
      return;
    }
    const label = window.prompt('이 검색 조건의 이름을 정해주세요.', draftCond.keyword || '내 검색');
    if (label === null) return;
    try {
      const colRef = collection(db, 'users', user.uid, 'savedSearches');
      const docRef = await addDoc(colRef, {
        ...draftCond,
        label: label.trim() || '내 검색',
        createdAt: serverTimestamp(),
      });
      setSavedSearches((prev) => [
        ...prev,
        { id: docRef.id, ...draftCond, label: label.trim() || '내 검색' },
      ]);
      toast.success('검색 조건이 저장되었습니다.');
    } catch (e: any) {
      console.error('검색 저장 실패:', e);
      toast.error('저장에 실패했습니다.');
    }
  };

  const handleApplySaved = (s: SavedSearch) => {
    const cond: SearchCondition = {
      keyword: s.keyword,
      dateFrom: s.dateFrom,
      dateTo: s.dateTo,
      typeFilter: s.typeFilter,
      sourceFilter: s.sourceFilter,
    };
    setDraftCond(cond);
    setAppliedCond(cond);
  };

  const handleDeleteSaved = async (id: string) => {
    if (!user) return;
    if (!window.confirm('이 즐겨찾기를 삭제할까요?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'savedSearches', id));
      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
      toast.success('삭제되었습니다.');
    } catch (e) {
      console.error('즐겨찾기 삭제 실패:', e);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const requirePremium = (action: string) => {
    if (!isPremium) {
      toast(`'${action}'은(는) 구독 후 이용 가능한 기능입니다.`, {
        action: { label: '구독하기', onClick: () => navigate('/subscription') },
      });
      return false;
    }
    return true;
  };

  const handleConvertToDiary = async (record: SnsRecord) => {
    if (!requirePremium('AI 일기로 변환')) return;
    if (!user) return;
    if (!record.text || record.text.trim().length === 0) {
      toast.info('변환할 텍스트가 없습니다.');
      return;
    }
    setConvertingId(record.id);
    try {
      const callable = httpsCallable(functions, 'convertSnsToDiary');
      const result = await callable({
        text: record.text,
        source: record.source,
        timestamp: record.timestamp,
      });
      const data = result.data as { diaryText?: string };
      const diaryText = data?.diaryText?.trim();
      if (!diaryText) {
        toast.error('AI 변환 결과가 비어있어요.');
        return;
      }
      const date = formatDate(record.timestamp, 'iso');
      await firestoreService.saveRecord(user.uid, {
        date,
        formats: ['diary'] as any,
        diary_action: diaryText,
        content: diaryText,
        source: 'facebook',
        _sns_origin: { id: record.id, timestamp: record.timestamp, text: record.text },
      } as any);
      toast.success('일기로 저장되었습니다');
    } catch (e: any) {
      console.error('AI 일기 변환 실패:', e);
      toast.error(e?.message || 'AI 변환에 실패했습니다.');
    } finally {
      setConvertingId(null);
    }
  };

  const handleSendToProphecy = (record: SnsRecord) => {
    if (!requirePremium('HARU예언으로 보내기')) return;
    const date = formatDate(record.timestamp, 'iso');
    const incomingRecord = {
      id: record.id,
      date,
      content: record.text,
      diary_action: record.text,
      formats: ['diary'],
      source: record.source,
      thumbnails: record.thumbnails || [],
    };
    navigate('/record-prophecy', { state: { incomingRecord, snsPost: record } });
  };

  const handleSavePdf = (_record: SnsRecord) => {
    if (!requirePremium('PDF 저장')) return;
    toast.info('PDF 저장은 곧 활성화됩니다.');
  };

  return (
    <div style={{ padding: '12px', background: '#f9fafb' }}>
      {/* 검색창 */}
      <section style={cardStyle}>
        <div style={sectionTitleStyle}>🔎 SNS 게시물 검색</div>

        <input
          type="text"
          value={draftCond.keyword}
          onChange={(e) => setDraftCond({ ...draftCond, keyword: e.target.value })}
          placeholder="키워드를 입력하세요"
          style={inputStyle}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6, marginTop: 8 }}>
          <input
            type="date"
            value={draftCond.dateFrom}
            onChange={(e) => setDraftCond({ ...draftCond, dateFrom: e.target.value })}
            style={inputStyle}
          />
          <input
            type="date"
            value={draftCond.dateTo}
            onChange={(e) => setDraftCond({ ...draftCond, dateTo: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div style={filterLabelStyle}>타입</div>
        <div style={chipRowStyle}>
          {(
            [
              { k: 'all', label: '전체' },
              { k: 'text', label: '글만' },
              { k: 'photo', label: '사진' },
              { k: 'video', label: '영상' },
            ] as { k: TypeFilter; label: string }[]
          ).map((c) => (
            <ChipButton
              key={c.k}
              label={c.label}
              active={draftCond.typeFilter === c.k}
              onClick={() => setDraftCond({ ...draftCond, typeFilter: c.k })}
            />
          ))}
        </div>

        <div style={filterLabelStyle}>출처</div>
        <div style={chipRowStyle}>
          {(
            [
              { k: 'all', label: '전체' },
              { k: 'facebook', label: '📘 Facebook' },
              { k: 'instagram', label: '📷 Instagram' },
            ] as { k: SourceFilter; label: string }[]
          ).map((c) => (
            <ChipButton
              key={c.k}
              label={c.label}
              active={draftCond.sourceFilter === c.k}
              onClick={() => setDraftCond({ ...draftCond, sourceFilter: c.k })}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button type="button" onClick={handleSearch} style={primaryBtnStyle}>
            검색하기
          </button>
          <button type="button" onClick={handleSaveSearch} style={secondaryBtnStyle}>
            ⭐ 검색 저장
          </button>
        </div>
      </section>

      {/* 저장된 검색 (즐겨찾기) */}
      {savedSearches.length > 0 && (
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>⭐ 저장된 검색</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {savedSearches.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 4px 4px 10px',
                  borderRadius: 999,
                  border: `1px solid ${COLOR_BORDER}`,
                  background: '#fff',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleApplySaved(s)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12,
                    color: COLOR_BLUE,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  {s.label || '내 검색'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSaved(s.id)}
                  aria-label="삭제"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 11,
                    color: '#aaa',
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 검색 결과 */}
      <section>
        <div style={{ ...sectionTitleStyle, marginLeft: 4 }}>
          📋 검색 결과 ({filteredRecords.length}건)
        </div>

        {loadingRecords ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
            <div style={{ width: 200, height: 260 }}>
              <GrapeAnimation />
            </div>
            <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>SNS 기록을 불러오는 중...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 12px', color: '#888', fontSize: 13 }}>
            조건에 맞는 SNS 기록이 없어요.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pageRecords.map((r) => (
                <ResultCard
                  key={r.id}
                  record={r}
                  isPremium={isPremium}
                  converting={convertingId === r.id}
                  onConvert={() => handleConvertToDiary(r)}
                  onProphecy={() => handleSendToProphecy(r)}
                  onPdf={() => handleSavePdf(r)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

// === 보조 컴포넌트 ===

function ChipButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? COLOR_BLUE : COLOR_BORDER}`,
        background: active ? COLOR_BLUE : '#fff',
        color: active ? '#fff' : '#6B7280',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function ResultCard({
  record,
  isPremium,
  converting,
  onConvert,
  onProphecy,
  onPdf,
}: {
  record: SnsRecord;
  isPremium: boolean;
  converting: boolean;
  onConvert: () => void;
  onProphecy: () => void;
  onPdf: () => void;
}) {
  const lines = record.text.split('\n').slice(0, 3).join('\n');
  const truncated = record.text.length > 140 ? record.text.slice(0, 140) + '…' : lines;
  const thumbs = (record.thumbnails || []).slice(0, 3);
  const sourceLabel = record.source === 'facebook' ? '📘 Facebook' : '📷 Instagram';
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${COLOR_BORDER}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
        {formatDate(record.timestamp, 'ko')} · {sourceLabel}
      </div>
      {record.text && (
        <p style={{ fontSize: 14, color: '#222', whiteSpace: 'pre-line', lineHeight: 1.5, margin: 0 }}>
          {truncated}
        </p>
      )}
      {thumbs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {thumbs.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, background: '#eee' }}
            />
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6, marginTop: 12 }}>
        <button type="button" onClick={onConvert} disabled={converting} style={smallBtnStyle(isPremium)}>
          {converting ? '변환 중...' : `✏️ AI 일기${!isPremium ? ' 🔒' : ''}`}
        </button>
        <button type="button" onClick={onProphecy} style={smallBtnStyle(isPremium)}>
          🔮 HARU예언{!isPremium && ' 🔒'}
        </button>
        <button type="button" onClick={onPdf} style={smallBtnStyle(isPremium)}>
          📄 PDF{!isPremium && ' 🔒'}
        </button>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 }}>
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => canPrev && onChange(page - 1)}
        style={pageBtnStyle(canPrev)}
      >
        ← 이전
      </button>
      <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => canNext && onChange(page + 1)}
        style={pageBtnStyle(canNext)}
      >
        다음 →
      </button>
    </div>
  );
}

// === helpers ===
function formatDate(ts: number, mode: 'iso' | 'ko'): string {
  if (!ts) return '';
  const d = new Date(ts * (ts < 1e12 ? 1000 : 1));
  if (mode === 'iso') return d.toISOString().slice(0, 10);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// === styles ===
const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${COLOR_BORDER}`,
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: COLOR_BLUE,
  marginBottom: 10,
  letterSpacing: '0.02em',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${COLOR_BORDER}`,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};
const filterLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: '#6B7280',
  margin: '12px 0 6px',
};
const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};
const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 14px',
  borderRadius: 10,
  border: 'none',
  background: COLOR_BLUE,
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};
const secondaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 14px',
  borderRadius: 10,
  border: `1px solid ${COLOR_GREEN}`,
  background: '#fff',
  color: COLOR_GREEN,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};
const smallBtnStyle = (premium: boolean): React.CSSProperties => ({
  padding: '8px 6px',
  borderRadius: 8,
  border: `1px solid ${COLOR_BORDER}`,
  background: '#fff',
  color: premium ? COLOR_BLUE : '#888',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
});
const pageBtnStyle = (enabled: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 8,
  border: `1px solid ${COLOR_BORDER}`,
  background: '#fff',
  color: enabled ? COLOR_BLUE : '#bbb',
  fontSize: 13,
  fontWeight: 600,
  cursor: enabled ? 'pointer' : 'not-allowed',
});

export default SnsHaruTab;
