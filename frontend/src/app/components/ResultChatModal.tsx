import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { db } from '../../firebase';
import type { ResultChatConfig } from '../config/resultChatConfig';
import {
  chatWithResult,
  type ResultChatConfirmationType,
  type ResultChatMessage,
  type ResultChatSearchPreference,
} from '../services/resultChatService';
import { firestoreService } from '../services/firestoreService';

type ResultChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  recordId: string;
  sourceIndex?: number;
  title: string;
  dateLabel: string;
  config: ResultChatConfig;
  onMemoSaved?: (memoRecordId: string) => void;
};

function getThreadId(sourceKey: string, sourceIndex?: number) {
  return typeof sourceIndex === 'number' ? `${sourceKey}_${sourceIndex}` : sourceKey;
}

type PendingConfirmation = {
  question: string;
  confirmationType: ResultChatConfirmationType;
  notice: string;
  planLabel?: string;
  webSearchLimit?: number;
  webSearchUsedCount?: number;
  webSearchRemainingCount?: number;
};

export function ResultChatModal({
  isOpen,
  onClose,
  uid,
  recordId,
  sourceIndex,
  title,
  dateLabel,
  config,
  onMemoSaved,
}: ResultChatModalProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ResultChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedMemoIds, setSavedMemoIds] = useState<Record<number, string>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const threadId = useMemo(() => getThreadId(config.sourceKey, sourceIndex), [config.sourceKey, sourceIndex]);

  useEffect(() => {
    if (!isOpen || !uid || !recordId) return;
    let cancelled = false;
    setLoaded(false);
    setMessages([]);
    setStatusNotice(null);
    setPendingConfirmation(null);
    setSavedMemoIds({});

    const loadMessages = async () => {
      try {
        const messagesRef = collection(db, 'users', uid, 'records', recordId, 'resultThreads', threadId, 'messages');
        const snap = await getDocs(query(messagesRef, orderBy('createdAt', 'asc'), limit(50)));
        if (cancelled) return;
        setMessages(snap.docs.map((item) => ({ id: item.id, ...(item.data() as ResultChatMessage) })));
      } catch (error) {
        console.error('결과 대화 불러오기 실패:', error);
        if (!cancelled) toast.error('이전 대화를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [isOpen, uid, recordId, threadId]);

  if (!isOpen) return null;

  const openSavedMemo = (memoRecordId: string) => {
    if (!memoRecordId) return;
    if (onMemoSaved) {
      onMemoSaved(memoRecordId);
      return;
    }
    onClose();
    navigate('/sayu', {
      state: {
        filterFormat: '메모',
        openRecordId: memoRecordId,
      },
    });
  };

  const getPreviousUserQuestion = (assistantIndex: number) => {
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') return messages[i].content;
    }
    return '';
  };

  const sendQuestion = async (
    text: string,
    searchPreference: ResultChatSearchPreference = 'auto',
    options: { skipOptimisticUser?: boolean } = {},
  ) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setQuestion('');
    setStatusNotice(null);
    const optimistic: ResultChatMessage | null = options.skipOptimisticUser ? null : { role: 'user', content: trimmed };
    if (optimistic) setMessages((prev) => [...prev, optimistic]);

    try {
      const response = await chatWithResult({
        recordId,
        sourceKey: config.sourceKey,
        sourceIndex,
        question: trimmed,
        safetyMode: config.safetyMode,
        systemGuide: config.systemGuide,
        searchPreference,
      });
      if (response.requiresConfirmation && response.confirmationType) {
        if (optimistic) setMessages((prev) => prev.filter((item) => item !== optimistic));
        setPendingConfirmation({
          question: trimmed,
          confirmationType: response.confirmationType,
          notice: response.notice || '최신 외부자료를 확인하면 더 정확하게 답할 수 있습니다.',
          planLabel: response.planLabel,
          webSearchLimit: response.webSearchLimit,
          webSearchUsedCount: response.webSearchUsedCount,
          webSearchRemainingCount: response.webSearchRemainingCount,
        });
        return;
      }
      setPendingConfirmation(null);
      if (response.limitReached) {
        if (optimistic) setMessages((prev) => prev.filter((item) => item !== optimistic));
        setStatusNotice(response.notice || '이 결과에서 이용할 수 있는 최신자료 확인을 모두 사용했습니다.');
        return;
      }
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        answerRoute: response.answerRoute,
        routeLabel: response.routeLabel,
        webSearchUsed: response.webSearchUsed,
        professionalApiUsed: response.professionalApiUsed,
      }]);
      if (typeof response.webSearchRemainingCount === 'number' && response.webSearchRemainingCount === 0) {
        setStatusNotice('이 결과의 최신자료 확인은 모두 사용했습니다.\n나의 기록을 바탕으로 한 질문은 계속할 수 있습니다.');
      }
    } catch (error: any) {
      console.error('결과 대화 실패:', error);
      toast.error(error?.message || 'AI 응답을 생성하지 못했습니다.');
      if (optimistic) setMessages((prev) => prev.filter((item) => item !== optimistic));
      setQuestion(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const saveAsMemo = async (content: string, index: number) => {
    const text = content.trim();
    if (!text || savingIndex !== null) return;
    const savedMemoId = savedMemoIds[index];
    if (savedMemoId) {
      openSavedMemo(savedMemoId);
      return;
    }
    setSavingIndex(index);
    try {
      const memoRecordId = await firestoreService.saveResultChatMemo(uid, {
        answer: text,
        sourceRecordId: recordId,
        sourceKey: config.sourceKey,
        label: config.label,
        question: getPreviousUserQuestion(index),
        sourceIndex,
        threadId,
      });
      setSavedMemoIds((prev) => ({ ...prev, [index]: memoRecordId }));
      toast.success('AI 답변을 나의 기록에 저장했습니다.');
      openSavedMemo(memoRecordId);
    } catch (error) {
      console.error('메모 저장 실패:', error);
      toast.error('메모 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSavingIndex(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="결과 기반 AI 대화"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1800,
        backgroundColor: 'rgba(15, 23, 42, 0.48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '86vh',
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(15,23,42,0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header style={{ padding: '16px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: '#64748B' }}>{config.label} · {dateLabel}</p>
            <h2 style={{ margin: '4px 0 0', fontSize: 18, color: '#1A3C6E', lineHeight: 1.35, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
              {title || config.label}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          <p style={{ margin: '0 0 12px', padding: 12, borderRadius: 10, backgroundColor: '#F8FAFC', color: '#475569', fontSize: 12, lineHeight: 1.6 }}>
            📘 나의 기록을 바탕으로 답변합니다.
            {'\n'}편하게 추가 질문을 해보세요.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {config.quickQuestions.slice(0, 5).map((item) => (
              <button
                key={item}
                type="button"
                disabled={loading}
                onClick={() => sendQuestion(item)}
                style={{
                  minHeight: 34,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: '1px solid #D8C98A',
                  backgroundColor: '#FFFDF4',
                  color: '#4A5A2C',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >
                {item}
              </button>
            ))}
          </div>

          {pendingConfirmation && (
            <div style={{ marginBottom: 14, padding: 14, borderRadius: 10, border: '1px solid #BFDBFE', backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, fontWeight: 800, whiteSpace: 'pre-wrap' }}>
                {pendingConfirmation.notice}
              </p>
              {typeof pendingConfirmation.webSearchLimit === 'number' && (
                <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.5, color: '#1D4ED8', fontWeight: 700 }}>
                  {pendingConfirmation.planLabel || '이용권'} · 이 결과의 최신자료 확인 {pendingConfirmation.webSearchLimit}회 중 {pendingConfirmation.webSearchRemainingCount ?? 0}회 이용 가능
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {pendingConfirmation.confirmationType === 'ambiguous' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => sendQuestion(pendingConfirmation.question, 'record_only')}
                    style={{ minHeight: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #94A3B8', backgroundColor: '#FFFFFF', color: '#1F2937', fontSize: 12, fontWeight: 900, cursor: loading ? 'wait' : 'pointer' }}
                  >
                    나의 기록으로 답변
                  </button>
                )}
                <button
                  type="button"
                  disabled={loading || pendingConfirmation.webSearchRemainingCount === 0}
                  onClick={() => sendQuestion(pendingConfirmation.question, 'web_confirmed')}
                  style={{
                    minHeight: 34,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #1A3C6E',
                    backgroundColor: pendingConfirmation.webSearchRemainingCount === 0 ? '#E5E7EB' : '#1A3C6E',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: loading || pendingConfirmation.webSearchRemainingCount === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  최신자료 확인
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setQuestion(pendingConfirmation.question);
                    setPendingConfirmation(null);
                  }}
                  style={{ minHeight: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: 12, fontWeight: 900, cursor: loading ? 'wait' : 'pointer' }}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 180 }}>
            {!loaded && <p style={{ margin: 0, color: '#64748B', fontSize: 13 }}>대화를 불러오는 중...</p>}
            {loaded && messages.length === 0 && (
              <p style={{ margin: 0, color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '42px 12px' }}>
                추천 질문을 누르거나 직접 질문을 입력해 보세요.
              </p>
            )}
            {messages.map((message, index) => (
              <div
                key={message.id || `${message.role}_${index}`}
                style={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    borderRadius: 12,
                    padding: '10px 12px',
                    backgroundColor: message.role === 'user' ? '#1A3C6E' : '#F1F5F9',
                    color: message.role === 'user' ? '#FFFFFF' : '#1F2937',
                    fontSize: 13,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'keep-all',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {message.content}
                </div>
                {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2, maxWidth: '100%' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8' }}>🔎 출처</span>
                    {message.sources.map((src, i) => (
                      <a
                        key={`${src.uri}_${i}`}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#2563EB', textDecoration: 'none', wordBreak: 'break-all', overflowWrap: 'anywhere' }}
                      >
                        {src.title || src.uri}
                      </a>
                    ))}
                  </div>
                )}
                {message.role === 'assistant' && message.content.trim() && (
                  <button
                    type="button"
                    onClick={() => saveAsMemo(message.content, index)}
                    disabled={savingIndex === index}
                    style={{
                      minHeight: 28,
                      padding: '0 10px',
                      borderRadius: 999,
                      border: '1px solid #CBD5E1',
                      backgroundColor: savedMemoIds[index] ? '#F1F5F9' : '#FFFFFF',
                      color: savedMemoIds[index] ? '#16A34A' : '#1A3C6E',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: savingIndex === index ? 'wait' : 'pointer',
                    }}
                  >
                    {savedMemoIds[index] ? '✓ 저장됨 · 메모 바로 보기' : savingIndex === index ? '저장 중...' : '나의 기록에 메모 저장'}
                  </button>
                )}
              </div>
            ))}
            {loading && <p style={{ margin: 0, color: '#64748B', fontSize: 12 }}>AI가 답변을 정리하는 중...</p>}
          </div>
        </div>

        {statusNotice && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFBEB', color: '#92400E', fontSize: 12.5, lineHeight: 1.6, fontWeight: 700, wordBreak: 'keep-all' }}>
            {statusNotice}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendQuestion(question);
          }}
          style={{ padding: 14, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, backgroundColor: '#FFFFFF' }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={loading}
            placeholder="나의 기록을 바탕으로 자유롭게 질문해 보세요."
            style={{
              flex: 1,
              minWidth: 0,
              height: 42,
              borderRadius: 10,
              border: '1px solid #CBD5E1',
              padding: '0 12px',
              fontSize: 14,
              outline: 'none',
              backgroundColor: '#FFFFFF',
            }}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            style={{
              minWidth: 70,
              height: 42,
              borderRadius: 10,
              border: 'none',
              backgroundColor: loading || !question.trim() ? '#CBD5E1' : '#1A3C6E',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 900,
              cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
}
