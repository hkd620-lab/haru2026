// 하루LAW 비서 — 법령 검색·첨부·AI 자문·판례·기록 저장.
// RecordPage 「하루LAW」 탭에 있던 코드를 그대로 옮겼다(동작 같음).
// - useHaruLaw: 상태와 처리. RecordPage 가 부르므로 다른 탭에 다녀와도 상태가 유지된다(옮기기 전과 같음).
// - HaruLawPanel: 화면. 화면 코드(JSX)는 원래 위치의 들여쓰기를 그대로 두었다.
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Paperclip } from 'lucide-react';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { firestoreService } from '../../services/firestoreService';
import GrapeLoadingMini from '../../components/GrapeLoadingMini';
import { toast } from 'sonner';
import { RecordFormat } from '../../types/haruTypes';
import { HARULAW_ATTACH_MAX_TOTAL_BYTES, HARULAW_ATTACH_MAX_PDF_BYTES, getHaruLawUserError, getHaruLawUserErrorByReason, getHaruLawPdfReadErrorName, hasReadableHaruLawPdfHeader, type HaruLawUserError } from '../../utils/haruLawError';
import { db, storage } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { RefObject } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';

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

type HaruLawAttachmentRef = {
  storagePath: string;
  mimeType: string;
  fileName: string;
  sizeBytes?: number;
};

function getLawEasySummary(title?: string, article?: string, description?: string): string {
  const text = `${title ?? ''} ${article ?? ''} ${description ?? ''}`;

  if (text.includes('불산입') || text.includes('제33조')) {
    return '❌ 경비로 인정되지 않을 수 있어요';
  }

  if (text.includes('필요경비') || text.includes('제27조')) {
    return '✅ 경비로 인정될 가능성이 있어요';
  }

  return '⚖️ 사실관계에 따라 달라질 수 있어요';
}

type UseHaruLawParams = {
  // RecordPage 의 입력 섹션(형식 선택 탭이 있는 곳). 안내→입력 전환 때 이 위치로 스크롤한다.
  lawEntrySectionRef: RefObject<HTMLElement | null>;
  // 베이직·프리미엄 이용권 여부(첨부 허용)
  isLawPaidUser: boolean;
  // 선택 날짜에 기존 기록이 없을 때 저장할 날씨·기온·기분(RecordPage 에서 고른 값)
  weather: string;
  temperature: string;
  mood: string;
};

