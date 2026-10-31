// 하루LAW Functions — 법령 검색(lawSearch)·AI 분석(lawEasyExplain)·판례(lawPrecedent)·공유 카드 5개.
// index.ts 에 있던 정의를 그대로 옮겼다(동작 같음). index.ts 가 이 파일의 함수를 다시 내보낸다.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import axios from 'axios';
import * as crypto from 'crypto';
import { logAiUsage } from '../aiUsageLogger';
import { enforceRateLimit } from '../utils/rateLimit';
import { LAW_EASY_EXPLAIN_PROMPT_VERSION, LawEasyExplainInputError, buildLawConsultCacheKey, resolveLawEasyExplanation, sha256Hex, validateLawEasyExplainInput } from '../lawEasyExplainCore';
import { classifyHaruLawAiError, HaruLawApiTemporaryError, runHaruLawApiRequestWithRetry, type HaruLawApiFailureDiagnostics, type HaruLawErrorReason, type HaruLawProcessingStage } from '../haruLawErrorCore';
import { GoogleGenAI } from '@google/genai';
import { INTERNAL_DEVELOPER_UIDS } from '../internalEntitlements';
import { getGeminiUsage } from '../ai/aiGateway';
import {
  HARULAW_CALLABLE_TIMEOUT_MS,
  HARULAW_GEMINI_FILE_TIMEOUT_MS,
  HARULAW_GEMINI_FINALIZATION_RESERVE_MS,
  type HaruLawGeminiFilePart,
  type PreparedHaruLawAttachments,
  type TrackedHaruLawGeminiFile,
  createHaruLawHttpsError,
  deleteTrackedHaruLawGeminiFiles,
  getHaruLawRemainingWorkMs,
  prepareHaruLawAttachments,
  readHaruLawAttachments,
  removePreparedHaruLawAttachments,
  runHaruLawModelBeforeDeadline,
  uploadPreparedHaruLawAttachments,
} from './haruLawAttachments';
import { AI_USAGE_PLAN, coerceUserPlan, createAiUsageRequestId, getAiUsageErrorCode, getUserPlan } from '../sharedHelpers';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const GEMINI_API_KEY_SECRET = defineSecret('GEMINI_API_KEY');
const DEVELOPER_UIDS = INTERNAL_DEVELOPER_UIDS;

const LAW_API_KEY_SECRET = defineSecret('LAW_API_KEY');

const HARU_LAW_SHARE_DISCLAIMER = '본 내용은 법령 정보 제공 목적이며, 전문적인 법률·세무 자문을 대체하지 않습니다.\n구체적인 사건은 관련 자료를 가지고 전문가 상담을 받으시기 바랍니다.';
const HARU_LAW_SHARE_PREVIEW_TTL_MS = 30 * 60 * 1000;
const HARU_LAW_SHARE_DAILY_PREVIEW_LIMIT = 3;

type HaruLawSharePreview = {
  title: string;
  anonymizedQuestion: string;
  summary: string;
  judgmentType: 'possible' | 'caution' | 'need_check';
  relatedStatutes: {
    title: string;
    article?: string;
    easySummary: string;
  }[];
  disclaimer: string;
};

function isDeveloperUid(uid: string): boolean {
  return DEVELOPER_UIDS.has(uid);
}

