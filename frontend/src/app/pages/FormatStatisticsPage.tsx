import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { toast } from 'sonner';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { StatsPeriodPicker, getStatsTier, resolveStatsPeriod, statsQuery } from '../components/StatsPeriodPicker';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { firestoreService } from '../services/firestoreService';
import { getFormatKey } from '../records/formatRegistry';
import { FORMAT_EMOJI } from '../types/haruTypes';
import {
  compareCounts,
  computeFormatStats,
  getPreviousRange,
  isStatsRecordFormat,
  MIN_DISTRIBUTION_SAMPLE,
  MIN_PERCENT_SAMPLE,
  selectFormatEntries,
  toDateKey,
  WEEKDAY_LABELS,
  type StatsCandidate,
  type StatsInsight,
  type StatsPeriodKey,
  type StatsRange,
  type StatsSource,
} from '../records/recordStats';

// 형식별 돌아보기 지표 — 첫 화면은 핵심 숫자 2~3개, 후보 문장·근거·한계는 '자세히 보기'에서 편다.
// 출처는 자동 집계 / 본문 후보 / 사용자 확인으로 나누어 표시한다(2026-10-23 결정 ①~⑤, 기장 보완 4가지).
const SOURCE_BADGE: Record<StatsSource, { label: string; bg: string; color: string }> = {
  auto: { label: '자동 집계', bg: '#E8F0FB', color: '#1A3C6E' },
  candidate: { label: '본문 후보', bg: '#FFF4D6', color: '#8A5A00' },
  confirmed: { label: '사용자 확인', bg: '#E3F5EA', color: '#1F6B3A' },
};

function SourceBadge({ source }: { source: StatsSource }) {
  const badge = SOURCE_BADGE[source];
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: badge.bg, color: badge.color }}>
      {badge.label}
    </span>
  );
}

const FORMAT_LABEL: Record<string, string> = { '애완동물관찰일지': '반려동물관찰일지' };

