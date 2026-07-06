import { useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { useSubscription } from '../hooks/useSubscription';
import type { ReverseGeocodeCandidate } from '../services/reverseGeocodeService';
import { functions } from '../../firebase';
import { GrapeAnimation } from './GrapeAnimation';

export type GrowthTimelineDocumentItem = {
  url: string;
  takenDate: string;
  metadataSource: 'exif' | 'manual' | 'manualRequired';
  memo: string;
  order: number;
  locationCandidate?: ReverseGeocodeCandidate;
  locationStatus?: 'none' | 'loading' | 'found' | 'not_found' | 'error';
  // 사용자가 확인·수정한 촬영장소명 (자동 인식값을 그대로 두거나 직접 고친 값)
  locationLabel?: string;
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
  onEdit?: () => void;
}

type GenerateGrowthTimelinePdfRequest = {
  title: string;
  createdLabel: string;
  items: GrowthTimelineDocumentItem[];
};

type GenerateGrowthTimelinePdfResponse = {
  success: boolean;
  cached: boolean;
  hash: string;
  filePath: string;
  downloadUrl: string;
  expiresAt: string;
};

// HARU 타임라인 PDF 출력 법칙: 표지 1페이지 + A4 한 장에 사진 4장(2열×2행), 초과 시 다음 페이지로 분할
const PRINT_PHOTOS_PER_PAGE = 4;

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
  // 사용자가 확인·수정한 장소명이 있으면 항상 그 값을 우선 표시
  if (item.locationLabel && item.locationLabel.trim()) return item.locationLabel.trim();
  if (item.locationStatus === 'loading') return '촬영장소 확인 중';
  if (item.locationStatus === 'none') return '위치정보 없음';
  if (item.locationStatus === 'not_found') return '촬영장소 후보 없음';
  if (item.locationStatus === 'error') return '장소 확인 실패';
  if (item.locationStatus === 'found') {
    return item.locationCandidate?.placeName
      || item.locationCandidate?.regionLabel
      || item.locationCandidate?.roadAddress
      || item.locationCandidate?.jibunAddress
      || '촬영장소 후보 있음';
  }
  return '';
}

