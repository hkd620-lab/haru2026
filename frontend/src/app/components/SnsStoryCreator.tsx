import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { db, functions } from '../../firebase';
import { activeSnsRecords } from '../utils/snsRecordState';
import type { SnsRecord } from '../utils/snsRecordState';
import {
  SNS_STORY_FINAL_CALLABLE_TIMEOUT_MS,
  SNS_STORY_SYNOPSIS_CALLABLE_TIMEOUT_MS,
  buildSnsStoryFinalLogicalKey,
  buildSnsStorySelectionKey,
  createSnsStoryRequestCoordinator,
  getOrCreateDurableSnsStoryRequestTimestamp,
  isSnsStoryAmbiguousCallableError,
  normalizeSnsStoryRequestBase,
} from '../utils/snsStoryRequestState';
import type { useSnsSession } from '../hooks/useSnsRecords';

const COLOR_BLUE = '#1A3C6E';
const COLOR_BG_SOFT = '#F5F7FB';
const COLOR_BORDER = '#e5e5e5';
const COLOR_GREEN = '#10b981';
const COLOR_TEXT = '#222';
const SNS_GALMURI_LABEL = 'SNS 갈무리';

type RangeType = 'all' | 'year' | 'custom';

interface SnsStoryCreatorProps {
  rawRecords: SnsRecord[];
  loadingRecords: boolean;
  serverReady: boolean;
  recordsError: string;
  session: ReturnType<typeof useSnsSession>;
  userUid?: string | null;
}

interface StoryCounts {
  total: number;
  included: number;
  excluded: number;
  textOnly: number;
  photoOnly: number;
  textAndPhoto: number;
}

interface SynopsisResponse {
  synopsis?: string;
  counts?: StoryCounts;
  sourceRecordIds?: string[];
  sourceFingerprint?: string;
  range?: unknown;
  model?: string;
}

interface FinalResponse {
  status?: 'completed' | 'generating';
  recordId?: string;
  recordPath?: string;
  title?: string;
  content?: string;
  message?: string;
}

interface SnsStoryArtwork {
  id: string;
  date: string;
  essay_title?: string;
  essay_ai_title?: string;
  content?: string;
  essay_sayu?: string;
  source?: string;
  generationStatus?: string;
  createdAt?: unknown;
}

function normalizeTimestampMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 1e12 ? value * 1000 : value;
}

