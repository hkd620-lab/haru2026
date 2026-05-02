import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { db, storage, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { GrapeAnimation } from '../components/GrapeAnimation';
import { firestoreService } from '../services/firestoreService';

const COLOR_BLUE = '#1A3C6E';
const COLOR_BG = '#FAF9F6';
const COLOR_GREEN = '#10b981';
const COLOR_BORDER = '#e5e5e5';

type TabKey = 'upload' | 'timeline' | 'autobio';
type Source = 'facebook' | 'instagram';

interface SnsRecord {
  id: string;
  source: Source;
  timestamp: number;
  text: string;
  thumbnails?: string[];
}

export function SnsRecordsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();

  const [tab, setTab] = useState<TabKey>('upload');
  const [source, setSource] = useState<Source>('facebook');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [records, setRecords] = useState<SnsRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // 검색 입력값 (draft) — 검색 버튼을 눌러야 applied로 반영
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchFilter, setSearchFilter] = useState<'all' | 'text' | 'photo' | 'video'>('all');
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');
  const [searchSource, setSearchSource] = useState<'all' | 'facebook' | 'instagram'>('all');

  const [appliedSearch, setAppliedSearch] = useState<{
    keyword: string;
    filter: 'all' | 'text' | 'photo' | 'video';
    dateFrom: string;
    dateTo: string;
    source: 'all' | 'facebook' | 'instagram';
  }>({ keyword: '', filter: 'all', dateFrom: '', dateTo: '', source: 'all' });

  const [timelinePage, setTimelinePage] = useState(1);
  const PAGE_SIZE = 10;
  const initialTabSet = useRef(false);

  // 통합자서전 기간 선택
  const [autobioRange, setAutobioRange] = useState<'all' | 'year' | 'custom'>('all');
  const [autobioYear, setAutobioYear] = useState<string>('');
  const [autobioFrom, setAutobioFrom] = useState<string>('');
  const [autobioTo, setAutobioTo] = useState<string>('');

  // 카드별 변환 진행상태
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoadingRecords(true);
      try {
        const colRef = collection(db, 'users', user.uid, 'snsRecords');
        const snap = await getDocs(query(colRef, orderBy('timestamp', 'desc')));
        if (cancelled) return;
        // 중복 제거: 같은 timestamp + 같은 텍스트는 1개만 유지
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
            source: (data.source as Source) || 'facebook',
            timestamp: ts,
            text,
            thumbnails: Array.isArray(data.thumbnails) ? data.thumbnails : [],
          });
        });
        setRecords(list);
        // 첫 진입 시 데이터가 있으면 타임라인 탭으로 자동 전환 (1회만)
        if (!initialTabSet.current) {
          initialTabSet.current = true;
          if (list.length > 0) setTab('timeline');
        }
      } catch (e) {
        console.error('SNS 기록 조회 실패:', e);
      } finally {
        if (!cancelled) setLoadingRecords(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, uploading]);

  useEffect(() => { setTimelinePage(1); }, [appliedSearch, records.length]);

  const handleOpenFacebookDownload = () => {
    window.open('https://accountscenter.facebook.com/info_and_permissions/dyi/', '_blank', 'noopener,noreferrer');
  };

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('ZIP 파일만 업로드할 수 있습니다.');
      return;
    }

    setUploading(true);
    setUploadProgress('ZIP 파일 업로드 중...');
    try {
      const ts = Date.now();
      const storagePath = `users/${user.uid}/snsUploads/${ts}_${file.name}`;
      const ref = storageRef(storage, storagePath);
      await uploadBytes(ref, file);

      setUploadProgress('AI가 게시물을 분석하고 있어요...');
      const callable = httpsCallable(functions, 'analyzeFacebookZip');
      const result = await callable({ storagePath, source });
      const data = result.data as { success?: boolean; count?: number; error?: string };
      if (data?.success) {
        toast.success(`분석 완료: ${data.count ?? 0}개 게시물이 정리되었어요.`);
        setTab('timeline');
      } else {
        toast.error(data?.error || '분석에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('ZIP 업로드/분석 실패:', err);
      toast.error(err?.message || '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setUploadProgress('');
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

  const filteredRecords = useMemo(() => {
    const kw = appliedSearch.keyword.trim().toLowerCase();
    const fromMs = appliedSearch.dateFrom ? new Date(appliedSearch.dateFrom + 'T00:00:00').getTime() : 0;
    const toMs = appliedSearch.dateTo ? new Date(appliedSearch.dateTo + 'T23:59:59').getTime() : 0;
    return records.filter((r) => {
      if (appliedSearch.source !== 'all' && r.source !== appliedSearch.source) return false;
      const hasPhoto = (r.thumbnails?.length ?? 0) > 0;
      if (appliedSearch.filter === 'text' && hasPhoto) return false;
      if (appliedSearch.filter === 'photo' && !hasPhoto) return false;
      if (appliedSearch.filter === 'video') return false;
      const tsMs = r.timestamp * (r.timestamp < 1e12 ? 1000 : 1);
      if (fromMs && tsMs < fromMs) return false;
      if (toMs && tsMs > toMs) return false;
      if (kw && !r.text.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [records, appliedSearch]);

  const handleApplySearch = () => {
    setAppliedSearch({
      keyword: searchKeyword,
      filter: searchFilter,
      dateFrom: searchDateFrom,
      dateTo: searchDateTo,
      source: searchSource,
    });
  };

  const formatDate = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts * (ts < 1e12 ? 1000 : 1));
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const tsToDateString = (ts: number): string => {
    if (!ts) return new Date().toISOString().slice(0, 10);
    const d = new Date(ts * (ts < 1e12 ? 1000 : 1));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleConvertToDiary = async (record: SnsRecord) => {
    if (!requirePremium('AI 일기로 변환')) return;
    if (!user) return;
    if (!record.text || record.text.trim().length === 0) {
      toast.error('변환할 텍스트가 없습니다.');
      return;
    }
    setConvertingId(record.id);
    try {
      const callable = httpsCallable(functions, 'convertSnsToDiary');
      const res = await callable({
        text: record.text,
        source: record.source,
        timestamp: record.timestamp,
      });
      const { diaryText } = (res.data || {}) as { diaryText?: string };
      if (!diaryText) {
        toast.error('AI 변환 결과가 비어있습니다.');
        return;
      }
      const dateStr = tsToDateString(record.timestamp);
      await firestoreService.saveRecord(user.uid, {
        date: dateStr,
        formats: ['일기'],
        content: '',
        diary_오늘한일: diaryText,
        source: record.source,
      } as any);
      toast.success('일기로 저장되었습니다');
    } catch (err: any) {
      console.error('AI 일기 변환 실패:', err);
      toast.error(err?.message || 'AI 변환에 실패했습니다.');
    } finally {
      setConvertingId(null);
    }
  };

  const handleSayuPolish = (record: SnsRecord) => {
    if (!requirePremium('SAYU 다듬기')) return;
    navigate('/sayu', { state: { snsText: record.text, snsSource: record.source, snsTimestamp: record.timestamp } });
  };

  const handleAutobioGenerate = () => {
    if (!requirePremium('나의 이야기 시놉시스 생성')) return;
    toast.info('준비 중입니다');
  };

  if (authLoading || subLoading) {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 56px - 80px)',
          background: COLOR_BG,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px',
        }}
      >
        <div style={{ width: 240, height: 320 }}>
          <GrapeAnimation />
        </div>
        <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: COLOR_BLUE }}>
          SNS 기록 페이지 준비 중...
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 56px - 80px)', background: COLOR_BG, padding: '20px 16px 32px' }}>
      {(uploading || convertingId) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(250, 249, 246, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 280, height: 360 }}>
            <GrapeAnimation />
          </div>
          <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: COLOR_BLUE }}>
            {uploading
              ? (uploadProgress || '처리 중...')
              : 'AI가 일기로 변환 중...'}
          </p>
        </div>
      )}
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: COLOR_BLUE, letterSpacing: '-0.01em' }}>
            📱 snsHARU보기
          </h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
            Facebook · Instagram 기록을 AI로 정리해드려요.
          </p>
        </div>

        {/* 탭 헤더 (3개) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 6,
            marginBottom: 18,
          }}
        >
          {([
            { k: 'upload', label: '업로드' },
            { k: 'timeline', label: '타임라인' },
            { k: 'autobio', label: '통합자서전생성' },
          ] as { k: TabKey; label: string }[]).map((t) => {
            const active = tab === t.k;
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => setTab(t.k)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border: `1px solid ${active ? COLOR_BLUE : COLOR_BORDER}`,
                  background: active ? COLOR_BLUE : '#fff',
                  color: active ? '#fff' : COLOR_BLUE,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* === 탭1: 업로드 === */}
        {tab === 'upload' && (
          <section>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['facebook', 'instagram'] as Source[]).map((s) => {
                const active = source === s;
                const disabled = s === 'instagram';
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setSource(s)}
                    style={{
                      flex: 1,
                      padding: '12px 10px',
                      borderRadius: 10,
                      border: `1px solid ${active ? COLOR_GREEN : COLOR_BORDER}`,
                      background: active ? COLOR_GREEN : '#fff',
                      color: active ? '#fff' : disabled ? '#bbb' : COLOR_BLUE,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {s === 'facebook' ? 'Facebook' : 'Instagram (준비중)'}
                  </button>
                );
              })}
            </div>

            {source === 'facebook' && (
              <>
                {/* STEP 1 */}
                <div style={stepBoxStyle}>
                  <div style={stepHeaderStyle}>
                    <span style={stepBadgeStyle}>STEP 1</span>
                    <span style={{ fontWeight: 600, color: COLOR_BLUE }}>Facebook 다운로드 신청하기</span>
                  </div>
                  <p style={stepDescStyle}>
                    아래 버튼을 누르면 Facebook 다운로드 페이지가 새 탭에서 열려요.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenFacebookDownload}
                    style={{
                      width: '100%',
                      marginTop: 10,
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: 'none',
                      background: COLOR_GREEN,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Facebook 다운로드 신청하기 ↗
                  </button>
                  <p style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
                    💡 모든 기기(아이폰·안드로이드·맥북·윈도우즈)에서 동작합니다.
                  </p>
                </div>

                {/* STEP 2 */}
                <div style={stepBoxStyle}>
                  <div style={stepHeaderStyle}>
                    <span style={stepBadgeStyle}>STEP 2</span>
                    <span style={{ fontWeight: 600, color: COLOR_BLUE }}>신청 시 주의사항</span>
                  </div>
                  <ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'none', fontSize: 13, color: '#444', lineHeight: 1.7 }}>
                    <li>📁 파일 형식: <b>JSON</b> 선택 필수</li>
                    <li>⏱ 준비 완료 이메일 수신까지 1~2시간 소요</li>
                    <li>📅 준비된 파일은 <b>4일 안에</b> 다운로드하세요</li>
                    <li>💻 다운로드·업로드는 <b>노트북/PC</b>를 권장합니다</li>
                  </ul>
                </div>

                {/* STEP 3 */}
                <div style={stepBoxStyle}>
                  <div style={stepHeaderStyle}>
                    <span style={stepBadgeStyle}>STEP 3</span>
                    <span style={{ fontWeight: 600, color: COLOR_BLUE }}>ZIP 파일 업로드</span>
                  </div>
                  <p style={stepDescStyle}>
                    다운로드한 ZIP 파일을 그대로 올려주세요. 압축을 풀 필요 없어요.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={handleFilePick}
                    style={{
                      width: '100%',
                      marginTop: 10,
                      padding: '14px 14px',
                      borderRadius: 10,
                      border: `1.5px dashed ${COLOR_GREEN}`,
                      background: '#fff',
                      color: COLOR_BLUE,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: uploading ? 'wait' : 'pointer',
                    }}
                  >
                    {uploading ? '처리 중...' : '📦 ZIP 파일 선택하기'}
                  </button>
                  <p style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
                    업로드 후 자동으로 분석이 시작돼요. 잠시만 기다려주세요.
                  </p>
                </div>
              </>
            )}
          </section>
        )}

        {/* === 탭2: 타임라인 (검색/필터 통합) === */}
        {tab === 'timeline' && (
          <section>
            {/* 키워드 검색창 */}
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="키워드로 검색"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: `1px solid ${COLOR_BORDER}`,
                fontSize: 14,
                marginBottom: 8,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* 날짜 범위 */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', margin: '8px 0 6px' }}>
              날짜 범위
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6, marginBottom: 10 }}>
              <input
                type="date"
                value={searchDateFrom}
                onChange={(e) => setSearchDateFrom(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${COLOR_BORDER}`,
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="date"
                value={searchDateTo}
                onChange={(e) => setSearchDateTo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${COLOR_BORDER}`,
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 출처 필터 */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', margin: '8px 0 6px' }}>
              출처
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {([
                { k: 'all', label: '전체' },
                { k: 'facebook', label: '📘 Facebook' },
                { k: 'instagram', label: '📷 Instagram' },
              ] as { k: typeof searchSource; label: string }[]).map((c) => {
                const active = searchSource === c.k;
                return (
                  <button
                    key={c.k}
                    type="button"
                    onClick={() => setSearchSource(c.k)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: `1px solid ${active ? COLOR_BLUE : COLOR_BORDER}`,
                      background: active ? COLOR_BLUE : '#fff',
                      color: active ? '#fff' : COLOR_BLUE,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* 타입 필터 */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', margin: '8px 0 6px' }}>
              타입
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {([
                { k: 'all', label: '전체' },
                { k: 'text', label: '글만' },
                { k: 'photo', label: '사진' },
                { k: 'video', label: '영상' },
              ] as { k: typeof searchFilter; label: string }[]).map((c) => {
                const active = searchFilter === c.k;
                return (
                  <button
                    key={c.k}
                    type="button"
                    onClick={() => setSearchFilter(c.k)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: `1px solid ${active ? COLOR_BLUE : COLOR_BORDER}`,
                      background: active ? COLOR_BLUE : '#fff',
                      color: active ? '#fff' : COLOR_BLUE,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* 검색 버튼 */}
            <button
              type="button"
              onClick={handleApplySearch}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: 'none',
                background: COLOR_BLUE,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: 14,
              }}
            >
              🔎 검색하기
            </button>

            {/* 검색 결과 건수 */}
            <p style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
              검색 결과: <b>{filteredRecords.length}</b>건
            </p>

            {loadingRecords ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
                <div style={{ width: 200, height: 260 }}>
                  <GrapeAnimation />
                </div>
                <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>SNS 기록을 불러오는 중...</p>
              </div>
            ) : records.length === 0 ? (
              <EmptyState message="아직 가져온 SNS 기록이 없어요." subMessage="업로드 탭에서 ZIP을 올려주세요." />
            ) : filteredRecords.length === 0 ? (
              <EmptyState message="검색 결과가 없어요." />
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredRecords.slice((timelinePage - 1) * PAGE_SIZE, timelinePage * PAGE_SIZE).map((r) => (
                    <PostCard
                      key={r.id}
                      record={r}
                      formatDate={formatDate}
                      isPremium={isPremium}
                      onConvert={() => handleConvertToDiary(r)}
                      onSayu={() => handleSayuPolish(r)}
                    />
                  ))}
                </div>
                <Pagination
                  page={timelinePage}
                  totalPages={Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))}
                  onChange={setTimelinePage}
                />
              </>
            )}
          </section>
        )}

        {/* === 탭3: 통합자서전생성 === */}
        {tab === 'autobio' && (
          <section>
            <div
              style={{
                background: '#fff',
                border: `1px solid ${COLOR_BORDER}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6, margin: 0 }}>
                기간별 전체 기록으로 나의 이야기를 생성합니다
              </p>
            </div>

            {/* 기간 선택 */}
            <div style={{ fontSize: 12, fontWeight: 700, color: COLOR_BLUE, margin: '6px 0 8px' }}>
              기간 선택
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {([
                { k: 'all', label: '전체 기간' },
                { k: 'year', label: '연도별' },
                { k: 'custom', label: '직접설정' },
              ] as { k: typeof autobioRange; label: string }[]).map((c) => {
                const active = autobioRange === c.k;
                return (
                  <button
                    key={c.k}
                    type="button"
                    onClick={() => setAutobioRange(c.k)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: `1px solid ${active ? COLOR_BLUE : COLOR_BORDER}`,
                      background: active ? COLOR_BLUE : '#fff',
                      color: active ? '#fff' : COLOR_BLUE,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {autobioRange === 'year' && (
              <input
                type="number"
                placeholder="예: 2024"
                value={autobioYear}
                onChange={(e) => setAutobioYear(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${COLOR_BORDER}`,
                  fontSize: 13,
                  outline: 'none',
                  marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />
            )}

            {autobioRange === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6, marginBottom: 10 }}>
                <input
                  type="date"
                  value={autobioFrom}
                  onChange={(e) => setAutobioFrom(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${COLOR_BORDER}`,
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <input
                  type="date"
                  value={autobioTo}
                  onChange={(e) => setAutobioTo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${COLOR_BORDER}`,
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* 시놉시스 생성 버튼 */}
            <button
              type="button"
              onClick={handleAutobioGenerate}
              style={{
                width: '100%',
                padding: '14px 14px',
                borderRadius: 10,
                border: 'none',
                background: COLOR_BLUE,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: 6,
                marginBottom: 12,
              }}
            >
              📖 나의 이야기 시놉시스 생성
            </button>

            {/* 안내 문구 */}
            <p style={{ fontSize: 12, color: '#666', lineHeight: 1.6, margin: 0 }}>
              생성된 나의 이야기는 나도작가 SNS 작품 섹션에 저장됩니다
            </p>
          </section>
        )}
      </div>

    </div>
  );
}

// === Sub-components ===

function PostCard({
  record,
  formatDate,
  isPremium,
  onConvert,
  onSayu,
}: {
  record: SnsRecord;
  formatDate: (ts: number) => string;
  isPremium: boolean;
  onConvert: () => void;
  onSayu: () => void;
}) {
  const lines = record.text.split('\n').slice(0, 3).join('\n');
  const truncated = record.text.length > 140 ? record.text.slice(0, 140) + '…' : lines;
  const thumbs = (record.thumbnails || []).slice(0, 3);
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
        {formatDate(record.timestamp)} · {record.source === 'facebook' ? 'Facebook' : 'Instagram'}
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
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button type="button" onClick={onConvert} style={smallBtnStyle(isPremium)}>
          ✏️ AI 일기로 변환 {!isPremium && '🔒'}
        </button>
        <button type="button" onClick={onSayu} style={smallBtnStyle(isPremium)}>
          ✨ SAYU 다듬기 {!isPremium && '🔒'}
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
  if (totalPages <= 1) return null;
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 16,
      }}
    >
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => canPrev && onChange(page - 1)}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: `1px solid ${COLOR_BORDER}`,
          background: '#fff',
          color: canPrev ? COLOR_BLUE : '#bbb',
          fontSize: 13,
          fontWeight: 600,
          cursor: canPrev ? 'pointer' : 'not-allowed',
        }}
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
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: `1px solid ${COLOR_BORDER}`,
          background: '#fff',
          color: canNext ? COLOR_BLUE : '#bbb',
          fontSize: 13,
          fontWeight: 600,
          cursor: canNext ? 'pointer' : 'not-allowed',
        }}
      >
        다음 →
      </button>
    </div>
  );
}

function EmptyState({ message, subMessage }: { message: string; subMessage?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#888' }}>
      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: subMessage ? 6 : 0 }}>{message}</p>
      {subMessage && <p style={{ fontSize: 12 }}>{subMessage}</p>}
    </div>
  );
}

const stepBoxStyle: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${COLOR_BORDER}`,
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
};

const stepHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
};

const stepBadgeStyle: React.CSSProperties = {
  background: COLOR_GREEN,
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 999,
  letterSpacing: '0.04em',
};

const stepDescStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#444',
  margin: '6px 0 0 0',
  lineHeight: 1.5,
};

const smallBtnStyle = (premium: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '8px 10px',
  borderRadius: 8,
  border: `1px solid ${COLOR_BORDER}`,
  background: '#fff',
  color: premium ? COLOR_BLUE : '#888',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
});

export default SnsRecordsPage;