export function FormatStatisticsPage() {
  const { format: rawFormat = '' } = useParams<{ format: string }>();
  const format = decodeURIComponent(rawFormat);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const tier = getStatsTier(subscription);
  const { period, range, locked } = resolveStatsPeriod(searchParams, tier);
  const previous = useMemo(() => getPreviousRange(range), [range.start, range.end]);
  const [records, setRecords] = useState<Record<string, any>[] | null>(null);
  const [crops, setCrops] = useState<string[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [showCommonDetail, setShowCommonDetail] = useState(false);
  const validFormat = isStatsRecordFormat(format);
  const prefix = validFormat ? getFormatKey(format) : '';

  useEffect(() => {
    if (!user?.uid || subscriptionLoading || locked || !validFormat) {
      setRecords(null);
      return;
    }
    let cancelled = false;
    setRecords(null);
    setLoadFailed(false);
    firestoreService.getRecordsInRange(user.uid, previous.start, range.end)
      .then((data) => { if (!cancelled) setRecords(data as Record<string, any>[]); })
      .catch((error) => {
        console.warn('형식 통계 로딩 실패:', error);
        if (!cancelled) setLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, [user?.uid, subscriptionLoading, locked, validFormat, previous.start, range.end]);

  // 텃밭일지: 사용자가 등록한 작물 목록을 본문 대조 사전으로 쓴다.
  useEffect(() => {
    if (format !== '텃밭일지' || !user?.uid) return;
    getDoc(doc(getFirestore(), 'users', user.uid, 'settings', 'garden'))
      .then((snap) => setCrops(Array.isArray(snap.data()?.crops) ? snap.data()!.crops : []))
      .catch(() => setCrops([]));
  }, [format, user?.uid]);

  const result = useMemo(() => {
    if (!records || !validFormat) return null;
    return computeFormatStats(records, format, range, { today: toDateKey(new Date()), crops });
  }, [records, validFormat, format, range.start, range.end, crops]);

  const previousCount = useMemo(
    () => (records && validFormat ? selectFormatEntries(records, format, previous).length : 0),
    [records, validFormat, format, previous.start, previous.end],
  );

  const changePeriod = (nextPeriod: StatsPeriodKey, nextRange: StatsRange) => {
    setSearchParams(statsQuery(nextPeriod, nextRange), { replace: true });
  };

  const toggleOpen = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // 사용자가 후보를 '맞아요/아니에요'로 표시한다. 같은 기록 문서 statsChecks[형식 키][후보 ID]에 남긴다(경로 그대로).
  const markCandidate = async (candidate: StatsCandidate, answer: 'yes' | 'no') => {
    if (!user?.uid || !candidate.recordId) return;
    try {
      await firestoreService.updateRecord(user.uid, candidate.recordId, { [`statsChecks.${prefix}.${candidate.id}`]: answer } as any);
      setRecords((prev) => prev && prev.map((record) => {
        if (record.id !== candidate.recordId) return record;
        const checks = { ...(record.statsChecks || {}) };
        checks[prefix] = { ...(checks[prefix] || {}), [candidate.id]: answer };
        return { ...record, statsChecks: checks };
      }));
      toast.success(answer === 'yes' ? '사용자 확인으로 표시했습니다.' : '이 후보를 목록에서 뺐습니다.');
    } catch (error) {
      console.error('후보 확인 저장 실패:', error);
      toast.error('저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  const goBack = () => navigate(`/stats?${statsQuery(period, range)}`);

  if (!validFormat) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
        <PageHeaderActions />
        <p className="text-sm mb-4" style={{ color: '#666' }}>‘{format}’은 기록형식 통계 대상이 아닙니다. 비서 기록은 각 비서 화면에서 확인해 주세요.</p>
        <button type="button" onClick={goBack} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: '#1A3C6E', color: '#FAF9F6' }}>통계로 돌아가기</button>
      </div>
    );
  }

  const common = result?.common;
  const change = common ? compareCounts(common.recordCount, previousCount) : null;
  const sayuText = common
    ? `${common.sayuCount}건${common.recordCount >= MIN_PERCENT_SAMPLE ? ` (${Math.round((common.sayuCount / common.recordCount) * 100)}%)` : ''}`
    : '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
      <PageHeaderActions />
      <div className="mb-4">
        <button type="button" onClick={goBack} className="flex items-center gap-1 text-sm mb-3" style={{ color: '#1A3C6E' }}>
          <ArrowLeft className="w-4 h-4" /> 통계
        </button>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1A3C6E' }}>
          {FORMAT_EMOJI[format]} {FORMAT_LABEL[format] || format}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>내가 쓴 원문을 기준으로 셉니다. SAYU 글은 완료 수로만 셉니다.</p>
      </div>

      <StatsPeriodPicker period={period} range={range} tier={tier} locked={locked} onChange={changePeriod} />

      {!locked && (loadFailed ? (
        <p className="text-sm" style={{ color: '#999' }}>기록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.</p>
      ) : !result || !common ? (
        <p className="text-sm" style={{ color: '#999' }}>기록을 불러오는 중...</p>
      ) : common.recordCount === 0 ? (
        <section className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm" style={{ color: '#666' }}>이 기간에 쓴 {FORMAT_LABEL[format] || format} 기록이 없습니다.</p>
        </section>
      ) : (
        <>
          <section className="mb-4 bg-white rounded-lg shadow-sm p-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '기록', value: `${common.recordCount}건`, sub: change || '' },
                { label: '기록한 날', value: `${common.dayCount}일`, sub: `최장 ${common.longestStreak}일 연속` },
                { label: '사진 · SAYU', value: `${common.photoCount}장`, sub: `SAYU ${sayuText}` },
              ].map(({ label, value, sub }) => (
                <div key={label} className="rounded-lg p-3 text-center" style={{ backgroundColor: '#FEFBE8', border: '1px solid #e5e5e5' }}>
                  <p className="text-xs" style={{ color: '#999' }}>{label}</p>
                  <p className="text-lg font-bold mt-1" style={{ color: '#1A3C6E' }}>{value}</p>
                  {sub && <p className="text-[11px] mt-1" style={{ color: '#666' }}>{sub}</p>}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowCommonDetail((value) => !value)} className="mt-3 flex items-center gap-1 text-xs" style={{ color: '#666' }}>
              {showCommonDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} 자세히 보기
            </button>
            {showCommonDetail && (
              <div className="mt-3 text-xs space-y-2" style={{ color: '#555', lineHeight: 1.6 }}>
                <p>글자 수(공백 제외, 참고값): 합계 {common.charTotal.toLocaleString()}자 · 중간값 {common.charMedian.toLocaleString()}자</p>
                {common.noBodyCount > 0 && <p>본문 없는 기록 {common.noBodyCount}건(사진만 있는 기록 등)은 본문 지표에서 뺐습니다.</p>}
                <p>특별한 날 {common.specialCount}건 · 사진이 있는 기록 {common.photoRecordCount}건</p>
                {common.recordCount >= MIN_DISTRIBUTION_SAMPLE ? (
                  <div className="flex gap-1 items-end" aria-label="요일별 기록 수">
                    {common.weekdayCounts.map((count, index) => (
                      <div key={WEEKDAY_LABELS[index]} className="flex-1 text-center">
                        <div style={{ height: 48, display: 'flex', alignItems: 'flex-end' }}>
                          <div style={{ width: '100%', height: `${Math.max(4, (count / Math.max(...common.weekdayCounts, 1)) * 48)}px`, backgroundColor: count > 0 ? '#1A3C6E' : '#e5e5e5', borderRadius: 3 }} />
                        </div>
                        <div className="mt-1">{WEEKDAY_LABELS[index]} {count}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>요일 분포는 기록이 {MIN_DISTRIBUTION_SAMPLE}건 이상일 때 보여 드립니다.</p>
                )}
                <p>직전 기간 비교는 두 기간 모두 기록이 3건 이상일 때만 보여 드립니다.</p>
              </div>
            )}
          </section>

          <section className="space-y-3">
            {result.insights.map((insight) => (
              <InsightCard
                key={insight.key}
                insight={insight}
                open={openKeys.has(insight.key)}
                onToggle={() => toggleOpen(insight.key)}
                onMark={markCandidate}
              />
            ))}
          </section>
        </>
      ))}

      <p className="text-xs px-1 mt-4" style={{ color: '#888', lineHeight: 1.6 }}>
        ‘본문 후보’는 정해진 낱말·숫자 규칙으로 찾은 것이라 틀릴 수 있습니다. 맞으면 ‘맞아요’, 아니면 ‘아니에요’를 눌러 주세요.
      </p>
    </div>
  );
}

function InsightCard({ insight, open, onToggle, onMark }: {
  insight: StatsInsight;
  open: boolean;
  onToggle: () => void;
  onMark: (candidate: StatsCandidate, answer: 'yes' | 'no') => void;
}) {
  const items = insight.candidates;
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs" style={{ color: '#999' }}>{insight.label}</p>
          <p className="text-base font-semibold mt-0.5" style={{ color: '#1A3C6E', wordBreak: 'keep-all' }}>{insight.headline}</p>
        </div>
        <SourceBadge source={insight.source} />
      </div>
      <button type="button" onClick={onToggle} className="mt-2 flex items-center gap-1 text-xs" style={{ color: '#666' }}>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} 자세히 보기{items.length > 0 ? ` (${items.length})` : ''}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs" style={{ color: '#555' }}>근거: {insight.basis}</p>
          {insight.limit && <p className="text-xs" style={{ color: '#8A5A00' }}>한계: {insight.limit}</p>}
          {items.length === 0 ? (
            <p className="text-xs" style={{ color: '#999' }}>찾은 항목이 없습니다. 기록에 나오지 않았다는 뜻이지, 하지 않았다는 뜻은 아닙니다.</p>
          ) : (
            <ul className="space-y-2">
              {[...items].reverse().slice(0, 50).map((item) => (
                <li key={`${item.recordId}-${item.id}`} className="rounded-lg p-2" style={{ backgroundColor: '#FAF9F6', border: '1px solid #eee' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold" style={{ color: '#333' }}>{item.date} · {item.value}</span>
                    <SourceBadge source={item.source} />
                  </div>
                  {item.sentence !== item.value && (
                    <p className="text-xs mt-1" style={{ color: '#555', lineHeight: 1.6 }}>“{item.sentence}”</p>
                  )}
                  {item.source !== 'auto' && item.recordId && (
                    <div className="flex gap-2 mt-2">
                      <button type="button" disabled={item.source === 'confirmed'} onClick={() => onMark(item, 'yes')} className="px-2 py-1 rounded text-xs disabled:opacity-50" style={{ border: '1px solid #1F6B3A', color: '#1F6B3A' }}>맞아요</button>
                      <button type="button" onClick={() => onMark(item, 'no')} className="px-2 py-1 rounded text-xs" style={{ border: '1px solid #999', color: '#666' }}>아니에요</button>
                    </div>
                  )}
                </li>
              ))}
              {items.length > 50 && <li className="text-xs" style={{ color: '#999' }}>최근 50개까지만 보여 드립니다.</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