function getKstDateKey(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function enforceHaruLawSharePreviewLimit(uid: string): Promise<void> {
  if (isDeveloperUid(uid)) return;

  const usageRef = db.doc(`users/${uid}/haruLawShareUsage/${getKstDateKey()}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const used = Number(snap.data()?.previewCount || 0);
    if (used >= HARU_LAW_SHARE_DAILY_PREVIEW_LIMIT) {
      throw new HttpsError('resource-exhausted', '하루LAW 익명 공유 미리보기는 하루 3회까지 만들 수 있습니다.');
    }

    tx.set(usageRef, {
      previewCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: snap.exists ? snap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function getOwnedHaruLawRecord(uid: string, sourceRecordId: unknown) {
  if (typeof sourceRecordId !== 'string' || !sourceRecordId.trim()) {
    throw new HttpsError('invalid-argument', 'sourceRecordId가 필요합니다.');
  }

  const recordRef = db.collection('users').doc(uid).collection('records').doc(sourceRecordId.trim());
  const recordSnap = await recordRef.get();
  if (!recordSnap.exists) {
    throw new HttpsError('not-found', '원본 하루LAW 기록을 찾을 수 없습니다.');
  }

  const record = recordSnap.data() || {};
  const formats = Array.isArray(record.formats) ? record.formats : [];
  const isHaruRaw = formats.includes('HARUraw')
    || typeof record.haruraw_query === 'string'
    || typeof record.haruraw_summary === 'string';

  if (!isHaruRaw) {
    throw new HttpsError('failed-precondition', '하루LAW 기록만 익명 공유를 신청할 수 있습니다.');
  }

  return { recordRef, recordSnap, record };
}

function removeHaruLawSensitiveInfo(input: unknown): string {
  return String(input || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[이메일 제거]')
    .replace(/\b\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, '[전화번호 제거]')
    .replace(/\b\d{6}[-\s]?[1-4]\d{6}\b/g, '[주민등록번호 제거]')
    .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{5}\b/g, '[사업자등록번호 제거]')
    .replace(/\b\d{2,6}[-\s]\d{2,6}[-\s]\d{2,8}\b/g, '[계좌번호 제거]')
    .replace(/(?:주식회사|유한회사|\(주\)|㈜|회사|법인)\s*[가-힣A-Za-z0-9&.\- ]{2,30}/g, '[회사명 제거]')
    .replace(/[가-힣A-Za-z0-9&.\- ]{2,30}\s*(?:주식회사|유한회사|\(주\)|㈜|회사|법인)/g, '[회사명 제거]')
    .replace(/(?:이름|성명|연락처|전화번호|주소|회사명|사업자등록번호|계좌번호|주민등록번호)\s*[:：]?\s*[^\n,.;]{1,80}/g, '[식별정보 제거]')
    .replace(/([가-힣]{2,}(시|군|구)\s*){1,3}[가-힣0-9\s\-]+(로|길)\s*\d*/g, '[주소 제거]');
}

function hasHaruLawSensitivePattern(input: unknown): boolean {
  const text = String(input || '');
  return [
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    /\b\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/,
    /\b\d{6}[-\s]?[1-4]\d{6}\b/,
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{5}\b/,
    /\b\d{2,6}[-\s]\d{2,6}[-\s]\d{2,8}\b/,
    /(?:주식회사|유한회사|\(주\)|㈜|회사|법인)\s*[가-힣A-Za-z0-9&.\- ]{2,30}/,
    /[가-힣A-Za-z0-9&.\- ]{2,30}\s*(?:주식회사|유한회사|\(주\)|㈜|회사|법인)/,
    /([가-힣]{2,}(시|군|구)\s*){1,3}[가-힣0-9\s\-]+(로|길)\s*\d*/,
  ].some((pattern) => pattern.test(text));
}

function clampHaruLawText(input: unknown, maxLength: number): string {
  return removeHaruLawSensitiveInfo(input)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function softenHaruLawPublicText(input: unknown): string {
  return clampHaruLawText(input, 1200)
    .replace(/합법입니다/g, '가능성이 있습니다')
    .replace(/문제없습니다/g, '사례관계에 따라 달라질 수 있습니다')
    .replace(/반드시 인정됩니다/g, '인정될 가능성이 있습니다')
    .replace(/무조건 가능합니다/g, '가능성이 있습니다');
}

function parseHaruLawPublicStatutes(rawArticles: unknown): HaruLawSharePreview['relatedStatutes'] {
  return String(rawArticles || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((block) => {
      const headerMatch = block.match(/^\[([^\]]+)\]\s*([^\n]+)/);
      const title = clampHaruLawText(headerMatch?.[1] || '관련 법령', 60) || '관련 법령';
      const article = clampHaruLawText(headerMatch?.[2] || '관련 조문', 80) || '관련 조문';
      return {
        title,
        article,
        easySummary: '공개용 사례 판단에 참고할 관련 조문입니다. 구체적 적용은 사실관계에 따라 달라질 수 있습니다.',
      };
    });
}

function parseGeminiJsonObject(text: string): any {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new HttpsError('internal', '익명화 응답을 해석할 수 없습니다.');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeHaruLawPreview(raw: any, fallbackStatutes: HaruLawSharePreview['relatedStatutes']): HaruLawSharePreview {
  const judgmentType = ['possible', 'caution', 'need_check'].includes(raw?.judgmentType)
    ? raw.judgmentType
    : 'need_check';
  const relatedStatutes = Array.isArray(raw?.relatedStatutes)
    ? raw.relatedStatutes.slice(0, 3).map((item: any) => ({
      title: clampHaruLawText(item?.title || '관련 법령', 60) || '관련 법령',
      article: clampHaruLawText(item?.article || '', 80) || undefined,
      easySummary: softenHaruLawPublicText(item?.easySummary || '사례관계에 따라 적용 여부가 달라질 수 있습니다.').slice(0, 240),
    }))
    : fallbackStatutes;

  return {
    title: clampHaruLawText(raw?.title || '하루LAW 익명 공유 사례', 80) || '하루LAW 익명 공유 사례',
    anonymizedQuestion: softenHaruLawPublicText(raw?.anonymizedQuestion || '').slice(0, 600),
    summary: softenHaruLawPublicText(raw?.summary || '').slice(0, 900),
    judgmentType,
    relatedStatutes: relatedStatutes.length > 0 ? relatedStatutes : [{
      title: '관련 법령',
      article: '관련 조문',
      easySummary: '사례관계에 따라 적용 여부가 달라질 수 있습니다.',
    }],
    disclaimer: HARU_LAW_SHARE_DISCLAIMER,
  };
}

function assertHaruLawPreviewSafe(preview: HaruLawSharePreview): void {
  const combined = [
    preview.title,
    preview.anonymizedQuestion,
    preview.summary,
    preview.disclaimer,
    ...preview.relatedStatutes.flatMap((item) => [item.title, item.article || '', item.easySummary]),
  ].join('\n');

  if (
    !preview.title ||
    !preview.anonymizedQuestion ||
    !preview.summary ||
    hasHaruLawSensitivePattern(combined)
  ) {
    throw new HttpsError(
      'failed-precondition',
      '개인정보 보호를 위해 공유 미리보기를 만들 수 없습니다. 내용을 줄이거나 개인정보를 제거한 뒤 다시 시도해 주세요.'
    );
  }
}

function getHaruLawSharedCardId(uid: string, sourceRecordId: string): string {
  return crypto
    .createHash('sha256')
    .update(`haruLawShare:${uid}:${sourceRecordId}`)
    .digest('hex')
    .slice(0, 32);
}

// ===== ⚖️ HARUraw — 법령 검색 + Gemini 해석 =====
export const lawSearch = onCall(
  {
    region: 'asia-northeast3',
    secrets: [LAW_API_KEY_SECRET, GEMINI_API_KEY_SECRET],
    timeoutSeconds: 90,
    memory: '1GiB',
    concurrency: 1,
  },
  async (request) => {
    const requestStartedAt = Date.now();
    const requestWorkDeadlineMs = requestStartedAt
      + HARULAW_GEMINI_FILE_TIMEOUT_MS;
    const requestFinalizationDeadlineMs = requestStartedAt
      + HARULAW_CALLABLE_TIMEOUT_MS
      - HARULAW_GEMINI_FINALIZATION_RESERVE_MS;
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    await enforceRateLimit(request.auth.uid, 'lawSearch', 3, 20);

    const uid = request.auth.uid;
    const { query } = request.data;
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new HttpsError('invalid-argument', '검색어가 필요합니다.');
    }
    const attachments = readHaruLawAttachments(request.data?.attachments);
    if (attachments.length > 0) {
      const actualPlan = coerceUserPlan(await getUserPlan(uid));
      if (actualPlan === 'free') {
        throw new HttpsError('permission-denied', '파일 첨부는 베이직·프리미엄 이용권 전용 기능입니다.');
      }
    }

    const { XMLParser } = await import('fast-xml-parser');
    const LAW_API_KEY = LAW_API_KEY_SECRET.value();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

    const axiosConfig = {
      headers: {
        Referer: 'https://haru2026.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      timeout: 10000,
    };

    let processingStage: HaruLawProcessingStage = 'attachment_load';
    let lawApiFailure: HaruLawApiFailureDiagnostics | undefined;
    let haruLawFileClient: GoogleGenAI | null = null;
    let preparedAttachments: PreparedHaruLawAttachments | null = null;
    const trackedGeminiFiles: TrackedHaruLawGeminiFile[] = [];
    const uploadGroupId = crypto.randomUUID();
    try {
      const { XMLParser } = await import('fast-xml-parser');
      const LAW_API_KEY = LAW_API_KEY_SECRET.value().trim();
      const GEMINI_KEY = GEMINI_API_KEY_SECRET.value().trim();
      preparedAttachments = attachments.length > 0
        ? await prepareHaruLawAttachments(uid, attachments, requestWorkDeadlineMs)
        : null;
      if (preparedAttachments) {
        haruLawFileClient = new GoogleGenAI({ apiKey: GEMINI_KEY });
      }

      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
      const axiosConfig = {
        headers: {
          Referer: 'https://haru2026.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          Connection: 'close',
        },
        timeout: 10000,
      };

      const getLawXmlWithRetry = async (url: string) => {
        return runHaruLawApiRequestWithRetry(
          () => axios.get(url, axiosConfig),
          {
            onRetry: (attempt, _error, diagnostics) => {
              logger.warn('HARUraw 법제처 API 재시도', {
                attempt,
                code: diagnostics.upstreamErrorCode ?? undefined,
                status: diagnostics.upstreamHttpStatus ?? undefined,
                stage: processingStage,
                ...diagnostics,
              });
            },
            onFailure: (diagnostics) => { lawApiFailure = diagnostics; },
          },
        );
      };

      // 0단계: Gemini로 정확한 법령 이름 추출
      processingStage = 'keyword_ai';
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const kwModelName = 'gemini-3.1-flash-lite';
      const kwModel = genAI.getGenerativeModel({ model: kwModelName });
      const kwResult = await kwModel.generateContent(
        `다음 질문과 가장 관련된 대한민국 공식 법령 이름 1개만 출력하세요.
반드시 법령 이름만, 다른 설명 없이.

예시:
"욕설한 사람 처벌" → 형법
"돈 안 갚아요" → 민법
"부당해고" → 근로기준법
"외국인 고용" → 외국인근로자의 고용 등에 관한 법률
"상속" → 민법
"이혼" → 민법
"음주운전" → 도로교통법
"사기" → 형법
"폭행" → 형법

	질문: ${query}`
      );
      const kwUsage = getGeminiUsage(kwResult);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_search',
        plan: AI_USAGE_PLAN,
        model: kwModelName,
        inputTokens: kwUsage.inputTokens,
        outputTokens: kwUsage.outputTokens,
        imageCount: 0,
        externalApiProvider: 'gov_law',
        externalApiCalled: true,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      const lawKeyword = kwResult.response.text().trim().split('\n')[0].trim();
      logger.debug('HARUraw 키워드 추출 완료', { stage: 'keyword_ai' });

      // 1단계: 법제처 검색
      processingStage = 'law_api_search';
      const searchUrl = `https://www.law.go.kr/DRF/lawSearch.do?OC=${LAW_API_KEY}&target=law&type=XML&query=${encodeURIComponent(lawKeyword)}`;
      const searchRes = await getLawXmlWithRetry(searchUrl);
      const searchJson = parser.parse(searchRes.data);

      const laws = searchJson?.LawSearch?.law || searchJson?.Law?.law || searchJson?.LawList?.law;
      if (!laws) {
        return { success: false, message: '관련 법령을 찾지 못했습니다.', data: [], aiSummary: '' };
      }

      const lawList = Array.isArray(laws) ? laws : [laws];

      // 정확한 법령명 우선 매칭
      const exactMatch = lawList.find((l: any) =>
        l?.법령명한글 === lawKeyword || l?.법령명 === lawKeyword
      );
      const targetLaw = exactMatch || lawList[0];
      const mstId = targetLaw?.법령일련번호;
      const lawName = targetLaw?.법령명한글 || lawKeyword;
      logger.debug('HARUraw 법령 선택 완료', { stage: 'law_api_search' });

      if (!mstId) {
        return { success: false, message: '법령 정보를 가져올 수 없습니다.', data: [], aiSummary: '' };
      }

      // 2단계: 법령 전문 조회
      processingStage = 'law_api_detail';
      const serviceUrl = `https://www.law.go.kr/DRF/lawService.do?OC=${LAW_API_KEY}&target=law&MST=${mstId}&type=XML`;
      const serviceRes = await getLawXmlWithRetry(serviceUrl);
      const lawJson = parser.parse(serviceRes.data);

      const jomuns = lawJson?.법령?.조문?.조문단위 || [];
      const arrayJomuns = Array.isArray(jomuns) ? jomuns : [jomuns];

      // 전체 조문 정제
      const allJomuns = arrayJomuns
        .map((j: any) => ({
          articleStr: `제${j?.조문번호}조`,
          title: String(j?.조문제목 || '제목 없음'),
          content: String(j?.조문내용 || ''),
          lawName,
          isPrecLinked: true,
        }))
        .filter((j: any) => j.articleStr !== '제undefined조' && j.content.length > 5);

      // 3단계: Gemini로 관련 조문만 선별 (최대 5개)
      processingStage = 'article_select_ai';
      const jomunCatalog = allJomuns
        .map((j: any) => `${j.articleStr}(${j.title})`)
        .join('\n');

      const selectModelName = 'gemini-3.1-flash-lite';
      const selectModel = genAI.getGenerativeModel({ model: selectModelName });
      const selectResult = await selectModel.generateContent(
        `다음은 ${lawName}의 조문 목차입니다.
사용자 질문 "${query}"과 가장 관련된 조문 번호를 최대 3개만 골라서
쉼표로 구분하여 출력하세요. 조문 번호만 (예: 제311조,제312조,제307조)

조문 목차:
	${jomunCatalog}`
      );
      const selectUsage = getGeminiUsage(selectResult);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_search',
        plan: AI_USAGE_PLAN,
        model: selectModelName,
        inputTokens: selectUsage.inputTokens,
        outputTokens: selectUsage.outputTokens,
        imageCount: 0,
        externalApiProvider: 'gov_law',
        externalApiCalled: true,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });

      const selectedNums = selectResult.response.text()
        .trim()
        .split(',')
        .map((s: string) => s.trim());

      const cleanedJomuns = allJomuns
        .filter((j: any) => selectedNums.includes(j.articleStr))
        .slice(0, 3);

      // 선별 실패 시 상위 3개
      const finalJomuns = cleanedJomuns.length > 0 ? cleanedJomuns : allJomuns.slice(0, 3);

      // 4단계: Gemini로 전체 요약 생성
      processingStage = 'summary_ai';
      const summaryModelName = 'gemini-3.1-pro-preview';
      const summaryModel = genAI.getGenerativeModel({ model: summaryModelName });
      const lawText = finalJomuns
        .map((j: any) => `${j.articleStr}(${j.title}): ${j.content}`)
        .join('\n');

      const summaryPrompt = `당신은 공식 법령을 사실원으로 확인하고 가능한 법적 쟁점과 다음 행동을 이해하기 쉽게 안내하는 AI 법률정보 도우미입니다.
다음 원칙을 반드시 지키세요:

[공식 법령 우선 원칙]
- 관할, 기한, 절차, 적용요건 등 법률상 결론은 프롬프트의 일반지식이나 기억에 의존하지 말고 이번 요청에서 제공된 공식 법령·조문을 우선 근거로 판단한다.
- 사건 유형, 당사자 지위, 지역, 시점 등 사실관계에 따라 결론이 달라질 수 있으면 하나로 단정하지 말고 가능한 경우를 구분한다.
- 제공된 법령만으로 판단하기 어려우면 추측하지 말고 추가 확인이 필요하다고 안내한다.
- 조문의 문언뿐 아니라 해당 조문의 적용요건이 사용자 사실관계에 충족되는지 구분해서 설명한다.
- 법령 내용과 모델의 일반지식이 충돌하면 이번 요청에서 제공된 공식 법령 내용을 우선한다.
- 첨부파일이 있으면 사실관계 보조자료로만 활용하고, 법률상 결론은 반드시 이번 요청에서 제공된 공식 법령·조문을 우선 근거로 삼는다.

[사실관계·책임 판단 가드레일]
- 사용자 질문과 제공 자료만으로 누가 가해자인지, 피해 정도, 인과관계, 과실, 책임 주체, 법률 적용요건이 확실하지 않으면 단정하지 마라.
- 법조문을 찾았다는 이유만으로 바로 사용자 사건에 적용하지 말고, 사용자 사실관계 → 조문 적용요건 확인 → 해당 가능성 설명 → 추가 확인사항 안내 순서를 지켜라.
- 사실관계가 충분히 확인되기 전에는 "책임을 인정하세요", "전액 보상하세요", "무조건 사과하세요"처럼 과실·책임 인정을 유도하는 단정적 행동을 권하지 마라.
- 근거가 충분히 확인되지 않은 상태에서는 "자의적", "주관적", "추측성", "명백히 부당", "불법", "위법", "약관 위반"이라고 표현하지 마라.
- 위 표현은 법령, 약관, 판례 또는 확인된 사실관계가 충분히 뒷받침할 때만 사용하라.
- 기본적으로 "현재 자료만으로는 확인되지 않습니다", "추가 확인이 필요합니다", "위법 여부를 단정하기 어렵습니다", "법리상 검토 가능성은 있으나 현재 사실관계만으로 판단하기 어렵습니다", "구체적인 판단 기준이 제시되지 않은 상태입니다" 같은 표현을 우선 사용하라.
- 필요한 경우 "안전 확보 → 자료·기록 보존 → 사실관계 확인 → 보험·계약관계 확인 → 필요한 대응" 순서로 안내하라.
- 형사절차, 민사 손해배상, 행정절차, 기타 필요한 절차를 가능한 범위에서 구분해 설명하라.
- "~가 확인되는 경우", "~에 해당한다면", "~일 가능성이 있습니다", "추가 확인이 필요합니다" 같은 조건부 표현을 사용하라.

1. 사용자 질문을 정확히 이해하고 핵심 법적 쟁점을 파악하세요.
2. 공식 법령 조문을 근거로 하되, 조문 적용요건과 사용자 사실관계의 확인 필요성을 먼저 설명하세요.
3. 어려운 법률 용어는 반드시 쉬운 말로 풀어 설명하세요.
4. 실무적 행동 지침은 조건부로 안내하고, 사실관계 확인 전 책임 인정이나 보상을 단정하지 마세요.
5. 답변 구조:
   📋 확인된 사실
   🔎 추가 확인이 필요한 사실
   ⚖️ 법적으로 말할 수 있는 범위
   📌 현재 사건에 적용 가능한 판단
   💡 사용자가 지금 해야 할 행동
   ➡️ 다음 단계로 넘어가는 조건
   ⚠️ 주의사항
6. 마지막에 반드시 추가:
   "본 내용은 법령 정보 제공 목적이며, 전문적인 법률 자문을 대체할 수 없습니다."

사용자 질문: ${query}
관련 법령(${lawName}):
		${lawText}`;
      const fileParts = preparedAttachments && haruLawFileClient
        ? await uploadPreparedHaruLawAttachments(
          GEMINI_KEY,
          preparedAttachments,
          uploadGroupId,
          trackedGeminiFiles,
          requestWorkDeadlineMs,
        )
        : [] as HaruLawGeminiFilePart[];
      const summaryContents: any = fileParts.length > 0
        ? [{ text: summaryPrompt }, ...fileParts]
        : summaryPrompt;
      const summaryResult = preparedAttachments
        ? await runHaruLawModelBeforeDeadline(
          requestWorkDeadlineMs,
          ({ timeoutMs }) => summaryModel.generateContent(summaryContents, { timeout: timeoutMs }),
        )
        : await summaryModel.generateContent(summaryContents);
      if (preparedAttachments) getHaruLawRemainingWorkMs(requestWorkDeadlineMs);
      const summaryText = summaryResult.response.text().trim();
      if (!summaryText) {
        throw new Error(attachments.length > 0 ? 'attachment content could not be read' : 'empty_answer');
      }
      const summaryUsage = getGeminiUsage(summaryResult);
      const logSuccess = () => logAiUsage({
        uid,
        featureName: 'law_search',
        plan: AI_USAGE_PLAN,
        model: summaryModelName,
        inputTokens: summaryUsage.inputTokens,
        outputTokens: summaryUsage.outputTokens,
        imageCount: 0,
        externalApiProvider: 'gov_law',
        externalApiCalled: true,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(uid),
      });
      if (preparedAttachments) {
        await deleteTrackedHaruLawGeminiFiles(haruLawFileClient, trackedGeminiFiles);
        await removePreparedHaruLawAttachments(preparedAttachments);
        preparedAttachments = null;
        getHaruLawRemainingWorkMs(requestFinalizationDeadlineMs);
        await logSuccess();
      } else {
        await logSuccess();
      }

      return {
        success: true,
        data: finalJomuns,
        aiSummary: summaryText,
      };

    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      const reason: HaruLawErrorReason = error instanceof HaruLawApiTemporaryError
        ? 'LAW_API_TEMPORARY_UNAVAILABLE'
        : processingStage === 'keyword_ai' || processingStage === 'article_select_ai' || processingStage === 'summary_ai'
          ? classifyHaruLawAiError(error, processingStage === 'summary_ai' && attachments.length > 0)
          : 'HARULAW_PROCESSING_FAILED';
      logger.error('HARUraw 법령 검색 실패:', {
        stage: processingStage,
        reason,
        errorName: lawApiFailure
          ? error instanceof HaruLawApiTemporaryError ? 'HaruLawApiTemporaryError' : 'LawApiRequestError'
          : error?.name,
        errorCode: lawApiFailure
          ? error instanceof HaruLawApiTemporaryError ? error.code : lawApiFailure.upstreamErrorCode
          : error?.code,
        errorStatus: lawApiFailure ? lawApiFailure.upstreamHttpStatus : error?.response?.status ?? error?.status,
        ...lawApiFailure,
      });
      if (request.auth?.uid) {
        await logAiUsage({
          uid: request.auth.uid,
          featureName: 'law_search',
          plan: AI_USAGE_PLAN,
          model: null,
          inputTokens: null,
          outputTokens: null,
          imageCount: 0,
          externalApiProvider: 'gov_law',
          externalApiCalled: true,
          groundingUsed: false,
          requestId: null,
          success: false,
          errorCode: reason,
          isDev: DEVELOPER_UIDS.has(request.auth.uid),
        });
      }
      throw createHaruLawHttpsError(reason);
    } finally {
      await deleteTrackedHaruLawGeminiFiles(haruLawFileClient, trackedGeminiFiles);
      await removePreparedHaruLawAttachments(preparedAttachments);
    }
  }
);

