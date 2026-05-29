import { useMemo, useState } from 'react';

export type GrowthTimelineMetadataSource = 'exif' | 'manual' | 'manualRequired';

export type GrowthTimelineItem = {
  url: string;
  takenDate: string;
  metadataSource: GrowthTimelineMetadataSource;
  memo: string;
  order: number;
};

export type GrowthTimelineSummary = {
  id: string;
  title: string;
  createdAt?: any;
  updatedAt?: any;
  items: GrowthTimelineItem[];
};

export function sortGrowthTimelineItems(items: GrowthTimelineItem[]) {
  return [...items].sort((a, b) => (
    a.takenDate.localeCompare(b.takenDate) || a.order - b.order
  ));
}

export function getGrowthTimelineRange(items: GrowthTimelineItem[]) {
  const sorted = sortGrowthTimelineItems(items).filter(item => item.takenDate);
  return {
    startDate: sorted[0]?.takenDate || '',
    endDate: sorted[sorted.length - 1]?.takenDate || '',
  };
}

export function countManualRequired(items: GrowthTimelineItem[]) {
  return items.filter(item => item.metadataSource === 'manualRequired').length;
}

function sourceLabel(source: GrowthTimelineMetadataSource) {
  if (source === 'exif') return 'EXIF 촬영일';
  if (source === 'manual') return '직접 수정';
  return '날짜 확인 필요';
}

interface GrowthTimelineCardProps {
  timeline: GrowthTimelineSummary;
}

export function GrowthTimelineCard({ timeline }: GrowthTimelineCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const sortedItems = useMemo(() => sortGrowthTimelineItems(timeline.items), [timeline.items]);
  const { startDate, endDate } = getGrowthTimelineRange(timeline.items);
  const needsCheckCount = countManualRequired(timeline.items);
  const thumbnailUrl = timeline.items[0]?.url || sortedItems[0]?.url || '';

  return (
    <div style={{ padding: '0 14px 14px' }}>
      <div
        style={{
          border: '1px solid #dfe8d8',
          borderRadius: 12,
          backgroundColor: '#fbfdf8',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 12, padding: 12 }}>
          <div style={{ width: 92, height: 92, borderRadius: 10, overflow: 'hidden', backgroundColor: '#eef2e8' }}>
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt={timeline.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa68f', fontSize: 12 }}>
                사진 없음
              </div>
            )}
          </div>

          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#355524', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {timeline.title}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#74806b' }}>
                  {timeline.items.length}장 · {startDate || '-'}{endDate && endDate !== startDate ? ` ~ ${endDate}` : ''}
                </p>
              </div>
              {needsCheckCount > 0 && (
                <span style={{
                  flexShrink: 0,
                  borderRadius: 999,
                  backgroundColor: '#fff7dd',
                  color: '#9a6700',
                  border: '1px solid #f4d78b',
                  padding: '3px 7px',
                  fontSize: 11,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}>
                  날짜 확인 {needsCheckCount}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsDetailOpen(prev => !prev)}
              style={{
                alignSelf: 'flex-start',
                minHeight: 30,
                border: '1px solid #cad8c1',
                borderRadius: 8,
                backgroundColor: '#fff',
                color: '#4E6B2A',
                padding: '0 10px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {isDetailOpen ? '접기' : '자세히 보기'}
            </button>
          </div>
        </div>

        {isDetailOpen && (
          <div style={{ borderTop: '1px solid #e7eee1', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedItems.map((item, index) => {
              const needsCheck = item.metadataSource === 'manualRequired';
              return (
                <div
                  key={`${timeline.id}_${item.url}_${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '72px 1fr',
                    gap: 10,
                    padding: 10,
                    border: '1px solid #e4eadf',
                    borderRadius: 10,
                    backgroundColor: '#fff',
                  }}
                >
                  <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 9, overflow: 'hidden', backgroundColor: '#eef2e8' }}>
                    <img src={item.url} alt={item.takenDate} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <span style={{
                      position: 'absolute',
                      top: 5,
                      left: 5,
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#4E6B2A',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {index + 1}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#355524' }}>{item.takenDate}</span>
                      <span style={{
                        borderRadius: 999,
                        backgroundColor: needsCheck ? '#fff7dd' : '#eef6e9',
                        color: needsCheck ? '#9a6700' : '#63745a',
                        border: needsCheck ? '1px solid #f4d78b' : '1px solid #dcebd4',
                        padding: '3px 7px',
                        fontSize: 11,
                        fontWeight: 800,
                      }}>
                        {sourceLabel(item.metadataSource)}
                      </span>
                    </div>
                    {item.memo ? (
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: '#4b5563', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {item.memo}
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: 12, color: '#a0a8ad' }}>메모 없음</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