function locationDetailLabel(candidate?: ReverseGeocodeCandidate) {
  if (!candidate) return '';
  // 장소명이 메인으로 표시되면 지역·주소를 보조로 노출
  if (candidate.placeName) {
    return candidate.regionLabel || candidate.roadAddress || candidate.jibunAddress || '';
  }
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
  onEdit,
}: GrowthTimelineDocumentModalProps) {
  const { isPremium } = useSubscription();
  const sortedItems = useMemo(() => sortItems(items), [items]);
  const periodStart = sortedItems[0]?.takenDate || '';
  const periodEnd = sortedItems[sortedItems.length - 1]?.takenDate || '';
  const resolvedTitle = title.trim() || '성장타임라인';
  const createdText = createdLabel || formatDateLabel(new Date().toISOString().slice(0, 10));

  const [printRequested, setPrintRequested] = useState(false);
  const [serverPdfRequested, setServerPdfRequested] = useState(false);

  if (!isOpen) return null;

  const handleBrowserPrint = async () => {
    if (!isPremium) {
      alert('PREMIUM 구독 후 이용 가능한 기능입니다.\n월 6,000원으로 시작해 보세요!');
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

    // 3) HARU 타임라인 PDF 출력 법칙: 표지 1페이지 + A4 한 장에 사진 4장(2열×2행).
    //    단일 그리드를 4장씩 페이지 섹션으로 나눠 페이지당 사진 수를 고정한다.
    const grid = clone.querySelector('.growth-timeline-grid');
    if (grid) {
      const cells = Array.from(grid.children);
      grid.remove();
      for (let i = 0; i < cells.length; i += PRINT_PHOTOS_PER_PAGE) {
        const page = document.createElement('section');
        page.className = 'growth-timeline-print-page';
        cells.slice(i, i + PRINT_PHOTOS_PER_PAGE).forEach(cell => page.appendChild(cell));
        const footer = document.createElement('div');
        footer.className = 'growth-timeline-print-footer';
        footer.textContent = `HARU Timeline · ${formatDateLabel(periodStart)}`
          + (periodEnd && periodEnd !== periodStart ? ` ~ ${formatDateLabel(periodEnd)}` : '');
        page.appendChild(footer);
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

  const handlePrint = async () => {
    if (!isPremium) {
      alert('PREMIUM 구독 후 이용 가능한 기능입니다.\n월 6,000원으로 시작해 보세요!');
      window.location.href = '/subscription';
      return;
    }
    if (serverPdfRequested || printRequested) return;

    setServerPdfRequested(true);
    try {
      const generatePdf = httpsCallable<
        GenerateGrowthTimelinePdfRequest,
        GenerateGrowthTimelinePdfResponse
      >(functions, 'generateGrowthTimelinePdf', { timeout: 300000 });

      const result = await generatePdf({
        title: resolvedTitle,
        createdLabel: createdText,
        items: sortedItems,
      });

      if (!result.data?.downloadUrl) {
        throw new Error('PDF URL이 없습니다');
      }

      const opened = window.open(result.data.downloadUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.href = result.data.downloadUrl;
      }

      toast.success(result.data.cached ? '저장된 PDF를 열었습니다.' : 'PDF를 생성해 서버에 저장했습니다.');
    } catch (error) {
      console.error('서버 PDF 생성 실패:', error);
      toast.error('서버 PDF 생성에 실패해 브라우저 PDF 저장으로 전환합니다.');
      await handleBrowserPrint();
    } finally {
      setServerPdfRequested(false);
    }
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
      {serverPdfRequested && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(237,233,245,0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 240, height: 320 }}>
            <GrapeAnimation />
          </div>
          <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: '#1A3C6E' }}>
            PDF를 생성하는 중...
          </p>
        </div>
      )}
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
            <section className="growth-timeline-cover" aria-hidden="true">
              <div className="growth-timeline-cover-photo">
                {sortedItems[0]?.url && <img src={sortedItems[0].url} alt="" />}
              </div>
              <div className="growth-timeline-cover-meta">
                <p className="growth-timeline-cover-brand">HARU Timeline · by HaruLab</p>
                <h1 className="growth-timeline-cover-title">{resolvedTitle}</h1>
                <p className="growth-timeline-cover-period">
                  기간 {formatDateLabel(periodStart)}
                  {periodEnd && periodEnd !== periodStart ? ` ~ ${formatDateLabel(periodEnd)}` : ''}
                </p>
                <p className="growth-timeline-cover-sub">사진 {sortedItems.length}장 · 생성일 {createdText}</p>
              </div>
            </section>

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
                        {locationCandidateLabel(item) && (
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
                            촬영장소: {locationCandidateLabel(item)}
                          </span>
                        )}
                      </span>
                      {item.locationStatus === 'found' && locationDetailLabel(item.locationCandidate) && (
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
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              style={{
                border: '1px solid #1A3C6E',
                borderRadius: 10,
                backgroundColor: '#fff',
                color: '#1A3C6E',
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
              }}
              title="사진·설명 편집 화면으로 이동"
            >
              ✏️ 사진·설명 편집
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            disabled={serverPdfRequested || printRequested || isSaving || sortedItems.length === 0}
            style={{
              border: '1px solid #d9e3ec',
              borderRadius: 10,
              backgroundColor: '#fff',
              color: '#1A3C6E',
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 800,
              cursor: serverPdfRequested || printRequested || isSaving || sortedItems.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isPremium ? 1 : 0.66,
            }}
            title={isPremium ? 'PDF로 저장' : 'PREMIUM 전용 기능'}
          >
            {serverPdfRequested ? 'PDF 생성 중...' : `PDF로 저장${!isPremium ? ' 🔒' : ''}`}
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

        /* 화면 모달은 현행 유지, 표지는 PDF에서만 표시 */
        .growth-timeline-cover {
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

          /* 표지 1페이지 — 대표사진 크게 + 제목/기간/브랜드 */
          .growth-timeline-print-portal .growth-timeline-cover {
            display: flex !important;
            flex-direction: column;
            gap: 10mm;
            break-after: page;
            page-break-after: always;
            min-height: 250mm;
          }

          .growth-timeline-cover-photo {
            width: 100%;
            height: 150mm;
            border-radius: 4mm;
            overflow: hidden;
          }

          .growth-timeline-cover-photo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }

          .growth-timeline-cover-brand {
            margin: 0;
            color: #1A3C6E;
            font-size: 11pt;
            font-weight: 800;
            letter-spacing: .12em;
          }

          .growth-timeline-cover-title {
            margin: 4mm 0 0;
            color: #1A3C6E;
            font-size: 28pt;
            line-height: 1.2;
          }

          .growth-timeline-cover-period {
            margin: 6mm 0 0;
            color: #5e6c7a;
            font-size: 13pt;
          }

          .growth-timeline-cover-sub {
            margin: 2mm 0 0;
            color: #8a96a3;
            font-size: 11pt;
          }

          /* 표지가 헤더를 대체 */
          .growth-timeline-print-portal .growth-timeline-print-root > header {
            display: none !important;
          }

          /* HARU 타임라인 PDF 출력 법칙: A4 한 장 = 2열×2행(사진 4장). 페이지 섹션마다 페이지 분할 */
          .growth-timeline-print-page {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8mm 9mm !important;
            align-content: start !important;
            break-after: page;
            page-break-after: always;
          }
          .growth-timeline-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          /* 4장 카드형이 한 페이지에 들어가도록 사진 높이 고정 */
          .growth-timeline-print-page .growth-timeline-cell {
            box-sizing: border-box !important;
            padding: 3mm !important;
            border: 0.35mm solid #e2e9f0 !important;
            border-radius: 4mm !important;
            background: #ffffff !important;
            gap: 2.4mm !important;
          }

          .growth-timeline-print-page .growth-timeline-photo {
            aspect-ratio: auto !important;
            height: 70mm !important;
            border-radius: 3mm !important;
            background: #f1f4f7 !important;
          }

          .growth-timeline-cell figcaption p,
          .growth-timeline-cell figcaption textarea {
            font-size: 11pt !important;
            line-height: 1.45 !important;
            margin: 0 !important;
          }

          .growth-timeline-print-page .growth-timeline-cell figcaption {
            gap: 2mm !important;
          }

          .growth-timeline-cell,
          .growth-timeline-cell img {
            break-inside: avoid !important;
          }

          .growth-timeline-print-footer {
            grid-column: 1 / -1;
            text-align: center;
            margin-top: 5mm;
            color: #9aa6b2;
            font-size: 9pt;
            letter-spacing: .04em;
          }
        }
      `}</style>
    </div>
  );
}