export const prepareHaruLawSharePreview = onCall(
  {
    region: 'asia-northeast3',
    memory: '512MiB',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'prepareHaruLawSharePreview', 3, 20);
    await enforceHaruLawSharePreviewLimit(uid);

    try {
      const { record } = await getOwnedHaruLawRecord(uid, request.data?.sourceRecordId);
      const sourceRecordId = String(request.data.sourceRecordId).trim();
      const sourceRecordDate = String(record.date || '');
      const redactedQuery = clampHaruLawText(record.haruraw_query || '', 1200);
      const redactedSummary = clampHaruLawText(record.haruraw_summary || '', 3000);
      const redactedArticles = clampHaruLawText(record.haruraw_articles || '', 5000);
      const fallbackStatutes = parseHaruLawPublicStatutes(record.haruraw_articles);

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value().trim());
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
      const result = await model.generateContent(`다음 하루LAW 기록을 다른 사용자가 참고할 수 있는 익명 공개 카드로 바꾸세요.

반드시 JSON 객체만 출력하세요. 마크다운 코드블록은 사용하지 마세요.
필드는 title, anonymizedQuestion, summary, judgmentType, relatedStatutes만 사용하세요.
judgmentType은 possible, caution, need_check 중 하나입니다.
relatedStatutes는 최대 3개이며 각 항목은 title, article, easySummary를 가집니다.

절대 포함 금지:
- 이름, 연락처, 주소, 이메일, 회사명, 사업자등록번호, 계좌번호, 주민등록번호
- 원문 질문 전체
- 원문 답변 전체
- 원문 조문 전체
- ownerUid 또는 사용자를 식별할 수 있는 내용

법률 표현 원칙:
- "합법입니다", "문제없습니다", "반드시 인정됩니다", "무조건 가능합니다" 같은 단정 표현 금지
- "가능성이 있습니다", "주의가 필요합니다", "추가 확인이 필요합니다", "사례관계에 따라 달라질 수 있습니다"처럼 표현

입력은 이미 1차 정규식 익명화를 거친 자료입니다. 그래도 남은 식별 가능 정보가 있으면 제거하세요.

[질문]
${redactedQuery}

[AI 분석]
${redactedSummary}

[관련 조문 요약 원천]
${redactedArticles}`);

      const preview = normalizeHaruLawPreview(parseGeminiJsonObject(result.response.text()), fallbackStatutes);
      assertHaruLawPreviewSafe(preview);

      const previewId = crypto.randomBytes(16).toString('hex');
      const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + HARU_LAW_SHARE_PREVIEW_TTL_MS);
      await db.collection('haruLawSharePreviews').doc(previewId).set({
        ownerUid: uid,
        sourceRecordId,
        sourceRecordDate,
        preview,
        status: 'ready',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
      });

      return {
        success: true,
        previewId,
        expiresAt: expiresAt.toDate().toISOString(),
        preview,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      logger.error('하루LAW 익명 공유 미리보기 실패:', error);
      throw new HttpsError(
        'internal',
        '개인정보 보호를 위해 공유 미리보기를 만들 수 없습니다. 내용을 줄이거나 개인정보를 제거한 뒤 다시 시도해 주세요.'
      );
    }
  }
);

