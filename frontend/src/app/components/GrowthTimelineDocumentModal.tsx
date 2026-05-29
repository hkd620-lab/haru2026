import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSubscription } from '../hooks/useSubscription';

export type GrowthTimelineDocumentItem = {
  url: string;
  takenDate: string;
  metadataSource: 'exif' | 'manual' | 'manualRequired';
  memo: string;
  order: number;
};

interface GrowthTimelineDocumentModalProps {
  isOpen: boolean;
  title: string;
  items: GrowthTimelineDocumentItem[];
  createdLabel?: string;
  editable?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onTitleChange?: (title: string) => void;
  onMemoChange?: (order: number, memo: string) => void;
  onFinalize?: () => void;
}

function sortItems(items: GrowthTimelineDocumentItem[]) {
  return [...items].sort((a, b) => a.takenDate.localeCompare(b.takenDate) || a.order - b.order);
}

function formatDateLabel(value: string) {
  if (!value) return '-';
  const [yyyy, mm, dd] = value.split('-');
  if (!yyyy || !mm || !dd) return value;
  return `${yyyy}.${mm}.${dd}`;
}

function daysFromPrevious(items: GrowthTimelineDocumentItem[], index: number) {
  if (index === 0) return '';
  const prev = new Date(`${items[index - 1].takenDate}T00:00:00`);
  const current = new Date(`${items[index].takenDate}T00:00:00`);
  if (Number.isNaN(prev.getTime()) || Number.isNaN(current.getTime())) return '';
  const days = Math.round((current.getTime() - prev.getTime()) / 86400000);
  if (days === 0) return '같은 날';
  return `${days}일 후`;
}

function metadataLabel(source: GrowthTimelineDocumentItem['metadataSource']) {
  if (source === 'exif') return 'EXIF 촬영일';
  if (source === 'manual') return '직접 수정';
  return '날짜 확인 필요';
}

