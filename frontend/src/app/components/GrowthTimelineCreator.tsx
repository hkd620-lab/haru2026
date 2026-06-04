import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { toast } from 'sonner';
import { db, storage } from '../../firebase';
import { firestoreService } from '../services/firestoreService';
import { compressImage } from '../services/imageService';
import { readOriginalImageMeta } from '../services/photoMetadataService';
import {
  getLocationCandidateFromGps,
  type ReverseGeocodeCandidate,
} from '../services/reverseGeocodeService';
import { GrowthTimelineDocumentModal, type GrowthTimelineDocumentItem } from './GrowthTimelineDocumentModal';

type TimelineItem = GrowthTimelineDocumentItem;

type DraftTimelineItem = TimelineItem & {
  id: string;
  file: File;
  previewUrl: string;
  originalName: string;
  latitude?: number;
  longitude?: number;
  locationCandidate?: ReverseGeocodeCandidate;
  locationStatus?: 'none' | 'loading' | 'found' | 'not_found' | 'error';
};

interface GrowthTimelineCreatorProps {
  uid: string;
  onDone?: () => void;
}

interface GrowthTimelineLibraryProps {
  uid: string;
  refreshKey?: number;
  onEditTimeline?: (recordId: string, dateStr: string) => void;
}

type SavedGrowthTimeline = {
  id: string;
  title: string;
  status?: string;
  createdAt?: any;
  updatedAt?: any;
  finalizedAt?: any;
  periodStart?: string;
  periodEnd?: string;
  itemCount?: number;
  items: TimelineItem[];
};

type TimelineRecordItem = {
  url: string;
  takenDate: string;
  memo: string;
  order: number;
  locationLabel?: string;
  locationCandidate?: ReverseGeocodeCandidate;
  locationStatus?: 'none' | 'loading' | 'found' | 'not_found' | 'error';
  latitude?: number;
  longitude?: number;
};

const TIMELINE_IMAGE_MAX_WIDTH = 1600;
const TIMELINE_IMAGE_QUALITY = 0.82;

function todayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'photo';
}

function removeFileExtension(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

function getOwnFormatPhotoPathFromUrl(imageUrl: string, uid: string) {
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) return null;
  try {
    const parsed = new URL(imageUrl);
    const isFirebaseHost =
      parsed.hostname === 'firebasestorage.googleapis.com' ||
      parsed.hostname === 'storage.googleapis.com' ||
      parsed.hostname.endsWith('.storage.googleapis.com');
    if (!isFirebaseHost) return null;

    const decodedPath = decodeURIComponent(parsed.pathname);
    const targetPrefix = `users/${uid}/format_photos/`;
    const objectMarker = `/o/${targetPrefix}`;
    const objectIndex = decodedPath.indexOf(objectMarker);
    if (objectIndex >= 0) {
      const objectPath = decodedPath.slice(objectIndex + '/o/'.length);
      return objectPath.startsWith(targetPrefix) ? objectPath : null;
    }

    const directMarker = `/${targetPrefix}`;
    const directIndex = decodedPath.indexOf(directMarker);
    if (directIndex >= 0) {
      const objectPath = decodedPath.slice(directIndex + 1);
      return objectPath.startsWith(targetPrefix) ? objectPath : null;
    }
  } catch {
    return null;
  }
  return null;
}

function sortDraftItems(items: DraftTimelineItem[]) {
  return [...items].sort((a, b) => (
    a.takenDate.localeCompare(b.takenDate) || a.order - b.order
  ));
}

function sortTimelineItems(items: TimelineItem[]) {
  return [...items].sort((a, b) => a.takenDate.localeCompare(b.takenDate) || a.order - b.order);
}

