import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import {
  reserveMonthlyAiQuota,
  rollbackMonthlyAiQuotaReservation,
  type MonthlyAiQuotaReservation,
} from './utils/monthlyAiQuota';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// 사용자 입력 이름의 prompt injection / 위험 문자 차단 (HARU예언과 동일 정책)
function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\n\r\t`{}$\\<>"]/g, '')
    .replace(/[^\p{L}\p{N} \-_.]/gu, '')
    .trim()
    .slice(0, 20);
}

function timestampToMillis(value: unknown): number {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function dateKeyFromTimestamp(value: unknown): string {
  const ms = timestampToMillis(value);
  if (!ms) return '날짜 미상';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function parseDateStart(date: string): number {
  const ms = Date.parse(`${date}T00:00:00+09:00`);
  return Number.isFinite(ms) ? ms : 0;
}

function parseDateEnd(date: string): number {
  const ms = Date.parse(`${date}T23:59:59+09:00`);
  return Number.isFinite(ms) ? ms : 0;
}

function resolveSnsStoryRange(data: any): { fromMs: number; toMs: number; label: string } {
  const range = data?.range === 'year' || data?.range === 'custom' ? data.range : 'all';
  if (range === 'year') {
    const year = String(data?.year || '').trim();
    if (!/^\d{4}$/.test(year)) {
      throw new HttpsError('invalid-argument', '연도는 4자리로 입력해주세요.');
    }
    return {
      fromMs: parseDateStart(`${year}-01-01`),
      toMs: parseDateEnd(`${year}-12-31`),
      label: `${year}년`,
    };
  }

  if (range === 'custom') {
    const from = String(data?.from || '').trim();
    const to = String(data?.to || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new HttpsError('invalid-argument', '시작일과 종료일이 필요합니다.');
    }
    const fromMs = parseDateStart(from);
    const toMs = parseDateEnd(to);
    if (!fromMs || !toMs || fromMs > toMs) {
      throw new HttpsError('invalid-argument', '기간 설정을 확인해주세요.');
    }
    return { fromMs, toMs, label: `${from} ~ ${to}` };
  }

  return { fromMs: 0, toMs: Number.MAX_SAFE_INTEGER, label: '전체 기간' };
}

function pickEvenly<T>(items: T[], maxCount: number): T[] {
  if (items.length <= maxCount) return items;
  if (maxCount <= 1) return items.slice(0, 1);
  const picked: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < maxCount; i++) {
    const index = Math.round((i * (items.length - 1)) / (maxCount - 1));
    if (seen.has(index)) continue;
    seen.add(index);
    picked.push(items[index]);
  }
  return picked;
}

function buildSnsStoryPostsBlock(records: Array<{ source: string; timestamp: number; text: string }>): string {
  const lines: string[] = [];
  let remaining = 26000;
  for (const record of records) {
    if (remaining <= 0) break;
    const sourceLabel = record.source === 'instagram' ? 'Instagram' : 'Facebook';
    const cleaned = record.text
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 900);
    if (!cleaned) continue;
    const line = `[${dateKeyFromTimestamp(record.timestamp)} · ${sourceLabel}]\n${cleaned}`;
    remaining -= line.length;
    lines.push(line);
  }
  return lines.join('\n\n---\n\n');
}

export const convertSnsToDiary = onCall(
  {
    region: 'asia-northeast3',
    memory: '512MiB',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { text, source, timestamp } = (request.data || {}) as {
      text?: string;
      source?: string;
      timestamp?: number;
    };

    if (!text || typeof text !== 'string') {
      throw new HttpsError('invalid-argument', '게시물 텍스트가 필요합니다.');
    }
    if (text.length > 5000) {
      throw new HttpsError('invalid-argument', '텍스트는 5000자 이내여야 합니다.');
    }

    let monthlyQuotaReservation: MonthlyAiQuotaReservation | null = null;
    monthlyQuotaReservation = await reserveMonthlyAiQuota(request.auth.uid, 'convertSnsToDiary');

    const sourceLabel = source === 'instagram' ? 'Instagram' : 'Facebook';
    const dateHint = timestamp
      ? new Date((timestamp || 0) * (timestamp < 1e12 ? 1000 : 1)).toLocaleDateString('ko-KR')
      : '날짜 미상';

    // users/{uid}/settings/profile에서 본명/닉네임 자동 조회 (UI 추가 없이 자동 적용)
    let realName = '';
    let nickname = '';
    try {
      const profileSnap = await admin.firestore()
        .doc(`users/${request.auth.uid}/settings/profile`)
        .get();
      if (profileSnap.exists) {
        const d = profileSnap.data() || {};
        realName = sanitizeName(d.realName);
        nickname = sanitizeName(d.nickname);
      }
    } catch (e) {
      logger.warn('convertSnsToDiary: profile 조회 실패, 이름 정보 없이 진행', e);
    }
    const userDisplayName = realName || nickname || '';

    const characterRule = `[등장인물 이름 — 절대 준수]
- 1인칭 시점("나", "저")은 그대로 유지합니다. 일기의 본질입니다.
- 게시물 원문에 등장하지 않는 인물 이름을 AI가 임의로 만들지 않습니다. 가짜 이름(예: "민수", "철수", "수진")을 추가하지 마세요.
- 게시물에 "친구", "동료", "아내", "딸" 등 관계만 적혀 있다면 그대로 사용합니다.${userDisplayName ? `\n- 글쓴이의 이름은 "${userDisplayName}"입니다. 필요할 때만 자연스럽게 사용하고 보통은 1인칭("나")으로 둡니다.` : ''}`;

    const systemPrompt = `당신은 따뜻한 일기 작가입니다.
