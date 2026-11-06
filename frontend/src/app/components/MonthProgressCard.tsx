import { getRecordFormatLabel } from '../records/recordFormatDescriptions';
import { monthRangeLabel, type MonthProgressEntry } from '../records/monthProgress';
import type { MonthProgressView } from '../records/monthProgressController';

// 홈 '내 하루기록' 이번 달 기록 현황 카드(읽기 전용 표시).
// 설계: docs/HARU2026_홈_이번달_기록현황_카드_설계.md 3절. 숫자는 서버 확정 뒤에만 보여 준다(view.hasConfirmed).

const cardStyle = {
  background: '#fff',
  border: '1px solid #E5DFD0',
  borderRadius: 20,
  padding: 18,
  marginBottom: 28,
} as const;

const mutedText = { fontSize: 14, color: '#646B57', lineHeight: 1.55 } as const;
const buttonReset = { border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit' } as const;

function clock(ms: number | null): string {
  if (!ms) return '';
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function shortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}/${day}`;
}

export function MonthProgressCard({ view, onOpenRecord, onRetry, onStartWriting }: {
  view: MonthProgressView;
  onOpenRecord: (entry: MonthProgressEntry) => void;
  onRetry: () => void;
  onStartWriting: () => void;
}) {
  const { status, hasConfirmed, stale, count, recent, lastConfirmedAt, todayKey } = view;

  if (!hasConfirmed && status !== 'error') {
    return (
      <section aria-labelledby="month-progress-title" aria-busy="true" style={cardStyle}>
        <h2 id="month-progress-title" className="sr-only">이번 달 기록</h2>
        <div role="status" aria-label="이번 달 기록 현황을 불러오는 중" style={{ display: 'grid', gap: 10 }}>
          <div style={{ height: 22, width: '38%', borderRadius: 8, background: '#EFEADC' }} />
          <div style={{ height: 16, width: '82%', borderRadius: 8, background: '#F3EFE3' }} />
          <div style={{ height: 16, width: '70%', borderRadius: 8, background: '#F3EFE3' }} />
        </div>
      </section>
    );
  }

  if (!hasConfirmed) {
    return (
      <section aria-labelledby="month-progress-title" style={cardStyle}>
        <h2 id="month-progress-title" style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px', color: '#2C2C2A' }}>이번 달 기록</h2>
        <p role="alert" style={{ ...mutedText, margin: '0 0 12px' }}>기록 현황을 불러오지 못했어요.</p>
        <button type="button" onClick={onRetry} style={{ ...buttonReset, padding: '10px 14px', minHeight: 44, borderRadius: 12, background: '#E9EFDA', color: '#4A5A2C', fontSize: 14, fontWeight: 700 }}>
          다시 시도
        </button>
      </section>
    );
  }

  const notice = status === 'error'
    ? { role: 'alert' as const, text: `기록 현황을 새로 불러오지 못했어요. 마지막으로 확인한 시각 ${clock(lastConfirmedAt)}`, retry: true }
    : status === 'loading'
      ? { role: 'status' as const, text: '다시 확인하는 중이에요.', retry: false }
      : stale
        ? { role: 'status' as const, text: `연결을 확인하고 있어요. 마지막으로 확인한 시각 ${clock(lastConfirmedAt)}`, retry: false }
        : null;

  return (
    <section aria-labelledby="month-progress-title" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="month-progress-title" style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#2C2C2A' }}>이번 달 기록</h2>
        <span style={{ fontSize: 14, color: '#646B57' }}>{monthRangeLabel(todayKey)}</span>
      </div>

      {count > 0 ? (
        <>
          <p aria-live="polite" style={{ margin: '8px 0 12px', fontSize: 32, fontWeight: 800, color: '#4A5A2C', lineHeight: 1.2 }}>{count}편</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {recent.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onOpenRecord(entry)}
                  style={{ ...buttonReset, width: '100%', textAlign: 'left', padding: '10px 12px', minHeight: 44, borderRadius: 12, background: '#F8F5EC', display: 'flex', gap: 10, alignItems: 'baseline' }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#4A5A2C', whiteSpace: 'nowrap' }}>{getRecordFormatLabel(entry.format)} · {shortDate(entry.date)}</span>
                  <span style={{ fontSize: 15, color: '#2C2C2A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div style={{ marginTop: 10 }}>
          <p aria-live="polite" style={{ ...mutedText, margin: '0 0 12px' }}>이번 달 아직 남긴 기록이 없어요. 오늘의 한 줄부터 시작해 보세요.</p>
          <button type="button" onClick={onStartWriting} style={{ ...buttonReset, padding: '10px 14px', minHeight: 44, borderRadius: 12, background: '#E9EFDA', color: '#4A5A2C', fontSize: 14, fontWeight: 700 }}>
            오늘의 한 줄 쓰기
          </button>
        </div>
      )}

      {notice && (
        <p role={notice.role} style={{ ...mutedText, margin: '12px 0 0' }}>
          {notice.text}
          {notice.retry && (
            <button type="button" onClick={onRetry} style={{ ...buttonReset, marginLeft: 8, padding: '6px 10px', minHeight: 44, textDecoration: 'underline', color: '#4A5A2C', fontWeight: 700 }}>다시 시도</button>
          )}
        </p>
      )}
    </section>
  );
}