function timestampLabel(value: any) {
  const date = value?.toDate?.() || (typeof value === 'string' ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function fallbackTitleDate(value?: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  const source = Number.isNaN(date.getTime()) ? new Date() : date;
  const yyyy = source.getFullYear();
  const mm = String(source.getMonth() + 1).padStart(2, '0');
  const dd = String(source.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function buildFallbackTimelineTitle(periodStart?: string) {
  return `${fallbackTitleDate(periodStart)} 성장타임라인`;
}

function formatDateLabel(value: string) {
  if (!value) return '';
  const [yyyy, mm, dd] = value.split('-');
  if (!yyyy || !mm || !dd) return value;
  return `${yyyy}.${mm}.${dd}`;
}

function buildTimelineSummary(items: TimelineRecordItem[], periodStart: string, periodEnd: string) {
  const header = [
    `기간: ${formatDateLabel(periodStart)}${periodEnd && periodEnd !== periodStart ? ` ~ ${formatDateLabel(periodEnd)}` : ''}`,
    `사진: ${items.length}장`,
  ].filter(Boolean).join('\n');
  const body = items
    .map((item, index) => {
      const memo = item.memo.trim() || '설명 없음';
      return `${index + 1}. ${formatDateLabel(item.takenDate)}\n${memo}`;
    })
    .join('\n\n');
  return `${header}\n\n${body}`.trim();
}

function serializeTimelineRecordItem(item: DraftTimelineItem, url: string, index: number): TimelineRecordItem {
  const savedItem: TimelineRecordItem = {
    url,
    takenDate: item.takenDate,
    memo: item.memo.trim(),
    order: index,
    locationLabel: (item.locationLabel || '').trim(),
  };
  if (item.locationStatus) savedItem.locationStatus = item.locationStatus;
  if (item.locationCandidate) savedItem.locationCandidate = item.locationCandidate;
  if (typeof item.latitude === 'number') savedItem.latitude = item.latitude;
  if (typeof item.longitude === 'number') savedItem.longitude = item.longitude;
  return savedItem;
}

async function createTimelineTitle(inputTitle: string, summary: string, defaultFallbackTitle: string) {
  const customTitle = inputTitle.trim();
  const hasCustomTitle = customTitle.length > 0 && customTitle !== '성장타임라인';
  const fallbackTitle = hasCustomTitle ? customTitle : defaultFallbackTitle;

  try {
    const fns = getFunctions(undefined, 'asia-northeast3');
    const extractTitle = httpsCallable(fns, 'extractTitle');
    const titleText = hasCustomTitle ? `${customTitle}\n\n${summary}` : summary;
    if (titleText.trim().length <= 5) return fallbackTitle;
    const result = await extractTitle({
      text: titleText.slice(0, 1500),
      format: '성장타임라인',
    });
    const aiTitle = String((result.data as any)?.title || '').trim();
    return aiTitle || fallbackTitle;
  } catch {
    return fallbackTitle;
  }
}

function locationCandidateLabel(item: Pick<DraftTimelineItem, 'locationCandidate' | 'locationStatus'>) {
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

function normalizeSavedTimeline(id: string, data: any): SavedGrowthTimeline | null {
  if (data?.type !== 'growth') return null;
  if (data?.status && data.status !== 'final') return null;
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items = rawItems
    .filter((item: any) => typeof item?.url === 'string' && item.url.startsWith('http'))
    .map((item: any, index: number): TimelineItem => ({
      url: item.url,
      takenDate: typeof item.takenDate === 'string' && item.takenDate ? item.takenDate : todayKey(),
      metadataSource: item.metadataSource === 'exif' || item.metadataSource === 'manual' || item.metadataSource === 'manualRequired'
        ? item.metadataSource
        : 'manualRequired',
      memo: typeof item.memo === 'string' ? item.memo : '',
      order: typeof item.order === 'number' ? item.order : index,
      locationLabel: typeof item.locationLabel === 'string' ? item.locationLabel : '',
      locationCandidate: item.locationCandidate,
      locationStatus: item.locationStatus,
    }));
  const sortedItems = sortTimelineItems(items);
  return {
    id,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : '성장타임라인',
    status: typeof data.status === 'string' ? data.status : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    finalizedAt: data.finalizedAt,
    periodStart: typeof data.periodStart === 'string' ? data.periodStart : sortedItems[0]?.takenDate,
    periodEnd: typeof data.periodEnd === 'string' ? data.periodEnd : sortedItems[sortedItems.length - 1]?.takenDate,
    itemCount: typeof data.itemCount === 'number' ? data.itemCount : sortedItems.length,
    items: sortedItems,
  };
}

// records 컬렉션(users/{uid}/records)에 recordType:'growthTimeline'로 저장된 타임라인 정규화
function normalizeRecordTimeline(id: string, data: any): SavedGrowthTimeline | null {
  if (data?.recordType !== 'growthTimeline') return null;
  const rawItems = Array.isArray(data.timelineItems) ? data.timelineItems : [];
  const items = rawItems
    .filter((item: any) => typeof item?.url === 'string' && item.url.startsWith('http'))
    .map((item: any, index: number): TimelineItem => ({
      url: item.url,
      takenDate: typeof item.takenDate === 'string' && item.takenDate ? item.takenDate : todayKey(),
      // 저장된 record 항목은 날짜가 확정된 상태 → '날짜 확인 필요' 배지 방지
      metadataSource: 'manual',
      memo: typeof item.memo === 'string' ? item.memo : '',
      order: typeof item.order === 'number' ? item.order : index,
      locationLabel: typeof item.locationLabel === 'string' ? item.locationLabel : '',
      locationCandidate: item.locationCandidate,
      locationStatus: item.locationStatus,
    }));
  const sortedItems = sortTimelineItems(items);
  return {
    id,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : '성장타임라인',
    status: 'final',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    finalizedAt: undefined,
    periodStart: typeof data.periodStart === 'string' ? data.periodStart : sortedItems[0]?.takenDate,
    periodEnd: typeof data.periodEnd === 'string' ? data.periodEnd : sortedItems[sortedItems.length - 1]?.takenDate,
    itemCount: typeof data.itemCount === 'number' ? data.itemCount : sortedItems.length,
    items: sortedItems,
  };
}

export function GrowthTimelineCreator({ uid, onDone }: GrowthTimelineCreatorProps) {
  const [title, setTitle] = useState('성장타임라인');
  const [items, setItems] = useState<DraftTimelineItem[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDocumentOpen, setIsDocumentOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const today = todayKey();

  const sortedItems = useMemo(() => sortDraftItems(items), [items]);
  const documentItems = useMemo(
    () => sortedItems.map((item, index): GrowthTimelineDocumentItem => ({
      url: item.previewUrl,
      takenDate: item.takenDate,
      metadataSource: item.metadataSource,
      memo: item.memo,
      order: index,
      locationCandidate: item.locationCandidate,
      locationStatus: item.locationStatus,
      locationLabel: item.locationLabel,
    })),
    [sortedItems]
  );
  const needsDateCheck = sortedItems.some(item => item.metadataSource === 'manualRequired');

  useEffect(() => {
    previewUrlsRef.current = items.map(item => item.previewUrl);
  }, [items]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;

    setIsReading(true);
    try {
      const nextItems: DraftTimelineItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const meta = await readOriginalImageMeta(file);
        const hasExifDate = typeof meta.takenDate === 'string' && meta.takenDate.trim().length > 0;
        const latitude = typeof meta.latitude === 'number' ? meta.latitude : undefined;
        const longitude = typeof meta.longitude === 'number' ? meta.longitude : undefined;
        const hasGps = typeof latitude === 'number' && typeof longitude === 'number';
        let locationCandidate: ReverseGeocodeCandidate | undefined;
        let locationLabel = '';
        let locationStatus: DraftTimelineItem['locationStatus'] = hasGps ? 'loading' : 'none';

        if (hasGps) {
          try {
            const candidate = await getLocationCandidateFromGps(latitude, longitude);
            if (candidate) {
              locationCandidate = candidate;
              // 자동 인식한 장소명을 기본값으로 (사용자가 그대로 두거나 수정 가능)
              locationLabel = candidate.placeName
                || candidate.regionLabel
                || candidate.roadAddress
                || candidate.jibunAddress
                || '';
              locationStatus = 'found';
            } else {
              locationStatus = 'not_found';
            }
          } catch (error) {
            console.warn('성장타임라인 촬영장소 후보 확인 실패');
            locationStatus = 'error';
          }
        }

        nextItems.push({
          id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          originalName: file.name,
          url: '',
          takenDate: hasExifDate ? meta.takenDate! : today,
          metadataSource: hasExifDate ? 'exif' : 'manualRequired',
          memo: '',
          order: items.length + i,
          latitude,
          longitude,
          locationCandidate,
          locationLabel,
          locationStatus,
        });
      }
      setItems(prev => sortDraftItems([...prev, ...nextItems]).map((item, index) => ({ ...item, order: index })));
      toast.success(`${nextItems.length}장의 사진을 불러왔습니다.`);
    } catch (error) {
      console.error('성장타임라인 사진 읽기 실패:', error);
      toast.error('사진 정보를 읽지 못했습니다.');
    } finally {
      setIsReading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateDate = (id: string, takenDate: string) => {
    setItems(prev => sortDraftItems(prev.map(item => (
      item.id === id ? { ...item, takenDate, metadataSource: 'manual' } : item
    ))).map((item, index) => ({ ...item, order: index })));
  };

  const updateMemo = (id: string, memo: string) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, memo } : item)));
  };

  const updateLocationLabel = (id: string, locationLabel: string) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, locationLabel } : item)));
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const target = prev.find(item => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return sortDraftItems(prev.filter(item => item.id !== id)).map((item, index) => ({ ...item, order: index }));
    });
  };

  const openDocumentPreview = () => {
    if (isSaving) return;
    if (sortedItems.length === 0) {
      toast.warning('사진을 먼저 선택해주세요.');
      return;
    }
    setIsDocumentOpen(true);
  };

  const updatePreviewMemo = (order: number, memo: string) => {
    const target = sortedItems[order];
    if (!target) return;
    updateMemo(target.id, memo);
  };

  const finalizeTimeline = async () => {
    if (isSaving) return;
    if (sortedItems.length === 0) {
      toast.warning('사진을 먼저 선택해주세요.');
      return;
    }

    setIsSaving(true);
    const timelineId = `growth_${Date.now()}`;
    try {
      const savedItems: TimelineRecordItem[] = [];
      for (let index = 0; index < sortedItems.length; index++) {
        const item = sortedItems[index];
        const safeName = sanitizeFileName(removeFileExtension(item.originalName));
        const fileName = `${timelineId}_${String(index + 1).padStart(2, '0')}_${safeName}.jpg`;
        const imageRef = ref(storage, `users/${uid}/format_photos/${fileName}`);
        const compressed = await compressImage(item.file, TIMELINE_IMAGE_MAX_WIDTH, TIMELINE_IMAGE_QUALITY);
        await uploadBytes(imageRef, compressed, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(imageRef);
        savedItems.push(serializeTimelineRecordItem(item, url, index));
      }
      const periodStart = savedItems[0]?.takenDate || '';
      const periodEnd = savedItems[savedItems.length - 1]?.takenDate || '';
      const content = buildTimelineSummary(savedItems, periodStart, periodEnd);
      const resolvedTitle = await createTimelineTitle(title, content, buildFallbackTimelineTitle(periodStart));

      await firestoreService.saveRecord(uid, {
        date: todayKey(),
        formats: ['성장타임라인'],
        format: '성장타임라인',
        recordType: 'growthTimeline',
        type: 'growthTimeline',
        source: 'growthTimeline',
        title: resolvedTitle,
        content,
        timelineItems: savedItems,
        periodStart,
        periodEnd,
        itemCount: savedItems.length,
      });

      toast.success('HARU타임라인이 최종 저장되었습니다.');
      items.forEach(item => URL.revokeObjectURL(item.previewUrl));
      setItems([]);
      setTitle('성장타임라인');
      setIsDocumentOpen(false);
      onDone?.();
    } catch (error) {
      console.error('HARU타임라인 최종 저장 실패:', error);
      toast.error('HARU타임라인 최종 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ border: '1px solid #dbe8d2', borderRadius: 14, padding: 14, backgroundColor: '#fbfdf7', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#355524' }}>새 성장타임라인 만들기</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7b8b72' }}>모바일 갤러리 사진을 선택하면 촬영일 기준으로 정렬합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isReading || isSaving}
          style={{
            border: 'none',
            borderRadius: 10,
            backgroundColor: '#4E6B2A',
            color: '#fff',
            padding: '10px 12px',
            fontSize: 13,
            fontWeight: 700,
            cursor: isReading || isSaving ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          사진 선택
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        style={{ display: 'none' }}
      />

      <input
        value={title}
        onChange={event => setTitle(event.target.value)}
        placeholder="타임라인 제목"
        disabled={isSaving}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid #d6e4cc',
          borderRadius: 10,
          padding: '10px 12px',
          color: '#355524',
          fontSize: 14,
          outline: 'none',
          marginBottom: 12,
          backgroundColor: '#fff',
        }}
      />

      {items.length === 0 ? (
        <div style={{ padding: '24px 12px', textAlign: 'center', color: '#8b987f', fontSize: 13, border: '1px dashed #d6e4cc', borderRadius: 12 }}>
          사진을 선택하면 EXIF 촬영일을 읽어 날짜순으로 미리 보여드립니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {needsDateCheck && (
            <p style={{ margin: 0, color: '#b7791f', fontSize: 12, lineHeight: 1.5 }}>
              촬영일이 없는 사진이 있습니다. 저장 전 날짜를 확인해주세요.
            </p>
          )}
          {sortedItems.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr',
                gap: 10,
                padding: 10,
                border: '1px solid #e1ead9',
                borderRadius: 12,
                backgroundColor: '#fff',
              }}
            >
              <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: '#eef3e8' }}>
                <img src={item.previewUrl} alt={item.originalName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <input
                    type="date"
                    value={item.takenDate}
                    onChange={event => updateDate(item.id, event.target.value)}
                    disabled={isSaving}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: '1px solid #d6e4cc',
                      borderRadius: 8,
                      padding: '8px 9px',
                      fontSize: 13,
                      color: '#355524',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={isSaving}
                    title="사진 제거"
                    style={{
                      width: 34,
                      height: 34,
                      border: '1px solid #ead7d7',
                      borderRadius: 8,
                      backgroundColor: '#fff7f7',
                      color: '#a64b4b',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                  <span style={{
                    fontSize: 11,
                    color: item.metadataSource === 'manualRequired' ? '#9a6700' : '#63745a',
                    backgroundColor: item.metadataSource === 'manualRequired' ? '#fff7dd' : '#eef6e9',
                    borderRadius: 999,
                    padding: '3px 7px',
                    fontWeight: 700,
                  }}>
                    {item.metadataSource === 'exif' ? 'EXIF 촬영일' : item.metadataSource === 'manual' ? '직접 수정' : '날짜 확인 필요'}
                  </span>
                  <span style={{ fontSize: 11, color: '#8a9683', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.originalName}
                  </span>
                </div>
                {item.locationStatus === 'found' || (item.locationLabel && item.locationLabel.trim()) ? (
                  <div style={{ marginBottom: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 11, color: '#37644a', fontWeight: 700 }}>
                      📍 이 장소가 맞나요? (다르면 직접 수정하세요)
                    </span>
                    <input
                      value={item.locationLabel || ''}
                      onChange={event => updateLocationLabel(item.id, event.target.value)}
                      placeholder="촬영장소"
                      disabled={isSaving}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        border: '1px solid #cfe3d6',
                        borderRadius: 8,
                        padding: '8px 9px',
                        fontSize: 16,
                        color: '#1f3a26',
                        backgroundColor: '#f7fbf8',
                      }}
                    />
                    {locationDetailLabel(item.locationCandidate) && (
                      <span style={{ fontSize: 11, color: '#8a9683', lineHeight: 1.4 }}>
                        자동 인식: {locationDetailLabel(item.locationCandidate)}
                      </span>
                    )}
                  </div>
                ) : locationCandidateLabel(item) ? (
                  <div style={{ marginBottom: 7 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 11,
                        color: '#8a9683',
                        backgroundColor: '#f2f4f6',
                        borderRadius: 999,
                        padding: '3px 7px',
                        fontWeight: 700,
                      }}
                    >
                      {locationCandidateLabel(item)}
                    </span>
                  </div>
                ) : null}
                <input
                  value={item.memo}
                  onChange={event => updateMemo(item.id, event.target.value)}
                  placeholder="메모"
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '1px solid #e1ead9',
                    borderRadius: 8,
                    padding: '8px 9px',
                    fontSize: 13,
                    color: '#355524',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={openDocumentPreview}
        disabled={isReading || isSaving || sortedItems.length === 0}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: 12,
          backgroundColor: sortedItems.length === 0 ? '#d7dfcf' : '#1A3C6E',
          color: '#fff',
          padding: '13px 14px',
          marginTop: 12,
          fontSize: 15,
          fontWeight: 800,
          cursor: isReading || isSaving || sortedItems.length === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        HARU타임라인 생성
      </button>

      <GrowthTimelineDocumentModal
        isOpen={isDocumentOpen}
        title={title}
        items={documentItems}
        editable
        isSaving={isSaving}
        onClose={() => {
          if (!isSaving) setIsDocumentOpen(false);
        }}
        onTitleChange={setTitle}
        onMemoChange={updatePreviewMemo}
        onFinalize={finalizeTimeline}
      />
    </div>
  );
}

export function GrowthTimelineLibrary({ uid, refreshKey = 0, onEditTimeline }: GrowthTimelineLibraryProps) {
  const [timelines, setTimelines] = useState<SavedGrowthTimeline[]>([]);
  const [selectedTimeline, setSelectedTimeline] = useState<SavedGrowthTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string>('');
  const [editingId, setEditingId] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState('');
  const [savingTitleId, setSavingTitleId] = useState<string>('');

  const startTitleEdit = (timeline: SavedGrowthTimeline) => {
    if (deletingId || savingTitleId) return;
    setEditingId(timeline.id);
    setEditingTitle(timeline.title);
  };

  const cancelTitleEdit = () => {
    if (savingTitleId) return;
    setEditingId('');
    setEditingTitle('');
  };

  const saveTitleEdit = async (timeline: SavedGrowthTimeline) => {
    if (savingTitleId || deletingId) return;
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      toast.warning('제목을 입력해주세요.');
      return;
    }
    if (nextTitle === timeline.title) {
      cancelTitleEdit();
      return;
    }

    setSavingTitleId(timeline.id);
    try {
      const updatedAt = new Date().toISOString();
      await updateDoc(doc(db, 'users', uid, 'records', timeline.id), {
        title: nextTitle,
        updatedAt,
      });
      setTimelines(prev => prev.map(item => (
        item.id === timeline.id ? { ...item, title: nextTitle, updatedAt } : item
      )));
      setSelectedTimeline(prev => (
        prev?.id === timeline.id ? { ...prev, title: nextTitle, updatedAt } : prev
      ));
      setEditingId('');
      setEditingTitle('');
      toast.success('타임라인 제목을 수정했습니다.');
    } catch (error) {
      console.error('타임라인 제목 수정 실패:', error);
      toast.error('제목 수정에 실패했습니다.');
    } finally {
      setSavingTitleId('');
    }
  };

  const handleDelete = async (timeline: SavedGrowthTimeline) => {
    if (deletingId || savingTitleId) return;
    const ok = window.confirm(`'${timeline.title}' 타임라인을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`);
    if (!ok) return;
    setDeletingId(timeline.id);
    let imageCleanupFailed = false;
    try {
      const recordRef = doc(db, 'users', uid, 'records', timeline.id);
      const recordSnap = await getDoc(recordRef);
      const recordData = recordSnap.exists() ? recordSnap.data() : null;
      const rawTimelineItems = Array.isArray(recordData?.timelineItems) ? recordData.timelineItems : [];
      const imagePaths = Array.from(new Set(
        rawTimelineItems
          .map((item: any) => getOwnFormatPhotoPathFromUrl(item?.url, uid))
          .filter((path: string | null): path is string => Boolean(path)),
      ));

      // PDF 캐시(timelinePdfs/)는 기록 삭제 시 고아로 남을 수 있음.
      // 차기 정리 정책 검토 대상. 3차-A에서는 이미지 압축·이미지 삭제만 처리.
      const imageCleanupResults = await Promise.allSettled(
        imagePaths.map((path) => deleteObject(ref(storage, path))),
      );
      imageCleanupFailed = imageCleanupResults.some((result) => result.status === 'rejected');
      if (imageCleanupFailed) {
        console.warn('성장타임라인 일부 이미지 Storage 정리에 실패했습니다.', imageCleanupResults);
      }

      await deleteDoc(recordRef);
      setTimelines(prev => prev.filter(item => item.id !== timeline.id));
      setSelectedTimeline(prev => (prev?.id === timeline.id ? null : prev));
      toast.success(imageCleanupFailed ? '일부 이미지 정리에 실패했지만 기록은 삭제되었습니다.' : '타임라인을 삭제했습니다.');
    } catch (error) {
      console.error('타임라인 삭제 실패:', error);
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingId('');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadTimelines = async () => {
      setIsLoading(true);
      try {
        const snap = await getDocs(query(
          collection(db, 'users', uid, 'records'),
          where('recordType', '==', 'growthTimeline'),
        ));
        if (cancelled) return;
        const list = snap.docs
          .map(docSnap => normalizeRecordTimeline(docSnap.id, docSnap.data()))
          .filter((item): item is SavedGrowthTimeline => item !== null)
          .sort((a, b) => {
            const at = a.finalizedAt?.toMillis?.() || a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime() || 0;
            const bt = b.finalizedAt?.toMillis?.() || b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime() || 0;
            return bt - at;
          });
        setTimelines(list);
      } catch (error) {
        console.error('성장타임라인 목록 로드 실패:', error);
        if (!cancelled) toast.error('성장타임라인 목록을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadTimelines();
    return () => {
      cancelled = true;
    };
  }, [uid, refreshKey]);

  return (
    <div style={{ border: '1px solid #e4ecdc', borderRadius: 14, padding: 14, backgroundColor: '#fff', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1A3C6E' }}>HARU비서기록</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7a8696' }}>
            {isLoading ? '불러오는 중' : `${timelines.length}개 저장됨`}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>
            HARU 비서가 생성한 문서형 기록입니다. 제목을 눌러 다시 열고 수정할 수 있습니다.
          </p>
        </div>
      </div>

      {!isLoading && timelines.length === 0 && (
        <div style={{ padding: '22px 12px', textAlign: 'center', color: '#9aa3ad', fontSize: 13, border: '1px dashed #e4e8ee', borderRadius: 12 }}>
          아직 저장된 HARU비서기록이 없습니다.
        </div>
      )}

      {timelines.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {timelines.map(timeline => {
            const periodStart = timeline.periodStart || timeline.items[0]?.takenDate || '';
            const periodEnd = timeline.periodEnd || timeline.items[timeline.items.length - 1]?.takenDate || '';
            const dateCheckCount = timeline.items.filter(item => item.metadataSource === 'manualRequired').length;
            const savedLabel = timestampLabel(timeline.finalizedAt) || timestampLabel(timeline.updatedAt) || timestampLabel(timeline.createdAt);
            const isDeleting = deletingId === timeline.id;
            const isEditing = editingId === timeline.id;
            const isSavingTitle = savingTitleId === timeline.id;
            return (
              <div
                key={timeline.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #e4e8ee',
                  borderRadius: 12,
                  backgroundColor: '#fff',
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                {isEditing ? (
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 6px 12px 14px',
                    }}
                  >
                    <input
                      value={editingTitle}
                      onChange={event => setEditingTitle(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') saveTitleEdit(timeline);
                        if (event.key === 'Escape') cancelTitleEdit();
                      }}
                      disabled={isSavingTitle}
                      autoFocus
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: '1px solid #d0dff0',
                        borderRadius: 8,
                        padding: '9px 10px',
                        color: '#1A3C6E',
                        fontSize: 14,
                        fontWeight: 800,
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveTitleEdit(timeline)}
                      disabled={isSavingTitle}
                      style={{
                        flexShrink: 0,
                        border: 'none',
                        borderRadius: 8,
                        backgroundColor: '#1A3C6E',
                        color: '#fff',
                        padding: '9px 10px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: isSavingTitle ? 'default' : 'pointer',
                      }}
                    >
                      {isSavingTitle ? '저장 중' : '저장'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelTitleEdit}
                      disabled={isSavingTitle}
                      style={{
                        flexShrink: 0,
                        border: '1px solid #e4e8ee',
                        borderRadius: 8,
                        backgroundColor: '#fff',
                        color: '#7a8696',
                        padding: '8px 10px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: isSavingTitle ? 'default' : 'pointer',
                      }}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedTimeline(timeline)}
                    disabled={isDeleting || !!savingTitleId}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: 'none',
                      background: 'transparent',
                      padding: '12px 6px 12px 14px',
                      textAlign: 'left',
                      cursor: isDeleting || savingTitleId ? 'default' : 'pointer',
                    }}
                  >
                    <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#4E6B2A', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#1A3C6E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {timeline.title}
                      </span>
                      <span style={{ fontSize: 12, color: '#7a8696', lineHeight: 1.4 }}>
                        {periodStart || '-'}{periodEnd && periodEnd !== periodStart ? ` ~ ${periodEnd}` : ''} · {timeline.itemCount || timeline.items.length}장{savedLabel ? ` · 최종 저장 ${savedLabel}` : ''}
                      </span>
                      {dateCheckCount > 0 && (
                        <span style={{
                          alignSelf: 'flex-start',
                          marginTop: 2,
                          borderRadius: 999,
                          backgroundColor: '#fff7dd',
                          color: '#9a6700',
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 800,
                        }}>
                          날짜 확인 필요 {dateCheckCount}장
                        </span>
                      )}
                    </span>
                    <span aria-hidden="true" style={{ flexShrink: 0, color: '#b9c2cc', fontSize: 18, lineHeight: 1 }}>›</span>
                  </button>
                )}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => startTitleEdit(timeline)}
                    disabled={isDeleting || !!savingTitleId}
                    aria-label="타임라인 제목 수정"
                    style={{
                      flexShrink: 0,
                      border: 'none',
                      borderLeft: '1px solid #eef1f5',
                      background: 'transparent',
                      color: '#1A3C6E',
                      padding: '12px 12px',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: isDeleting || savingTitleId ? 'default' : 'pointer',
                    }}
                  >
                    수정
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(timeline)}
                  disabled={isDeleting || isEditing || !!savingTitleId}
                  aria-label="타임라인 삭제"
                  style={{
                    flexShrink: 0,
                    border: 'none',
                    borderLeft: '1px solid #eef1f5',
                    background: 'transparent',
                    color: '#b94a48',
                    padding: '12px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: isDeleting ? 'default' : 'pointer',
                  }}
                >
                  {isDeleting ? '삭제 중' : '삭제'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedTimeline && (
        <GrowthTimelineDocumentModal
          isOpen={!!selectedTimeline}
          title={selectedTimeline.title}
          items={selectedTimeline.items}
          createdLabel={
            timestampLabel(selectedTimeline.finalizedAt)
            || timestampLabel(selectedTimeline.updatedAt)
            || timestampLabel(selectedTimeline.createdAt)
          }
          onClose={() => setSelectedTimeline(null)}
          onEdit={onEditTimeline ? () => {
            const target = selectedTimeline;
            setSelectedTimeline(null);
            if (target) onEditTimeline(target.id, target.periodStart || '');
          } : undefined}
        />
      )}
    </div>
  );
}
