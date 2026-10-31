import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, ChevronRight } from 'lucide-react';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { StatsPeriodPicker, getStatsTier, resolveStatsPeriod, statsQuery } from '../components/StatsPeriodPicker';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { firestoreService } from '../services/firestoreService';
import { STATS_MERGE_RECORD_FORMATS } from '../records/formatRegistry';
import { FORMAT_EMOJI, type RecordFormat } from '../types/haruTypes';
import {
  compareCounts,
  getPreviousRange,
  selectFormatEntries,
  type StatsPeriodKey,
  type StatsRange,
} from '../records/recordStats';

// 통계 첫 화면 — 생활/업무 구분 없이 기록형식을 바로 고른다(2026-10-23 허대표님 결정).
// 비서(가계부·보조장부·주식·식물탐정·타임라인 등) 통계는 각 비서 화면에서 연다.
const FORMAT_LABEL: Partial<Record<RecordFormat, string>> = { '애완동물관찰일지': '반려동물관찰일지' };

interface FormatSummary {
  format: RecordFormat;
  count: number;
  days: number;
  change: string | null;
}

export function StatisticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const tier = getStatsTier(subscription);
  const { period, range, locked } = resolveStatsPeriod(searchParams, tier);
  const [records, setRecords] = useState<Record<string, any>[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // '다시 불러오기'를 누를 때마다 올려 기록 불러오기를 다시 실행한다.
  const [reloadKey, setReloadKey] = useState(0);
  const [showEmpty, setShowEmpty] = useState(false);
  const previous = useMemo(() => getPreviousRange(range), [range.start, range.end]);

  useEffect(() => {
    if (!user?.uid || subscriptionLoading || locked) {
      setRecords(null);
      return;
    }
    let cancelled = false;
    setRecords(null);
    setLoadFailed(false);
    firestoreService.getRecordsInRange(user.uid, previous.start, range.end, { throwOnError: true })
      .then((data) => { if (!cancelled) setRecords(data as Record<string, any>[]); })
      .catch((error) => {
        console.warn('기록 통계 로딩 실패:', error);
        if (!cancelled) setLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, [user?.uid, subscriptionLoading, locked, previous.start, range.end, reloadKey]);

  const summaries: FormatSummary[] = useMemo(() => {
    if (!records) return [];
    return STATS_MERGE_RECORD_FORMATS.map((format) => {
      const current = selectFormatEntries(records, format, range);
      const before = selectFormatEntries(records, format, previous);
      return {
        format,
        count: current.length,
        days: new Set(current.map((entry) => entry.date)).size,
        change: compareCounts(current.length, before.length),
      };
    });
  }, [records, range.start, range.end, previous.start, previous.end]);

  const totals = useMemo(() => {
    if (!records) return null;
    const ids = new Set<string>();
    const dates = new Set<string>();
    for (const format of STATS_MERGE_RECORD_FORMATS) {
      for (const entry of selectFormatEntries(records, format, range)) {
        ids.add(entry.recordId);
        dates.add(entry.date);
      }
    }
    return { records: ids.size, days: dates.size };
  }, [records, range.start, range.end]);

  const withRecords = summaries.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
  const withoutRecords = summaries.filter((item) => item.count === 0);

  const changePeriod = (nextPeriod: StatsPeriodKey, nextRange: StatsRange) => {
    setSearchParams(statsQuery(nextPeriod, nextRange), { replace: true });
  };

  const openFormat = (format: RecordFormat) => {
    navigate(`/stats/${encodeURIComponent(format)}?${statsQuery(period, range)}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
      <PageHeaderActions />
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8" style={{ color: '#1A3C6E' }} />
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1A3C6E' }}>통계</h1>
        </div>
        <p className="text-sm" style={{ color: '#666666' }}>
          기록형식을 골라 내가 쓴 기록을 돌아봅니다.
        </p>
      </div>

      <StatsPeriodPicker period={period} range={range} tier={tier} locked={locked} onChange={changePeriod} />

      {!locked && (
        <>
          <section className="mb-4 bg-white rounded-lg shadow-sm p-4">
            {loadFailed ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm" style={{ color: '#999' }}>기록을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.</p>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="shrink-0 px-3 py-1.5 rounded text-sm" style={{ border: '1px solid #1A3C6E', color: '#1A3C6E', backgroundColor: '#fff' }}>다시 불러오기</button>
              </div>
            ) : !totals ? (
              <p className="text-sm" style={{ color: '#999' }}>기록을 불러오는 중...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '이 기간 기록', value: `${totals.records}건` },
                  { label: '기록한 날', value: `${totals.days}일` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg p-3 text-center" style={{ backgroundColor: '#FEFBE8', border: '1px solid #e5e5e5' }}>
                    <p className="text-xs" style={{ color: '#999' }}>{label}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#1A3C6E' }}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {records && (
            <section className="mb-4 bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b" style={{ borderColor: '#e5e5e5' }}>
                <h2 className="text-lg font-semibold" style={{ color: '#1A3C6E' }}>기록형식</h2>
                <p className="text-xs mt-1" style={{ color: '#999' }}>형식을 누르면 형식별 돌아보기 지표를 봅니다.</p>
              </div>
              {withRecords.length === 0 && (
                <p className="p-4 text-sm" style={{ color: '#999' }}>이 기간에 쓴 기록이 없습니다.</p>
              )}
              {withRecords.map((item) => (
                <button
                  key={item.format}
                  type="button"
                  onClick={() => openFormat(item.format)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left border-b hover:bg-gray-50"
                  style={{ borderColor: '#f0f0f0' }}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span style={{ fontSize: 22 }}>{FORMAT_EMOJI[item.format]}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold" style={{ color: '#333' }}>{FORMAT_LABEL[item.format] || item.format}</span>
                      <span className="block text-xs mt-0.5" style={{ color: '#666' }}>
                        {item.count}건 · 기록한 날 {item.days}일{item.change ? ` · ${item.change}` : ''}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: '#999' }} />
                </button>
              ))}
              {withoutRecords.length > 0 && (
                <div className="px-4 py-3">
                  <button type="button" className="text-xs underline" style={{ color: '#666' }} onClick={() => setShowEmpty((value) => !value)}>
                    {showEmpty ? '기록이 없는 형식 접기' : `기록이 없는 형식 ${withoutRecords.length}개 보기`}
                  </button>
                  {showEmpty && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {withoutRecords.map((item) => (
                        <button
                          key={item.format}
                          type="button"
                          onClick={() => openFormat(item.format)}
                          className="px-3 py-1.5 rounded-lg text-xs"
                          style={{ backgroundColor: '#FEFBE8', border: '1px solid #e5e5e5', color: '#666' }}
                        >
                          {FORMAT_EMOJI[item.format]} {FORMAT_LABEL[item.format] || item.format}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <p className="text-xs px-1" style={{ color: '#888', lineHeight: 1.6 }}>
        통계는 내가 쓴 원문을 그대로 세어 보여 줍니다. 가계부·보조장부·주식·식물탐정·타임라인 같은 비서 기록은 각 비서 화면에서 확인합니다.
      </p>
    </div>
  );
}
