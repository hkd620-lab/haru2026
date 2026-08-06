import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

type PendingStatute = {
  title?: string;
  article?: string;
  easySummary?: string;
};

type PendingCard = {
  cardId: string;
  title: string;
  anonymizedQuestion: string;
  summary: string;
  judgmentType: string;
  relatedStatutes: PendingStatute[];
  disclaimer: string;
  sourceRecordDate: string;
  requestedAtMs: number;
};

const JUDGMENT_LABELS: Record<string, string> = {
  possible: '가능성 있음',
  caution: '주의 필요',
  need_check: '추가 확인 필요',
};

export function AdminHaruLawReviewPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isDeveloper = user?.uid === DEVELOPER_UID;

  const [items, setItems] = useState<PendingCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [actingId, setActingId] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const loadPending = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const callable = httpsCallable<Record<string, never>, { items: PendingCard[] }>(
        functions,
        'listPendingHaruLawSharedCards',
      );
      const res = await callable({});
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (error) {
      console.error('하루LAW 검수 대기 목록 불러오기 실패:', error);
      setErrorMessage('검수 대기 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 인증 확인이 끝나기 전에 리다이렉트하면 로그인한 관리자도 튕기므로 authLoading을 먼저 기다린다.
  useEffect(() => {
    if (authLoading) return;
    if (!isDeveloper) {
      navigate('/');
      return;
    }
    loadPending();
  }, [authLoading, isDeveloper, navigate, loadPending]);

  if (authLoading || !isDeveloper) return null;

  const handleReview = async (cardId: string, action: 'approve' | 'reject') => {
    const reason = (reasons[cardId] || '').trim();
    if (action === 'reject' && !reason) {
      toast.error('반려 사유를 입력해 주세요.');
      return;
    }
    if (action === 'approve' && !window.confirm('이 글을 승인하면 SAYU·함께보기에 공개됩니다. 개인정보가 남아있지 않은지 확인하셨나요?')) {
      return;
    }

    setActingId(cardId);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const callable = httpsCallable(functions, 'reviewHaruLawSharedCard');
      await callable({ cardId, action, reason });
      toast.success(action === 'approve' ? '승인했습니다. 함께보기에 공개됩니다.' : '반려 처리했습니다.');
      setItems((prev) => prev.filter((item) => item.cardId !== cardId));
      setReasons((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
    } catch (error) {
      console.error('하루LAW 검수 처리 실패:', error);
      toast.error('검수 처리에 실패했습니다.');
    } finally {
      setActingId('');
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF9F6', padding: '20px 16px 80px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A3C6E', margin: '0 0 4px' }}>⚖️ 하루LAW 익명 공유 검수</h1>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              승인하면 SAYU·함께보기에 공개됩니다. 개인정보가 남아있으면 반려하세요.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{ padding: '8px 14px', backgroundColor: '#fff', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            닫기
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button
            onClick={loadPending}
            disabled={loading}
            style={{ padding: '7px 13px', backgroundColor: '#1A3C6E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
          <span style={{ fontSize: 12, color: '#6B7280' }}>검수 대기 {items.length}건</span>
        </div>

        {errorMessage && (
          <div style={{ borderRadius: 12, border: '1px solid #FECACA', backgroundColor: '#FEF2F2', padding: 14, marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: '#B42318', margin: 0 }}>{errorMessage}</p>
          </div>
        )}

        {!loading && items.length === 0 && !errorMessage && (
          <div style={{ borderRadius: 12, border: '1px solid #D1FAE5', backgroundColor: '#ECFDF5', padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#0F766E', margin: 0 }}>검수 대기 중인 공유 신청이 없습니다.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((item) => {
            const busy = actingId === item.cardId;
            return (
              <div key={item.cardId} style={{ borderRadius: 14, border: '1px solid #E5E7EB', backgroundColor: '#fff', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#1A3C6E', backgroundColor: '#F0F4FF', borderRadius: 999, padding: '3px 9px' }}>
                    {JUDGMENT_LABELS[item.judgmentType] || item.judgmentType || '미분류'}
                  </span>
                  {item.sourceRecordDate && (
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>기록일 {item.sourceRecordDate}</span>
                  )}
                </div>

                <p style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 10px', lineHeight: 1.5 }}>{item.title}</p>

                <div style={{ borderRadius: 10, backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6', padding: 12, marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', margin: '0 0 6px' }}>익명화된 질문</p>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{item.anonymizedQuestion}</p>
                </div>

                <div style={{ borderRadius: 10, backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6', padding: 12, marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', margin: '0 0 6px' }}>요약</p>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{item.summary}</p>
                </div>

                {item.relatedStatutes.length > 0 && (
                  <div style={{ borderRadius: 10, backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6', padding: 12, marginBottom: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', margin: '0 0 6px' }}>관련 법조문</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {item.relatedStatutes.map((statute, idx) => (
                        <div key={`${item.cardId}_statute_${idx}`}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
                            {[statute.title, statute.article].filter(Boolean).join(' · ')}
                          </p>
                          {statute.easySummary && (
                            <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{statute.easySummary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  value={reasons[item.cardId] || ''}
                  onChange={(e) => setReasons((prev) => ({ ...prev, [item.cardId]: e.target.value }))}
                  placeholder="반려 사유 (반려 시 필수)"
                  style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 16, marginBottom: 10, boxSizing: 'border-box' }}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleReview(item.cardId, 'approve')}
                    disabled={busy}
                    style={{ flex: 1, padding: '10px 14px', backgroundColor: '#065F46', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? '처리 중...' : '승인'}
                  </button>
                  <button
                    onClick={() => handleReview(item.cardId, 'reject')}
                    disabled={busy}
                    style={{ flex: 1, padding: '10px 14px', backgroundColor: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                  >
                    반려
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
