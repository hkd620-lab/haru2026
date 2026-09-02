/**
 * HARU2026 EPUB 내보내기 — Firebase Function
 * Firestore: users/{uid}/records/{date}
 * 요청: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 * 응답: { success, base64, fileName, count }
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { hasInternalPremiumAccess } from './internalEntitlements';
import Epub from 'epub-gen-memory';

const db = admin.firestore();

const EPUB_INCLUDE_FORMATS = [
  '일기', '에세이', '선교보고', '일반보고', '업무일지',
  '여행기록', '독서사유', '텃밭일지', '애완동물관찰일지',
  '육아일기', '성장기록', 'HARU주식관리', '주식거래일지',
  '메모', '성장타임라인',
];

const FORMAT_PREFIX: Record<string, string> = {
  '일기': 'diary',
  '에세이': 'essay',
  '선교보고': 'mission',
  '일반보고': 'report',
  '업무일지': 'work',
  '여행기록': 'travel',
  '독서사유': 'reading',
  '텃밭일지': 'garden',
  '애완동물관찰일지': 'pet',
  '육아일기': 'child',
  '성장기록': 'growth',
  'HARU주식관리': 'stock',
  '주식거래일지': 'stock',
  '메모': 'memo',
  '성장타임라인': 'growthTimeline',
};

function dateLabel(date: string): string {
  return date.replace(/-/g, '.');
}

function recordToHtml(record: Record<string, any>): string {
  const lines: string[] = [];

  // 날씨/기분
  if (record.weather) lines.push(`<p>날씨: ${record.weather}${record.temperature ? ` / ${record.temperature}` : ''}</p>`);
  if (record.mood) lines.push(`<p>기분: ${record.mood}</p>`);

  // 제목
  const title = record.title || record.ai_title;
  if (title) lines.push(`<h2>${String(title)}</h2>`);

  // 본문
  const formats: string[] = Array.isArray(record.formats) ? record.formats : [];
  const includedFormats = formats.filter((f) => EPUB_INCLUDE_FORMATS.includes(f));
  const firstFormat = includedFormats[0] ?? null;
  const prefix = firstFormat ? (FORMAT_PREFIX[firstFormat] ?? null) : null;
  let bodyAdded = false;

  if (record.recordType === 'growthTimeline') {
    // 성장타임라인: content 필드(buildTimelineSummary 결과) + timelineItems 사진
    if (record.content) {
      lines.push(`<div>${String(record.content).replace(/\n/g, '<br/>')}</div>`);
      bodyAdded = true;
    }
    const items = Array.isArray(record.timelineItems) ? record.timelineItems : [];
    for (const item of items) {
      if (item?.url) {
        const cap = [item.takenDate, item.locationLabel, item.memo].filter(Boolean).join(' · ');
        lines.push(`<img src="${item.url}" style="max-width:100%;margin:8px 0;">`);
        if (cap) lines.push(`<p style="font-size:0.85em;color:#666;">${cap}</p>`);
        bodyAdded = true;
      }
    }
  } else if (firstFormat === '성장기록') {
    // 성장기록 전용: growth_sayu → growth_note 본문 + child_* 측정값
    const growthBody = record.growth_sayu ?? record.growth_note ?? null;
    if (growthBody) {
      lines.push(`<div>${String(growthBody).replace(/\n/g, '<br/>')}</div>`);
      bodyAdded = true;
    }
    const measurements: string[] = [];
    if (record.child_measuredate) measurements.push(`측정일: ${record.child_measuredate}`);
    if (record.child_height) measurements.push(`키: ${record.child_height}`);
    if (record.child_weight) measurements.push(`몸무게: ${record.child_weight}`);
    if (record.child_headcircum) measurements.push(`머리둘레: ${record.child_headcircum}`);
    if (measurements.length > 0) {
      lines.push(`<p>${measurements.join('<br/>')}</p>`);
      bodyAdded = true;
    }
  } else if (prefix) {
    // 일반 포맷 — prefix_sayu → prefix_simple → prefix_content 우선
    const bodyText = record[`${prefix}_sayu`] ?? record[`${prefix}_simple`] ?? record[`${prefix}_content`] ?? null;
    if (bodyText) {
      lines.push(`<div>${String(bodyText).replace(/\n/g, '<br/>')}</div>`);
      bodyAdded = true;
    }
    if (!bodyAdded) {
      // 블랙리스트 제외 prefix_ 필드 조합
      const SUFFIX_BLACKLIST = new Set([
        '_sayu', '_simple', '_content', '_mode', '_style',
        '_polishedAt', '_final_sayu', '_imageMeta',
      ]);
      const bodyParts: string[] = [];
      for (const [key, val] of Object.entries(record)) {
        if (!key.startsWith(prefix + '_') || typeof val !== 'string' || val === '') continue;
        if (SUFFIX_BLACKLIST.has(key.slice(prefix.length))) continue;
        bodyParts.push(`${key.slice(prefix.length + 1)}: ${val}`);
      }
      if (bodyParts.length > 0) {
        lines.push(`<div>${bodyParts.join('<br/>')}</div>`);
        bodyAdded = true;
      }
    }
  }

  if (!bodyAdded) {
    lines.push('<p>(내용 없음)</p>');
  }

  // 이미지 — record.images 배열 우선, 없으면 imageMeta 필드
  if (Array.isArray(record.images) && record.images.length > 0) {
    for (const url of record.images) {
      if (typeof url === 'string' && url) lines.push(`<img src="${url}" style="max-width:100%;margin:8px 0;">`);
    }
  } else {
    for (const [key, val] of Object.entries(record)) {
      if (!key.endsWith('imageMeta')) continue;
      let items: any[] = [];
      if (Array.isArray(val)) {
        items = val;
      } else if (typeof val === 'string') {
        try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) items = parsed; } catch { /* 무시 */ }
      }
      for (const item of items) {
        if (item?.url) lines.push(`<img src="${item.url}" style="max-width:100%;margin:8px 0;">`);
      }
    }
  }

  return lines.join('\n');
}

