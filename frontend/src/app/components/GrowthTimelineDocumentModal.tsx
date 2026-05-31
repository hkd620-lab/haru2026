import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSubscription } from '../hooks/useSubscription';
import type { ReverseGeocodeCandidate } from '../services/reverseGeocodeService';

export type GrowthTimelineDocumentItem = {
  url: string;
  takenDate: string;
  metadataSource: 'exif' | 'manual' | 'manualRequired';
  memo: string;
  order: number;
  locationCandidate?: ReverseGeocodeCandidate;
  locationStatus?: 'none' | 'loading' | 'found' | 'not_found' | 'error';
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

// HARU 타임라인 PDF 출력 법칙: A4 한 장에 사진 6장(2열×3행), 초과 시 다음 페이지로 분할
const PRINT_PHOTOS_PER_PAGE = 6;

function sortItems(items: GrowthTimelineDocumentItem[]) {
  return [...items].sort((a, b) => a.takenDate.localeCompare(b.takenDate) || a.order - b.order);
}

function formatDateLabel(value: string) {
  if (!value) return '-';
  const [yyyy, mm, dd] = value.split('-');
  if (!yyyy || !mm || !dd) return value;
  return `${yyyy}.${mm}.${dd}`;
}

function daysFromStart(items: GrowthTimelineDocumentItem[], index: number) {
  if (index === 0) return '';
  const start = new Date(`${items[0].takenDate}T00:00:00`);
  const current = new Date(`${items[index].takenDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) return '';
  const days = Math.round((current.getTime() - start.getTime()) / 86400000);
  if (days === 0) return '같은 날';
  return `${days}일 후`;
}

function metadataLabel(source: GrowthTimelineDocumentItem['metadataSource']) {
  if (source === 'exif') return 'EXIF 촬영일';
  if (source === 'manual') return '직접 수정';
  return '날짜 확인 필요';
}

function locationCandidateLabel(item: GrowthTimelineDocumentItem) {
  if (item.locationStatus === 'loading') return '촬영장소 확인 중';
  if (item.locationStatus === 'none') return '위치정보 없음';
  if (item.locationStatus === 'not_found') return '촬영장소 후보 없음';
  if (item.locationStatus === 'error') return '장소 확인 실패';
  if (item.locationStatus === 'found') {
    return item.locationCandidate?.regionLabel
      || item.locationCandidate?.roadAddress
      || item.locationCandidate?.jibunAddress
      || '촬영장소 후보 있음';
  }
  return '';
}

function locationDetailLabel(candidate?: ReverseGeocodeCandidate) {
  if (!candidate) return '';
  return candidate.roadAddress || candidate.jibunAddress || '';
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

  const handlePrint = async () => {
    if (!isPremium) {
      alert('PREMIUM 구독 후 이용 가능한 기능입니다.\n월 3,000원으로 시작해 보세요!');
      window.location.href = '/subscription';
      return;
    }
    if (printRequested) return;
    const root = document.querySelector('.growth-timeline-print-root') as HTMLElement | null;
    if (!root) return;
    setPrintRequested(true);

    // 1) 원격(스토리지) 이미지가 모두 로드된 뒤에 인쇄 — 라이브러리에서 다시 열 때 빈 페이지 방지
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
      images.map(img =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>(resolve => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }),
      ),
    );

    // 2) 인쇄 대상만 body 직속으로 복제 — 모달의 fixed/overflow 부모 레이아웃 때문에 생기던 빈 페이지 방지
    const clone = root.cloneNode(true) as HTMLElement;
    // cloneNode는 사용자가 입력한 폼 값(value)을 복사하지 않으므로 직접 반영 (편집 모드 제목/메모 보존)
    const originalFields = root.querySelectorAll('input, textarea');
    const clonedFields = clone.querySelectorAll('input, textarea');
    originalFields.forEach((field, i) => {
      const target = clonedFields[i] as HTMLInputElement | HTMLTextAreaElement | undefined;
      if (!target) return;
      if (target.tagName === 'TEXTAREA') {
        target.textContent = (field as HTMLTextAreaElement).value;
      } else {
        target.setAttribute('value', (field as HTMLInputElement).value);
      }
    });
    // 인쇄용 복제본은 화면 인라인 스타일을 그대로 쓰되, A4 인쇄폭에 맞춰 패딩만 제거
    clone.style.maxWidth = 'none';
    clone.style.margin = '0';
    clone.style.padding = '0';
    clone.style.minHeight = 'auto';

    // 3) HARU 타임라인 PDF 출력 법칙: A4 한 장에 사진 6장(2열×3행). 6장 초과 시 다음 페이지로 분할.
    //    단일 그리드를 6장씩 페이지 섹션으로 나눠 페이지당 사진 수를 고정한다.
    const grid = clone.querySelector('.growth-timeline-grid');
    if (grid) {
      const cells = Array.from(grid.children);
      grid.remove();
      for (let i = 0; i < cells.length; i += PRINT_PHOTOS_PER_PAGE) {
        const page = document.createElement('section');
        page.className = 'growth-timeline-print-page';
        cells.slice(i, i + PRINT_PHOTOS_PER_PAGE).forEach(cell => page.appendChild(cell));
        clone.appendChild(page);
      }
    }

    const portal = document.createElement('div');
    portal.className = 'growth-timeline-print-portal';
    portal.appendChild(clone);
    document.body.appendChild(portal);

    const originalTitle = document.title;
    document.title = `HARU타임라인_${filenameSafeTitle(resolvedTitle)}.pdf`;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.title = originalTitle;
      if (portal.parentNode) portal.parentNode.removeChild(portal);
      setPrintRequested(false);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();
    // afterprint 미지원 환경 대비 fallback
    setTimeout(cleanup, 1500);
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

            <section
              className="growth-timeline-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 20,
                alignItems: 'start',
              }}
            >
              {sortedItems.map((item, index) => {
                const gapLabel = daysFromStart(sortedItems, index);
                return (
                  <figure
                    key={`${item.url}-${item.order}-${index}`}
                    className="growth-timeline-cell"
                    style={{
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 9,
                    }}
                  >
                    <div
                      className="growth-timeline-photo"
                      style={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        backgroundColor: '#f1f4f7',
                        borderRadius: 12,
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={item.url}
                        alt={formatDateLabel(item.takenDate)}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    </div>
                    <figcaption style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ color: '#1A3C6E', fontSize: 14, fontWeight: 900 }}>
                          {formatDateLabel(item.takenDate)}
                        </span>
                        <span style={{ color: '#8a96a3', fontSize: 12 }}>
                          {index === 0 ? '시작' : gapLabel}
                        </span>
                        {item.metadataSource === 'manualRequired' && (
                          <span
                            style={{
                              color: '#9a6700',
                              backgroundColor: '#fff7dd',
                              borderRadius: 999,
                              padding: '2px 7px',
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {metadataLabel(item.metadataSource)}
                          </span>
                        )}
                        {editable && locationCandidateLabel(item) && (
                          <span
                            style={{
                              color: item.locationStatus === 'found' ? '#37644a' : '#8a96a3',
                              backgroundColor: item.locationStatus === 'found' ? '#edf7f1' : '#f2f4f6',
                              borderRadius: 999,
                              padding: '2px 7px',
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            촬영장소 후보: {locationCandidateLabel(item)}
                          </span>
                        )}
                      </span>
                      {editable && item.locationStatus === 'found' && locationDetailLabel(item.locationCandidate) && (
                        <span style={{ color: '#7c8894', fontSize: 11, lineHeight: 1.4 }}>
                          {locationDetailLabel(item.locationCandidate)}
                        </span>
                      )}
                      {editable ? (
                        <textarea
                          value={item.memo}
                          onChange={event => onMemoChange?.(item.order, event.target.value)}
                          disabled={isSaving}
                          placeholder="이 순간의 설명을 적어주세요."
                          style={{
                            width: '100%',
                            minHeight: 64,
                            boxSizing: 'border-box',
                            border: '1px solid #dce6ef',
                            borderRadius: 10,
                            padding: '9px 10px',
                            color: '#2d3b48',
                            fontSize: 14,
                            lineHeight: 1.5,
                            resize: 'vertical',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        item.memo ? (
                          <p style={{ margin: 0, color: '#3a4753', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {item.memo}
                          </p>
                        ) : null
                      )}
                    </figcaption>
                  </figure>
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
        @media (max-width: 600px) {
          .growth-timeline-grid {
            grid-template-columns: 1fr !important;
          }
        }

        /* 인쇄용 복제본은 화면에서는 보이지 않게 (인쇄 시 flash 방지) */
        .growth-timeline-print-portal {
          display: none;
        }

        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            background: white !important;
          }

          /* 인쇄 복제본만 남기고 나머지 화면 요소는 모두 숨김 */
          body > *:not(.growth-timeline-print-portal) {
            display: none !important;
          }

          .growth-timeline-print-portal {
            display: block !important;
            background: white !important;
          }

          .growth-timeline-print-portal .growth-timeline-print-root {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: auto !important;
            background: white !important;
          }

          .growth-timeline-no-print,
          .growth-timeline-no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          /* 헤더는 1페이지 상단에만 — 사진 6장이 함께 들어갈 수 있도록 컴팩트하게 */
          .growth-timeline-print-portal .growth-timeline-print-root > header {
            border-bottom: 2px solid #1A3C6E !important;
            padding-bottom: 6mm !important;
            margin-bottom: 6mm !important;
          }
          .growth-timeline-print-portal .growth-timeline-print-root > header h1,
          .growth-timeline-print-portal .growth-timeline-print-root > header input {
            font-size: 18pt !important;
          }

          /* HARU 타임라인 PDF 출력 법칙: A4 한 장 = 2열×3행(사진 6장). 페이지 섹션마다 페이지 분할 */
          .growth-timeline-print-page {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 7mm 8mm !important;
            break-after: page;
            page-break-after: always;
          }
          .growth-timeline-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          /* 6장이 한 페이지(헤더 포함)에 들어가도록 사진 높이 고정 */
          .growth-timeline-print-page .growth-timeline-photo {
            aspect-ratio: auto !important;
            height: 56mm !important;
          }

          .growth-timeline-cell,
          .growth-timeline-cell img {
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