export const publishHaruLawSharedCard = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;

    const previewId = request.data?.previewId;
    if (typeof previewId !== 'string' || !previewId.trim()) {
      throw new HttpsError('invalid-argument', 'previewId가 필요합니다.');
    }

    const previewRef = db.collection('haruLawSharePreviews').doc(previewId.trim());
    const previewSnap = await previewRef.get();
    if (!previewSnap.exists) {
      throw new HttpsError('not-found', '공유 미리보기를 찾을 수 없습니다.');
    }

    const previewData = previewSnap.data() || {};
    if (previewData.ownerUid !== uid) {
      throw new HttpsError('permission-denied', '공유 미리보기 소유자가 아닙니다.');
    }

    const expiresAt = previewData.expiresAt;
    if (!expiresAt?.toMillis || expiresAt.toMillis() < Date.now()) {
      throw new HttpsError('failed-precondition', '공유 미리보기 유효 시간이 지났습니다. 다시 미리보기를 만들어 주세요.');
    }

    const sourceRecordId = String(previewData.sourceRecordId || '');
    const { recordRef, record } = await getOwnedHaruLawRecord(uid, sourceRecordId);
    const preview = normalizeHaruLawPreview(previewData.preview, parseHaruLawPublicStatutes(record.haruraw_articles));
    assertHaruLawPreviewSafe(preview);

    const cardId = getHaruLawSharedCardId(uid, sourceRecordId);
    const cardRef = db.collection('sharedHaruLawCards').doc(cardId);
    const metaRef = db.collection('sharedHaruLawCardMeta').doc(cardId);
    let finalStatus = 'pending';
    let alreadySubmitted = false;

    await db.runTransaction(async (tx) => {
      const metaSnap = await tx.get(metaRef);
      const currentStatus = String(metaSnap.data()?.status || '');

      if (currentStatus === 'pending' || currentStatus === 'published') {
        finalStatus = currentStatus;
        alreadySubmitted = true;
        tx.update(previewRef, {
          status: 'used',
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(cardRef, {
        category: 'haruLaw',
        status: 'pending',
        title: preview.title,
        anonymizedQuestion: preview.anonymizedQuestion,
        summary: preview.summary,
        judgmentType: preview.judgmentType,
        relatedStatutes: preview.relatedStatutes,
        disclaimer: preview.disclaimer,
        createdAt: now,
        updatedAt: now,
      }, { merge: false });

      tx.set(metaRef, {
        ownerUid: uid,
        sourceRecordId,
        sourceRecordDate: String(record.date || previewData.sourceRecordDate || ''),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }, { merge: false });

      tx.update(recordRef, {
        haruLawShareStatus: 'pending',
        haruLawSharedCardId: cardId,
        haruLawSharedUpdatedAt: now,
      });

      tx.update(previewRef, {
        status: 'used',
        usedAt: now,
        cardId,
      });
    });

    return {
      success: true,
      cardId,
      status: finalStatus,
      alreadySubmitted,
      message: alreadySubmitted
        ? '이미 익명 공유 신청이 접수된 하루LAW 기록입니다.'
        : '익명 공유 신청이 접수되었습니다. 관리자 검수 후 사유-함께보기에 표시됩니다.',
    };
  }
);

export const unpublishHaruLawSharedCard = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    const sourceRecordId = typeof request.data?.sourceRecordId === 'string'
      ? request.data.sourceRecordId.trim()
      : '';
    const explicitCardId = typeof request.data?.cardId === 'string'
      ? request.data.cardId.trim()
      : '';
    const cardId = explicitCardId || (sourceRecordId ? getHaruLawSharedCardId(uid, sourceRecordId) : '');

    if (!cardId) {
      throw new HttpsError('invalid-argument', 'cardId 또는 sourceRecordId가 필요합니다.');
    }

    const cardRef = db.collection('sharedHaruLawCards').doc(cardId);
    const metaRef = db.collection('sharedHaruLawCardMeta').doc(cardId);
    const metaSnap = await metaRef.get();
    if (!metaSnap.exists) {
      throw new HttpsError('not-found', '공유 카드 메타 정보를 찾을 수 없습니다.');
    }

    const meta = metaSnap.data() || {};
    if (meta.ownerUid !== uid && !isDeveloperUid(uid)) {
      throw new HttpsError('permission-denied', '공유 취소 권한이 없습니다.');
    }

    await db.runTransaction(async (tx) => {
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(cardRef, {
        status: 'withdrawn',
        updatedAt: now,
      }, { merge: true });
      tx.set(metaRef, {
        status: 'withdrawn',
        updatedAt: now,
      }, { merge: true });

      if (typeof meta.ownerUid === 'string' && typeof meta.sourceRecordId === 'string') {
        const recordRef = db.collection('users').doc(meta.ownerUid).collection('records').doc(meta.sourceRecordId);
        tx.set(recordRef, {
          haruLawShareStatus: 'withdrawn',
          haruLawSharedUpdatedAt: now,
        }, { merge: true });
      }
    });

    return { success: true, cardId, status: 'withdrawn' };
  }
);

