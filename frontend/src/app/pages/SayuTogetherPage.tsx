import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { KNewsSection } from '../components/KNewsSection';
import { TodayQuote } from '../components/TodayQuote';
import { useAuth } from '../contexts/AuthContext';
import {
  firestoreService,
  type PublishedBook,
  type SharedRecordComment,
  type SharedRecordListItem,
} from '../services/firestoreService';
import { toast } from 'sonner';

type TogetherTab = 'shared' | 'people' | 'publicContent';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export function SayuTogetherPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TogetherTab>('shared');
  const [items, setItems] = useState<SharedRecordListItem[]>([]);
  const [publishedBooks, setPublishedBooks] = useState<PublishedBook[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [comments, setComments] = useState<SharedRecordComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [booksLoading, setBooksLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [sharedActionId, setSharedActionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
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
      return;
    }
    loadSharedRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.uid]);

  useEffect(() => {
    if (authLoading || activeTab !== 'people') return;
    if (!user?.uid) {
      setPublishedBooks([]);
      return;
    }
    loadPublishedBooks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authLoading, user?.uid]);

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

  const getPreviewText = (item: SharedRecordListItem) => {
    const formats = Array.isArray(item.formats) ? item.formats : [];
    const preview = formats.map((format) => String(format.sayuText || '').trim()).find(Boolean) || '';
    return preview.length > 160 ? `${preview.slice(0, 160)}...` : preview;
  };

  const getPhotoUrls = (item: SharedRecordListItem) => {
    if (!Array.isArray(item.publicPhotoUrls)) return [];
    return item.publicPhotoUrls
      .map((url) => String(url || '').trim())
      .filter((url) => /^https?:\/\//i.test(url));
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

  const renderList = () => {
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

    if (items.length === 0) {
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

    return (
      <div className="space-y-3">
        {items.map((item) => {
          const isSelected = selectedId === item.id;
          const formats = Array.isArray(item.formats) ? item.formats : [];
          const photoUrls = getPhotoUrls(item);
          const isOwnItem = item.ownerUid === user?.uid;
          const isBusy = sharedActionId === item.id;
          return (
            <article
              key={item.id}
              className="bg-white rounded-xl p-4 shadow-sm"
              style={{ border: isSelected ? '1.5px solid #0F766E' : '1px solid #D1FAE5' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div style={{ minWidth: 0 }}>
                  <h2 className="text-base font-bold truncate" style={{ color: '#1A3C6E' }}>
                    {item.title || 'SAYU 기록'}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                    {item.nickname || 'HARU 회원'} · {formatRecordDate(item.recordDate)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {formats.map((format) => (
                    <span
                      key={`${item.id}_${format.formatKey || format.formatLabel}`}
                      className="text-[10px] font-bold rounded-full px-2 py-1"
                      style={{ backgroundColor: '#ECFDF5', color: '#0F766E' }}
                    >
                      {format.formatLabel || 'SAYU'}
                    </span>
                  ))}
                </div>
              </div>
              {photoUrls.length > 0 && (
                <div
                  className="mt-3 overflow-hidden rounded-lg"
                  style={{ border: '1px solid #E2E8F0', aspectRatio: '16 / 9', background: '#F8FAFC' }}
                >
                  <img
                    src={photoUrls[0]}
                    alt="공개된 SAYU 사진"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                </div>
              )}
              {getPreviewText(item) && (
                <p className="text-sm mt-3" style={{ color: '#334155', lineHeight: 1.7 }}>
                  {getPreviewText(item)}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="w-full sm:w-auto"
                  style={{
                    minHeight: 34,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid #0F766E',
                    background: isSelected ? '#0F766E' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#0F766E',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  상세 보기
                </button>
                {isOwnItem && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRefreshSharedRecord(item)}
                      disabled={isBusy}
                      className="w-full sm:w-auto"
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
                      className="w-full sm:w-auto"
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
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const renderDetail = () => {
    if (!user?.uid || !selectedItem) return null;
    const formats = Array.isArray(selectedItem.formats) ? selectedItem.formats : [];
    const photoUrls = getPhotoUrls(selectedItem);
    const isOwnItem = selectedItem.ownerUid === user.uid;
    const isBusy = sharedActionId === selectedItem.id;

    return (
      <section
        className="mt-5 bg-white rounded-2xl p-5 shadow-sm"
        style={{ border: '1px solid #D1FAE5' }}
      >
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setSelectedId('')}
            style={{
              minHeight: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              marginBottom: 14,
            }}
          >
            ← 목록으로
          </button>
          <h2 className="text-xl font-bold" style={{ color: '#1A3C6E' }}>
            {selectedItem.title || 'SAYU 기록'}
          </h2>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            {selectedItem.nickname || 'HARU 회원'} · {formatRecordDate(selectedItem.recordDate)}
          </p>
          {isOwnItem && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRefreshSharedRecord(selectedItem)}
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
                onClick={() => handleUnpublishSharedRecord(selectedItem)}
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
                key={`${selectedItem.id}_photo_${index}`}
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
              key={`${selectedItem.id}_${format.formatKey || format.formatLabel}`}
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
      </section>
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

  const renderPublicContent = () => (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid #DBEAFE' }}>
        <h2 className="text-base font-bold mb-3" style={{ color: '#1A3C6E' }}>
          K뉴스
        </h2>
        <KNewsSection />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
        <h2 className="text-base font-bold mb-3" style={{ color: '#1A3C6E' }}>
          명언
        </h2>
        <TodayQuote defaultTab="classic" hideTabSwitcher />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
        <h2 className="text-base font-bold mb-3" style={{ color: '#1A3C6E' }}>
          성경말씀
        </h2>
        <TodayQuote defaultTab="bible" hideTabSwitcher />
      </section>
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

      <div className="mb-5 grid grid-cols-3 gap-2">
        {([
          { key: 'shared', label: '구독자 사유' },
          { key: 'people', label: '사람속으로' },
          { key: 'publicContent', label: '공개 콘텐츠' },
        ] as const).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedId('');
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

      {activeTab === 'people' && isDeveloper && (
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

      {activeTab === 'shared'
        ? (selectedItem ? renderDetail() : renderList())
        : activeTab === 'people'
          ? renderPublishedBooks()
          : renderPublicContent()}
    </div>
  );
}
