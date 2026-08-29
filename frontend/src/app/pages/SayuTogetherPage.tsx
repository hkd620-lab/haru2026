import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { HaruRamenSection, TodayChargeSection } from '../components/TodayChargeSection';
import { useAuth } from '../contexts/AuthContext';
import { exportRecordsToEpub } from '../services/epubExportService';
import {
  firestoreService,
  type PublishedBook,
  type PublishedHaruLawCard,
  type SharedRecordComment,
  type SharedRecordListItem,
} from '../services/firestoreService';
import { toast } from 'sonner';

type TogetherTab = 'shared' | 'recovery';
type RecoverySubTab = 'people' | 'todaycharge' | 'ramen' | 'epub';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

type SayuAxis = 'format' | 'agent';

type SayuCategory = { key: string; label: string; count: number };

type SayuCardView = {
  cardKey: string;
  kind: 'record' | 'lawCard';
  title: string;
  meta: string;
  thumbnailUrl: string | null;
  badges: string[];
  formatLabels: string[];
  agentLabel: string;
  record?: SharedRecordListItem;
  lawCard?: PublishedHaruLawCard;
};

const JUDGMENT_LABELS: Record<string, string> = {
  possible: '가능성 있음',
  caution: '주의 필요',
  need_check: '추가 확인 필요',
};

// 비서별 그룹 라벨 — 1단계에서 저장한 sourceAgent 우선, 레거시 문서는 '개인기록' 폴백.
// 확장 지점(2단계): plant_catalog를 같은 방식으로 정규화해 '하루식물탐정' 버킷에 합류시키면 됨.
const resolveAgentLabel = (item: SharedRecordListItem): string => item.sourceAgent ?? '개인기록';

const sayuChipStyle = (active: boolean) => ({
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  border: active ? '1.5px solid #0F766E' : '1px solid #CBD5E1',
  background: active ? '#0F766E' : '#FFFFFF',
  color: active ? '#FFFFFF' : '#475569',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
});