// ⚖️ 하루LAW 익명 공유 검수 — 관리자 대기 목록 조회
// sharedHaruLawCardMeta는 규칙상 클라이언트 직접 접근 불가(read,write: if false)이므로
// 대기 카드 조회는 반드시 이 함수를 경유한다. 작성자 uid는 검수자에게 노출하지 않는다.
export const listPendingHaruLawSharedCards = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    if (!isDeveloperUid(request.auth.uid)) {
      throw new HttpsError('permission-denied', '검수 권한이 없습니다.');
    }

    const metaSnap = await db
      .collection('sharedHaruLawCardMeta')
      .where('status', '==', 'pending')
      .limit(100)
      .get();

    const cards = await Promise.all(
      metaSnap.docs.map(async (metaDoc) => {
        const cardSnap = await db.collection('sharedHaruLawCards').doc(metaDoc.id).get();
        if (!cardSnap.exists) return null;
        const card = cardSnap.data() || {};
        const meta = metaDoc.data() || {};
        return {
          cardId: metaDoc.id,
          title: String(card.title || ''),
          anonymizedQuestion: String(card.anonymizedQuestion || ''),
          summary: String(card.summary || ''),
          judgmentType: String(card.judgmentType || ''),
          relatedStatutes: Array.isArray(card.relatedStatutes) ? card.relatedStatutes : [],
          disclaimer: String(card.disclaimer || ''),
          sourceRecordDate: String(meta.sourceRecordDate || ''),
          requestedAtMs: meta.createdAt?.toMillis?.() ?? 0,
        };
      })
    );

    const items = cards
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.requestedAtMs - b.requestedAtMs);

    return { success: true, items, total: items.length };
  }
);