export function useHaruLaw({ lawEntrySectionRef, isLawPaidUser, weather, temperature, mood }: UseHaruLawParams) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lawQuery, setLawQuery] = useState('');
  const [lawSaveDate, setLawSaveDate] = useState(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-');
  });
  const [lawGuideConfirmed, setLawGuideConfirmed] = useState(false);
  const [lawLoading, setLawLoading] = useState(false);
  const [lawResults, setLawResults] = useState<any[]>([]);
  const [lawSummary, setLawSummary] = useState('');
  const [lawError, setLawError] = useState<HaruLawUserError | null>(null);
  const lawSearchHistory = useRef<{query: string, summary: string, articles: any[]}[]>([]);
  const [activeLawQuery, setActiveLawQuery] = useState('');
  const [isSavingLaw, setIsSavingLaw] = useState(false);
  const lawSaveRef = useRef(false);
  const lawSaveMountedRef = useRef(true);
  useEffect(() => {
    lawSaveMountedRef.current = true;
    return () => { lawSaveMountedRef.current = false; };
  }, []);
  const [lawSaved, setLawSaved] = useState(false);
  const [lawSaveError, setLawSaveError] = useState<Pick<HaruLawUserError, 'title' | 'message' | 'retryable'> | null>(null);
  const [lawAttachments, setLawAttachments] = useState<HaruLawAttachmentRef[]>([]);
  const [activeLawAttachments, setActiveLawAttachments] = useState<HaruLawAttachmentRef[]>([]);
  const [uploadingLawFiles, setUploadingLawFiles] = useState(false);
  const lawFileInputRef = useRef<HTMLInputElement>(null);
  const [openCard, setOpenCard] = useState<{
    idx: number;
    type: 'explain' | 'prec';
    content: string;
    loading: boolean;
  } | null>(null);

  // 하루LAW 안내→입력 전환은 라우트 이동이 아니므로 새 입력 섹션을 직접 노출한다.
  useLayoutEffect(() => {
    if (!lawGuideConfirmed || !lawEntrySectionRef.current) return;
    const targetTop = lawEntrySectionRef.current.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: targetTop, left: 0, behavior: 'auto' });
  }, [lawGuideConfirmed]);

  const handleLawFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      event.target.value = '';
      return;
    }
    if (!isLawPaidUser) {
      toast.error('파일 첨부는 베이직·프리미엄 이용권 전용입니다.');
      event.target.value = '';
      return;
    }

    const remainingSlots = HARULAW_ATTACH_MAX_FILES - lawAttachments.length;
    if (remainingSlots <= 0) {
      toast.error('파일은 최대 5개까지 첨부할 수 있습니다.');
      event.target.value = '';
      return;
    }

    const toUpload = files.slice(0, remainingSlots);
    setUploadingLawFiles(true);
    try {
      for (const file of toUpload) {
        if (!HARULAW_ATTACH_ALLOWED_TYPES.has(file.type)) {
          const userError = getHaruLawUserErrorByReason('ATTACHMENT_UNSUPPORTED_TYPE');
          setLawError(userError);
          toast.error(userError.title);
          return;
        }
        const sizeLimit = file.type === 'application/pdf'
          ? HARULAW_ATTACH_MAX_PDF_BYTES
          : HARULAW_ATTACH_MAX_IMAGE_BYTES;
        if (file.size > sizeLimit) {
          toast.error(`${file.name}: 파일이 너무 큽니다. (이미지 7MB, PDF 50MB 이하)`);
          return;
        }
      }
      const selectedTotalBytes = toUpload.reduce((total, file) => total + file.size, 0);
      const currentTotalBytes = lawAttachments.reduce(
        (total, attachment) => total + (attachment.sizeBytes || 0),
        0,
      );
      if (currentTotalBytes + selectedTotalBytes > HARULAW_ATTACH_MAX_TOTAL_BYTES) {
        const userError = getHaruLawUserErrorByReason('ATTACHMENT_TOTAL_SIZE_EXCEEDED');
        setLawError(userError);
        toast.error(userError.title);
        return;
      }
      for (const file of toUpload) {
        if (file.type === 'application/pdf') {
          let header: Uint8Array;
          try {
            header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
          } catch (error) {
            console.warn('[HARULAW_PDF_PREFLIGHT]', {
              stage: 'pdf_header_read',
              errorName: getHaruLawPdfReadErrorName(error),
            });
            const userError = getHaruLawUserErrorByReason('ATTACHMENT_PDF_UNREADABLE');
            setLawError(userError);
            toast.error(userError.title);
            return;
          }
          if (!hasReadableHaruLawPdfHeader(header)) {
            console.warn('[HARULAW_PDF_PREFLIGHT]', {
              stage: 'pdf_header_validate',
              bytesRead: header.length,
              headerValid: false,
            });
            const userError = getHaruLawUserErrorByReason('ATTACHMENT_PDF_UNREADABLE');
            setLawError(userError);
            toast.error(userError.title);
            return;
          }
        }
      }

      setLawError(null);
      const uploaded: HaruLawAttachmentRef[] = [];
      const draftId = `draft_${Date.now()}`;
      for (let i = 0; i < toUpload.length; i += 1) {
        const file = toUpload[i];
        const safeName = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = `users/${user.uid}/haruLawAttachments/${draftId}/${safeName}`;
        await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
        uploaded.push({ storagePath: path, mimeType: file.type, fileName: file.name, sizeBytes: file.size });
      }
      setLawAttachments((prev) => [...prev, ...uploaded]);
    } catch {
      console.error('하루LAW 첨부 업로드 실패');
      toast.error('파일 업로드에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setUploadingLawFiles(false);
      event.target.value = '';
    }
  };

  const handleLawSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!lawQuery.trim()) return;
    if (uploadingLawFiles) {
      toast.info('파일 업로드가 끝난 뒤 전송해 주세요.');
      return;
    }
    setLawLoading(true);
    setLawResults([]);
    setLawSummary('');
    setLawError(null);
    const attachmentsToSend = [...lawAttachments];
    setLawSaveError(null);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const lawSearch = httpsCallable(functions, 'lawSearch');
      const res: any = await lawSearch({
        query: lawQuery,
        ...(attachmentsToSend.length > 0 ? { attachments: attachmentsToSend } : {}),
      });
      const data = res.data;
      if (!data.success) {
        setLawError({
          reason: 'NO_RESULTS',
          title: '관련 법령을 찾지 못했습니다',
          message: data.message || '질문을 조금 더 구체적으로 입력해 주세요.',
          retryable: false,
        });
        return;
      }
      setLawSaved(false);
      setActiveLawQuery(lawQuery);
      setActiveLawAttachments(attachmentsToSend);
      setLawResults(data.data);
      setLawSummary(data.aiSummary);
      // 검색 이력 저장
      lawSearchHistory.current = [
        { query: lawQuery, summary: data.aiSummary, articles: data.data },
        ...lawSearchHistory.current,
      ].slice(0, 10);
    } catch (error) {
      setLawError(getHaruLawUserError(error));
    } finally {
      setLawLoading(false);
    }
  };

  const handleLawSaveDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadingLawFiles || lawLoading || isSavingLaw || lawSaveRef.current) return;
    setLawSaveDate(event.target.value);
    setLawSaved(false);
    setLawSaveError(null);
  };

  const handleSaveLawResult = async () => {
    if (lawSaveRef.current || lawSaved) return;
    if (!user) {
      setLawSaveError({
        title: '로그인이 필요합니다',
        message: '로그인 상태를 확인한 뒤 다시 저장해 주세요. 질문·분석 결과·첨부파일은 그대로 유지했습니다.',
        retryable: false,
      });
      return;
    }
    if (!lawResults.length) {
      setLawSaveError({
        title: '저장할 분석 결과가 없습니다',
        message: '하루LAW 분석 결과가 표시된 뒤 저장해 주세요. 질문과 첨부파일은 그대로 유지했습니다.',
        retryable: false,
      });
      return;
    }
    const parsedSaveDate = new Date(`${lawSaveDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lawSaveDate)
      || Number.isNaN(parsedSaveDate.getTime())
      || parsedSaveDate.toISOString().slice(0, 10) !== lawSaveDate) {
      setLawSaveError({
        title: '저장 날짜를 선택해 주세요',
        message: '유효한 저장 날짜를 선택한 뒤 다시 저장해 주세요. 질문·분석 결과·첨부파일은 그대로 유지했습니다.',
        retryable: true,
      });
      return;
    }
    lawSaveRef.current = true;
    setLawSaveError(null);
    setIsSavingLaw(true);
    let saveStage: 'getDoc' | 'saveRecord' = 'getDoc';
    try {
      const dateStr = lawSaveDate;
      const articlesText = lawResults
        .map((a: any) => `[${a.lawName}] ${a.articleStr}(${a.title})\n${a.content}`)
        .join('\n\n');
      const recordRef = doc(db, 'users', user.uid, 'records', dateStr);
      const existingSnap = await getDoc(recordRef);
      const existingRecord = existingSnap.exists() ? existingSnap.data() : null;
      const existingFormats = Array.isArray(existingRecord?.formats) ? existingRecord.formats : [];
      const mergedFormats = Array.from(new Set([...existingFormats, 'HARUraw'])) as RecordFormat[];
      saveStage = 'saveRecord';
      const recordId = await firestoreService.saveRecord(user.uid, {
        id: dateStr,
        date: dateStr,
        weather: existingRecord?.weather || weather,
        temperature: existingRecord?.temperature || temperature,
        mood: existingRecord?.mood || mood,
        formats: mergedFormats,
        content: typeof existingRecord?.content === 'string' ? existingRecord.content : '',
        sourceAgent: '하루LAW',
        haruraw_query: activeLawQuery,
        haruraw_sayu: lawSummary,
        haruraw_summary: lawSummary,
        haruraw_articles: articlesText,
        haruraw_simple: `${activeLawQuery}\n\n${lawSummary}`,
        ...(activeLawAttachments.length > 0 ? { haruraw_attachments: activeLawAttachments } : {}),
      });
      setLawSaved(true);
      toast.success('하루LAW 분석 결과가 사유-나의 기록에 저장되었습니다.');
      if (lawSaveMountedRef.current) {
        navigate('/sayu', { state: { filterFormat: '하루LAW', tab: 'assistants', openRecordId: recordId } });
      }
    } catch (err) {
      const rawCode = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
      const candidateCode = typeof rawCode === 'string' ? rawCode.replace(/^firestore\//, '') : '';
      const safeCode = [
        'permission-denied', 'unauthenticated', 'unavailable', 'deadline-exceeded',
        'cancelled', 'resource-exhausted', 'aborted', 'failed-precondition',
        'invalid-argument', 'not-found', 'already-exists', 'out-of-range',
        'unimplemented', 'internal', 'data-loss', 'unknown',
      ].includes(candidateCode) ? candidateCode : 'unknown';
      console.error('하루LAW 저장 실패', { stage: saveStage, code: safeCode });
      const cause = safeCode === 'permission-denied' || safeCode === 'unauthenticated'
        ? '접근 권한 또는 로그인 상태를 확인해 주세요.'
        : safeCode === 'unavailable' || safeCode === 'deadline-exceeded'
          ? '네트워크 연결을 확인한 뒤 잠시 후 다시 시도해 주세요.'
          : '잠시 후 다시 시도해 주세요.';
      const title = saveStage === 'getDoc'
        ? '선택 날짜의 기존 기록을 확인하지 못했습니다'
        : '분석 결과를 기록에 저장하지 못했습니다';
      setLawSaveError({
        title,
        message: `${cause} 질문·분석 결과·첨부파일은 그대로 유지했습니다. 오류 코드: ${safeCode}`,
        retryable: true,
      });
      toast.error(title);
    } finally {
      lawSaveRef.current = false;
      setIsSavingLaw(false);
    }
  };

  const handleEasyExplain = async (article: any, idx: number) => {
    if (openCard?.idx === idx && openCard?.type === 'explain') {
      setOpenCard(null);
      return;
    }
    setOpenCard({ idx, type: 'explain', content: '', loading: true });

    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'lawEasyExplain');
      const res: any = await fn({
        lawName: article.lawName,
        articleStr: article.articleStr,
        lawText: `${article.articleStr}(${article.title}): ${article.content}`,
        userQuery: activeLawQuery,
      });
      const explanation = res.data.explanation;
      setOpenCard({ idx, type: 'explain', content: explanation, loading: false });
    } catch {
      setOpenCard({ idx, type: 'explain', content: 'AI자문을 불러오지 못했습니다.', loading: false });
    }
  };

  const handlePrecedent = async (article: any, idx: number) => {
    if (openCard?.idx === idx && openCard?.type === 'prec') {
      setOpenCard(null);
      return;
    }
    setOpenCard({ idx, type: 'prec', content: '', loading: true });
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'lawPrecedent');
      const res: any = await fn({
        lawText: `${article.articleStr}(${article.title}): ${article.content}`,
        userQuery: activeLawQuery,
      });
      const precs = res.data.precedents;
      if (precs.length === 0) {
        const message = res.data?.message || '관련 판례를 찾을 수 없습니다';
        const disclaimer = res.data?.disclaimer || '';
        setOpenCard({
          idx,
          type: 'prec',
          content: `${message}\n\n${disclaimer}`.trim(),
          loading: false,
        });
        return;
      }
      const body = precs.map((p: any) => {
        const lines = [
          `📌 ${p.caseName}`,
          p.caseNum,
          p.summary,
        ];
        if (p.detailLink) {
          lines.push(`🔗 법령정보센터에서 전체 판례 보기 ${p.detailLink}`);
        }
        return lines.join('\n');
      }).join('\n\n');
      setOpenCard({ idx, type: 'prec', content: body, loading: false });
    } catch {
      setOpenCard({ idx, type: 'prec', content: '판례를 불러오지 못했습니다.', loading: false });
    }
  };

  return {
    isLawPaidUser,
    lawQuery,
    setLawQuery,
    lawSaveDate,
    setLawSaveDate,
    lawGuideConfirmed,
    setLawGuideConfirmed,
    lawLoading,
    setLawLoading,
    lawResults,
    setLawResults,
    lawSummary,
    setLawSummary,
    lawError,
    setLawError,
    lawSearchHistory,
    activeLawQuery,
    setActiveLawQuery,
    isSavingLaw,
    setIsSavingLaw,
    lawSaveRef,
    lawSaveMountedRef,
    lawSaved,
    setLawSaved,
    lawSaveError,
    setLawSaveError,
    lawAttachments,
    setLawAttachments,
    activeLawAttachments,
    setActiveLawAttachments,
    uploadingLawFiles,
    setUploadingLawFiles,
    lawFileInputRef,
    openCard,
    setOpenCard,
    handleLawFileSelect,
    handleLawSearch,
    handleLawSaveDateChange,
    handleSaveLawResult,
    handleEasyExplain,
    handlePrecedent,
  };
}

export type HaruLawState = ReturnType<typeof useHaruLaw>;

export function HaruLawPanel({ law }: { law: HaruLawState }) {
  const {
    lawQuery,
    setLawQuery,
    lawSaveDate,
    lawGuideConfirmed,
    setLawGuideConfirmed,
    lawLoading,
    lawResults,
    setLawResults,
    lawSummary,
    setLawSummary,
    lawError,
    lawSearchHistory,
    activeLawQuery,
    isSavingLaw,
    lawSaved,
    lawSaveError,
    lawAttachments,
    setLawAttachments,
    uploadingLawFiles,
    lawFileInputRef,
    openCard,
    handleLawFileSelect,
    handleLawSearch,
    handleLawSaveDateChange,
    handleSaveLawResult,
    handleEasyExplain,
    isLawPaidUser,
  } = law;
  const renderStyledContent = (text: string) => (
    <div style={{
      background: 'linear-gradient(135deg, #fdf6ff 0%, #f0f7ff 50%, #f6fff0 100%)',
      padding: '20px 20px 24px 20px',
      borderRadius: 8,
    }}>
      <div style={{
        width: 40, height: 3,
        background: 'linear-gradient(90deg, #8B4789, #4a90d9)',
        borderRadius: 2, marginBottom: 16,
      }} />
      {text.split('\n').map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} style={{ height: 8 }} />;
        const cleanLine = trimmed.replace(/\*\*/g, '');
        if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
          return (
            <p key={lineIdx} style={{
              fontSize: 15, fontWeight: 800, color: '#2d1b4e',
              marginBottom: 10, marginTop: lineIdx > 0 ? 18 : 0,
              paddingLeft: 10, borderLeft: '3px solid #8B4789', lineHeight: 1.5,
            }}>{cleanLine}</p>
          );
        }
        if (/^\*\*\d+\./.test(trimmed) || /^\d+\./.test(trimmed)) {
          return (
            <p key={lineIdx} style={{
              fontSize: 13, fontWeight: 700, color: '#4a2d7a',
              marginBottom: 6, marginTop: 14, lineHeight: 1.6,
            }}>{cleanLine}</p>
          );
        }
        if (trimmed.startsWith('🔗')) {
          const urlMatch = trimmed.match(/(https?:\/\/\S+)/);
          if (urlMatch) {
            const url = urlMatch[1];
            const label = trimmed.replace(url, '').trim();
            return (
              <p key={lineIdx} style={{
                fontSize: 12, marginTop: 6, marginBottom: 4, lineHeight: 1.6,
              }}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#4a90d9', textDecoration: 'underline' }}
                >{label} ↗</a>
              </p>
            );
          }
        }
        return (
          <p key={lineIdx} style={{
            fontSize: 13, color: '#3a3a4a',
            lineHeight: 1.85, marginBottom: 4, letterSpacing: '0.01em',
          }}>{cleanLine}</p>
        );
      })}
      <div style={{
        marginTop: 20, textAlign: 'center' as const,
        fontSize: 16, color: '#c9b8e0', letterSpacing: 8,
      }}>✦ ✦ ✦</div>
    </div>
  );

  return (
  !lawGuideConfirmed ? (
    <div style={{
      backgroundColor: '#f0f4ff',
      border: '1px solid #c7d9f8',
      borderRadius: 12,
      padding: 20,
      marginTop: 4,
    }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', marginBottom: 12 }}>
        ⚖️ 하루LAW 법률 자문 서비스
      </p>
      <div style={{ fontSize: 13, color: '#444', lineHeight: 1.8, marginBottom: 16 }}>
        <p style={{ marginBottom: 8 }}>
          📌 국가 법령정보센터 공식 API로 실제 법령을 검색하고, AI가 분석하여 자문을 제공합니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          ✅ 실제 법령 데이터 기반으로 분석하기 때문에 AI가 법령을 임의로 만들어내는 환각(Hallucination) 현상이 없습니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          💡 가해자·피해자 두 가지 관점에서 가상 시나리오로 자문을 드립니다.
        </p>
        <p style={{ color: '#cc4444', fontWeight: 600 }}>
          ⚠️ 본 서비스는 참고용 자문이며, 실제 법적 조치는 반드시 변호사와 상담하시기 바랍니다.
        </p>
      </div>
      <button
        onClick={() => setLawGuideConfirmed(true)}
        style={{
          width: '100%',
          padding: '12px 0',
          backgroundColor: '#1A3C6E',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        확인했습니다, 자문 받기 →
      </button>
    </div>
  ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <label htmlFor="law-save-date" style={{ fontSize: 13, color: '#1A3C6E' }}>저장 날짜</label>
                <input
                  id="law-save-date"
                  type="date"
                  value={lawSaveDate}
                  onChange={handleLawSaveDateChange}
                  disabled={uploadingLawFiles || lawLoading || isSavingLaw}
                  style={{ padding: '8px 10px', fontSize: 16, border: '1px solid #1A3C6E', borderRadius: 8 }}
                />
              </div>
              {/* 검색창 */}
              <form onSubmit={handleLawSearch} style={{ marginBottom: 12 }}>
                <textarea
                  rows={3}
                  aria-label="하루LAW 질문"
                  value={lawQuery}
                  onChange={(e) => setLawQuery(e.target.value)}
                  disabled={lawLoading || uploadingLawFiles}
                  placeholder="예: 내 딸아이가 친구로부터 사이버 괴롭힘을 당하고 있어요 어떻게 하면 좋을까요?"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box', resize: 'none',
                    padding: '10px 12px', fontSize: 16, lineHeight: '24px',
                    border: '1.5px solid #1A3C6E', borderRadius: 8,
                    outline: 'none', backgroundColor: '#FEFBE8',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => lawFileInputRef.current?.click()}
                    disabled={!isLawPaidUser || lawLoading || uploadingLawFiles || lawAttachments.length >= HARULAW_ATTACH_MAX_FILES}
                    title={!isLawPaidUser ? '베이직·프리미엄 이용권 전용' : '파일 첨부 (이미지·PDF, 최대 5개)'}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: !isLawPaidUser ? '#E5E7EB' : '#EEF2FF',
                      color: !isLawPaidUser ? '#9CA3AF' : '#1A3C6E',
                      border: '1.5px solid',
                      borderColor: !isLawPaidUser ? '#D1D5DB' : '#1A3C6E',
                      borderRadius: 8,
                      cursor: !isLawPaidUser || lawLoading || uploadingLawFiles || lawAttachments.length >= HARULAW_ATTACH_MAX_FILES ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      position: 'relative',
                    }}
                  >
                    <Paperclip size={16} />
                    {lawAttachments.length > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        backgroundColor: '#1A3C6E',
                        color: '#FFFFFF',
                        borderRadius: '50%',
                        width: 16,
                        height: 16,
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {lawAttachments.length}
                      </span>
                    )}
                  </button>
                  <input
                    ref={lawFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleLawFileSelect}
                  />
                  <button
                    type="submit"
                    disabled={lawLoading || uploadingLawFiles}
                    style={{
                      padding: '10px 14px', backgroundColor: lawLoading || uploadingLawFiles ? '#CBD5E1' : '#1A3C6E',
                      color: '#fff', border: 'none', borderRadius: 8,
                      fontWeight: 600, fontSize: 13, cursor: lawLoading || uploadingLawFiles ? 'not-allowed' : 'pointer',
                    }}
                  >
                    법률자문
                  </button>
                </div>
                {lawAttachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {lawAttachments.map((att, index) => (
                      <div
                        key={att.storagePath}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, backgroundColor: '#EEF2FF', borderRadius: 8, padding: '4px 8px', fontSize: 12, color: '#1A3C6E', maxWidth: 180 }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {att.mimeType === 'application/pdf' ? 'PDF' : '이미지'} · {att.fileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLawAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                          aria-label="첨부 제거"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6B7280', padding: 0, lineHeight: 1 }}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadingLawFiles && (
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '6px 0 0' }}>파일 업로드 중...</p>
                )}
                {!isLawPaidUser && (
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0' }}>
                    파일 첨부는 베이직·프리미엄 이용권 전용 기능입니다.
                  </p>
                )}
              </form>

              {/* 로딩 */}
              {lawLoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px 0' }}>
                  <GrapeLoadingMini size={32} />
                  <span style={{ color: '#1A3C6E', fontSize: 13 }}>⚖️ 법령 분석 중...</span>
                </div>
              )}

              {/* 에러 */}
              {lawError && (
                <div style={{
                  padding: 12, backgroundColor: '#fff3f3',
                  border: '1px solid #ffcccc', borderRadius: 8,
                  color: '#cc0000', fontSize: 13, marginBottom: 8,
                }}>
                  <strong style={{ display: 'block', marginBottom: 4 }}>{lawError.title}</strong>
                  <span style={{ display: 'block', lineHeight: 1.6 }}>{lawError.message}</span>
                  {lawError.retryable && lawError.actionLabel && (
                    <button
                      type="button"
                      disabled={lawLoading || uploadingLawFiles}
                      onClick={() => handleLawSearch()}
                      style={{
                        marginTop: 8,
                        padding: '6px 10px',
                        border: '1px solid #cc0000',
                        borderRadius: 7,
                        backgroundColor: '#FFFFFF',
                        color: '#A00000',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: lawLoading || uploadingLawFiles ? 'wait' : 'pointer',
                      }}
                    >
                      {lawError.actionLabel}
                    </button>
                  )}
                </div>
              )}


              {lawResults.length > 0 && (
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px solid #D9E5FF',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  boxShadow: '0 1px 2px rgba(26,60,110,0.06)',
                }}>
                  <p style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, marginBottom: 6 }}>질문</p>
                  <p style={{ fontSize: 14, color: '#1A3C6E', fontWeight: 700, lineHeight: 1.6, marginBottom: 12 }}>
                    {activeLawQuery}
                  </p>
                  <p style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, marginBottom: 6 }}>핵심 답변</p>
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
                    {lawSummary || '관련 조문을 바탕으로 검토가 필요합니다. 사례관계에 따라 실제 판단은 달라질 수 있습니다.'}
                  </p>
                  <p style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, marginBottom: 6 }}>AI 분석</p>
                  <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.7, marginBottom: 12 }}>
                    아래 관련 조문을 기준으로 쉬운 해석을 확인할 수 있습니다. 단정적인 결론이 아니라 가능성, 주의점, 추가 확인이 필요한 부분을 중심으로 보세요.
                  </p>
                  <p style={{ fontSize: 11, color: '#92400E', lineHeight: 1.6, margin: 0 }}>
                    본 내용은 법령 정보 제공 목적이며, 전문적인 법률 자문을 대체하지 않습니다.
                  </p>
                </div>
              )}

              {/* 법령 카드 목록 */}
              {lawResults.map((article, idx) => (
                <div key={idx} style={{
                  backgroundColor: '#fff', border: '1px solid #e0e0e0',
                  borderRadius: 8, padding: 12, marginBottom: 8,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#1A3C6E', marginBottom: 8 }}>
                    {getLawEasySummary(article.title, `${article.lawName} ${article.articleStr}`, article.content)}
                  </p>

                  {/* 법령 뱃지 + 법령명 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      backgroundColor: '#1A3C6E', color: '#fff',
                      borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                    }}>
                      {article.articleStr}
                    </span>
                    <span style={{ fontSize: 11, color: '#777' }}>{article.lawName}</span>
                  </div>

                  {/* 조문 제목 */}
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 4 }}>
                    {article.title}
                  </p>

                  {/* 조문 내용 */}
                  <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 10 }}>
                    {article.content}
                  </p>

                  {/* 버튼 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleEasyExplain(article, idx)}
                      style={{
                        flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600,
                        backgroundColor: openCard?.idx === idx && openCard?.type === 'explain'
                          ? '#1A3C6E' : '#EEF4FF',
                        color: openCard?.idx === idx && openCard?.type === 'explain'
                          ? '#fff' : '#1A3C6E',
                        border: '1px solid #c7d9f8', borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      💡 AI 해석보기
                    </button>
                    {/* 1차 버전에서는 판례 숨김 */}
                  </div>

                  {/* 인라인 결과 펼침 */}
                  {openCard?.idx === idx && openCard.type === 'explain' && (
                    <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden' }}>
                      {openCard.loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: 16 }}>
                          <GrapeLoadingMini size={28} />
                          <span style={{ fontSize: 12, color: '#999' }}>분석 중...</span>
                        </div>
                      ) : (
                        renderStyledContent(openCard.content)
                      )}
                    </div>
                  )}
                </div>
              ))}

              {lawSaveError && (
                <div role="alert" style={{
                  padding: 12, backgroundColor: '#fff3f3',
                  border: '1px solid #ffcccc', borderRadius: 8,
                  color: '#cc0000', fontSize: 13, marginBottom: 8,
                }}>
                  <strong style={{ display: 'block', marginBottom: 4 }}>{lawSaveError.title}</strong>
                  <span style={{ display: 'block', lineHeight: 1.6 }}>{lawSaveError.message}</span>
                  {lawSaveError.retryable && (
                    <button
                      type="button"
                      disabled={isSavingLaw || lawSaved}
                      onClick={handleSaveLawResult}
                      style={{
                        marginTop: 8, padding: '6px 10px',
                        border: '1px solid #cc0000', borderRadius: 7,
                        backgroundColor: '#FFFFFF', color: '#A00000',
                        fontSize: 12, fontWeight: 800,
                        cursor: isSavingLaw ? 'wait' : 'pointer',
                      }}
                    >
                      저장 다시 시도
                    </button>
                  )}
                </div>
              )}

              {/* 저장 버튼 */}
              {lawResults.length > 0 && (
                <div style={{ marginTop: 4, marginBottom: 12 }}>
                  <button
                    onClick={handleSaveLawResult}
                    disabled={isSavingLaw || lawSaved}
                    style={{
                      width: '100%',
                      padding: '10px 0',
                      backgroundColor: lawSaved ? '#10b981' : '#1A3C6E',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: lawSaved ? 'default' : 'pointer',
                    }}
                  >
                    {lawSaved ? '✅ 저장 완료!' : isSavingLaw ? '저장 중...' : '💾 사유-나의 기록에 저장'}
                  </button>
                  <p style={{ marginTop: 8, fontSize: 12, color: '#6B7280', lineHeight: 1.5, textAlign: 'center' }}>
                    분석 결과는 사유-나의 기록에 저장해 나중에 다시 확인할 수 있습니다.
                  </p>
                </div>
              )}

              {/* 검색 이력 목록 */}
              {lawSearchHistory.current.length > 0 && lawResults.length === 0 && !lawLoading && (
                <div>
                  <p style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>최근 검색 이력</p>
                  {lawSearchHistory.current.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setLawQuery(item.query);
                        setLawResults(item.articles);
                        setLawSummary(item.summary);
                      }}
                      style={{
                        padding: '8px 12px', backgroundColor: '#fff',
                        border: '1px solid #e5e5e5', borderRadius: 8,
                        marginBottom: 6, cursor: 'pointer', fontSize: 13, color: '#333',
                      }}
                    >
                      ⚖️ {item.query}
                    </div>
                  ))}
                </div>
              )}

              {/* 초기 안내 */}
              {!lawLoading && lawResults.length === 0 && !lawError && lawSearchHistory.current.length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', fontSize: 13, padding: '16px 0' }}>
                  일상어로 질문하시면 관련 법령을 찾아드립니다
                </p>
              )}

              {/* 면책 문구 */}
              <p style={{ fontSize: 10, color: '#bbb', textAlign: 'center', marginTop: 12 }}>
                본 서비스는 법령 정보 제공 목적이며, 법률 자문을 대체하지 않습니다.
              </p>
            </div>
  )
  );
}