function kstDateStringFromTimestamp(value: number): string {
  const ms = normalizeTimestampMs(value);
  if (!ms) return '1970-01-01';
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function kstStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00+09:00`);
}

function kstEndMs(date: string): number {
  return Date.parse(`${date}T23:59:59.999+09:00`);
}

function inRange(record: SnsRecord, rangeType: RangeType, year: string, from: string, to: string): boolean {
  const date = kstDateStringFromTimestamp(record.timestamp);
  if (rangeType === 'all') return true;
  if (rangeType === 'year') return Boolean(year) && date.slice(0, 4) === year;
  if (!from || !to) return false;
  const ms = normalizeTimestampMs(record.timestamp);
  return ms >= kstStartMs(from) && ms <= kstEndMs(to);
}

function countRecords(periodRecords: SnsRecord[], includedRecords: SnsRecord[]): StoryCounts {
  const includedIds = new Set(includedRecords.map((record) => record.id));
  const counts: StoryCounts = {
    total: periodRecords.length,
    included: includedRecords.length,
    excluded: periodRecords.filter((record) => !includedIds.has(record.id)).length,
    textOnly: 0,
    photoOnly: 0,
    textAndPhoto: 0,
  };
  includedRecords.forEach((record) => {
    const hasText = record.text.trim().length > 0;
    const hasPhoto = record.thumbnails.length > 0;
    if (hasText && hasPhoto) counts.textAndPhoto += 1;
    else if (hasText) counts.textOnly += 1;
    else if (hasPhoto) counts.photoOnly += 1;
  });
  return counts;
}

function shortErrorMessage(error: any): string {
  const reason = error?.details?.reason || error?.customData?.reason;
  if (reason === 'SNS_STORY_RANGE_TOO_LARGE') {
    return '기록이 너무 많습니다. 기간을 줄이거나 일부 기록을 제외해 주세요.';
  }
  if (reason === 'SNS_STORY_SOURCE_CHANGED') {
    return 'SNS 기록이 바뀌었습니다. 최신 기록으로 시놉시스를 다시 생성해 주세요.';
  }
  if (reason === 'SNS_STORY_PHOTO_ONLY') {
    return '사진만 있는 기간은 이야기를 만들 수 없습니다. 사진 내용은 추측하지 않습니다.';
  }
  if (reason === 'SNS_STORY_IDEMPOTENCY_CONFLICT') {
    return '같은 저장 요청 ID로 다른 내용이 감지되었습니다. 시놉시스를 다시 확인해 주세요.';
  }
  return error?.message || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function formatDate(ts: number): string {
  if (!ts) return '날짜 미상';
  return new Date(normalizeTimestampMs(ts)).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function SnsStoryCreator({
  rawRecords,
  loadingRecords,
  serverReady,
  recordsError,
  session,
  userUid,
}: SnsStoryCreatorProps) {
  const [rangeType, setRangeType] = useState<RangeType>('all');
  const [year, setYear] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [synopsis, setSynopsis] = useState('');
  const [sourceFingerprint, setSourceFingerprint] = useState('');
  const [sourceRecordIds, setSourceRecordIds] = useState<string[]>([]);
  const [serverCounts, setServerCounts] = useState<StoryCounts | null>(null);
  const [generatingSynopsis, setGeneratingSynopsis] = useState(false);
  const [generatingFinal, setGeneratingFinal] = useState(false);
  const [storyTitle, setStoryTitle] = useState('나의 SNS 갈무리 이야기');
  const [finalResult, setFinalResult] = useState<FinalResponse | null>(null);
  const [artworks, setArtworks] = useState<SnsStoryArtwork[]>([]);
  const [loadingArtworks, setLoadingArtworks] = useState(false);
  const [expandedArtworkIds, setExpandedArtworkIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const synopsisRequestRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const finalRequestRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const finalRequestTimestampsRef = useRef<Map<string, number>>(new Map());
  const requestCoordinatorRef = useRef(createSnsStoryRequestCoordinator(userUid || ''));
  const currentUserUidRef = useRef(userUid || '');
  currentUserUidRef.current = userUid || '';

  const activeRecords = useMemo(() => activeSnsRecords(rawRecords), [rawRecords]);
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    activeRecords.forEach((record) => {
      const y = kstDateStringFromTimestamp(record.timestamp).slice(0, 4);
      if (/^\d{4}$/.test(y) && y !== '1970') years.add(y);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [activeRecords]);

  useEffect(() => {
    if (rangeType === 'year' && !year && yearOptions.length > 0) {
      setYear(yearOptions[0]);
    }
  }, [rangeType, year, yearOptions]);

  const payloadBase = () => normalizeSnsStoryRequestBase({
    rangeType,
    year: rangeType === 'year' ? year : undefined,
    from: rangeType === 'custom' ? from : undefined,
    to: rangeType === 'custom' ? to : undefined,
    excludedRecordIds: Array.from(excludedIds),
  });

  const rangeKey = `${rangeType}|${year}|${from}|${to}`;
  useEffect(() => {
    setExcludedIds(new Set());
    setSynopsis('');
    setSourceFingerprint('');
    setSourceRecordIds([]);
    setServerCounts(null);
    setFinalResult(null);
    setGeneratingSynopsis(false);
    setGeneratingFinal(false);
    finalRequestRef.current = null;
    synopsisRequestRef.current = null;
    requestCoordinatorRef.current.invalidate();
  }, [rangeKey]);

  const periodRecords = useMemo(
    () => activeRecords.filter((record) => inRange(record, rangeType, year, from, to)),
    [activeRecords, rangeType, year, from, to],
  );
  const includedRecords = useMemo(
    () => periodRecords.filter((record) => !excludedIds.has(record.id)),
    [periodRecords, excludedIds],
  );
  const counts = useMemo(() => countRecords(periodRecords, includedRecords), [periodRecords, includedRecords]);
  const excludedKey = useMemo(() => Array.from(excludedIds).sort().join('|'), [excludedIds]);
  const selectionKey = useMemo(() => buildSnsStorySelectionKey(payloadBase()), [rangeType, year, from, to, excludedKey]);
  const finalRequestKey = useMemo(() => (
    buildSnsStoryFinalLogicalKey({
      ...payloadBase(),
      sourceFingerprint,
      title: storyTitle,
      confirmedSynopsis: synopsis,
    })
  ), [rangeType, year, from, to, excludedKey, sourceFingerprint, storyTitle, synopsis]);

  useEffect(() => {
    setSynopsis('');
    setSourceFingerprint('');
    setSourceRecordIds([]);
    setServerCounts(null);
    setFinalResult(null);
    setGeneratingSynopsis(false);
    setGeneratingFinal(false);
    finalRequestRef.current = null;
    synopsisRequestRef.current = null;
    requestCoordinatorRef.current.invalidate();
  }, [excludedKey]);

  useEffect(() => {
    requestCoordinatorRef.current.invalidate('final');
    finalRequestRef.current = null;
    setGeneratingFinal(false);
  }, [finalRequestKey]);

  useEffect(() => {
    requestCoordinatorRef.current.setUser(userUid || '');
    finalRequestRef.current = null;
    synopsisRequestRef.current = null;
    setGeneratingSynopsis(false);
    setGeneratingFinal(false);
  }, [userUid]);

  useEffect(() => {
    if (!userUid || !session.isCurrent()) {
      setArtworks([]);
      setLoadingArtworks(false);
      return;
    }
    setLoadingArtworks(true);
    let cancelled = false;
    const unsubscribe = onSnapshot(
      query(collection(db, 'users', userUid, 'records'), orderBy('date', 'desc')),
      (snapshot) => {
        if (cancelled || !session.isCurrent()) return;
        const items = snapshot.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
          .filter((item) => item.source === 'sns_story' && item.generationStatus === 'completed') as SnsStoryArtwork[];
        setArtworks(items);
        setLoadingArtworks(false);
      },
      () => {
        if (cancelled || !session.isCurrent()) return;
        setLoadingArtworks(false);
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [session, userUid]);

  const handleToggleExcluded = (recordId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  };

  const canGenerateSynopsis = Boolean(
    userUid
    && session.isCurrent()
    && serverReady
    && !loadingRecords
    && counts.included > 0
    && (counts.textOnly + counts.textAndPhoto) > 0
    && (rangeType !== 'year' || year)
    && (rangeType !== 'custom' || (from && to && kstStartMs(from) <= kstStartMs(to))),
  );

  const handleGenerateSynopsis = async () => {
    if (!canGenerateSynopsis) {
      if (!serverReady) toast.info('최신 서버 기록 확인이 끝난 뒤 생성할 수 있습니다.');
      else if (counts.included === 0) toast.info('포함된 SNS 기록이 없습니다.');
      else if (counts.textOnly + counts.textAndPhoto === 0) toast.error('사진만 있는 기록은 이야기로 만들 수 없습니다.');
      return;
    }
    const requestKey = selectionKey;
    if (synopsisRequestRef.current?.key === requestKey) {
      return synopsisRequestRef.current.promise;
    }
    const requestToken = requestCoordinatorRef.current.start('synopsis', requestKey, userUid || '');
    const isCurrentSynopsisRequest = () => (
      session.isCurrent()
      && requestCoordinatorRef.current.isCurrent(requestToken, requestKey, currentUserUidRef.current)
    );

    const promise = (async () => {
      setGeneratingSynopsis(true);
      setFinalResult(null);
      try {
        const callable = httpsCallable(functions, 'generateSnsStorySynopsis', {
          timeout: SNS_STORY_SYNOPSIS_CALLABLE_TIMEOUT_MS,
        });
        const result = await callable(payloadBase());
        if (!isCurrentSynopsisRequest()) return;
        const data = result.data as SynopsisResponse;
        setSynopsis(data.synopsis || '');
        setSourceFingerprint(data.sourceFingerprint || '');
        setSourceRecordIds(data.sourceRecordIds || []);
        setServerCounts(data.counts || null);
        toast.success('시놉시스를 생성했습니다. 본문을 확인하고 수정해 주세요.');
      } catch (error: any) {
        if (!isCurrentSynopsisRequest()) return;
        toast.error(shortErrorMessage(error));
      } finally {
        if (isCurrentSynopsisRequest()) setGeneratingSynopsis(false);
        if (synopsisRequestRef.current?.key === requestKey) synopsisRequestRef.current = null;
      }
    })();

    synopsisRequestRef.current = { key: requestKey, promise };
    return promise;
  };

  const canGenerateFinal = Boolean(
    userUid
    && session.isCurrent()
    && serverReady
    && sourceFingerprint
    && sourceRecordIds.length > 0
    && synopsis.trim().length >= 50
    && storyTitle.trim().length > 0
    && storyTitle.trim().length <= 80,
  );

  const handleGenerateFinal = async () => {
    if (!canGenerateFinal) {
      toast.info('제목과 확정 시놉시스를 확인해 주세요.');
      return;
    }
    const requestKey = finalRequestKey;
    if (finalRequestRef.current?.key === requestKey) {
      return finalRequestRef.current.promise;
    }
    const requestToken = requestCoordinatorRef.current.start('final', requestKey, userUid || '');
    const isCurrentFinalRequest = () => (
      session.isCurrent()
      && requestCoordinatorRef.current.isCurrent(requestToken, requestKey, currentUserUidRef.current)
    );

    const promise = (async () => {
      setGeneratingFinal(true);
      try {
        const operation = await getOrCreateDurableSnsStoryRequestTimestamp({
          uid: userUid || '',
          logicalKey: requestKey,
          memoryFallback: finalRequestTimestampsRef.current,
        });
        if (!isCurrentFinalRequest()) return;
        const callable = httpsCallable(functions, 'generateSnsStoryFinal', {
          timeout: SNS_STORY_FINAL_CALLABLE_TIMEOUT_MS,
        });
        const result = await callable({
          ...payloadBase(),
          sourceFingerprint,
          sourceRecordIds,
          title: storyTitle.trim(),
          confirmedSynopsis: synopsis.trim(),
          requestTimestamp: operation.requestTimestamp,
        });
        if (!isCurrentFinalRequest()) return;
        const data = result.data as FinalResponse;
        if (data.status === 'generating') {
          toast.info(data.message || '같은 요청이 이미 생성 중입니다.');
          setFinalResult(data);
          return;
        }
        setFinalResult(data);
        toast.success('SNS 갈무리 작품을 나의 기록에 저장했습니다.');
      } catch (error: any) {
        if (!isCurrentFinalRequest()) return;
        if (isSnsStoryAmbiguousCallableError(error)) {
          toast.info('응답 확인이 지연되었습니다. 저장 결과 확인이 필요하며, 같은 요청으로 다시 확인할 수 있습니다.');
        } else {
          toast.error(shortErrorMessage(error));
        }
      } finally {
        if (isCurrentFinalRequest()) setGeneratingFinal(false);
        if (finalRequestRef.current?.key === requestKey) finalRequestRef.current = null;
      }
    })();

    finalRequestRef.current = { key: requestKey, promise };
    return promise;
  };

  const displayedCounts = serverCounts || counts;
  const allPhotoOnlySelected = counts.included > 0 && counts.textOnly + counts.textAndPhoto === 0;
  const toggleArtworkExpanded = (artworkId: string) => {
    setExpandedArtworkIds((prev) => {
      const next = new Set(prev);
      if (next.has(artworkId)) next.delete(artworkId);
      else next.add(artworkId);
      return next;
    });
  };
  const openCompletedArtworkInSayu = () => {
    if (!finalResult?.recordId) return;
    navigate('/sayu', {
      state: {
        tab: 'assistants',
        filterFormat: SNS_GALMURI_LABEL,
        openRecordId: finalResult.recordId,
      },
    });
  };

  return (
    <section>
      <div style={panelStyle}>
        <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6, margin: 0 }}>
          SNS에 흩어진 기록을 모아 정리하고 나의 이야기로 만듭니다. 기간별 시놉시스를 만들고, 확인한 시놉시스만 근거로 작품을 저장합니다.
        </p>
      </div>

      {recordsError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{recordsError}</p>}
      {!loadingRecords && !recordsError && !serverReady && (
        <p role="status" style={noticeStyle}>최신 서버 기록 확인 중입니다. 확인이 끝나면 생성 버튼이 활성화됩니다.</p>
      )}

      <div style={sectionTitleStyle}>기간 선택</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {([
          { key: 'all', label: '전체 기간' },
          { key: 'year', label: '연도별' },
          { key: 'custom', label: '직접 설정' },
        ] as { key: RangeType; label: string }[]).map((item) => {
          const active = rangeType === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setRangeType(item.key)}
              style={chipButtonStyle(active)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {rangeType === 'year' && (
        <select
          value={year}
          onChange={(event) => setYear(event.target.value)}
          style={inputStyle}
        >
          <option value="">연도 선택</option>
          {yearOptions.map((item) => (
            <option key={item} value={item}>{item}년</option>
          ))}
        </select>
      )}

      {rangeType === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6, marginBottom: 10 }}>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} style={inputStyle} />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} style={inputStyle} />
        </div>
      )}

      <div style={countsGridStyle}>
        <CountPill label="전체" value={displayedCounts.total} />
        <CountPill label="포함" value={displayedCounts.included} strong />
        <CountPill label="제외" value={displayedCounts.excluded} />
        <CountPill label="글만" value={displayedCounts.textOnly} />
        <CountPill label="사진만" value={displayedCounts.photoOnly} />
        <CountPill label="글+사진" value={displayedCounts.textAndPhoto} />
      </div>

      <div style={sectionTitleStyle}>이 이야기에서 제외할 기록</div>
      <div style={recordListStyle}>
        {loadingRecords ? (
          <p style={emptyTextStyle}>SNS 기록을 불러오는 중...</p>
        ) : periodRecords.length === 0 ? (
          <p style={emptyTextStyle}>선택한 기간에 활성 SNS 기록이 없습니다.</p>
        ) : (
          periodRecords.map((record) => {
            const checked = excludedIds.has(record.id);
            const hasText = record.text.trim().length > 0;
            const hasPhoto = record.thumbnails.length > 0;
            return (
              <label key={record.id} style={recordRowStyle(checked)}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleExcluded(record.id)}
                  style={{ width: 18, height: 18, flex: '0 0 auto' }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COLOR_BLUE }}>
                    이 이야기에서 제외
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: '#777', marginTop: 2 }}>
                    {formatDate(record.timestamp)} · {record.source === 'instagram' ? 'Instagram' : 'Facebook'} · {hasText && hasPhoto ? '글+사진' : hasText ? '글만' : '사진만'}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: checked ? '#999' : COLOR_TEXT, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {record.text.trim() || (hasPhoto ? `사진 ${record.thumbnails.length}장` : '본문 없음')}
                  </span>
                </span>
              </label>
            );
          })
        )}
      </div>

      <p style={noticeStyle}>
        사진 내용은 분석하지 않습니다. 사진만 있는 기록은 날짜·출처·사진 장수만 반영하며, 사진 속 장면은 추측하지 않습니다.
      </p>
      {allPhotoOnlySelected && (
        <p role="alert" style={{ ...noticeStyle, background: '#fff7ed', color: '#9a3412' }}>
          포함된 기록이 모두 사진만 있어 시놉시스를 생성할 수 없습니다. 글이 있는 기록을 포함해 주세요.
        </p>
      )}

      <button
        type="button"
        onClick={handleGenerateSynopsis}
        disabled={!canGenerateSynopsis || generatingSynopsis}
        style={primaryButtonStyle(!canGenerateSynopsis || generatingSynopsis)}
      >
        {generatingSynopsis ? '시놉시스 생성 중...' : '나의 이야기 시놉시스 생성'}
      </button>

      {synopsis && (
        <div style={{ marginTop: 16 }}>
          <div style={sectionTitleStyle}>시놉시스 직접 수정</div>
          <textarea
            value={synopsis}
            onChange={(event) => setSynopsis(event.target.value)}
            rows={12}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
          <input
            type="text"
            value={storyTitle}
            maxLength={80}
            onChange={(event) => setStoryTitle(event.target.value)}
            placeholder="작품 제목"
            style={{ ...inputStyle, marginTop: 8 }}
          />
          <button
            type="button"
            onClick={handleGenerateFinal}
            disabled={!canGenerateFinal || generatingFinal}
            style={primaryButtonStyle(!canGenerateFinal || generatingFinal)}
          >
            {generatingFinal ? '최종 이야기 생성 중...' : '수정한 시놉시스로 최종 이야기 저장'}
          </button>
        </div>
      )}

      {finalResult?.status === 'completed' && (
        <div style={{ ...panelStyle, marginTop: 12, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#166534' }}>
            저장 완료: {finalResult.title || storyTitle}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#166534' }}>
            기록 ID: {finalResult.recordId}
          </p>
          <button
            type="button"
            onClick={openCompletedArtworkInSayu}
            disabled={!finalResult.recordId}
            style={secondaryButtonStyle(!finalResult.recordId)}
          >
            SNS 갈무리에서 보기
          </button>
        </div>
      )}

      <div style={{ ...sectionTitleStyle, marginTop: 22 }}>SNS 갈무리 · 저장된 작품</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loadingArtworks ? (
          <p style={emptyTextStyle}>SNS 갈무리 작품을 불러오는 중...</p>
        ) : artworks.length === 0 ? (
          <p style={emptyTextStyle}>아직 저장된 SNS 갈무리 작품이 없습니다.</p>
        ) : (
          artworks.map((artwork) => {
            const title = artwork.essay_title || artwork.essay_ai_title || 'SNS 갈무리 이야기';
            const content = artwork.content || artwork.essay_sayu || '';
            const expanded = expandedArtworkIds.has(artwork.id);
            const bodyId = `sns-story-artwork-${artwork.id}`;
            const visibleContent = expanded || content.length <= 180 ? content : `${content.slice(0, 180)}...`;
            return (
              <article key={artwork.id} style={artworkCardStyle}>
                <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>{artwork.date}</div>
                <h3 style={{ margin: 0, fontSize: 15, color: COLOR_BLUE }}>{title}</h3>
                <p id={bodyId} style={artworkBodyStyle}>
                  {visibleContent}
                </p>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={bodyId}
                  onClick={() => toggleArtworkExpanded(artwork.id)}
                  style={artworkToggleButtonStyle}
                >
                  {expanded ? '접기' : '전문 보기'}
                </button>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function CountPill({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div style={{ ...countPillStyle, borderColor: strong ? COLOR_GREEN : COLOR_BORDER, background: strong ? '#ecfdf5' : '#fff' }}>
      <span style={{ fontSize: 11, color: '#666' }}>{label}</span>
      <b style={{ fontSize: 16, color: strong ? COLOR_GREEN : COLOR_BLUE }}>{value}</b>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${COLOR_BORDER}`,
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLOR_BLUE,
  margin: '12px 0 8px',
};

