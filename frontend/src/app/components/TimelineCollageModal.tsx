import { useEffect, useRef, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { storage, db } from '../../firebase';
import { HaruRecord } from '../services/firestoreService';
import { toast } from 'sonner';
import { GrowthTimelineCreator } from './GrowthTimelineCreator';

interface PhotoItem {
  url: string;
  date: string;
  recordDate: string;
  originalName?: string;
  takenAt?: string;
  takenDate?: string;
  takenTime?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  metadataSource?: string;
  formatPrefix?: string;
}

interface TimelineCollageModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: HaruRecord[];
  uid: string;
  isLoadingRecords?: boolean;
}

const FORMAT_PREFIXES = [
  'diary', 'essay', 'mission', 'report', 'work',
  'travel', 'garden', 'pet', 'child', 'memo', 'reading', 'stock',
];

function extractPhotos(records: HaruRecord[]): PhotoItem[] {
  const photos: PhotoItem[] = [];
  for (const record of records) {
    const recordDate = record.date || record.id;
    for (const prefix of FORMAT_PREFIXES) {
      const raw = record[`${prefix}_images`];
      if (!raw) continue;
      let urls: string[] = [];
      let imageMeta: any[] = [];
      try {
        urls = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
      } catch {
        continue;
      }
      try {
        const rawMeta = record[`${prefix}_imageMeta`];
        const parsedMeta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : Array.isArray(rawMeta) ? rawMeta : [];
        imageMeta = Array.isArray(parsedMeta) ? parsedMeta : [];
      } catch {
        imageMeta = [];
      }
      for (const url of urls) {
        if (typeof url === 'string' && url.startsWith('http')) {
          const meta = imageMeta.find((item: any) => item?.url === url) || {};
          const takenDate = meta.metadataSource === 'exif' ? String(meta.takenDate || '') : '';
          photos.push({
            url,
            date: takenDate || recordDate,
            recordDate,
            originalName: typeof meta.originalName === 'string' && meta.originalName.trim() ? meta.originalName : getFileNameFromUrl(url),
            takenAt: typeof meta.takenAt === 'string' ? meta.takenAt : '',
            takenDate,
            takenTime: typeof meta.takenTime === 'string' ? meta.takenTime : '',
            latitude: typeof meta.latitude === 'number' ? meta.latitude : undefined,
            longitude: typeof meta.longitude === 'number' ? meta.longitude : undefined,
            locationLabel: typeof meta.locationLabel === 'string' ? meta.locationLabel : '',
            metadataSource: typeof meta.metadataSource === 'string' ? meta.metadataSource : '',
            formatPrefix: prefix,
          });
        }
      }
    }
  }
  return photos.sort((a, b) => a.date.localeCompare(b.date));
}

function fmtDate(dateStr: string): string {
  const p = dateStr.split('-');
  return p.length === 3 ? `${p[0]}.${p[1]}.${p[2]}` : dateStr;
}

function sortPhotosByDate(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) => a.date.localeCompare(b.date));
}

function getFileNameFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const storagePath = decodeURIComponent(parsedUrl.pathname.split('/o/')[1]?.split('?')[0] || '');
    return storagePath.split('/').pop() || '';
  } catch {
    return '';
  }
}

