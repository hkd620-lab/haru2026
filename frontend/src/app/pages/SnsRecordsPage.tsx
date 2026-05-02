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

const COLOR_BLUE = '#1A3C6E';
const COLOR_BG = '#FAF9F6';
const COLOR_GREEN = '#10b981';
const COLOR_BORDER = '#e5e5e5';

type TabKey = 'upload' | 'timeline' | 'search' | 'ai';
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

  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchFilter, setSearchFilter] = useState<'all' | 'text' | 'photo' | 'video' | 'year'>('all');

  const [selectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoadingRecords(true);
      try {
        const colRef = collection(db, 'users', user.uid, 'snsRecords');
        const snap = await getDocs(query(colRef, orderBy('timestamp', 'desc')));
        if (cancelled) return;
        const list: SnsRecord[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            source: (data.source as Source) || 'facebook',
            timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
            text: data.text || '',
            thumbnails: Array.isArray(data.thumbnails) ? data.thumbnails : [],
          };
        });
        setRecords(list);
      } catch (e) {
        console.error('SNS 기록 조회 실패:', e);
      } finally {
        if (!cancelled) setLoadingRecords(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, uploading]);

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
    const kw = searchKeyword.trim().toLowerCase();
    return records.filter((r) => {
      if (searchFilter === 'text' && (r.thumbnails?.length ?? 0) > 0) return false;
      if (searchFilter === 'photo' && (r.thumbnails?.length ?? 0) === 0) return false;
      if (searchFilter === 'video') return false;
      if (kw && !r.text.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [records, searchKeyword, searchFilter]);

  const formatDate = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts * (ts < 1e12 ? 1000 : 1));
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: COLOR_BLUE, letterSpacing: '-0.01em' }}>
            📱 SNS 기록 가져오기
          </h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
            Facebook · Instagram 기록을 AI로 정리해드려요.
          </p>
        </div>

        {/* 탭 헤더 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 6,
            marginBottom: 18,
          }}
        >
          {([
            { k: 'upload', label: '업로드' },
            { k: 'timeline', label: '타임라인' },
            { k: 'search', label: '검색' },
            { k: 'ai', label: 'AI정리' },
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
                    {uploading ? `⏳ ${uploadProgress || '처리 중...'}` : '📦 ZIP 파일 선택하기'}
                  </button>
                  <p style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
                    업로드 후 자동으로 분석이 시작돼요. 잠시만 기다려주세요.
                  </p>
                </div>
              </>
            )}
          </section>
        )}

        {/* === 탭2: 타임라인 === */}
        {tab === 'timeline' && (
          <section>
            {loadingRecords ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
                <div style={{ width: 200, height: 260 }}>
                  <GrapeAnimation />
                </div>
                <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>SNS 기록을 불러오는 중...</p>
              </div>
            ) : records.length === 0 ? (
              <EmptyState message="아직 가져온 SNS 기록이 없어요." subMessage="업로드 탭에서 ZIP을 올려주세요." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {records.map((r) => (
                  <PostCard
                    key={r.id}
                    record={r}
                    formatDate={formatDate}
                    isPremium={isPremium}
                    onConvert={() => requirePremium('AI 일기로 변환')}
                    onSayu={() => requirePremium('SAYU 다듬기')}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* === 탭3: 검색 === */}
        {tab === 'search' && (
          <section>
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
                marginBottom: 12,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {([
                { k: 'all', label: '전체' },
                { k: 'text', label: '글만' },
                { k: 'photo', label: '사진' },
                { k: 'video', label: '영상' },
                { k: 'year', label: '연도별' },
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
            {filteredRecords.length === 0 ? (
              <EmptyState message="검색 결과가 없어요." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredRecords.map((r) => (
                  <PostCard
                    key={r.id}
                    record={r}
                    formatDate={formatDate}
                    isPremium={isPremium}
                    onConvert={() => requirePremium('AI 일기로 변환')}
                    onSayu={() => requirePremium('SAYU 다듬기')}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* === 탭4: AI정리 === */}
        {tab === 'ai' && (
          <section>
            <div style={aiCardStyle}>
              <div style={aiCardHeaderStyle}>
                <span style={{ fontSize: 22 }}>📝</span>
                <span style={{ fontWeight: 700, color: COLOR_BLUE }}>AI 일기로 변환</span>
                {!isPremium && <PremiumPill />}
              </div>
              <p style={{ fontSize: 13, color: '#444', marginTop: 6, lineHeight: 1.5 }}>
                선택한 게시물들을 HARU 일기 형식으로 자동 변환해요.
              </p>
              <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                선택된 게시물: {selectedIds.size}개 (타임라인/검색 탭에서 카드를 길게 눌러 선택)
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!requirePremium('AI 일기로 변환')) return;
                  if (selectedIds.size === 0) {
                    toast.info('변환할 게시물을 먼저 선택해주세요.');
                    return;
                  }
                  toast.info('AI 일기 변환은 곧 활성화됩니다.');
                }}
                style={primaryBtnStyle}
              >
                일기로 변환하기
              </button>
            </div>

            <div style={aiCardStyle}>
              <div style={aiCardHeaderStyle}>
                <span style={{ fontSize: 22 }}>📚</span>
                <span style={{ fontWeight: 700, color: COLOR_BLUE }}>AI 자서전 생성</span>
                {!isPremium && <PremiumPill />}
              </div>
              <p style={{ fontSize: 13, color: '#444', marginTop: 6, lineHeight: 1.5 }}>
                전체 SNS 기록을 시간순으로 엮어 한 권의 자서전으로 만들어드려요.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!requirePremium('AI 자서전 생성')) return;
                  toast.info('AI 자서전 생성은 곧 활성화됩니다.');
                }}
                style={primaryBtnStyle}
              >
                자서전 생성 시작
              </button>
            </div>
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

function EmptyState({ message, subMessage }: { message: string; subMessage?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#888' }}>
      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: subMessage ? 6 : 0 }}>{message}</p>
      {subMessage && <p style={{ fontSize: 12 }}>{subMessage}</p>}
    </div>
  );
}

function PremiumPill() {
  return (
    <span style={{
      marginLeft: 'auto',
      background: '#fff7e6',
      color: '#b76e00',
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 999,
      border: '1px solid #ffd591',
    }}>
      구독 전용
    </span>
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

const aiCardStyle: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${COLOR_BORDER}`,
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
};

const aiCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 12,
  padding: '12px 14px',
  borderRadius: 10,
  border: 'none',
  background: COLOR_BLUE,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
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
