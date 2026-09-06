import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { Paperclip, X } from 'lucide-react';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { db, storage } from '../../firebase';
import type { ResultChatConfig } from '../config/resultChatConfig';
import {
  chatWithResult,
  type HaruLawAttachmentRef,
  type ResultChatConfirmationType,
  type ResultChatMessage,
  type ResultChatSearchPreference,
} from '../services/resultChatService';
import { firestoreService } from '../services/firestoreService';
import { useSubscription } from '../hooks/useSubscription';

const SAFE_MARKDOWN_LINK_PATTERN = /^https?:\/\//i;

function isSafeMarkdownHref(href?: string): boolean {
  return typeof href === 'string' && SAFE_MARKDOWN_LINK_PATTERN.test(href.trim());
}

const MD_HEADING_BASE: CSSProperties = { fontWeight: 800, lineHeight: 1.4, color: 'inherit' };
const MD_H1_STYLE: CSSProperties = { ...MD_HEADING_BASE, fontSize: 17, margin: '8px 0 4px' };
const MD_H2_STYLE: CSSProperties = { ...MD_HEADING_BASE, fontSize: 16, margin: '8px 0 4px' };
const MD_H3_STYLE: CSSProperties = { ...MD_HEADING_BASE, fontSize: 15, margin: '6px 0 4px' };
const MD_PARAGRAPH_STYLE: CSSProperties = { margin: '0 0 6px' };
// Tailwind preflight sets `ul, ol { list-style: none }` globally, so bullets/numbers
// must be restored explicitly (same pattern already used in PDFDigest.tsx / SettingsPage.tsx).
const MD_UL_STYLE: CSSProperties = { margin: '2px 0 6px', paddingLeft: 20, listStyleType: 'disc' };
const MD_OL_STYLE: CSSProperties = { margin: '2px 0 6px', paddingLeft: 20, listStyleType: 'decimal' };
const MD_LIST_ITEM_STYLE: CSSProperties = { margin: '2px 0' };
const MD_LINK_STYLE: CSSProperties = { color: '#2563EB', wordBreak: 'break-all', overflowWrap: 'anywhere' };
const MD_BLOCKQUOTE_STYLE: CSSProperties = {
  margin: '6px 0',
  padding: '2px 10px',
  borderLeft: '3px solid #CBD5E1',
  opacity: 0.85,
};
const MD_HR_STYLE: CSSProperties = { border: 'none', borderTop: '1px solid #E2E8F0', margin: '10px 0' };
const MD_CODE_FONT = 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace';
const MD_PRE_STYLE: CSSProperties = {
  margin: '6px 0',
  padding: '10px 12px',
  borderRadius: 8,
  backgroundColor: '#0F172A',
  color: '#E2E8F0',
  fontSize: 12,
  lineHeight: 1.5,
  overflowX: 'auto',
  whiteSpace: 'pre',
  fontFamily: MD_CODE_FONT,
};
const MD_INLINE_CODE_STYLE: CSSProperties = {
  padding: '1px 5px',
  borderRadius: 4,
  backgroundColor: 'rgba(15, 23, 42, 0.08)',
  fontSize: 12,
  wordBreak: 'break-all',
  fontFamily: MD_CODE_FONT,
};
const MD_TABLE_WRAP_STYLE: CSSProperties = { overflowX: 'auto', maxWidth: '100%', margin: '6px 0' };
const MD_TABLE_STYLE: CSSProperties = { borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' };
const MD_TH_STYLE: CSSProperties = {
  border: '1px solid #CBD5E1',
  padding: '4px 8px',
  backgroundColor: '#E2E8F0',
  textAlign: 'left',
  fontWeight: 800,
};
const MD_TD_STYLE: CSSProperties = { border: '1px solid #E2E8F0', padding: '4px 8px' };

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  if (!isSafeMarkdownHref(href)) {
    return <span>{children}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={MD_LINK_STYLE}>
      {children}
    </a>
  );
}

function MarkdownCode({ className, children }: { className?: string; children?: ReactNode }) {
  const isBlock = /language-/.test(className || '') || String(children).includes('\n');
  if (isBlock) {
    return <code className={className}>{children}</code>;
  }
  return <code style={MD_INLINE_CODE_STYLE}>{children}</code>;
}

const resultChatMarkdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => <h1 style={MD_H1_STYLE}>{children}</h1>,
  h2: ({ children }: { children?: ReactNode }) => <h2 style={MD_H2_STYLE}>{children}</h2>,
  h3: ({ children }: { children?: ReactNode }) => <h3 style={MD_H3_STYLE}>{children}</h3>,
  h4: ({ children }: { children?: ReactNode }) => <h4 style={MD_H3_STYLE}>{children}</h4>,
  h5: ({ children }: { children?: ReactNode }) => <h5 style={MD_H3_STYLE}>{children}</h5>,
  h6: ({ children }: { children?: ReactNode }) => <h6 style={MD_H3_STYLE}>{children}</h6>,
  p: ({ children }: { children?: ReactNode }) => <p style={MD_PARAGRAPH_STYLE}>{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => <ul style={MD_UL_STYLE}>{children}</ul>,
  ol: ({ children }: { children?: ReactNode }) => <ol style={MD_OL_STYLE}>{children}</ol>,
  li: ({ children }: { children?: ReactNode }) => <li style={MD_LIST_ITEM_STYLE}>{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => <strong style={{ fontWeight: 800 }}>{children}</strong>,
  blockquote: ({ children }: { children?: ReactNode }) => <blockquote style={MD_BLOCKQUOTE_STYLE}>{children}</blockquote>,
  hr: () => <hr style={MD_HR_STYLE} />,
  a: MarkdownLink,
  pre: ({ children }: { children?: ReactNode }) => <pre style={MD_PRE_STYLE}>{children}</pre>,
  code: MarkdownCode,
  table: ({ children }: { children?: ReactNode }) => (
    <div style={MD_TABLE_WRAP_STYLE}>
      <table style={MD_TABLE_STYLE}>{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => <th style={MD_TH_STYLE}>{children}</th>,
  td: ({ children }: { children?: ReactNode }) => <td style={MD_TD_STYLE}>{children}</td>,
};

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
  attachments?: HaruLawAttachmentRef[];
};

const HARULAW_ATTACH_MAX_FILES = 5;
const HARULAW_ATTACH_ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);
const HARULAW_ATTACH_MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const HARULAW_ATTACH_MAX_PDF_BYTES = 50 * 1024 * 1024;

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
  const { subscription } = useSubscription();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<ResultChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedMemoIds, setSavedMemoIds] = useState<Record<number, string>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<HaruLawAttachmentRef[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const threadId = useMemo(() => getThreadId(config.sourceKey, sourceIndex), [config.sourceKey, sourceIndex]);
  const isHaruLaw = config.sourceKey === 'haruraw_sayu';
  const isPaidUser = subscription.status === 'active' && subscription.plan !== 'free';

  useEffect(() => {
    if (!isOpen || !uid || !recordId) return;
    let cancelled = false;
    setLoaded(false);
    setMessages([]);
    setStatusNotice(null);
    setPendingConfirmation(null);
    setSavedMemoIds({});
    setPendingAttachments([]);

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (!isHaruLaw || !isPaidUser) {
      toast.error('파일 첨부는 하루LAW 베이직·프리미엄 이용권 전용입니다.');
      event.target.value = '';
      return;
    }
    if (!uid || !recordId) {
      toast.error('첨부할 기록 정보를 확인하지 못했습니다.');
      event.target.value = '';
      return;
    }

    const remainingSlots = HARULAW_ATTACH_MAX_FILES - pendingAttachments.length;
    if (remainingSlots <= 0) {
      toast.error('파일은 최대 5개까지 첨부할 수 있습니다.');
      event.target.value = '';
      return;
    }

    const toUpload = files.slice(0, remainingSlots);
    for (const file of toUpload) {
      if (!HARULAW_ATTACH_ALLOWED_TYPES.has(file.type)) {
        toast.error(`${file.name}: PNG, JPEG, WebP, HEIC, PDF만 첨부할 수 있습니다.`);
        event.target.value = '';
        return;
      }
      const sizeLimit = file.type === 'application/pdf'
        ? HARULAW_ATTACH_MAX_PDF_BYTES
        : HARULAW_ATTACH_MAX_IMAGE_BYTES;
      if (file.size > sizeLimit) {
        toast.error(`${file.name}: 파일이 너무 큽니다. (이미지 7MB, PDF 50MB 이하)`);
        event.target.value = '';
        return;
      }
    }

    setUploadingFiles(true);
    try {
      const uploaded: HaruLawAttachmentRef[] = [];
      for (let i = 0; i < toUpload.length; i += 1) {
        const file = toUpload[i];
        const safeName = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = `users/${uid}/haruLawAttachments/${recordId}/${safeName}`;
        await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
        uploaded.push({ storagePath: path, mimeType: file.type, fileName: file.name });
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (error) {
      console.error('하루LAW 첨부 업로드 실패:', error);
      toast.error('파일 업로드에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setUploadingFiles(false);
      event.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const sendQuestion = async (
    text: string,
    searchPreference: ResultChatSearchPreference = 'auto',
    options: { skipOptimisticUser?: boolean; attachments?: HaruLawAttachmentRef[] } = {},
  ) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (uploadingFiles) {
      toast.info('파일 업로드가 끝난 뒤 전송해 주세요.');
      return;
    }

    const attachmentsToSend = 'attachments' in options
      ? options.attachments
      : (pendingAttachments.length > 0 ? pendingAttachments : undefined);

    setLoading(true);
    setQuestion('');
    setStatusNotice(null);
    const optimistic: ResultChatMessage | null = options.skipOptimisticUser
      ? null
      : { role: 'user', content: trimmed, ...(attachmentsToSend?.length ? { attachments: attachmentsToSend } : {}) };
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
        attachments: attachmentsToSend,
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
          attachments: attachmentsToSend,
        });
        return;
      }
      setPendingConfirmation(null);
      if (response.limitReached) {
        if (optimistic) setMessages((prev) => prev.filter((item) => item !== optimistic));
        setStatusNotice(response.notice || '이 결과에서 이용할 수 있는 최신자료 확인을 모두 사용했습니다.');
        return;
      }
      setPendingAttachments([]);
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
            📘 나의 기록을 바탕으로 답변하고,
            {'\n'}필요한 일반 정보도 함께 설명합니다.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {config.quickQuestions.slice(0, 5).map((item) => (
              <button
                key={item}
                type="button"
                disabled={loading || uploadingFiles}
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
                  cursor: loading || uploadingFiles ? 'wait' : 'pointer',
                }}
              >
                {item}
              </button>
            ))}
          </div>

          {isHaruLaw && pendingAttachments.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {pendingAttachments.map((att, index) => (
                <div
                  key={att.storagePath}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 8, border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', fontSize: 12, color: '#334155', maxWidth: 180 }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.mimeType === 'application/pdf' ? 'PDF' : '이미지'} · {att.fileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    aria-label="첨부 제거"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94A3B8', lineHeight: 1, fontSize: 14 }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

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
                    onClick={() => sendQuestion(pendingConfirmation.question, 'record_only', { attachments: pendingConfirmation.attachments })}
                    style={{ minHeight: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #94A3B8', backgroundColor: '#FFFFFF', color: '#1F2937', fontSize: 12, fontWeight: 900, cursor: loading ? 'wait' : 'pointer' }}
                  >
                    나의 기록으로 답변
                  </button>
                )}
                <button
                  type="button"
                  disabled={loading || pendingConfirmation.webSearchRemainingCount === 0}
                  onClick={() => sendQuestion(pendingConfirmation.question, 'web_confirmed', { attachments: pendingConfirmation.attachments })}
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
                    whiteSpace: message.role === 'user' ? 'pre-wrap' : 'normal',
                    wordBreak: 'keep-all',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={resultChatMarkdownComponents}>
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    message.content
                  )}
                </div>
                {message.role === 'user' && message.attachments && message.attachments.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' }}>
                    {message.attachments.map((att) => (
                      <span
                        key={att.storagePath}
                        style={{ maxWidth: 160, padding: '3px 7px', borderRadius: 999, backgroundColor: '#E0E7FF', color: '#1E3A8A', fontSize: 10.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={att.fileName}
                      >
                        {att.mimeType === 'application/pdf' ? 'PDF' : '이미지'} · {att.fileName}
                      </span>
                    ))}
                  </div>
                )}
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
          style={{ padding: 14, borderTop: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: '#FFFFFF' }}
        >
          {isHaruLaw && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              {isPaidUser ? (
                <button
                  type="button"
                  disabled={loading || uploadingFiles || pendingAttachments.length >= HARULAW_ATTACH_MAX_FILES}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    alignSelf: 'flex-start',
                    minHeight: 32,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: loading || uploadingFiles || pendingAttachments.length >= HARULAW_ATTACH_MAX_FILES ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Paperclip size={14} />
                  {uploadingFiles ? '업로드 중...' : `파일 첨부 (${pendingAttachments.length}/${HARULAW_ATTACH_MAX_FILES})`}
                </button>
              ) : (
                <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>
                  파일 첨부는 베이직·프리미엄 이용권 전용입니다.
                </p>
              )}
            </>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={loading || uploadingFiles}
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
              disabled={loading || uploadingFiles || !question.trim()}
              style={{
                minWidth: 70,
                height: 42,
                borderRadius: 10,
                border: 'none',
                backgroundColor: loading || uploadingFiles || !question.trim() ? '#CBD5E1' : '#1A3C6E',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 900,
                cursor: loading || uploadingFiles || !question.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              전송
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