// ⚖️ 하루LAW 익명 공유 검수 — 승인/반려 처리
// pending 상태만 검수 대상이며, 승인 시 status가 'published'로 바뀌어야
// firestore.rules의 read 조건(status == 'published')을 통과해 함께보기에 노출된다.
export const reviewHaruLawSharedCard = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const reviewerUid = request.auth.uid;
    if (!isDeveloperUid(reviewerUid)) {
      throw new HttpsError('permission-denied', '검수 권한이 없습니다.');
    }

    const cardId = typeof request.data?.cardId === 'string' ? request.data.cardId.trim() : '';
    const action = request.data?.action;
    const rejectedReason = String(request.data?.reason || '').trim().slice(0, 300);

    if (!cardId) {
      throw new HttpsError('invalid-argument', 'cardId가 필요합니다.');
    }
    if (action !== 'approve' && action !== 'reject') {
      throw new HttpsError('invalid-argument', "action은 'approve' 또는 'reject'여야 합니다.");
    }
    if (action === 'reject' && !rejectedReason) {
      throw new HttpsError('invalid-argument', '반려 사유를 입력해 주세요.');
    }

    const nextStatus = action === 'approve' ? 'published' : 'rejected';
    const cardRef = db.collection('sharedHaruLawCards').doc(cardId);
    const metaRef = db.collection('sharedHaruLawCardMeta').doc(cardId);

    await db.runTransaction(async (tx) => {
      const metaSnap = await tx.get(metaRef);
      if (!metaSnap.exists) {
        throw new HttpsError('not-found', '공유 카드 메타 정보를 찾을 수 없습니다.');
      }
      const meta = metaSnap.data() || {};
      if (String(meta.status || '') !== 'pending') {
        throw new HttpsError('failed-precondition', '검수 대기 중인 카드가 아닙니다.');
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(cardRef, { status: nextStatus, updatedAt: now }, { merge: true });
      tx.set(metaRef, {
        status: nextStatus,
        reviewedAt: now,
        reviewedBy: reviewerUid,
        rejectedReason: action === 'reject' ? rejectedReason : '',
        updatedAt: now,
      }, { merge: true });

      if (typeof meta.ownerUid === 'string' && typeof meta.sourceRecordId === 'string') {
        const recordRef = db.collection('users').doc(meta.ownerUid).collection('records').doc(meta.sourceRecordId);
        tx.set(recordRef, {
          haruLawShareStatus: nextStatus,
          haruLawShareRejectedReason: action === 'reject' ? rejectedReason : '',
          haruLawSharedUpdatedAt: now,
        }, { merge: true });
      }
    });

    logger.info('하루LAW 공유 검수 처리:', { cardId, action, reviewerUid });
    return { success: true, cardId, status: nextStatus };
  }
);

