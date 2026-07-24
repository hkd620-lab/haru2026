import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteField, doc, onSnapshot, updateDoc, type Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import GrapeLoadingMini from './GrapeLoadingMini';
import {
  CRITERIA_INFO,
  CRITERIA_ORDER,
  DISPLAY_STATUS_META,
  type CriterionAiStatus,
  type CriterionKey,
  type PublishRevisionItem,
  type PublishRevisionResult,
  type PublishReview,
} from '../types/bookReview';
import {
  callApplyBookPublishRevision,
  callReviewBookForPublish,
  callSuggestBookPublishRevision,
  computeManuscriptHash,
  deriveDisplayStatus,
  fetchChaptersForReview,
  findOverride,
  isPublishable,
  recordCriterionOverride,
} from '../services/bookReviewService';

const CONFIDENCE_LABEL: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' };

function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return '-';
  try {
    const d = ts.toDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '-';
  }
}

function getRevisionTargetLabel(revision: PublishRevisionItem): string {
  if (revision.targetType === 'bookTitle') return '책 제목';
  if (revision.targetType === 'chapterOrder') return '목차 순서';
  return revision.chapterTitle ? `${revision.chapterTitle}` : '챕터 본문';
}

function getRevisionDismissLabel(revision: PublishRevisionItem): string {
  if (revision.targetType === 'bookTitle') return '현재 제목 유지';
  if (revision.targetType === 'chapterOrder') return '현재 목차 유지';
  return '적용하지 않음';
}

function getRevisionApplyLabel(revision: PublishRevisionItem): string {
  if (revision.targetType === 'bookTitle') return 'AI 제안 적용';
  if (revision.targetType === 'chapterOrder') return 'AI 추천 목차 적용';
  return 'AI 보완안 적용';
}

interface BookPublishReviewModalProps {
  book: { id: string; title: string };
  publishing: boolean;
  onClose: () => void;
  onConfirmPublish: () => void | Promise<void>;
}

