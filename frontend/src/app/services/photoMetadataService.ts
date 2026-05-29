import * as exifr from 'exifr';

export type UploadedImageMeta = {
  url: string;
  originalName: string;
  takenAt?: string;
  takenDate?: string;
  takenTime?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  metadataSource: 'exif' | 'none';
  uploadedAt: string;
};

function toLocalDateTimeParts(value: Date | string | number | undefined) {
  if (!value) return {};
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return {};
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return {
    takenAt: date.toISOString(),
    takenDate: `${yyyy}-${mm}-${dd}`,
    takenTime: `${hh}:${mi}:${ss}`,
  };
}

function formatGpsLabel(latitude?: number, longitude?: number) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return '';
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export async function readOriginalImageMeta(file: File): Promise<Omit<UploadedImageMeta, 'url' | 'uploadedAt'>> {
  try {
    const meta = await exifr.parse(file, {
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true,
      xmp: true,
      iptc: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
    } as any);

    const dateValue = meta?.DateTimeOriginal || meta?.CreateDate || meta?.ModifyDate || meta?.DateCreated;
    const parts = toLocalDateTimeParts(dateValue);
    const latitude = typeof meta?.latitude === 'number' ? meta.latitude : undefined;
    const longitude = typeof meta?.longitude === 'number' ? meta.longitude : undefined;
    const locationName = [
      meta?.City,
      meta?.State,
      meta?.Country,
      meta?.Location,
      meta?.SubLocation,
      meta?.ContentLocationName,
    ].filter((v: any) => typeof v === 'string' && v.trim()).join(' ').trim();
    const gpsLabel = formatGpsLabel(latitude, longitude);

    return {
      originalName: file.name,
      ...parts,
      latitude,
      longitude,
      locationLabel: locationName || gpsLabel || undefined,
      metadataSource: parts.takenDate || gpsLabel ? 'exif' : 'none',
    };
  } catch (error) {
    console.warn('사진 EXIF 읽기 실패:', error);
    return {
      originalName: file.name,
      metadataSource: 'none',
    };
  }
}