// ===== 법령 쉬운 해설 =====
export const lawEasyExplain = onCall(
  {
    region: 'asia-northeast3',
    memory: '512MiB',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    let input;
    try {
      input = validateLawEasyExplainInput(request.data);
    } catch (error) {
      if (error instanceof LawEasyExplainInputError) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw error;
    }

    const {
      normalizedLawText,
      normalizedUserQuery,
      lawName,
      articleStr,
    } = input;
    const cacheKey = buildLawConsultCacheKey({
      normalizedLawText,
      normalizedUserQuery,
    });
    const cacheRef = db.collection('lawConsultCache').doc(cacheKey);

    try {
      const modelName = 'gemini-3.1-flash-lite';
      const result = await resolveLawEasyExplanation({
        readCache: async () => {
          const cacheSnap = await cacheRef.get();
          return cacheSnap.exists ? cacheSnap.data()?.explanation : null;
        },
        generate: async () => {
          const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: `당신은 실무 경력 20년의 대한민국 법률 전문가입니다.
사용자의 질문과 관련 법조문을 바탕으로, 반드시 아래 형식으로만 답변하세요.
마크다운 기호(**, ##, --, >, __)는 절대 사용하지 마세요.

⚖️ 관련 법조문 핵심 요약:
(이 조문이 다루는 내용을 2문장 이내로 쉽게 설명)

📌 Case 1 — 내가 가해자라면 (가상 시나리오)
예상 처벌:
(이 법조문 기준으로 받을 수 있는 최대 처벌을 구체적으로 설명. 예: 징역 OO년 또는 벌금 OOO만원)

처벌을 낮추려면:
(실질적으로 할 수 있는 행동 2~3가지. 예: 합의, 자수, 반성문 등)

📌 Case 2 — 내가 피해자라면 (가상 시나리오)
가해자를 처벌하려면:
(신고 방법, 고소장 제출 등 구체적 행동 2~3가지)

AI 의견:
(이 상황에서 피해자가 가장 현명하게 대처하는 방법에 대한 전문가 소견 2~3문장)

⚠️ 주의사항:
(놓치기 쉬운 중요한 점 1가지)

본 내용은 법령 정보 제공 목적이며, 전문적인 법률 자문을 대체할 수 없습니다.`
          });
          const prompt = `[사용자 질문]: ${normalizedUserQuery}\n\n[관련 법조문]: ${normalizedLawText}`;
          const generationResult = await model.generateContent(prompt);
          return {
            explanation: generationResult.response.text(),
            usage: getGeminiUsage(generationResult),
          };
        },
        recordUsage: async (generation) => {
          await logAiUsage({
            uid: request.auth!.uid,
            featureName: 'law_explain',
            plan: AI_USAGE_PLAN,
            model: modelName,
            inputTokens: generation.usage.inputTokens,
            outputTokens: generation.usage.outputTokens,
            imageCount: 0,
            externalApiProvider: null,
            externalApiCalled: false,
            groundingUsed: false,
            requestId: null,
            success: true,
            errorCode: null,
            isDev: DEVELOPER_UIDS.has(request.auth!.uid),
          });
        },
        writeCache: async (explanation) => {
          await cacheRef.set({
            explanation,
            promptVersion: LAW_EASY_EXPLAIN_PROMPT_VERSION,
            lawName,
            articleStr,
            lawTextHash: sha256Hex(normalizedLawText),
            questionHash: sha256Hex(normalizedUserQuery),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        },
        onCacheReadError: (cacheError: any) => {
          logger.warn('lawEasyExplain 캐시 조회 실패, Gemini 생성 진행:', {
            cacheKey,
            message: cacheError?.message || String(cacheError),
          });
        },
        onCacheWriteError: (cacheError: any) => {
          logger.warn('lawEasyExplain 캐시 저장 실패, explanation 반환:', {
            cacheKey,
            message: cacheError?.message || String(cacheError),
          });
        },
      });
      return {
        success: true,
        ...result,
      };

    } catch (error: any) {
      logger.error('법령 해설 실패:', error);
      if (request.auth?.uid) {
        await logAiUsage({
          uid: request.auth.uid,
          featureName: 'law_explain',
          plan: AI_USAGE_PLAN,
          model: null,
          inputTokens: null,
          outputTokens: null,
          imageCount: 0,
          externalApiProvider: null,
          externalApiCalled: false,
          groundingUsed: false,
          requestId: null,
          success: false,
          errorCode: getAiUsageErrorCode(error),
          isDev: DEVELOPER_UIDS.has(request.auth.uid),
        });
      }
      throw new HttpsError('internal', '법령 해설에 실패했습니다.');
    }
  }
);