const noticeStyle: CSSProperties = {
  margin: '10px 0',
  padding: '9px 11px',
  borderRadius: 8,
  background: '#eef6ff',
  color: COLOR_BLUE,
  fontSize: 12,
  lineHeight: 1.5,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${COLOR_BORDER}`,
  fontSize: 13,
  outline: 'none',
  marginBottom: 10,
  boxSizing: 'border-box',
  background: '#fff',
};

const countsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
  gap: 6,
  marginBottom: 12,
};

const countPillStyle: CSSProperties = {
  border: `1px solid ${COLOR_BORDER}`,
  borderRadius: 8,
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const recordListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 420,
  overflow: 'auto',
  padding: 2,
  borderRadius: 10,
  background: COLOR_BG_SOFT,
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  padding: '18px 12px',
  textAlign: 'center',
  color: '#777',
  fontSize: 13,
};

const artworkCardStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${COLOR_BORDER}`,
  borderRadius: 10,
  padding: 14,
};

const artworkBodyStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 13,
  color: '#444',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  wordBreak: 'keep-all',
};

const artworkToggleButtonStyle: CSSProperties = {
  marginTop: 10,
  padding: '7px 11px',
  borderRadius: 8,
  border: `1px solid ${COLOR_BORDER}`,
  background: '#fff',
  color: COLOR_BLUE,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

function chipButtonStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? COLOR_BLUE : COLOR_BORDER}`,
    background: active ? COLOR_BLUE : '#fff',
    color: active ? '#fff' : COLOR_BLUE,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: `1px solid ${disabled ? '#bbf7d0' : '#16a34a'}`,
    background: disabled ? '#dcfce7' : '#fff',
    color: disabled ? '#86efac' : '#166534',
    fontSize: 13,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginTop: 12,
  };
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '14px 14px',
    borderRadius: 10,
    border: 'none',
    background: disabled ? '#9ca3af' : COLOR_BLUE,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginTop: 6,
    marginBottom: 12,
  };
}

function recordRowStyle(checked: boolean): CSSProperties {
  return {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    border: `1px solid ${checked ? '#fecaca' : COLOR_BORDER}`,
    borderRadius: 10,
    background: checked ? '#fff7f7' : '#fff',
    cursor: 'pointer',
  };
}

export default SnsStoryCreator;
