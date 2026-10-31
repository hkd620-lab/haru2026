import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SubscriptionInfo } from '../types/subscription';
import {
  canUseStatsPeriod,
  getStatsPeriodRange,
  getStatsPeriodTierLabel,
  STATS_PERIOD_LABELS,
  type StatsPeriodKey,
  type StatsRange,
  type StatsTier,
} from '../records/recordStats';

export const STATS_PERIOD_KEYS: StatsPeriodKey[] = ['week', 'month', 'quarter', 'year', 'custom'];

// 통계·합본 기간 등급(2026-10-23 결정 ⑥): 무료 이번 주·이번 달 / 베이직 +최근 3개월·올해 / 프리미엄 +직접 선택
export function getStatsTier(subscription: Pick<SubscriptionInfo, 'plan' | 'status'>): StatsTier {
  if (subscription.status !== 'active') return 'free';
  if (subscription.plan === 'premium') return 'premium';
  if (subscription.plan === 'basic') return 'basic';
  return 'free';
}

export function parseStatsPeriod(value: string | null): StatsPeriodKey {
  return STATS_PERIOD_KEYS.includes(value as StatsPeriodKey) ? (value as StatsPeriodKey) : 'month';
}

// URL의 period·start·end 로 기간을 정한다. 등급상 못 쓰는 기간이면 바꾸지 않고 locked 로 알린다.
export function resolveStatsPeriod(params: URLSearchParams, tier: StatsTier, today = new Date()) {
  const start = params.get('start');
  const end = params.get('end');
  const legacyPeriod = !params.has('period') && start && end
    ? STATS_PERIOD_KEYS.find((key) => {
      if (key === 'custom') return false;
      const range = getStatsPeriodRange(key, today);
      return range.start === start && range.end === end;
    }) || 'custom'
    : null;
  const period = legacyPeriod || parseStatsPeriod(params.get('period'));
  const range = getStatsPeriodRange(period, today, { start: params.get('start') || undefined, end: params.get('end') || undefined });
  return { period, range, locked: !canUseStatsPeriod(period, tier) };
}

export function statsQuery(period: StatsPeriodKey, range: StatsRange): string {
  const params = new URLSearchParams({ period });
  if (period === 'custom') {
    params.set('start', range.start);
    params.set('end', range.end);
  }
  return params.toString();
}

interface StatsPeriodPickerProps {
  period: StatsPeriodKey;
  range: StatsRange;
  tier: StatsTier;
  locked: boolean;
  onChange: (period: StatsPeriodKey, range: StatsRange) => void;
  noun?: string;
}

export function StatsPeriodPicker({ period, range, tier, locked, onChange, noun = '통계' }: StatsPeriodPickerProps) {
  const navigate = useNavigate();
  return (
    <section className="mb-4 bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5" style={{ color: '#1A3C6E' }} />
        <h2 className="text-sm font-semibold" style={{ color: '#333' }}>기간</h2>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {STATS_PERIOD_KEYS.map((key) => {
          const usable = canUseStatsPeriod(key, tier);
          const selected = period === key;
          const tierLabel = getStatsPeriodTierLabel(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key, getStatsPeriodRange(key, new Date(), key === 'custom' ? range : undefined))}
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: selected ? '#1A3C6E' : '#FEFBE8',
                color: selected ? '#FAF9F6' : '#333',
                border: selected ? '1px solid #1A3C6E' : '1px solid #e5e5e5',
                opacity: usable ? 1 : 0.7,
              }}
              title={tierLabel ? `${STATS_PERIOD_LABELS[key]} · ${tierLabel}` : STATS_PERIOD_LABELS[key]}
            >
              {STATS_PERIOD_LABELS[key]}{!usable && ' 🔒'}
            </button>
          );
        })}
      </div>
      {period === 'custom' && !locked && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-xs" style={{ color: '#666' }}>
            시작일
            <input
              type="date"
              value={range.start}
              max={range.end}
              onChange={(e) => e.target.value && onChange('custom', { ...range, start: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300"
              style={{ fontSize: 16 }}
            />
          </label>
          <label className="text-xs" style={{ color: '#666' }}>
            종료일
            <input
              type="date"
              value={range.end}
              min={range.start}
              onChange={(e) => e.target.value && onChange('custom', { ...range, end: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300"
              style={{ fontSize: 16 }}
            />
          </label>
        </div>
      )}
      {locked ? (
        <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#FFF8F0', color: '#92400E', border: '1px solid #F59E0B' }}>
          {STATS_PERIOD_LABELS[period]} {noun}는 {getStatsPeriodTierLabel(period)} 이용할 수 있습니다. 다른 기간을 고르거나{' '}
          <button type="button" className="underline font-semibold" onClick={() => navigate('/subscription')}>구독 안내</button>를 확인해 주세요.
        </div>
      ) : (
        <p className="text-xs" style={{ color: '#666' }}>
          {range.label}: {range.start} ~ {range.end}
        </p>
      )}
    </section>
  );
}