// ===== 법령 관련 판례 검색 (국가법령정보 OpenAPI 연동) =====
export const lawPrecedent = onCall(
  {
    region: 'asia-northeast3',
    memory: '512MiB',
    secrets: [LAW_API_KEY_SECRET, GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const { lawText, userQuery } = request.data;

    if (!lawText || String(lawText).trim().length === 0) {
      throw new HttpsError('invalid-argument', '법령 정보가 필요합니다');
    }

    const requestId = createAiUsageRequestId();
    const isDev = DEVELOPER_UIDS.has(request.auth.uid);
    const DISCLAIMER = '이 정보는 국가법령정보센터에서 제공한 실제 판례입니다. AI 요약은 참고용이며, 정확한 내용은 법령정보센터에서 확인하세요.';
    const NO_RESULT_DISCLAIMER = '이 검색은 국가법령정보센터의 실제 판례 데이터를 기반으로 합니다.';

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());

    // 1. Gemini로 검색 키워드 추출 (lawSearch 0단계 패턴)
    let searchKeyword = '';
    const kwModelName = 'gemini-3.1-flash-lite';
    try {
      const kwModel = genAI.getGenerativeModel({ model: kwModelName });
      const kwResult = await kwModel.generateContent(
        `다음 법령 조문과 사용자 질문에 가장 관련된 판례 검색용 핵심 키워드 1개만 출력하세요.
반드시 단일 명사로, 다른 설명 없이.

예시:
"음주운전 처벌" → 음주운전
"부당해고 당함" → 해고
"이혼 재산분할" → 이혼
"사기죄 신고" → 사기
"폭행 합의" → 폭행
"임대차 보증금" → 임대차
"상속 분쟁" → 상속
"성희롱 처벌" → 성희롱
"명예훼손 고소" → 명예훼손

법령: ${lawText}
사용자 질문: ${userQuery || '없음'}`
      );
      const usage = getGeminiUsage(kwResult);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_precedent',
        plan: AI_USAGE_PLAN,
        model: kwModelName,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        imageCount: 0,
        externalApiProvider: 'gov_law',
        externalApiCalled: true,
        groundingUsed: false,
        requestId,
        success: true,
        errorCode: null,
        isDev,
      });
      searchKeyword = kwResult.response.text().trim().split('\n')[0].trim();
      // 한글 1자 이상 포함 검증 (한자/기호만 나오면 폴백)
      if (!/[가-힣]/.test(searchKeyword) || searchKeyword.length === 0) {
        searchKeyword = '';
      }
    } catch (kwErr: any) {
      logger.warn('판례 키워드 추출 실패, 폴백 사용:', kwErr?.message);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_precedent',
        plan: AI_USAGE_PLAN,
        model: kwModelName,
        inputTokens: null,
        outputTokens: null,
        imageCount: 0,
        externalApiProvider: 'gov_law',
        externalApiCalled: true,
        groundingUsed: false,
        requestId,
        success: false,
        errorCode: getAiUsageErrorCode(kwErr),
        isDev,
      });
      searchKeyword = '';
    }

    // 키워드 추출 실패 시 폴백 (userQuery → lawText 첫 20자)
    if (!searchKeyword) {
      const fallback = (userQuery && String(userQuery).trim()) || String(lawText).trim().slice(0, 20);
      searchKeyword = fallback.slice(0, 20);
    }

    logger.info('lawPrecedent 검색 키워드:', searchKeyword);

    // 2. 국가법령정보 OpenAPI 호출 (판례 검색)
    const ocKey = LAW_API_KEY_SECRET.value().trim();
    const searchUrl = `https://www.law.go.kr/DRF/lawSearch.do?OC=${ocKey}&target=prec&type=JSON&query=${encodeURIComponent(searchKeyword)}&display=10`;

    let response: any;
    try {
      response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: {
          'Referer': 'https://haru2026.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
    } catch (apiErr: any) {
      logger.error('판례 OpenAPI 호출 실패:', {
        message: apiErr?.message,
        status: apiErr?.response?.status,
        code: apiErr?.code,
      });
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_precedent',
        plan: AI_USAGE_PLAN,
        model: null,
        inputTokens: null,
        outputTokens: null,
        imageCount: 0,
        externalApiProvider: 'gov_law',
        externalApiCalled: true,
        groundingUsed: false,
        requestId,
        success: false,
        errorCode: getAiUsageErrorCode(apiErr),
        isDev,
      });
      throw new HttpsError('internal', '판례 검색 서버에 연결할 수 없습니다');
    }

    // 3. 응답 파싱
    const precSearch = response.data?.PrecSearch;
    const totalCnt = parseInt(precSearch?.totalCnt || '0', 10);
    const rawList = precSearch?.prec;

    // 4. 0건 또는 비정상 구조 처리
    if (!precSearch || totalCnt === 0 || !rawList) {
      logger.info('lawPrecedent 0건 응답:', { searchKeyword, userQuery: userQuery || '' });
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_precedent',
        plan: AI_USAGE_PLAN,
        model: null,
        inputTokens: null,
        outputTokens: null,
        imageCount: 0,
        externalApiProvider: 'gov_law',
        externalApiCalled: true,
        groundingUsed: false,
        requestId,
        success: true,
        errorCode: null,
        isDev,
      });
      return {
        success: true,
        precedents: [],
        totalCount: 0,
        searchKeyword,
        message: '관련 판례를 찾을 수 없습니다',
        disclaimer: NO_RESULT_DISCLAIMER,
      };
    }

    // 5. 상위 3건 normalize
    const precList = Array.isArray(rawList) ? rawList : [rawList];
    const top3 = precList.slice(0, 3);

    // 6. Gemini 일괄 요약 (메타데이터만, 환각 차단 시스템 프롬프트)
    let summaries: Array<{ summary: string }> = [];
    const sumModelName = 'gemini-3.1-flash-lite';
    try {
      const sumModel = genAI.getGenerativeModel({
        model: sumModelName,
        systemInstruction: `당신은 실무 경력 20년의 대한민국 법률 전문가입니다.
아래에 제공된 판례들은 국가법령정보센터에서 가져온 실제 판례입니다.
사용자의 검색 키워드와 질문 맥락을 바탕으로, 각 판례를 사용자가 이해하기 쉽게 요약하세요.

⚠️ 절대 규칙:
1. 제공된 사건명·사건번호 외에 새 정보를 만들지 마세요.
2. 사건의 구체적 판결 결과·사실관계를 추측하지 마세요. (본문이 제공되지 않았습니다)
3. 제공된 메타데이터(사건명·법원·선고일자)에서 합리적으로 읽을 수 있는 내용만 작성하세요.
4. 마크다운 기호(**, ##, --, >, __)는 절대 사용하지 마세요.

각 판례에 대해 사용자가 검색한 맥락에서 이 판례가 어떤 종류의 사건이고 왜 관련 있는지 200자 이내 한 단락으로 요약하세요. 줄바꿈 없이 한 단락으로.

JSON 배열로만 출력하세요. 다른 텍스트 없이.
형식:
[
  { "summary": "..." },
  { "summary": "..." },
  { "summary": "..." }
]`,
      });

      const precLines = top3
        .map((p: any, i: number) =>
          `${i + 1}. 사건명: ${p?.사건명 || '(없음)'} / 사건번호: ${p?.사건번호 || '(없음)'} / 법원: ${p?.법원명 || '(없음)'} / 선고일: ${p?.선고일자 || '(없음)'}`
        )
        .join('\n');

      const sumPrompt = `검색 키워드: ${searchKeyword}
사용자 질문: ${userQuery || '없음'}

판례 목록:
${precLines}`;

      const sumResult = await sumModel.generateContent(sumPrompt);
      const usage = getGeminiUsage(sumResult);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_precedent',
        plan: AI_USAGE_PLAN,
        model: sumModelName,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        imageCount: 0,
        externalApiProvider: 'gov_law',
        externalApiCalled: true,
        groundingUsed: false,
        requestId,
        success: true,
        errorCode: null,
        isDev,
      });
      let rawSum = sumResult.response.text().trim();
      rawSum = rawSum.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(rawSum);
      if (Array.isArray(parsed)) {
        summaries = parsed;
      }
    } catch (sumErr: any) {
      logger.warn('판례 요약 생성 실패, 기본값 사용:', sumErr?.message);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_precedent',
        plan: AI_USAGE_PLAN,
        model: sumModelName,
        inputTokens: null,
        outputTokens: null,
        imageCount: 0,
        externalApiProvider: 'gov_law',
        externalApiCalled: true,
        groundingUsed: false,
        requestId,
        success: false,
        errorCode: getAiUsageErrorCode(sumErr),
        isDev,
      });
      summaries = [];
    }

    // 7. 반환 객체 조립 (기존 호환 + 신규 필드)
    const precedents = top3.map((p: any, idx: number) => ({
      caseName: p?.사건명 || '',
      caseNum: `${p?.법원명 || ''} ${p?.선고일자 || ''} 선고 ${p?.사건번호 || ''}`.trim(),
      summary: summaries[idx]?.summary || 'AI 요약 생성 실패',
      courtName: p?.법원명 || '',
      sentenceDate: p?.선고일자 || '',
      caseId: p?.판례일련번호 || '',
      detailLink: p?.판례상세링크
        ? `https://www.law.go.kr${p.판례상세링크}`
        : '',
    }));

    return {
      success: true,
      precedents,
      totalCount: totalCnt,
      searchKeyword,
      disclaimer: DISCLAIMER,
    };
  }
);