export function SayuTogetherPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TogetherTab>('shared');
  const [recoverySub, setRecoverySub] = useState<RecoverySubTab>('people');
  const [items, setItems] = useState<SharedRecordListItem[]>([]);
  const [publishedBooks, setPublishedBooks] = useState<PublishedBook[]>([]);
  const [lawCards, setLawCards] = useState<PublishedHaruLawCard[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedLawCardId, setSelectedLawCardId] = useState('');
  const [axis, setAxis] = useState<SayuAxis | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [comments, setComments] = useState<SharedRecordComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [booksLoading, setBooksLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [sharedActionId, setSharedActionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [epubStartDate, setEpubStartDate] = useState('');
  const [epubEndDate, setEpubEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [booksErrorMessage, setBooksErrorMessage] = useState('');
  const isDeveloper = user?.uid === DEVELOPER_UID;
  const fromPath = (location.state as any)?.from as string | undefined;

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const loadSharedRecords = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setErrorMessage('');
    try {
      let next = await firestoreService.getSharedRecords();
      const ownRecordsMissingPhotoField = next.filter((item) =>
        item.ownerUid === user.uid &&
        item.sourceRecordId &&
        !Object.prototype.hasOwnProperty.call(item, 'publicPhotoUrls')
      );
      if (ownRecordsMissingPhotoField.length > 0) {
        await Promise.allSettled(
          ownRecordsMissingPhotoField.map((item) =>
            firestoreService.publishRecordToShared(user.uid, item.sourceRecordId),
          ),
        );
        next = await firestoreService.getSharedRecords();
      }
      setItems(next);
      setSelectedId((current) => {
        if (current && next.some((item) => item.id === current)) return current;
        return '';
      });
    } catch (error) {
      console.error('SAYU-함께보기 공개 글 불러오기 실패:', error);
      setErrorMessage('공개된 SAYU 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ⚖️ 승인된 하루LAW 익명 사례 — 실패해도 기존 공개 글 목록에 영향을 주지 않도록 조용히 비운다.
  const loadHaruLawCards = async () => {
    if (!user?.uid) return;
    try {
      setLawCards(await firestoreService.getPublishedHaruLawCards());
    } catch (error) {
      console.error('하루LAW 공개 사례 불러오기 실패:', error);
      setLawCards([]);
    }
  };

  const loadPublishedBooks = async () => {
    if (!user?.uid) return;
    setBooksLoading(true);
    setBooksErrorMessage('');
    try {
      const next = await firestoreService.getPublishedBooks();
      setPublishedBooks(next);
    } catch (error) {
      console.error('사람속으로 발행본 불러오기 실패:', error);
      setBooksErrorMessage('발행중인 사람속으로 책을 불러오지 못했습니다.');
    } finally {
      setBooksLoading(false);
    }
  };

  const loadComments = async (sharedRecordId: string) => {
    if (!sharedRecordId || !user?.uid) {
      setComments([]);
      return;
    }
    setCommentsLoading(true);
    try {
      const next = await firestoreService.getSharedRecordComments(sharedRecordId);
      setComments(next);
    } catch (error) {
      console.error('SAYU-함께보기 댓글 불러오기 실패:', error);
      toast.error('댓글을 불러오지 못했습니다.');
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) {
      setItems([]);
      setSelectedId('');
      setComments([]);
      setLawCards([]);
      return;
    }
    loadSharedRecords();
    loadHaruLawCards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.uid]);

  useEffect(() => {
    if (authLoading || activeTab !== 'recovery' || recoverySub !== 'people') return;
    if (!user?.uid) {
      setPublishedBooks([]);
      return;
    }
    loadPublishedBooks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, recoverySub, authLoading, user?.uid]);

  useEffect(() => {
    if (!selectedId || !user?.uid) {
      setComments([]);
      return;
    }
    loadComments(selectedId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, user?.uid]);

  const formatRecordDate = (date?: string) => {
    if (!date) return '';
    const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatCommentTime = (value?: any) => {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatBookDate = (value?: any) => {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getPhotoUrls = (item: SharedRecordListItem) => {
    if (!Array.isArray(item.publicPhotoUrls)) return [];
    return item.publicPhotoUrls
      .map((url) => String(url || '').trim())
      .filter((url) => /^https?:\/\//i.test(url));
  };

  const selectedLawCard = useMemo(
    () => lawCards.find((card) => card.id === selectedLawCardId) || null,
    [lawCards, selectedLawCardId],
  );

  // 렌더용 카드 변환 — items/lawCards 로딩 로직은 그대로, 화면 표시 형태만 통합
  const sayuCards = useMemo<SayuCardView[]>(() => {
    const recordCards: SayuCardView[] = items.map((item) => {
      const formats = Array.isArray(item.formats) ? item.formats : [];
      const formatLabels = formats.map((format) => format.formatLabel || 'SAYU');
      return {
        cardKey: `record_${item.id}`,
        kind: 'record',
        title: item.title || 'SAYU 기록',
        meta: `${item.nickname || 'HARU 회원'} · ${formatRecordDate(item.recordDate)}`,
        thumbnailUrl: getPhotoUrls(item)[0] || null,
        badges: formatLabels,
        formatLabels,
        agentLabel: resolveAgentLabel(item),
        record: item,
      };
    });

    // 하루LAW 익명 사례 — 별도 컬렉션(sourceAgent 없음), '하루LAW' 비서 그룹으로 정규화.
    // v5 규칙: 기록형식별 축에는 노출하지 않음(formatLabels 비움).
    const lawCardCards: SayuCardView[] = lawCards.map((card) => ({
      cardKey: `law_${card.id}`,
      kind: 'lawCard',
      title: card.title || '하루LAW 사례',
      meta: card.anonymizedQuestion || '',
      thumbnailUrl: null,
      badges: card.judgmentType ? [JUDGMENT_LABELS[card.judgmentType] || card.judgmentType] : [],
      formatLabels: [],
      agentLabel: '하루LAW',
      lawCard: card,
    }));

    return [...recordCards, ...lawCardCards];
  }, [items, lawCards]);

  const formatCategories = useMemo<SayuCategory[]>(() => {
    const counts = new Map<string, number>();
    sayuCards.forEach((card) => {
      if (card.kind !== 'record') return;
      card.formatLabels.forEach((label) => counts.set(label, (counts.get(label) || 0) + 1));
    });
    return Array.from(counts.entries()).map(([label, count]) => ({ key: label, label, count }));
  }, [sayuCards]);

  const agentCategories = useMemo<SayuCategory[]>(() => {
    const counts = new Map<string, number>();
    sayuCards.forEach((card) => {
      counts.set(card.agentLabel, (counts.get(card.agentLabel) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, count]) => ({ key: label, label, count }));
  }, [sayuCards]);

  const activeCategories = axis === 'agent' ? agentCategories : formatCategories;

  const axisScopedCards = useMemo(() => {
    if (axis === 'format') return sayuCards.filter((card) => card.kind === 'record');
    if (axis === 'agent') return sayuCards;
    return [];
  }, [axis, sayuCards]);

  const visibleCards = useMemo(() => {
    if (selectedCategory === 'all') return axisScopedCards;
    if (axis === 'format') return axisScopedCards.filter((card) => card.formatLabels.includes(selectedCategory));
    return axisScopedCards.filter((card) => card.agentLabel === selectedCategory);
  }, [axisScopedCards, axis, selectedCategory]);

  const groupedSections = useMemo(() => {
    if (selectedCategory !== 'all') return [];
    return activeCategories.map((category) => ({
      ...category,
      cards: axis === 'format'
        ? axisScopedCards.filter((card) => card.formatLabels.includes(category.key))
        : axisScopedCards.filter((card) => card.agentLabel === category.key),
    }));
  }, [activeCategories, axisScopedCards, axis, selectedCategory]);

  const openCard = (card: SayuCardView) => {
    if (card.kind === 'record' && card.record) {
      setSelectedId(card.record.id);
    } else if (card.kind === 'lawCard' && card.lawCard) {
      setSelectedLawCardId(card.lawCard.id);
    }
  };

  const closeDetailModal = () => {
    setSelectedId('');
    setSelectedLawCardId('');
  };

  const handleSubmitComment = async () => {
    if (!user?.uid || !selectedItem) {
      toast.error('댓글을 작성하려면 로그인이 필요합니다.');
      return;
    }

    const body = commentBody.trim();
    if (!body) {
      toast.error('댓글을 입력하세요.');
      return;
    }

    setCommentSubmitting(true);
    try {
      await firestoreService.addSharedRecordComment(selectedItem.id, body);
      setCommentBody('');
      await loadComments(selectedItem.id);
      toast.success('댓글을 등록했습니다.');
    } catch (error: any) {
      console.error('SAYU-함께보기 댓글 등록 실패:', error);
      if (String(error?.message || '').includes('COMMENT_LOGIN_REQUIRED')) {
        toast.error('댓글을 작성하려면 로그인이 필요합니다.');
      } else {
        toast.error('댓글 등록에 실패했습니다.');
      }
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleRefreshSharedRecord = async (item: SharedRecordListItem) => {
    if (!user?.uid || item.ownerUid !== user.uid || !item.sourceRecordId) return;
    setSharedActionId(item.id);
    try {
      await firestoreService.publishRecordToShared(user.uid, item.sourceRecordId);
      await loadSharedRecords();
      toast.success('공개 정보를 새로고침했습니다.');
    } catch (error) {
      console.error('SAYU-함께보기 공개 정보 갱신 실패:', error);
      toast.error('공개 정보를 새로고침하지 못했습니다.');
    } finally {
      setSharedActionId('');
    }
  };

  const handleUnpublishSharedRecord = async (item: SharedRecordListItem) => {
    if (!user?.uid || item.ownerUid !== user.uid || !item.sourceRecordId) return;
    const confirmed = window.confirm('이 글을 SAYU-함께보기에서 삭제합니다. 내 개인 기록은 삭제되지 않습니다.');
    if (!confirmed) return;

    setSharedActionId(item.id);
    try {
      await firestoreService.unpublishSharedRecord(user.uid, item.sourceRecordId);
      const nextItems = items.filter((nextItem) => nextItem.id !== item.id);
      setItems(nextItems);
      setSelectedId((current) => current === item.id ? '' : current);
      setComments([]);
      toast.success('SAYU-함께보기에서 삭제했습니다.');
    } catch (error) {
      console.error('SAYU-함께보기 공개 삭제 실패:', error);
      toast.error('함께보기 글을 삭제하지 못했습니다.');
    } finally {
      setSharedActionId('');
    }
  };

  const renderRecordDetailBody = (item: SharedRecordListItem) => {
    const formats = Array.isArray(item.formats) ? item.formats : [];
    const photoUrls = getPhotoUrls(item);
    const isOwnItem = item.ownerUid === user?.uid;
    const isBusy = sharedActionId === item.id;

    return (
      <>
        <div className="mb-4">
          <h2 className="text-xl font-bold" style={{ color: '#1A3C6E' }}>
            {item.title || 'SAYU 기록'}
          </h2>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            {item.nickname || 'HARU 회원'} · {formatRecordDate(item.recordDate)}
          </p>
          {isOwnItem && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRefreshSharedRecord(item)}
                disabled={isBusy}
                style={{
                  minHeight: 34,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: isBusy ? 'wait' : 'pointer',
                  opacity: isBusy ? 0.65 : 1,
                }}
              >
                사진 새로고침
              </button>
              <button
                type="button"
                onClick={() => handleUnpublishSharedRecord(item)}
                disabled={isBusy}
                style={{
                  minHeight: 34,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  color: '#B42318',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: isBusy ? 'wait' : 'pointer',
                  opacity: isBusy ? 0.65 : 1,
                }}
              >
                함께보기 삭제
              </button>
            </div>
          )}
        </div>

        {photoUrls.length > 0 && (
          <div
            className="mb-5 grid gap-2"
            style={{
              gridTemplateColumns: photoUrls.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(140px, 1fr))',
            }}
          >
            {photoUrls.map((url, index) => (
              <div
                key={`${item.id}_photo_${index}`}
                className="overflow-hidden rounded-xl"
                style={{ border: '1px solid #E2E8F0', aspectRatio: photoUrls.length === 1 ? '16 / 9' : '1 / 1', background: '#F8FAFC' }}
              >
                <img
                  src={url}
                  alt={`공개된 SAYU 사진 ${index + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {formats.map((format) => (
            <article
              key={`${item.id}_${format.formatKey || format.formatLabel}`}
              style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}
            >
              <p className="text-xs font-bold mb-2" style={{ color: '#0F766E' }}>
                {format.formatLabel || 'SAYU'}
              </p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: '#334155', lineHeight: 1.85 }}>
                {format.sayuText || ''}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 pt-5" style={{ borderTop: '1px solid #E2E8F0' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#1A3C6E' }}>
            댓글
          </h3>

          {commentsLoading ? (
            <p className="text-sm" style={{ color: '#64748B' }}>댓글을 불러오고 있습니다.</p>
          ) : comments.length === 0 ? (
            <p className="text-sm" style={{ color: '#94A3B8' }}>아직 댓글이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg p-3"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold" style={{ color: '#0F766E' }}>
                      {comment.displayName || '익명 사용자'}
                    </p>
                    <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                      {formatCommentTime(comment.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: '#334155', lineHeight: 1.6 }}>
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            {!user?.uid && (
              <p className="text-sm mb-2" style={{ color: '#B42318' }}>
                댓글을 작성하려면 로그인이 필요합니다.
              </p>
            )}
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              disabled={!user?.uid || commentSubmitting}
              placeholder="댓글을 입력하세요"
              rows={3}
              className="w-full"
              style={{
                border: '1px solid #CBD5E1',
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                resize: 'vertical',
                background: user?.uid ? '#FFFFFF' : '#F1F5F9',
                color: '#334155',
                outline: 'none',
              }}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSubmitComment}
                disabled={!user?.uid || commentSubmitting || !commentBody.trim()}
                style={{
                  minHeight: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: !user?.uid || commentSubmitting || !commentBody.trim() ? '#CBD5E1' : '#0F766E',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: !user?.uid || commentSubmitting || !commentBody.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {commentSubmitting ? '등록 중...' : '댓글 등록'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderLawCardDetailBody = (card: PublishedHaruLawCard) => (
    <div>
      {card.judgmentType && (
        <span
          className="text-xs font-bold"
          style={{ color: '#1A3C6E', backgroundColor: '#F0F4FF', borderRadius: 999, padding: '2px 8px' }}
        >
          {JUDGMENT_LABELS[card.judgmentType] || card.judgmentType}
        </span>
      )}
      <h2 className="text-xl font-bold mt-2" style={{ color: '#1A3C6E' }}>{card.title}</h2>
      <p className="text-sm mt-2" style={{ color: '#6B7280', lineHeight: 1.7 }}>{card.anonymizedQuestion}</p>
      <p className="text-sm mt-4 whitespace-pre-wrap" style={{ color: '#374151', lineHeight: 1.7 }}>{card.summary}</p>
      {Array.isArray(card.relatedStatutes) && card.relatedStatutes.length > 0 && (
        <div className="mt-4 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', padding: 10 }}>
          {card.relatedStatutes.map((statute, idx) => (
            <div key={`${card.id}_statute_${idx}`} className={idx > 0 ? 'mt-2' : ''}>
              <p className="text-xs font-bold" style={{ color: '#111827' }}>
                {[statute.title, statute.article].filter(Boolean).join(' · ')}
              </p>
              {statute.easySummary && (
                <p className="text-xs mt-0.5" style={{ color: '#6B7280', lineHeight: 1.6 }}>{statute.easySummary}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {card.disclaimer && (
        <p className="text-xs mt-4" style={{ color: '#92400E', lineHeight: 1.6 }}>{card.disclaimer}</p>
      )}
    </div>
  );

  const renderDetailModal = () => {
    if (!selectedItem && !selectedLawCard) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
        onClick={closeDetailModal}
      >
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5"
          onClick={(event) => event.stopPropagation()}
          style={{ border: '1px solid #D1FAE5' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: '#0F766E' }}>
              {selectedLawCard ? '⚖️ 하루LAW 익명 사례' : 'SAYU 기록 상세'}
            </span>
            <button
              type="button"
              onClick={closeDetailModal}
              aria-label="닫기"
              style={{ border: 'none', background: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          {selectedItem && renderRecordDetailBody(selectedItem)}
          {selectedLawCard && renderLawCardDetailBody(selectedLawCard)}
        </div>
      </div>
    );
  };

  const renderAxisEntry = () => (
    <div className="grid grid-cols-2 gap-3">
      {[
        {
          key: 'format' as const,
          label: '기록형식별',
          desc: '일기·에세이 등 형식으로 둘러보기',
          count: sayuCards.filter((card) => card.kind === 'record').length,
        },
        {
          key: 'agent' as const,
          label: '비서별',
          desc: '하루LAW 등 비서별로 둘러보기',
          count: sayuCards.length,
        },
      ].map((entry) => (
        <button
          key={entry.key}
          type="button"
          onClick={() => { setAxis(entry.key); setSelectedCategory('all'); }}
          className="text-left rounded-2xl p-5 bg-white shadow-sm"
          style={{ border: '1px solid #D1FAE5' }}
        >
          <p className="text-base font-bold" style={{ color: '#1A3C6E' }}>{entry.label}</p>
          <p className="text-xs mt-1.5" style={{ color: '#64748B', lineHeight: 1.6 }}>{entry.desc}</p>
          <p className="text-[11px] mt-3 font-bold" style={{ color: '#0F766E' }}>{entry.count}개</p>
        </button>
      ))}
    </div>
  );

  const renderCategoryChips = () => (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => { setAxis(null); setSelectedCategory('all'); }}
        style={{ background: 'none', border: 'none', padding: 0, marginBottom: 10, color: '#0F766E', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
      >
        ← 처음으로
      </button>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSelectedCategory('all')} style={sayuChipStyle(selectedCategory === 'all')}>
          전체 {axisScopedCards.length}
        </button>
        {activeCategories.map((category) => (
          <button
            key={category.key}
            type="button"
            onClick={() => setSelectedCategory(category.key)}
            style={sayuChipStyle(selectedCategory === category.key)}
          >
            {category.label} {category.count}
          </button>
        ))}
      </div>
    </div>
  );

  const renderCardTile = (card: SayuCardView) => (
    <button
      key={card.cardKey}
      type="button"
      onClick={() => openCard(card)}
      className="text-left rounded-xl overflow-hidden bg-white shadow-sm"
      style={{ border: '1px solid #D1FAE5' }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          aspectRatio: '4 / 3',
          background: card.thumbnailUrl ? undefined : 'linear-gradient(135deg, #ECFDF5 0%, #F0FDFA 100%)',
        }}
      >
        {card.thumbnailUrl ? (
          <img
            src={card.thumbnailUrl}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 22 }}>{card.kind === 'lawCard' ? '⚖️' : '🌿'}</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-bold truncate" style={{ color: '#1A3C6E' }}>{card.title}</p>
        <p className="text-[11px] mt-1 truncate" style={{ color: '#64748B' }}>{card.meta}</p>
        {card.badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.badges.slice(0, 3).map((badge) => (
              <span
                key={badge}
                className="text-[10px] font-bold rounded-full px-2 py-0.5"
                style={{ backgroundColor: '#ECFDF5', color: '#0F766E' }}
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );

  const renderCardGrid = () => {
    if (axisScopedCards.length === 0) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #D1FAE5' }}>
          <p className="text-sm" style={{ color: '#0F766E' }}>아직 이 분류로 공개된 기록이 없습니다.</p>
        </div>
      );
    }

    if (selectedCategory === 'all') {
      return (
        <div className="space-y-6">
          {groupedSections
            .filter((section) => section.cards.length > 0)
            .map((section) => (
              <div key={section.key}>
                <p className="text-xs font-bold mb-2" style={{ color: '#0F766E' }}>
                  {section.label} <span style={{ color: '#94A3B8', fontWeight: 700 }}>{section.count}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {section.cards.map((card) => renderCardTile(card))}
                </div>
              </div>
            ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visibleCards.map((card) => renderCardTile(card))}
      </div>
    );
  };

  const renderShared = () => {
    if (authLoading || loading) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #D1FAE5' }}>
          <p className="text-sm" style={{ color: '#0F766E' }}>공개된 SAYU 기록을 불러오고 있습니다.</p>
        </div>
      );
    }

    if (!user?.uid) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #D1FAE5' }}>
          <p className="text-sm" style={{ color: '#0F766E', lineHeight: 1.7 }}>
            SAYU-함께보기는 로그인한 HARU 회원만 볼 수 있습니다.
          </p>
        </div>
      );
    }

    if (errorMessage) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #FECACA' }}>
          <p className="text-sm" style={{ color: '#B42318', lineHeight: 1.7 }}>{errorMessage}</p>
        </div>
      );
    }

    if (sayuCards.length === 0) {
      return (
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, #ECFDF5 0%, #ffffff 70%)',
            border: '1px solid #D1FAE5',
          }}
        >
          <p className="text-sm" style={{ color: '#0F766E', lineHeight: 1.7 }}>
            공개된 기록을 준비하고 있습니다.<br />
            곧 이곳에서 다른 회원들의 SAYU 기록을 만나보실 수 있어요.
          </p>
        </div>
      );
    }

    if (!axis) return renderAxisEntry();

    return (
      <div>
        {renderCategoryChips()}
        {renderCardGrid()}
      </div>
    );
  };

  const renderPublishedBooks = () => {
    if (authLoading || booksLoading) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #DBEAFE' }}>
          <p className="text-sm" style={{ color: '#1A3C6E' }}>발행중인 사람속으로 책을 불러오고 있습니다.</p>
        </div>
      );
    }

    if (!user?.uid) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #DBEAFE' }}>
          <p className="text-sm" style={{ color: '#1A3C6E', lineHeight: 1.7 }}>
            사람속으로 발행본은 로그인한 HARU 회원만 볼 수 있습니다.
          </p>
        </div>
      );
    }

    if (booksErrorMessage) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #FECACA' }}>
          <p className="text-sm" style={{ color: '#B42318', lineHeight: 1.7 }}>{booksErrorMessage}</p>
        </div>
      );
    }

    if (publishedBooks.length === 0) {
      return (
        <div className="rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #DBEAFE' }}>
          <p className="text-sm" style={{ color: '#1A3C6E', lineHeight: 1.7 }}>
            발행중인 사람속으로 책을 준비하고 있습니다.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {publishedBooks.map((book) => (
          <article
            key={book.id}
            className="bg-white rounded-xl p-4 shadow-sm"
            style={{ border: '1px solid #DBEAFE' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div style={{ minWidth: 0 }}>
                <h2 className="text-base font-bold" style={{ color: '#1A3C6E' }}>
                  {book.title || '사람속으로'}
                </h2>
                <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                  {formatBookDate(book.createdAt) || '발행일 준비중'}
                </p>
              </div>
              <span
                className="text-[10px] font-bold rounded-full px-2 py-1"
                style={{ backgroundColor: '#ECFDF5', color: '#0F766E' }}
              >
                발행중
              </span>
            </div>
            {book.summary && (
              <p className="text-sm mt-3" style={{ color: '#334155', lineHeight: 1.7 }}>
                {book.summary}
              </p>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => navigate(`/book-reader/${book.id}`)}
                className="w-full sm:w-auto"
                style={{
                  minHeight: 34,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: '1px solid #1A3C6E',
                  background: '#1A3C6E',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                읽기
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const handleEpubExport = async () => {
    if (!epubStartDate || !epubEndDate) return;
    setIsExporting(true);
    try {
      const { count, fileName } = await exportRecordsToEpub(epubStartDate, epubEndDate);
      alert(`✅ EPUB 생성 완료! ${count}개 기록 → ${fileName}`);
    } catch (e: any) {
      alert(`❌ 오류: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const renderRecovery = () => (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {([
          { key: 'people', label: '사람속으로' },
          { key: 'todaycharge', label: '오늘의 충전' },
          { key: 'ramen', label: '하루라면' },
          { key: 'epub', label: 'EPUB' },
        ] as const).map((sub) => {
          const active = recoverySub === sub.key;
          return (
            <button
              key={sub.key}
              type="button"
              onClick={() => {
                setRecoverySub(sub.key);
                setSelectedId('');
              }}
              style={{
                minHeight: 38,
                borderRadius: 9,
                border: active ? '1.5px solid #0F766E' : '1px solid #CBD5E1',
                background: active ? '#ECFDF5' : '#FFFFFF',
                color: active ? '#0F766E' : '#475569',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {sub.label}
            </button>
          );
        })}
      </div>

      {recoverySub === 'people' && (
        <>
          {isDeveloper && (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/book-studio', { state: { from: '/sayu-together' } })}
                style={{
                  minHeight: 36,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: '1px solid #1A3C6E',
                  background: '#1A3C6E',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                사람속으로 관리
              </button>
            </div>
          )}
          {renderPublishedBooks()}
        </>
      )}

      {recoverySub === 'todaycharge' && (
        <section className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
          <TodayChargeSection isDeveloper={isDeveloper} />
        </section>
      )}

      {recoverySub === 'ramen' && (
        <section className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid #FED7AA' }}>
          <HaruRamenSection isDeveloper={isDeveloper} />
        </section>
      )}

      {recoverySub === 'epub' && (
        <section className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid #DBEAFE' }}>
          <h2 className="text-base font-bold mb-2" style={{ color: '#1A3C6E' }}>
            📖 EPUB 내보내기
          </h2>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 14px' }}>
            날짜 범위를 선택하면 해당 기간 기록을 EPUB 파일로 다운로드합니다.
          </p>
          {!user?.uid ? (
            <p style={{ fontSize: 13, color: '#B42318' }}>로그인 후 이용할 수 있습니다.</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: '#1A3C6E' }}>
                시작일&nbsp;
                <input
                  type="date"
                  value={epubStartDate}
                  onChange={(e) => setEpubStartDate(e.target.value)}
                  style={{ border: '1px solid #CBD5E1', borderRadius: 8, padding: '9px 10px', fontSize: 14 }}
                />
              </label>
              <label style={{ fontSize: 13, color: '#1A3C6E' }}>
                종료일&nbsp;
                <input
                  type="date"
                  value={epubEndDate}
                  onChange={(e) => setEpubEndDate(e.target.value)}
                  style={{ border: '1px solid #CBD5E1', borderRadius: 8, padding: '9px 10px', fontSize: 14 }}
                />
              </label>
              <button
                type="button"
                onClick={handleEpubExport}
                disabled={isExporting || !epubStartDate || !epubEndDate}
                style={{
                  border: 0,
                  borderRadius: 8,
                  padding: '10px 16px',
                  background: epubStartDate && epubEndDate ? '#1A3C6E' : '#CBD5E1',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: isExporting || !epubStartDate || !epubEndDate ? 'not-allowed' : 'pointer',
                }}
              >
                {isExporting ? '생성 중...' : '📥 EPUB 다운로드'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-2 flex items-center gap-2">
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: '#0F766E',
            color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
          }}
        >
          BETA
        </span>
        <span style={{ fontSize: 11, color: '#888780', letterSpacing: '0.04em' }}>
          SAYU · TOGETHER
        </span>
      </div>

      <div className="mb-5">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#1A3C6E' }}
        >
          🌿 SAYU·함께보기
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          HARU 회원들이 공개한 기록을 함께 읽고 댓글로 마음을 나누는 공간입니다.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        {([
          { key: 'shared', label: '구독자SAYU' },
          { key: 'recovery', label: '원기충전소' },
        ] as const).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedId('');
                setSelectedLawCardId('');
                setAxis(null);
                setSelectedCategory('all');
              }}
              style={{
                minHeight: 42,
                borderRadius: 10,
                border: active ? '1.5px solid #0F766E' : '1px solid #CBD5E1',
                background: active ? '#ECFDF5' : '#FFFFFF',
                color: active ? '#0F766E' : '#475569',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'shared' ? renderShared() : renderRecovery()}
      {renderDetailModal()}
    </div>
  );
}
