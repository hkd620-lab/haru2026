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
  if (record.weather) lines.push(`<p>날씨: ${record.weather}${record.temperature ? ` / ${record.temperature}` : ''}</p>`);
  if (record.mood) lines.push(`<p>기분: ${record.mood}</p>`);
  if (record.content) lines.push(`<div>${String(record.content).replace(/\n/g, '<br/>')}</div>`);
  const skip = new Set(['id', 'date', 'weather', 'temperature', 'mood', 'content', 'formats', 'createdAt', 'updatedAt']);
  for (const [key, val] of Object.entries(record)) {
    if (skip.has(key) || val == null || val === '') continue;
    lines.push(`<p><strong>${key}:</strong> ${String(val)}</p>`);
  }
  return lines.join('\n') || '<p>(내용 없음)</p>';
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