function formatPhotoSubLabel(photo: PhotoItem) {
  const parts = [
    photo.takenTime ? photo.takenTime.slice(0, 5) : '',
    photo.locationLabel || '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function matchesPhotoSearch(photo: PhotoItem, searchText: string, dateFrom: string, dateTo: string) {
  if (dateFrom && photo.date < dateFrom) return false;
  if (dateTo && photo.date > dateTo) return false;
  const query = searchText.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    photo.date,
    photo.recordDate,
    photo.takenTime,
    photo.originalName,
    photo.locationLabel,
    photo.formatPrefix,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}

function getLayout(n: number): { cols: number; rows: number } {
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 2, rows: 3 };
  return { cols: 2, rows: 4 };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const CHANGE_RECORD_ASSISTANT_TITLE = 'HARU타임라인';
const CHANGE_RECORD_ASSISTANT_DESCRIPTION = '여러 날짜의 사진 기록을 시간순으로 묶어 변화의 흐름을 한 장으로 보여줍니다.';
const CHANGE_RECORD_ASSISTANT_HELP = '흩어진 하루의 사진들을 연결해 식물, 건강, 가족, 프로젝트의 변화를 한눈에 볼 수 있는 기록 자산으로 만듭니다.';

export function TimelineCollageModal({ isOpen, onClose, records, uid, isLoadingRecords = false }: TimelineCollageModalProps) {
  const [selected, setSelected] = useState<PhotoItem[]>([]);
  const [title, setTitle] = useState('');
  const [step, setStep] = useState<'select' | 'generating' | 'done'>('select');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [growthCreatorOpen, setGrowthCreatorOpen] = useState(true);
  const generatingRef = useRef(false);

  const allPhotos = isLoadingRecords ? [] : extractPhotos(records);
  const filteredPhotos = allPhotos.filter((photo) => matchesPhotoSearch(photo, searchText, dateFrom, dateTo));

  const toggle = (photo: PhotoItem) => {
    setSelected(prev => {
      if (prev.find(p => p.url === photo.url)) {
        return prev.filter(p => p.url !== photo.url);
      }
      if (prev.length >= 8) {
        toast.warning('최대 8장까지 선택 가능합니다.');
        return prev;
      }
      return [...prev, photo];
    });
  };

  const updateSelectedDate = (photoUrl: string, date: string) => {
    setSelected(prev => prev.map(photo => (
      photo.url === photoUrl ? { ...photo, date } : photo
    )));
  };

  const generate = async () => {
    if (step === 'generating' || generatingRef.current) {
      toast.info('생성 중입니다. 잠시만 기다려주세요.');
      return;
    }
    if (selected.length < 4) {
      toast.warning('최소 4장을 선택해주세요.');
      return;
    }
    generatingRef.current = true;
    setStep('generating');

    try {
      const timelinePhotos = sortPhotosByDate(selected);
      const PAD = 20;
      const GAP = 12;
      const TITLE_H = 90;
      const W = 800;
      const PHOTO_W = (W - PAD * 2 - GAP) / 2;
      const PHOTO_H = Math.round(PHOTO_W * 0.72);
      const DATE_H = 30;
      const ROW_H = PHOTO_H + DATE_H + GAP;
      const { rows } = getLayout(timelinePhotos.length);
      const H = TITLE_H + rows * ROW_H + PAD;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // 배경
      ctx.fillStyle = '#FAF9F6';
      ctx.fillRect(0, 0, W, H);

      // 상단 컬러 바
      ctx.fillStyle = '#1A3C6E';
      ctx.fillRect(0, 0, W, 6);

      // 제목
      const resolvedTitle = title.trim() || CHANGE_RECORD_ASSISTANT_TITLE;
      ctx.fillStyle = '#1A3C6E';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(resolvedTitle, W / 2, 46);

      // 날짜 범위 부제
      if (timelinePhotos.length > 0) {
        const first = fmtDate(timelinePhotos[0].date);
        const last = fmtDate(timelinePhotos[timelinePhotos.length - 1].date);
        ctx.fillStyle = '#888';
        ctx.font = '15px sans-serif';
        ctx.fillText(`${first} ~ ${last}  ·  ${timelinePhotos.length}장`, W / 2, 70);
      }

      // 구분선
      ctx.strokeStyle = '#d0dff0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, TITLE_H - 8);
      ctx.lineTo(W - PAD, TITLE_H - 8);
      ctx.stroke();

      // 사진 배치
      for (let i = 0; i < timelinePhotos.length; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = PAD + col * (PHOTO_W + GAP);
        const y = TITLE_H + row * ROW_H;

        // 사진 배경 (회색 폴백)
        ctx.fillStyle = '#e8eef5';
        roundRect(ctx, x, y, PHOTO_W, PHOTO_H, 8);
        ctx.fill();

        try {
          const img = await loadImg(timelinePhotos[i].url);
          const scale = Math.max(PHOTO_W / img.width, PHOTO_H / img.height);
          const sw = PHOTO_W / scale;
          const sh = PHOTO_H / scale;
          const sx = (img.width - sw) / 2;
          const sy = (img.height - sh) / 2;

          ctx.save();
          roundRect(ctx, x, y, PHOTO_W, PHOTO_H, 8);
          ctx.clip();
          ctx.drawImage(img, sx, sy, sw, sh, x, y, PHOTO_W, PHOTO_H);
          ctx.restore();
        } catch {
          ctx.fillStyle = '#999';
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('사진 로드 실패', x + PHOTO_W / 2, y + PHOTO_H / 2);
        }

        // 날짜 레이블
        ctx.fillStyle = '#555';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fmtDate(timelinePhotos[i].date), x + PHOTO_W / 2, y + PHOTO_H + 20);
      }

      // PNG Blob → Storage 업로드
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('blob 변환 실패'))), 'image/png');
      });

      const id = `timeline_${Date.now()}`;
      const storageRef = ref(storage, `users/${uid}/timelines/${id}.png`);
      await uploadBytes(storageRef, blob, { contentType: 'image/png' });
      const url = await getDownloadURL(storageRef);

      // Firestore 저장
      await setDoc(doc(db, 'users', uid, 'timelines', id), {
        timelineImageUrl: url,
        timelineCreatedAt: new Date().toISOString(),
        title: resolvedTitle,
        photoCount: timelinePhotos.length,
        photoDates: timelinePhotos.map(p => p.date),
        photoMeta: timelinePhotos.map(p => ({
          url: p.url,
          displayDate: p.date,
          recordDate: p.recordDate,
          takenAt: p.takenAt || '',
          takenTime: p.takenTime || '',
          locationLabel: p.locationLabel || '',
          originalName: p.originalName || '',
        })),
        storageId: id,
      });

      setResultUrl(url);
      generatingRef.current = false;
      setStep('done');
      toast.success('HARU타임라인이 저장되었습니다!');
    } catch (err) {
      console.error('HARU타임라인 생성 실패:', err);
      toast.error('생성에 실패했습니다. 다시 시도해주세요.');
      generatingRef.current = false;
      setStep('select');
    }
  };

  const copyLink = async () => {
    if (!resultUrl) return;
    try {
      await navigator.clipboard.writeText(resultUrl);
      toast.success('링크가 복사되었습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  const handleClose = () => {
    if (step === 'generating' || generatingRef.current) {
      toast.info('생성 중입니다. 완료 후 닫을 수 있습니다.');
      return;
    }
    generatingRef.current = false;
    setStep('select');
    setSelected([]);
    setTitle('');
    setResultUrl(null);
    setSearchText('');
    setDateFrom('');
    setDateTo('');
    setGrowthCreatorOpen(false);
    onClose();
  };

  useEffect(() => {
    if (!isOpen || step !== 'generating') return;

    const blockEscapeWhileGenerating = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      toast.info('생성 중입니다. 완료 후 닫을 수 있습니다.');
    };

    window.addEventListener('keydown', blockEscapeWhileGenerating, true);
    return () => window.removeEventListener('keydown', blockEscapeWhileGenerating, true);
  }, [isOpen, step]);

  if (!isOpen) return null;

  const selectedForPreview = sortPhotosByDate(selected);

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '92vh',
          backgroundColor: '#fff',
          borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1A3C6E', margin: 0 }}>
              🌱 HARU타임라인
            </p>
            <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>
              {CHANGE_RECORD_ASSISTANT_DESCRIPTION}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={step === 'generating'}
            title={step === 'generating' ? '생성 중입니다' : '닫기'}
            style={{
              background: 'none', border: 'none', fontSize: 20,
              cursor: step === 'generating' ? 'not-allowed' : 'pointer',
              color: step === 'generating' ? '#d0d0d0' : '#aaa',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* 사진 선택 화면 */}
          {step === 'select' && (
            <div style={{ padding: '16px 16px 120px' }}>
              <div style={{ marginBottom: 14 }}>
                {!growthCreatorOpen ? (
                  <button
                    type="button"
                    onClick={() => setGrowthCreatorOpen(true)}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderRadius: 12,
                      backgroundColor: '#1A3C6E',
                      color: '#fff',
                      padding: '15px 16px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>새 성장타임라인 만들기</span>
                      <span style={{ fontSize: 12, color: '#dbe7f6', fontWeight: 600 }}>
                        모바일 갤러리 사진을 선택해 촬영일 순으로 정리합니다.
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        borderRadius: 10,
                        backgroundColor: '#ffffff',
                        color: '#1A3C6E',
                        padding: '9px 12px',
                        fontSize: 13,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      사진 선택 시작
                    </span>
                  </button>
                ) : (
                  <GrowthTimelineCreator
                    uid={uid}
                    onDone={() => {
                      setGrowthCreatorOpen(false);
                    }}
                  />
                )}
              </div>

              {/* ⬇️ 서버 사진 자동수집·콜라주 생성 흐름 — 갤러리 직접선택 MVP로 전환하며 화면에서 숨김.
                  코드는 보존하며 되살리려면 아래 false 를 제거하면 됨. */}
              {false && (<>
              {/* 제목 입력 */}
              <div style={{ marginBottom: 14 }}>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="HARU타임라인 제목 (예: 포도 성장기 2026)"
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: '1px solid #d0dff0', borderRadius: 10,
                    fontSize: 15, color: '#1A3C6E', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* 선택 현황 */}
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                  {isLoadingRecords
                    ? '사진 기록 불러오는 중'
                    : allPhotos.length > 0
                    ? `총 ${allPhotos.length}장 · 표시 ${filteredPhotos.length}장 · ${selected.length}장 선택됨`
                    : '사진 있는 기록 없음'}
                </p>
                {selected.length > 0 && selected.length < 4 && (
                  <span style={{ fontSize: 12, color: '#e57373' }}>4~8장을 선택하세요</span>
                )}
              </div>
              {allPhotos.length > 0 && (
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px' }}>
                  새 사진은 촬영일/시간/GPS가 있으면 자동 표시됩니다. 과거 사진은 기록일 기준일 수 있습니다.
                  {' '}
                  {CHANGE_RECORD_ASSISTANT_HELP}
                </p>
              )}
              {allPhotos.length > 0 && allPhotos.length < 4 && (
                <p style={{ fontSize: 12, color: '#e57373', margin: '0 0 12px', lineHeight: 1.6 }}>
                  HARU타임라인을 만들려면 사진이 포함된 기록이 필요합니다. 식물, 건강, 가족, 프로젝트 사진을 며칠에 걸쳐 기록한 뒤 다시 시도해 주세요.
                </p>
              )}
              {allPhotos.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    placeholder="사진 이름·장소·날짜 검색"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: '1px solid #d0dff0',
                      borderRadius: 10,
                      fontSize: 14,
                      color: '#1A3C6E',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginTop: 8,
                  }}>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      style={{
                        minWidth: 0,
                        padding: '8px 10px',
                        border: '1px solid #d0dff0',
                        borderRadius: 9,
                        fontSize: 13,
                        color: '#1A3C6E',
                        boxSizing: 'border-box',
                      }}
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      style={{
                        minWidth: 0,
                        padding: '8px 10px',
                        border: '1px solid #d0dff0',
                        borderRadius: 9,
                        fontSize: 13,
                        color: '#1A3C6E',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              )}

              {isLoadingRecords && (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>
                  <p style={{ fontSize: 14, margin: 0 }}>사진 기록을 불러오는 중입니다.</p>
                </div>
              )}

              {/* 사진 없는 경우 */}
              {!isLoadingRecords && allPhotos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>
                  <p style={{ fontSize: 40, marginBottom: 12 }}>📷</p>
                  <p style={{ fontSize: 14, color: '#999', margin: 0 }}>아직 타임라인으로 묶을 사진 기록이 없습니다.</p>
                  <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>사진이 포함된 HARU 기록을 먼저 저장해 주세요.</p>
                </div>
              )}
              {allPhotos.length > 0 && filteredPhotos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#999' }}>
                  <p style={{ fontSize: 14, margin: 0 }}>검색 조건에 맞는 사진이 없습니다.</p>
                </div>
              )}

              {/* 사진 그리드 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
              }}>
                {filteredPhotos.map((photo, idx) => {
                  const selIdx = selected.findIndex(p => p.url === photo.url);
                  const isSel = selIdx !== -1;
                  const subLabel = formatPhotoSubLabel(photo);
                  return (
                    <div
                      key={`${photo.url}-${idx}`}
                      onClick={() => toggle(photo)}
                      style={{
                        position: 'relative', paddingTop: '100%',
                        cursor: 'pointer', borderRadius: 8, overflow: 'hidden',
                        border: isSel ? '3px solid #1A3C6E' : '3px solid transparent',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <img
                        src={photo.url}
                        alt={photo.date}
                        style={{
                          position: 'absolute', inset: 0,
                          width: '100%', height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      {/* 날짜 */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
                        padding: '12px 4px 4px', textAlign: 'center',
                      }}>
                        <p style={{ fontSize: 10, color: '#fff', margin: 0 }}>
                          {fmtDate(photo.date)}
                        </p>
                        {subLabel && (
                          <p style={{ fontSize: 9, color: '#eef5ff', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {subLabel}
                          </p>
                        )}
                      </div>
                      {/* 선택 번호 */}
                      {isSel && (
                        <div style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 22, height: 22, borderRadius: '50%',
                          backgroundColor: '#1A3C6E', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        }}>
                          {selIdx + 1}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selected.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E', margin: '0 0 8px' }}>
                    선택 사진 날짜
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedForPreview.map((photo, idx) => (
                      <div
                        key={`date-${photo.url}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '52px 1fr',
                          gap: 10,
                          alignItems: 'center',
                          padding: 8,
                          border: '1px solid #e5edf7',
                          borderRadius: 10,
                          backgroundColor: '#fafcff',
                        }}
                      >
                        <div style={{ position: 'relative', width: 52, height: 52, borderRadius: 8, overflow: 'hidden' }}>
                          <img
                            src={photo.url}
                            alt={photo.date}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                          <div style={{
                            position: 'absolute', top: 4, left: 4,
                            width: 18, height: 18, borderRadius: '50%',
                            backgroundColor: '#1A3C6E', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700,
                          }}>
                            {idx + 1}
                          </div>
                        </div>
                        <input
                          type="date"
                          value={photo.date}
                          onChange={e => updateSelectedDate(photo.url, e.target.value)}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            border: '1px solid #d0dff0',
                            borderRadius: 8,
                            padding: '9px 10px',
                            fontSize: 14,
                            color: '#1A3C6E',
                            backgroundColor: '#fff',
                          }}
                        />
                        {(photo.takenTime || photo.locationLabel || photo.originalName) && (
                          <p style={{
                            gridColumn: '2',
                            fontSize: 11,
                            color: '#7a8ca5',
                            margin: '-4px 0 0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {[photo.originalName, photo.takenTime?.slice(0, 5), photo.locationLabel].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </>)}
            </div>
          )}

          {/* 생성 중 */}
          {step === 'generating' && (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 48, marginBottom: 16 }}>🌱</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1A3C6E' }}>HARU타임라인 생성 중...</p>
              <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>사진 {selected.length}장을 날짜순으로 합성하고 있습니다</p>
              <p style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>생성 중에는 창을 닫을 수 없습니다.</p>
            </div>
          )}

          {/* 완료 */}
          {step === 'done' && resultUrl && (
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', textAlign: 'center', marginBottom: 14 }}>
                🎉 HARU타임라인 완성!
              </p>
              <img
                src={resultUrl}
                alt="HARU타임라인 결과"
                style={{
                  width: '100%', borderRadius: 12,
                  border: '1px solid #d0dff0', marginBottom: 16,
                  display: 'block',
                }}
              />
              {/* 링크 복사 */}
              <button
                onClick={copyLink}
                style={{
                  width: '100%', padding: '12px',
                  backgroundColor: '#f0f4ff', color: '#1A3C6E',
                  border: '1px solid #d0dff0', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                🔗 링크 복사
              </button>

              {/* 이미지 저장 */}
              <a
                href={resultUrl}
                download="HARU타임라인.png"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block', padding: '12px',
                  backgroundColor: '#f5f5f5', color: '#555',
                  borderRadius: 10, fontSize: 14,
                  textAlign: 'center', textDecoration: 'none',
                  border: '1px solid #e0e0e0', marginBottom: 10,
                }}
              >
                📥 이미지 저장
              </a>

              <button
                onClick={handleClose}
                style={{
                  width: '100%', padding: 10,
                  background: 'none', color: '#aaa',
                  border: 'none', fontSize: 13, cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </div>
          )}
        </div>

        {/* 하단 고정: 생성 버튼 */}
        {step === 'select' && selected.length >= 4 && (
          <div style={{
            position: 'sticky', bottom: 0,
            backgroundColor: '#fff',
            borderTop: '1px solid #f0f0f0',
            padding: '12px 16px',
            flexShrink: 0,
          }}>
            <div style={{
              padding: '10px 14px', backgroundColor: '#f0f4ff',
              borderRadius: 10, marginBottom: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <p style={{ fontSize: 13, color: '#1A3C6E', margin: 0 }}>
                {selectedForPreview.length}장 선택 · {fmtDate(selectedForPreview[0].date)} ~ {fmtDate(selectedForPreview[selectedForPreview.length - 1].date)}
              </p>
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                {getLayout(selected.length).cols}×{getLayout(selected.length).rows}
              </p>
            </div>
            <button
              onClick={generate}
              style={{
                width: '100%', padding: '14px',
                backgroundColor: '#1A3C6E', color: '#fff',
                border: 'none', borderRadius: 12,
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >
              🌱 HARU타임라인 생성하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