export function BookPublishReviewModal({
  book,
  publishing,
  onClose,
  onConfirmPublish,
}: BookPublishReviewModalProps) {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  // effect 본문에서 true로 재설정 — HMR로 effect가 정리·재실행돼도 false로 굳지 않게 함
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [liveTitle, setLiveTitle] = useState(book.title);
  const [review, setReview] = useState<PublishReview | null>(null);
  const [persistedSuggestions, setPersistedSuggestions] = useState<Partial<
    Record<CriterionKey, PublishRevisionResult>
  > | null>(null);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [hashError, setHashError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<CriterionKey | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [overrideSubmittingKey, setOverrideSubmittingKey] = useState<CriterionKey | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [revisionResults, setRevisionResults] = useState<Partial<Record<CriterionKey, PublishRevisionResult>>>({});
  const [revisionErrors, setRevisionErrors] = useState<Partial<Record<CriterionKey, string>>>({});
  const [suggestingKey, setSuggestingKey] = useState<CriterionKey | null>(null);
  const [applyingRevisionId, setApplyingRevisionId] = useState<string | null>(null);
  const [revisionNotice, setRevisionNotice] = useState<string | null>(null);

  // 책 문서 실시간 구독 — 저장된 검토 결과·오버라이드를 즉시 반영 (모달 오픈 시 AI 자동 호출 없음)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'books', book.id), (snap) => {
      const data = snap.data() as Record<string, unknown> | undefined;
      setLiveTitle(String(data?.title || book.title));
      setReview((data?.publishReview as PublishReview | undefined) || null);
      setPersistedSuggestions(
        (data?.publishRevisionSuggestions as Partial<Record<CriterionKey, PublishRevisionResult>> | undefined) || null
      );
      setSnapshotReady(true);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  const refreshCurrentHash = useCallback(async () => {
    setHashError(null);
    try {
      const chapters = await fetchChaptersForReview(book.id);
      const hash = await computeManuscriptHash(liveTitle, chapters);
      if (mountedRef.current) setCurrentHash(hash);
      return hash;
    } catch (error) {
      console.error('원고 해시 계산 실패:', error);
      if (mountedRef.current) setHashError('원고 상태를 확인하지 못했습니다.');
      return null;
    }
  }, [book.id, liveTitle]);

  // 원고 해시 계산 — 재검토 필요 여부 판단용. AI 호출 없이 순수 로컬 계산.
  useEffect(() => {
    if (!snapshotReady) return;
    let cancelled = false;
    (async () => {
      const hash = await refreshCurrentHash();
      if (cancelled || !mountedRef.current) return;
      if (hash) setCurrentHash(hash);
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshotReady, refreshCurrentHash]);

  const stale = !!review && !!currentHash && review.contentHash !== currentHash;
  // 해시 확인이 끝나기 전에는 안전하게 발행 비활성화 상태 유지
  const canPublish = currentHash !== null && isPublishable(review, stale);

  // 표시할 보완안 — 이 세션에서 받은 결과 우선, 없으면 서버에 저장된 결과(현재 원고 기준일 때만)
  const getEffectiveRevisionResult = (key: CriterionKey): PublishRevisionResult | undefined => {
    const local = revisionResults[key];
    if (local) return local;
    const persisted = persistedSuggestions?.[key];
    if (persisted && !stale && currentHash && persisted.contentHash === currentHash) return persisted;
    return undefined;
  };

  useEffect(() => {
    setRevisionResults({});
    setRevisionErrors({});
    setRevisionNotice(null);
  }, [review?.contentHash]);

  const runReview = async () => {
    setReviewing(true);
    setReviewError(null);
    setRevisionNotice(null);
    try {
      await callReviewBookForPublish(book.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI 검토에 실패했습니다.';
      if (mountedRef.current) setReviewError(msg);
    } finally {
      if (mountedRef.current) setReviewing(false);
    }
  };

  const runRevisionSuggestion = async (key: CriterionKey) => {
    const criterion = review?.criteria.find((item) => item.key === key);
    if (!criterion || !review) {
      setRevisionErrors((prev) => ({
        ...prev,
        [key]: 'AI 검토 결과를 아직 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      }));
      return;
    }
    setSuggestingKey(key);
    setRevisionErrors((prev) => ({ ...prev, [key]: undefined }));
    setRevisionNotice(null);
    try {
      // 호출 직전에 원고 해시를 새로 계산 — 모달 오픈 시점의 낡은 해시로 인한 서버 400 방지
      const freshHash = await refreshCurrentHash();
      if (!freshHash) {
        if (mountedRef.current) {
          setRevisionErrors((prev) => ({
            ...prev,
            [key]: '원고 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          }));
        }
        return;
      }
      if (freshHash !== review.contentHash) {
        if (mountedRef.current) {
          setRevisionErrors((prev) => ({
            ...prev,
            [key]: '원고가 수정되었습니다. 현재 원고를 기준으로 AI 재검토를 먼저 실행해 주세요.',
          }));
        }
        return;
      }
      const result = await callSuggestBookPublishRevision(book.id, criterion, freshHash);
      if (mountedRef.current) {
        setRevisionResults((prev) => ({ ...prev, [key]: result }));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI 보완안 생성에 실패했습니다.';
      if (mountedRef.current) {
        setRevisionErrors((prev) => ({ ...prev, [key]: msg }));
      }
    } finally {
      if (mountedRef.current) setSuggestingKey(null);
    }
  };

  const dismissRevision = async (key: CriterionKey, index: number) => {
    const current = getEffectiveRevisionResult(key);
    if (!current) return;
    const next: PublishRevisionResult = {
      ...current,
      revisions: current.revisions.filter((_, i) => i !== index),
    };
    setRevisionResults((prev) => ({ ...prev, [key]: next }));
    // 서버 저장본에도 반영 — 모달을 다시 열었을 때 이미 거절한 보완안이 재등장하지 않도록
    try {
      await updateDoc(
        doc(db, 'books', book.id),
        next.revisions.length > 0
          ? { [`publishRevisionSuggestions.${key}`]: next }
          : { [`publishRevisionSuggestions.${key}`]: deleteField() }
      );
    } catch (error) {
      console.error('보완안 거절 상태 저장 실패:', error);
    }
  };

  const applyRevision = async (
    key: CriterionKey,
    result: PublishRevisionResult,
    revision: PublishRevisionItem,
    index: number
  ) => {
    const applyId = `${key}-${index}`;
    setApplyingRevisionId(applyId);
    setRevisionErrors((prev) => ({ ...prev, [key]: undefined }));
    setRevisionNotice(null);
    try {
      const response = await callApplyBookPublishRevision(book.id, key, result.contentHash, revision);
      if (mountedRef.current) {
        setCurrentHash(response.newContentHash);
        // 서버가 적용 항목의 저장 보완안을 삭제하므로 로컬 상태만 비움 (재저장 금지)
        setRevisionResults((prev) => ({ ...prev, [key]: undefined }));
        setRevisionNotice('AI 보완안이 원고에 적용되었습니다. 발행 전 AI 재검토가 필요합니다.');
      }
    } catch (error) {
      const msg = error instanceof Error
        ? error.message
        : '수정 적용에 실패했습니다. 현재 원고를 기준으로 AI 보완안을 다시 생성해 주세요.';
      if (mountedRef.current) {
        setRevisionErrors((prev) => ({ ...prev, [key]: msg }));
      }
    } finally {
      if (mountedRef.current) setApplyingRevisionId(null);
    }
  };

  const confirmOverride = async (key: CriterionKey, previousAiStatus: CriterionAiStatus) => {
    if (!review || !user?.uid) return;
    const note = (noteDrafts[key] || '').trim();
    if (key === 'sensitive_content' && !note) {
      setOverrideError('민감·부적절 항목은 확인 사유를 반드시 입력해야 합니다.');
      return;
    }
    setOverrideSubmittingKey(key);
    setOverrideError(null);
    try {
      await recordCriterionOverride(book.id, review, key, previousAiStatus, user.uid, note || undefined);
      if (mountedRef.current) setNoteDrafts((prev) => ({ ...prev, [key]: '' }));
    } catch (error) {
      console.error('오버라이드 저장 실패:', error);
      if (mountedRef.current) setOverrideError('사용자 확인 저장에 실패했습니다.');
    } finally {
      if (mountedRef.current) setOverrideSubmittingKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"
        style={{ color: '#1A3C6E', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500">사람속으로 발행 확인</p>
            <h2 className="mt-1 text-lg font-bold">{liveTitle || '(제목 없음)'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="text-xl leading-none disabled:opacity-40"
            style={{ color: '#64748b' }}
          >
            ×
          </button>
        </div>

        {stale && (
          <div
            className="mt-3 rounded-lg border px-3 py-2 text-xs font-medium"
            style={{ borderColor: '#fde68a', backgroundColor: '#fffbeb', color: '#92400e' }}
          >
            ⚠️ 원고가 마지막 검토 이후 수정되었습니다. 원고 수정 후 재검토가 필요합니다.
          </div>
        )}
        {hashError && (
          <div className="mt-2 text-xs" style={{ color: '#b91c1c' }}>{hashError}</div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            {review ? `마지막 검토: ${formatTimestamp(review.reviewedAt)}` : 'AI 검토를 아직 실행하지 않았습니다.'}
          </p>
          <button
            type="button"
            onClick={runReview}
            disabled={reviewing || publishing || !snapshotReady}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: '#1A3C6E' }}
          >
            {reviewing ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <GrapeLoadingMini size={14} color="#fff" />검토 중...
              </span>
            ) : review ? '재검토' : 'AI 검토 실행'}
          </button>
        </div>

        {reviewError && (
          <div
            className="mt-2 rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#b91c1c' }}
          >
            {reviewError} — 잠시 후 다시 시도해주세요.
          </div>
        )}
        {revisionNotice && (
          <div
            className="mt-2 rounded-lg border px-3 py-2 text-xs font-medium"
            style={{ borderColor: '#fde68a', backgroundColor: '#fffbeb', color: '#92400e' }}
          >
            {revisionNotice}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {!snapshotReady ? (
            <div className="flex justify-center py-10">
              <GrapeLoadingMini size={22} />
            </div>
          ) : (
            CRITERIA_ORDER.map((key) => {
              const info = CRITERIA_INFO[key];
              const displayStatus = deriveDisplayStatus(review, key, reviewing);
              const meta = DISPLAY_STATUS_META[displayStatus];
              const criterion = review?.criteria.find((c) => c.key === key);
              const override = findOverride(review, key);
              const expanded = expandedKey === key;
              const needsUserAction = displayStatus === 'needs_revision' || displayStatus === 'uncertain';
              const revisionResult = getEffectiveRevisionResult(key);
              const revisionError = revisionErrors[key];
              const suggesting = suggestingKey === key;

              return (
                <div
                  key={key}
                  className="rounded-lg border overflow-hidden"
                  style={{ borderColor: needsUserAction ? '#fecaca' : '#e5e7eb', opacity: reviewing ? 0.7 : 1 }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedKey(expanded ? null : key)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
                    style={{ backgroundColor: '#f8fafc' }}
                  >
                    <span className="text-sm font-medium">{info.label}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: meta.bg, color: meta.fg }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-3 py-3 text-sm space-y-2" style={{ borderTop: '1px solid #e5e7eb' }}>
                      <p className="text-xs text-gray-500">{info.description}</p>

                      {criterion ? (
                        <>
                          <p>{criterion.reason}</p>
                          {criterion.suggestion && (
                            <p className="text-xs" style={{ color: '#92400e' }}>💡 제안: {criterion.suggestion}</p>
                          )}
                          {criterion.evidence.length > 0 && (
                            <div className="space-y-1">
                              {criterion.evidence.map((ev, i) => (
                                <p
                                  key={i}
                                  className="text-xs rounded px-2 py-1"
                                  style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}
                                >
                                  {ev.chapter}장: “{ev.quote}”
                                </p>
                              ))}
                            </div>
                          )}
                          <p className="text-[11px] text-gray-400">
                            신뢰도: {CONFIDENCE_LABEL[criterion.confidence] || criterion.confidence}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">아직 이 항목을 검토하지 않았습니다.</p>
                      )}

                      {needsUserAction && criterion && !override && (
                        <div
                          className="rounded-lg border px-3 py-3 space-y-2"
                          style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }}
                        >
                          <div>
                            <p className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>
                              AI 보완안 적용은 실제 원고를 수정하며, 적용 후 반드시 재검토가 필요합니다.
                            </p>
                            <p className="mt-1 text-[11px]" style={{ color: '#475569' }}>
                              사용자 확인 완료는 원고를 그대로 유지하는 승인이고, AI 보완안 적용은 원고를 바꾸는 작업입니다.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => runRevisionSuggestion(key)}
                            disabled={suggesting || reviewing || publishing}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: '#2563eb' }}
                          >
                            {suggesting ? 'AI 보완안 생성 중...' : 'AI 보완안 만들기'}
                          </button>
                          {stale && (
                            <p className="text-xs" style={{ color: '#92400e' }}>
                              원고가 수정되어 기존 점검 결과가 오래되었습니다. 먼저 AI 재검토를 실행해 주세요.
                            </p>
                          )}
                          {revisionError && (
                            <p className="text-xs" style={{ color: '#b91c1c' }}>
                              {revisionError}
                            </p>
                          )}
                        </div>
                      )}

                      {revisionResult && revisionResult.revisions.length > 0 && (
                        <div className="rounded-lg border px-3 py-3 space-y-3" style={{ borderColor: '#dbeafe' }}>
                          <p className="text-sm font-semibold">AI 보완안</p>
                          {revisionResult.revisions.map((revision, index) => {
                            const applyId = `${key}-${index}`;
                            const applying = applyingRevisionId === applyId;
                            return (
                              <div
                                key={`${revision.targetType}-${revision.chapterId || 'book'}-${index}`}
                                className="rounded-lg border px-3 py-3 space-y-2"
                                style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
                              >
                                <div className="text-xs space-y-1" style={{ color: '#475569' }}>
                                  <p><strong>수정 대상</strong>: {getRevisionTargetLabel(revision)}</p>
                                  {revision.reason && <p><strong>이유</strong>: {revision.reason}</p>}
                                  {revision.requiresSourceCheck && (
                                    <p className="font-semibold" style={{ color: '#b91c1c' }}>
                                      출처 확인 필요
                                    </p>
                                  )}
                                </div>
                                <div className="grid gap-2 md:grid-cols-2">
                                  <div>
                                    <p className="mb-1 text-[11px] font-semibold text-gray-500">수정 전</p>
                                    <div
                                      className="rounded border px-2 py-2 text-xs whitespace-pre-wrap"
                                      style={{ borderColor: '#e5e7eb', backgroundColor: '#f8fafc', color: '#334155' }}
                                    >
                                      {revision.originalText}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="mb-1 text-[11px] font-semibold text-gray-500">수정 후</p>
                                    <div
                                      className="rounded border px-2 py-2 text-xs whitespace-pre-wrap"
                                      style={{ borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', color: '#166534' }}
                                    >
                                      {revision.revisedText}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => dismissRevision(key, index)}
                                    disabled={applying}
                                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                                    style={{ borderColor: '#d1d5db', color: '#4b5563' }}
                                  >
                                    {getRevisionDismissLabel(revision)}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => applyRevision(key, revisionResult, revision, index)}
                                    disabled={applying || reviewing || publishing}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                    style={{ backgroundColor: '#10b981' }}
                                  >
                                    {applying ? '적용 중...' : getRevisionApplyLabel(revision)}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {override && (
                        <div
                          className="rounded-lg px-2 py-2 text-xs"
                          style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}
                        >
                          ✔ 사용자 확인 완료 ({formatTimestamp(override.confirmedAt)})
                          {override.note && <p className="mt-1">사유: {override.note}</p>}
                          <p className="mt-1">원고를 수정하지 않고 현재 내용을 유지하기로 확인한 기록입니다.</p>
                        </div>
                      )}

                      {needsUserAction && !override && criterion && (
                        <div
                          className="mt-2 rounded-lg border px-3 py-3 space-y-2"
                          style={
                            key === 'sensitive_content'
                              ? { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }
                              : { borderColor: '#e5e7eb', backgroundColor: '#fafafa' }
                          }
                        >
                          {key === 'sensitive_content' && (
                            <p className="text-xs font-semibold" style={{ color: '#b91c1c' }}>
                              ⚠️ AI가 위험 표현 가능성을 발견했습니다. 원고를 직접 확인한 뒤에만 확인 완료로 표시하세요.
                            </p>
                          )}
                          <textarea
                            value={noteDrafts[key] || ''}
                            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder={key === 'sensitive_content' ? '확인 사유를 반드시 입력하세요 (필수)' : '확인 사유 메모 (선택)'}
                            className="w-full rounded border px-2 py-1.5 text-xs outline-none"
                            style={{ borderColor: '#d1d5db', fontSize: 16 }}
                            rows={2}
                          />
                          <button
                            type="button"
                            onClick={() => confirmOverride(key, criterion.status)}
                            disabled={overrideSubmittingKey === key}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: '#1A3C6E' }}
                          >
                            {overrideSubmittingKey === key ? '저장 중...' : '사용자 확인 완료로 표시'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {overrideError && (
          <div className="mt-2 text-xs" style={{ color: '#b91c1c' }}>{overrideError}</div>
        )}

        <p className="mt-4 text-xs text-gray-500">
          7개 항목이 모두 통과 또는 사용자 확인 완료 상태여야 발행할 수 있습니다.
        </p>

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: '#d1d5db', color: '#4b5563' }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirmPublish()}
            disabled={!canPublish || publishing}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: '#10b981' }}
          >
            {publishing ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <GrapeLoadingMini size={16} color="#fff" />발행 중...
              </span>
            ) : '발행 확정'}
          </button>
        </div>
      </div>
    </div>
  );
}