// 유료(베이직·프리미엄) 구독자만 통과. index.ts의 getUserPlan과 동일한 판별 기준
// (plan 값 + endDate/expiresAt 만료 확인)을 이 파일 안에서 독립적으로 적용한다 —
// index.ts를 import하면 순환 참조가 생기므로 subscriptionHelpers.ts처럼 분리해 둔다.
async function requirePaidSubscription(uid: string): Promise<void> {
  if (hasInternalPremiumAccess(uid)) return;
  const snap = await db.doc(`users/${uid}/subscription/info`).get();
  const data = snap.data() || {};
  const plan = String(data.plan || '').toLowerCase();
  const endDate = data.endDate;
  const expiresAt = (data as { expiresAt?: { toMillis?: () => number } }).expiresAt;
  const endTime = typeof endDate === 'string'
    ? Date.parse(endDate)
    : typeof expiresAt?.toMillis === 'function'
      ? expiresAt.toMillis()
      : Number.NaN;
  const expired = Number.isFinite(endTime) && endTime < Date.now();
  if (expired || (plan !== 'basic' && plan !== 'premium')) {
    throw new HttpsError('permission-denied', '베이직 또는 프리미엄 구독 후 이용할 수 있습니다.');
  }
}

export const exportEpub = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await requirePaidSubscription(uid);

    const { startDate, endDate, format } = request.data as { startDate: string; endDate: string; format?: string };
    if (!startDate || !endDate || startDate > endDate) {
      throw new HttpsError('invalid-argument', '날짜 범위가 올바르지 않습니다.');
    }

    const recordsRef = db.collection(`users/${uid}/records`);
    const snapshot = await recordsRef
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .get();

    if (snapshot.empty) {
      throw new HttpsError('not-found', '선택한 기간에 기록이 없습니다.');
    }

    const chapters: { title: string; content: string }[] = [];
    snapshot.forEach((docSnap) => {
      const record: Record<string, any> = { id: docSnap.id, ...docSnap.data() };
      const formats: string[] = Array.isArray(record.formats) ? record.formats : [];
      const includedFormats = formats.filter((f) => EPUB_INCLUDE_FORMATS.includes(f));
      if (includedFormats.length === 0) return;
      if (format && !includedFormats.includes(format)) return;
      const title = `${dateLabel(record.date)} [${includedFormats.join(' · ')}]`;
      const content = recordToHtml(record);
      chapters.push({ title, content });
    });

    if (chapters.length === 0) {
      throw new HttpsError('not-found', '내보낼 기록 형식이 없습니다.');
    }

    const epubOptions = {
      title: format
        ? `HARU ${format} ${dateLabel(startDate)} ~ ${dateLabel(endDate)}`
        : `HARU 기록 ${dateLabel(startDate)} ~ ${dateLabel(endDate)}`,
      author: 'HARU2026',
      lang: 'ko',
      css: 'body,html{column-count:1!important;columns:1!important;column-width:auto!important;}*{column-count:unset!important;}',
    };

    const epubBuffer = await Epub(epubOptions, chapters);
    const fileName = format
      ? `HARU_${format}_${startDate}_${endDate}.epub`
      : `HARU_기록_${startDate}_${endDate}.epub`;

    const bucket = admin.storage().bucket();
    const filePath = `epub/${uid}/${fileName}`;
    const fileRef = bucket.file(filePath);
    await fileRef.save(epubBuffer, { contentType: 'application/epub+zip' });
    const [downloadUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 60 * 1000, // 10분
    });

    return {
      success: true,
      downloadUrl,
      fileName,
      count: chapters.length,
    };
  },
);
