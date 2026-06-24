/**
 * HARU2026 EPUB 내보내기 — Firebase Function
 * Firestore: users/{uid}/records/{date}
 * 요청: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 * 응답: { success, base64, fileName, count }
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Epub from 'epub-gen-memory';

const db = admin.firestore();

const EPUB_INCLUDE_FORMATS = [
  '일기', '에세이', '선교보고', '일반보고', '업무일지',
  '여행기록', '독서사유', '텃밭일지', '애완동물관찰일지',
  '육아일기', '성장기록', 'HARU주식관리', '주식거래일지',
  '메모', '성장타임라인',
];

function dateLabel(date: string): string {
  return date.replace(/-/g, '.');
}

function recordToHtml(record: Record<string, any>): string {
  const lines: string[] = [];
  // 날씨
  if (record.weather) lines.push(`<p>날씨: ${record.weather}${record.temperature ? ` / ${record.temperature}` : ''}</p>`);
  // 기분
  if (record.mood) lines.push(`<p>기분: ${record.mood}</p>`);
  // 제목
  const title = record.title || record.ai_title;
  if (title) lines.push(`<h2>${String(title)}</h2>`);
  // 본문 (우선순위: sayu → simple → content)
  const body = record.sayu ?? record.simple ?? record.content;
  if (body != null && body !== '') {
    lines.push(`<div>${String(body).replace(/\n/g, '<br/>')}</div>`);
  } else {
    lines.push('<p>(내용 없음)</p>');
  }
  // 이미지 (키 이름이 'imageMeta'로 끝나는 배열 필드)
  for (const [key, val] of Object.entries(record)) {
    if (!key.endsWith('imageMeta') || !Array.isArray(val)) continue;
    for (const item of val) {
      if (item?.url) {
        lines.push(`<img src="${item.url}" style="max-width:100%;margin:8px 0;">`);
      }
    }
  }
  return lines.join('\n');
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

    const { startDate, endDate } = request.data as { startDate: string; endDate: string };
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
      const title = `${dateLabel(record.date)} [${includedFormats.join(' · ')}]`;
      const content = recordToHtml(record);
      chapters.push({ title, content });
    });

    if (chapters.length === 0) {
      throw new HttpsError('not-found', '내보낼 기록 형식이 없습니다.');
    }

    const epubOptions = {
      title: `HARU 기록 ${dateLabel(startDate)} ~ ${dateLabel(endDate)}`,
      author: 'HARU2026',
      lang: 'ko',
    };

    const epubBuffer = await Epub(epubOptions, chapters);
    const base64 = epubBuffer.toString('base64');

    return {
      success: true,
      base64,
      fileName: `HARU_기록_${startDate}_${endDate}.epub`,
      count: chapters.length,
    };
  },
);
