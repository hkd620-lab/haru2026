/**
 * HARU2026 EPUB 내보내기 — Firebase Function
 * Firestore: users/{uid}/records/{date}
 * 요청: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', format?, recordIds?, filter? }
 *   recordIds 가 있으면 합본 화면·PDF에 보인 기록만 같은 순서로 담는다(SAYU 글 + 그 형식 사진, 서버에서 조건 재확인).
 * 응답: { success, downloadUrl, fileName, count, skippedPhotos }
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { hasInternalPremiumAccess } from './internalEntitlements';
import { buildFormatPrefixMap } from './formats/formatRegistry';
import Epub from 'epub-gen-memory';
import {
  checkPhotoUrl,
  escapeHtml,
  filterReachablePhotos,
  getRecordPhotoUrls,
  isEligibleMergeRecord,
  isMergeRecordFormat,
  mergeRecordToHtml,
  validateRecordIds,
} from './epubContent';

const db = admin.firestore();

const EPUB_INCLUDE_FORMATS = [
  '일기', '에세이', '선교보고', '일반보고', '업무일지',
  '여행기록', '독서사유', '텃밭일지', '애완동물관찰일지',
  '육아일기', '성장기록', 'HARU주식관리', '주식거래일지',
  '메모', '성장타임라인',
];

// 형식별 저장 필드 접두어(값은 Functions 형식 등록부, 내보내는 15개 형식, 순서 유지)
const FORMAT_PREFIX: Record<string, string> = buildFormatPrefixMap([
  '일기', '에세이', '선교보고', '일반보고', '업무일지', '여행기록', '독서사유', '텃밭일지',
  '애완동물관찰일지', '육아일기', '성장기록', 'HARU주식관리', '주식거래일지', '메모', '성장타임라인',
]);

function dateLabel(date: string): string {
  return date.replace(/-/g, '.');
}

// 본문 HTML(사진 제외). 사진은 내려받기 확인 뒤 호출하는 쪽에서 붙인다.
// bodyFormat 이 있으면 그 형식의 본문을, 없으면 기록의 첫 번째 포함 형식 본문을 쓴다.
function recordToHtml(record: Record<string, any>, bodyFormat?: string): string {
  const lines: string[] = [];

  // 날씨/기분
  if (record.weather) lines.push(`<p>날씨: ${record.weather}${record.temperature ? ` / ${record.temperature}` : ''}</p>`);
  if (record.mood) lines.push(`<p>기분: ${record.mood}</p>`);

  // 제목
  const title = record.title || record.ai_title;
  if (title) lines.push(`<h2>${escapeHtml(String(title))}</h2>`);

  // 본문
  const formats: string[] = Array.isArray(record.formats) ? record.formats : [];
  const includedFormats = formats.filter((f) => EPUB_INCLUDE_FORMATS.includes(f));
  const firstFormat = bodyFormat && includedFormats.includes(bodyFormat) ? bodyFormat : (includedFormats[0] ?? null);
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
      lines.push(`<div>${escapeHtml(String(bodyText)).replace(/\n/g, '<br/>')}</div>`);
      bodyAdded = true;
    }
    if (!bodyAdded) {
      // 블랙리스트 제외 prefix_ 필드 조합
      const SUFFIX_BLACKLIST = new Set([
        '_sayu', '_simple', '_content', '_mode', '_style',
        '_polishedAt', '_final_sayu', '_imageMeta', '_images',
      ]);
      const bodyParts: string[] = [];
      for (const [key, val] of Object.entries(record)) {
        if (!key.startsWith(prefix + '_') || typeof val !== 'string' || val === '') continue;
        if (SUFFIX_BLACKLIST.has(key.slice(prefix.length))) continue;
        bodyParts.push(`${key.slice(prefix.length + 1)}: ${val}`);
      }
      if (bodyParts.length > 0) {
        lines.push(`<div>${bodyParts.map(escapeHtml).join('<br/>')}</div>`);
        bodyAdded = true;
      }
    }
  }

  if (!bodyAdded) {
    lines.push('<p>(내용 없음)</p>');
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

    const { startDate, endDate, format, filter } = request.data as { startDate: string; endDate: string; format?: string; filter?: string };
    if (!startDate || !endDate || startDate > endDate) {
      throw new HttpsError('invalid-argument', '날짜 범위가 올바르지 않습니다.');
    }
    const recordIds = validateRecordIds((request.data as { recordIds?: unknown }).recordIds);
    if (recordIds !== null && (recordIds.length === 0 || !isMergeRecordFormat(format))) {
      throw new HttpsError('invalid-argument', '합본 기록 목록이 올바르지 않습니다.');
    }

    const chapters: { title: string; content: string; photos: string[] }[] = [];

    if (recordIds) {
      // 합본: 화면·PDF에 보인 기록만 같은 순서로. 본인 기록 경로에서만 읽고 조건을 다시 확인한다.
      const prefix = FORMAT_PREFIX[format as string];
      const refs = recordIds.map((id) => db.doc(`users/${uid}/records/${id}`));
      const snaps = [];
      for (let i = 0; i < refs.length; i += 100) snaps.push(...await db.getAll(...refs.slice(i, i + 100)));
      for (const snap of snaps) {
        if (!snap.exists) continue;
        const record: Record<string, any> = { id: snap.id, ...snap.data() };
        if (!isEligibleMergeRecord(record, prefix, { startDate, endDate, filter })) continue;
        chapters.push({
          title: dateLabel(String(record.date).slice(0, 10)),
          content: mergeRecordToHtml(record, prefix, []),
          photos: getRecordPhotoUrls(record, prefix),
        });
      }
      if (chapters.length === 0) {
        throw new HttpsError('not-found', '조건에 맞는 SAYU 완료 기록이 없습니다.');
      }
      return buildAndSave(uid, startDate, endDate, format, chapters);
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

    snapshot.forEach((docSnap) => {
      const record: Record<string, any> = { id: docSnap.id, ...docSnap.data() };
      const formats: string[] = Array.isArray(record.formats) ? record.formats : [];
      const includedFormats = formats.filter((f) => EPUB_INCLUDE_FORMATS.includes(f));
      if (includedFormats.length === 0) return;
      if (format && !includedFormats.includes(format)) return;
      const title = `${dateLabel(record.date)} [${includedFormats.join(' · ')}]`;
      const content = recordToHtml(record, format);
      // 사진: 요청 형식이 있으면 그 형식의 사진만, 없으면 포함된 형식마다(형식당 최대 5장, 같은 사진은 한 번)
      const photoFormats = format ? [format] : includedFormats;
      const photos = Array.from(new Set(photoFormats.flatMap((f) => (FORMAT_PREFIX[f] ? getRecordPhotoUrls(record, FORMAT_PREFIX[f]) : []))));
      chapters.push({ title, content, photos });
    });

    if (chapters.length === 0) {
      throw new HttpsError('not-found', '내보낼 기록 형식이 없습니다.');
    }

    return buildAndSave(uid, startDate, endDate, format, chapters);
  },
);

async function buildAndSave(
  uid: string,
  startDate: string,
  endDate: string,
  format: string | undefined,
  rawChapters: { title: string; content: string; photos: string[] }[],
) {
  const { urlsByChapter, skipped } = await filterReachablePhotos(rawChapters.map((chapter) => chapter.photos), checkPhotoUrl);
  const chapters = rawChapters.map((chapter, index) => ({
    title: chapter.title,
    content: [chapter.content, ...urlsByChapter[index].map((url) => `<img src="${escapeHtml(url)}" style="max-width:100%;margin:8px 0;">`)].join('\n'),
  }));

  const epubOptions = {
    title: format
      ? `HARU ${format} ${dateLabel(startDate)} ~ ${dateLabel(endDate)}`
      : `HARU 기록 ${dateLabel(startDate)} ~ ${dateLabel(endDate)}`,
    author: 'HARU2026',
    lang: 'ko',
    css: 'body,html{column-count:1!important;columns:1!important;column-width:auto!important;}*{column-count:unset!important;}',
    // 미리 확인한 뒤에도 내려받기가 실패하면 그 사진만 빼고 계속 만든다.
    ignoreFailedDownloads: true,
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
    skippedPhotos: skipped,
  };
}
