import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { isInternalDeveloperUid } from './internalEntitlements';

if (!admin.apps.length) {
  admin.initializeApp();
}

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const db = admin.firestore();
// 현재 1차 운영값입니다. HARU 공식 최종 AI 정책 확정값이 아니며 한 곳에서 조정합니다.
const CURRENT_CLAIM_REASON_DAILY_LIMITS: Record<'free' | 'basic' | 'premium', number> = {
  free: 1,
  basic: 3,
  premium: 5,
};
const ALLOWED_CALLABLE_ORIGINS = [
  'https://haru2026-8abb8.web.app',
  'https://haru2026.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function sanitizeInput(raw: unknown, maxLength: number): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\n\r\t`{}$\\<>"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function getKstDateKey(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function getUserPlan(uid: string): Promise<'free' | 'basic' | 'premium'> {
  if (isInternalDeveloperUid(uid)) return 'premium';

  try {
    const snap = await db.doc(`users/${uid}/subscription/info`).get();
    const data = snap.data() || {};
    const plan = String(data.plan || '').toLowerCase();
    const endDate = data.endDate;
    const expiresAt = data.expiresAt;
    const endTime = typeof endDate === 'string'
      ? Date.parse(endDate)
      : typeof expiresAt?.toMillis === 'function'
        ? expiresAt.toMillis()
        : Number.NaN;

    if (Number.isFinite(endTime) && endTime < Date.now()) return 'free';
    if (plan === 'premium') return 'premium';
    if (plan === 'basic') return 'basic';
  } catch (error) {
    logger.warn('전자소송 청구원인 구독정보 조회 실패:', {
      uid,
      message: (error as any)?.message,
    });
  }

  return 'free';
}

async function enforceClaimReasonDailyLimit(uid: string): Promise<{
  plan: 'free' | 'basic' | 'premium';
  limit: number;
  usedAfter: number;
}> {
  const plan = await getUserPlan(uid);
  const limit = CURRENT_CLAIM_REASON_DAILY_LIMITS[plan] ?? CURRENT_CLAIM_REASON_DAILY_LIMITS.free;
  const usageRef = db.doc(`users/${uid}/lawsuitClaimReasonUsage/${getKstDateKey()}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const used = Number(snap.data()?.count || 0);

    if (!isInternalDeveloperUid(uid) && used >= limit) {
      throw new HttpsError(
        'resource-exhausted',
        `청구원인 AI 초안은 오늘 ${limit}회까지 사용할 수 있습니다.`,
      );
    }

    const usedAfter = used + 1;
    tx.set(usageRef, {
      count: admin.firestore.FieldValue.increment(1),
      plan,
      limit,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: snap.exists
        ? snap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { plan, limit, usedAfter };
  });
}

export const generateLawsuitClaimReason = onCall(
  {
    region: 'asia-northeast3',
    cors: ALLOWED_CALLABLE_ORIGINS,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const {
      caseType,
      caseName,
      suitAmount,
      plaintiffName,
      defendantName,
      claimPurpose,
    } = (request.data || {}) as {
      caseType?: string;
      caseName?: string;
      suitAmount?: string;
      plaintiffName?: string;
      defendantName?: string;
      claimPurpose?: string;
    };

    const safeCaseType = sanitizeInput(caseType, 20);
    if (safeCaseType !== '중고거래') {
      throw new HttpsError('invalid-argument', '현재는 중고거래 분쟁만 지원합니다.');
    }

    const safeCaseName = sanitizeInput(caseName, 80);
    const safeSuitAmount = sanitizeInput(suitAmount, 40);
    const safePlaintiffName = sanitizeInput(plaintiffName, 30);
    const safeDefendantName = sanitizeInput(defendantName, 30);
    const safeClaimPurpose = sanitizeInput(claimPurpose, 160);

    if (
      !safeCaseName &&
      !safeSuitAmount &&
      !safePlaintiffName &&
      !safeDefendantName &&
      !safeClaimPurpose
    ) {
      throw new HttpsError('invalid-argument', '청구원인 작성을 위한 사건 정보가 필요합니다.');
    }

    const quota = await enforceClaimReasonDailyLimit(request.auth.uid);

    const systemPrompt = `당신은 소송 '연습' 보조 도구입니다. 법률자문이 아닙니다.
사용자가 입력한 거래 경위 범위 안에서만 '청구원인'(소송을 하는 이유·거래 경위·분쟁 사정)을 자연스러운 문단으로 작성하세요.

[절대 준수]
- 확인되지 않은 사실·법조항·판례를 지어내지 마세요(환각 금지).
- 구체적 법조항 번호나 판례 인용 절대 금지.
- 사용자가 입력한 사실 외의 인물·금액·일자·장소 추가 금지.
- 단정적 법적효력 표현 금지.
- 마크다운 기호(**, ##, --, >) 사용 금지.
- 1인칭이 아닌 '원고/피고' 주체로 서술.`;

    const userPrompt = `[사건유형]
${safeCaseType}

[사건명]
${safeCaseName || '미입력'}

[소가]
${safeSuitAmount || '미입력'}

[원고]
${safePlaintiffName || '미입력'}

[피고]
${safeDefendantName || '미입력'}

[청구취지]
${safeClaimPurpose || '미입력'}

위 입력값에 드러난 사실만 사용하여 중고거래 분쟁의 청구원인을 작성하세요.
입력되지 않은 날짜, 장소, 거래 플랫폼, 연락 내용, 하자 내용, 배송 경위는 만들지 마세요.`;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userPrompt);
      const claimReasonText = result.response.text().trim();
      logger.info(
        `generateLawsuitClaimReason 완료: uid=${request.auth.uid}, plan=${quota.plan}, used=${quota.usedAfter}/${quota.limit}, len=${claimReasonText.length}`,
      );
      return {
        claimReasonText,
        quotaLimit: quota.limit,
        quotaRemaining: Math.max(quota.limit - quota.usedAfter, 0),
      };
    } catch (error: any) {
      logger.error('generateLawsuitClaimReason 실패:', error);
      throw new HttpsError('internal', '청구원인 AI 초안 작성에 실패했습니다.');
    }
  },
);