${sourceLabel}에 올렸던 짧은 게시물을 그날의 일기 형식으로 자연스럽게 풀어쓰세요.
규칙:
- 1인칭 시점, 존댓말 유지
- 새로운 사건이나 거짓 추가 절대 금지
- 마크다운 기호(**, ##, __, --, >) 사용 금지
- 소제목 없이 자연스러운 문단으로
- 너무 짧으면 게시물 맥락만 살려 2~3문장 정도로
- 너무 길면 핵심만 추려 5~7문장 정도로

${characterRule}`;

    const userPrompt = `[작성일: ${dateHint}]
[원본 ${sourceLabel} 게시물]
${text}

위 게시물을 바탕으로 그날의 일기를 작성해주세요.
※ 원문에 없는 인물 이름은 절대 임의로 만들지 마세요. 1인칭 "나"는 그대로 유지하고, 다른 등장인물은 원문에 적힌 이름·관계 그대로만 사용합니다.`;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userPrompt);
      const diaryText = result.response.text().trim();
      logger.info(`convertSnsToDiary 완료: uid=${request.auth.uid}, len=${diaryText.length}`);
      return { diaryText };
    } catch (error: any) {
      await rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation);
      if (error instanceof HttpsError) throw error;
      logger.error('convertSnsToDiary 실패:', error);
      throw new HttpsError('internal', 'AI 변환에 실패했습니다.');
    }
  }
);

export const generateSnsIntegratedStory = onCall(
  {
    region: 'asia-northeast3',
    memory: '512MiB',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 180,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    const range = resolveSnsStoryRange(request.data || {});
    const snap = await admin.firestore()
      .collection('users')
      .doc(uid)
      .collection('snsRecords')
      .orderBy('timestamp', 'asc')
      .get();

    const allRecords = snap.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          source: String(data.source || 'facebook'),
          timestamp: Number(data.timestamp || 0),
          text: typeof data.text === 'string' ? data.text.trim() : '',
          isDeleted: data.isDeleted === true,
        };
      })
      .filter((record) => {
        if (record.isDeleted) return false;
        if (!record.text) return false;
        const ms = timestampToMillis(record.timestamp);
        return ms >= range.fromMs && ms <= range.toMs;
      });

    if (allRecords.length === 0) {
      throw new HttpsError('failed-precondition', '선택한 기간에 생성할 SNS 기록이 없습니다.');
    }

    const selectedRecords = pickEvenly(allRecords, 80);
    const postsBlock = buildSnsStoryPostsBlock(selectedRecords);
    if (!postsBlock) {
      throw new HttpsError('failed-precondition', '이야기로 만들 수 있는 텍스트 기록이 없습니다.');
    }

    let monthlyQuotaReservation: MonthlyAiQuotaReservation | null = null;
    monthlyQuotaReservation = await reserveMonthlyAiQuota(uid, 'generateSnsIntegratedStory');

    let realName = '';
    let nickname = '';
    try {
      const profileSnap = await admin.firestore()
        .doc(`users/${uid}/settings/profile`)
        .get();
      if (profileSnap.exists) {
        const profile = profileSnap.data() || {};
        realName = sanitizeName(profile.realName);
        nickname = sanitizeName(profile.nickname);
      }
    } catch (e) {
      logger.warn('generateSnsIntegratedStory: profile 조회 실패, 이름 정보 없이 진행', e);
    }
    const userDisplayName = realName || nickname || '나';

    const systemPrompt = `당신은 개인 기록을 다루는 자서전 편집자입니다.
SNS 게시물을 바탕으로 사용자의 삶의 흐름을 따뜻하고 품위 있는 "나의 이야기" 시놉시스로 엮습니다.

절대 규칙:
- 제공된 게시물에 있는 사건, 감정, 관계만 근거로 작성합니다.
- 없는 인물 이름, 직업, 지역, 성취, 가족관계, 날짜를 만들지 않습니다.
- 삭제되었거나 휴지통에 있는 기록은 입력에 포함되지 않았으므로 언급하지 않습니다.
- 마크다운 제목 기호, 목록 기호, 과장된 홍보 문구를 쓰지 않습니다.
- 한국어로 작성합니다.`;

    const userPrompt = `[사용자 표시 이름]
${userDisplayName}

[기간]
${range.label}

[입력 기록 수]
전체 후보 ${allRecords.length}개 중 대표 기록 ${selectedRecords.length}개

[SNS 게시물]
${postsBlock}

위 게시물들을 시간 흐름에 따라 읽고, 다음 구조의 "나의 이야기 시놉시스"를 작성해주세요.
1. 짧은 제목 한 줄
2. 이 기간의 삶을 설명하는 도입 문단
3. 중요한 변화와 반복되는 마음을 4~7문단으로 정리
4. 마지막 문단은 앞으로의 삶을 조용히 응원하는 문장으로 마무리

분량은 1200~2200자 정도로 작성해주세요.`;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userPrompt);
      const text = result.response.text().trim();
      if (!text) {
        throw new HttpsError('internal', 'SNS 통합 나의 이야기 생성 결과가 비어있습니다.');
      }
      logger.info('generateSnsIntegratedStory 완료', {
        sourceCount: allRecords.length,
        selectedCount: selectedRecords.length,
      });
      return {
        text,
        sourceCount: allRecords.length,
        selectedCount: selectedRecords.length,
        rangeLabel: range.label,
      };
    } catch (error: any) {
      await rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation);
      if (error instanceof HttpsError) throw error;
      logger.error('generateSnsIntegratedStory 실패:', error);
      throw new HttpsError('internal', 'SNS 통합 나의 이야기 생성에 실패했습니다.');
    }
  }
);