function filenameSafeTitle(title: string) {
  return (title.trim() || '성장타임라인').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

export function GrowthTimelineDocumentModal({
  isOpen,
  title,
  items,
  createdLabel,
  editable = false,
  isSaving = false,
  onClose,
  onTitleChange,
  onMemoChange,
  onFinalize,
}: GrowthTimelineDocumentModalProps) {
  const { isPremium } = useSubscription();
  const sortedItems = useMemo(() => sortItems(items), [items]);
  const periodStart = sortedItems[0]?.takenDate || '';
  const periodEnd = sortedItems[sortedItems.length - 1]?.takenDate || '';
  const resolvedTitle = title.trim() || '성장타임라인';
  const createdText = createdLabel || formatDateLabel(new Date().toISOString().slice(0, 10));

  const [printRequested, setPrintRequested] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (!isPremium) {
      alert('PREMIUM 구독 후 이용 가능한 기능입니다.\n월 3,000원으로 시작해 보세요!');
      window.location.href = '/subscription';
      return;
    }
    const originalTitle = document.title;
    document.title = `HARU타임라인_${filenameSafeTitle(resolvedTitle)}.pdf`;
    setPrintRequested(true);
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
      setPrintRequested(false);
    }, 1000);
  };

  return (
    <div
      className="growth-timeline-modal-shell"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
        backgroundColor: 'rgba(20, 35, 45, 0.46)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: '18px 12px',
      }}
    >
      <div
        style={{
          width: 'min(880px, 100%)',
          backgroundColor: '#fff',
          borderRadius: 18,
          boxShadow: '0 18px 60px rgba(20, 35, 45, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          className="growth-timeline-no-print"
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #e7edf2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: '#1A3C6E', fontSize: 15, fontWeight: 900 }}>문서형 HARU타임라인</p>
            <p style={{ margin: '3px 0 0', color: '#728091', fontSize: 12 }}>
              {formatDateLabel(periodStart)}{periodEnd && periodEnd !== periodStart ? ` ~ ${formatDateLabel(periodEnd)}` : ''} · {sortedItems.length}장
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              width: 34,
              height: 34,
              border: '1px solid #dde6ee',
              borderRadius: 10,
              backgroundColor: '#fff',
              color: '#52606f',
              fontSize: 20,
              lineHeight: '30px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, backgroundColor: '#f5f8fb' }}>
          <article
            className="growth-timeline-print-root"
            style={{
              maxWidth: 760,
              margin: '0 auto',
              padding: '26px 18px 34px',
              backgroundColor: '#fff',
              minHeight: '100%',
            }}
          >
            <header style={{ borderBottom: '2px solid #1A3C6E', paddingBottom: 16, marginBottom: 18 }}>
              {editable ? (
                <input
                  value={title}
                  onChange={event => onTitleChange?.(event.target.value)}
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '1px solid #dce6ef',
                    borderRadius: 10,
                    padding: '11px 12px',
                    color: '#1A3C6E',
                    fontSize: 22,
                    fontWeight: 900,
                    outline: 'none',
                  }}
                />
              ) : (
                <h1 style={{ margin: 0, color: '#1A3C6E', fontSize: 26, lineHeight: 1.25 }}>
                  {resolvedTitle}
                </h1>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, color: '#5e6c7a', fontSize: 13 }}>
                <span>기간 {formatDateLabel(periodStart)}{periodEnd && periodEnd !== periodStart ? ` ~ ${formatDateLabel(periodEnd)}` : ''}</span>
                <span>사진 {sortedItems.length}장</span>
                <span>생성일 {createdText}</span>
              </div>
            </header>

            <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {sortedItems.map((item, index) => {
                const gapLabel = daysFromPrevious(sortedItems, index);
                return (
                  <div
                    key={`${item.url}-${item.order}-${index}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '110px 1fr',
                      gap: 16,
                      borderBottom: index === sortedItems.length - 1 ? 'none' : '1px solid #e7edf2',
                      paddingBottom: index === sortedItems.length - 1 ? 0 : 18,
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, color: '#1A3C6E', fontSize: 15, fontWeight: 900 }}>
                        {formatDateLabel(item.takenDate)}
                      </p>
                      <p style={{ margin: '6px 0 0', color: '#8a96a3', fontSize: 12 }}>
                        {index === 0 ? '시작' : gapLabel}
                      </p>
                      <span
                        style={{
                          display: 'inline-flex',
                          marginTop: 8,
                          color: item.metadataSource === 'manualRequired' ? '#9a6700' : '#557047',
                          backgroundColor: item.metadataSource === 'manualRequired' ? '#fff7dd' : '#eef6e9',
                          borderRadius: 999,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {metadataLabel(item.metadataSource)}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <img
                        src={item.url}
                        alt={formatDateLabel(item.takenDate)}
                        style={{
                          width: '100%',
                          maxHeight: 420,
                          objectFit: 'contain',
                          backgroundColor: '#f1f4f7',
                          borderRadius: 12,
                          display: 'block',
                        }}
                      />
                      {editable ? (
                        <textarea
                          value={item.memo}
                          onChange={event => onMemoChange?.(item.order, event.target.value)}
                          disabled={isSaving}
                          placeholder="이 순간의 설명을 적어주세요."
                          style={{
                            width: '100%',
                            minHeight: 78,
                            boxSizing: 'border-box',
                            marginTop: 10,
                            border: '1px solid #dce6ef',
                            borderRadius: 10,
                            padding: '10px 11px',
                            color: '#2d3b48',
                            fontSize: 14,
                            lineHeight: 1.55,
                            resize: 'vertical',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <p style={{ margin: '10px 0 0', color: item.memo ? '#2d3b48' : '#99a3ad', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {item.memo || '설명 없음'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          </article>
        </div>

        <div
          className="growth-timeline-no-print"
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e7edf2',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            backgroundColor: '#fff',
          }}
        >
          <button
            type="button"
            onClick={handlePrint}
            disabled={printRequested || isSaving || sortedItems.length === 0}
            style={{
              border: '1px solid #d9e3ec',
              borderRadius: 10,
              backgroundColor: '#fff',
              color: '#1A3C6E',
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 800,
              cursor: printRequested || isSaving || sortedItems.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isPremium ? 1 : 0.66,
            }}
            title={isPremium ? 'PDF로 저장' : 'PREMIUM 전용 기능'}
          >
            PDF로 저장{!isPremium ? ' 🔒' : ''}
          </button>
          {editable && onFinalize && (
            <button
              type="button"
              onClick={onFinalize}
              disabled={isSaving || sortedItems.length === 0}
              style={{
                border: 'none',
                borderRadius: 10,
                backgroundColor: '#1A3C6E',
                color: '#fff',
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 900,
                cursor: isSaving || sortedItems.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? '최종 저장 중...' : '최종 저장'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .growth-timeline-print-root > section > div {
            grid-template-columns: 1fr !important;
          }
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          .growth-timeline-modal-shell {
            position: static !important;
            inset: auto !important;
            display: block !important;
            padding: 0 !important;
            background: white !important;
          }

          .growth-timeline-print-root,
          .growth-timeline-print-root * {
            visibility: visible !important;
          }

          .growth-timeline-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: auto !important;
            padding: 18mm !important;
            box-sizing: border-box !important;
            background: white !important;
          }

          .growth-timeline-no-print,
          .growth-timeline-no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          .growth-timeline-print-root img {
            max-height: 120mm !important;
            break-inside: avoid !important;
          }

          .growth-timeline-print-root section > div {
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
