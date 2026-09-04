import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import axios from 'axios';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
import * as fs from 'fs';
import * as path from 'path';
import { logAiUsage } from './aiUsageLogger';
import { cancelSubscriptionForUid, revokeBillingKeyForUid } from './subscriptionHelpers';
import { syncSubscriptionRefundFromPortOnePayment } from './subscriptionRefunds';
import {
  type SubscriptionBillingCustomer,
  areSubscriptionBillingCustomersEqual,
  assertStoredSubscriptionBillingCustomer,
  buildPortOneBillingKeyPaymentPayload,
  getPortOneBillingErrorSummary,
  getStoredSubscriptionBillingCustomer,
  normalizeSubscriptionBillingCustomer,
} from './subscriptionBillingCore';
import { enforceRateLimit } from './utils/rateLimit';
import * as PortOne from '@portone/server-sdk';
import {
  getMonthlyAiQuotaStatus as getMonthlyAiQuotaStatusForUser,
  reserveMonthlyAiQuota,
  rollbackMonthlyAiQuotaReservation,
  type MonthlyAiQuotaReservation,
  reserveMonthlyOcrQuota,
  rollbackMonthlyOcrQuotaReservation,
  type MonthlyOcrQuotaReservation,
} from './utils/monthlyAiQuota';
import {
  INTERNAL_ADMIN_UID,
  INTERNAL_DEVELOPER_UIDS,
  buildRecurringBillingSkipLogContext,
  isInternalAdminUid,
  isInternalDeveloperUid,
  resolveInternalPlan,
  shouldExcludeFromRecurringBilling,
} from './internalEntitlements';
// 신 SDK — 현재는 chatWithResult(웹검색 grounding) 전용. 다른 함수는 legacy 유지.
import { GoogleGenAI } from '@google/genai';
// HARU가계부 카카오뱅크 XLSX 잠금 해제 전용 (msoffcrypto-tool TS 포트)
import { OfficeFile, InvalidKeyError, DecryptionError } from 'office-crypto';

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp();
}

// ===== 🔐 Secrets 정의 (보안) =====
const GEMINI_API_KEY_SECRET = defineSecret('GEMINI_API_KEY');
const GOOGLE_CLIENT_ID_SECRET = defineSecret('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET_SECRET = defineSecret('GOOGLE_CLIENT_SECRET');
const KAKAO_CLIENT_ID_SECRET = defineSecret('KAKAO_CLIENT_ID');
const KAKAO_CLIENT_SECRET_SECRET = defineSecret('KAKAO_CLIENT_SECRET');
const KAKAO_REST_API_KEY_SECRET = defineSecret('KAKAO_REST_API_KEY');
const NAVER_CLIENT_ID_SECRET = defineSecret('NAVER_CLIENT_ID');
const NAVER_CLIENT_SECRET_SECRET = defineSecret('NAVER_CLIENT_SECRET');
const PORTONE_API_SECRET = defineSecret('PORTONE_API_SECRET');
const PORTONE_WEBHOOK_SECRET = defineSecret('PORTONE_WEBHOOK_SECRET');
const LAW_API_KEY_SECRET = defineSecret('LAW_API_KEY');
const GOOGLE_CLOUD_API_KEY_SECRET = defineSecret('GOOGLE_CLOUD_API_KEY');
const OPENAI_API_KEY_SECRET = defineSecret('OPENAI_API_KEY');
const COLLECTOR_SECRET_KEY = defineSecret('COLLECTOR_SECRET_KEY');
const ONBID_API_KEY_SECRET = defineSecret('ONBID_API_KEY');
const DRUG_API_KEY_SECRET = defineSecret('DRUG_API_KEY');
const DRUG_API_SERVICE_KEY_SECRET = defineSecret('DRUG_API_SERVICE_KEY');
const HIRA_API_KEY_SECRET = defineSecret('HIRA_API_KEY');
const KINDWISE_PLANT_ID_API_KEY_SECRET = defineSecret('KINDWISE_PLANT_ID_API_KEY');
const PLANTNET_API_KEY_SECRET = defineSecret('PLANTNET_API_KEY');
const MICROSOFT_CLIENT_ID_SECRET = defineSecret('MICROSOFT_CLIENT_ID');
const MICROSOFT_CLIENT_SECRET_SECRET = defineSecret('MICROSOFT_CLIENT_SECRET');
const GOOGLE_DRIVE_SERVICE_ACCOUNT_SECRET = defineSecret('GOOGLE_DRIVE_SERVICE_ACCOUNT');
const FRONTEND_URL = 'https://haru2026-8abb8.web.app';
// 관리자 전용 기능 접근 제어용 UID
const ADMIN_UID = INTERNAL_ADMIN_UID;

// Storage 버킷
const bucket = () => getStorage().bucket();
const DEVELOPER_UIDS = INTERNAL_DEVELOPER_UIDS;
const AI_USAGE_PLAN = 'beta';
const READING_BOOK_OCR_LIMIT = 20;

type UserPlan = 'free' | 'basic' | 'premium' | 'developer';
type ResultAnswerRoute = 'record_only' | 'professional_api' | 'web_search' | 'ambiguous' | 'high_risk_guidance';
type ResultChatRiskLevel = 'low' | 'medium' | 'high';
type ResultChatSafetyMode =
  | 'reflection'
  | 'writing'
  | 'report'
  | 'plant_basic'
  | 'timeline_basic'
  | 'legal_basic'
  | 'medical_basic'
  | 'finance_basic';
type ExternalDataPolicy = 'record_first' | 'conditional_external' | 'official_source_first' | 'current_data_required';
type ResultChatSourcePolicy = {
  sourceKey: string;
  label: string;
  riskLevel: ResultChatRiskLevel;
  safetyMode: ResultChatSafetyMode;
  externalDataPolicy: ExternalDataPolicy;
  systemGuide: string;
};

const HARULAW_RESPONSE_STRUCTURE_GUIDE = [
  '- 법률 답변은 "확인된 사실", "추가 확인이 필요한 사실", "법적으로 말할 수 있는 범위", "현재 사건에 적용 가능한 판단", "사용자가 지금 해야 할 행동", "다음 단계로 넘어가는 조건", "주의사항"을 구분해 작성한다.',
  '- 일반 법리와 현재 사건 적용을 분리한다. 법리상 검토 가능성이 있어도, 현재 사실관계만으로 요건 충족을 판단하기 어려우면 그 한계를 별도로 밝힌다.',
  '- 근거가 충분히 확인되지 않은 상태에서는 "자의적", "주관적", "추측성", "명백히 부당", "불법", "위법", "약관 위반"이라고 표현하지 않는다.',
  '- 위 표현은 법령, 약관, 판례 또는 확인된 사실관계가 충분히 뒷받침할 때만 사용한다.',
  '- 기본 표현은 "현재 자료만으로는 확인되지 않습니다", "추가 확인이 필요합니다", "위법 여부를 단정하기 어렵습니다", "법리상 검토 가능성은 있으나 현재 사실관계만으로 판단하기 어렵습니다", "구체적인 판단 기준이 제시되지 않은 상태입니다"를 우선 사용한다.',
  '- 행동 안내는 자료 확보, 상대방의 공식 답변 확보, 약관·계약서·공식 기준 확인, 보완 또는 재신청, 필요 시 민원·분쟁조정, 최종적으로 전문 법률 상담 또는 소송 검토 순서로 정리한다.',
].join('\n');
type ResultChatClassification = {
  route: ResultAnswerRoute;
  reasonCode: 'current_fact' | 'record_analysis' | 'official_data' | 'high_risk' | 'unclear';
  confidence: number;
};

const RESULT_CHAT_MODEL_NAME = 'gemini-3.1-flash-lite';
const RESULT_CHAT_QUESTION_MAX_LENGTH = 1200;
const RESULT_CHAT_SOURCE_MAX_LENGTH = 9000;
const RESULT_CHAT_PROMPT_SOURCE_MAX_LENGTH = 8000;
const RESULT_CHAT_ANSWER_MAX_LENGTH = 5000;
const RESULT_CHAT_HISTORY_LIMIT = 8;
const RESULT_CHAT_HISTORY_ITEM_MAX_LENGTH = 1000;
const RESULT_CHAT_MAX_OUTPUT_TOKENS = 1200;
const RESULT_CHAT_CLASSIFIER_MAX_OUTPUT_TOKENS = 160;
const RESULT_CHAT_LOCK_STALE_MS = 90000;
const RESULT_CHAT_RATE_WINDOW_MS = 60000;
const RESULT_CHAT_RATE_LIMIT = 12;
const WEB_SEARCH_LIMITS: Record<UserPlan, number> = { free: 1, basic: 2, premium: 4, developer: 4 };
const RESULT_CHAT_PLAN_LABELS: Record<UserPlan, string> = {
  free: '무료 이용권',
  basic: '기본 이용권',
  premium: '프리미엄 이용권',
  developer: '개발자 이용권',
};
const RESULT_ROUTE_LABELS: Record<ResultAnswerRoute, string> = {
  record_only: '📘 나의 기록을 바탕으로 답변',
  professional_api: '🏛 공식·전문자료를 확인한 답변',
  web_search: '🌐 최신 외부자료를 확인한 답변',
  ambiguous: '📘 나의 기록을 바탕으로 답변',
  high_risk_guidance: '⚠️ 전문적인 확인이 필요한 안내',
};

const RESULT_CHAT_SOURCE_POLICIES: Record<string, ResultChatSourcePolicy> = {
  diary_sayu: { sourceKey: 'diary_sayu', label: '일기', riskLevel: 'medium', safetyMode: 'reflection', externalDataPolicy: 'record_first', systemGuide: '사용자의 하루 기록을 바탕으로 감정 흐름과 다음 행동을 차분히 정리한다.' },
  essay_sayu: { sourceKey: 'essay_sayu', label: '에세이', riskLevel: 'low', safetyMode: 'writing', externalDataPolicy: 'record_first', systemGuide: '글의 주제, 표현, 구조를 원문 의도를 해치지 않는 범위에서 돕는다.' },
  mission_sayu: { sourceKey: 'mission_sayu', label: '선교보고', riskLevel: 'medium', safetyMode: 'report', externalDataPolicy: 'record_first', systemGuide: '선교 현장 기록을 바탕으로 은혜, 사역 흐름, 후속 확인사항을 기록 안에서 정리한다.' },
  report_sayu: { sourceKey: 'report_sayu', label: '일반보고', riskLevel: 'low', safetyMode: 'report', externalDataPolicy: 'record_first', systemGuide: '보고 내용의 진행 상황, 성과, 누락 가능성, 다음 계획을 사실 중심으로 정리한다.' },
  work_sayu: { sourceKey: 'work_sayu', label: '업무일지', riskLevel: 'medium', safetyMode: 'report', externalDataPolicy: 'record_first', systemGuide: '업무 기록을 바탕으로 우선순위, 미결 사항, 리스크를 실무적으로 정리한다.' },
  travel_sayu: { sourceKey: 'travel_sayu', label: '여행기록', riskLevel: 'low', safetyMode: 'reflection', externalDataPolicy: 'conditional_external', systemGuide: '여행 기록의 장면, 감상, 기억할 요소를 정리한다. 운영시간, 날씨, 현재 일정은 외부 최신자료가 필요함을 구분한다.' },
  reading_sayu: { sourceKey: 'reading_sayu', label: '독서사유', riskLevel: 'low', safetyMode: 'reflection', externalDataPolicy: 'record_first', systemGuide: '독서 기록에 드러난 생각의 흐름과 삶의 연결점을 원문 중심으로 정리한다.' },
  reading_final_sayu: { sourceKey: 'reading_final_sayu', label: '최종 독서사유', riskLevel: 'low', safetyMode: 'reflection', externalDataPolicy: 'record_first', systemGuide: '누적 독서사유의 최종 결과를 바탕으로 반복 관심사와 적용점을 정리한다.' },
  garden_sayu: { sourceKey: 'garden_sayu', label: '텃밭일지', riskLevel: 'medium', safetyMode: 'plant_basic', externalDataPolicy: 'conditional_external', systemGuide: '텃밭 기록을 바탕으로 관찰된 상태와 다음 관리 행동을 참고용으로 정리한다.' },
  pet_sayu: { sourceKey: 'pet_sayu', label: '애완동물관찰일지', riskLevel: 'medium', safetyMode: 'medical_basic', externalDataPolicy: 'conditional_external', systemGuide: '반려동물 기록을 바탕으로 관찰 내용을 정리하되 진단, 치료, 약 복용 판단은 하지 않는다.' },
  child_sayu: { sourceKey: 'child_sayu', label: '육아일기', riskLevel: 'medium', safetyMode: 'medical_basic', externalDataPolicy: 'conditional_external', systemGuide: '아이 기록과 보호자의 관찰을 정리하되 발달, 질병, 치료 판단은 단정하지 않는다.' },
  growth_sayu: { sourceKey: 'growth_sayu', label: '성장기록', riskLevel: 'medium', safetyMode: 'timeline_basic', externalDataPolicy: 'conditional_external', systemGuide: '성장 측정 기록의 변화 흐름을 설명하되 건강·발달 진단은 하지 않는다.' },
  memo_sayu: { sourceKey: 'memo_sayu', label: '메모', riskLevel: 'low', safetyMode: 'report', externalDataPolicy: 'record_first', systemGuide: '메모를 실행 가능한 항목과 확인할 점으로 간결하게 정리한다.' },
  stock_sayu: { sourceKey: 'stock_sayu', label: 'HARU주식관리', riskLevel: 'high', safetyMode: 'finance_basic', externalDataPolicy: 'current_data_required', systemGuide: '주식 기록을 바탕으로 매매 판단을 정리하되 수익 보장, 매수·매도 단정, 현재 가격·뉴스 추측을 금지한다.' },
  ledger_sayu: { sourceKey: 'ledger_sayu', label: 'HARU보조장부', riskLevel: 'medium', safetyMode: 'report', externalDataPolicy: 'record_first', systemGuide: '보조장부 기록을 바탕으로 분류, 누락 가능성, 업무 관련 메모를 정리한다. 세무 판단을 확정하지 않는다.' },
  household_sayu: { sourceKey: 'household_sayu', label: 'HARU가계부', riskLevel: 'medium', safetyMode: 'finance_basic', externalDataPolicy: 'record_first', systemGuide: '가계부 기록을 바탕으로 지출 흐름과 다음 점검 항목을 정리한다. 금융·세무 결정을 단정하지 않는다.' },
  voiding_sayu: { sourceKey: 'voiding_sayu', label: '배뇨일지', riskLevel: 'medium', safetyMode: 'medical_basic', externalDataPolicy: 'record_first', systemGuide: '이미 계산된 배뇨 패턴 수치(총 음료섭취량, 총 배뇨량, 주간·야간 배뇨량, 야간뇨 비율, 배뇨 횟수)를 그대로 인용해 하루 흐름을 간결히 정리한다. 수치를 스스로 합산·재계산하지 않는다. 야간다뇨 여부, 질환명, 치료·투약 관련 판단은 하지 않으며 참고용 정리임을 유지한다.' },
  plantDetective: { sourceKey: 'plantDetective', label: '하루식물탐정', riskLevel: 'medium', safetyMode: 'plant_basic', externalDataPolicy: 'conditional_external', systemGuide: '식물 판독 결과와 사용자 메모를 바탕으로 식물 관리 참고 의견을 제공한다.' },
  haruraw_sayu: { sourceKey: 'haruraw_sayu', label: '하루LAW', riskLevel: 'high', safetyMode: 'legal_basic', externalDataPolicy: 'official_source_first', systemGuide: ['기록된 질문과 관련 법조문 범위 안에서만 참고 정보를 정리한다. 법률 판단 AI가 아니라 생활 법률 대응 비서처럼, 지금 확인된 사실·아직 모르는 사실·지금 할 일을 사용자가 바로 구분할 수 있게 안내한다.', HARULAW_RESPONSE_STRUCTURE_GUIDE, '위법 여부나 승소 가능성을 단정하지 않고, 확인이 필요한 쟁점과 준비할 자료 중심으로 안내하며 전문가 상담 권유를 유지한다.'].join('\n') },
  growthTimeline: { sourceKey: 'growthTimeline', label: 'HARU타임라인', riskLevel: 'medium', safetyMode: 'timeline_basic', externalDataPolicy: 'record_first', systemGuide: '타임라인 결과의 시간 흐름과 관찰 포인트를 기록 안에서만 정리한다.' },
};

function normalizeResultChatQuestion(question: string): string {
  return String(question || '').trim().replace(/\s+/g, ' ');
}

function hasAnyResultChatPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const RESULT_CHAT_RECORD_ONLY_PATTERNS = [
  /이\s*(기록|결과|내용|대화)/,
  /현재\s*(기록|결과|대화|내용)/,
  /기록에서/,
  /지금까지\s*(나눈|대화|내용|질문|답변)/,
  /오늘\s*(내\s*)?(감정|기분|마음|하루|일기|생각)/,
  /(핵심|요약|정리|감정\s*흐름|우선순위|다음\s*(행동|할\s*일|계획)|제목|쉽게|표로|목록|문장|다듬|누락|미룬\s*일|기억할\s*장면|추억\s*글|삶의\s*적용|반복\s*관심사|사진별\s*차이|변화\s*흐름)/,
  /(준비할\s*서류|챙겨야\s*할\s*자료|확인할\s*쟁점|관련\s*기록)/,
];
const RESULT_CHAT_CURRENT_FACT_PATTERNS = [
  /오늘(?!\s*(내\s*)?(감정|기분|마음|하루|일기|생각))/,
  /현재(?!\s*(기록|결과|대화|내용|내|이\s*기록))/,
  /지금(?!까지)/,
  /최신|최근|변경|바뀌|개정|가격|시세|날씨|운영\s*시간|영업\s*시간|일정|판례|법령|조항|공시|뉴스|부작용|복용법|예방접종\s*기준|하락한\s*이유|상승한\s*이유/,
];
const RESULT_CHAT_HIGH_RISK_PATTERNS = [
  /(약|복용|처방|용량|치료|진단|수술|응급실|증상).*(끊|중단|바꿔|변경|늘려|줄여|괜찮|필요\s*없|안\s*가도)/,
  /(끊어도|중단해도|응급실에\s*갈\s*필요가\s*없|병원에\s*안\s*가도)/,
  /(승소|패소|이기나|이길\s*수|반드시\s*이길|질까|유죄|무죄|위법\s*여부|소송에서\s*이기|처벌\s*되|고소하면\s*이기)/,
  /(지금\s*)?(사야|팔아|매수|매도|손절|익절|투자해도|수익\s*보장|반드시\s*수익)/,
];
const RESULT_CHAT_AMBIGUOUS_EXTERNAL_PATTERNS = [
  /(물|비료|햇빛|분갈이|가지치기).*(얼마|언제|어떻게|줘|주면|해야)/,
  /(상태|성장|건강).*(어떤\s*것\s*같|괜찮|문제)/,
  /(다음\s*여행지|여행지\s*추천|코스\s*추천|어디가\s*좋)/,
  /(추천|좋을까|괜찮을까|어떻게\s*해야\s*할까)/,
];

function classifyResultChatByRules(question: string, policy: ResultChatSourcePolicy): ResultChatClassification | null {
  const normalized = normalizeResultChatQuestion(question);
  if (!normalized) return { route: 'record_only', reasonCode: 'record_analysis', confidence: 1 };
  if (hasAnyResultChatPattern(normalized, RESULT_CHAT_HIGH_RISK_PATTERNS)) {
    return { route: 'high_risk_guidance', reasonCode: 'high_risk', confidence: 0.9 };
  }
  if (hasAnyResultChatPattern(normalized, RESULT_CHAT_RECORD_ONLY_PATTERNS)) {
    return { route: 'record_only', reasonCode: 'record_analysis', confidence: 0.88 };
  }
  if (hasAnyResultChatPattern(normalized, RESULT_CHAT_CURRENT_FACT_PATTERNS)) {
    return {
      route: 'web_search',
      reasonCode: policy.externalDataPolicy === 'official_source_first' ? 'official_data' : 'current_fact',
      confidence: 0.84,
    };
  }
  if (
    (policy.externalDataPolicy === 'conditional_external' || policy.externalDataPolicy === 'current_data_required') &&
    hasAnyResultChatPattern(normalized, RESULT_CHAT_AMBIGUOUS_EXTERNAL_PATTERNS)
  ) {
    return { route: 'ambiguous', reasonCode: 'unclear', confidence: 0.72 };
  }
  if (policy.externalDataPolicy === 'current_data_required') {
    return { route: 'ambiguous', reasonCode: 'unclear', confidence: 0.62 };
  }
  if (/어떻게|왜|어때|좋아|추천|가능|필요/.test(normalized) && normalized.length <= 80) {
    return null;
  }
  return { route: 'record_only', reasonCode: 'record_analysis', confidence: 0.82 };
}

function coerceClassifierRoute(value: unknown): ResultAnswerRoute {
  const route = String(value || '').trim();
  if (route === 'record_only' || route === 'professional_api' || route === 'web_search' || route === 'ambiguous' || route === 'high_risk_guidance') return route;
  return 'ambiguous';
}

function coerceUserPlan(value: unknown): UserPlan {
  const plan = String(value || '').toLowerCase();
  if (plan === 'developer' || plan === 'premium' || plan === 'basic') return plan;
  return 'free';
}

function getGeminiUsage(result: any): { inputTokens: number | null; outputTokens: number | null } {
  const usage = result?.response?.usageMetadata || result?.usageMetadata || {};
  const inputTokens = Number(usage.promptTokenCount);
  const outputTokens = Number(usage.candidatesTokenCount);
  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : null,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : null,
  };
}

function getAiUsageErrorCode(error: any): string {
  if (typeof error?.code === 'string' && error.code.trim()) return error.code.slice(0, 120);
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.slice(0, 120);
  return 'unknown';
}

function createAiUsageRequestId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

const KAKAO_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/kakaoCallback';
const NAVER_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/naverCallback';
const GOOGLE_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/googleCallback';
const HARU_DRIVE_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/haruDriveCallback';
const ONEDRIVE_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/oneDriveCallback';
const ONEDRIVE_OAUTH_SCOPE = 'offline_access Files.ReadWrite User.Read';

const db = admin.firestore();
const HARU_PORTONE_STORE_ID = 'store-d9310c4a-b5e8-4f6e-9e92-88e6b119e838';
const HARU_INICIS_PROVIDER = 'kg_inicis';
const HARU_INICIS_CARD_PAY_METHOD = 'kg_inicis_card';
const HARU_KAKAOPAY_PROVIDER = 'kakaopay';
const HARU_KAKAOPAY_PAY_METHOD = 'kakaopay_easy_pay';
type HaruPaymentProvider = typeof HARU_INICIS_PROVIDER | typeof HARU_KAKAOPAY_PROVIDER;
type HaruPaidPlan = 'basic' | 'premium';
const PAYMENT_REQUEST_TTL_MS = 30 * 60 * 1000;
const SUBSCRIPTION_PLANS: Record<number, 'basic' | 'premium'> = {
  4000: 'basic',
  6000: 'premium',
};
const SINGLE_PAYMENT_REVIEW_PRODUCT = {
  orderName: 'HARU2026 1개월 이용권',
  durationDays: 30,
  plans: {
    basic: {
      orderName: 'HARU2026 베이직 1개월 이용권',
      amount: 4000,
    },
    premium: {
      orderName: 'HARU2026 프리미엄 1개월 이용권',
      amount: 6000,
    },
  },
};
const HARU_LAW_SHARE_DISCLAIMER = '본 내용은 법령 정보 제공 목적이며, 전문적인 법률·세무 자문을 대체하지 않습니다.\n구체적인 사건은 관련 자료를 가지고 전문가 상담을 받으시기 바랍니다.';
const HARU_LAW_SHARE_PREVIEW_TTL_MS = 30 * 60 * 1000;
const HARU_LAW_SHARE_DAILY_PREVIEW_LIMIT = 3;

function addOneMonth(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function getSubscriptionPlanAmount(plan: string): number {
  return plan === 'basic' ? 4000 : 6000;
}

function getSubscriptionOrderName(plan: string): string {
  return plan === 'basic' ? 'HARU2026 베이직 1개월 정기구독' : 'HARU2026 프리미엄 1개월 정기구독';
}

function buildSubscriptionBillingRequestResponse(params: {
  uid: string;
  issueId: string;
  plan: HaruPaidPlan;
  provider: HaruPaymentProvider;
  status: string;
  existing?: boolean;
}) {
  const payMethod = getProviderPayMethod(params.provider);
  const amount = getSubscriptionPlanAmount(params.plan);
  const issueName = getSubscriptionOrderName(params.plan);
  return {
    issueId: params.issueId,
    storeId: HARU_PORTONE_STORE_ID,
    issueName,
    amount,
    currency: 'KRW',
    status: params.status,
    existing: params.existing === true,
    customData: {
      uid: params.uid,
      plan: params.plan,
      provider: params.provider,
      payMethod,
      paymentType: 'subscription',
      billingType: 'billing_key_issue',
    },
  };
}

function isHaruPaymentProvider(provider: unknown): provider is HaruPaymentProvider {
  return provider === HARU_INICIS_PROVIDER || provider === HARU_KAKAOPAY_PROVIDER;
}

function getRequestedPaymentProvider(
  provider: unknown,
  fallback: HaruPaymentProvider = HARU_KAKAOPAY_PROVIDER
): HaruPaymentProvider {
  return isHaruPaymentProvider(provider) ? provider : fallback;
}

function getStoredPaymentProvider(data: any): HaruPaymentProvider | null {
  if (isHaruPaymentProvider(data?.provider)) return data.provider;
  if (data?.payMethod === HARU_INICIS_CARD_PAY_METHOD) return HARU_INICIS_PROVIDER;
  if (data?.payMethod === HARU_KAKAOPAY_PAY_METHOD) return HARU_KAKAOPAY_PROVIDER;
  return null;
}

function getProviderPayMethod(provider: HaruPaymentProvider): string {
  return provider === HARU_INICIS_PROVIDER ? HARU_INICIS_CARD_PAY_METHOD : HARU_KAKAOPAY_PAY_METHOD;
}

function getStoredPayMethod(data: any, provider: HaruPaymentProvider): string {
  const payMethod = typeof data?.payMethod === 'string' ? data.payMethod.trim() : '';
  if (provider === HARU_INICIS_PROVIDER && payMethod === HARU_INICIS_CARD_PAY_METHOD) {
    return payMethod;
  }
  if (provider === HARU_KAKAOPAY_PROVIDER && payMethod === HARU_KAKAOPAY_PAY_METHOD) {
    return payMethod;
  }
  return getProviderPayMethod(provider);
}

function getProviderLogLabel(provider: HaruPaymentProvider): string {
  return provider === HARU_INICIS_PROVIDER ? 'KG이니시스' : '카카오페이';
}

function assertPaidPlan(plan: unknown): 'basic' | 'premium' {
  if (plan !== 'basic' && plan !== 'premium') {
    throw new HttpsError('invalid-argument', 'plan 값이 올바르지 않습니다.');
  }
  return plan;
}

function createPortOneRequestId(prefix: string): string {
  return `haru-${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function parsePortOneCustomData(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getPaymentAmountTotal(payment: any): number {
  return Number(payment?.amount?.total ?? payment?.totalAmount ?? 0);
}

function getPaymentMethodLabel(payment: any): string | null {
  const method = payment?.method;
  if (!method || typeof method !== 'object') return null;
  const easyPayProvider = method.easyPay?.provider || method.easyPayProvider;
  const type = method.type || method.methodType || method.pgProvider;
  return [type, easyPayProvider].filter(Boolean).join(':') || null;
}

function assertPaymentMatchesRequest(payment: any, requestData: any) {
  if (payment?.storeId && payment.storeId !== HARU_PORTONE_STORE_ID) {
    throw new HttpsError('invalid-argument', '결제 상점 정보가 올바르지 않습니다.');
  }
  if (payment?.currency && payment.currency !== 'KRW') {
    throw new HttpsError('invalid-argument', '결제 통화가 올바르지 않습니다.');
  }
  if (getPaymentAmountTotal(payment) !== requestData.amount) {
    logger.error('결제 금액 불일치:', {
      paymentId: maskPaymentId(requestData.paymentId || requestData.id || ''),
      expected: requestData.amount,
      actual: getPaymentAmountTotal(payment),
    });
    throw new HttpsError('invalid-argument', '결제 금액이 올바르지 않습니다.');
  }
  const orderName = typeof payment?.orderName === 'string' ? payment.orderName : '';
  if (orderName && orderName !== requestData.orderName) {
    throw new HttpsError('invalid-argument', '결제 상품명이 올바르지 않습니다.');
  }
  const customData = parsePortOneCustomData(payment?.customData);
  if (customData.uid && customData.uid !== requestData.uid) {
    throw new HttpsError('invalid-argument', '결제 사용자 정보가 올바르지 않습니다.');
  }
  if (customData.plan && customData.plan !== requestData.plan) {
    throw new HttpsError('invalid-argument', '결제 요금제 정보가 올바르지 않습니다.');
  }
  if (customData.paymentType && customData.paymentType !== requestData.paymentType) {
    throw new HttpsError('invalid-argument', '결제 유형 정보가 올바르지 않습니다.');
  }
  if (customData.provider && requestData.provider && customData.provider !== requestData.provider) {
    throw new HttpsError('invalid-argument', '결제수단 정보가 올바르지 않습니다.');
  }
  if (customData.billingType && requestData.billingType && customData.billingType !== requestData.billingType) {
    throw new HttpsError('invalid-argument', '결제 방식 정보가 올바르지 않습니다.');
  }
}

function getPaymentRequestRef(id: string) {
  return db.doc(`paymentRequests/${id}`);
}

function getSubscriptionPaymentLockRef(uid: string) {
  return db.doc(`subscriptionPaymentLocks/${uid}`);
}

function getWebhookEventId(webhook: any, paymentId: string): string {
  const base = [
    webhook?.type || 'unknown',
    webhook?.timestamp || '',
    paymentId,
    webhook?.data?.transactionId || webhook?.data?.cancellationId || '',
  ].join(':');
  return crypto.createHash('sha256').update(base).digest('hex');
}

function isFinalFailedPaymentStatus(status: string): boolean {
  return [
    'FAILED',
    'CANCELLED',
    'PARTIAL_CANCELLED',
    'PAY_PENDING',
    'READY',
    'VIRTUAL_ACCOUNT_ISSUED',
  ].includes(status);
}

function isFailedOrCancelledPaymentStatus(status: string): boolean {
  return ['FAILED', 'CANCELLED', 'PARTIAL_CANCELLED'].includes(status);
}

function normalizePaymentRequestStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

function isActiveSubscriptionData(data: any, nowMs: number): boolean {
  if (data?.status !== 'active') return false;
  const endDate = typeof data?.endDate === 'string' ? Date.parse(data.endDate) : NaN;
  return Number.isNaN(endDate) || endDate > nowMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskPaymentId(paymentId: string): string {
  if (paymentId.length <= 12) return `${paymentId.slice(0, 3)}***`;
  return `${paymentId.slice(0, 10)}...${paymentId.slice(-6)}`;
}

function getPortOneLookupError(error: any) {
  const data = error?.response?.data || {};
  return {
    message: error?.message,
    status: error?.response?.status,
    type: typeof data.type === 'string' ? data.type : undefined,
    code: typeof data.code === 'string' ? data.code : undefined,
  };
}

async function fetchPortOnePayment(paymentId: string): Promise<any> {
  const portoneRes = await axios.get(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `PortOne ${PORTONE_API_SECRET.value().trim()}` } }
  );
  return portoneRes.data;
}

async function fetchPortOnePaymentWithRetry(paymentId: string): Promise<any> {
  const delaysMs = [0, 600, 1400, 2500];
  let lastError: any;

  for (const delayMs of delaysMs) {
    if (delayMs > 0) await sleep(delayMs);
    try {
      return await fetchPortOnePayment(paymentId);
    } catch (error: any) {
      lastError = error;
      const type = error?.response?.data?.type;
      if (type !== 'PAYMENT_NOT_FOUND') break;
    }
  }

  throw lastError;
}

type InitialBillingCompletionParams = {
  uid: string;
  issueId: string;
  paymentId: string;
  billingKey: string;
  customer: SubscriptionBillingCustomer;
  plan: HaruPaidPlan;
  provider: HaruPaymentProvider;
  payMethod: string;
  amount: number;
  orderName: string;
  payment: any;
  requestRef: FirebaseFirestore.DocumentReference;
  paymentRef: FirebaseFirestore.DocumentReference;
  lockRef: FirebaseFirestore.DocumentReference;
};

async function isInitialBillingSubscriptionAlreadyProcessed(params: {
  uid: string;
  paymentId: string;
  plan: HaruPaidPlan;
  provider: HaruPaymentProvider;
  requestRef: FirebaseFirestore.DocumentReference;
  paymentRef: FirebaseFirestore.DocumentReference;
}): Promise<boolean> {
  const [requestSnap, paymentSnap, subscriptionSnap, billingSnap] = await Promise.all([
    params.requestRef.get(),
    params.paymentRef.get(),
    db.doc(`users/${params.uid}/subscription/info`).get(),
    db.doc(`billingSubscriptions/${params.uid}`).get(),
  ]);
  const requestData = requestSnap.data() || {};
  const paymentData = paymentSnap.data() || {};
  const subscriptionData = subscriptionSnap.data() || {};
  const billingData = billingSnap.data() || {};

  return requestData.status === 'processed'
    && requestData.uid === params.uid
    && requestData.plan === params.plan
    && requestData.lastPaymentId === params.paymentId
    && getStoredPaymentProvider(requestData) === params.provider
    && paymentData.status === 'processed'
    && paymentData.uid === params.uid
    && paymentData.plan === params.plan
    && paymentData.issueId === requestData.issueId
    && getStoredPaymentProvider(paymentData) === params.provider
    && subscriptionData.status === 'active'
    && subscriptionData.plan === params.plan
    && subscriptionData.paymentType === 'subscription'
    && subscriptionData.lastPaymentId === params.paymentId
    && billingData.status === 'active'
    && billingData.plan === params.plan
    && billingData.lastPaymentId === params.paymentId;
}

async function completeInitialBillingSubscription(params: InitialBillingCompletionParams): Promise<{ alreadyProcessed: boolean }> {
  const now = new Date();
  const nextBillingDate = addOneMonth(now);
  const nowIso = now.toISOString();
  const subRef = db.doc(`users/${params.uid}/subscription/info`);
  const billingRef = db.doc(`billingSubscriptions/${params.uid}`);
  const lockRef = params.lockRef;
  let alreadyProcessed = false;

  await db.runTransaction(async (tx) => {
    const [freshRequest, freshPayment, freshSubscription, freshBilling, freshLock] = await Promise.all([
      tx.get(params.requestRef),
      tx.get(params.paymentRef),
      tx.get(subRef),
      tx.get(billingRef),
      tx.get(lockRef),
    ]);
    const requestData = freshRequest.data() || {};
    const paymentData = freshPayment.data() || {};
    const subscriptionData = freshSubscription.data() || {};
    const billingData = freshBilling.data() || {};
    const requestProvider = getStoredPaymentProvider(requestData);
    const paymentProvider = getStoredPaymentProvider(paymentData);
    const lockData = freshLock.data() || {};

    if (
      requestData.uid !== params.uid
      || requestData.plan !== params.plan
      || requestData.paymentType !== 'subscription'
      || requestData.billingType !== 'billing_key_issue'
      || requestProvider !== params.provider
      || requestData.lastPaymentId !== params.paymentId
    ) {
      throw new HttpsError('permission-denied', '빌링키 발급 요청 정보가 올바르지 않습니다.');
    }
    if (
      freshLock.exists
      && (lockData.uid !== params.uid || lockData.issueId !== params.issueId)
    ) {
      throw new HttpsError('permission-denied', '초기 구독 결제 잠금 정보가 올바르지 않습니다.');
    }
    if (
      !freshPayment.exists
      || paymentData.uid !== params.uid
      || paymentData.issueId !== params.issueId
      || paymentData.plan !== params.plan
      || paymentData.paymentType !== 'subscription'
      || paymentData.billingType !== 'initial_billing'
      || paymentProvider !== params.provider
    ) {
      throw new HttpsError('failed-precondition', '첫 결제 요청 정보가 올바르지 않습니다.');
    }

    const subscriptionAlreadyActive =
      requestData.status === 'processed'
      && paymentData.status === 'processed'
      && subscriptionData.status === 'active'
      && subscriptionData.plan === params.plan
      && subscriptionData.paymentType === 'subscription'
      && subscriptionData.lastPaymentId === params.paymentId
      && billingData.status === 'active'
      && billingData.plan === params.plan
      && billingData.lastPaymentId === params.paymentId;

    if (subscriptionAlreadyActive) {
      alreadyProcessed = true;
      return;
    }

    tx.set(subRef, {
      plan: params.plan,
      status: 'active',
      paymentType: 'subscription',
      billingType: 'recurring',
      autoRenew: true,
      payMethod: params.payMethod,
      startDate: nowIso,
      endDate: nextBillingDate.toISOString(),
      nextBillingDate: nextBillingDate.toISOString(),
      paymentId: params.paymentId,
      lastPaymentId: params.paymentId,
      lastPaidAmount: params.amount,
      provider: params.provider,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(billingRef, {
      uid: params.uid,
      plan: params.plan,
      status: 'active',
      billingKey: params.billingKey,
      customer: params.customer,
      payMethod: params.payMethod,
      provider: params.provider,
      amount: params.amount,
      orderName: params.orderName,
      startDate: nowIso,
      endDate: nextBillingDate.toISOString(),
      nextBillingDate: nextBillingDate.toISOString(),
      lastPaymentId: params.paymentId,
      lastPaidAt: nowIso,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(params.requestRef, {
      status: 'processed',
      lastPaymentId: params.paymentId,
      billingKey: admin.firestore.FieldValue.delete(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(params.paymentRef, {
      status: 'processed',
      portoneStatus: params.payment?.status || 'PAID',
      paymentMethod: getPaymentMethodLabel(params.payment),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    if (freshLock.exists) {
      tx.delete(lockRef);
    }
  });

  return { alreadyProcessed };
}

async function markInitialBillingPaymentPending(
  requestRef: FirebaseFirestore.DocumentReference,
  paymentRef: FirebaseFirestore.DocumentReference,
  portoneStatus: string,
  lockRef?: FirebaseFirestore.DocumentReference
) {
  const writes = [
    requestRef.set({
      status: 'charging',
      portoneStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),
    paymentRef.set({
      status: 'pending',
      portoneStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),
  ];
  if (lockRef) {
    writes.push(lockRef.set({
      status: 'charging',
      portoneStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }));
  }
  await Promise.all(writes);
}

async function markInitialBillingPaymentFailed(
  requestRef: FirebaseFirestore.DocumentReference,
  paymentRef: FirebaseFirestore.DocumentReference,
  portoneStatus: string,
  lockRef?: FirebaseFirestore.DocumentReference
) {
  const writes = [
    requestRef.set({
      status: 'failed',
      portoneStatus,
      billingKey: admin.firestore.FieldValue.delete(),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),
    paymentRef.set({
      status: 'failed',
      portoneStatus,
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),
  ];
  if (lockRef) {
    writes.push(lockRef.delete());
  }
  await Promise.all(writes);
}

async function markSubscriptionBillingRequestPreflightFailed(
  requestRef: FirebaseFirestore.DocumentReference,
  lockRef: FirebaseFirestore.DocumentReference,
  reason: string
) {
  await Promise.all([
    requestRef.set({
      status: 'failed',
      portoneStatus: 'NOT_REQUESTED',
      lastBillingError: reason,
      billingKey: admin.firestore.FieldValue.delete(),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),
    lockRef.delete(),
  ]);
}

async function settleInitialBillingPayment(params: InitialBillingCompletionParams) {
  const paymentSnap = await params.paymentRef.get();
  if (!paymentSnap.exists) {
    throw new HttpsError('failed-precondition', '첫 결제 요청 정보를 찾을 수 없습니다.');
  }
  const paymentData = paymentSnap.data() || {};
  const paymentProvider = getStoredPaymentProvider(paymentData);
  if (
    paymentData.uid !== params.uid
    || paymentData.issueId !== params.issueId
    || paymentData.plan !== params.plan
    || paymentData.paymentType !== 'subscription'
    || paymentData.billingType !== 'initial_billing'
    || paymentProvider !== params.provider
  ) {
    throw new HttpsError('permission-denied', '첫 결제 요청 정보가 올바르지 않습니다.');
  }

  const portoneStatus = typeof params.payment?.status === 'string' ? params.payment.status : 'UNKNOWN';

  if (portoneStatus === 'PAID') {
    assertPaymentMatchesRequest(params.payment, paymentData);
    const completion = await completeInitialBillingSubscription(params);
    return completion.alreadyProcessed
      ? { success: true, alreadyProcessed: true }
      : { success: true };
  }

  if (isFailedOrCancelledPaymentStatus(portoneStatus)) {
    await markInitialBillingPaymentFailed(params.requestRef, params.paymentRef, portoneStatus, params.lockRef);
    throw new HttpsError('failed-precondition', '첫 결제가 실패 또는 취소되었습니다.');
  }

  await markInitialBillingPaymentPending(params.requestRef, params.paymentRef, portoneStatus, params.lockRef);
  return { success: false, pending: true, status: portoneStatus };
}

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

function getSafeOAuthError(error: any) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data || {};
    return {
      message: error.message,
      status: error.response?.status,
      providerError: typeof data.error === 'string' ? data.error : undefined,
      providerErrorCode: typeof data.error_code === 'string' ? data.error_code : undefined,
      providerErrorDescription: typeof data.error_description === 'string'
        ? data.error_description.slice(0, 120)
        : undefined,
    };
  }

  return {
    message: error?.message || String(error),
  };
}

function parseCoordinate(value: unknown, label: string): number {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(numeric)) {
    throw new HttpsError('invalid-argument', `${label} 좌표가 올바르지 않습니다`);
  }
  return numeric;
}

function buildKakaoRegionLabel(doc: any): string {
  return [
    doc?.region_1depth_name,
    doc?.region_2depth_name,
    doc?.region_3depth_name,
  ]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ');
}

function getSafeKakaoLocalError(error: any) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data || {};
    return {
      message: error.message,
      status: error.response?.status,
      code: error.code,
      kakaoErrorType: typeof data.errorType === 'string' ? data.errorType : undefined,
      kakaoMessage: typeof data.message === 'string' ? data.message.slice(0, 120) : undefined,
    };
  }

  return {
    message: error?.message || String(error),
  };
}

// 좌표 주변 장소명(POI) 후보 조회 — 호텔/관광지/문화시설/음식점/카페 등
// (예: 경주나한호텔, 롯데호텔). 행정구역·주소만으로는 부족한 경우를 보완한다.
const KAKAO_POI_CATEGORY_CODES = ['AD5', 'AT4', 'CT1', 'FD6', 'CE7'];
const KAKAO_POI_RADIUS_M = 100;

async function lookupKakaoNearbyPlace(
  headers: Record<string, string>,
  x: string,
  y: string
): Promise<{ placeName: string; placeCategory: string } | null> {
  try {
    const responses = await Promise.all(
      KAKAO_POI_CATEGORY_CODES.map((code) =>
        axios
          .get('https://dapi.kakao.com/v2/local/search/category.json', {
            params: {
              category_group_code: code,
              x,
              y,
              radius: KAKAO_POI_RADIUS_M,
              sort: 'distance',
              size: 5,
            },
            headers,
            timeout: 8000,
          })
          .catch(() => null)
      )
    );

    let nearest: { name: string; category: string; distance: number } | null = null;
    for (const resp of responses) {
      const docs = Array.isArray(resp?.data?.documents) ? resp!.data.documents : [];
      for (const doc of docs) {
        const name = typeof doc?.place_name === 'string' ? doc.place_name.trim() : '';
        if (!name) continue;
        const parsed = Number(doc?.distance);
        const distance = Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
        if (!nearest || distance < nearest.distance) {
          nearest = {
            name,
            category: typeof doc?.category_group_name === 'string' ? doc.category_group_name : '',
            distance,
          };
        }
      }
    }

    if (!nearest) return null;
    return { placeName: nearest.name, placeCategory: nearest.category };
  } catch (error: any) {
    logger.warn('카카오 장소명 조회 실패:', getSafeKakaoLocalError(error));
    return null;
  }
}

export const reverseGeocodeKakao = onCall(
  {
    region: 'asia-northeast3',
    secrets: [KAKAO_REST_API_KEY_SECRET],
    timeoutSeconds: 15,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const latitude = parseCoordinate(request.data?.latitude, 'latitude');
    const longitude = parseCoordinate(request.data?.longitude, 'longitude');

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new HttpsError('invalid-argument', '좌표 범위가 올바르지 않습니다');
    }

    const headers = {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY_SECRET.value().trim()}`,
      Accept: 'application/json',
    };
    const params = { x: String(longitude), y: String(latitude) };

    try {
      const [regionResp, addressResp, placeInfo] = await Promise.all([
        axios.get('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json', {
          params,
          headers,
          timeout: 8000,
        }),
        axios.get('https://dapi.kakao.com/v2/local/geo/coord2address.json', {
          params,
          headers,
          timeout: 8000,
        }),
        lookupKakaoNearbyPlace(headers, params.x, params.y),
      ]);

      const regionDocs = Array.isArray(regionResp.data?.documents) ? regionResp.data.documents : [];
      const addressDocs = Array.isArray(addressResp.data?.documents) ? addressResp.data.documents : [];
      const regionDoc = regionDocs.find((doc: any) => doc?.region_type === 'H') || regionDocs[0] || null;
      const addressDoc = addressDocs[0] || null;
      const roadAddress = addressDoc?.road_address?.address_name || '';
      const jibunAddress = addressDoc?.address?.address_name || '';
      const regionLabel = buildKakaoRegionLabel(regionDoc);

      if (!regionLabel && !roadAddress && !jibunAddress) {
        return {
          success: false,
          reason: 'not_found',
          latitude,
          longitude,
        };
      }

      return {
        success: true,
        latitude,
        longitude,
        placeName: placeInfo?.placeName || '',
        placeCategory: placeInfo?.placeCategory || '',
        regionLabel,
        roadAddress,
        jibunAddress,
        region: regionDoc
          ? {
              sido: regionDoc.region_1depth_name || '',
              sigungu: regionDoc.region_2depth_name || '',
              eupmyeondong: regionDoc.region_3depth_name || '',
              regionType: regionDoc.region_type || '',
            }
          : null,
      };
    } catch (error: any) {
      logger.warn('카카오 좌표 주소 변환 실패:', getSafeKakaoLocalError(error));
      return {
        success: false,
        reason: 'kakao_api_error',
        latitude,
        longitude,
      };
    }
  }
);

function normalizeReadingBookField(s: unknown): string {
  return String(s || '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function makeReadingBookIdForFunction(title: string, author: string): string {
  const t = normalizeReadingBookField(title);
  const a = normalizeReadingBookField(author);
  if (!t && !a) return '';
  const key = `${t}|${a}`;
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = ((h1 << 5) + h1) ^ c;
    h2 = ((h2 << 5) + h2) + c;
    h1 = h1 >>> 0;
    h2 = h2 >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16);
  return `reading_${hex}`;
}

// ===== 🔑 이메일 기반 통합 UID 생성/조회 함수 (기존 UID 우선) =====
async function getOrCreateUnifiedUid(email: string, provider: string): Promise<string> {
  try {
    // 1. 이메일을 정규화 (소문자, 공백 제거)
    const normalizedEmail = email.toLowerCase().trim();
    
    // 2. Firestore에서 이메일 → UID 매핑 확인
    const emailDoc = await db.collection('email_to_uid').doc(normalizedEmail).get();
    
    if (emailDoc.exists) {
      // 기존 매핑 반환
      const data = emailDoc.data();
      console.log(`✅ 매핑된 UID 사용: ${data?.uid} (이메일: ${normalizedEmail})`);
      return data?.uid as string;
    }
    
    // 3. 기존 사용자 데이터 검색 (naver_xxx, kakao_xxx, BBPe... 등)
    console.log(`🔍 기존 사용자 검색 중... (이메일: ${normalizedEmail})`);
    
    try {
      // Firebase Auth에서 이메일로 사용자 검색
      const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
      
      if (userRecord && userRecord.uid) {
        console.log(`✅ 기존 UID 발견: ${userRecord.uid} (이메일: ${normalizedEmail})`);
        
        // 매핑 저장
        await db.collection('email_to_uid').doc(normalizedEmail).set({
          uid: userRecord.uid,
          email: normalizedEmail,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          migratedFrom: provider,
          originalUid: userRecord.uid,
        });
        
        return userRecord.uid;
      }
    } catch (authError: any) {
      if (authError.code !== 'auth/user-not-found') {
        console.error('Firebase Auth 검색 오류:', authError);
      }
      // 사용자 없음 - 계속 진행
    }
    
    // 4. 정말 새 사용자 - 통합 UID 생성 (이메일 SHA256 해시 기반)
    const hash = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    const unifiedUid = `unified_${hash.substring(0, 28)}`; // Firebase UID 길이 제한 고려
    
    // 5. Firestore에 매핑 저장
    await db.collection('email_to_uid').doc(normalizedEmail).set({
      uid: unifiedUid,
      email: normalizedEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      firstProvider: provider,
    });
    
    console.log(`✨ 새 통합 UID 생성: ${unifiedUid} (이메일: ${normalizedEmail}, provider: ${provider})`);
    return unifiedUid;
    
  } catch (error) {
    console.error('❌ 통합 UID 생성/조회 실패:', error);
    throw error;
  }
}

type DrugApiItem = Record<string, any>;

const DRUG_API_BASE_URL =
  'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';

function normalizeDrugSearchTerm(input: string): string {
  return input
    .replace(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)+\s*(?:mg|m|g|ml|mcg|ug|iu|㎎|μg|밀리그램|마이크로그램|그램|밀리리터|%)?/gi, ' ')
    .replace(/\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|ug|iu|㎎|μg|밀리그램|마이크로그램|그램|밀리리터|%)/gi, ' ')
    .replace(/[()[\]{}<>]/g, ' ')
    .replace(/[,:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function encodeServiceKeyForQuery(serviceKey: string): string {
  return /%[0-9A-Fa-f]{2}/.test(serviceKey) ? serviceKey : encodeURIComponent(serviceKey);
}

function readDrugApiItems(data: any): DrugApiItem[] {
  const items = data?.body?.items;
  if (Array.isArray(items)) return items;
  if (Array.isArray(items?.item)) return items.item;
  if (items?.item && typeof items.item === 'object') return [items.item];
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function readDrugTotalCount(data: any, fallback: number): number {
  const totalCount = Number(data?.body?.totalCount ?? data?.totalCount);
  return Number.isFinite(totalCount) ? totalCount : fallback;
}

function readDrugField(item: DrugApiItem, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeDrugApiItem(item: DrugApiItem) {
  return {
    itemSeq: readDrugField(item, ['itemSeq', 'ITEM_SEQ']),
    itemName: readDrugField(item, ['itemName', 'ITEM_NAME']),
    entpName: readDrugField(item, ['entpName', 'ENTP_NAME']),
    ingredient: readDrugField(item, ['ingredient', 'MATERIAL_NAME', 'mainIngredient']),
    category: readDrugField(item, ['category', 'CLASS_NAME', 'className']),
    prescriptionType: readDrugField(item, ['prescriptionType', 'ETC_OTC_CODE', 'etcOtcName']),
    efficacyText: readDrugField(item, ['efficacyText', 'efcyQesitm', 'EE_DOC_DATA']),
    useMethodText: readDrugField(item, ['useMethodText', 'useMethodQesitm', 'UD_DOC_DATA']),
    warningText: readDrugField(item, ['warningText', 'atpnWarnQesitm']),
    cautionText: readDrugField(item, ['cautionText', 'atpnQesitm', 'NB_DOC_DATA']),
    interactionText: readDrugField(item, ['interactionText', 'intrcQesitm']),
    sideEffectText: readDrugField(item, ['sideEffectText', 'seQesitm']),
    source: 'official-drug-api',
    original: item,
  };
}

export const searchOfficialDrugs = onCall(
  {
    region: 'asia-northeast3',
    secrets: [DRUG_API_SERVICE_KEY_SECRET],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const originalInput = typeof request.data?.originalInput === 'string'
      ? request.data.originalInput.trim()
      : '';
    const queryInput = typeof request.data?.query === 'string'
      ? request.data.query.trim()
      : originalInput;
    const query = normalizeDrugSearchTerm(queryInput);

    if (query.length < 2) {
      throw new HttpsError('invalid-argument', '약 이름을 2자 이상 입력해주세요.');
    }

    const serviceKey = DRUG_API_SERVICE_KEY_SECRET.value().trim();
    if (!serviceKey) {
      throw new HttpsError('failed-precondition', '공식 의약품 API 키가 설정되지 않았습니다.');
    }

    const url =
      `${DRUG_API_BASE_URL}?serviceKey=${encodeServiceKeyForQuery(serviceKey)}` +
      `&type=json&pageNo=1&numOfRows=30&itemName=${encodeURIComponent(query)}`;

    try {
      const response = await axios.get(url, {
        timeout: 12000,
        validateStatus: (status) => status >= 200 && status < 500,
      });

      if (response.status >= 400) {
        logger.error('공식 의약품 API 오류 응답:', {
          status: response.status,
          data: response.data,
        });
        throw new HttpsError('internal', '공식 의약품 검색 서버 응답이 올바르지 않습니다.');
      }

      const items = readDrugApiItems(response.data)
        .map(normalizeDrugApiItem)
        .filter((item) => item.itemName);

      return {
        query,
        originalInput,
        totalCount: readDrugTotalCount(response.data, items.length),
        items,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      logger.error('공식 의약품 검색 실패:', {
        message: error?.message,
        response: error?.response?.data,
      });
      throw new HttpsError('internal', '공식 의약품 검색에 실패했습니다.');
    }
  }
);

// ===== 💬 SAYU AI 한마디 프롬프트 생성 =====
function buildAiCommentPrompt(polishedText: string, formatGroup: 'rich' | 'balanced' | 'conservative'): string {
  const toneGuide =
    formatGroup === 'rich'
      ? '감정에 공감하고 따뜻하게 위로하는 친구처럼'
      : formatGroup === 'balanced'
      ? '작은 노력을 알아보고 격려하는 친구처럼'
      : '수고를 인정하고 간결하게 응원하는 친구처럼';

  return `다음 기록을 읽고 ${toneGuide} 짧은 한마디를 남겨줘.

[엄격한 규칙]
- 정확히 1~2문장. 절대 3문장 이상 금지.
- 50자 이내 (한글 기준).
- 존댓말 금지. 친근하고 자연스러운 말투.
- 마크다운·이모지·따옴표·번호 금지. 텍스트만 출력.
- 평가·충고·교훈 금지.
- 칭찬을 과하게 하지 말 것.

[예시 톤]
(일기) "오늘 그런 마음이었구나. 잘 버텼어."
(텃밭) "하나하나 돌보는 손길이 느껴져."
(여행) "그 순간이 눈앞에 그려지는 것 같아."
(업무) "오늘도 수고 많았어."

기록 내용:
${polishedText.slice(0, 500)}`;
}

// ===== 🎨 AI 다듬기 =====
export const polishContent = onCall(
  { 
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET]  // 🔐 Secret 연결
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'polishContent', 10, 60);
    let monthlyQuotaReservation: MonthlyAiQuotaReservation | null = null;
    try {
      const { text, mode = 'premium', format } = request.data;

      if (!text || typeof text !== 'string') {
        throw new HttpsError('invalid-argument', '텍스트가 필요합니다.');
      }
      if (text.length > 5000) {
        throw new HttpsError('invalid-argument', '텍스트는 5000자 이내여야 합니다.');
      }
      monthlyQuotaReservation = await reserveMonthlyAiQuota(request.auth.uid, 'polishContent');

      // SAYU 형식별 3그룹 분기 (2026-05-13 도입)
      // 풍성형: 감성·문학 표현 환영
      // 균형형: 사실+감정 균형
      // 보수형: 사실 중심, 보수적 (디폴트 — 알 수 없는 format도 여기로)
      const RICH_FORMATS = ['diary', 'essay', 'travel'];
      const BALANCED_FORMATS = ['garden', 'pet', 'child'];
      const CONSERVATIVE_FORMATS = ['mission', 'report', 'work', 'memo'];
      const normalizedFormat = typeof format === 'string' ? format.toLowerCase().trim() : '';
      let formatGroup: 'rich' | 'balanced' | 'conservative';
      if (RICH_FORMATS.includes(normalizedFormat)) {
        formatGroup = 'rich';
      } else if (BALANCED_FORMATS.includes(normalizedFormat)) {
        formatGroup = 'balanced';
      } else {
        formatGroup = 'conservative';
      }
      console.log('[polishContent] mode=%s format=%s → group=%s', mode, normalizedFormat || '(empty)', formatGroup);
      if (normalizedFormat && !CONSERVATIVE_FORMATS.includes(normalizedFormat) && formatGroup === 'conservative') {
        console.log('[polishContent] 알 수 없는 format → 보수형 디폴트 적용:', normalizedFormat);
      }

      let systemPrompt = '';

      if (mode === 'BASIC') {
        systemPrompt = `당신은 신중한 편집자입니다.
원문을 최대한 유지하며 맞춤법과 어색한 표현만 교정하세요.
존댓말 유지, 내용 추가 금지, 문단 분리 금지.`;
      } else if (normalizedFormat === 'voiding') {
        // 배뇨일지 — 계산된 수치를 인용해 하루 흐름을 간결히 정리, medical_basic 안전 모드
        systemPrompt = `당신은 건강 기록 요약 도우미입니다.
아래에 제공된 배뇨일지 계산 수치를 그대로 인용해 하루 패턴을 2~3문장으로 간결하고 따뜻하게 요약합니다.

엄격한 금지:
1. 수치를 스스로 합산·재계산하지 않는다. 제공된 숫자만 그대로 사용한다.
2. 야간다뇨, 빈뇨, 질환명, 진단, 치료·투약 판단을 하지 않는다.
3. 과도한 의학적 용어 사용 금지.
4. 소제목, 마크다운 기호, 목록 형식 금지.

마지막 문장에 "이 수치는 참고용 지표이며 진단이 아닙니다."를 자연스럽게 포함하세요.
본문만 자연스럽게 이어지는 문장으로 작성하세요.`;
      } else if (formatGroup === 'rich') {
        // 풍성형 — 일기·에세이·여행기록
        systemPrompt = `당신은 한국 중장년층의 일상을 글로 빚어내는 에세이 작가입니다.
원문의 감정·사실·인물·시간은 절대 바꾸지 않고, 다음을 풍성하게 합니다:
1. 감각 묘사: 시각·청각·후각·촉각·미각 중 어울리는 표현 추가
2. 감정 명료화: 원문에 있는 감정을 더 또렷이 드러내는 비유나 표현
3. 호흡 조정: 짧은 문장과 긴 문장을 섞어 자연스러운 리듬 만들기
4. 회상의 깊이: 사실은 그대로, 그 순간의 의미만 부드럽게 부각

엄격한 금지: 새로운 사건·인물·장소 추가 / 원문에 없는 감정 창작 / 소제목 / 마크다운 기호(**, ##, __, --, >) / 과장된 결론 / 교훈
유지: 존댓말 / 시제 / 인칭 / 사실 관계

본문만 자연스럽게 이어지는 문단으로 작성하세요.`;
      } else if (formatGroup === 'balanced') {
        // 균형형 — 텃밭일지·반려동물·육아일기
        systemPrompt = `당신은 한국 중장년층의 일상 기록을 다듬는 에세이 작가입니다.
원문의 사실·감정·날짜·인물·장소는 그대로 보존하며, 다음을 자연스럽게 다듬습니다:
1. 사실 묘사 정돈: 관찰한 내용을 명확하고 읽기 좋게 정리
2. 감정 보존: 원문에 드러난 따뜻함·기쁨·걱정 등을 자연스럽게 살림
3. 문장 호흡: 자연스러운 리듬으로 다듬기

엄격한 금지: 새로운 사건·관찰·인물 추가 / 원문에 없는 감정 창작 / 시적 비유 과용 / 소제목 / 마크다운 기호 / 교훈
유지: 존댓말 / 시제 / 인칭 / 사실 관계 / 관찰의 객관성

본문만 자연스럽게 이어지는 문단으로 작성하세요.`;
      } else {
        // 보수형 — 선교보고·일반보고·업무일지·메모 (및 디폴트)
        systemPrompt = `당신은 신중한 편집자입니다.
원문의 사실·수치·날짜·인물·결정 사항을 절대 바꾸지 않고, 다음만 다듬습니다:
1. 맞춤법·문법 교정
2. 어색한 표현을 자연스럽게 정리
3. 문장 길이가 너무 길면 적절히 분리

엄격한 금지: 새로운 내용 추가 / 감성적 표현 / 시적 비유 / 소제목 / 마크다운 기호 / 의견 첨가
유지: 존댓말 / 시제 / 인칭 / 사실·수치·날짜 정확성 / 보고서 어조

본문만 자연스럽게 이어지는 문단으로 작성하세요.`;
      }

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());  // 🔐 Secret 값 사용
      const modelName = 'gemini-3.1-flash-lite';
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
      });

      const result = await model.generateContent(text);
      const mainUsage = getGeminiUsage(result);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'sayu_polish',
        plan: AI_USAGE_PLAN,
        model: modelName,
        inputTokens: mainUsage.inputTokens,
        outputTokens: mainUsage.outputTokens,
        imageCount: 0,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      const polishedText = result.response.text();

      // ===== 통계 분석 (모든 형식) =====
      let stats = null;
      if (format) {
        stats = await analyzeStats(text, format, GEMINI_API_KEY_SECRET.value(), {
          uid: request.auth.uid,
          featureName: 'sayu_polish',
          isDev: DEVELOPER_UIDS.has(request.auth.uid),
        });
      }

      // ===== 💬 AI 한마디 생성 (SAYU와 동시, 별도 호출 없음) =====
      let aiComment = '';
      try {
        const commentModelName = 'gemini-3.1-flash-lite';
        const commentModel = genAI.getGenerativeModel({ model: commentModelName });
        const commentPrompt = buildAiCommentPrompt(polishedText, formatGroup);
        const commentResult = await commentModel.generateContent(commentPrompt);
        const commentUsage = getGeminiUsage(commentResult);
        await logAiUsage({
          uid: request.auth.uid,
          featureName: 'sayu_polish',
          plan: AI_USAGE_PLAN,
          model: commentModelName,
          inputTokens: commentUsage.inputTokens,
          outputTokens: commentUsage.outputTokens,
          imageCount: 0,
          externalApiProvider: null,
          externalApiCalled: false,
          groundingUsed: false,
          requestId: null,
          success: true,
          errorCode: null,
          isDev: DEVELOPER_UIDS.has(request.auth.uid),
        });
        const rawComment = (commentResult.response.text() || '').trim();
        aiComment = rawComment
          .replace(/^["'`*#\-•·]+|["'`*#\-•·]+$/g, '')
          .replace(/\*\*|__/g, '')
          .trim()
          .slice(0, 50);
      } catch (commentErr) {
        console.warn('[polishContent] AI 한마디 생성 실패:', commentErr);
      }

      await logPaidServiceUsage(uid, 'ai_polish', {
        format: normalizedFormat || 'unknown',
        mode,
        inputLength: text.length,
      }).catch((error) => {
        logger.warn('유료 이용 개시 로그 기록 실패(polishContent):', { uid, message: error?.message });
      });

      return {
        text: polishedText,
        stats: stats,
        aiComment: aiComment,
      };

    } catch (error: any) {
      console.error('AI 처리 실패:', error);
      await rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation);
      if (request.auth?.uid) {
        await logAiUsage({
          uid: request.auth.uid,
          featureName: 'sayu_polish',
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
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'AI 처리에 실패했습니다.');
    }
  }
);

export const getMonthlyAiQuotaStatus = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    return getMonthlyAiQuotaStatusForUser(request.auth.uid);
  },
);

// 숫자·기호만으로 이뤄진 제목인지 검사 (의미 없는 제목 걸러냄)
function isValidTitle(title: string): boolean {
  if (!title || title.trim().length < 2) return false;
  // 숫자, 공백, 콜론, 점, 쉼표, 대시, 슬래시만으로 구성된 경우 거부
  // 예: "09:00", "1,234", "123", "12.5", "2026-03-28"
  return !/^[\d\s:.,\-\/]+$/.test(title.trim());
}

// ===== 🏷️ AI 제목 추출 =====
export const extractTitle = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET]
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    try {
      const { text, format } = request.data;
      if (!text || typeof text !== 'string') {
        throw new HttpsError('invalid-argument', '텍스트가 필요합니다.');
      }

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const modelName = 'gemini-3.1-flash-lite';
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `다음 기록의 핵심을 담은 짧은 제목을 만들어주세요.
제목만 한 줄로 출력하세요. 10자 이내. 따옴표·마크다운 기호(*, #) 없이 텍스트만.

기록 형식: ${format || '일반'}
기록 내용:
${text.slice(0, 600)}`;

      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      const title = raw
        .replace(/^\*\*(.+)\*\*$/, '$1')
        .replace(/^["']|["']$/g, '')
        .trim()
        .slice(0, 20);

      // 숫자·기호만으로 구성된 제목은 빈 문자열 반환
      return { title: isValidTitle(title) ? title : '' };
    } catch (error: any) {
      console.error('제목 추출 실패:', error);
      throw new HttpsError('internal', '제목 추출에 실패했습니다.');
    }
  }
);

// ===== 🔑 SAYU 리스트 미리보기 키워드 추출 =====
// 본문에서 핵심 고유어(서비스명·전략명·시장명·기능명·제품명) 3~6개를 JSON 배열로 반환.
// 일반 추상명사·1글자·단독 "AI" 등은 후처리에서 제거.
const KW_STRICT_STOP = new Set<string>([
  // 단독 일반 추상명사
  'AI', 'ai', '기록', '실제', '현재', '구조', '가능성', '수준', '부분', '내용', '생각',
  '사람', '경우', '이런', '저런', '방법', '방향', '과정', '결과', '효과', '의미',
  '가치', '활용', '적용', '관련', '다양', '진행', '중심', '기준', '정도', '시간',
  '시점', '필요', '중요', '주요', '확인', '사용', '제공', '하나', '오늘', '내일',
  '어제', '지금', '이번', '이후', '이전', '여러', '모두', '많이', '많은', '대부분',
  '문제', '상황', '상태', '느낌', '측면', '단계', '기반', '계열', '메모리',
  // 사용자 호칭 / 인사 표현 (개인 식별어 제외)
  '허대표', '허대표님', '대표님', '교장님', '박사님', '시박사', '선생님', '본인',
  // 종결·서술 표현
  '있습니다', '입니다', '합니다', '됩니다', '하다', '되다', '이다', '있다', '없다',
  '이건', '저건', '그건', '여기', '저기', '거기',
  // 형용사/부사 어간
  '단순', '단순한', '중요한', '필요한', '간단한', '복잡한', '새로운', '좋은',
  '만든', '만들기', '만들', '진행중', '완료', '시작', '취업', '신청',
]);

// 숫자+한국어 단위 패턴 (예: "3개", "4가지", "10명") — 키워드로 부적합
const KW_NUMUNIT_RE = /^\d+\s*(개|가지|명|번|회|차|단계|시간|초|분|일|월|년|건|개월|주|살|세|점|위|등|차례|장|편)$/;

// ===== 📝 HARU 메모 — 비공개 AI 보조 관찰 메모 (공개 댓글 아님) =====
// 평가·훈계·과잉 공감 금지. 사실 기반 짧은 관찰 메모(3문장 이내).
export const generateHaruMemo = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    try {
      const { formatType, fields, date } = (request.data || {}) as {
        formatType?: string;
        fields?: Record<string, unknown>;
        date?: string;
      };
      if (!formatType || typeof formatType !== 'string') {
        throw new HttpsError('invalid-argument', 'formatType이 필요합니다.');
      }
      if (!fields || typeof fields !== 'object') {
        throw new HttpsError('invalid-argument', 'fields가 필요합니다.');
      }

      // 메타·이미지·sayu·점수 같은 비-본문 필드 제외 후 텍스트 합성
      const META_SUFFIXES = ['_sayu', '_polished', '_polishedAt', '_mode', '_stats', '_images', '_rating', '_keywords', '_ai_title', '_tags', '_space', '_style'];
      const lines: string[] = [];
      Object.keys(fields).forEach((k) => {
        if (META_SUFFIXES.some((s) => k.endsWith(s))) return;
        const v = (fields as any)[k];
        if (typeof v === 'string' && v.trim()) {
          lines.push(`${k}: ${v.trim()}`);
        }
      });
      const bodyText = lines.join('\n').slice(0, 3500);
      if (!bodyText) {
        return { content: '오늘 기록에서 메모로 정리할 본문이 충분하지 않습니다.' };
      }

      const prompt = `당신은 사용자의 기록을 조용히 보조 관찰하는 비공개 메모 도우미입니다.
이 메모는 SNS 댓글이 아니며 공개되지 않습니다. 평가·훈계·과잉 위로·칭찬 남발을 절대 금지합니다.

[엄격 규칙]
- 정확히 1~3문장. 절대 4문장 이상 작성 금지.
- 한국어 존댓말, 차분하고 조용한 문체.
- "대단하세요", "멋집니다", "힘내세요" 같은 SNS형 표현 금지.
- 사용자를 평가하거나 훈계하지 마세요.
- 과잉 공감 금지 ("정말 힘드셨겠어요" 류 금지).
- 기록의 반복 표현·생활 흐름·감정 패턴·사실을 중심으로 짧게 관찰합니다.
- 마크다운·이모지·번호·따옴표·인사말 금지. 본문 텍스트만 출력.

[예시 톤]
"최근 기록에서 피로 관련 표현이 반복되고 있습니다."
"오늘 기록은 감정보다 사실 중심으로 정리되어 있습니다."
"비슷한 흐름이 이어진다면 이후 기록과 함께 생활 패턴을 비교해볼 수 있습니다."

기록 형식: ${formatType}
기록 날짜: ${date || '날짜 미상'}
기록 본문:
${bodyText}`;

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const modelId = 'gemini-3.1-flash-lite';
      const model = genAI.getGenerativeModel({ model: modelId });
      const result = await model.generateContent(prompt);
      const raw = (result.response.text() || '').trim();

      // 마크다운/이모지/따옴표 잡음 제거
      const cleaned = raw
        .replace(/^["'`*#\-•·]+|["'`*#\-•·]+$/g, '')
        .replace(/\*\*|__/g, '')
        .replace(/^\s*[-*]\s+/gm, '')
        .trim();

      // 3문장 cap (마침표·물음표·느낌표 기준)
      const sentences = cleaned.match(/[^.!?。]+[.!?。]?/g) || [cleaned];
      const trimmed = sentences.slice(0, 3).join('').trim() || cleaned.slice(0, 240);

      return { content: trimmed.slice(0, 280) };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      console.error('HARU 메모 생성 실패:', error);
      throw new HttpsError('internal', 'HARU 메모 생성에 실패했습니다.');
    }
  },
);

export const extractKeywords = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET]
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    try {
      const { text, title, max } = request.data || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        throw new HttpsError('invalid-argument', '텍스트가 필요합니다.');
      }
      // 클라이언트가 더 큰 값을 보내도 6으로 cap. 최소 3.
      const requested = typeof max === 'number' && max > 0 && max <= 20 ? Math.floor(max) : 6;
      const limit = Math.max(3, Math.min(6, requested));
      const titleLine = typeof title === 'string' && title.trim() ? title.trim().slice(0, 80) : '';

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

      const prompt = `다음 기록에서 핵심 키워드를 3~${limit}개만 추출하세요.

[엄격한 규칙]
1. 기록의 **주제명/서비스명/전략명/시장명/기능명/제품명/지역명/조직명** 같은 고유어만 사용
2. 제목에 포함된 핵심 고유어를 최우선으로 살릴 것
3. **1글자 키워드 절대 금지** (반드시 2글자 이상)
4. 다음 일반어는 절대 사용 금지: AI(단독), 기록, 실제, 현재, 구조, 가능성, 수준, 부분, 내용, 생각, 사람, 경우, 이런, 저런, 방법, 방향, 과정, 결과, 효과, 의미, 가치, 활용, 적용, 관련, 다양, 진행, 중심, 기준, 정도, 시간, 시점, 필요, 중요, 주요, 확인, 사용, 제공, 문제, 상황, 상태, 느낌, 측면, 단계, 기반, 계열, 메모리, 단순, 중요한, 만든, 만들기, 완료, 신청, 시작, 취업
5. 단독 "AI"는 금지. "AI비서", "AI플랫폼" 같은 합성어 형태는 허용
6. **사용자 호칭/인사 표현 절대 금지**: 허대표, 허대표님, 대표님, 교장님, 박사님, 시박사, 선생님, 본인 등 사람을 부르는 단어는 키워드 아님
7. 종결 표현/문장 잔여 금지: 있습니다, 입니다, 합니다, 됩니다, 이건, 그건
8. 숫자+단위 금지 (예: 3개, 4가지, 10명)
9. 조사·형용사·부사·동사·일반 추상명사 제외
10. 동의어는 한 표현으로 통합 (예: "공모" + "공모전" → "공모전")
11. 각 키워드 길이 2~12자, 한국어 명사 또는 영문/숫자 포함 고유명사 원문

[출력 형식]
JSON 배열 한 줄만. 마크다운·번호·콜론·설명 절대 금지. 배열 외 텍스트 출력 금지.

[좋은 예시]
제목: "HARU2026 공모전 합격 전략"
출력: ["HARU2026","공모전","합격전략"]

제목: "외국인 전용 AI 비서 시장 분석"
출력: ["외국인","AI비서","시장분석"]

제목: "HARU의 독보적 성장세"
출력: ["HARU","독보적성장","성장세"]

[나쁜 예시 — 절대 이런 식 금지]
출력: ["AI","허대표님","있습니다","이건","실제","중요한"]  ← 모두 일반어/호칭/형용사라 키워드 아님
출력: ["3개","4가지","단계","구조","느낌"]  ← 숫자+단위·일반 추상명사

${titleLine ? `제목: "${titleLine}"\n` : ''}기록 내용:
${text.slice(0, 4000)}`;

      const result = await model.generateContent(prompt);
      const usage = getGeminiUsage(result);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_keyword',
        plan: AI_USAGE_PLAN,
        model: 'gemini-3.1-flash-lite',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        imageCount: 0,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      const raw = (result.response.text() || '').trim();

      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const m = cleaned.match(/\[[\s\S]*?\]/);
        if (m) {
          try { parsed = JSON.parse(m[0]); } catch { /* keep null */ }
        }
      }

      if (!Array.isArray(parsed)) return { keywords: [] as string[] };

      const keywords = (parsed as unknown[])
        .filter((k): k is string => typeof k === 'string')
        .map((k) => k.trim().replace(/^["'`*#\-•·\s]+|["'`*#\-•·\s]+$/g, '').trim())
        .filter((k) => k.length >= 2 && k.length <= 14)
        .filter((k) => !KW_STRICT_STOP.has(k) && !KW_STRICT_STOP.has(k.toLowerCase()))
        .filter((k) => !/^\d+$/.test(k))
        .filter((k) => !KW_NUMUNIT_RE.test(k))
        .filter((k, i, arr) => arr.indexOf(k) === i)
        .slice(0, limit);

      return { keywords };
    } catch (error: any) {
      console.error('키워드 추출 실패:', error);
      if (request.auth?.uid) {
        await logAiUsage({
          uid: request.auth.uid,
          featureName: 'law_keyword',
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
      throw new HttpsError('internal', '키워드 추출에 실패했습니다.');
    }
  }
);

// ===== 🧹 기존 저품질 keywords 캐시 일괄 삭제 (호출자 본인 데이터 한정) =====
// 사용법: 브라우저 콘솔에서 한 줄 호출 — 결과로 {docsExamined, docsUpdated, fieldsCleared} 반환.
// const { getFunctions, httpsCallable } = await import('firebase/functions');
// const r = await httpsCallable(getFunctions(undefined,'asia-northeast3'),'clearKeywordsCache')();
// console.log(r.data);
export const clearKeywordsCache = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    const FieldValue = admin.firestore.FieldValue;
    const recordsRef = db.collection('users').doc(uid).collection('records');
    const snap = await recordsRef.get();

    let docsExamined = 0;
    let docsUpdated = 0;
    let fieldsCleared = 0;

    let batch = db.batch();
    let opsInBatch = 0;

    for (const docSnap of snap.docs) {
      docsExamined++;
      const data = docSnap.data() as Record<string, any>;
      const updates: Record<string, any> = {};
      Object.keys(data).forEach((k) => {
        if (k === 'keywords' || k.endsWith('_keywords')) {
          updates[k] = FieldValue.delete();
          fieldsCleared++;
        }
      });
      if (Object.keys(updates).length === 0) continue;
      batch.update(docSnap.ref, updates);
      docsUpdated++;
      opsInBatch++;
      if (opsInBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) {
      await batch.commit();
    }
    return { docsExamined, docsUpdated, fieldsCleared };
  }
);

const RESULT_CHAT_ALLOWED_SAFETY_MODES = new Set<ResultChatSafetyMode>([
  'reflection',
  'writing',
  'report',
  'plant_basic',
  'timeline_basic',
  'legal_basic',
  'medical_basic',
  'finance_basic',
]);

function clampResultChatText(value: unknown, max = 8000): string {
  return String(value || '').trim().slice(0, max);
}

function getResultThreadId(sourceKey: string, sourceIndex?: number): string {
  const safeKey = sourceKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return typeof sourceIndex === 'number' ? `${safeKey}_${sourceIndex}` : safeKey;
}

function getPlantDetectiveResult(record: Record<string, any>, sourceIndex?: number): string {
  if (typeof sourceIndex !== 'number' || sourceIndex < 0) return '';
  const entries = Array.isArray(record.plantDetective) ? record.plantDetective : [];
  const item = entries[sourceIndex];
  if (!item) return '';
  const parts = [
    item.userConfirmedName || item.humanReportedName || item.title || item.plantName,
    item.aiKoName ? `AI 판독명: ${item.aiKoName}` : '',
    item.aiPrediction ? `예측명: ${item.aiPrediction}` : '',
    item.scientificName || item.latinName ? `학명: ${item.scientificName || item.latinName}` : '',
    item.condition ? `상태: ${item.condition}` : '',
    item.note ? `메모: ${item.note}` : '',
    item.memo ? `사용자 메모: ${item.memo}` : '',
    item.geminiAnalysis?.analysis ? `AI 분석: ${item.geminiAnalysis.analysis}` : '',
    item.geminiAnalysis?.careAdvice ? `관리 조언: ${item.geminiAnalysis.careAdvice}` : '',
    item.geminiAnalysis?.warning ? `주의: ${item.geminiAnalysis.warning}` : '',
  ];
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join('\n');
}

function getGrowthTimelineResult(record: Record<string, any>): string {
  const items = Array.isArray(record.timelineItems) ? record.timelineItems : [];
  const itemText = items
    .map((item: any, index: number) => [
      `[${index + 1}]`,
      item.takenDate ? `날짜: ${item.takenDate}` : '',
      item.memo ? `메모: ${item.memo}` : '',
      item.locationLabel ? `위치: ${item.locationLabel}` : '',
    ].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n');
  return [
    record.title ? `제목: ${record.title}` : '',
    record.content ? `내용: ${record.content}` : '',
    itemText,
  ].filter((part) => String(part || '').trim()).join('\n\n');
}

function getRecordResultBySourceKey(record: Record<string, any>, sourceKey: string, sourceIndex?: number): string {
  if (sourceKey === 'plantDetective') return getPlantDetectiveResult(record, sourceIndex);
  if (sourceKey === 'growthTimeline') return getGrowthTimelineResult(record);
  const value = record[sourceKey];
  return typeof value === 'string' ? value.trim() : '';
}

// SAYU 결과물(_sayu)이 없는 원문/과거 기록도 대화 가능하도록 원문 본문으로 폴백.
// 프론트(SayuPage) META_SUFFIXES와 동일한 제외 규칙으로 {prefix}_* 본문 필드를 모은다.
const RESULT_CHAT_META_SUFFIXES = [
  '_sayu', '_final_sayu', '_polished', '_polishedAt', '_mode', '_stats',
  '_images', '_imageMeta', '_rating', '_status', '_completedAt',
  '_reflection_questions', '_reflection_answers', '_entries_snapshot',
];

function getRecordOriginalContentByPrefix(record: Record<string, any>, prefix: string): string {
  if (!prefix) return '';
  const parts: string[] = [];
  Object.keys(record).forEach((key) => {
    if (!key.startsWith(`${prefix}_`)) return;
    if (RESULT_CHAT_META_SUFFIXES.some((suffix) => key.endsWith(suffix))) return;
    const value = record[key];
    if (typeof value === 'string' && value.trim()) parts.push(value.trim());
  });
  return parts.join('\n\n');
}

// 요금제 조회 — subscription/info.plan (free/basic/premium). 개발자 UID는 developer로 계측하고 premium 한도를 적용.
async function getUserPlan(uid: string): Promise<UserPlan> {
  const internalPlan = resolveInternalPlan(uid);
  if (internalPlan) return internalPlan;
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
    logger.warn('getUserPlan 조회 실패:', { uid, message: (error as any)?.message });
  }
  return 'free';
}

type PaidServiceUsageEvent =
  | 'record_created'
  | 'record_updated'
  | 'ai_polish'
  | 'timeline_pdf'
  | 'result_chat';

const PAID_SERVICE_USAGE_EVENTS = new Set<PaidServiceUsageEvent>([
  'record_created',
  'record_updated',
  'ai_polish',
  'timeline_pdf',
  'result_chat',
]);

async function logPaidServiceUsage(
  uid: string,
  eventType: PaidServiceUsageEvent,
  details: Record<string, unknown> = {},
): Promise<{ logged: boolean; plan: UserPlan }> {
  const plan = await getUserPlan(uid);
  if (plan !== 'basic' && plan !== 'premium') {
    return { logged: false, plan };
  }

  const nowIso = new Date().toISOString();
  const eventId = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const sanitizedDetails = Object.fromEntries(
    Object.entries(details)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key.slice(0, 80), typeof value === 'string' ? value.slice(0, 500) : value]),
  );

  const usageEventRef = db.doc(`paidServiceUsage/${uid}/events/${eventId}`);
  const subscriptionRef = db.doc(`users/${uid}/subscription/info`);

  await usageEventRef.set({
      uid,
      plan,
      eventType,
      details: sanitizedDetails,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtIso: nowIso,
    });

  await db.runTransaction(async (tx) => {
    const subSnap = await tx.get(subscriptionRef);
    const hasFirstUsage = Boolean(subSnap.data()?.hasPaidServiceUsage);
    tx.set(subscriptionRef, {
      hasPaidServiceUsage: true,
      ...(hasFirstUsage ? {} : {
        firstPaidServiceUsageAt: admin.firestore.FieldValue.serverTimestamp(),
        firstPaidServiceUsageAtIso: nowIso,
      }),
      lastPaidServiceUsageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastPaidServiceUsageAtIso: nowIso,
      lastPaidServiceUsageType: eventType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { logged: true, plan };
}

export const recordPaidServiceUsage = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const rawEventType = String(request.data?.eventType || '').trim();
    if (!PAID_SERVICE_USAGE_EVENTS.has(rawEventType as PaidServiceUsageEvent)) {
      throw new HttpsError('invalid-argument', 'eventType 값이 올바르지 않습니다.');
    }

    const details = request.data?.details && typeof request.data.details === 'object'
      ? request.data.details as Record<string, unknown>
      : {};
    return logPaidServiceUsage(request.auth.uid, rawEventType as PaidServiceUsageEvent, details);
  },
);

// 유료(베이직·프리미엄) 구독자만 통과 — 일부 유료 전용 서버 함수에서 사용.
// 개발자 UID와 만료되지 않은 basic/premium은 getUserPlan이 이미 처리한다.
async function requirePaidSubscription(uid: string): Promise<void> {
  const plan = await getUserPlan(uid);
  if (plan === 'free') {
    throw new HttpsError('permission-denied', '베이직 또는 프리미엄 구독 후 이용할 수 있습니다.');
  }
}

type ResultChatSearchPreference = 'auto' | 'record_only' | 'web_confirmed';

type WebSearchUsage = {
  limit: number;
  usedCount: number;
  reservedCount: number;
  remainingCount: number;
};

type ReservedWebSearchSlot = WebSearchUsage & {
  reserved: boolean;
};

const RESULT_CHAT_COST_PRICING = {
  pricingVersion: 'raw-token-counts-v1',
  currency: 'USD',
  modelInputPerMillion: null as number | null,
  modelOutputPerMillion: null as number | null,
  searchPerUse: null as number | null,
};

function getWebSearchUsageFromData(data: Record<string, any> | undefined, plan: UserPlan): WebSearchUsage {
  const usedCount = Math.max(0, Number(data?.webSearchUsedCount || 0));
  const reservedCount = Math.max(0, Number(data?.webSearchReservedCount || 0));
  const limit = WEB_SEARCH_LIMITS[plan] ?? WEB_SEARCH_LIMITS.free;
  return {
    limit,
    usedCount,
    reservedCount,
    remainingCount: Math.max(0, limit - usedCount - reservedCount),
  };
}

async function getThreadWebSearchUsage(
  threadRef: admin.firestore.DocumentReference,
  plan: UserPlan,
): Promise<WebSearchUsage> {
  const snap = await threadRef.get();
  return getWebSearchUsageFromData(snap.data(), plan);
}

async function reserveWebSearchSlot(
  threadRef: admin.firestore.DocumentReference,
  plan: UserPlan,
  sourceKey: string,
  sourceIndex?: number,
): Promise<ReservedWebSearchSlot> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(threadRef);
    const current = getWebSearchUsageFromData(snap.data(), plan);
    if (current.usedCount + current.reservedCount >= current.limit) {
      return { ...current, reserved: false };
    }
    const reservedCount = current.reservedCount + 1;
    tx.set(threadRef, {
      sourceKey,
      sourceIndex: typeof sourceIndex === 'number' ? sourceIndex : null,
      webSearchReservedCount: reservedCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
      ...current,
      reservedCount,
      remainingCount: Math.max(0, current.limit - current.usedCount - reservedCount),
      reserved: true,
    };
  });
}

async function finalizeWebSearchSlot(
  threadRef: admin.firestore.DocumentReference,
  plan: UserPlan,
  success: boolean,
): Promise<WebSearchUsage> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(threadRef);
    const current = getWebSearchUsageFromData(snap.data(), plan);
    const reservedCount = Math.max(0, current.reservedCount - 1);
    const usedCount = success ? current.usedCount + 1 : current.usedCount;
    const next: Record<string, any> = {
      webSearchReservedCount: reservedCount,
      webSearchUsedCount: usedCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (success) next.lastWebSearchAt = admin.firestore.FieldValue.serverTimestamp();
    tx.set(threadRef, next, { merge: true });
    return {
      limit: current.limit,
      usedCount,
      reservedCount,
      remainingCount: Math.max(0, current.limit - usedCount - reservedCount),
    };
  });
}

async function acquireResultChatLock(
  threadRef: admin.firestore.DocumentReference,
  requestId: string,
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(threadRef);
    const data = snap.data() || {};
    const activeRequestId = String(data.activeRequestId || '');
    const activeAt = data.activeRequestStartedAt;
    const activeMs = Number(data.activeRequestStartedMs || 0)
      || (typeof activeAt?.toMillis === 'function' ? activeAt.toMillis() : 0);
    if (activeRequestId && Date.now() - activeMs < RESULT_CHAT_LOCK_STALE_MS) {
      throw new HttpsError('resource-exhausted', '질문이 연속으로 많이 접수되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    tx.set(threadRef, {
      activeRequestId: requestId,
      activeRequestStartedMs: Date.now(),
      activeRequestStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function releaseResultChatLock(
  threadRef: admin.firestore.DocumentReference,
  requestId: string,
): Promise<void> {
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(threadRef);
      if (String(snap.data()?.activeRequestId || '') !== requestId) return;
      tx.set(threadRef, {
        activeRequestId: admin.firestore.FieldValue.delete(),
        activeRequestStartedMs: admin.firestore.FieldValue.delete(),
        activeRequestStartedAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  } catch (error) {
    logger.warn('result chat lock release 실패:', { requestId, message: (error as any)?.message });
  }
}

async function enforceResultChatRateLimit(uid: string): Promise<void> {
  const ref = db.doc(`users/${uid}/rateLimits/resultChat`);
  await db.runTransaction(async (tx) => {
    const now = Date.now();
    const snap = await tx.get(ref);
    const raw = Array.isArray(snap.data()?.recentRequestMs) ? snap.data()?.recentRequestMs : [];
    const recent = raw
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isFinite(value) && now - value < RESULT_CHAT_RATE_WINDOW_MS);
    if (recent.length >= RESULT_CHAT_RATE_LIMIT) {
      throw new HttpsError('resource-exhausted', '질문이 연속으로 많이 접수되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    tx.set(ref, {
      recentRequestMs: [...recent, now].slice(-RESULT_CHAT_RATE_LIMIT),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

function getSafetyModeGuide(safetyMode: string): string {
  switch (safetyMode) {
    case 'writing':
      return '글쓰기 보조 모드다. 원문 의도와 사실을 보존하고 표현, 구조, 제목, 요약 중심으로 돕는다.';
    case 'report':
      return '보고 정리 모드다. 진행 상황, 누락 가능성, 다음 행동을 사실 중심으로 정리한다.';
    case 'plant_basic':
      return '식물 기본 관리 모드다. 사진과 기록 기반 추정임을 밝히고 식용, 독성, 농약, 치료 판단은 단정하지 않는다.';
    case 'timeline_basic':
      return '타임라인 관찰 모드다. 시간 흐름과 변화 포인트를 정리하되 건강·발달 진단은 하지 않는다.';
    case 'medical_basic':
      return [
        '건강·의약품 참고 모드다. 다음을 반드시 지킨다.',
        '- 진단을 확정하거나 약 복용 중단·변경을 지시하지 않는다.',
        '- 응급 증상 가능성이 있으면 의료기관 또는 119 등 긴급 도움을 안내한다.',
        '- 사용자 기록, 공식자료, 일반 참고정보를 구분한다.',
        '- 의료진 상담을 대체하지 않는다고 명확히 밝힌다.',
      ].join('\n');
    case 'finance_basic':
      return [
        '금융 참고 모드다. 다음을 반드시 지킨다.',
        '- 수익을 보장하거나 매수·매도 결정을 단정하지 않는다.',
        '- 현재 가격, 공시, 뉴스는 최신자료 확인 없이는 추측하지 않는다.',
        '- 사용자의 기록과 외부 사실을 구분한다.',
        '- 금융·세무 전문가 확인이 필요한 영역을 명확히 표시한다.',
      ].join('\n');
    case 'legal_basic':
      return [
        '법률 정보 참고 모드다. 다음을 반드시 지킨다.',
        '- 유죄·무죄, 승소·패소, 위법 여부를 단정하지 않는다. 가능성, 쟁점, 확인이 필요한 사항 중심으로 설명한다.',
        '- 기록에 담긴 사실관계와 관련 법조문 범위 안에서만 답한다. 없는 사실을 추정해 덧붙이지 않는다.',
        '- 구체적 사건의 결론이나 소송 전략을 확정적으로 제시하지 않는다.',
        HARULAW_RESPONSE_STRUCTURE_GUIDE,
        '- 답변 끝에 전문가(변호사) 상담 권유를 유지한다.',
        '- 질문자가 피해자인지 피고발인인지 제3자인지 불명확하면 먼저 확인 질문을 한다.',
      ].join('\n');
    case 'reflection':
    default:
      return '성찰 보조 모드다. 감정과 생각을 존중하고 기록에 드러난 흐름을 차분히 정리한다.';
  }
}

function getResultChatSearchPreference(value: unknown): ResultChatSearchPreference {
  const preference = String(value || '').trim();
  if (preference === 'record_only' || preference === 'web_confirmed') return preference;
  return 'auto';
}

function buildWebSearchNotice(plan: UserPlan, usage: WebSearchUsage): string {
  return [
    '🌐 최신 외부자료 확인이 필요한 질문입니다.',
    '',
    RESULT_CHAT_PLAN_LABELS[plan],
    `이 결과의 최신자료 확인 ${usage.limit}회 중 ${usage.remainingCount}회 이용 가능`,
    '',
    '최신자료를 확인한 뒤 답변할까요?',
  ].join('\n');
}

function buildAmbiguousNotice(plan: UserPlan, usage: WebSearchUsage): string {
  return [
    '어떤 방식으로 답변할까요?',
    '',
    '나의 기록만으로 답변할 수도 있고, 최신 외부자료를 함께 확인할 수도 있습니다.',
    '',
    RESULT_CHAT_PLAN_LABELS[plan],
    `이 결과의 최신자료 확인 ${usage.limit}회 중 ${usage.remainingCount}회 이용 가능`,
  ].join('\n');
}

function buildWebSearchExhaustedNotice(): string {
  return [
    '이 결과에서 이용할 수 있는 최신자료 확인을 모두 사용했습니다.',
    '',
    '나의 기록을 바탕으로 한 질문은 계속할 수 있습니다.',
  ].join('\n');
}

function extractJsonObject(text: string): any | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeClassifierResult(value: any): ResultChatClassification {
  const route = coerceClassifierRoute(value?.route);
  const reasonCode = String(value?.reasonCode || '').trim();
  const confidence = Number(value?.confidence);
  return {
    route,
    reasonCode:
      reasonCode === 'current_fact' ||
      reasonCode === 'record_analysis' ||
      reasonCode === 'official_data' ||
      reasonCode === 'high_risk' ||
      reasonCode === 'unclear'
        ? reasonCode
        : 'unclear',
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
  };
}

function coerceResultChatRouteForImplementedSources(classification: ResultChatClassification): ResultChatClassification {
  if (classification.route !== 'professional_api') return classification;
  return {
    ...classification,
    route: 'web_search',
    reasonCode: 'official_data',
    confidence: Math.min(classification.confidence, 0.82),
  };
}

async function classifyResultChatQuestion(
  ai: GoogleGenAI,
  params: {
    uid: string;
    actualPlan: UserPlan;
    recordId: string;
    sourceKey: string;
    question: string;
    sourceResult: string;
    requestId: string;
    isDev: boolean;
  },
): Promise<ResultChatClassification> {
  const policy = RESULT_CHAT_SOURCE_POLICIES[params.sourceKey];
  const ruleResult = classifyResultChatByRules(params.question, policy);
  if (ruleResult) return coerceResultChatRouteForImplementedSources(ruleResult);

  const startedAt = Date.now();
  try {
    const prompt = `HARU2026 결과 대화 질문을 분류하세요. 웹검색 도구는 사용할 수 없습니다.

반드시 JSON 하나만 반환하세요.
{
  "route": "record_only | professional_api | web_search | ambiguous | high_risk_guidance",
  "reasonCode": "current_fact | record_analysis | official_data | high_risk | unclear",
  "confidence": 0.0
}

[결과 유형]
sourceKey: ${params.sourceKey}
label: ${policy.label}
riskLevel: ${policy.riskLevel}
safetyMode: ${policy.safetyMode}
externalDataPolicy: ${policy.externalDataPolicy}

[저장 결과 일부]
${clampResultChatText(params.sourceResult, 1600)}

[질문]
${params.question}`;

    const response = await ai.models.generateContent({
      model: RESULT_CHAT_MODEL_NAME,
      contents: prompt,
      config: {
        maxOutputTokens: RESULT_CHAT_CLASSIFIER_MAX_OUTPUT_TOKENS,
      },
    });
    const parsed = extractJsonObject(response.text || '');
    const raw = normalizeClassifierResult(parsed || {});
    const result = raw.confidence < 0.6
      ? { route: 'ambiguous' as ResultAnswerRoute, reasonCode: 'unclear' as const, confidence: raw.confidence }
      : raw;

    const usage = response.usageMetadata;
    await logAiUsage({
      uid: params.uid,
      featureName: 'result_chat_classifier',
      plan: params.actualPlan,
      actualPlan: params.actualPlan,
      recordId: params.recordId,
      sourceKey: params.sourceKey,
      answerRoute: result.route,
      model: RESULT_CHAT_MODEL_NAME,
      inputTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage?.candidatesTokenCount ?? null,
      imageCount: 0,
      externalApiProvider: null,
      externalApiCalled: false,
      groundingUsed: false,
      webSearchUsed: false,
      professionalApiUsed: false,
      searchSourceCount: 0,
      latencyMs: Date.now() - startedAt,
      pricingVersion: RESULT_CHAT_COST_PRICING.pricingVersion,
      estimatedModelCost: null,
      estimatedSearchCost: null,
      estimatedTotalCost: null,
      currency: RESULT_CHAT_COST_PRICING.currency,
      requestId: params.requestId,
      success: true,
      errorCode: null,
      isDev: params.isDev,
    });

    return coerceResultChatRouteForImplementedSources(result);
  } catch (error: any) {
    await logAiUsage({
      uid: params.uid,
      featureName: 'result_chat_classifier',
      plan: params.actualPlan,
      actualPlan: params.actualPlan,
      recordId: params.recordId,
      sourceKey: params.sourceKey,
      answerRoute: 'ambiguous',
      model: RESULT_CHAT_MODEL_NAME,
      inputTokens: null,
      outputTokens: null,
      imageCount: 0,
      externalApiProvider: null,
      externalApiCalled: false,
      groundingUsed: false,
      webSearchUsed: false,
      professionalApiUsed: false,
      searchSourceCount: 0,
      latencyMs: Date.now() - startedAt,
      pricingVersion: RESULT_CHAT_COST_PRICING.pricingVersion,
      estimatedModelCost: null,
      estimatedSearchCost: null,
      estimatedTotalCost: null,
      currency: RESULT_CHAT_COST_PRICING.currency,
      requestId: params.requestId,
      success: false,
      errorCode: getAiUsageErrorCode(error),
      isDev: params.isDev,
    });
    return { route: 'ambiguous', reasonCode: 'unclear', confidence: 0.4 };
  }
}

function buildResultChatPrompt(params: {
  sourceResult: string;
  recentMessages: string;
  question: string;
  route: ResultAnswerRoute;
  safetyMode: ResultChatSafetyMode;
  systemGuide: string;
  recordOnlyChosen: boolean;
}): string {
  const routeGuide: Record<ResultAnswerRoute, string> = {
    record_only: [
      '첫 줄에 "📘 나의 기록을 바탕으로 답변"을 표시한다.',
      '웹검색, 외부 최신자료, 기록 밖 사실 확인을 사용하지 않는다.',
      params.recordOnlyChosen ? '사용자가 기록 기준 답변을 선택했으므로 현재 외부자료를 확인하지 않았음을 짧게 밝힌다.' : '',
    ].filter(Boolean).join('\n'),
    professional_api: [
      '첫 줄에 "🏛 공식·전문자료를 확인한 답변"을 표시한다.',
      '실제 확인한 공식·전문자료가 없는 경우 확인했다고 쓰지 않는다.',
    ].join('\n'),
    web_search: [
      '첫 줄에 "🌐 최신 외부자료를 확인한 답변"을 표시한다.',
      '반드시 Google Search 도구로 최신 정보를 검색한 뒤 답변한다. 검색 없이는 답변하지 않는다.',
      'Google Search Grounding으로 확인된 최신 외부자료와 저장 기록을 구분한다.',
      '출처로 확인되지 않은 외부 사실은 단정하지 않는다.',
    ].join('\n'),
    ambiguous: [
      '첫 줄에 "📘 나의 기록을 바탕으로 답변"을 표시한다.',
      '현재 외부자료는 확인하지 않았음을 짧게 밝힌다.',
    ].join('\n'),
    high_risk_guidance: [
      '첫 줄에 "⚠️ 전문적인 확인이 필요한 안내"를 표시한다.',
      '기록만으로 진단, 법률 판단, 투자 결정을 확정할 수 없음을 명확히 밝힌다.',
      '공식자료, 전문기관, 전문가에게 확인할 항목을 안전하게 정리한다.',
    ].join('\n'),
  };

  return `당신은 HARU2026의 결과물 기반 대화 비서입니다.

[공통 원칙]
- 기록 결과물과 현재 질문을 최우선 근거로 삼는다.
- 기록에 담긴 사실·감정·의도는 임의로 바꾸거나 재창작하지 않는다.
- 없는 사실을 추정해 덧붙이지 않는다.
- 사용자의 원문 감정과 의도를 존중한다.
- 답변은 기본적으로 간결하게 쓰고, 실행 가능한 다음 행동 1~3개로 마무리한다.
- 과장된 칭찬, 단정적 예측, 전문가 판단 대체 표현을 금지한다.

[이번 답변 라우트]
${params.route}
${routeGuide[params.route]}

[모드 제한]
${getSafetyModeGuide(params.safetyMode)}

[형식별 지침]
${params.systemGuide || '(추가 지침 없음)'}

[결과물]
${clampResultChatText(params.sourceResult, RESULT_CHAT_PROMPT_SOURCE_MAX_LENGTH)}

[최근 대화]
${params.recentMessages || '(아직 없음)'}

[현재 질문]
${params.question}

한국어로 답변하세요.`;
}

function getResultChatSources(response: any): { sources: { title: string; uri: string }[]; usedWebSearch: boolean } {
  const grounding = response.candidates?.[0]?.groundingMetadata;
  const searchQueries: string[] = grounding?.webSearchQueries || [];
  const groundingChunks: any[] = grounding?.groundingChunks || [];
  const sources = groundingChunks
    .map((chunk: any) => ({ title: String(chunk?.web?.title || ''), uri: String(chunk?.web?.uri || '') }))
    .filter((source: { title: string; uri: string }) => source.uri);
  return {
    sources,
    usedWebSearch: searchQueries.length > 0 || groundingChunks.length > 0 || sources.length > 0,
  };
}

function decorateResultChatAnswer(
  answer: string,
  route: ResultAnswerRoute,
  usage?: WebSearchUsage,
  recordOnlyChosen = false,
): string {
  const label = RESULT_ROUTE_LABELS[route];
  const cleanAnswer = clampResultChatText(answer, RESULT_CHAT_ANSWER_MAX_LENGTH);
  const preface: string[] = [label];
  if ((route === 'record_only' || route === 'ambiguous') && recordOnlyChosen) {
    preface.push('현재 외부자료는 확인하지 않았습니다.');
  }
  if (route === 'web_search' && usage) {
    preface.push(`이 결과의 최신자료 확인 ${usage.remainingCount}회 남음`);
  }
  if (cleanAnswer.startsWith(label)) {
    const missingExtra = preface.slice(1).filter((line) => !cleanAnswer.includes(line));
    if (missingExtra.length === 0) return cleanAnswer;
    const rest = cleanAnswer.slice(label.length).trim();
    return `${label}\n${missingExtra.join('\n')}${rest ? `\n\n${rest}` : ''}`;
  }
  return `${preface.join('\n')}\n\n${cleanAnswer}`;
}

async function getRecentResultChatMessages(
  messagesRef: admin.firestore.CollectionReference,
): Promise<Record<string, any>[]> {
  const recentSnap = await messagesRef.orderBy('createdAt', 'desc').limit(RESULT_CHAT_HISTORY_LIMIT).get();
  return recentSnap.docs.map((docSnap) => docSnap.data()).reverse();
}

function formatRecentResultChatMessages(messages: Record<string, any>[]): string {
  return messages
    .map((message) => `${message.role === 'user' ? '사용자' : 'AI'}: ${clampResultChatText(message.content, RESULT_CHAT_HISTORY_ITEM_MAX_LENGTH)}`)
    .join('\n');
}

function findReusableResultChatAnswer(
  messages: Record<string, any>[],
  question: string,
  route: ResultAnswerRoute,
  options: { allowRecentWebSearchMs?: number } = {},
): { answer: string; sources: { title: string; uri: string }[] } | null {
  const normalizedQuestion = normalizeResultChatQuestion(question).toLowerCase();
  for (let i = messages.length - 2; i >= 0; i -= 1) {
    const userMessage = messages[i];
    const assistantMessage = messages[i + 1];
    if (userMessage?.role !== 'user' || assistantMessage?.role !== 'assistant') continue;
    const priorQuestion = normalizeResultChatQuestion(String(userMessage.content || '')).toLowerCase();
    if (priorQuestion !== normalizedQuestion) continue;
    if (assistantMessage.answerRoute !== route) continue;
    if (assistantMessage.webSearchUsed) {
      const createdAtMs = typeof assistantMessage.createdAt?.toMillis === 'function'
        ? assistantMessage.createdAt.toMillis()
        : 0;
      const allowRecent = Boolean(options.allowRecentWebSearchMs)
        && createdAtMs > 0
        && Date.now() - createdAtMs <= Number(options.allowRecentWebSearchMs);
      if (!allowRecent) continue;
    }
    const answer = clampResultChatText(assistantMessage.content, RESULT_CHAT_ANSWER_MAX_LENGTH);
    if (!answer) continue;
    const sources = Array.isArray(assistantMessage.sources) ? assistantMessage.sources : [];
    return { answer, sources };
  }
  return null;
}

async function saveResultChatExchange(params: {
  threadRef: admin.firestore.DocumentReference;
  messagesRef: admin.firestore.CollectionReference;
  question: string;
  answer: string;
  sources: { title: string; uri: string }[];
  sourceKey: string;
  sourceIndex?: number;
  safetyMode: ResultChatSafetyMode;
  answerRoute: ResultAnswerRoute;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  webSearchUsed: boolean;
  professionalApiUsed: boolean;
  cached?: boolean;
  attachmentMeta?: { fileName: string; storagePath: string; mimeType: string }[];
}): Promise<void> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const userMessage: Record<string, unknown> = {
    role: 'user',
    content: params.question,
    createdAt: now,
  };
  if (params.attachmentMeta && params.attachmentMeta.length > 0) {
    userMessage.attachments = params.attachmentMeta;
  }
  await params.messagesRef.add(userMessage);
  await params.messagesRef.add({
    role: 'assistant',
    content: params.answer,
    sources: params.sources.length > 0 ? params.sources : [],
    answerRoute: params.answerRoute,
    routeLabel: RESULT_ROUTE_LABELS[params.answerRoute],
    webSearchUsed: params.webSearchUsed,
    professionalApiUsed: params.professionalApiUsed,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    model: params.model,
    latencyMs: params.latencyMs,
    cached: params.cached === true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await params.threadRef.set({
    sourceKey: params.sourceKey,
    sourceIndex: typeof params.sourceIndex === 'number' ? params.sourceIndex : null,
    safetyMode: params.safetyMode,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    messageCount: admin.firestore.FieldValue.increment(2),
    lastMessagePreview: params.answer.slice(0, 160),
  }, { merge: true });
}

async function logResultChatUsage(params: {
  uid: string;
  actualPlan: UserPlan;
  recordId: string;
  sourceKey: string;
  answerRoute: ResultAnswerRoute;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  webSearchUsed: boolean;
  professionalApiUsed: boolean;
  searchSourceCount: number;
  latencyMs: number | null;
  requestId: string | null;
  success: boolean;
  errorCode: string | null;
  isDev: boolean;
}): Promise<void> {
  await logAiUsage({
    uid: params.uid,
    featureName: 'result_chat',
    plan: params.actualPlan,
    actualPlan: params.actualPlan,
    recordId: params.recordId,
    sourceKey: params.sourceKey,
    answerRoute: params.answerRoute,
    model: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    imageCount: 0,
    externalApiProvider: null,
    externalApiCalled: false,
    groundingUsed: params.webSearchUsed,
    webSearchUsed: params.webSearchUsed,
    professionalApiUsed: params.professionalApiUsed,
    searchSourceCount: params.searchSourceCount,
    latencyMs: params.latencyMs,
    pricingVersion: RESULT_CHAT_COST_PRICING.pricingVersion,
    estimatedModelCost: null,
    estimatedSearchCost: null,
    estimatedTotalCost: null,
    currency: RESULT_CHAT_COST_PRICING.currency,
    requestId: params.requestId,
    success: params.success,
    errorCode: params.errorCode,
    isDev: params.isDev,
  });
}

type HaruLawAttachmentRef = {
  storagePath: string;
  mimeType: string;
  fileName: string;
};
type HaruLawGeminiFilePart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

const HARULAW_ATTACH_MAX_FILES = 5;
const HARULAW_ATTACH_MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const HARULAW_ATTACH_MAX_PDF_BYTES = 50 * 1024 * 1024;

function readHaruLawAttachments(raw: unknown): HaruLawAttachmentRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, HARULAW_ATTACH_MAX_FILES).map((item) => {
    const source = item as Partial<HaruLawAttachmentRef>;
    const storagePath = clampResultChatText(source?.storagePath, 512);
    const mimeType = clampResultChatText(source?.mimeType, 120).toLowerCase();
    const fileName = clampResultChatText(source?.fileName, 180);
    if (!storagePath || !mimeType || !fileName) {
      throw new HttpsError('invalid-argument', '첨부 파일 정보가 올바르지 않습니다.');
    }
    return { storagePath, mimeType, fileName };
  });
}

function isAllowedHaruLawAttachmentMime(mimeType: string): boolean {
  return mimeType === 'application/pdf' || /^image\/[-+.\w]+$/i.test(mimeType);
}

function getHaruLawAttachmentSizeLimit(mimeType: string): number {
  return mimeType.startsWith('image/') ? HARULAW_ATTACH_MAX_IMAGE_BYTES : HARULAW_ATTACH_MAX_PDF_BYTES;
}

async function loadHaruLawAttachmentParts(
  uid: string,
  attachments: HaruLawAttachmentRef[]
): Promise<{ fileParts: HaruLawGeminiFilePart[]; attachmentMeta: HaruLawAttachmentRef[] }> {
  const fileParts: HaruLawGeminiFilePart[] = [];
  const attachmentMeta: HaruLawAttachmentRef[] = [];

  for (const att of attachments) {
    if (!att.storagePath.startsWith(`users/${uid}/haruLawAttachments/`)) {
      throw new HttpsError('permission-denied', '허용되지 않은 파일 경로입니다.');
    }
    if (!isAllowedHaruLawAttachmentMime(att.mimeType)) {
      throw new HttpsError('invalid-argument', '지원하지 않는 파일 형식입니다.');
    }

    const file = bucket().file(att.storagePath);
    let metadata: any;
    try {
      [metadata] = await file.getMetadata();
    } catch (error) {
      logger.warn('하루LAW 첨부 메타데이터 조회 실패:', { storagePath: att.storagePath, message: (error as any)?.message });
      throw new HttpsError('not-found', '첨부 파일을 찾을 수 없습니다.');
    }

    const storedMimeType = String(metadata?.contentType || '').trim().toLowerCase();
    const effectiveMimeType = storedMimeType || att.mimeType;
    if (!isAllowedHaruLawAttachmentMime(effectiveMimeType) || (storedMimeType && storedMimeType !== att.mimeType)) {
      throw new HttpsError('invalid-argument', '첨부 파일 형식이 허용 범위와 다릅니다.');
    }

    const sizeLimit = getHaruLawAttachmentSizeLimit(effectiveMimeType);
    const metadataSize = Number(metadata?.size);
    if (Number.isFinite(metadataSize) && metadataSize > sizeLimit) {
      throw new HttpsError('invalid-argument', '파일 크기가 허용 범위를 초과했습니다.');
    }

    let buf: Buffer;
    try {
      [buf] = await file.download();
    } catch (error) {
      logger.warn('하루LAW 첨부 다운로드 실패:', { storagePath: att.storagePath, message: (error as any)?.message });
      throw new HttpsError('not-found', '첨부 파일을 다운로드하지 못했습니다.');
    }
    if (buf.length > sizeLimit) {
      throw new HttpsError('invalid-argument', '파일 크기가 허용 범위를 초과했습니다.');
    }

    fileParts.push({ inlineData: { mimeType: effectiveMimeType, data: buf.toString('base64') } });
    attachmentMeta.push({ storagePath: att.storagePath, mimeType: effectiveMimeType, fileName: att.fileName });
  }

  return { fileParts, attachmentMeta };
}

export const chatWithResult = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 90,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    const rawQuestion = String(request.data?.question || '').trim();
    const recordId = clampResultChatText(request.data?.recordId, 160);
    const sourceKey = clampResultChatText(request.data?.sourceKey, 80);
    const question = clampResultChatText(rawQuestion, RESULT_CHAT_QUESTION_MAX_LENGTH);
    const safetyMode = clampResultChatText(request.data?.safetyMode, 40);
    const searchPreference = getResultChatSearchPreference(request.data?.searchPreference);
    const rawSourceIndex = request.data?.sourceIndex;
    const sourceIndex = typeof rawSourceIndex === 'number' && Number.isInteger(rawSourceIndex)
      ? rawSourceIndex
      : undefined;
    const attachments = readHaruLawAttachments(request.data?.attachments);

    if (rawQuestion.length > RESULT_CHAT_QUESTION_MAX_LENGTH) {
      throw new HttpsError('invalid-argument', '질문이 너무 깁니다. 핵심 내용을 조금 줄여 주세요.');
    }
    if (!recordId || !sourceKey || !question) {
      throw new HttpsError('invalid-argument', 'recordId, sourceKey, question이 필요합니다.');
    }
    const policy = RESULT_CHAT_SOURCE_POLICIES[sourceKey];
    if (!policy) {
      throw new HttpsError('invalid-argument', '지원하지 않는 결과 대화 항목입니다.');
    }
    if (safetyMode && !RESULT_CHAT_ALLOWED_SAFETY_MODES.has(policy.safetyMode)) {
      throw new HttpsError('invalid-argument', '지원하지 않는 safetyMode입니다.');
    }

    const recordRef = db.collection('users').doc(uid).collection('records').doc(recordId);
    const recordSnap = await recordRef.get();
    if (!recordSnap.exists) {
      throw new HttpsError('not-found', '기록을 찾을 수 없습니다.');
    }

    const record = recordSnap.data() || {};
    let sourceResult = clampResultChatText(getRecordResultBySourceKey(record, sourceKey, sourceIndex), RESULT_CHAT_SOURCE_MAX_LENGTH);
    // _sayu 결과물이 없으면(원문만 저장했거나 과거 기록) 원문 본문으로 폴백해 대화 가능하게
    if (!sourceResult && sourceKey.endsWith('_sayu')) {
      const prefix = sourceKey.split('_')[0];
      sourceResult = clampResultChatText(getRecordOriginalContentByPrefix(record, prefix), RESULT_CHAT_SOURCE_MAX_LENGTH);
    }
    if (!sourceResult) {
      throw new HttpsError('failed-precondition', '대화할 결과물이 없습니다.');
    }

    const threadId = getResultThreadId(sourceKey, sourceIndex);
    const threadRef = recordRef.collection('resultThreads').doc(threadId);
    const messagesRef = threadRef.collection('messages');
    const actualPlan = coerceUserPlan(await getUserPlan(uid));
    const isDev = DEVELOPER_UIDS.has(uid);
    const requestId = createAiUsageRequestId();
    let locked = false;
    let reservedWebSearch = false;
    let webSearchFinalized = false;
    let monthlyQuotaReservation: MonthlyAiQuotaReservation | null = null;

    try {
      await acquireResultChatLock(threadRef, requestId);
      locked = true;
      await enforceResultChatRateLimit(uid);

      if (attachments.length > 0) {
        if (sourceKey !== 'haruraw_sayu') {
          throw new HttpsError('failed-precondition', '첨부는 하루LAW 자문에서만 사용할 수 있습니다.');
        }
        if (actualPlan === 'free') {
          throw new HttpsError('permission-denied', '파일 첨부는 베이직·프리미엄 이용권 전용 기능입니다.');
        }
      }
      monthlyQuotaReservation = await reserveMonthlyAiQuota(uid, 'chatWithResult');

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY_SECRET.value() });
      const classification = await classifyResultChatQuestion(ai, {
        uid,
        actualPlan,
        recordId,
        sourceKey,
        question,
        sourceResult,
        requestId,
        isDev,
      });
      const currentUsage = await getThreadWebSearchUsage(threadRef, actualPlan);
      let answerRoute: ResultAnswerRoute = classification.route;
      let recordOnlyChosen = false;

      if (searchPreference === 'record_only') {
        if (answerRoute === 'high_risk_guidance') {
          answerRoute = 'high_risk_guidance';
        } else if (answerRoute === 'web_search') {
          await rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation);
          monthlyQuotaReservation = null;
          return {
            threadId,
            answer: '',
            sources: [],
            answerRoute,
            routeLabel: RESULT_ROUTE_LABELS.web_search,
            requiresConfirmation: true,
            confirmationType: 'web_search',
            notice: buildWebSearchNotice(actualPlan, currentUsage),
            plan: actualPlan,
            planLabel: RESULT_CHAT_PLAN_LABELS[actualPlan],
            webSearchLimit: currentUsage.limit,
            webSearchUsedCount: currentUsage.usedCount,
            webSearchRemainingCount: currentUsage.remainingCount,
          };
        } else {
          answerRoute = 'record_only';
          recordOnlyChosen = true;
        }
      } else if (searchPreference === 'web_confirmed') {
        if (answerRoute === 'high_risk_guidance') {
          answerRoute = 'high_risk_guidance';
        } else if (answerRoute !== 'record_only') {
          answerRoute = 'web_search';
        }
      } else if (answerRoute === 'web_search') {
        await rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation);
        monthlyQuotaReservation = null;
        return {
          threadId,
          answer: '',
          sources: [],
          answerRoute,
          routeLabel: RESULT_ROUTE_LABELS.web_search,
          requiresConfirmation: true,
          confirmationType: 'web_search',
          notice: buildWebSearchNotice(actualPlan, currentUsage),
          plan: actualPlan,
          planLabel: RESULT_CHAT_PLAN_LABELS[actualPlan],
          webSearchLimit: currentUsage.limit,
          webSearchUsedCount: currentUsage.usedCount,
          webSearchRemainingCount: currentUsage.remainingCount,
        };
      } else if (answerRoute === 'ambiguous') {
        await rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation);
        monthlyQuotaReservation = null;
        return {
          threadId,
          answer: '',
          sources: [],
          answerRoute,
          routeLabel: RESULT_ROUTE_LABELS.ambiguous,
          requiresConfirmation: true,
          confirmationType: 'ambiguous',
          notice: buildAmbiguousNotice(actualPlan, currentUsage),
          plan: actualPlan,
          planLabel: RESULT_CHAT_PLAN_LABELS[actualPlan],
          webSearchLimit: currentUsage.limit,
          webSearchUsedCount: currentUsage.usedCount,
          webSearchRemainingCount: currentUsage.remainingCount,
        };
      }

      const recentMessageRows = await getRecentResultChatMessages(messagesRef);
      const reusable = attachments.length > 0
        ? null
        : answerRoute !== 'web_search'
          ? findReusableResultChatAnswer(recentMessageRows, question, answerRoute)
          : findReusableResultChatAnswer(recentMessageRows, question, answerRoute, { allowRecentWebSearchMs: RESULT_CHAT_LOCK_STALE_MS });
      if (reusable) {
        if (answerRoute === 'web_search') {
          return {
            threadId,
            answer: reusable.answer,
            sources: reusable.sources,
            answerRoute,
            routeLabel: RESULT_ROUTE_LABELS[answerRoute],
            webSearchUsed: true,
            professionalApiUsed: false,
            plan: actualPlan,
            planLabel: RESULT_CHAT_PLAN_LABELS[actualPlan],
            webSearchLimit: currentUsage.limit,
            webSearchUsedCount: currentUsage.usedCount,
            webSearchRemainingCount: currentUsage.remainingCount,
            cached: true,
          };
        }
        const latencyMs = 0;
        await saveResultChatExchange({
          threadRef,
          messagesRef,
          question,
          answer: reusable.answer,
          sources: reusable.sources,
          sourceKey,
          sourceIndex,
          safetyMode: policy.safetyMode,
          answerRoute,
          model: null,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs,
          webSearchUsed: false,
          professionalApiUsed: false,
          cached: true,
        });
        await logResultChatUsage({
          uid,
          actualPlan,
          recordId,
          sourceKey,
          answerRoute,
          model: null,
          inputTokens: 0,
          outputTokens: 0,
          webSearchUsed: false,
          professionalApiUsed: false,
          searchSourceCount: reusable.sources.length,
          latencyMs,
          requestId,
          success: true,
          errorCode: null,
          isDev,
        });
        return {
          threadId,
          answer: reusable.answer,
          sources: reusable.sources,
          answerRoute,
          routeLabel: RESULT_ROUTE_LABELS[answerRoute],
          webSearchUsed: false,
          professionalApiUsed: false,
          plan: actualPlan,
          planLabel: RESULT_CHAT_PLAN_LABELS[actualPlan],
          webSearchLimit: currentUsage.limit,
          webSearchUsedCount: currentUsage.usedCount,
          webSearchRemainingCount: currentUsage.remainingCount,
        };
      }

      let usageForAnswer = currentUsage;
      if (answerRoute === 'web_search') {
        const reserved = await reserveWebSearchSlot(threadRef, actualPlan, sourceKey, sourceIndex);
        if (!reserved.reserved) {
          await rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation);
          monthlyQuotaReservation = null;
          await logResultChatUsage({
            uid,
            actualPlan,
            recordId,
            sourceKey,
            answerRoute,
            model: null,
            inputTokens: null,
            outputTokens: null,
            webSearchUsed: false,
            professionalApiUsed: false,
            searchSourceCount: 0,
            latencyMs: null,
            requestId,
            success: false,
            errorCode: 'web_search_limit_reached',
            isDev,
          });
          return {
            threadId,
            answer: '',
            sources: [],
            answerRoute,
            routeLabel: RESULT_ROUTE_LABELS.web_search,
            limitReached: true,
            notice: buildWebSearchExhaustedNotice(),
            plan: actualPlan,
            planLabel: RESULT_CHAT_PLAN_LABELS[actualPlan],
            webSearchLimit: reserved.limit,
            webSearchUsedCount: reserved.usedCount,
            webSearchRemainingCount: reserved.remainingCount,
          };
        }
        reservedWebSearch = true;
        usageForAnswer = reserved;
      }

      const prompt = buildResultChatPrompt({
        sourceResult,
        recentMessages: formatRecentResultChatMessages(recentMessageRows),
        question,
        route: answerRoute,
        safetyMode: policy.safetyMode,
        systemGuide: policy.systemGuide,
        recordOnlyChosen,
      });
      const { fileParts, attachmentMeta } = attachments.length > 0
        ? await loadHaruLawAttachmentParts(uid, attachments)
        : { fileParts: [] as HaruLawGeminiFilePart[], attachmentMeta: [] as HaruLawAttachmentRef[] };
      const contents: any = fileParts.length > 0
        ? [{ role: 'user', parts: [{ text: prompt }, ...fileParts] }]
        : prompt;
      const startedAt = Date.now();
      const response = await ai.models.generateContent({
        model: RESULT_CHAT_MODEL_NAME,
        contents,
        config: answerRoute === 'web_search'
          ? { tools: [{ googleSearch: {} }], maxOutputTokens: RESULT_CHAT_MAX_OUTPUT_TOKENS }
          : { maxOutputTokens: RESULT_CHAT_MAX_OUTPUT_TOKENS },
      });

      const latencyMs = Date.now() - startedAt;
      const rawAnswer = clampResultChatText(response.text || '', RESULT_CHAT_ANSWER_MAX_LENGTH);
      const finishReason = response.candidates?.[0]?.finishReason;
      const { sources, usedWebSearch } = answerRoute === 'web_search'
        ? getResultChatSources(response)
        : { sources: [] as { title: string; uri: string }[], usedWebSearch: false };
      if (answerRoute === 'web_search' && !usedWebSearch) {
        logger.warn('chatWithResult web_search_not_grounded 진단:', {
          finishReason,
          hasCandidates: (response.candidates?.length ?? 0) > 0,
          hasGroundingMetadata: !!response.candidates?.[0]?.groundingMetadata,
          webSearchQueriesCount: response.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ?? 0,
          groundingChunksCount: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length ?? 0,
          recordId,
          sourceKey,
        });
        throw new Error('web_search_not_grounded');
      }

      if (answerRoute === 'web_search') {
        usageForAnswer = await finalizeWebSearchSlot(threadRef, actualPlan, true);
        webSearchFinalized = true;
      }

      const answer = decorateResultChatAnswer(rawAnswer, answerRoute, usageForAnswer, recordOnlyChosen);
      if (!answer) {
        throw new Error('empty_answer');
      }

      const gUsage = response.usageMetadata;
      await logResultChatUsage({
        uid,
        actualPlan,
        recordId,
        sourceKey,
        answerRoute,
        model: RESULT_CHAT_MODEL_NAME,
        inputTokens: gUsage?.promptTokenCount ?? null,
        outputTokens: gUsage?.candidatesTokenCount ?? null,
        webSearchUsed: answerRoute === 'web_search' && usedWebSearch,
        professionalApiUsed: false,
        searchSourceCount: sources.length,
        latencyMs,
        requestId,
        success: true,
        errorCode: null,
        isDev,
      });

      await saveResultChatExchange({
        threadRef,
        messagesRef,
        question,
        answer,
        sources,
        sourceKey,
        sourceIndex,
        safetyMode: policy.safetyMode,
        answerRoute,
        model: RESULT_CHAT_MODEL_NAME,
        inputTokens: gUsage?.promptTokenCount ?? null,
        outputTokens: gUsage?.candidatesTokenCount ?? null,
        latencyMs,
        webSearchUsed: answerRoute === 'web_search' && usedWebSearch,
        professionalApiUsed: false,
        attachmentMeta: attachmentMeta.length > 0 ? attachmentMeta : undefined,
      });

      return {
        threadId,
        answer,
        sources,
        answerRoute,
        routeLabel: RESULT_ROUTE_LABELS[answerRoute],
        webSearchUsed: answerRoute === 'web_search' && usedWebSearch,
        professionalApiUsed: false,
        plan: actualPlan,
        planLabel: RESULT_CHAT_PLAN_LABELS[actualPlan],
        webSearchLimit: usageForAnswer.limit,
        webSearchUsedCount: usageForAnswer.usedCount,
        webSearchRemainingCount: usageForAnswer.remainingCount,
      };
    } catch (error: any) {
      await rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation);
      if (reservedWebSearch && !webSearchFinalized) {
        await finalizeWebSearchSlot(threadRef, actualPlan, false);
      }
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('chatWithResult 실패:', {
        errorName: error?.name,
        errorMessage: error?.message,
        errorStatus: error?.status,
        errorCode: error?.code,
        errorCause: String(error?.cause ?? ''),
        stack: error?.stack,
        recordId,
        sourceKey,
        safetyMode,
      });
      await logResultChatUsage({
        uid,
        actualPlan,
        recordId,
        sourceKey,
        answerRoute: 'ambiguous',
        model: null,
        inputTokens: null,
        outputTokens: null,
        webSearchUsed: false,
        professionalApiUsed: false,
        searchSourceCount: 0,
        latencyMs: null,
        requestId,
        success: false,
        errorCode: getAiUsageErrorCode(error),
        isDev,
      });
      throw new HttpsError('internal', 'AI 응답 생성에 실패했습니다.');
    } finally {
      if (locked) await releaseResultChatLock(threadRef, requestId);
    }
  }
);

// ===== 🏷️ 기존 기록 AI 제목 일괄 생성 =====
export const generateTitlesForAll = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    if (!isInternalDeveloperUid(request.auth.uid)) {
      throw new HttpsError('permission-denied', '개발자 전용 기능입니다');
    }
    const uid = request.auth.uid;

    const FORMAT_PREFIX_MAP: Record<string, string> = {
      '일기': 'diary', '에세이': 'essay', '선교보고': 'mission',
      '일반보고': 'report', '업무일지': 'work', '여행기록': 'travel',
      '텃밭일지': 'garden', '애완동물관찰일지': 'pet', '육아일기': 'child', '메모': 'memo',
    };
    const EXCLUDE_ENDINGS = [
      '_images', '_style', '_sayu', '_rating', '_polished',
      '_polishedAt', '_mode', '_stats', '_space', '_title', '_tags',
    ];

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const snapshot = await db
      .collection('users').doc(uid).collection('records')
      .limit(500)
      .get();

    let count = 0;

    for (const docSnap of snapshot.docs) {
      const record = docSnap.data();
      const formats: string[] = record.formats || [];
      const updates: Record<string, string> = {};

      for (const format of formats) {
        const prefix = FORMAT_PREFIX_MAP[format];
        if (!prefix) continue;
        const existingTitle = record[`${prefix}_title`] as string | undefined;
        // 유효한 제목이 이미 있으면 스킵, 숫자·기호만인 잘못된 제목은 덮어씀
        if (existingTitle && isValidTitle(existingTitle)) continue;

        const simpleContent: string = record[`${prefix}_simple`] || '';
        const fieldContent = Object.entries(record)
          .filter(([key]) =>
            key.startsWith(`${prefix}_`) &&
            !EXCLUDE_ENDINGS.some((s) => key.endsWith(s)) &&
            key !== `${prefix}_simple`
          )
          .map(([, v]) => v)
          .filter((v) => typeof v === 'string' && (v as string).trim())
          .join(' ');

        const contentForTitle = (simpleContent || fieldContent).trim();
        if (!contentForTitle) continue;

        try {
          const prompt = `다음 기록의 핵심을 담은 짧은 제목을 만들어주세요.
제목만 한 줄로 출력하세요. 10자 이내. 따옴표·마크다운 기호(*, #) 없이 텍스트만.

기록 형식: ${format}
기록 내용:
${contentForTitle.slice(0, 600)}`;

          const result = await model.generateContent(prompt);
          const raw = result.response.text().trim();
          const title = raw
            .replace(/^\*\*(.+)\*\*$/, '$1')
            .replace(/^["']|["']$/g, '')
            .trim()
            .slice(0, 20);

          if (isValidTitle(title)) {
            updates[`${prefix}_ai_title`] = title;
            count++;
          }
        } catch (err) {
          logger.error(`제목 추출 실패 (${docSnap.id}, ${format}):`, err);
        }
      }

      if (Object.keys(updates).length > 0) {
        await docSnap.ref.update({ ...updates, updatedAt: new Date().toISOString() });
      }
    }

    return { count };
  }
);

// ===== 📊 형식별 통계 분석 프롬프트 정의 =====
const STATS_PROMPTS: Record<string, string> = {
  // Type 1: 숫자형 (0~1 비율)
  diary: `다음은 일기 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. positivity_ratio: 긍정적 표현(기쁨, 감사, 행복, 좋았다 등) 비율 (0~1)
2. learning_ratio: 배움/깨달음 표현이 있으면 1, 없으면 0
3. space_ratio: 미래 계획/바람 표현이 있으면 1, 없으면 0
4. energy_level: 에너지 수준 1~5 (피곤=1, 보통=3, 활발=5)
5. conflict_with_learning: 갈등/어려움이 있고 동시에 배움도 있으면 true

JSON만 출력:
{
  "positivity_ratio": 0.75,
  "learning_ratio": 1,
  "space_ratio": 1,
  "energy_level": 4,
  "conflict_with_learning": true
}`,

  // Type 2: 태그형 (문자열 배열)
  essay: `다음은 에세이 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. theme: 주제 1~2개 (배열)
2. emotionPrimary: 주감정 1개 (문자열)
3. emotionSecondary: 보조감정 0~2개 (배열)
4. people: 관계 대상 0~3개 (배열)
5. actions: 행동/사건 1~3개 (배열)
6. lesson: 배움/깨달음 1개 (문자열)
7. lifeArea: 인생영역 1개 (문자열)
8. tone: 문체 톤 1개 (문자열)

JSON만 출력:
{
  "theme": ["가족", "돌봄"],
  "emotionPrimary": "감사",
  "emotionSecondary": ["아쉬움", "평안"],
  "people": ["아내", "장모님", "나"],
  "actions": ["병원 방문", "돌봄", "회상"],
  "lesson": "배려",
  "lifeArea": "가족",
  "tone": "차분함"
}`,

  mission: `다음은 선교보고 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. placeType: 장소 유형 1개 (교회/가정집/복지시설/지역사회/의료시설/선교지/기타)
2. actions: 활동 1~3개 (배열)
3. graceType: 은혜 유형 1개 (문자열)
4. heartPrimary: 주요 마음 1개 (문자열)
5. heartSecondary: 보조 마음 0~2개 (배열)
6. prayerFocus: 기도제목 1~3개 (배열)
7. ministryArea: 사역 영역 1개 (문자열)

JSON만 출력:
{
  "placeType": "가정집",
  "actions": ["심방", "기도"],
  "graceType": "위로",
  "heartPrimary": "감사",
  "heartSecondary": ["겸손"],
  "prayerFocus": ["건강 회복"],
  "ministryArea": "심방/돌봄"
}`,

  // Type 3: 단계형 (1~5 점수)
  report: `다음은 일반보고 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. completion_rate: 완료율 1~5 (1=시작전, 3=절반, 5=완료)
2. issue_awareness: 문제인식 1~5 (1=없음, 3=일부인식, 5=명확)
3. planning_quality: 계획수립 1~5 (1=없음, 3=기본, 5=구체적)
4. positivity_ratio: 긍정성 1~5 (1=부정, 3=혼합, 5=긍정)

JSON만 출력:
{
  "completion_rate": 4,
  "issue_awareness": 3,
  "planning_quality": 4,
  "positivity_ratio": 4
}`,

  work: `다음은 업무일지 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. task_completion: 업무완료율 1~5 (1=거의못함, 3=절반, 5=완료)
2. productivity_score: 생산성 1~5 (1=낮음, 3=보통, 5=높음)
3. self_evaluation: 자기평가 1~5 (1=아쉬움, 3=보통, 5=만족)
4. positivity_ratio: 긍정성 1~5 (1=부정, 3=혼합, 5=긍정)

JSON만 출력:
{
  "task_completion": 4,
  "productivity_score": 4,
  "self_evaluation": 3,
  "positivity_ratio": 4
}`,

  travel: `다음은 여행기록 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. experience_richness: 경험 풍부도 1~5 (1=단조, 3=보통, 5=다채)
2. gratitude_level: 감사 수준 1~5 (1=없음, 3=보통, 5=깊음)
3. reflection_depth: 성찰 깊이 1~5 (1=없음, 3=기본, 5=깊음)
4. positivity_ratio: 긍정성 1~5 (1=부정, 3=혼합, 5=긍정)

JSON만 출력:
{
  "experience_richness": 4,
  "gratitude_level": 5,
  "reflection_depth": 4,
  "positivity_ratio": 5
}`,

  garden: `다음은 텃밭일지 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. crop_diversity: 작물 다양성 1~5 (1=1종, 3=3-4종, 5=7종+)
2. observation_detail: 관찰 상세도 1~5 (1=단순, 3=보통, 5=세밀)
3. issue_management: 문제 관리 1~5 (1=없음, 3=일부대응, 5=명확)
4. positivity_ratio: 긍정성 1~5 (1=부정, 3=혼합, 5=긍정)

JSON만 출력:
{
  "crop_diversity": 3,
  "observation_detail": 4,
  "issue_management": 4,
  "positivity_ratio": 4
}`,

  pet: `다음은 애완동물관찰일지 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. care_attention: 돌봄 관심도 1~5 (1=단순, 3=기본, 5=세밀)
2. emotional_bond: 감정적 유대 1~5 (1=약함, 3=보통, 5=깊음)
3. health_awareness: 건강 인식 1~5 (1=없음, 3=기본, 5=세밀)
4. positivity_ratio: 긍정성 1~5 (1=부정, 3=혼합, 5=긍정)

JSON만 출력:
{
  "care_attention": 4,
  "emotional_bond": 5,
  "health_awareness": 4,
  "positivity_ratio": 5
}`,

  child: `다음은 육아일기 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. growth_observation: 성장 관찰력 1~5 (1=단순, 3=기본, 5=세밀)
2. emotional_understanding: 감정 이해 1~5 (1=없음, 3=기본, 5=깊음)
3. learning_support: 배움 지원 1~5 (1=약함, 3=기본, 5=적절)
4. positivity_ratio: 긍정성 1~5 (1=부정, 3=혼합, 5=긍정)

JSON만 출력:
{
  "growth_observation": 4,
  "emotional_understanding": 4,
  "learning_support": 5,
  "positivity_ratio": 5
}`,

  memo: `다음은 메모 내용입니다. 분석해서 JSON으로 반환하세요.

분석 기준:
1. idea_clarity: 아이디어 명확도 1~5 (1=모호, 3=보통, 5=명확)
2. action_specificity: 행동 구체성 1~5 (1=없음, 3=일부, 5=구체적)
3. content_richness: 내용 풍부도 1~5 (1=단순, 3=보통, 5=풍부)
4. positivity_ratio: 긍정성 1~5 (1=부정, 3=혼합, 5=긍정)

JSON만 출력:
{
  "idea_clarity": 4,
  "action_specificity": 3,
  "content_richness": 4,
  "positivity_ratio": 4
}`
};

// ===== 📊 범용 통계 분석 함수 =====
async function analyzeStats(
  text: string,
  format: string,
  apiKey: string,
  usageContext?: { uid: string; featureName: string; isDev: boolean }
) {
  try {
    const prompt = STATS_PROMPTS[format];
    if (!prompt) {
      console.log(`No stats prompt for format: ${format}`);
      return null;
    }

    const analysisPrompt = `${prompt}

기록 내용:
${text}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = 'gemini-3.1-flash-lite';
    const model = genAI.getGenerativeModel({ 
      model: modelName
    });

    const result = await model.generateContent(analysisPrompt);
    if (usageContext) {
      const usage = getGeminiUsage(result);
      await logAiUsage({
        uid: usageContext.uid,
        featureName: usageContext.featureName,
        plan: AI_USAGE_PLAN,
        model: modelName,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        imageCount: 0,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: usageContext.isDev,
      });
    }
    const responseText = result.response.text();
    
    // JSON 파싱
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const stats = JSON.parse(jsonMatch[0]);
      stats.analyzed_at = new Date().toISOString();
      return stats;
    }

    console.error('JSON 파싱 실패:', responseText);
    return null;

  } catch (error) {
    console.error('통계 분석 실패:', error);
    if (usageContext) {
      await logAiUsage({
        uid: usageContext.uid,
        featureName: usageContext.featureName,
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
        isDev: usageContext.isDev,
      });
    }
    return null;
  }
}

// ===== 🟡 카카오 로그인 시작 =====
export const kakaoLoginStart = onRequest(
  { region: 'asia-northeast3', secrets: [KAKAO_CLIENT_ID_SECRET, KAKAO_CLIENT_SECRET_SECRET] },
  async (req, res) => {
    try {
      const state = crypto.randomBytes(32).toString('hex');

      await db.collection('oauth_states').doc(state).set({
        provider: 'kakao',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
      });

      const kakaoAuthUrl =
        `https://kauth.kakao.com/oauth/authorize?` +
        `client_id=${KAKAO_CLIENT_ID_SECRET.value().trim()}&` +
        `redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=account_email&` +
        `state=${state}`;

      res.redirect(kakaoAuthUrl);
    } catch (error) {
      logger.error('❌ 카카오 로그인 시작 실패:', error);
      res.redirect(`${FRONTEND_URL}/login?error=start_failed`);
    }
  }
);

// ===== 🟡 카카오 콜백 (통합 UID 적용) =====
export const kakaoCallback = onRequest(
  { region: 'asia-northeast3', secrets: [KAKAO_CLIENT_ID_SECRET, KAKAO_CLIENT_SECRET_SECRET] },
  async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || typeof code !== 'string') throw new Error('Invalid code');
      if (!state || typeof state !== 'string') throw new Error('Invalid state');

      const stateDoc = await db.collection('oauth_states').doc(state).get();
      if (!stateDoc.exists) throw new Error('State not found');

      const stateData = stateDoc.data();
      if (stateData?.expiresAt.toMillis() < Date.now()) {
        throw new Error('State expired');
      }

      await stateDoc.ref.delete();

      const kakaoTokenParams: Record<string, string | string[] | undefined> = {
        grant_type: 'authorization_code',
        client_id: KAKAO_CLIENT_ID_SECRET.value().trim(),
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
      };
      const kakaoClientSecret = KAKAO_CLIENT_SECRET_SECRET.value().trim();
      if (kakaoClientSecret) {
        kakaoTokenParams.client_secret = kakaoClientSecret;
      }

      let tokenResponse;
      try {
        tokenResponse = await axios.post(
          'https://kauth.kakao.com/oauth/token',
          null,
          {
            params: kakaoTokenParams,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
      } catch (tokenError: any) {
        const data = axios.isAxiosError(tokenError) ? tokenError.response?.data : null;
        if (
          kakaoClientSecret &&
          tokenError?.response?.status === 401 &&
          data?.error === 'invalid_client'
        ) {
          logger.warn('카카오 client_secret 거절됨. client_secret 없이 토큰 교환 재시도');
          const { client_secret, ...retryParams } = kakaoTokenParams;
          tokenResponse = await axios.post(
            'https://kauth.kakao.com/oauth/token',
            null,
            {
              params: retryParams,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          );
        } else {
          throw tokenError;
        }
      }

      const { access_token } = tokenResponse.data;

      const userResponse = await axios.get(
        'https://kapi.kakao.com/v2/user/me',
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const kakaoUser = userResponse.data;

      if (!kakaoUser.id) {
        throw new Error('카카오 사용자 ID를 가져올 수 없습니다');
      }

      const email = kakaoUser.kakao_account?.email || `kakao_${kakaoUser.id}@placeholder.local`;
      const displayName =
        kakaoUser.kakao_account?.profile?.nickname || `kakao_user_${kakaoUser.id}`;

      // 🔑 통합 UID 생성/조회
      const uid = await getOrCreateUnifiedUid(email, 'kakao');

      // photoURL 완전히 제거 - 카카오는 photoURL 없이 생성
      try {
        await admin.auth().updateUser(uid, { email, displayName });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          await admin.auth().createUser({ uid, email, displayName });
        } else throw error;
      }

      const customToken = await admin.auth().createCustomToken(uid);

      res.redirect(
        `${FRONTEND_URL}/auth/callback?customToken=${customToken}&provider=kakao`
      );

    } catch (error: any) {
      logger.error('❌ 카카오 콜백 실패:', getSafeOAuthError(error));
      res.redirect(
        `${FRONTEND_URL}/login?error=kakao_login_failed`
      );
    }
  }
);

// ===== 🟢 네이버 로그인 시작 =====
export const naverLoginStart = onRequest(
  { region: 'asia-northeast3', secrets: [NAVER_CLIENT_ID_SECRET, NAVER_CLIENT_SECRET_SECRET] },
  async (req, res) => {
    try {
      const state = crypto.randomBytes(32).toString('hex');

      await db.collection('oauth_states').doc(state).set({
        provider: 'naver',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
      });

      const naverAuthUrl =
        `https://nid.naver.com/oauth2.0/authorize?` +
        `client_id=${NAVER_CLIENT_ID_SECRET.value().trim()}&` +
        `redirect_uri=${encodeURIComponent(NAVER_REDIRECT_URI)}&` +
        `response_type=code&` +
        `state=${state}`;

      res.redirect(naverAuthUrl);
    } catch (error) {
      logger.error('❌ 네이버 로그인 시작 실패:', error);
      res.redirect(`${FRONTEND_URL}/login?error=start_failed`);
    }
  }
);

// ===== 🟢 네이버 콜백 (통합 UID 적용) =====
export const naverCallback = onRequest(
  { region: 'asia-northeast3', secrets: [NAVER_CLIENT_ID_SECRET, NAVER_CLIENT_SECRET_SECRET] },
  async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!state || typeof state !== 'string') throw new Error('Invalid state');

      const stateDoc = await db.collection('oauth_states').doc(state).get();
      if (!stateDoc.exists) throw new Error('State not found');

      const stateData = stateDoc.data();
      if (stateData?.expiresAt.toMillis() < Date.now()) {
        throw new Error('State expired');
      }

      await stateDoc.ref.delete();

      const tokenResponse = await axios.post(
        'https://nid.naver.com/oauth2.0/token',
        null,
        {
          params: {
            grant_type: 'authorization_code',
            client_id: NAVER_CLIENT_ID_SECRET.value().trim(),
            client_secret: NAVER_CLIENT_SECRET_SECRET.value().trim(),
            redirect_uri: NAVER_REDIRECT_URI,
            code,
            state,
          },
        }
      );

      const { access_token } = tokenResponse.data;

      const userResponse = await axios.get(
        'https://openapi.naver.com/v1/nid/me',
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const naverUser = userResponse.data.response;

      const email = naverUser.email || `naver_${naverUser.id}@placeholder.local`;
      const displayName = naverUser.name || `naver_user_${naverUser.id}`;
      
      // 🔑 통합 UID 생성/조회
      const uid = await getOrCreateUnifiedUid(email, 'naver');
      
      // photoURL 완전히 제거 - 네이버는 photoURL 없이 생성
      try {
        await admin.auth().updateUser(uid, { email, displayName });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          await admin.auth().createUser({ uid, email, displayName });
        } else throw error;
      }

      const customToken = await admin.auth().createCustomToken(uid);

      res.redirect(
        `${FRONTEND_URL}/auth/callback?customToken=${customToken}&provider=naver`
      );

    } catch (error: any) {
      console.error('❌ 네이버 콜백 실패:', error);
      res.redirect(
        `${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }
);

// ===== 🔵 구글 로그인 시작 =====
export const googleLoginStart = onRequest(
  { 
    region: 'asia-northeast3',
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET]  // 🔐 Secret 연결
  },
  async (req, res) => {
    try {
      const GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID_SECRET.value();  // 🔐 Secret 값 사용
      
      const state = crypto.randomBytes(32).toString('hex');

      await db.collection('oauth_states').doc(state).set({
        provider: 'google',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
      });

      const googleAuthUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=email profile&` +
        `state=${state}`;

      res.redirect(googleAuthUrl);
    } catch (error) {
      console.error('❌ 구글 로그인 시작 실패:', error);
      res.redirect(`${FRONTEND_URL}/login?error=start_failed`);
    }
  }
);

// ===== 🔵 구글 콜백 (통합 UID 적용) =====
export const googleCallback = onRequest(
  { 
    region: 'asia-northeast3',
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET]  // 🔐 Secret 연결
  },
  async (req, res) => {
    try {
      const GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID_SECRET.value();  // 🔐 Secret 값 사용
      const GOOGLE_CLIENT_SECRET = GOOGLE_CLIENT_SECRET_SECRET.value();  // 🔐 Secret 값 사용
      
      const { code, state } = req.query;

      if (!state || typeof state !== 'string') throw new Error('Invalid state');

      const stateDoc = await db.collection('oauth_states').doc(state).get();
      if (!stateDoc.exists) throw new Error('State not found');

      const stateData = stateDoc.data();
      if (stateData?.expiresAt.toMillis() < Date.now()) {
        throw new Error('State expired');
      }

      await stateDoc.ref.delete();

      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }
      );

      const { access_token } = tokenResponse.data;

      const userResponse = await axios.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const googleUser = userResponse.data;

      const email = googleUser.email;
      const displayName = googleUser.name || `google_user_${googleUser.id}`;
      const photoURL = googleUser.picture || null;

      // 🔑 통합 UID 생성/조회
      const uid = await getOrCreateUnifiedUid(email, 'google');

      try {
        await admin.auth().updateUser(uid, { email, displayName, photoURL });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          await admin.auth().createUser({ uid, email, displayName, photoURL });
        } else throw error;
      }

      const customToken = await admin.auth().createCustomToken(uid);

      res.redirect(
        `${FRONTEND_URL}/auth/callback?customToken=${customToken}&provider=google`
      );

    } catch (error: any) {
      console.error('❌ 구글 콜백 실패:', error);
      res.redirect(
        `${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }
);

type DriveTokenData = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: admin.firestore.Timestamp;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
};

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const HARU_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.file',
];
const DRIVE_FILE_FIELDS = 'id,name,mimeType,modifiedTime,webViewLink,iconLink,thumbnailLink';
const DRIVE_FILE_FIELDS_PARAM = `files(${DRIVE_FILE_FIELDS})`;

function driveTokenRef(uid: string) {
  return db.doc(`users/${uid}/integrations/googleDrive`);
}

function isHaruAssetCandidate(file: DriveFile): boolean {
  const mimeType = file.mimeType || '';
  return (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('image/') ||
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/vnd.google-apps.spreadsheet' ||
    mimeType === 'application/vnd.google-apps.presentation'
  );
}

function getDriveFileKind(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return '이미지';
  if (mimeType === 'application/vnd.google-apps.document') return '문서';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return '스프레드시트';
  if (mimeType === 'application/vnd.google-apps.presentation') return '프레젠테이션';
  return '파일';
}

async function refreshDriveAccessToken(uid: string, tokenData: DriveTokenData): Promise<string> {
  const expiresAt = tokenData.expiresAt?.toMillis() || 0;
  if (tokenData.accessToken && expiresAt > Date.now() + 60 * 1000) {
    return tokenData.accessToken;
  }

  if (!tokenData.refreshToken) {
    throw new HttpsError('failed-precondition', 'Google Drive 연결이 만료되었습니다. 다시 연결해 주세요.');
  }

  const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: GOOGLE_CLIENT_ID_SECRET.value(),
    client_secret: GOOGLE_CLIENT_SECRET_SECRET.value(),
    refresh_token: tokenData.refreshToken,
    grant_type: 'refresh_token',
  });

  const accessToken = tokenResponse.data.access_token;
  const expiresIn = Number(tokenResponse.data.expires_in || 3600);
  await driveTokenRef(uid).set(
    {
      accessToken,
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + expiresIn * 1000),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return accessToken;
}

async function getDriveAccessToken(uid: string): Promise<string> {
  const snap = await driveTokenRef(uid).get();
  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'Google Drive 연결이 필요합니다.');
  }
  return refreshDriveAccessToken(uid, snap.data() as DriveTokenData);
}

async function ensureHaruDriveFolder(accessToken: string): Promise<DriveFile> {
  const folderQuery = [
    "name = 'HARU'",
    `mimeType = '${DRIVE_FOLDER_MIME}'`,
    'trashed = false',
  ].join(' and ');

  const existing = await axios.get('https://www.googleapis.com/drive/v3/files', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      q: folderQuery,
      spaces: 'drive',
      pageSize: 1,
      fields: DRIVE_FILE_FIELDS_PARAM,
    },
  });

  const first = existing.data.files?.[0];
  if (first) return first;

  const created = await axios.post(
    'https://www.googleapis.com/drive/v3/files',
    { name: 'HARU', mimeType: DRIVE_FOLDER_MIME },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { fields: DRIVE_FILE_FIELDS },
    }
  );
  return created.data;
}

// ===== 📦 HARU자산탐정: Google Drive 연결 시작 =====
export const startHaruDriveConnect = onCall(
  {
    region: 'asia-northeast3',
    cors: [
      'https://haru2026-8abb8.web.app',
      'https://haru2026.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const state = crypto.randomBytes(32).toString('hex');
    await db.collection('oauth_states').doc(state).set({
      provider: 'haru-drive',
      uid: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
    });

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID_SECRET.value(),
      redirect_uri: HARU_DRIVE_REDIRECT_URI,
      response_type: 'code',
      scope: HARU_DRIVE_SCOPES.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    return { authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }
);

// ===== 📦 HARU자산탐정: Google Drive OAuth 콜백 =====
export const haruDriveCallback = onRequest(
  {
    region: 'asia-northeast3',
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET],
  },
  async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || typeof code !== 'string') throw new Error('Invalid code');
      if (!state || typeof state !== 'string') throw new Error('Invalid state');

      const stateDoc = await db.collection('oauth_states').doc(state).get();
      if (!stateDoc.exists) throw new Error('State not found');

      const stateData = stateDoc.data();
      if (stateData?.provider !== 'haru-drive') throw new Error('Invalid provider');
      if (stateData?.expiresAt.toMillis() < Date.now()) throw new Error('State expired');

      await stateDoc.ref.delete();

      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: GOOGLE_CLIENT_ID_SECRET.value(),
        client_secret: GOOGLE_CLIENT_SECRET_SECRET.value(),
        redirect_uri: HARU_DRIVE_REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      const tokenData = tokenResponse.data;
      await driveTokenRef(stateData.uid).set(
        {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          scope: tokenData.scope || HARU_DRIVE_SCOPES.join(' '),
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + Number(tokenData.expires_in || 3600) * 1000),
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      res.redirect(`${FRONTEND_URL}/asset-explorer?drive=connected`);
    } catch (error: any) {
      console.error('❌ HARU Drive 콜백 실패:', error);
      res.redirect(`${FRONTEND_URL}/asset-explorer?drive=error`);
    }
  }
);

// ===== 📦 HARU자산탐정: 최근 후보 탐색 + /HARU 폴더 보장 =====
export const getHaruDriveCandidates = onCall(
  {
    region: 'asia-northeast3',
    cors: [
      'https://haru2026-8abb8.web.app',
      'https://haru2026.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    const accessToken = await getDriveAccessToken(uid);
    const folder = await ensureHaruDriveFolder(accessToken);

    const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: 'trashed = false',
        spaces: 'drive',
        pageSize: 30,
        orderBy: 'modifiedTime desc',
        fields: DRIVE_FILE_FIELDS_PARAM,
      },
    });

    const candidates = ((response.data.files || []) as DriveFile[])
      .filter((file) => file.id !== folder.id && isHaruAssetCandidate(file))
      .slice(0, 20)
      .map((file) => ({
        ...file,
        kind: getDriveFileKind(file.mimeType),
      }));

    return {
      haruFolderId: folder.id,
      candidates,
    };
  }
);

// ===== 📦 HARU자산탐정: 선택 파일만 /HARU 폴더로 복사 =====
export const copyHaruDriveAssets = onCall(
  {
    region: 'asia-northeast3',
    cors: [
      'https://haru2026-8abb8.web.app',
      'https://haru2026.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const fileIds = Array.isArray(request.data?.fileIds)
      ? request.data.fileIds.filter((id: unknown) => typeof id === 'string' && id.trim())
      : [];
    if (fileIds.length === 0) {
      throw new HttpsError('invalid-argument', '복사할 파일을 선택해 주세요.');
    }
    if (fileIds.length > 20) {
      throw new HttpsError('invalid-argument', '한 번에 최대 20개까지 복사할 수 있습니다.');
    }

    const uid = request.auth.uid;
    const accessToken = await getDriveAccessToken(uid);
    const folder = await ensureHaruDriveFolder(accessToken);
    const copiedAssets = [];

    for (const fileId of fileIds) {
      const source = await axios.get(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { fields: DRIVE_FILE_FIELDS },
      });

      const sourceFile = source.data as DriveFile;
      if (!isHaruAssetCandidate(sourceFile)) {
        continue;
      }

      const copied = await axios.post(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/copy`,
        {
          name: sourceFile.name,
          parents: [folder.id],
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { fields: DRIVE_FILE_FIELDS },
        }
      );

      const copiedFile = copied.data as DriveFile;
      const assetRef = db.collection('users').doc(uid).collection('assets').doc(copiedFile.id);
      const now = admin.firestore.FieldValue.serverTimestamp();
      const assetData = {
        title: copiedFile.name || sourceFile.name || '이름 없는 파일',
        mimeType: copiedFile.mimeType || sourceFile.mimeType,
        source: 'google-drive',
        driveFileId: copiedFile.id,
        sourceDriveFileId: sourceFile.id,
        driveUrl: copiedFile.webViewLink || sourceFile.webViewLink || '',
        createdAt: now,
        updatedAt: now,
        tags: [],
        haruFolder: true,
        kind: getDriveFileKind(copiedFile.mimeType || sourceFile.mimeType),
        thumbnailLink: copiedFile.thumbnailLink || sourceFile.thumbnailLink || '',
        iconLink: copiedFile.iconLink || sourceFile.iconLink || '',
      };

      await assetRef.set(assetData, { merge: true });
      copiedAssets.push({
        id: assetRef.id,
        title: assetData.title,
        mimeType: assetData.mimeType,
        driveFileId: assetData.driveFileId,
        driveUrl: assetData.driveUrl,
        kind: assetData.kind,
        thumbnailLink: assetData.thumbnailLink,
        iconLink: assetData.iconLink,
      });
    }

    return {
      copiedCount: copiedAssets.length,
      assets: copiedAssets,
    };
  }
);

// ===== 🔔 테스트 알림 발송 =====
export const sendTestNotification = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    // 로그인 여부 확인
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;

    // 본인 토큰만 조회
    const settingsRef = db.doc(`users/${uid}/settings/settings`);
    const settingsSnap = await settingsRef.get();

    if (!settingsSnap.exists) {
      throw new HttpsError('not-found', 'FCM 토큰이 없습니다. 알림 권한을 허용해주세요.');
    }

    const fcmTokens: string[] = settingsSnap.data()?.fcmTokens || [];

    if (fcmTokens.length === 0) {
      throw new HttpsError('not-found', 'FCM 토큰이 없습니다. 알림 권한을 허용해주세요.');
    }

    const { title, body } = request.data;

    const message = {
      notification: {
        title: (title && typeof title === 'string' && title.trim()) || 'HARU 테스트 알림',
        body: (body && typeof body === 'string' && body.trim()) || '알림이 정상적으로 작동합니다! ✅',
      },
    };

    const results = await Promise.allSettled(
      fcmTokens.map((token) =>
        admin.messaging().send({ ...message, token })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // NotRegistered 만료 토큰 자동 삭제
    const expiredTokens: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const reason = String(result.reason);
        logger.error(`FCM 발송 실패 — 토큰[${i}]: ${result.reason}`);
        if (reason.includes('NotRegistered') || reason.includes('registration-token-not-registered')) {
          expiredTokens.push(fcmTokens[i]);
        }
      }
    });
    if (expiredTokens.length > 0) {
      const { FieldValue } = await import('firebase-admin/firestore');
      const settingsRef = admin.firestore().doc(`users/${uid}/settings/settings`);
      await settingsRef.update({
        fcmTokens: FieldValue.arrayRemove(...expiredTokens),
      });
      logger.info(`🧹 만료 토큰 자동 삭제 완료: ${expiredTokens.length}개`);
    }

    logger.info(`테스트 알림 발송 완료 — uid: ${uid}, 성공: ${succeeded}, 실패: ${failed}`);

    return {
      success: true,
      total: fcmTokens.length,
      succeeded,
      failed,
    };
  }
);

// ===== 🔔 알림 스케줄러 =====
export { scheduledPushNotification } from './scheduledNotification';

// ===== 📢 전체 알림 발송 =====
export { sendBroadcastNotification } from './broadcastNotification';

// ===== 📷 HEIC → JPG 변환 (Cloudinary) =====
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { v2: cloudinary } = require('cloudinary');

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dmhutjnpn';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '752573158646558';

function configureCloudinary() {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function safeCloudinarySegment(value: unknown, fallback: string): string {
  const raw = String(value || fallback).trim();
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || fallback;
}

function extractCloudinaryPublicId(imageUrl: string): string | null {
  try {
    const parsed = new URL(imageUrl);
    if (!parsed.hostname.includes('cloudinary.com')) return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;

    const idParts = parts.slice(uploadIndex + 1);
    if (idParts[0] && /^v\d+$/.test(idParts[0])) {
      idParts.shift();
    }

    const publicIdWithExtension = idParts.join('/');
    return publicIdWithExtension.replace(/\.[a-zA-Z0-9]+$/, '') || null;
  } catch {
    return null;
  }
}

function extractFirebaseStorageTarget(imageUrl: string): { bucketName?: string; path: string } | null {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('gs://')) {
      const withoutScheme = trimmed.slice('gs://'.length);
      const slashIndex = withoutScheme.indexOf('/');
      if (slashIndex === -1) return null;
      return {
        bucketName: withoutScheme.slice(0, slashIndex),
        path: withoutScheme.slice(slashIndex + 1),
      };
    }

    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const bucketIndex = parts.indexOf('b');
      const objectIndex = parts.indexOf('o');
      if (bucketIndex === -1 || objectIndex === -1 || !parts[bucketIndex + 1] || !parts[objectIndex + 1]) {
        return null;
      }
      return {
        bucketName: decodeURIComponent(parts[bucketIndex + 1]),
        path: decodeURIComponent(parts.slice(objectIndex + 1).join('/')),
      };
    }

    if (parsed.hostname === 'storage.googleapis.com' && parts.length >= 2) {
      return {
        bucketName: decodeURIComponent(parts[0]),
        path: decodeURIComponent(parts.slice(1).join('/')),
      };
    }

    if (parsed.hostname.endsWith('.storage.googleapis.com') && parts.length >= 1) {
      return {
        bucketName: parsed.hostname.replace(/\.storage\.googleapis\.com$/, ''),
        path: decodeURIComponent(parts.join('/')),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isStorageObjectNotFound(error: any): boolean {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '404' ||
    code.includes('not-found') ||
    message.includes('no such object') ||
    message.includes('not found');
}

export const convertHeic = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const { imageBase64 } = request.data;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', '이미지 데이터가 필요합니다.');
    }

    configureCloudinary();

    try {
      const dataUri = `data:image/heic;base64,${imageBase64}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        resource_type: 'image',
        format: 'jpg',
        folder: 'heic_temp',
      });
      return { url: result.secure_url };
    } catch (error: any) {
      logger.error('Cloudinary HEIC 변환 오류:', error);
      throw new HttpsError('internal', `변환 실패: ${error.message}`);
    }
  }
);

// uploadRecordImage 는 정책 복구(Firebase Storage 메인)에 따라 제거됨.
// 일반 업로드는 frontend가 Firebase Storage 직접 처리.
// HEIC만 convertHeic(임시 변환) 거친 후 Firebase Storage에 영구 저장.

export const deleteRecordImage = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { imageUrl, publicId } = request.data || {};
    const uid = request.auth.uid;
    const targetPublicId = typeof publicId === 'string' && publicId.trim()
      ? publicId.trim()
      : typeof imageUrl === 'string'
        ? extractCloudinaryPublicId(imageUrl)
        : null;

    if (targetPublicId) {
      if (!targetPublicId.startsWith(`haru2026/records/${uid}/`)) {
        throw new HttpsError('permission-denied', '삭제 권한이 없는 이미지입니다.');
      }

      configureCloudinary();

      try {
        const result = await cloudinary.uploader.destroy(targetPublicId, {
          resource_type: 'image',
        });
        return {
          success: true,
          storage: 'cloudinary',
          publicId: targetPublicId,
          alreadyDeleted: result?.result === 'not found',
        };
      } catch (error: any) {
        if (error instanceof HttpsError) throw error;
        logger.error('Cloudinary 기록 사진 삭제 오류:', error);
        throw new HttpsError('internal', `삭제 실패: ${error.message}`);
      }
    }

    if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
      throw new HttpsError('invalid-argument', '이미지 URL이 필요합니다.');
    }

    const storageTarget = extractFirebaseStorageTarget(imageUrl);
    if (!storageTarget) {
      return { success: true, storage: 'unknown', skipped: true };
    }

    if (!storageTarget.path.startsWith(`users/${uid}/format_photos/`)) {
      throw new HttpsError('permission-denied', '삭제 권한이 없는 이미지입니다.');
    }

    try {
      const targetBucket = storageTarget.bucketName
        ? getStorage().bucket(storageTarget.bucketName)
        : bucket();
      await targetBucket.file(storageTarget.path).delete();
      return { success: true, storage: 'firebase', path: storageTarget.path };
    } catch (error: any) {
      if (isStorageObjectNotFound(error)) {
        return {
          success: true,
          storage: 'firebase',
          path: storageTarget.path,
          alreadyDeleted: true,
        };
      }
      logger.error('Firebase Storage 기록 사진 삭제 오류:', error);
      throw new HttpsError('internal', `삭제 실패: ${error.message}`);
    }
  }
);

// ===== 📚 독서사유 책 본문 사진 → 텍스트 변환 (Gemini Vision OCR) =====
export const extractReadingBookTextFromPhoto = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'extractReadingBookTextFromPhoto', 5, 30);
    const isDeveloper = DEVELOPER_UIDS.has(uid);
    const d = request.data || {};
    const bookTitle = String(d.bookTitle || '').trim().slice(0, 200);
    const author = String(d.author || '').trim().slice(0, 120);
    const bookId = makeReadingBookIdForFunction(bookTitle, author);
    let imageBase64 = String(d.imageBase64 || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const mimeType = String(d.mimeType || 'image/jpeg').startsWith('image/')
      ? String(d.mimeType || 'image/jpeg')
      : 'image/jpeg';

    if (!bookTitle || !bookId) {
      throw new HttpsError('invalid-argument', '책 제목이 필요합니다.');
    }
    if (!imageBase64) {
      throw new HttpsError('invalid-argument', '이미지 데이터(imageBase64)가 필요합니다.');
    }

    const imageKb = Math.round(imageBase64.length * 0.75 / 1024);
    if (imageKb > 7 * 1024) {
      throw new HttpsError('invalid-argument', '사진이 너무 큽니다. 한 장당 7MB 이하로 줄여주세요.');
    }

    let ocrQuotaReservation: MonthlyOcrQuotaReservation | null = null;
    if (!isDeveloper) {
      ocrQuotaReservation = await reserveMonthlyOcrQuota(uid);
    }

    const usageRef = db.doc(`users/${uid}/readingOcrUsage/${bookId}`);
    let usedCount: number | null = null;
    let slotReserved = false;

    if (!isDeveloper) {
      try {
        usedCount = await db.runTransaction(async (tx) => {
          const snap = await tx.get(usageRef);
          const current = Number(snap.data()?.photoCount || 0);
          if (current >= READING_BOOK_OCR_LIMIT) {
            throw new HttpsError('resource-exhausted', '책 한 권당 본문 사진은 총 20장까지 변환할 수 있습니다.');
          }
          const next = current + 1;
          const dataToSave: Record<string, any> = {
            bookId,
            bookTitle,
            author,
            photoCount: next,
            limit: READING_BOOK_OCR_LIMIT,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          if (!snap.exists) {
            dataToSave.createdAt = admin.firestore.FieldValue.serverTimestamp();
          }
          tx.set(usageRef, dataToSave, { merge: true });
          return next;
        });
        slotReserved = true;
      } catch (error) {
        // 권당 슬롯 예약 실패 시 이미 예약된 월간 OCR 쿼터도 함께 롤백 (요구사항 7)
        await rollbackMonthlyOcrQuotaReservation(ocrQuotaReservation);
        throw error;
      }
    }

    try {
      logger.info('extractReadingBookTextFromPhoto 호출', {
        uid: uid.slice(0, 8) + '…',
        bookId,
        imageKb,
        isDeveloper,
        usedCount,
      });

      const prompt = `책 본문 사진에서 보이는 텍스트만 원문 그대로 옮기세요.

[규칙]
- 요약, 해석, 감상, 제목 생성 금지
- 보이지 않는 글자 추측 금지. 판독이 어려운 부분은 [판독불가]로 표시
- 책 본문, 소제목, 쪽번호, 각주가 보이면 줄바꿈을 최대한 유지해 옮김
- 광고, 앱 UI, 촬영 화면 글자는 제외
- 응답은 텍스트 본문만. 마크다운 코드펜스 금지
- 사진에 책 본문이 없으면 빈 문자열만 반환`;

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const modelName = 'gemini-3.1-flash-lite';
      const model = genAI.getGenerativeModel({ model: modelName });
      // 책 본문 사진 원본은 Storage/Firestore에 저장하지 않고 OCR 요청 메모리에서만 사용한다.
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType,
          },
        },
      ]);
      const usage = getGeminiUsage(result);
      await logAiUsage({
        uid,
        featureName: 'book_ocr',
        plan: AI_USAGE_PLAN,
        model: modelName,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        imageCount: 1,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(uid),
      });

      const extractedText = result.response.text()
        .replace(/^```(?:text)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
        .slice(0, 12000);

      imageBase64 = '';
      return {
        text: extractedText,
        bookId,
        usedCount,
        limit: isDeveloper ? null : READING_BOOK_OCR_LIMIT,
        remainingCount: isDeveloper || usedCount === null
          ? null
          : Math.max(READING_BOOK_OCR_LIMIT - usedCount, 0),
        isDeveloper,
      };
    } catch (error: any) {
      imageBase64 = '';
      if (slotReserved) {
        try {
          await usageRef.set({
            photoCount: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } catch (rollbackError: any) {
          logger.warn('독서 OCR 사용량 롤백 실패', { message: rollbackError?.message });
        }
      }
      await rollbackMonthlyOcrQuotaReservation(ocrQuotaReservation);
      if (error instanceof HttpsError) throw error;
      logger.error('독서 본문 OCR 실패', { message: error?.message?.slice(0, 200) });
      await logAiUsage({
        uid,
        featureName: 'book_ocr',
        plan: AI_USAGE_PLAN,
        model: null,
        inputTokens: null,
        outputTokens: null,
        imageCount: 1,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: false,
        errorCode: getAiUsageErrorCode(error),
        isDev: DEVELOPER_UIDS.has(uid),
      });
      throw new HttpsError('internal', '책 본문 텍스트 변환에 실패했습니다. 사진을 더 또렷이 찍어 주세요.');
    }
  }
);

// ===== 📈 주식거래 캡처 이미지 → 거래 텍스트/필드 추출 (Gemini Vision OCR) =====
export const extractStockTradeTextFromPhoto = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    await enforceRateLimit(request.auth.uid, 'extractStockTradeTextFromPhoto', 5, 30);

    let imageBase64 = String(request.data?.imageBase64 || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const mimeType = String(request.data?.mimeType || 'image/jpeg').startsWith('image/')
      ? String(request.data?.mimeType || 'image/jpeg')
      : 'image/jpeg';

    if (!imageBase64) {
      throw new HttpsError('invalid-argument', '이미지 데이터(imageBase64)가 필요합니다.');
    }

    const imageKb = Math.round(imageBase64.length * 0.75 / 1024);
    if (imageKb > 7 * 1024) {
      throw new HttpsError('invalid-argument', '사진이 너무 큽니다. 한 장당 7MB 이하로 줄여주세요.');
    }

    try {
      const prompt = `주식 거래 캡처 이미지에서 보이는 거래 내용을 추출하세요.

[규칙]
- 보이는 텍스트만 근거로 삼고 추측하지 마세요.
- 증권사 앱/문자/체결 알림/거래 내역 화면 모두 허용합니다.
- 거래유형은 매수, 매도, 입금, 출금, 배당, 수수료, 기타 중 가장 상식적인 값으로 정리합니다.
- 종목명, 단가, 수량, 거래금액, 거래일시가 보이면 그대로 옮깁니다.
- 숫자와 통화 단위는 화면에 보이는 형식을 최대한 유지합니다.
- 응답은 아래 JSON만 반환하고 코드펜스는 쓰지 마세요.

{
  "text": "캡처에서 읽은 원문 텍스트",
  "trade": {
    "stock_type": "매수/매도/입금/출금/배당/수수료/기타",
    "stock_name": "종목명",
    "stock_price": "거래단가",
    "stock_quantity": "수량",
    "stock_total": "거래금액",
    "stock_date": "거래일시"
  }
}`;

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType,
          },
        },
      ]);

      const rawText = result.response.text()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      imageBase64 = '';

      let parsed: any = {};
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { text: rawText, trade: {} };
      }

      const trade = parsed?.trade && typeof parsed.trade === 'object' ? parsed.trade : {};
      const safeTrade = {
        stock_type: String(trade.stock_type || '').slice(0, 40),
        stock_name: String(trade.stock_name || '').slice(0, 120),
        stock_price: String(trade.stock_price || '').slice(0, 80),
        stock_quantity: String(trade.stock_quantity || '').slice(0, 80),
        stock_total: String(trade.stock_total || '').slice(0, 80),
        stock_date: String(trade.stock_date || '').slice(0, 80),
      };

      return {
        text: String(parsed?.text || rawText || '').slice(0, 12000),
        trade: safeTrade,
      };
    } catch (error: any) {
      imageBase64 = '';
      if (error instanceof HttpsError) throw error;
      logger.error('주식 거래 캡처 OCR 실패', { message: error?.message?.slice(0, 200) });
      throw new HttpsError('internal', '거래 캡처 텍스트 추출에 실패했습니다. 사진을 더 또렷하게 올려 주세요.');
    }
  },
);

type LedgerOcrImageInput = {
  mimeType?: unknown;
  dataBase64?: unknown;
  imageBase64?: unknown;
};

const LEDGER_OCR_ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function cleanLedgerOcrText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function maskLedgerSensitiveText(value: unknown, maxLength: number): string {
  const cleaned = cleanLedgerOcrText(value, maxLength);
  return cleaned
    .replace(/(?:\d[\s-]?){8,}\d/g, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length < 8) return match;
      if (digits.length <= 12) return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
      return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
    })
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
}

function parseLedgerJsonObject(text: string): any {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('NO_JSON_OBJECT');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeLedgerType(value: unknown): string {
  const compact = cleanLedgerOcrText(value, 20).replace(/\s+/g, '');
  return ['수입', '지출', '이체', '기타'].find((type) => compact.includes(type)) || '';
}

// ===== 📒 HARU보조장부 영수증/통장 캡처 → 임시 장부 필드 추출 (이미지 비저장) =====
export const extractLedgerTextFromImage = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    await enforceRateLimit(request.auth.uid, 'extractLedgerTextFromImage', 5, 30);

    const rawImages = Array.isArray(request.data?.images) ? request.data.images : [];
    if (rawImages.length === 0) {
      throw new HttpsError('invalid-argument', '이미지 데이터가 필요합니다.');
    }
    if (rawImages.length > 3) {
      throw new HttpsError('invalid-argument', '이미지는 최대 3장까지 처리할 수 있습니다.');
    }

    const inlineParts: any[] = [];
    let totalImageKb = 0;
    for (const rawImage of rawImages) {
      const image = rawImage as LedgerOcrImageInput;
      const mimeType = String(image?.mimeType || 'image/jpeg').toLowerCase().trim();
      if (!LEDGER_OCR_ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new HttpsError('invalid-argument', 'JPG, PNG, WEBP 이미지만 처리할 수 있습니다.');
      }

      let dataBase64 = String(image?.dataBase64 || image?.imageBase64 || '')
        .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      if (!dataBase64) {
        throw new HttpsError('invalid-argument', '이미지 base64 데이터가 비어 있습니다.');
      }

      const imageKb = Math.round(dataBase64.length * 0.75 / 1024);
      if (imageKb > 7 * 1024) {
        dataBase64 = '';
        throw new HttpsError('invalid-argument', '사진이 너무 큽니다. 한 장당 7MB 이하로 줄여주세요.');
      }
      totalImageKb += imageKb;
      inlineParts.push({
        inlineData: {
          data: dataBase64,
          mimeType,
        },
      });
      dataBase64 = '';
    }

    const clearInlineParts = () => {
      for (const part of inlineParts) {
        if (part?.inlineData?.data) {
          part.inlineData.data = '';
        }
      }
    };
    const imageCount = inlineParts.length;

    try {
      logger.info('extractLedgerTextFromImage 호출', {
        uid: request.auth.uid.slice(0, 8) + '…',
        imageCount,
        totalImageKb,
      });

      const prompt = `영수증, 통장 거래내역, 계좌이체 캡처, 카드매출전표 이미지에서 HARU보조장부 입력에 필요한 모든 거래내역을 추출하세요.

[절대 규칙]
- 이미지에 보이는 내용만 사용하고, 보이지 않는 값은 추측하지 마세요.
- 확실하지 않은 값은 빈 문자열로 둡니다.
- 계좌번호, 카드번호, 승인번호, 전화번호처럼 긴 식별번호는 원문과 메모에서 ****로 마스킹하세요.
- 세무 신고용 확정 판단을 하지 마세요. 보조장부 입력 후보만 만듭니다.
- 거래가 여러 건이면 모두 추출해서 transactions 배열에 담아주세요.
- 광고·이벤트·포인트 안내 등 실제 거래가 아닌 항목은 제외하세요.
- 응답은 JSON 객체만 반환하고 코드펜스/설명 문장은 쓰지 마세요.

[필드 기준]
- transactionAt: 거래일시 또는 거래일. 확실할 때만 작성.
- type: 수입, 지출, 이체, 기타 중 하나. 확실하지 않으면 빈 문자열.
- category: 항목. 예: 식대, 사무용품, 컨설팅 매출, 임대료.
- partner: 거래처/상호/입금자/출금처.
- amount: 금액. 화면에 보이는 금액과 통화 단위를 최대한 유지.
- paymentMethod: 계좌이체, 신용카드, 현금, 체크카드, 간편결제 등.
- proofType: 영수증, 카드매출전표, 세금계산서, 현금영수증, 통장거래내역 등.
- memo: 장부 입력자가 참고할 짧은 메모. 민감번호는 마스킹.

{
  "rawText": "이미지에서 읽은 주요 원문. 민감번호는 마스킹",
  "transactions": [
    {
      "transactionAt": "",
      "type": "",
      "category": "",
      "partner": "",
      "amount": "",
      "paymentMethod": "",
      "proofType": "",
      "memo": ""
    }
  ],
  "warnings": []
}`;

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const modelName = 'gemini-3.1-flash-lite';
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        prompt,
        ...inlineParts,
      ]);
      const usage = getGeminiUsage(result);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'subleger_ocr',
        plan: AI_USAGE_PLAN,
        model: modelName,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        imageCount,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });

      const responseText = result.response.text()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      clearInlineParts();

      const warnings: string[] = [];
      let parsed: any = {};
      try {
        parsed = parseLedgerJsonObject(responseText);
      } catch {
        parsed = { rawText: responseText, fields: {} };
        warnings.push('추출 결과 형식이 불안정해 원문 위주로 표시합니다.');
      }

      const sanitizeTx = (t: any) => ({
        transactionAt: cleanLedgerOcrText(t?.transactionAt, 80),
        type: normalizeLedgerType(t?.type),
        category: maskLedgerSensitiveText(t?.category, 120),
        partner: maskLedgerSensitiveText(t?.partner, 160),
        amount: cleanLedgerOcrText(t?.amount, 80),
        paymentMethod: maskLedgerSensitiveText(t?.paymentMethod, 80),
        proofType: maskLedgerSensitiveText(t?.proofType, 80),
        memo: maskLedgerSensitiveText(t?.memo, 500),
      });

      // 다건 transactions 배열 파싱. 구버전 fields 포맷도 fallback 지원
      const rawTransactions: any[] = Array.isArray(parsed?.transactions) && parsed.transactions.length > 0
        ? parsed.transactions
        : parsed?.fields && typeof parsed.fields === 'object'
          ? [parsed.fields]
          : [];
      const transactions = rawTransactions.map(sanitizeTx);

      const parsedWarnings = Array.isArray(parsed?.warnings)
        ? parsed.warnings
          .map((warning: unknown) => cleanLedgerOcrText(warning, 180))
          .filter(Boolean)
        : [];
      if (transactions.length === 0) {
        warnings.push('장부 입력 필드를 충분히 찾지 못했습니다. 직접 확인해 주세요.');
      }

      return {
        rawText: maskLedgerSensitiveText(parsed?.rawText || parsed?.text || responseText, 12000),
        transactions,
        fields: transactions[0] ?? {},
        warnings: Array.from(new Set([...warnings, ...parsedWarnings])).slice(0, 6),
      };
    } catch (error: any) {
      clearInlineParts();
      if (error instanceof HttpsError) throw error;
      logger.error('보조장부 이미지 텍스트 추출 실패', { message: error?.message?.slice(0, 200) });
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'subleger_ocr',
        plan: AI_USAGE_PLAN,
        model: null,
        inputTokens: null,
        outputTokens: null,
        imageCount: inlineParts.length,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: false,
        errorCode: getAiUsageErrorCode(error),
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      throw new HttpsError('internal', '영수증·통장 캡처 텍스트 추출에 실패했습니다. 사진을 더 또렷하게 올려 주세요.');
    }
  },
);

// ===== 📒 HARU가계부 영수증 OCR =====
export const extractHouseholdTextFromImage = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    await enforceRateLimit(request.auth.uid, 'extractHouseholdTextFromImage', 5, 30);

    const rawImages = Array.isArray(request.data?.images) ? request.data.images : [];
    if (rawImages.length === 0) {
      throw new HttpsError('invalid-argument', '이미지 데이터가 필요합니다.');
    }
    if (rawImages.length > 3) {
      throw new HttpsError('invalid-argument', '이미지는 최대 3장까지 처리할 수 있습니다.');
    }

    const inlineParts: any[] = [];
    let totalImageKb = 0;
    for (const rawImage of rawImages) {
      const image = rawImage as LedgerOcrImageInput;
      const mimeType = String(image?.mimeType || 'image/jpeg').toLowerCase().trim();
      if (!LEDGER_OCR_ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new HttpsError('invalid-argument', 'JPG, PNG, WEBP 이미지만 처리할 수 있습니다.');
      }
      let dataBase64 = String(image?.dataBase64 || image?.imageBase64 || '')
        .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      if (!dataBase64) {
        throw new HttpsError('invalid-argument', '이미지 base64 데이터가 비어 있습니다.');
      }
      const imageKb = Math.round(dataBase64.length * 0.75 / 1024);
      if (imageKb > 7 * 1024) {
        throw new HttpsError('invalid-argument', '사진이 너무 큽니다. 한 장당 7MB 이하로 줄여주세요.');
      }
      totalImageKb += imageKb;
      inlineParts.push({ inlineData: { data: dataBase64, mimeType } });
      dataBase64 = '';
    }

    const clearParts = () => {
      for (const part of inlineParts) {
        if (part?.inlineData?.data) part.inlineData.data = '';
      }
    };
    const imageCount = inlineParts.length;

    try {
      logger.info('extractHouseholdTextFromImage 호출', {
        uid: request.auth.uid.slice(0, 8) + '…',
        imageCount,
        totalImageKb,
      });

      const prompt = `영수증·통장 거래내역·카드매출전표 이미지에서 가계부 정보를 추출해줘.
거래가 여러 건이면 모두 추출해서 JSON 배열로 반환해줘.

[절대 규칙]
- 이미지에 보이는 내용만 사용하고, 보이지 않는 값은 추측하지 마세요.
- 계좌번호·카드번호·승인번호 같은 민감 번호는 ****로 마스킹하세요.
- 광고·이벤트·포인트 안내 등 실제 거래가 아닌 항목은 제외하세요.
- 응답은 JSON 객체만 반환하고 코드펜스/설명 문장은 쓰지 마세요.

{
  "rawText": "이미지에서 읽은 주요 원문 (민감번호 마스킹)",
  "transactions": [
    {
      "transactionAt": "YYYY.MM.DD 또는 YYYY.MM.DD HH:MM",
      "type": "수입 또는 지출 또는 이체",
      "category": "식비|교통비|통신비|주거비|공과금|의료비|교육비|문화생활|쇼핑|구독료|기타 중 하나",
      "partner": "사용처명 또는 입금처",
      "amount": "금액(숫자만 또는 통화 포함)",
      "paymentMethod": "현금|체크카드|신용카드|계좌이체|카카오페이|네이버페이|기타 중 하나",
      "memo": "기타 참고사항"
    }
  ],
  "warnings": []
}`;

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const modelName = 'gemini-3.1-flash-lite';
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, ...inlineParts]);
      const usage = getGeminiUsage(result);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'ledger_ocr',
        plan: AI_USAGE_PLAN,
        model: modelName,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        imageCount,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });

      const responseText = result.response.text()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      clearParts();

      const warnings: string[] = [];
      let parsed: any = {};
      try {
        parsed = parseLedgerJsonObject(responseText);
      } catch {
        parsed = { rawText: responseText, fields: {} };
        warnings.push('추출 결과 형식이 불안정해 원문 위주로 표시합니다.');
      }

      const sanitizeTx = (t: any) => ({
        transactionAt: cleanLedgerOcrText(t?.transactionAt, 80),
        type: normalizeLedgerType(t?.type),
        category: cleanLedgerOcrText(t?.category, 60),
        partner: maskLedgerSensitiveText(t?.partner, 160),
        amount: cleanLedgerOcrText(t?.amount, 80),
        paymentMethod: maskLedgerSensitiveText(t?.paymentMethod, 80),
        memo: maskLedgerSensitiveText(t?.memo, 500),
      });

      const rawTransactions: any[] = Array.isArray(parsed?.transactions) && parsed.transactions.length > 0
        ? parsed.transactions
        : parsed?.fields && typeof parsed.fields === 'object'
          ? [parsed.fields]
          : [];
      const transactions = rawTransactions.map(sanitizeTx);

      const parsedWarnings = Array.isArray(parsed?.warnings)
        ? parsed.warnings.map((w: unknown) => cleanLedgerOcrText(w, 180)).filter(Boolean)
        : [];
      if (transactions.length === 0) {
        warnings.push('가계부 입력 필드를 충분히 찾지 못했습니다. 직접 확인해 주세요.');
      }

      return {
        rawText: maskLedgerSensitiveText(parsed?.rawText || parsed?.text || responseText, 12000),
        transactions,
        fields: transactions[0] ?? {},
        warnings: Array.from(new Set([...warnings, ...parsedWarnings])).slice(0, 6),
      };
    } catch (error: any) {
      clearParts();
      if (error instanceof HttpsError) throw error;
      logger.error('가계부 이미지 텍스트 추출 실패', { message: error?.message?.slice(0, 200) });
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'ledger_ocr',
        plan: AI_USAGE_PLAN,
        model: null,
        inputTokens: null,
        outputTokens: null,
        imageCount: inlineParts.length,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: false,
        errorCode: getAiUsageErrorCode(error),
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      throw new HttpsError('internal', '영수증 텍스트 추출에 실패했습니다. 사진을 더 또렷하게 올려 주세요.');
    }
  },
);

// ===== 📒 HARU가계부 — 카카오뱅크 XLSX 잠금 해제 =====
// 파싱·매핑·미리보기·저장은 프론트(householdKakaoImport.ts)에서 처리. 이 함수는 비밀번호 해제만 담당.
export const decryptKakaoXlsx = onCall(
  {
    region: 'asia-northeast3',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const fileBase64 = String(request.data?.fileBase64 || '');
    const password = String(request.data?.password || '');
    if (!fileBase64) {
      throw new HttpsError('invalid-argument', '파일 데이터가 필요합니다.');
    }
    if (!password) {
      throw new HttpsError('invalid-argument', '비밀번호를 입력해 주세요.');
    }
    const fileKb = Math.round((fileBase64.length * 0.75) / 1024);
    if (fileKb > 10 * 1024) {
      throw new HttpsError('invalid-argument', '파일이 너무 큽니다. 10MB 이하로 올려주세요.');
    }

    try {
      logger.info('decryptKakaoXlsx 호출', {
        uid: request.auth.uid.slice(0, 8) + '…',
        fileKb,
      });

      const buf = Buffer.from(fileBase64, 'base64');
      const file = OfficeFile(buf);
      file.loadKey({ password, verifyPassword: true });
      const decrypted = file.decrypt();

      return { xlsxBase64: Buffer.from(decrypted).toString('base64') };
    } catch (error: any) {
      if (error instanceof InvalidKeyError || error instanceof DecryptionError) {
        throw new HttpsError('invalid-argument', '비밀번호가 올바르지 않습니다.');
      }
      logger.error('decryptKakaoXlsx 실패', { message: error?.message?.slice(0, 200) });
      throw new HttpsError('internal', String(error?.message || '파일을 해제하지 못했습니다.'));
    }
  },
);

type GrowthTimelinePdfItem = {
  url: string;
  takenDate: string;
  memo?: string;
  order?: number;
  locationLabel?: string;
  locationCandidate?: {
    placeName?: string;
    regionLabel?: string;
    roadAddress?: string;
    jibunAddress?: string;
  };
};

type NormalizedGrowthTimelinePdfItem = Required<Pick<GrowthTimelinePdfItem, 'url' | 'takenDate' | 'memo' | 'order' | 'locationLabel'>> & {
  locationCandidate: {
    placeName: string;
    regionLabel: string;
    roadAddress: string;
    jibunAddress: string;
  };
};

const GROWTH_TIMELINE_PDF_SCHEMA_VERSION = 3;
const GROWTH_TIMELINE_PDF_MAX_ITEMS = 80;

function cleanTimelinePdfText(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function formatTimelinePdfDate(value: string): string {
  const [yyyy, mm, dd] = value.split('-');
  if (!yyyy || !mm || !dd) return value || '-';
  return `${yyyy}.${mm}.${dd}`;
}

function safeTimelinePdfFilename(title: string): string {
  return `HARU타임라인_${(title || '성장타임라인').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)}.pdf`;
}

function getTimelinePdfLocationLabel(item: NormalizedGrowthTimelinePdfItem): string {
  return item.locationLabel
    || item.locationCandidate.placeName
    || item.locationCandidate.regionLabel
    || item.locationCandidate.roadAddress
    || item.locationCandidate.jibunAddress
    || '';
}

function getTimelinePdfLocationDetail(item: NormalizedGrowthTimelinePdfItem): string {
  if (item.locationCandidate.placeName) {
    return item.locationCandidate.regionLabel
      || item.locationCandidate.roadAddress
      || item.locationCandidate.jibunAddress
      || '';
  }
  return item.locationCandidate.roadAddress || item.locationCandidate.jibunAddress || '';
}

function normalizeGrowthTimelinePdfPayload(data: any) {
  const title = cleanTimelinePdfText(data?.title, 80) || '성장타임라인';
  const createdLabel = cleanTimelinePdfText(data?.createdLabel, 30)
    || formatTimelinePdfDate(new Date().toISOString().slice(0, 10));
  const rawItems: GrowthTimelinePdfItem[] = Array.isArray(data?.items) ? data.items : [];

  if (rawItems.length === 0) {
    throw new HttpsError('invalid-argument', 'PDF로 만들 사진이 없습니다');
  }
  if (rawItems.length > GROWTH_TIMELINE_PDF_MAX_ITEMS) {
    throw new HttpsError('invalid-argument', `사진은 최대 ${GROWTH_TIMELINE_PDF_MAX_ITEMS}장까지 PDF로 만들 수 있습니다`);
  }

  const items: NormalizedGrowthTimelinePdfItem[] = rawItems.map((item: GrowthTimelinePdfItem, index: number): NormalizedGrowthTimelinePdfItem => {
    const url = cleanTimelinePdfText(item?.url, 2000);
    if (!/^https?:\/\//.test(url)) {
      throw new HttpsError('invalid-argument', '사진 URL이 올바르지 않습니다');
    }
    const takenDate = cleanTimelinePdfText(item?.takenDate, 20);
    return {
      url,
      takenDate,
      memo: cleanTimelinePdfText(item?.memo, 500),
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
      locationLabel: cleanTimelinePdfText(item?.locationLabel, 120),
      locationCandidate: {
        placeName: cleanTimelinePdfText(item?.locationCandidate?.placeName, 120),
        regionLabel: cleanTimelinePdfText(item?.locationCandidate?.regionLabel, 160),
        roadAddress: cleanTimelinePdfText(item?.locationCandidate?.roadAddress, 180),
        jibunAddress: cleanTimelinePdfText(item?.locationCandidate?.jibunAddress, 180),
      },
    };
  }).sort((a, b) => a.takenDate.localeCompare(b.takenDate) || a.order - b.order);

  return { title, createdLabel, items };
}

function buildGrowthTimelinePdfHash(uid: string, payload: ReturnType<typeof normalizeGrowthTimelinePdfPayload>): string {
  const stablePayload = JSON.stringify({
    schemaVersion: GROWTH_TIMELINE_PDF_SCHEMA_VERSION,
    uid,
    title: payload.title,
    createdLabel: payload.createdLabel,
    items: payload.items,
  });
  return crypto.createHash('sha256').update(stablePayload).digest('hex');
}

async function prepareTimelinePdfImage(url: string, widthPt: number, heightPt: number): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000,
      maxContentLength: 25 * 1024 * 1024,
    });
    const widthPx = Math.max(320, Math.round(widthPt * 2.4));
    const heightPx = Math.max(240, Math.round(heightPt * 2.4));
    return await sharp(Buffer.from(response.data))
      .rotate()
      .resize(widthPx, heightPx, { fit: 'cover' })
      .jpeg({ quality: 84 })
      .toBuffer();
  } catch (error: any) {
    logger.warn('타임라인 PDF 이미지 준비 실패:', {
      message: error?.message || String(error),
      urlPrefix: url.slice(0, 80),
    });
    return null;
  }
}

function registerTimelinePdfFont(doc: any) {
  const fontPath = path.join(__dirname, 'fonts', 'NotoSansKR.ttf');
  if (fs.existsSync(fontPath)) {
    doc.registerFont('NotoSansKR', fontPath);
    doc.font('NotoSansKR');
  }
}

function fitTimelinePdfLine(doc: any, text: string, width: number): string {
  const value = String(text || '').trim();
  if (!value) return '';
  if (doc.widthOfString(value) <= width) return value;

  const suffix = '...';
  if (doc.widthOfString(suffix) > width) return '';

  let low = 0;
  let high = value.length;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${value.slice(0, mid).trimEnd()}${suffix}`;
    if (doc.widthOfString(candidate) <= width) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const prefix = value.slice(0, best).trimEnd();
  return prefix ? `${prefix}${suffix}` : suffix;
}

function splitTimelinePdfLines(doc: any, text: string, width: number, maxLines: number): string[] {
  let remaining = String(text || '').trim();
  const lines: string[] = [];

  for (let lineIndex = 0; lineIndex < maxLines && remaining; lineIndex += 1) {
    const isLastLine = lineIndex === maxLines - 1;
    if (doc.widthOfString(remaining) <= width) {
      lines.push(remaining);
      break;
    }

    if (isLastLine) {
      const fitted = fitTimelinePdfLine(doc, remaining, width);
      if (fitted) lines.push(fitted);
      break;
    }

    let low = 1;
    let high = remaining.length;
    let best = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = remaining.slice(0, mid).trimEnd();
      if (candidate && doc.widthOfString(candidate) <= width) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (best <= 0) {
      const fitted = fitTimelinePdfLine(doc, remaining, width);
      if (fitted) lines.push(fitted);
      break;
    }

    const prefix = remaining.slice(0, best);
    const lastSpace = prefix.lastIndexOf(' ');
    const cutAt = lastSpace >= Math.max(4, Math.floor(best * 0.55)) ? lastSpace : best;
    const line = remaining.slice(0, cutAt).trim();
    if (line) lines.push(line);
    remaining = remaining.slice(cutAt).trim();
  }

  return lines;
}

function drawTimelinePdfLines(
  doc: any,
  text: string,
  x: number,
  y: number,
  width: number,
  options: { color: string; fontSize: number; lineHeight: number; maxLines: number; maxHeight?: number },
): number {
  const availableLines = typeof options.maxHeight === 'number'
    ? Math.floor(options.maxHeight / options.lineHeight)
    : options.maxLines;
  const maxLines = Math.max(0, Math.min(options.maxLines, availableLines));
  if (maxLines <= 0) return y;

  doc.fillColor(options.color).fontSize(options.fontSize);
  const lines = splitTimelinePdfLines(doc, text, width, maxLines);
  lines.forEach((line, index) => {
    doc.text(line, x, y + index * options.lineHeight, {
      width,
      lineBreak: false,
    });
  });

  return y + lines.length * options.lineHeight;
}

async function buildGrowthTimelinePdfBuffer(payload: ReturnType<typeof normalizeGrowthTimelinePdfPayload>): Promise<Buffer> {
  return await new Promise<Buffer>(async (resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 42,
      info: {
        Title: payload.title,
        Author: 'HARU2026',
        Subject: 'HARU Timeline',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      registerTimelinePdfFont(doc);
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 42;
      const brandColor = '#1A3C6E';
      const mutedColor = '#6f7f8d';
      const borderColor = '#e2e9f0';
      const periodStart = payload.items[0]?.takenDate || '';
      const periodEnd = payload.items[payload.items.length - 1]?.takenDate || '';
      const periodText = `${formatTimelinePdfDate(periodStart)}${periodEnd && periodEnd !== periodStart ? ` ~ ${formatTimelinePdfDate(periodEnd)}` : ''}`;

      const coverImage = payload.items[0] ? await prepareTimelinePdfImage(payload.items[0].url, pageWidth - margin * 2, 420) : null;
      if (coverImage) {
        doc.save();
        doc.roundedRect(margin, margin, pageWidth - margin * 2, 420, 12).clip();
        doc.image(coverImage, margin, margin, { width: pageWidth - margin * 2, height: 420 });
        doc.restore();
      } else {
        doc.roundedRect(margin, margin, pageWidth - margin * 2, 420, 12).fill('#f1f4f7');
      }

      doc.fillColor(brandColor).fontSize(12).text('HARU Timeline · by HaruLab', margin, 500, {
        width: pageWidth - margin * 2,
      });
      doc.fillColor(brandColor).fontSize(28).text(payload.title, margin, 526, {
        width: pageWidth - margin * 2,
        lineGap: 4,
      });
      doc.fillColor(mutedColor).fontSize(13).text(`기간 ${periodText}`, margin, 610);
      doc.fillColor('#8a96a3').fontSize(11).text(`사진 ${payload.items.length}장 · 생성일 ${payload.createdLabel}`, margin, 632);

      for (let i = 0; i < payload.items.length; i += 4) {
        doc.addPage();
        registerTimelinePdfFont(doc);
        const batch = payload.items.slice(i, i + 4);
        const gapX = 22;
        const gapY = 22;
        const cardW = (pageWidth - margin * 2 - gapX) / 2;
        const cardH = 300;
        const photoH = 198;
        const cardPad = 10;
        const yStart = 58;

        for (let j = 0; j < batch.length; j += 1) {
          const item = batch[j];
          const col = j % 2;
          const row = Math.floor(j / 2);
          const x = margin + col * (cardW + gapX);
          const y = yStart + row * (cardH + gapY);
          const photoX = x + cardPad;
          const photoY = y + cardPad;
          const photoW = cardW - cardPad * 2;
          const prepared = await prepareTimelinePdfImage(item.url, photoW, photoH);

          doc.roundedRect(x, y, cardW, cardH, 10).fillAndStroke('#ffffff', borderColor);
          if (prepared) {
            doc.save();
            doc.roundedRect(photoX, photoY, photoW, photoH, 8).clip();
            doc.image(prepared, photoX, photoY, { width: photoW, height: photoH });
            doc.restore();
          } else {
            doc.roundedRect(photoX, photoY, photoW, photoH, 8).fill('#f1f4f7');
            const fallbackText = '사진을 불러오지 못했습니다';
            doc.fillColor('#8a96a3').fontSize(10);
            const fallbackX = photoX + Math.max(0, (photoW - doc.widthOfString(fallbackText)) / 2);
            doc.text(fallbackText, fallbackX, photoY + photoH / 2 - 6, { lineBreak: false });
          }

          const captionY = photoY + photoH + 10;
          const textBottom = y + cardH - cardPad;
          let textY = drawTimelinePdfLines(doc, formatTimelinePdfDate(item.takenDate), photoX, captionY, photoW, {
            color: brandColor,
            fontSize: 13,
            lineHeight: 16,
            maxLines: 1,
          }) + 3;
          const locationLabel = getTimelinePdfLocationLabel(item);
          const locationDetail = getTimelinePdfLocationDetail(item);
          if (locationLabel) {
            textY = drawTimelinePdfLines(doc, `촬영장소: ${locationLabel}`, photoX, textY, photoW, {
              color: '#37644a',
              fontSize: 9,
              lineHeight: 11,
              maxLines: 2,
              maxHeight: textBottom - textY,
            }) + 2;
          }
          if (locationDetail && locationDetail !== locationLabel) {
            textY = drawTimelinePdfLines(doc, locationDetail, photoX, textY, photoW, {
              color: '#7c8894',
              fontSize: 8.5,
              lineHeight: 10,
              maxLines: 1,
              maxHeight: textBottom - textY,
            }) + 2;
          }
          if (item.memo) {
            drawTimelinePdfLines(doc, item.memo, photoX, textY, photoW, {
              color: '#3a4753',
              fontSize: 9,
              lineHeight: 11,
              maxLines: 2,
              maxHeight: textBottom - textY,
            });
          }
        }

        const footerText = `HARU Timeline · ${periodText}`;
        doc.fillColor('#9aa6b2').fontSize(9);
        const footerX = margin + Math.max(0, (pageWidth - margin * 2 - doc.widthOfString(footerText)) / 2);
        doc.text(footerText, footerX, pageHeight - 54, { lineBreak: false });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export const generateGrowthTimelinePdf = onCall(
  { region: 'asia-northeast3', memory: '1GiB', timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'generateGrowthTimelinePdf', 3, 20);

    const payload = normalizeGrowthTimelinePdfPayload(request.data);
    const hash = buildGrowthTimelinePdfHash(uid, payload);
    const filePath = `users/${uid}/timelinePdfs/${hash}.pdf`;
    const file = bucket().file(filePath);
    const [exists] = await file.exists();
    const filename = safeTimelinePdfFilename(payload.title);

    if (!exists) {
      const pdfBuffer = await buildGrowthTimelinePdfBuffer(payload);
      await file.save(pdfBuffer, {
        resumable: false,
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            uid,
            hash,
            schemaVersion: String(GROWTH_TIMELINE_PDF_SCHEMA_VERSION),
            title: payload.title,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    }

    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
      responseDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });

    await logPaidServiceUsage(uid, 'timeline_pdf', {
      itemCount: payload.items.length,
      title: payload.title,
      cached: exists,
    }).catch((error) => {
      logger.warn('유료 이용 개시 로그 기록 실패(generateGrowthTimelinePdf):', { uid, message: error?.message });
    });

    return {
      success: true,
      cached: exists,
      hash,
      filePath,
      downloadUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }
);

// ===== 💳 결제 요청 생성 (PortOne V2) =====
export const createSinglePaymentRequest = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    const plan = assertPaidPlan(request.data?.plan);
    const provider = getRequestedPaymentProvider(request.data?.provider);
    const payMethod = getProviderPayMethod(provider);
    const product = SINGLE_PAYMENT_REVIEW_PRODUCT.plans[plan];
    const paymentId = createPortOneRequestId('single');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAYMENT_REQUEST_TTL_MS);

    await getPaymentRequestRef(paymentId).set({
      uid,
      paymentId,
      plan,
      paymentType: 'one_time',
      billingType: 'single',
      provider,
      payMethod,
      storeId: HARU_PORTONE_STORE_ID,
      orderName: product.orderName,
      amount: product.amount,
      currency: 'KRW',
      status: 'created',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      paymentId,
      storeId: HARU_PORTONE_STORE_ID,
      orderName: product.orderName,
      amount: product.amount,
      currency: 'KRW',
      customData: {
        uid,
        plan,
        provider,
        payMethod,
        paymentType: 'one_time',
        billingType: 'single',
      },
    };
  }
);

export const createSubscriptionBillingRequest = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    const plan = assertPaidPlan(request.data?.plan);
    const provider = getRequestedPaymentProvider(request.data?.provider);
    const payMethod = getProviderPayMethod(provider);
    let customer: SubscriptionBillingCustomer;
    try {
      customer = normalizeSubscriptionBillingCustomer(request.data?.customer);
    } catch {
      throw new HttpsError('invalid-argument', '구매자 정보가 올바르지 않습니다.');
    }
    const amount = getSubscriptionPlanAmount(plan);
    const issueName = getSubscriptionOrderName(plan);
    const nowMs = Date.now();
    const now = new Date(nowMs);
    const expiresAt = new Date(now.getTime() + PAYMENT_REQUEST_TTL_MS);
    const issueId = createPortOneRequestId('billing');
    const lockRef = getSubscriptionPaymentLockRef(uid);
    const newRequestRef = getPaymentRequestRef(issueId);
    const subscriptionRef = db.doc(`users/${uid}/subscription/info`);

    return db.runTransaction(async (tx) => {
      const [lockSnap, subscriptionSnap] = await Promise.all([
        tx.get(lockRef),
        tx.get(subscriptionRef),
      ]);
      const subscriptionData = subscriptionSnap.data() || {};
      if (isActiveSubscriptionData(subscriptionData, nowMs)) {
        throw new HttpsError('failed-precondition', '이미 활성화된 정기구독이 있습니다.');
      }

      if (lockSnap.exists) {
        const lockData = lockSnap.data() || {};
        const lockedIssueId = typeof lockData.issueId === 'string' ? lockData.issueId : '';
        if (lockData.uid !== uid || !lockedIssueId) {
          throw new HttpsError('failed-precondition', '기존 정기결제 잠금 정보가 올바르지 않습니다.');
        }

        const lockedRequestRef = getPaymentRequestRef(lockedIssueId);
        const lockedRequestSnap = await tx.get(lockedRequestRef);
        if (!lockedRequestSnap.exists) {
          throw new HttpsError('failed-precondition', '기존 정기결제 요청 정보를 확인할 수 없습니다.');
        }
        const lockedRequestData = lockedRequestSnap.data() || {};
        const lockedProvider = getStoredPaymentProvider(lockedRequestData);
        const lockedPlan = assertPaidPlan(lockedRequestData.plan);
        const lockedStatus = normalizePaymentRequestStatus(lockedRequestData.status || lockData.status);
        const hasStartedInitialBilling =
          typeof lockedRequestData.lastPaymentId === 'string'
          || typeof lockData.lastPaymentId === 'string'
          || !!lockedRequestData.billingKeyIssuedAt
          || !!lockData.billingKeyIssuedAt;

        if (
          lockedRequestData.uid !== uid
          || lockedRequestData.paymentType !== 'subscription'
          || lockedRequestData.billingType !== 'billing_key_issue'
          || !lockedProvider
        ) {
          throw new HttpsError('failed-precondition', '기존 정기결제 요청 정보가 올바르지 않습니다.');
        }

        if (lockedStatus === 'failed' || lockedStatus === 'cancelled') {
          // Confirmed terminal requests release the UID lock; the write below replaces it with a new request.
        } else if (lockedStatus === 'created' && !hasStartedInitialBilling) {
          const lockedExpiresAt = lockedRequestData.expiresAt?.toMillis?.() || 0;
          if (lockedExpiresAt && lockedExpiresAt < nowMs) {
            tx.set(lockedRequestRef, {
              status: 'cancelled',
              cancelReason: 'expired_without_initial_billing',
              cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          } else {
            const lockedCustomer = getStoredSubscriptionBillingCustomer(lockedRequestData);
            if (!areSubscriptionBillingCustomersEqual(lockedCustomer, customer)) {
              tx.set(lockedRequestRef, {
                customer,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
              tx.set(lockRef, {
                customer,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
            }
            return buildSubscriptionBillingRequestResponse({
              uid,
              issueId: lockedIssueId,
              plan: lockedPlan,
              provider: lockedProvider,
              status: 'created',
              existing: true,
            });
          }
        } else {
          return {
            success: false,
            pending: true,
            status: lockedStatus || 'charging',
            issueId: lockedIssueId,
            plan: lockedPlan,
            provider: lockedProvider,
            payMethod: getProviderPayMethod(lockedProvider),
          };
        }
      }

      tx.set(newRequestRef, {
        uid,
        issueId,
        plan,
        paymentType: 'subscription',
        billingType: 'billing_key_issue',
        provider,
        payMethod,
        storeId: HARU_PORTONE_STORE_ID,
        orderName: issueName,
        amount,
        currency: 'KRW',
        customer,
        status: 'created',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(lockRef, {
        uid,
        issueId,
        plan,
        paymentType: 'subscription',
        billingType: 'billing_key_issue',
        provider,
        payMethod,
        storeId: HARU_PORTONE_STORE_ID,
        orderName: issueName,
        amount,
        currency: 'KRW',
        customer,
        status: 'created',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return buildSubscriptionBillingRequestResponse({
        uid,
        issueId,
        plan,
        provider,
        status: 'created',
        existing: false,
      });
    });
  }
);

export const recoverSubscriptionBillingRequest = onCall(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    const lockRef = getSubscriptionPaymentLockRef(uid);
    const lockSnap = await lockRef.get();
    if (!lockSnap.exists) {
      return { success: false, pending: false, status: 'none' };
    }

    const lockData = lockSnap.data() || {};
    const issueId = typeof lockData.issueId === 'string' ? lockData.issueId : '';
    if (lockData.uid !== uid || !issueId) {
      throw new HttpsError('failed-precondition', '정기결제 잠금 정보가 올바르지 않습니다.');
    }

    const requestRef = getPaymentRequestRef(issueId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      throw new HttpsError('failed-precondition', '정기결제 요청 정보를 확인할 수 없습니다.');
    }
    const requestData = requestSnap.data() || {};
    if (requestData.uid !== uid || requestData.paymentType !== 'subscription' || requestData.billingType !== 'billing_key_issue') {
      throw new HttpsError('permission-denied', '정기결제 요청 정보가 올바르지 않습니다.');
    }

    const plan = assertPaidPlan(requestData.plan);
    const provider = getStoredPaymentProvider(requestData);
    if (!provider) {
      throw new HttpsError('failed-precondition', '정기결제 요청의 결제수단 정보가 올바르지 않습니다.');
    }
    const payMethod = getStoredPayMethod(requestData, provider);
    const status = normalizePaymentRequestStatus(requestData.status || lockData.status);
    const lastPaymentId = typeof requestData.lastPaymentId === 'string'
      ? requestData.lastPaymentId
      : typeof lockData.lastPaymentId === 'string'
        ? lockData.lastPaymentId
        : '';

    if (lastPaymentId) {
      const paymentRef = getPaymentRequestRef(lastPaymentId);
      const alreadyProcessed = await isInitialBillingSubscriptionAlreadyProcessed({
        uid,
        paymentId: lastPaymentId,
        plan,
        provider,
        requestRef,
        paymentRef,
      });
      if (alreadyProcessed) {
        await lockRef.delete();
        return { success: true, alreadyProcessed: true };
      }

      let existingPayment: any;
      try {
        existingPayment = await fetchPortOnePaymentWithRetry(lastPaymentId);
      } catch (error: any) {
        await Promise.all([
          requestRef.set({
            status: 'charging',
            lastLookupError: getPortOneLookupError(error),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
          paymentRef.set({
            status: 'lookup_failed',
            lastLookupError: getPortOneLookupError(error),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
          lockRef.set({
            status: 'charging',
            lastPaymentId,
            lastLookupError: getPortOneLookupError(error),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
        ]);
        return {
          success: false,
          pending: true,
          status: 'lookup_failed',
          issueId,
          plan,
          provider,
          payMethod,
        };
      }

      const billingKey = typeof requestData.billingKey === 'string'
        ? requestData.billingKey
        : typeof lockData.billingKey === 'string'
          ? lockData.billingKey
          : '';
      if (!billingKey) {
        await markInitialBillingPaymentPending(requestRef, paymentRef, existingPayment?.status || 'UNKNOWN', lockRef);
        return {
          success: false,
          pending: true,
          status: 'billing_key_missing',
          issueId,
          plan,
          provider,
          payMethod,
        };
      }
      const customer = getStoredSubscriptionBillingCustomer(requestData);
      if (!customer) {
        await markInitialBillingPaymentFailed(requestRef, paymentRef, existingPayment?.status || 'UNKNOWN', lockRef);
        throw new HttpsError('failed-precondition', '저장된 구매자 정보가 올바르지 않습니다. 다시 시도해 주세요.');
      }

      return settleInitialBillingPayment({
        uid,
        issueId,
        paymentId: lastPaymentId,
        billingKey,
        customer,
        plan,
        provider,
        payMethod,
        amount: getSubscriptionPlanAmount(plan),
        orderName: getSubscriptionOrderName(plan),
        payment: existingPayment,
        requestRef,
        paymentRef,
        lockRef,
      });
    }

    if (status === 'failed' || status === 'cancelled') {
      await lockRef.delete();
      return { success: false, pending: false, status };
    }

    const hasStartedInitialBilling = !!requestData.billingKeyIssuedAt || !!lockData.billingKeyIssuedAt;
    if (status === 'created' && !hasStartedInitialBilling) {
      return { success: false, pending: false, status: 'created' };
    }

    return {
      success: false,
      pending: true,
      status: status || 'charging',
      issueId,
      plan,
      provider,
      payMethod,
    };
  }
);

// ===== 💳 결제 검증 (PortOne V2) =====
export const verifyPayment = onCall(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const paymentId = request.data?.paymentId;
    const uid = request.auth.uid;

    if (!paymentId || typeof paymentId !== 'string') {
      throw new HttpsError('invalid-argument', 'paymentId가 필요합니다.');
    }

    const orderRef = getPaymentRequestRef(paymentId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists || orderSnap.data()?.uid !== uid) {
      throw new HttpsError('permission-denied', '결제 요청 정보를 찾을 수 없습니다.');
    }
    const orderData = orderSnap.data() || {};
    if (orderData.paymentType !== 'one_time' && orderData.paymentType !== 'subscription') {
      throw new HttpsError('failed-precondition', '결제 요청 유형이 올바르지 않습니다.');
    }

    let payment: any;
    try {
      payment = await fetchPortOnePayment(paymentId);
    } catch (e: any) {
      logger.error('PortOne 결제 조회 실패:', {
        paymentId: maskPaymentId(paymentId),
        ...getPortOneLookupError(e),
      });
      throw new HttpsError('internal', '결제 정보를 조회할 수 없습니다.');
    }

    if (payment.status !== 'PAID') {
      await orderRef.set({
        status: payment.status || 'not_paid',
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      throw new HttpsError('failed-precondition', '결제가 완료되지 않았습니다.');
    }

    assertPaymentMatchesRequest(payment, orderData);

    const nowDate = new Date();
    const expiresDate = addOneMonth(nowDate);
    const now = nowDate.toISOString();
    const subRef = db.doc(`users/${uid}/subscription/info`);

    await db.runTransaction(async (tx) => {
      const freshOrder = await tx.get(orderRef);
      const freshData = freshOrder.data() || {};
      if (freshData.status === 'processed') return;
      const provider = getStoredPaymentProvider(freshData) || HARU_KAKAOPAY_PROVIDER;
      const payMethod = getStoredPayMethod(freshData, provider);

      tx.set(subRef, {
        plan: freshData.plan,
        status: 'active',
        paymentType: freshData.paymentType,
        billingType: freshData.billingType,
        autoRenew: freshData.paymentType === 'subscription',
        startDate: now,
        endDate: expiresDate.toISOString(),
        nextBillingDate: freshData.paymentType === 'subscription' ? expiresDate.toISOString() : null,
        paymentId,
        lastPaymentId: paymentId,
        lastPaidAmount: freshData.amount,
        payMethod,
        provider,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(orderRef, {
        status: 'processed',
        portoneStatus: payment.status,
        paymentMethod: getPaymentMethodLabel(payment),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    logger.info('✅ PortOne 결제 검증 완료 — uid: %s, paymentId: %s', uid, maskPaymentId(paymentId));
    return { success: true };
  }
);

// ===== 💳 정기결제 시작 (PortOne V2 빌링키) =====
export const subscribeWithBillingKey = onCall(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    const { billingKey } = request.data || {};
    const issueId = typeof request.data?.issueId === 'string' ? request.data.issueId.trim() : '';

    if (!billingKey || typeof billingKey !== 'string') {
      throw new HttpsError('invalid-argument', 'billingKey가 필요합니다.');
    }
    if (!issueId) {
      throw new HttpsError('invalid-argument', 'issueId가 필요합니다.');
    }

    const requestRef = getPaymentRequestRef(issueId);
    const lockRef = getSubscriptionPaymentLockRef(uid);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      throw new HttpsError('failed-precondition', '빌링키 발급 요청 정보를 찾을 수 없습니다.');
    }
    const requestData = requestSnap.data() || {};
    if (requestData.uid !== uid || requestData.paymentType !== 'subscription' || requestData.billingType !== 'billing_key_issue') {
      throw new HttpsError('permission-denied', '빌링키 발급 요청 정보가 올바르지 않습니다.');
    }
    const plan = assertPaidPlan(requestData.plan);
    const provider = getStoredPaymentProvider(requestData);
    if (!provider) {
      throw new HttpsError('failed-precondition', '빌링키 발급 요청의 결제수단 정보가 올바르지 않습니다.');
    }
    const payMethod = getStoredPayMethod(requestData, provider);
    const existingInitialPaymentId = typeof requestData.lastPaymentId === 'string' ? requestData.lastPaymentId : '';
    const requestCustomer = getStoredSubscriptionBillingCustomer(requestData);
    if (!requestCustomer && !existingInitialPaymentId) {
      await markSubscriptionBillingRequestPreflightFailed(requestRef, lockRef, 'missing_customer_info');
      throw new HttpsError('failed-precondition', '구매자 정보가 올바르지 않습니다. 다시 시도해 주세요.');
    }
    const requestExpiresAt = requestData.expiresAt?.toMillis?.() || 0;
    if (requestExpiresAt && requestExpiresAt < Date.now()) {
      throw new HttpsError('deadline-exceeded', '빌링키 발급 요청이 만료되었습니다. 다시 시도해 주세요.');
    }

    const amount = getSubscriptionPlanAmount(plan);
    const orderName = getSubscriptionOrderName(plan);
    type InitialBillingAction =
      | { action: 'charge'; paymentId: string; customer: SubscriptionBillingCustomer }
      | { action: 'settle_existing'; paymentId: string; customer: SubscriptionBillingCustomer | null };
    const newPaymentId = createPortOneRequestId('subscription');
    const newPaymentRef = getPaymentRequestRef(newPaymentId);
    const locked = await db.runTransaction(async (tx) => {
      const [fresh, freshLock] = await Promise.all([
        tx.get(requestRef),
        tx.get(lockRef),
      ]);
      const freshData = fresh.data() || {};
      const freshLockData = freshLock.data() || {};
      const freshProvider = getStoredPaymentProvider(freshData);
      if (
        freshData.uid !== uid
        || freshData.plan !== plan
        || freshData.paymentType !== 'subscription'
        || freshData.billingType !== 'billing_key_issue'
        || freshProvider !== provider
      ) {
        throw new HttpsError('permission-denied', '빌링키 발급 요청 정보가 올바르지 않습니다.');
      }
      if (!freshLock.exists || freshLockData.uid !== uid || freshLockData.issueId !== issueId) {
        throw new HttpsError('failed-precondition', '정기결제 잠금 정보가 올바르지 않습니다. 결제 상태를 다시 확인해 주세요.');
      }
      if (
        (freshData.status === 'processed' || freshData.status === 'charging')
        && typeof freshData.lastPaymentId === 'string'
        && freshData.lastPaymentId
      ) {
        return {
          action: 'settle_existing',
          paymentId: freshData.lastPaymentId,
          customer: getStoredSubscriptionBillingCustomer(freshData),
        } as InitialBillingAction;
      }
      if (freshData.status !== 'created') {
        throw new HttpsError('failed-precondition', '이미 처리 중이거나 실패한 빌링키 발급 요청입니다. 다시 시도해 주세요.');
      }
      let freshCustomer: SubscriptionBillingCustomer;
      try {
        freshCustomer = assertStoredSubscriptionBillingCustomer(freshData);
      } catch {
        throw new HttpsError('failed-precondition', '저장된 구매자 정보가 올바르지 않습니다. 다시 시도해 주세요.');
      }
      tx.set(requestRef, {
        status: 'charging',
        billingKey,
        billingKeyIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastPaymentId: newPaymentId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(lockRef, {
        uid,
        issueId,
        plan,
        provider,
        payMethod,
        status: 'charging',
        billingKey,
        billingKeyIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastPaymentId: newPaymentId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(newPaymentRef, {
        uid,
        paymentId: newPaymentId,
        issueId,
        plan,
        paymentType: 'subscription',
        billingType: 'initial_billing',
        provider,
        payMethod,
        storeId: HARU_PORTONE_STORE_ID,
        orderName,
        amount,
        currency: 'KRW',
        status: 'charging',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { action: 'charge', paymentId: newPaymentId, customer: freshCustomer } as InitialBillingAction;
    });
    const paymentId = locked.paymentId;
    const paymentRef = getPaymentRequestRef(paymentId);

    if (locked.action === 'settle_existing') {
      const alreadyProcessed = await isInitialBillingSubscriptionAlreadyProcessed({
        uid,
        paymentId,
        plan,
        provider,
        requestRef,
        paymentRef,
      });
      if (alreadyProcessed) {
        await lockRef.delete();
        return { success: true, alreadyProcessed: true };
      }

      let existingPayment: any;
      try {
        existingPayment = await fetchPortOnePaymentWithRetry(paymentId);
      } catch (error: any) {
        await Promise.all([
          requestRef.set({
            status: 'charging',
            lastLookupError: getPortOneLookupError(error),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
          lockRef.set({
            status: 'charging',
            lastPaymentId: paymentId,
            lastLookupError: getPortOneLookupError(error),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
          paymentRef.set({
            status: 'lookup_failed',
            lastLookupError: getPortOneLookupError(error),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
        ]);
        logger.error(`${getProviderLogLabel(provider)} 첫 결제 재조회 실패:`, {
          issueId: maskPaymentId(issueId),
          paymentId: maskPaymentId(paymentId),
          ...getPortOneLookupError(error),
        });
        throw new HttpsError('unavailable', '기존 첫 결제 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      }
      if (!locked.customer) {
        await markInitialBillingPaymentFailed(requestRef, paymentRef, existingPayment?.status || 'UNKNOWN', lockRef);
        throw new HttpsError('failed-precondition', '저장된 구매자 정보가 올바르지 않습니다. 다시 시도해 주세요.');
      }

      return settleInitialBillingPayment({
        uid,
        issueId,
        paymentId,
        billingKey,
        customer: locked.customer,
        plan,
        provider,
        payMethod,
        amount,
        orderName,
        payment: existingPayment,
        requestRef,
        paymentRef,
        lockRef,
      });
    }

    let payment: any;
    try {
      const portoneRes = await axios.post(
        `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/billing-key`,
        buildPortOneBillingKeyPaymentPayload({
          storeId: HARU_PORTONE_STORE_ID,
          billingKey,
          orderName,
          amount,
          currency: 'KRW',
          customer: locked.customer,
          customData: {
            uid,
            plan,
            provider,
            payMethod,
            paymentType: 'subscription',
            billingType: 'initial_billing',
            issueId,
          },
        }),
        { headers: { Authorization: `PortOne ${PORTONE_API_SECRET.value().trim()}` } }
      );
      payment = portoneRes.data;
    } catch (e: any) {
      const billingError = getPortOneBillingErrorSummary(e);
      logger.error(`PortOne ${getProviderLogLabel(provider)} 빌링키 첫 결제 실패:`, {
        paymentId: maskPaymentId(paymentId),
        status: billingError.httpStatus,
        code: billingError.code,
        type: billingError.type,
      });
      if (billingError.terminal) {
        await markInitialBillingPaymentFailed(requestRef, paymentRef, billingError.portoneStatus, lockRef);
        await Promise.all([
          requestRef.set({
            lastBillingError: billingError.safeReason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
          paymentRef.set({
            lastBillingError: billingError.safeReason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
        ]);
        throw new HttpsError('failed-precondition', '첫 결제가 실패 또는 취소되었습니다.');
      }
      await Promise.all([
        paymentRef.set({
          status: 'charging',
          portoneStatus: billingError.portoneStatus,
          lastBillingError: billingError.safeReason,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }),
        requestRef.set({
          status: 'charging',
          portoneStatus: billingError.portoneStatus,
          lastBillingError: billingError.safeReason,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }),
        lockRef.set({
          status: 'charging',
          lastPaymentId: paymentId,
          portoneStatus: billingError.portoneStatus,
          lastBillingError: billingError.safeReason,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }),
      ]);
      throw new HttpsError('unavailable', '첫 결제 요청 결과를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.');
    }

    const result = await settleInitialBillingPayment({
      uid,
      issueId,
      paymentId,
      billingKey,
      customer: locked.customer,
      plan,
      provider,
      payMethod,
      amount,
      orderName,
      payment,
      requestRef,
      paymentRef,
      lockRef,
    });

    if (result.success) {
      logger.info('✅ %s 정기구독 시작 — uid: %s, plan: %s, paymentId: %s', getProviderLogLabel(provider), uid, plan, maskPaymentId(paymentId));
    }
    return result;
  }
);

// ===== 💳 정기구독 해지 =====
// 실제 해지 로직은 subscriptionHelpers.ts의 cancelSubscriptionForUid로 분리되어 있다.
// (accountDeletion.ts의 requestAccountDeletion에서도 재사용하기 위함 — index.ts와의 순환 참조 방지)
export const cancelSubscription = onCall(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = request.auth.uid;
    await revokeBillingKeyForUid(uid, PORTONE_API_SECRET.value(), 'subscription_cancelled');
    const result = await cancelSubscriptionForUid(uid);
    return {
      success: true,
      ...result,
    };
  }
);

// ===== 💳 정기결제 반복 과금 =====
export const processRecurringSubscriptions = onSchedule(
  {
    region: 'asia-northeast3',
    schedule: 'every day 09:00',
    timeZone: 'Asia/Seoul',
    secrets: [PORTONE_API_SECRET],
  },
  async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const cancelledSnap = await db.collection('billingSubscriptions')
      .where('status', '==', 'cancelled')
      .limit(100)
      .get();

    for (const docSnap of cancelledSnap.docs) {
      const uid = docSnap.id;
      const billingRef = docSnap.ref;
      const data = docSnap.data();
      if (typeof data.endDate === 'string' && data.endDate > nowIso) continue;

      const update = {
        plan: 'free',
        status: 'none',
        paymentId: null,
        billingKey: admin.firestore.FieldValue.delete(),
        nextBillingDate: null,
        cancelAtPeriodEnd: false,
        expiredAt: nowIso,
        updatedAt: nowIso,
      };

      await Promise.all([
        db.doc(`users/${uid}/subscription/info`).set(update, { merge: true }),
        billingRef.set({
          status: 'expired',
          billingKey: admin.firestore.FieldValue.delete(),
          nextBillingDate: null,
          expiredAt: nowIso,
          updatedAt: nowIso,
        }, { merge: true }),
      ]);
      logger.info('✅ 해지 구독 만료 처리 — uid: %s', uid);
    }

    const dueSnap = await db.collection('billingSubscriptions')
      .where('status', '==', 'active')
      .limit(100)
      .get();

    for (const docSnap of dueSnap.docs) {
      const uid = docSnap.id;
      const billingRef = docSnap.ref;
      const data = docSnap.data();
      if (shouldExcludeFromRecurringBilling(uid)) {
        logger.info(
          'processRecurringSubscriptions.internal_entitlement_skipped',
          buildRecurringBillingSkipLogContext(uid, data),
        );
        continue;
      }
      const provider = getStoredPaymentProvider(data);
      if (!provider) continue;
      if (typeof data.nextBillingDate !== 'string' || data.nextBillingDate > nowIso) continue;
      const billingKey = typeof data.billingKey === 'string' ? data.billingKey : '';
      const plan = data.plan === 'basic' ? 'basic' : data.plan === 'premium' ? 'premium' : '';
      const payMethod = getStoredPayMethod(data, provider);
      const customer = getStoredSubscriptionBillingCustomer(data);

      if (!billingKey || !plan || !customer) {
        await billingRef.set({
          status: 'needs_attention',
          billingLockUntil: null,
          lastBillingError: !billingKey || !plan
            ? 'missing_billing_key_or_plan'
            : 'missing_recurring_customer_info',
          updatedAt: nowIso,
        }, { merge: true });
        continue;
      }

      const lockedCustomer = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(billingRef);
        const freshData = fresh.data() || {};
        const lockUntil = typeof freshData.billingLockUntil === 'string'
          ? Date.parse(freshData.billingLockUntil)
          : 0;
        const freshProvider = getStoredPaymentProvider(freshData);
        const freshPlan = freshData.plan === 'basic' ? 'basic' : freshData.plan === 'premium' ? 'premium' : '';
        const freshCustomer = getStoredSubscriptionBillingCustomer(freshData);
        if (freshData.status !== 'active') return false;
        if (freshProvider !== provider) return false;
        if (freshPlan !== plan) return false;
        if (typeof freshData.nextBillingDate !== 'string' || freshData.nextBillingDate > nowIso) return false;
        if (Number.isFinite(lockUntil) && lockUntil > Date.now()) return false;
        if (!freshCustomer) {
          tx.set(billingRef, {
            status: 'needs_attention',
            billingLockUntil: null,
            lastBillingError: 'missing_recurring_customer_info',
            updatedAt: nowIso,
          }, { merge: true });
          return false;
        }

        tx.set(billingRef, {
          billingLockUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          updatedAt: nowIso,
        }, { merge: true });
        return freshCustomer;
      });
      if (!lockedCustomer) continue;

      const amount = getSubscriptionPlanAmount(plan);
      const orderName = getSubscriptionOrderName(plan);
      const paymentId = createPortOneRequestId('recurring');
      const paymentRef = getPaymentRequestRef(paymentId);
      await paymentRef.set({
        uid,
        paymentId,
        plan,
        paymentType: 'subscription',
        billingType: 'recurring',
        provider,
        payMethod,
        storeId: HARU_PORTONE_STORE_ID,
        orderName,
        amount,
        currency: 'KRW',
        status: 'charging',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      try {
        const portoneRes = await axios.post(
          `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/billing-key`,
          buildPortOneBillingKeyPaymentPayload({
            storeId: HARU_PORTONE_STORE_ID,
            billingKey,
            orderName,
            amount,
            currency: 'KRW',
            customer: lockedCustomer,
            customData: {
              uid,
              plan,
              provider,
              payMethod,
              paymentType: 'subscription',
              billingType: 'recurring',
            },
          }),
          { headers: { Authorization: `PortOne ${PORTONE_API_SECRET.value().trim()}` } }
        );
        const payment = portoneRes.data;
        const portoneStatus = typeof payment?.status === 'string' ? payment.status : 'UNKNOWN';
        if (portoneStatus !== 'PAID') {
          const safeReason = `PORTONE_${portoneStatus}`;
          if (isFailedOrCancelledPaymentStatus(portoneStatus)) {
            await Promise.all([
              billingRef.set({
                status: 'needs_attention',
                billingLockUntil: null,
                lastBillingError: safeReason,
                lastBillingFailedAt: nowIso,
                updatedAt: nowIso,
              }, { merge: true }),
              paymentRef.set({
                status: 'failed',
                portoneStatus,
                lastBillingError: safeReason,
                failedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true }),
            ]);
          } else {
            await Promise.all([
              billingRef.set({
                lastBillingError: safeReason,
                updatedAt: nowIso,
              }, { merge: true }),
              paymentRef.set({
                status: 'pending',
                portoneStatus,
                lastBillingError: safeReason,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true }),
            ]);
          }
          logger.warn(`${getProviderLogLabel(provider)} 반복 과금 미완료:`, {
            uid,
            paymentId: maskPaymentId(paymentId),
            portoneStatus,
          });
          continue;
        }

        const nextBillingDate = addOneMonth(now);
        const update = {
          plan,
          status: 'active',
          payMethod,
          provider,
          amount,
          orderName,
          endDate: nextBillingDate.toISOString(),
          nextBillingDate: nextBillingDate.toISOString(),
          paymentId,
          lastPaymentId: paymentId,
          lastPaidAt: nowIso,
          billingLockUntil: null,
          lastBillingError: null,
          updatedAt: nowIso,
        };

        await Promise.all([
          db.doc(`users/${uid}/subscription/info`).set(update, { merge: true }),
          billingRef.set({ ...update, billingKey, customer: lockedCustomer }, { merge: true }),
          paymentRef.set({
            status: 'processed',
            portoneStatus: payment?.status || 'PAID',
            paymentMethod: getPaymentMethodLabel(payment),
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
        ]);
        logger.info('✅ %s 반복 과금 완료 — uid: %s, paymentId: %s', getProviderLogLabel(provider), uid, maskPaymentId(paymentId));
      } catch (error: any) {
        const billingError = getPortOneBillingErrorSummary(error);
        logger.error(`${getProviderLogLabel(provider)} 반복 과금 실패:`, {
          uid,
          paymentId: maskPaymentId(paymentId),
          status: billingError.httpStatus,
          code: billingError.code,
          type: billingError.type,
        });
        if (billingError.terminal) {
          await Promise.all([
            billingRef.set({
              status: 'needs_attention',
              billingLockUntil: null,
              lastBillingError: billingError.safeReason,
              lastBillingFailedAt: nowIso,
              updatedAt: nowIso,
            }, { merge: true }),
            paymentRef.set({
              status: 'failed',
              portoneStatus: billingError.portoneStatus,
              lastBillingError: billingError.safeReason,
              failedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true }),
          ]);
          continue;
        }
        await Promise.all([
          billingRef.set({
            lastBillingError: billingError.safeReason,
            updatedAt: nowIso,
          }, { merge: true }),
          paymentRef.set({
            status: 'charging',
            portoneStatus: billingError.portoneStatus,
            lastBillingError: billingError.safeReason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
        ]);
      }
    }
  }
);

// ===== 💳 일반(단건) 1개월 이용권 검증 =====
export const verifySinglePayment = onCall(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const paymentId = request.data?.paymentId;
    const uid = request.auth.uid;

    if (!paymentId || typeof paymentId !== 'string') {
      throw new HttpsError('invalid-argument', 'paymentId가 필요합니다.');
    }
    const orderRef = getPaymentRequestRef(paymentId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists || orderSnap.data()?.uid !== uid) {
      throw new HttpsError('permission-denied', '결제 요청 정보를 찾을 수 없습니다.');
    }
    const orderData = orderSnap.data() || {};
    if (orderData.paymentType !== 'one_time' || orderData.billingType !== 'single') {
      throw new HttpsError('failed-precondition', '단건 결제 요청 정보가 올바르지 않습니다.');
    }
    const requestedPlan = assertPaidPlan(orderData.plan);
    const singleProduct = SINGLE_PAYMENT_REVIEW_PRODUCT.plans[requestedPlan];
    const provider = getStoredPaymentProvider(orderData) || HARU_INICIS_PROVIDER;
    const payMethod = getStoredPayMethod(orderData, provider);

    let payment: any;
    try {
      payment = await fetchPortOnePaymentWithRetry(paymentId);
    } catch (e: any) {
      logger.error('PortOne 단건결제 조회 실패:', {
        paymentId: maskPaymentId(paymentId),
        ...getPortOneLookupError(e),
      });
      throw new HttpsError('internal', '결제 정보를 조회할 수 없습니다.');
    }

    if (payment.status !== 'PAID') {
      throw new HttpsError('failed-precondition', '결제가 완료되지 않았습니다.');
    }

    assertPaymentMatchesRequest(payment, orderData);

    const nowDate = new Date();
    const expiresDate = new Date(nowDate);
    expiresDate.setDate(expiresDate.getDate() + SINGLE_PAYMENT_REVIEW_PRODUCT.durationDays);
    const now = nowDate.toISOString();
    const expiresAt = admin.firestore.Timestamp.fromDate(expiresDate);
    const singlePaymentRef = db.doc(`paymentReviews/single/payments/${paymentId}`);
    let alreadyProcessed = false;
    await db.runTransaction(async (tx) => {
      const [freshOrder, existing] = await Promise.all([
        tx.get(orderRef),
        tx.get(singlePaymentRef),
      ]);
      const freshOrderData = freshOrder.data() || {};
      if (existing.exists || freshOrderData.status === 'processed') {
        alreadyProcessed = true;
        return;
      }
      if (freshOrderData.uid !== uid || freshOrderData.paymentType !== 'one_time' || freshOrderData.billingType !== 'single') {
        throw new HttpsError('permission-denied', '결제 요청 정보가 올바르지 않습니다.');
      }
      const storedProvider = getStoredPaymentProvider(freshOrderData) || provider;
      const storedPayMethod = getStoredPayMethod(freshOrderData, storedProvider);

      tx.set(db.doc(`users/${uid}/subscription/info`), {
        status: 'active',
        plan: requestedPlan,
        paymentType: 'one_time',
        billingType: 'single',
        autoRenew: false,
        startDate: now,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        endDate: expiresDate.toISOString(),
        expiresAt,
        nextBillingDate: null,
        lastPaymentId: paymentId,
        lastPaidAmount: singleProduct.amount,
        payMethod: storedPayMethod,
        provider: storedProvider,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(singlePaymentRef, {
        paymentId,
        orderName: singleProduct.orderName,
        amount: singleProduct.amount,
        status: payment.status,
        type: 'single_payment',
        paymentType: 'one_time',
        billingType: 'single',
        durationDays: SINGLE_PAYMENT_REVIEW_PRODUCT.durationDays,
        plan: requestedPlan,
        uid,
        guestAllowed: false,
        provider: storedProvider,
        payMethod: storedPayMethod,
        paymentMethod: getPaymentMethodLabel(payment),
        grantResult: 'subscription_30days_granted',
        grantedUntil: expiresAt,
        createdAt: now,
        updatedAt: now,
      });
      tx.set(orderRef, {
        status: 'processed',
        portoneStatus: payment.status,
        paymentMethod: getPaymentMethodLabel(payment),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    if (alreadyProcessed) {
      return { success: true, alreadyProcessed: true };
    }

    logger.info('✅ %s 단건 1개월 이용권 검증 완료 — uid: %s, plan: %s, paymentId: %s', getProviderLogLabel(provider), uid, requestedPlan, maskPaymentId(paymentId));
    return {
      success: true,
      plan: requestedPlan,
      expiresAt: expiresDate.toISOString(),
    };
  }
);

// ===== 💳 PortOne V2 결제 웹훅 =====
export const portoneWebhook = onRequest(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET, PORTONE_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const rawPayload = (req as any).rawBody?.toString('utf8')
      || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
    let webhook: any;
    try {
      webhook = await PortOne.Webhook.verify(
        PORTONE_WEBHOOK_SECRET.value().trim(),
        rawPayload,
        req.headers
      );
    } catch (error: any) {
      logger.warn('PortOne 웹훅 서명 검증 실패:', { message: error?.message });
      res.status(400).send('Invalid webhook signature');
      return;
    }

    if (PortOne.Webhook.isUnrecognizedWebhook(webhook)) {
      logger.info('PortOne 미인식 웹훅 수신:', { type: String(webhook.type) });
      res.status(200).send('ok');
      return;
    }

    const paymentId = webhook?.data?.paymentId;
    const storeId = webhook?.data?.storeId;
    if (!paymentId || typeof paymentId !== 'string') {
      logger.info('PortOne 결제 ID 없는 웹훅 ACK:', { type: webhook?.type });
      res.status(200).send('ok');
      return;
    }
    if (storeId && storeId !== HARU_PORTONE_STORE_ID) {
      logger.warn('PortOne 웹훅 상점 불일치:', { type: webhook?.type, paymentId: maskPaymentId(paymentId) });
      res.status(400).send('Store mismatch');
      return;
    }

    const eventId = getWebhookEventId(webhook, paymentId);
    const eventRef = db.doc(`portoneWebhookEvents/${eventId}`);
    const existingEvent = await eventRef.get();
    if (existingEvent.data()?.processedAt) {
      res.status(200).send('ok');
      return;
    }

    let payment: any;
    try {
      payment = await fetchPortOnePaymentWithRetry(paymentId);
    } catch (error: any) {
      await eventRef.set({
        eventId,
        type: webhook.type,
        paymentId,
        storeId: storeId || null,
        status: 'lookup_failed',
        lookupError: getPortOneLookupError(error),
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      logger.error('PortOne 웹훅 결제 재조회 실패:', {
        paymentId: maskPaymentId(paymentId),
        ...getPortOneLookupError(error),
      });
      res.status(500).send('Payment lookup failed');
      return;
    }

    const orderRef = getPaymentRequestRef(paymentId);
    const orderSnap = await orderRef.get();
    const orderData = orderSnap.data() || null;
    const portoneStatus = typeof payment?.status === 'string' ? payment.status : 'UNKNOWN';

    if (orderData) {
      try {
        assertPaymentMatchesRequest(payment, orderData);
      } catch (error: any) {
        await eventRef.set({
          eventId,
          type: webhook.type,
          paymentId,
          storeId,
          portoneStatus,
          status: 'validation_failed',
          validationError: error?.message || 'payment_mismatch',
          receivedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        logger.error('PortOne 웹훅 결제 검증 불일치:', {
          paymentId: maskPaymentId(paymentId),
          message: error?.message,
        });
        res.status(400).send('Payment mismatch');
        return;
      }
    }

    await db.runTransaction(async (tx) => {
      const freshEvent = await tx.get(eventRef);
      if (freshEvent.data()?.processedAt) return;
      let freshOrderData = orderData;
      let singlePaymentAlreadyExists = false;
      const singlePaymentRef = db.doc(`paymentReviews/single/payments/${paymentId}`);
      if (orderData) {
        const freshOrder = await tx.get(orderRef);
        freshOrderData = freshOrder.data() || null;
        if (freshOrderData?.paymentType === 'one_time' && freshOrderData?.billingType === 'single') {
          singlePaymentAlreadyExists = (await tx.get(singlePaymentRef)).exists;
        }
      }

      tx.set(eventRef, {
        eventId,
        type: webhook.type,
        paymentId,
        storeId: storeId || null,
        transactionId: webhook?.data?.transactionId || null,
        portoneStatus,
        paymentType: freshOrderData?.paymentType || null,
        billingType: freshOrderData?.billingType || null,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      if (freshOrderData) {
        tx.set(orderRef, {
          portoneStatus,
          webhookType: webhook.type,
          paymentMethod: getPaymentMethodLabel(payment),
          webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      if (freshOrderData?.paymentType === 'one_time' && freshOrderData?.billingType === 'single' && portoneStatus === 'PAID') {
        const uid = freshOrderData.uid;
        const plan = freshOrderData.plan === 'basic' ? 'basic' : freshOrderData.plan === 'premium' ? 'premium' : null;
        if (!uid || !plan || freshOrderData.status === 'processed' || singlePaymentAlreadyExists) return;
        const provider = getStoredPaymentProvider(freshOrderData) || HARU_KAKAOPAY_PROVIDER;
        const payMethod = getStoredPayMethod(freshOrderData, provider);
        const nowDate = new Date();
        const expiresDate = new Date(nowDate);
        expiresDate.setDate(expiresDate.getDate() + SINGLE_PAYMENT_REVIEW_PRODUCT.durationDays);
        const expiresAt = admin.firestore.Timestamp.fromDate(expiresDate);

        tx.set(db.doc(`users/${uid}/subscription/info`), {
          status: 'active',
          plan,
          paymentType: 'one_time',
          billingType: 'single',
          autoRenew: false,
          startDate: nowDate.toISOString(),
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          endDate: expiresDate.toISOString(),
          expiresAt,
          nextBillingDate: null,
          lastPaymentId: paymentId,
          lastPaidAmount: freshOrderData.amount,
          payMethod,
          provider,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(singlePaymentRef, {
          paymentId,
          orderName: freshOrderData.orderName,
          amount: freshOrderData.amount,
          status: portoneStatus,
          type: 'single_payment',
          paymentType: 'one_time',
          billingType: 'single',
          durationDays: SINGLE_PAYMENT_REVIEW_PRODUCT.durationDays,
          plan,
          uid,
          guestAllowed: false,
          provider,
          payMethod,
          paymentMethod: getPaymentMethodLabel(payment),
          grantResult: 'subscription_30days_granted',
          grantedUntil: expiresAt,
          createdAt: nowDate.toISOString(),
          updatedAt: nowDate.toISOString(),
        }, { merge: true });
        tx.set(orderRef, {
          status: 'processed',
          processedBy: 'webhook',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } else if (freshOrderData && isFinalFailedPaymentStatus(portoneStatus)) {
        tx.set(orderRef, {
          status: portoneStatus.toLowerCase(),
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    logger.info('✅ PortOne 웹훅 처리 완료:', {
      type: webhook.type,
      paymentId: maskPaymentId(paymentId),
      portoneStatus,
    });

    if (portoneStatus === 'CANCELLED' || portoneStatus === 'PARTIAL_CANCELLED') {
      await syncSubscriptionRefundFromPortOnePayment(paymentId, payment, 'webhook');
    }
    res.status(200).send('ok');
  }
);

// ===== 🗑️ 일회성 마이그레이션: 모든 사용자 _tags 필드 일괄 삭제 =====
export const removeAllTags = onRequest(
  { region: 'asia-northeast3' },
  async (req, res) => {
    const db = admin.firestore();
    const usersSnap = await db.collection('users').get();
    let count = 0;
    for (const userDoc of usersSnap.docs) {
      const recordsSnap = await userDoc.ref.collection('records').get();
      for (const recordDoc of recordsSnap.docs) {
        const data = recordDoc.data();
        const tagFields = Object.keys(data).filter((k) => k.endsWith('_tags'));
        if (tagFields.length > 0) {
          const updateData: Record<string, admin.firestore.FieldValue> = {};
          tagFields.forEach((f) => {
            updateData[f] = admin.firestore.FieldValue.delete();
          });
          await recordDoc.ref.update(updateData);
          count++;
        }
      }
    }
    res.send(`완료: ${count}개 문서에서 _tags 필드 삭제`);
  }
);

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
  },
  async (request) => {
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

    try {
      const { XMLParser } = await import('fast-xml-parser');
      const LAW_API_KEY = LAW_API_KEY_SECRET.value().trim();
      const GEMINI_KEY = GEMINI_API_KEY_SECRET.value().trim();
      const { fileParts } = attachments.length > 0
        ? await loadHaruLawAttachmentParts(uid, attachments)
        : { fileParts: [] as HaruLawGeminiFilePart[] };

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
        let lastError: any;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            return await axios.get(url, axiosConfig);
          } catch (error: any) {
            lastError = error;
            const status = error?.response?.status;
            const retriable =
              error?.code === 'ECONNRESET' ||
              error?.code === 'ETIMEDOUT' ||
              error?.code === 'ECONNABORTED' ||
              !error?.response ||
              status >= 500;

            if (!retriable || attempt === 3) {
              throw error;
            }

            logger.warn('HARUraw 법제처 API 재시도', {
              attempt,
              code: error?.code,
              status,
            });
            await new Promise((resolve) => setTimeout(resolve, attempt * 700));
          }
        }

        throw lastError;
      };

      // 0단계: Gemini로 정확한 법령 이름 추출
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
      console.log('HARUraw 추출 키워드:', lawKeyword);

      // 1단계: 법제처 검색
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
      console.log('HARUraw 선택 법령:', lawName, 'MST:', mstId);

      if (!mstId) {
        return { success: false, message: '법령 정보를 가져올 수 없습니다.', data: [], aiSummary: '' };
      }

      // 2단계: 법령 전문 조회
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
      const summaryContents: any = fileParts.length > 0
        ? [{ text: summaryPrompt }, ...fileParts]
        : summaryPrompt;
      const summaryResult = await summaryModel.generateContent(summaryContents);
      const summaryUsage = getGeminiUsage(summaryResult);
      await logAiUsage({
        uid: request.auth.uid,
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
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });

      return {
        success: true,
        data: finalJomuns,
        aiSummary: summaryResult.response.text(),
      };

    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('HARUraw 법령 검색 실패:', error);
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
          errorCode: getAiUsageErrorCode(error),
          isDev: DEVELOPER_UIDS.has(request.auth.uid),
        });
      }
      throw new HttpsError('internal', '법령 검색에 실패했습니다.');
    }
  }
);

export const prepareHaruLawSharePreview = onCall(
  {
    region: 'asia-northeast3',
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
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const { lawText, userQuery } = request.data;

    if (!lawText) {
      throw new HttpsError('invalid-argument', '법령 텍스트를 입력해주세요.');
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const modelName = 'gemini-3.1-flash-lite';
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

      const prompt = userQuery
        ? `[사용자 질문]: ${userQuery}\n\n[관련 법조문]: ${lawText}`
        : lawText;
      const result = await model.generateContent(prompt);
      const usage = getGeminiUsage(result);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'law_explain',
        plan: AI_USAGE_PLAN,
        model: modelName,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        imageCount: 0,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      return {
        success: true,
        explanation: result.response.text(),
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

// ===== TTS 음성 생성 =====
export const generateTTS = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET, GOOGLE_CLOUD_API_KEY_SECRET, OPENAI_API_KEY_SECRET],
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { text, cacheKey, voice = 'nova' } = request.data;
    if (!text || !cacheKey) {
      throw new HttpsError('invalid-argument', '텍스트와 캐시키가 필요합니다.');
    }
    const validVoices = ['nova', 'onyx', 'alloy', 'echo', 'fable', 'shimmer'];
    const safeVoice = validVoices.includes(voice) ? voice : 'nova';
    const filePath = `ttsCache/${cacheKey}_${safeVoice}.mp3`;
    const file = bucket().file(filePath);

    try {
      // 1. Storage 캐시 확인 — 캐시된 경우 서명된 URL 반환 (한도 차감 없음)
      const [exists] = await file.exists();
      if (exists) {
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 3600 * 1000, // 1시간
        });
        return { success: true, audioUrl: signedUrl, cached: true };
      }

      // 사용자별 하루 TTS 호출 제한 (KST 기준, 캐시 미스 = 새 절 첫 청취만 차감)
      const uid = request.auth.uid;
      const todayKst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      const usageRef = db.doc(`users/${uid}/ttsUsage/${todayKst}`);
      const usageSnap = await usageRef.get();
      const currentCount = usageSnap.exists ? (usageSnap.data()?.count ?? 0) : 0;
      if (currentCount >= 500) {
        throw new HttpsError('resource-exhausted', '오늘 TTS 사용 한도를 초과했습니다');
      }

      // 2. OpenAI TTS 생성
      const OPENAI_KEY = OPENAI_API_KEY_SECRET.value().replace(/[^\x20-\x7E]/g, '').trim();

      // 텍스트 정제 — 한글, 영문만 남기기
      const cleanedText = text
        .replace(/#{1,3}\s*/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/[`~^|\\[\]{}]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[0-9]+\./g, '')
        .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')
        .replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s.,!?]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 4000);

      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      // 429(rate limit) 백오프: OpenAI Retry-After 헤더 우선, 미제공 시 5/10/20초 + jitter, 총 3회 시도
      const BACKOFF_MS = [5000, 10000, 20000];
      const MAX_ATTEMPTS = 3;
      let ttsResponse: any = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          ttsResponse = await axios.post(
            'https://api.openai.com/v1/audio/speech',
            {
              model: 'tts-1',
              input: cleanedText,
              voice: safeVoice,
              response_format: 'mp3',
              speed: 0.95,
            },
            {
              headers: {
                'Authorization': `Bearer ${OPENAI_KEY}`,
                'Content-Type': 'application/json',
              },
              responseType: 'arraybuffer',
              timeout: 60000,
            }
          );
          break;
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 429 && attempt < MAX_ATTEMPTS - 1) {
            const retryAfterRaw = err?.response?.headers?.['retry-after'];
            const serverHintMs = retryAfterRaw ? Math.ceil(Number(retryAfterRaw) * 1000) : 0;
            const baseDelay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
            const jitter = Math.floor(Math.random() * 1000);
            const delay = Math.max(serverHintMs, baseDelay) + jitter;
            logger.warn(`TTS 429 재시도 ${attempt + 1}회 (${delay}ms 대기, retry-after=${retryAfterRaw ?? 'none'})`);
            await sleep(delay);
          } else {
            throw err;
          }
        }
      }

      // 절 사이 호출 간격 확보 (OpenAI rate-limit 자체 유발 방지)
      await sleep(500);

      const audioBuffer = Buffer.from(ttsResponse.data);
      if (!audioBuffer.length) {
        throw new HttpsError('internal', 'TTS 생성에 실패했습니다.');
      }

      await file.save(audioBuffer, {
        metadata: { contentType: 'audio/mpeg' },
      });

      // 일일 호출 카운터 +1 (Storage 저장 성공 후 차감)
      await usageRef.set({
        count: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // 서명된 URL 반환 (긴 텍스트도 안전하게 처리)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 3600 * 1000, // 1시간
      });
      return { success: true, audioUrl: signedUrl, cached: false };

    } catch (error: any) {
      // 보안: axios 에러 객체를 통째로 로깅하면 Authorization 헤더(OpenAI API 키)가 노출됨.
      // 안전한 필드만 남긴다.
      logger.error('TTS 생성 실패:', {
        message: error?.message,
        status: error?.response?.status,
        code: error?.code,
        cacheKey,
      });
      throw new HttpsError('internal', 'TTS 생성에 실패했습니다.');
    }
  }
);

// ===== ttsUsage 30일 이상 문서 자동 청소 (매일 0시 KST) =====
export const cleanupTtsUsage = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
  },
  async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

      const snap = await db.collectionGroup('ttsUsage').get();
      const toDelete = snap.docs.filter(d => d.id < cutoffStr);

      let deleted = 0;
      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = db.batch();
        toDelete.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
        deleted += Math.min(500, toDelete.length - i);
      }
      logger.info(`ttsUsage 청소 완료: ${deleted}개 삭제 (cutoff=${cutoffStr})`);
    } catch (error) {
      logger.error('ttsUsage 청소 실패:', error);
    }
  }
);

export { generateBook, suggestChapterTitle } from "./bookStudio";
export { reviewBookForPublish, suggestBookPublishRevision, applyBookPublishRevision } from "./bookReview";
export { analyzeFacebookZip } from "./snsAnalyzer";
export { convertSnsToDiary } from "./snsToDiary";
export { generateLawsuitClaimReason } from "./generateLawsuitClaimReason";
export { convertToBookMaterial } from "./bookMaterial";
export { gatherElderBookSources, buildElderBookOutline, assignElderBookSources, draftElderBookChapters, polishElderBookChapters } from "./elderBook";

// ===== 단어 뜻 조회 =====
export const getWordMeaning = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'getWordMeaning', 15, 80);

    const { word } = request.data;
    if (!word) throw new HttpsError('invalid-argument', '단어가 필요합니다.');

    const db = admin.firestore();
    const cacheRef = db.collection('wordCache').doc(word.toLowerCase());

    // 1. 캐시 확인
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      logger.info(`[getWordMeaning] 캐시 히트: ${word}`);
      return cacheSnap.data();
    }

    // 2. Gemini API 호출
    const GEMINI_KEY = GEMINI_API_KEY_SECRET.value();
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const prompt = `영어 단어 "${word}"의 정보를 알려주세요.
JSON 형식으로만 응답하세요. 마크다운 없이 순수 JSON만:
{"meaning": "한국어 뜻 (짧게 1~3개)", "partOfSpeech": "품사 (명사/동사/형용사/부사/전치사/접속사/관사 중)", "phonetic": "미국식 발음기호 (예: /ɪn/)", "koreanPronunciation": "한국어 발음 (예: 인)", "example": "중학생도 이해할 수 있는 쉬운 일상 생활 예문 (성경 문장 사용 금지)", "exampleKo": "위 예문 한국어 번역", "phrasalVerb": "이 단어가 포함된 대표 구동사 (예: bring forth, give up) — 없으면 빈 문자열", "phrasalVerbMeaning": "구동사 한국어 뜻 — 없으면 빈 문자열", "phrasalVerbExample": "구동사 생활 예문 영어 — 없으면 빈 문자열", "phrasalVerbExampleKo": "구동사 예문 한국어 번역 — 없으면 빈 문자열"}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // 3. Firestore에 캐시 저장
    await cacheRef.set({
      ...parsed,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`[getWordMeaning] 캐시 저장: ${word}`);
    return parsed;
  }
);

// ===== 문법 해설 =====
export const getGrammarExplain = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET, OPENAI_API_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'getGrammarExplain', 10, 60);

    const { verseKey, verseText } = request.data;
    if (!verseText) throw new HttpsError('invalid-argument', '절 내용이 필요합니다.');

    // P0: 일기 문법 캐시는 사용자별 격리 (성경 캐시는 공용 유지)
    // 프론트가 보낸 diary_* 키에 서버가 인증된 uid를 강제로 네임스페이싱한다.
    let cacheKey = verseKey;
    if ((verseKey || '').startsWith('diary_')) {
      cacheKey = `diary_${uid}_${verseKey.slice('diary_'.length)}`;
    }

    const db = admin.firestore();
    const cacheRef = db.collection('grammarCache').doc(cacheKey);

    // 1. 캐시 확인
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      logger.info(`[getGrammarExplain] 캐시 히트: ${verseKey}`);
      return cacheSnap.data();
    }

    // 2. Gemini API 호출
    const GEMINI_KEY = GEMINI_API_KEY_SECRET.value();
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const prompt = `다음 영어 성경 구절에서 문법 요소를 분석해주세요.

구절: "${verseText}"

규칙:
- 문법 용어 절대 사용 금지 (주어/동사/목적어/3형식 등 금지)
- 쉬운 한국어로만 설명 (영어 초보자 기준)
- 각 설명은 1~2문장 이내
- 마크다운 없이 순수 JSON으로만 응답

아래 6가지 항목: 해당하는 것만 채우고, 없으면 빈 문자열 "".
mysentence와 korean은 반드시 채워야 합니다.
예문(example_en, example_ko)은 해당 항목이 있을 때만 채우고, 없으면 빈 문자열 "".

{
  "verb": "핵심 동사 설명 (예: created = 하나님이 무언가를 만들었어요)",
  "verb_example_en": "동사 활용 예문 영어 (예: God created the light.)",
  "verb_example_ko": "위 예문 한국어 번역 (예: 하나님이 빛을 만드셨습니다.)",
  "preposition": "전치사 설명 (예: in = ~안에, ~속에서)",
  "preposition_example_en": "전치사 활용 예문 영어 (예: The fish lives in the sea.)",
  "preposition_example_ko": "위 예문 한국어 번역 (예: 물고기는 바다 안에 삽니다.)",
  "phrasal": "구동사 설명 (예: bring forth = 앞으로 꺼내오다, 나오게 하다)",
  "phrasal_example_en": "구동사 활용 예문 영어 (예: The earth brought forth many plants.)",
  "phrasal_example_ko": "위 예문 한국어 번역 (예: 땅이 많은 식물을 나오게 했습니다.)",
  "relative": "관계사 설명 (예: that = 앞에 나온 것을 더 설명해주는 연결 표현)",
  "relative_example_en": "관계사 활용 예문 영어 (예: The bird that flies is free.)",
  "relative_example_ko": "위 예문 한국어 번역 (예: 나는 날아다니는 새는 자유롭습니다.)",
  "question": "의문사 설명 (예: what = 무엇, 어떤 것)",
  "question_example_en": "의문사 활용 예문 영어 (예: What did God see?)",
  "question_example_ko": "위 예문 한국어 번역 (예: 하나님은 무엇을 보셨나요?)",
  "exclamation": "감탄사/명령 설명 (예: Let there be = ~이 있으라! 명령하는 표현)",
  "exclamation_example_en": "감탄사/명령 활용 예문 영어 (예: Let there be peace!)",
  "exclamation_example_ko": "위 예문 한국어 번역 (예: 평화가 있으라!)",
  "mysentence": "이 구절의 핵심 단어를 활용한 짧은 영어 예문 (I/We/God 주어로 시작, 반드시 입력)",
  "korean": "위 예문의 한국어 번역 (반드시 입력)"
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // 3. GPT-4o 검증 (영어성경: 항상, 영어일기학습: 200자 초과 시만 — 비용 절감)
    const isBible = /^[a-z]+_\d+_\d+$/.test(verseKey || '');
    const isDiary = (verseKey || '').startsWith('diary_');
    const useGPT4o = isBible || (isDiary && verseText.length > 200);

    let verified = parsed;
    let gptChanges: string[] = [];
    if (useGPT4o) try {
      const OPENAI_KEY = OPENAI_API_KEY_SECRET.value().replace(/[^\x20-\x7E]/g, '').trim();
      const gptPrompt = `당신은 영어 문법 전문가입니다. 아래 영어 성경 구절의 문법 분석 JSON을 능동적으로 검토하고 개선하세요.

구절: "${verseText}"

★ 가장 중요한 검토 원칙 — 설명과 예문의 일관성:
각 항목의 설명과 예문(_example_en, _example_ko)은 반드시 동일한 용법을 가리켜야 합니다.

예시 (잘못된 경우):
- 설명: "which = 무엇 무엇 하는 것 (명사절)"
- 예문: "The book which I read is good." (관계대명사절) ← 용법이 다름 → 반드시 수정

예시 (올바른 경우):
- 설명: "which = 앞에 나온 것을 더 설명해주는 연결 표현 (관계대명사)"
- 예문: "The light which God made was good." (동일한 관계대명사 용법) ← 일치함

검토 항목별 기준:

1. relative (관계사 — which/that/who/whom/whose):
   - 설명에서 밝힌 용법(관계대명사/관계부사/명사절 등)과 예문이 반드시 일치
   - 설명이 "앞 명사를 꾸미는 표현"이면 예문도 반드시 그 구조여야 함

2. verb (동사):
   - 설명에서 밝힌 시제·형태(과거/현재/명령형 등)와 예문이 일치
   - 부정사(to+동사) 설명이면 예문도 부정사 구조

3. phrasal (구동사):
   - 설명한 구동사(예: bring forth)가 예문에 그대로 사용되어야 함
   - 다른 구동사로 예문을 만들면 안 됨

4. preposition (전치사):
   - 설명한 전치사(예: in/of/with)와 예문의 전치사가 반드시 동일

5. question (의문사):
   - 설명한 의문사(what/where/who 등)와 예문의 의문사가 반드시 동일

6. exclamation (감탄/명령):
   - 설명한 표현(예: Let there be)이 예문에 그대로 사용되어야 함

추가 검토 기준:

7. 모든 설명:
   - 문법 용어(주어/동사/목적어/3형식 등) 사용 금지
   - 영어 초보자가 이해할 수 있는 쉬운 한국어
   - 성경 구절의 실제 맥락과 맞는지 확인

8. _example_en:
   - 자연스러운 영어 문장인지 확인
   - 너무 복잡하면 더 쉬운 문장으로 개선

9. _example_ko:
   - 위 영어 예문의 정확한 한국어 번역인지 확인

10. mysentence:
    - 비어있으면 구절의 핵심 단어 활용한 짧은 영어 문장 직접 생성 (I/We/God 주어)
    - 있으면 자연스러운 영어인지 확인 후 필요시 수정

11. korean:
    - 비어있으면 mysentence의 한국어 번역 직접 생성
    - 있으면 정확한 번역인지 확인 후 필요시 수정

규칙:
- mysentence/korean이 비어있으면 반드시 채울 것
- 다른 빈 필드는 해당 문법 요소가 없으면 빈 문자열 유지
- 마크다운 없이 순수 JSON만
★ 응답 형식 (반드시 아래 두 개 필드를 가진 객체로만 응답):
{
  "changes": ["수정한 항목과 이유를 한 줄씩. 예: verb_example_en: 'He said the truth' → 'He told the truth' (say는 the truth와 함께 쓰지 않음)"],
  "corrected": 수정된 전체 분석 JSON 객체 또는 null
}
- 수정할 것이 하나라도 있으면: changes에 변경 내역을 모두 적고, corrected에 수정 완료된 전체 분석 JSON을 담을 것
- 수정할 것이 전혀 없으면: changes는 빈 배열 [], corrected는 null
- corrected는 원본 분석 JSON과 동일한 필드 구조를 유지할 것 (필드를 새로 만들거나 없애지 말 것)
분석 JSON:
${JSON.stringify(parsed, null, 2)}`;

      const gptRes = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: gptPrompt }],
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 25000,
        }
      );
      const gptRaw = gptRes.data.choices[0].message.content.trim();
      const gptClean = gptRaw.replace(/```json|```/g, '').trim();
      const gptParsed = JSON.parse(gptClean);
      gptChanges = Array.isArray(gptParsed.changes) ? gptParsed.changes : [];
      if (gptParsed.corrected && typeof gptParsed.corrected === 'object') {
        // 정상 경로: GPT가 수정본을 반환한 경우
        verified = gptParsed.corrected;
      } else if (gptChanges.length === 0 && !('corrected' in gptParsed) && gptParsed.mysentence !== undefined) {
        // 하위호환 폴백: 구 형식(분석 JSON을 그대로 반환)으로 응답한 경우
        verified = gptParsed;
        logger.warn(`[getGrammarExplain] GPT가 구 형식으로 응답 (${verseKey}) — changes 미수집`);
      } else {
        // 수정 없음(corrected: null) → Gemini 원본 유지
        verified = parsed;
      }
      if (gptChanges.length > 0) {
        logger.info(`[getGrammarExplain] GPT-4o 수정 내역 (${verseKey}): ${JSON.stringify(gptChanges)}`);
      } else {
        logger.info(`[getGrammarExplain] GPT-4o 수정 없음: ${verseKey}`);
      }
    } catch (gptErr) {
      logger.warn(`[getGrammarExplain] GPT-4o 검증 실패, Gemini 결과 사용: ${verseKey}`, gptErr);
      // GPT 실패 시 Gemini 결과 그대로 사용 (서비스 중단 없음)
    }

    // 4. 캐시 저장
    await cacheRef.set({
      ...verified,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedByGPT: useGPT4o,
      gptChanges: gptChanges,
    });

    logger.info(`[getGrammarExplain] 캐시 저장: ${verseKey}`);
    return verified;
  }
);

// ===== 장 문법 사전생성 =====
export const preloadChapterGrammar = onCall(
  { region: 'asia-northeast3', timeoutSeconds: 540, secrets: [GEMINI_API_KEY_SECRET, OPENAI_API_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    if (request.auth.uid !== ADMIN_UID) {
      throw new HttpsError('permission-denied', '관리자 전용 기능입니다');
    }

    const { book, chapter, verses, verseTexts } = request.data;

    const results: any[] = [];

    for (const verseKey of verses) {
      // 임의 키 주입 방지 — 영어성경 verseKey 형식만 허용 (예: matthew_5_3)
      if (!/^[a-z]+_\d+_\d+$/.test(verseKey)) {
        results.push({ verseKey, status: 'invalid_key' });
        continue;
      }
      try {
        // 1. 캐시 확인 — 이미 있으면 스킵
        const cacheRef = db.collection('grammarCache').doc(verseKey);
        const cached = await cacheRef.get();
        if (cached.exists) {
          results.push({ verseKey, status: 'cached' });
          continue;
        }

        const verseText = verseTexts?.[verseKey] || '';

        // 2. Gemini 호출
        const geminiApiKey = GEMINI_API_KEY_SECRET.value();
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`;

        const geminiPrompt = `다음 영어 성경 구절에서 문법 요소를 분석해주세요.
구절: "${verseText}"
규칙:
- 문법 용어 절대 사용 금지 (주어/동사/목적어/3형식 등 금지)
- 각 항목은 없으면 빈 문자열("")로 반환
- 반드시 아래 JSON 형식으로만 응답 (다른 텍스트 없이)

{
  "verb": "핵심 동사 설명 (예: created = 하나님께서 무언가를 새롭게 만들어내셨다는 뜻)",
  "verb_example_en": "동사 활용 예문 영어",
  "verb_example_ko": "위 예문 한국어 번역",
  "preposition": "전치사 설명 (예: in = 어떤 시간이나 공간의 안쪽을 가리키는 표현)",
  "preposition_example_en": "전치사 활용 예문 영어",
  "preposition_example_ko": "위 예문 한국어 번역",
  "phrasal": "구동사 설명 (예: bring forth = 산출하다, 없으면 빈 문자열)",
  "phrasal_example_en": "구동사 활용 예문 영어",
  "phrasal_example_ko": "위 예문 한국어 번역",
  "relative": "관계사 설명 (없으면 빈 문자열)",
  "relative_example_en": "관계사 활용 예문 영어",
  "relative_example_ko": "위 예문 한국어 번역",
  "question": "의문사 설명 (없으면 빈 문자열)",
  "question_example_en": "의문사 활용 예문 영어",
  "question_example_ko": "위 예문 한국어 번역",
  "exclamation": "감탄사/명령 설명 (없으면 빈 문자열)",
  "exclamation_example_en": "감탄사/명령 활용 예문 영어",
  "exclamation_example_ko": "위 예문 한국어 번역",
  "mysentence": "이 구절의 핵심 단어를 활용한 짧은 영어 예문 (반드시 입력)",
  "korean": "위 예문의 한국어 번역 (반드시 입력)"
}`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }],
            generationConfig: { temperature: 0.3 }
          }),
          signal: AbortSignal.timeout(20000)
        });

        if (!geminiRes.ok) {
          results.push({ verseKey, status: 'gemini_error' });
          continue;
        }

        const geminiJson = await geminiRes.json();
        let geminiText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        geminiText = geminiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // 제어문자 제거 (JSON 파싱 오류 방지)
        geminiText = geminiText.replace(/[\x00-\x1F\x7F]/g, (c: string) =>
          c === '\n' || c === '\r' || c === '\t' ? c : ''
        );
        const geminiData = JSON.parse(geminiText);

        // 3. GPT-4o 검증
        let finalData = geminiData;
        let gptChanges: string[] = [];
        let verifiedByGPT = false;

        try {
          const openaiApiKey = OPENAI_API_KEY_SECRET.value().replace(/[^\x20-\x7E]/g, '').trim();
          const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              temperature: 0.2,
              messages: [
                {
                  role: 'system',
                  content: '당신은 영어 문법 검증 전문가입니다. KJV 성경 고어체 전문가입니다. 반드시 순수 JSON만 응답하세요.'
                },
                {
                  role: 'user',
                  content: `당신은 영어 문법 및 KJV 성경 고어체 전문가입니다.
아래 영어 성경 구절의 문법 분석 JSON을 검토하고 오류가 있으면 수정해주세요.
구절: "${verseText}"
분석: ${JSON.stringify(geminiData)}

검토 기준:
1. verb: 설명과 verb_example_en의 동사 시제/형태 일치 여부
2. preposition: 설명한 전치사와 예문의 전치사 일치 여부
3. phrasal: 설명한 구동사가 예문에 그대로 사용됐는지
4. relative: 설명한 관계사 용법과 예문 일치 여부
5. mysentence/korean: 자연스러운 영어/한국어 문장인지

수정사항이 있으면 corrected 필드에 수정된 전체 JSON을, changes 배열에 변경 내역을 담아주세요.
수정사항이 없으면 changes를 빈 배열로, corrected를 null로 반환하세요.

{"changes": ["변경내역1", ...], "corrected": null 또는 {...수정된데이터}}`
                }
              ]
            }),
            signal: AbortSignal.timeout(15000)
          });

          if (gptRes.ok) {
            const gptJson = await gptRes.json();
            let gptText = gptJson?.choices?.[0]?.message?.content || '';
            gptText = gptText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const gptResult = JSON.parse(gptText);
            gptChanges = gptResult.changes || [];
            if (gptResult.corrected) {
              finalData = gptResult.corrected;
            }
            verifiedByGPT = true;
          }
        } catch (gptErr) {
          logger.warn(`[preloadChapterGrammar] GPT 실패, Gemini 사용: ${verseKey}`);
        }

        // 4. 캐시 저장
        await cacheRef.set({
          ...finalData,
          verseKey,
          verifiedByGPT,
          gptChanges,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        results.push({
          verseKey,
          status: verifiedByGPT ? 'verified' : 'gemini_only',
          gptCorrected: gptChanges.length > 0,
          changesCount: gptChanges.length
        });

        // 5. API 과부하 방지 — 절 사이 0.5초 대기
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err: any) {
        logger.error(`[preloadChapterGrammar] 오류: ${verseKey}`, err);
        results.push({ verseKey, status: 'error', message: err.message });
      }
    }

    // 6. 완료 후 관리자 FCM 알림
    const totalCorrected = results.filter(r => r.gptCorrected).length;
    const adminUid = ADMIN_UID;
    try {
      const settingsDoc = await db
        .collection('users').doc(adminUid)
        .collection('settings').doc('settings').get();
      const tokens: string[] = settingsDoc.data()?.fcmTokens || [];
      if (tokens.length > 0) {
        const { getMessaging } = await import('firebase-admin/messaging');
        await getMessaging().sendEachForMulticast({
          tokens,
          notification: {
            title: `📖 ${book} ${chapter}장 문법 생성 완료`,
            body: totalCorrected > 0
              ? `GPT 수정: ${totalCorrected}건 발견됨 ⚠️`
              : '수정 없음 ✅'
          }
        });
      }
    } catch (fcmErr) {
      logger.warn('[preloadChapterGrammar] FCM 알림 실패', fcmErr);
    }

    return {
      success: true,
      total: verses.length,
      cached: results.filter(r => r.status === 'cached').length,
      verified: results.filter(r => r.status === 'verified').length,
      corrected: totalCorrected,
      results
    };
  }
);

// ===== 퀴즈 생성 =====
export const getVerseQuiz = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'getVerseQuiz', 10, 60);

    const { verseKey, verseText, level = 'basic' } = request.data;
    if (!verseText) throw new HttpsError('invalid-argument', '절 내용이 필요합니다.');

    const db = admin.firestore();
    const cacheRef = db.collection('quizCache').doc(`${verseKey}_${level}`);

    // 1. 캐시 확인
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      logger.info(`[getVerseQuiz] 캐시 히트: ${verseKey}`);
      return cacheSnap.data();
    }

    // 2. Gemini API 호출
    const GEMINI_KEY = GEMINI_API_KEY_SECRET.value();
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const levelRules = level === 'advanced'
      ? `- 한국어 번역을 보여주고 영어 단어를 모두 빈칸으로 만들기
- 빈칸은 구절의 모든 단어 (관사 포함)
- 보기는 구절의 모든 단어를 무작위로 섞어서 제공
- koreanText 필드에 한국어 번역 포함`
      : level === 'intermediate'
      ? `- 빈칸은 4~6개 (수능/고등학교 수준 단어 + 중요 동사/명사 포함)
- 보기는 빈칸 수 × 2개 (정답 + 헷갈리는 유사 단어)
- 보기는 무작위 순서로 섞기
- 쉬운 관사(a, the, an)나 접속사(and, or)는 빈칸 제외`
      : `- 빈칸은 2~4개 (수능/고등학교 수준 단어만)
- 보기는 빈칸 수 × 2개 (정답 + 헷갈리는 유사 단어)
- 보기는 무작위 순서로 섞기
- 쉬운 관사(a, the, an)나 접속사(and, or)는 빈칸 제외`;

    const prompt = `다음 영어 성경 구절로 빈칸 퀴즈를 만들어주세요.
구절: "${verseText}"
규칙:
${levelRules}
JSON 형식으로만 응답하세요. 마크다운 없이 순수 JSON만:
{
  "blankedText": "빈칸을 _____로 표시한 전체 구절",
  "blanks": [
    {
      "index": 0,
      "answer": "정답 단어",
      "hint": "힌트 (한국어 뜻)"
    }
  ],
  "options": ["보기1", "보기2", "보기3", "보기4"],
  "koreanText": "한국어 번역 (고급 모드에서만 사용, 나머지는 빈 문자열)"
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // 3. 캐시 저장
    await cacheRef.set({
      ...parsed,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`[getVerseQuiz] 캐시 저장: ${verseKey}`);
    return parsed;
  }
);

// 영어 일기 학습 — 한국어 → 영어 번역
export const translateToEnglish = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'translateToEnglish', 10, 60);

    const text: string = request.data.text || '';
    if (!text) throw new Error('텍스트가 없습니다');

    const GEMINI_KEY = GEMINI_API_KEY_SECRET.value();
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const prompt = `다음 한국어 일기를 자연스러운 영어로 번역해주세요.
문장 단위로 나눠서 배열로 반환하세요.
원문의 감정과 표현을 최대한 살려주세요.

한국어 일기:
"${text}"

JSON 형식으로만 응답하세요. 마크다운 없이 순수 JSON만:
{
  "sentences": ["영어 문장1", "영어 문장2", "영어 문장3"]
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed;
  }
);

// ===== 🌍 해외 뉴스 자동 수집 (30분마다) =====
// 2026-05-05 비활성화: 비용 절감 (월 7,200원). 필요 시 주석 해제하여 재활성화
/*
export const fetchTopNews = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
  },
  async () => {
    try {
      const RSS_URLS = [
        'https://www.aljazeera.com/xml/rss/all.xml',
        'https://www.theguardian.com/world/rss',
        'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      ];
      let allItems: string[] = [];
      for (const url of RSS_URLS) {
        try {
          const res = await axios.get(url, { timeout: 8000, responseType: 'text' });
          const xml = res.data as string;
          const titleMatches = xml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g) || [];
          const descMatches = xml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/g) || [];
          const linkMatches = xml.match(/<link>(.*?)<\/link>|<link\s+href="(.*?)"/g) || [];
          for (let i = 1; i < Math.min(titleMatches.length, 8); i++) {
            const title = (titleMatches[i] || '').replace(/<\/?[^>]+(>|$)/g, '').replace(/\[CDATA\[|\]\]/g, '').trim();
            const desc = (descMatches[i] || '').replace(/<\/?[^>]+(>|$)/g, '').replace(/\[CDATA\[|\]\]/g, '').trim();
            const link = (linkMatches[i] || '').replace(/<link>|<\/link>|<link\s+href="|"/g, '').trim();
            if (title && title.length > 10) {
              allItems.push(`제목: ${title}\n요약: ${desc.slice(0, 200)}\n링크: ${link}`);
            }
          }
        } catch (e) { logger.warn('RSS 수집 실패:', url); }
      }
      if (allItems.length === 0) { logger.warn('수집된 뉴스 없음'); return; }
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      const prompt = `다음은 오늘의 해외 주요 뉴스 목록입니다.
미국과 이란 관계, 중동 정세, 국제 분쟁, 외교 관련 뉴스 중 가장 중요한 순서대로 3개를 선택해서 한국어로 번역 요약해주세요.

뉴스 목록:
${allItems.join('\n\n---\n\n')}

반드시 아래 JSON 배열 형식으로만 답하세요 (다른 텍스트 없이):
[
  {
    "rank": 1,
    "title": "한국어 제목",
    "summary": "한국어 요약 (3~4문장)",
    "originalTitle": "원문 제목",
    "link": "원문 링크",
    "category": "미국-이란 or 중동 or 국제분쟁 or 외교"
  },
  {
    "rank": 2,
    "title": "한국어 제목",
    "summary": "한국어 요약 (3~4문장)",
    "originalTitle": "원문 제목",
    "link": "원문 링크",
    "category": "미국-이란 or 중동 or 국제분쟁 or 외교"
  },
  {
    "rank": 3,
    "title": "한국어 제목",
    "summary": "한국어 요약 (3~4문장)",
    "originalTitle": "원문 제목",
    "link": "원문 링크",
    "category": "미국-이란 or 중동 or 국제분쟁 or 외교"
  }
]`;
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const newsArray = JSON.parse(text);
      const batch = db.batch();
      for (const item of newsArray) {
        const ref = db.collection('news').doc(`rank${item.rank}`);
        batch.set(ref, { ...item, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      await batch.commit();
      logger.info('✅ 뉴스 3건 저장 완료');
    } catch (err) { logger.error('뉴스 수집 오류:', err); }
  }
);
*/

// ===== 뉴스 수동 새로고침 (개발자용) =====
export const refreshNews = onCall(
  { secrets: [GEMINI_API_KEY_SECRET], region: 'asia-northeast3' },
  async (request) => {
    // 개발자 UID — 향후 일반 사용자 개방 시 한도 체크 로직 추가 예정
    const isDeveloper = isInternalDeveloperUid(request.auth?.uid);

    if (!isDeveloper) {
      // TODO: 정식 출시 시 일반 사용자 한도 체크 로직 추가
      // 예: 일 1회 / 월 30회 한도, 또는 유료 구독자만 허용
      throw new HttpsError('permission-denied', '뉴스 새로고침 권한이 없습니다');
    }

    try {
      const RSS_URLS = [
        'https://www.aljazeera.com/xml/rss/all.xml',
        'https://www.theguardian.com/world/rss',
        'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      ];
      let allItems: string[] = [];
      for (const url of RSS_URLS) {
        try {
          const res = await axios.get(url, { timeout: 8000, responseType: 'text' });
          const xml = res.data as string;
          const titleMatches = xml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g) || [];
          const descMatches = xml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/g) || [];
          const linkMatches = xml.match(/<link>(.*?)<\/link>|<link\s+href="(.*?)"/g) || [];
          for (let i = 1; i < Math.min(titleMatches.length, 8); i++) {
            const title = (titleMatches[i] || '').replace(/<\/?[^>]+(>|$)/g, '').replace(/\[CDATA\[|\]\]/g, '').trim();
            const desc = (descMatches[i] || '').replace(/<\/?[^>]+(>|$)/g, '').replace(/\[CDATA\[|\]\]/g, '').trim();
            const link = (linkMatches[i] || '').replace(/<link>|<\/link>|<link\s+href="|"/g, '').trim();
            if (title && title.length > 10) {
              allItems.push(`제목: ${title}\n요약: ${desc.slice(0, 200)}\n링크: ${link}`);
            }
          }
        } catch (e) { logger.warn('RSS 수집 실패:', url); }
      }
      if (allItems.length === 0) return { success: false, message: '뉴스 없음' };
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      const prompt = `다음은 오늘의 해외 주요 뉴스 목록입니다.
미국과 이란 관계, 중동 정세, 국제 분쟁, 외교 관련 뉴스 중 가장 중요한 순서대로 3개를 선택해서 한국어로 번역 요약해주세요.

뉴스 목록:
${allItems.join('\n\n---\n\n')}

반드시 아래 JSON 배열 형식으로만 답하세요 (다른 텍스트 없이):
[
  {
    "rank": 1,
    "title": "한국어 제목",
    "summary": "한국어 요약 (3~4문장)",
    "originalTitle": "원문 제목",
    "link": "원문 링크",
    "category": "미국-이란 or 중동 or 국제분쟁 or 외교"
  },
  {
    "rank": 2,
    "title": "한국어 제목",
    "summary": "한국어 요약 (3~4문장)",
    "originalTitle": "원문 제목",
    "link": "원문 링크",
    "category": "미국-이란 or 중동 or 국제분쟁 or 외교"
  },
  {
    "rank": 3,
    "title": "한국어 제목",
    "summary": "한국어 요약 (3~4문장)",
    "originalTitle": "원문 제목",
    "link": "원문 링크",
    "category": "미국-이란 or 중동 or 국제분쟁 or 외교"
  }
]`;
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const newsArray = JSON.parse(text);
      const batch = db.batch();
      for (const item of newsArray) {
        const ref = db.collection('news').doc(`rank${item.rank}`);
        batch.set(ref, { ...item, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      await batch.commit();
      return { success: true, count: newsArray.length };
    } catch (err) {
      logger.error('뉴스 새로고침 오류:', err);
      return { success: false };
    }
  }
);

// ===== 🔮 HARU예언 — 기록 자동 분석 (인물·욕망·족쇄·사건 추출) =====
export const analyzeRecordForProphecy = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    await requirePaidSubscription(request.auth.uid);
    const { content, userAnalysis, round } = request.data;
    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      throw new HttpsError('invalid-argument', '분석할 기록 내용이 너무 짧습니다.');
    }

    const systemPromptInitial = `당신은 HARU예언 분석가입니다.
사용자가 작성한 기록(일기·에세이·여행기 등)에서 미래 예언 소설 생성에 필요한 핵심 항목을 추출합니다.

[추출 항목 — 10가지]
1. chars (등장인물): 기록에 등장한 사람들. 쉼표로 구분된 한 줄 문자열. 본인은 "나"로 표기. 최대 5명.
2. desire (소망): 작성자가 지금 가장 원하는 것·이루고 싶은 것. 짧은 한 문장.
3. shackle (극복할 것): 작성자를 막고 있는 것·두려움·제약. 짧은 한 문장.
4. events (주요 사건): 기록에 나타난 의미 있는 사건/장면. 쉼표로 구분된 짧은 문구들. 최대 5개.
5. relationship (인간관계): 등장인물 간의 관계. 짧은 한 문장.
6. personality (인물 성격): 등장인물들의 성격 특징. 짧은 한 문장.
7. motive (사건 모티브): 기록의 핵심 주제·테마. 짧은 한 문장.
8. theme (주제·기획의도): 이 이야기가 전달하려는 메시지. 짧은 한 문장.
9. oneLiner (한 줄 스토리): 기록 전체를 한 문장으로 요약.
10. threeLiner (세 줄 스토리): 기록을 세 문장으로 요약. 줄바꿈(\\n)으로 구분.

[출력 규칙]
- 반드시 JSON 한 덩어리만 출력. 마크다운/설명 절대 금지.
- 모든 필드는 string. 명확히 읽히지 않으면 빈 문자열("")로.
- 추측하거나 만들어내지 말 것. 빈 칸으로 두고 사용자가 직접 채우게 한다.

출력 형식 (필드 10개 모두 string):
{
  "chars": "나, 아내, 딸 찬미",
  "desire": "Flutter 앱 출시",
  "shackle": "두려움, 게으름",
  "events": "앱 개발 시작, 사업자 등록",
  "relationship": "가족, 협력적",
  "personality": "성실하고 신중함",
  "motive": "도전과 가족",
  "theme": "용기를 내어 새 길을 열다",
  "oneLiner": "한 가족이 함께 새로운 길을 열어가는 이야기.",
  "threeLiner": "한 가장이 앱 개발을 시작했다.\\n가족의 응원으로 두려움을 이겨냈다.\\n작은 한 걸음이 큰 변화를 만들었다."
}`;

    const systemPromptRefine = `당신은 HARU예언 분석가입니다.
사용자가 1차 분석 결과를 직접 수정했습니다.
사용자의 수정 의도를 최대한 존중하면서, 기록 원문과 모순되지 않도록
자연스럽게 다듬어 10개 항목을 다시 정리해주세요.

[작업 원칙]
- 사용자 수정안의 의도를 그대로 따라가되, 표현을 자연스럽게 다듬는다.
- 빈 칸은 기록 원문에서 적절히 채워준다.
- 사용자가 명확히 적은 부분은 절대 임의로 바꾸지 않는다.

[출력 규칙]
- 반드시 JSON 한 덩어리만 출력. 마크다운/설명 절대 금지.
- 모든 필드는 string.
- 출력 형식은 1차 분석과 동일.

출력 형식 (필드 10개 모두 string):
{
  "chars": "...",
  "desire": "...",
  "shackle": "...",
  "events": "...",
  "relationship": "...",
  "personality": "...",
  "motive": "...",
  "theme": "...",
  "oneLiner": "...",
  "threeLiner": "..."
}`;

    const isRefine = round === 2 || round === 3;
    const systemPrompt = isRefine ? systemPromptRefine : systemPromptInitial;

    let userPrompt: string;
    if (isRefine) {
      const ua = userAnalysis || {};
      userPrompt = `[원본 기록]
${content.slice(0, 4000)}

[사용자의 ${round - 1}차 수정안]
- chars: ${ua.chars || ''}
- desire: ${ua.desire || ''}
- shackle: ${ua.shackle || ''}
- events: ${ua.events || ''}
- relationship: ${ua.relationship || ''}
- personality: ${ua.personality || ''}
- motive: ${ua.motive || ''}
- theme: ${ua.theme || ''}
- oneLiner: ${ua.oneLiner || ''}
- threeLiner: ${ua.threeLiner || ''}

위 수정안을 기반으로 10개 항목을 다시 정리해 JSON으로만 답하세요.`;
    } else {
      userPrompt = `[기록 내용]\n${content.slice(0, 4000)}\n\n위 기록에서 10개 항목을 추출해 JSON으로만 답하세요.`;
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userPrompt);
      let text = result.response.text().trim();
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

      let parsed: any = {
        chars: '', desire: '', shackle: '', events: '',
        relationship: '', personality: '', motive: '', theme: '',
        oneLiner: '', threeLiner: ''
      };
      try {
        parsed = JSON.parse(text);
      } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          try { parsed = JSON.parse(m[0]); } catch {/* keep defaults */}
        }
      }

      const toStr = (v: any): string => {
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) return v.join(', ');
        return '';
      };

      return {
        chars: toStr(parsed.chars),
        desire: toStr(parsed.desire),
        shackle: toStr(parsed.shackle),
        events: toStr(parsed.events),
        relationship: toStr(parsed.relationship),
        personality: toStr(parsed.personality),
        motive: toStr(parsed.motive),
        theme: toStr(parsed.theme),
        oneLiner: toStr(parsed.oneLiner),
        threeLiner: toStr(parsed.threeLiner),
      };
    } catch (error) {
      console.error('analyzeRecordForProphecy 실패:', error);
      throw new HttpsError('internal', '기록 분석에 실패했습니다.');
    }
  }
);

// ===== 🔮 HARU예언 시놉시스 생성 =====
export const generateHaruProphecy = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    await requirePaidSubscription(request.auth.uid);

    const { motive, motiveCustom, chars, birth, desire, shackle, events, luck, unluck, narrative, type,
            fromRecord, recordContent, recordTitle, recordDate, recordFormat, prophecyType, timeOption, question,
            extractedChars, extractedDesire, extractedShackle, extractedEvents,
            extractedRelationship, extractedPersonality, extractedMotive, extractedTheme,
            extractedOneLiner, extractedThreeLiner,
            prophecyGoalType, prophecyGoal, prophecyWall,
            extractedGoal, persons, extractedEvent, extractedDailyAchieve,
            currentAge, baseYear, futureYear, futureAge,
            protagonistName: rawProtagonistName } = request.data;

    // 서버측 한 번 더 sanitize (클라 우회 방지)
    const sanitizedProtagonistName: string | null = (() => {
      if (typeof rawProtagonistName !== 'string') return null;
      const cleaned = rawProtagonistName
        .replace(/[\n\r\t`{}$\\<>"]/g, '')
        .replace(/[^\p{L}\p{N} \-_.]/gu, '')
        .trim()
        .slice(0, 20);
      return cleaned || null;
    })();
    // type: 'synopsis' | 'story'

    if (!fromRecord && !motive) {
      throw new HttpsError('invalid-argument', '예언 모티브가 필요합니다.');
    }

    // ── 사용량 체크 (하루 1회 / 월 30회) ──
    const uid = request.auth.uid;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const thisMonth = today.slice(0, 7); // YYYY-MM

    const usageRef = db.collection('prophecyUsage').doc(uid);
    const usageSnap = await usageRef.get();
    const usage = usageSnap.exists
      ? usageSnap.data()!
      : { daily: '', dailyCount: 0, monthly: '', monthlyCount: 0 };

    const isDeveloper = isInternalDeveloperUid(uid);

    // 하루 타입별 생성 제한 체크 (개발자 제외)
    const dailyLimit = type === 'story' ? 1 : 5;
    if (!isDeveloper && usage.daily === today && usage.dailyCount >= dailyLimit) {
      const msg = type === 'story'
        ? '오늘의 이야기 생성을 완료했습니다. 내일 새로운 이야기를 만들어보세요.'
        : '오늘의 시놉시스 생성 횟수(5회)를 모두 사용했습니다. 내일 다시 시도해주세요.';
      throw new HttpsError('resource-exhausted', msg);
    }
    // 월 30회 체크 (개발자 제외)
    if (!isDeveloper && usage.monthly === thisMonth && usage.monthlyCount >= 30) {
      throw new HttpsError('resource-exhausted', '이번 달 예언 횟수(30회)를 모두 사용했습니다.');
    }

    try {
      const protagonistNameBlock = sanitizedProtagonistName
        ? `\n[주인공 이름 — 절대 준수]\n- 이 이야기의 주인공 이름은 반드시 "${sanitizedProtagonistName}" 입니다.\n- AI는 다른 이름(예: "강준", "민수" 등)을 임의로 생성하지 않습니다.\n- 주인공을 지칭할 때는 "${sanitizedProtagonistName}" 또는 인칭대명사("그", "그녀")만 사용합니다.\n`
        : '';

      const systemPrompt = `당신은 한국 최고의 소설가이자 인생 예언가입니다.
아래 [HARU예언 인생 법칙]을 이야기 속에 직접 언급하지 말고 자연스럽게 녹여서 생성하세요.
${protagonistNameBlock}

━━━━━━━━━━━━━━━━━━━━━━
[HARU예언 인생 법칙 — 반드시 적용]

자연 법칙:
- 노력은 절대 사라지지 않고 반드시 쓸모가 생긴다
- 사람은 누구나 늙고 연약해진다. 영원한 것은 없다
- 젊을 때 심고 강할 때 나누는 자가 지혜롭다

인과 법칙:
- 행위대로 받되, 준 것보다 항상 적게 받는다
- 불운의 대부분은 내가 만든 결과다
- 단, 피할 수 없는 천재지변도 존재한다
- 불운에 반응하는 방식이 다음 단계를 결정한다

관계 법칙:
- 나를 좋아하는 사람과 미워하는 사람은 반드시 공존한다
- 강한 자 주위에는 사람이 모이고, 약해지면 고독해진다
- 사랑의 열정은 300일을 넘기기 힘들다
- 열정이 식은 후 남는 것이 진짜 관계다

유전과 환경:
- 부모의 성격·재능·습관은 자식에게 대물림된다
- 그러나 환경과 노력으로 방향은 바꿀 수 있다

보편 원리 (자율 적용):
- 편안함은 성장을 멈추고, 위기는 기회와 함께 온다
- 습관이 운명을 만든다
- 비슷한 사람끼리 모인다
- 두려움은 대부분 실제보다 크다
- 그 외 인간 삶의 보편적 진리를 자유롭게 적용할 것
━━━━━━━━━━━━━━━━━━━━━━

[생성 규칙]
1. 소설 형식 (3인칭)
2. 기승전결 구조
3. 법칙을 직접 언급하지 말고 이야기로 보여줄 것
4. 한국어로 작성
5. 마지막 문장은 반드시 희망적으로 마무리
6. 독자가 "내 이야기 같다"고 느끼게 쓸 것`;

      let userPrompt: string;
      if (fromRecord) {
        const toLine = (v: any): string => {
          if (!v) return '';
          if (Array.isArray(v)) return v.filter(Boolean).join(', ');
          return String(v).trim();
        };
        const charsStr = toLine(extractedChars);
        const desireStr = toLine(extractedDesire);
        const shackleStr = toLine(extractedShackle);
        const eventsStr = toLine(extractedEvents);
        const relationshipStr = toLine(extractedRelationship);
        const personalityStr = toLine(extractedPersonality);
        const motiveStr = toLine(extractedMotive);
        const themeStr = toLine(extractedTheme);
        const oneLinerStr = toLine(extractedOneLiner);
        const threeLinerStr = toLine(extractedThreeLiner);
        const goalStr = toLine(extractedGoal);
        const eventStr = toLine(extractedEvent);
        const dailyAchieveStr = toLine(extractedDailyAchieve);
        const personsStr = Array.isArray(persons)
          ? persons
              .filter((p: any) => p && (p.name || p.relation || p.personality))
              .map((p: any) => {
                const namePart = p.name ? p.name.trim() : '';
                const relationPart = p.relation ? p.relation.trim() : '';
                const personalityPart = p.personality ? p.personality.trim() : '';
                const head = relationPart ? `${namePart}(${relationPart})` : namePart;
                return personalityPart ? `${head} - ${personalityPart}` : head;
              })
              .filter(Boolean)
              .join(', ')
          : '';
        const charsLine = charsStr ? `[등장 인물]: ${charsStr}` : '';
        const shackleLine = shackleStr ? `[극복할 것]: ${shackleStr}` : '';
        const eventsLine = eventsStr ? `[주요 사건]: ${eventsStr}` : '';
        const relationshipLine = relationshipStr ? `[인간관계]: ${relationshipStr}` : '';
        const personalityLine = personalityStr ? `[인물 성격]: ${personalityStr}` : '';
        const motiveLine = motiveStr ? `[사건 모티브]: ${motiveStr}` : '';
        const themeLine = themeStr ? `[주제·기획의도]: ${themeStr}` : '';
        const oneLinerLine = oneLinerStr ? `[한 줄 스토리]: ${oneLinerStr}` : '';
        const threeLinerLine = threeLinerStr ? `[세 줄 스토리]: ${threeLinerStr}` : '';
        const extractedGoalLine = goalStr ? `[초목표]: ${goalStr}` : '';
        const personsLine = personsStr ? `[등장인물 & 관계와 성격]: ${personsStr}` : '';
        const eventLine = eventStr ? `[나에게 일어난 사건]: ${eventStr}` : '';
        const dailyAchieveLine = dailyAchieveStr ? `[일상에서 이룬 일]: ${dailyAchieveStr}` : '';
        const extractedBlock = [
          charsLine, shackleLine, eventsLine,
          relationshipLine, personalityLine, motiveLine, themeLine,
          oneLinerLine, threeLinerLine,
          extractedGoalLine, personsLine, eventLine, dailyAchieveLine,
        ].filter(Boolean).join('\n');

        const goalTypeMap: Record<string, string> = {
          me: '나의 미래 (초목표를 향한 서사)',
          child: '자식의 미래 (자식에게 바라는 것의 서사)',
          past: '과거를 바꿨다면 (그때 달랐다면 지금은 어땠을까)',
        };
        const goalTypeLabel = goalTypeMap[prophecyGoalType as string] || '';
        const goalTypeLine = goalTypeLabel ? `[예언 유형]: ${goalTypeLabel}` : '';
        const goalLine = prophecyGoal ? `[사용자의 초목표/바람]: ${prophecyGoal}` : '';
        const wallLine = prophecyWall ? `[지금 가장 넘고 싶은 것]: ${prophecyWall}` : '';
        const goalBlock = [goalTypeLine, goalLine, wallLine].filter(Boolean).join('\n');
        const personsNameList = (() => {
          const names: string[] = [];
          if (Array.isArray(persons)) {
            persons.forEach((p: any) => {
              if (p?.name?.trim()) names.push(p.name.trim());
            });
          }
          if (extractedChars) names.push(extractedChars);
          return [...new Set(names)].join(', ');
        })();

        const mandatoryBlock = [
          personsNameList
            ? `[등장인물 반드시 언급 — 절대 준수]\n다음 인물의 이름 또는 호칭이 이야기 본문 안에 반드시 1회 이상 자연스럽게 등장해야 합니다. AI가 임의로 다른 이름을 만들지 않습니다.\n→ ${personsNameList}`
            : '',
          threeLinerStr
            ? `[세 줄 스토리 구조 강제]\n아래 세 줄을 이야기의 기승전결 뼈대로 반드시 따르세요.\n첫 줄이 기(발단), 두 번째 줄이 승·전(전개·위기), 세 번째 줄이 결(해소)이 되어야 합니다.\n→ ${threeLinerStr}`
            : '',
          dailyAchieveStr
            ? `[일상 장면 삽입 — 필수]\n아래 [일상에서 이룬 일]을 이야기 중간에 구체적인 생활 장면으로 반드시 한 번 묘사해주세요. 소소하지만 진짜 같은 장면이 이야기에 온기를 줍니다.\n→ ${dailyAchieveStr}`
            : '',
        ].filter(Boolean).join('\n\n');

        const hasAge = typeof currentAge === 'number' && currentAge > 0;
        const ageBlock = hasAge
          ? `\n[사용자 연령 정보 — 절대 준수]\n- 사용자의 현재 나이: ${currentAge}세 (기준 연도: ${baseYear ?? new Date().getFullYear()}년)\n- 미래 시점: ${futureYear ?? ''}년 — 이 시점의 사용자는 ${futureAge ?? ''}세입니다.\n- AI는 사용자의 나이를 임의로 추정하지 않습니다. 위 수치만 사용합니다.\n- "30대", "40대", "서른 후반", "오십대" 등 연령대 표현은 ${futureAge ?? ''}세와 맞지 않으면 절대 쓰지 않습니다.\n- 주인공·사용자의 외모·체력·인생 단계·사회적 위치 묘사는 ${futureAge ?? ''}세에 부합해야 합니다.\n`
          : '';
        userPrompt = `
[창작 모드]: 내 기록으로 창작
[기록 제목]: ${recordTitle}
[기록 날짜]: ${recordDate}
[기록 형식]: ${recordFormat}
[예언 종류]: ${prophecyType}
[시간 배경]: ${timeOption}
[핵심 질문]: ${question}
${ageBlock}${extractedBlock ? '\n[AI가 기록에서 추출한 핵심 요소]:\n' + extractedBlock + '\n' : ''}${goalBlock ? '\n[사용자의 예언 목표]:\n' + goalBlock + '\n' : ''}
[실제 기록 내용]:
${recordContent}

위 실제 기록과 추출된 핵심 요소를 바탕으로 ${timeOption} 뒤의 이야기를 예언 소설 형식으로 작성해주세요.
기록 속 인물, 감정, 사건을 최대한 살려서 "내 이야기 같다"는 느낌이 들게 해주세요.
${hasAge ? `반드시 주인공이 ${futureAge}세인 것을 전제로 묘사하세요. 어떤 경우에도 ${futureAge}세와 모순되는 연령대 표현을 사용하지 마세요.\n` : ''}${sanitizedProtagonistName ? `위 이야기 전체에서 주인공 이름은 반드시 "${sanitizedProtagonistName}"이며, 절대 다른 이름을 임의로 생성하지 않습니다. "${sanitizedProtagonistName}" 또는 인칭대명사만 사용하세요.\n` : ''}${goalBlock ? '특히 위 [사용자의 예언 목표]에 명시된 예언 유형·초목표·넘고 싶은 것을 시놉시스/서사 전체에 반드시 자연스럽게 반영해주세요. 사용자의 초목표가 어떻게 되어가는지, 사용자가 넘고 싶다고 말한 것을 어떻게 마주하는지 이야기 속에 분명히 드러나야 합니다.\n' : ''}예언 종류: ${prophecyType}

${mandatoryBlock ? mandatoryBlock + '\n\n' : ''}${type === 'story'
  ? '분량: A4 5페이지 분량 (4000~6000자). 기승전결 구조로 작성.'
  : '분량: A4 1페이지 분량 시놉시스 (800~1200자). 핵심 줄거리만 간결하게.'}
`;
      } else {
        const motiveLabel = motiveCustom || motive;
        const eventsStr = Array.isArray(events) && events.length > 0
          ? events.map((e: any) => `${e.isCore ? '[핵심] ' : ''}${e.title}${e.timing ? `(${e.timing})` : ''}${e.impact ? ': ' + e.impact : ''}`).join(' / ')
          : '';
        const charsStr = Array.isArray(chars) && chars.length > 0
          ? chars.map((c: any) => `${c.name || c.role}(${c.role})${c.personalities?.length ? ' — ' + c.personalities.join(', ') : ''}${c.desires?.length ? ' / 욕망: ' + c.desires.join(', ') : ''}${c.shackles?.length ? ' / 족쇄: ' + c.shackles.join(', ') : ''}`).join('\n')
          : '';
        userPrompt = `
[창작 모드]: 사전설정 창작
[예언 모티브]: ${motiveLabel}
[시간 배경]: ${timeOption || '3년 후'}
[탄생 배경]: ${birth || ''}
[핵심 욕망]: ${desire || ''}
[족쇄]: ${shackle || ''}
[주요 사건]: ${eventsStr || ''}
[운의 전환점]: ${luck || ''}
[불운]: ${unluck || ''}
[서사 스타일]: ${narrative || ''}
[등장인물]:
${charsStr}

위 설정을 바탕으로 ${timeOption || '3년 후'}의 이야기를 예언 소설 형식으로 작성해주세요.
욕망과 족쇄의 긴장이 이야기를 이끌어야 합니다. 주인공이 족쇄를 극복하며 욕망에 다가가는 과정을 생생하게 그려주세요.
${type === 'story'
  ? 'A4 5페이지 분량(4000~6000자). 기승전결 구조로 작성.'
  : 'A4 1페이지 분량(800~1200자)의 시놉시스. 핵심 줄거리만 간결하게.'}
`;
      }

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({
        model: type === 'story' ? 'gemini-2.5-flash' : 'gemini-3.1-flash-lite',
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(userPrompt);
      const text = result.response.text();

      // ── 사용량 업데이트 ──
      await usageRef.set({
        daily: today,
        dailyCount: usage.daily === today ? usage.dailyCount + 1 : 1,
        monthly: thisMonth,
        monthlyCount: usage.monthly === thisMonth ? usage.monthlyCount + 1 : 1,
      });

      return { text };
    } catch (error: any) {
      console.error('HARU예언 생성 실패:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'HARU예언 생성에 실패했습니다.');
    }
  }
);

export const getVerseTranslation = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] },
  async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  const uid = request.auth.uid;
  await enforceRateLimit(uid, 'getVerseTranslation', 15, 80);

  const { verseKey, text } = request.data;

  // Firestore 캐시 확인
  const cacheRef = db.collection('translationCache').doc(verseKey);
  const cached = await cacheRef.get();
  if (cached.exists) {
    return { translation: cached.data()?.translation };
  }

  // Gemini로 번역
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
  const prompt = `다음 KJV 성경 구절을 자연스러운 한국어로 번역해주세요. 번역문만 출력하세요.\n\n${text}`;
  const result = await model.generateContent(prompt);
  const translation = result.response.text().trim();

  // Firestore 캐시 저장
  await cacheRef.set({ translation, verseKey, createdAt: new Date() });

  return { translation };
  }
);

export const getVerseWordMapping = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'getVerseWordMapping', 15, 80);

    const { verseKey, enText, koText } = request.data;
    if (!enText || !koText) throw new HttpsError('invalid-argument', '영어/한국어 텍스트가 필요합니다.');

    const cacheRef = db.collection('wordMappingCache').doc(verseKey);
    const cached = await cacheRef.get();
    if (cached.exists) return cached.data();

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const prompt = `다음 영어 성경 구절과 한국어 번역이 있습니다.
한국어 번역을 단어/어절 단위로 분리하고, 각 한국어 단어/어절이 영어 원문의 어떤 단어(들)에 해당하는지 매핑해주세요.

영어: ${enText}
한국어: ${koText}

JSON 형식으로만 출력하세요 (다른 설명 없이):
{
  "mapping": [
    { "ko": "한국어어절", "enWords": ["영어단어1", "영어단어2"] },
    ...
  ]
}`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    await cacheRef.set({ ...parsed, verseKey, createdAt: new Date() });
    return parsed;
  }
);

export const getCustomToken = onCall(
  {
    region: 'asia-northeast3',
    secrets: [COLLECTOR_SECRET_KEY],
  },
  async (request) => {
    const provided = request.data?.secretKey;
    if (provided !== COLLECTOR_SECRET_KEY.value()) {
      throw new HttpsError('permission-denied', '권한 없음');
    }
    const token = await admin.auth().createCustomToken(INTERNAL_ADMIN_UID);
    return { token };
  }
);

// ===== 🏠 온비드 부동산 물건목록 조회 (공공데이터포털 KAMCO) =====
// 출처: 한국자산관리공사 온비드 / Endpoint: apis.data.go.kr/B010003/OnbidRlstListSrvc2
export const getOnbidRealEstateList = onCall(
  {
    region: 'asia-northeast3',
    secrets: [ONBID_API_KEY_SECRET],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const d = request.data || {};
    const pageNo = Math.max(1, parseInt(String(d.pageNo ?? '1'), 10) || 1);
    const numOfRows = Math.min(50, Math.max(1, parseInt(String(d.numOfRows ?? '10'), 10) || 10));

    // v2.0 필수: prptDivCd, pvctTrgtYn — 사용자가 안 보내면 안전한 기본값으로 채움
    const params: Record<string, string> = {
      serviceKey: ONBID_API_KEY_SECRET.value(),
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
      resultType: 'json',
      prptDivCd: (String(d.prptDivCd ?? '').trim()) || '0007',
      pvctTrgtYn: (String(d.pvctTrgtYn ?? '').trim()) || 'N',
    };

    const optionalKeys = [
      'bidDivCd',
      'dspsMthodCd',
      'cltrUsgLclsCtgrId',
      'cltrUsgMclsCtgrId',
      'cltrUsgSclsCtgrId',
      'cltrUsgLclsCtgrNm',
      'cltrUsgMclsCtgrNm',
      'cltrUsgSclsCtgrNm',
      'lctnSdnm',
      'lctnSggnm',
      'lctnEmdNm',
      'lowstBidPrcStart',
      'lowstBidPrcEnd',
      'landSqmsStart',
      'landSqmsEnd',
      'bldSqmsStart',
      'bldSqmsEnd',
      'bidPrdYmdStart',
      'bidPrdYmdEnd',
      'cptnMthodCd',
      'cptnMthodNm',
      'alcYn',
      'usbdNftStart',
      'usbdNftEnd',
      'apslEvlAmtStart',
      'apslEvlAmtEnd',
      'onbidCltrNm',
      'orgNm',
      'mdfcnYmdStart',
      'mdfcnYmdEnd',
    ];
    for (const k of optionalKeys) {
      const v = d[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        params[k] = String(v).trim();
      }
    }

    const url = 'https://apis.data.go.kr/B010003/OnbidRlstListSrvc2/getRlstCltrList2';

    let resp: any;
    try {
      resp = await axios.get(url, {
        params,
        timeout: 15000,
        headers: { Accept: 'application/json' },
        // serviceKey 가 이미 인코딩되어 있을 수 있으므로 URLSearchParams 가 한번 더 인코딩하지 않도록 주의
        paramsSerializer: (p) =>
          Object.entries(p)
            .map(([k, v]) =>
              k === 'serviceKey'
                ? `${k}=${encodeURIComponent(decodeURIComponent(String(v)))}`
                : `${k}=${encodeURIComponent(String(v))}`
            )
            .join('&'),
      });
    } catch (err: any) {
      logger.error('온비드 API 호출 실패:', {
        message: err?.message,
        status: err?.response?.status,
        code: err?.code,
      });
      throw new HttpsError('internal', '온비드 서버에 연결할 수 없습니다');
    }

    const data = resp?.data;
    // 응답 형태 두 가지 모두 지원:
    //   (A) { response: { header, body } }  — OpenAPI 가이드 예제
    //   (B) { header, body }                — 실제 Onbid v2 응답
    const root = data?.response ?? data;
    const header = root?.header;
    const body = root?.body;
    const resultCode = header?.resultCode ?? '';
    const resultMsg = header?.resultMsg ?? '';


    if (resultCode && resultCode !== '00' && resultCode !== '0') {
      logger.warn('온비드 API 비정상 응답:', { resultCode, resultMsg });
      if (resultCode === '03') {
        return {
          success: true,
          items: [],
          totalCount: 0,
          pageNo,
          numOfRows,
          resultCode,
          resultMsg,
        };
      }
      throw new HttpsError('internal', `온비드 API 오류 (${resultCode}): ${resultMsg}`);
    }

    const rawItems = body?.items;
    let items: any[] = [];
    if (Array.isArray(rawItems)) {
      items = rawItems;
    } else if (rawItems?.item) {
      items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
    }

    return {
      success: true,
      items,
      totalCount: parseInt(String(body?.totalCount ?? '0'), 10) || 0,
      pageNo: parseInt(String(body?.pageNo ?? pageNo), 10) || pageNo,
      numOfRows: parseInt(String(body?.numOfRows ?? numOfRows), 10) || numOfRows,
      resultCode,
      resultMsg,
      disclaimer: '본 정보는 한국자산관리공사 온비드 공공데이터를 활용한 참고용이며, 실제 입찰은 온비드 공식사이트(onbid.co.kr)에서 확인하세요.',
    };
  }
);

// ===== 💊 식약처 의약품 제품 허가정보 조회 (SAYU건강관리 - 약봉지 보고 약정보 얻기) =====
// 출처: 식품의약품안전처 / Base: apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07
// 함수명(operation)이 버전마다 변동되므로 후보 순차 시도 + 성공한 URL 메모리 캐시
const DRUG_API_BASE = 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07';
const DRUG_API_OPS = [
  '/getDrugPrdtPrmsnDtlInq05',
  '/getDrugPrdtPrmsnDtlInq06',
  '/getDrugPrdtPrmsnInq05',
  '/getDrugPrdtPrmsnDtlInq07',
  '/getDrugPrdtPrmsnInq07',
  '/getDrugPrdtPrmsnDtlInq04',
  '/getDrugPrdtPrmsnInq04',
];
let _drugApiUrlCache: string | null = null;

async function callDrugApiOnce(
  url: string,
  params: Record<string, string>,
): Promise<{
  resp: any;
  hasResults: boolean;
  hasDetailFields: boolean;
  totalCount: number;
  itemCount: number;
}> {
  const resp = await axios.get(url, {
    params,
    timeout: 12000,
    headers: { Accept: 'application/json' },
    paramsSerializer: (p) =>
      Object.entries(p)
        .map(([k, v]) =>
          k === 'serviceKey'
            ? `${k}=${encodeURIComponent(decodeURIComponent(String(v)))}`
            : `${k}=${encodeURIComponent(String(v))}`
        )
        .join('&'),
  });
  const data = resp?.data;
  const root = data?.response ?? data;
  if (!root || (!root.body && !root.header)) {
    throw new Error('식약처 응답 구조 비정상');
  }
  const body = root.body;
  const rawItems = body?.items;
  let items: any[] = [];
  if (Array.isArray(rawItems)) items = rawItems;
  else if (rawItems?.item) items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
  const itemCount = items.length;
  const totalCount = parseInt(String(body?.totalCount ?? '0'), 10) || 0;
  const hasResults = itemCount > 0 || totalCount > 0;
  // 상세 화면이 필요로 하는 문서 필드가 하나라도 들어있는지
  const hasDetailFields = items.some(
    (it) =>
      (it?.EE_DOC_DATA && String(it.EE_DOC_DATA).trim()) ||
      (it?.UD_DOC_DATA && String(it.UD_DOC_DATA).trim()) ||
      (it?.NB_DOC_DATA && String(it.NB_DOC_DATA).trim()),
  );
  return { resp, hasResults, hasDetailFields, totalCount, itemCount };
}

async function callDrugApi(params: Record<string, string>): Promise<any> {
  // 1단계: 캐시된 endpoint 우선 시도.
  // 응답 자체가 실패한 경우만 캐시 무효화 후 전체 후보 재시도.
  if (_drugApiUrlCache) {
    try {
      const { resp } = await callDrugApiOnce(_drugApiUrlCache, params);
      return resp;
    } catch (err: any) {
      logger.warn('식약처 캐시 endpoint 실패 — 캐시 무효화 후 전체 후보 재시도', {
        cached: _drugApiUrlCache.split('/').pop(),
        status: err?.response?.status || 0,
      });
      _drugApiUrlCache = null;
    }
  }

  // 2단계: 전체 후보 순회 — 우선순위
  //   ① 상세 필드(EE/UD/NB_DOC_DATA) 있는 endpoint → 즉시 캐시 + 반환
  //   ② items만 있고 상세 필드 없는 endpoint → fallback 후보, 캐시 보류
  //   ③ 0건이지만 정상 응답 → 마지막 fallback 후보, 캐시 보류
  const tryUrls = DRUG_API_OPS.map((op) => DRUG_API_BASE + op);
  let firstResultResp: any = null;
  let firstResultOp: string | null = null;
  let firstValidResp: any = null;
  let firstValidOp: string | null = null;
  let lastError: any = null;
  let lastSnippet = '';
  let lastStatus = 0;

  for (const url of tryUrls) {
    const op = url.split('/').pop() || '';
    try {
      const { resp, hasResults, hasDetailFields, totalCount, itemCount } =
        await callDrugApiOnce(url, params);
      logger.info('식약처 endpoint 시도', {
        op,
        totalCount,
        itemCount,
        hasResults,
        hasDetailFields,
      });
      if (hasDetailFields) {
        _drugApiUrlCache = url;
        logger.info('식약처 endpoint 확정:', {
          op,
          totalCount,
          reason: 'detail_fields_found',
        });
        return resp;
      }
      if (hasResults && !firstResultResp) {
        firstResultResp = resp;
        firstResultOp = op;
      }
      if (!firstValidResp) {
        firstValidResp = resp;
        firstValidOp = op;
      }
    } catch (err: any) {
      lastError = err;
      lastStatus = err?.response?.status || 0;
      lastSnippet = typeof err?.response?.data === 'string'
        ? err.response.data.slice(0, 200)
        : JSON.stringify(err?.response?.data || {}).slice(0, 200);
      continue;
    }
  }

  // 상세 필드 발견 못 함 → 결과 있는 응답을 fallback으로 반환 (캐시 보류)
  if (firstResultResp) {
    logger.warn('식약처 모든 endpoint 상세 필드 없음 — 결과만 있는 응답 반환, 캐시 보류', {
      firstResultOp,
      tried: tryUrls.length,
    });
    return firstResultResp;
  }
  if (firstValidResp) {
    logger.warn('식약처 모든 endpoint 0건 — 캐시 확정 보류', {
      firstValidOp,
      tried: tryUrls.length,
    });
    return firstValidResp;
  }

  logger.error('식약처 API 모든 endpoint 후보 실패', {
    lastStatus,
    lastSnippet,
    triedCount: tryUrls.length,
  });
  throw lastError || new Error('식약처 API endpoint를 찾을 수 없습니다');
}

function buildDrugSearchTerms(raw: string): string[] {
  const original = raw.trim();
  const terms: string[] = [];
  const add = (s: string) => {
    const v = s.trim().replace(/\s+/g, ' ');
    if (v && !terms.includes(v)) terms.push(v);
  };

  add(original);
  add(original.replace(/(\d+(?:[./]\d+)*)m\b/gi, '$1mg'));

  const withoutDosage = original
    .replace(/\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?\s*(밀리그램|마이크로그램|mg|m|g|ml|mcg|µg|μg|IU|%)?/gi, '')
    .replace(/\d+(\.\d+)?\s*(밀리그램|마이크로그램|mg|m|g|ml|mcg|µg|μg|IU|%)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\/·,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  add(withoutDosage);

  const firstWord = withoutDosage.match(/[가-힣A-Za-z]+/)?.[0] || '';
  add(firstWord);

  if (firstWord.endsWith('정') && firstWord.length > 2) {
    add(firstWord.slice(0, -1));
  }

  return terms.slice(0, 5);
}

function parseDrugItemsFromResponse(resp: any): { items: any[]; totalCount: number; pageNo?: number; numOfRows?: number; resultCode: string; resultMsg: string } {
  const data = resp?.data;
  const root = data?.response ?? data;
  const header = root?.header;
  const body = root?.body;
  const rawItems = body?.items;
  let items: any[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems;
  } else if (rawItems?.item) {
    items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
  }

  return {
    items,
    totalCount: parseInt(String(body?.totalCount ?? '0'), 10) || 0,
    pageNo: body?.pageNo,
    numOfRows: body?.numOfRows,
    resultCode: header?.resultCode ?? '',
    resultMsg: header?.resultMsg ?? '',
  };
}

export const getDrugInfo = onCall(
  {
    region: 'asia-northeast3',
    secrets: [DRUG_API_KEY_SECRET],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const d = request.data || {};
    const itemName = String(d.itemName ?? '').trim();
    if (!itemName) {
      throw new HttpsError('invalid-argument', '약 이름을 입력하세요');
    }
    const pageNo = Math.max(1, parseInt(String(d.pageNo ?? '1'), 10) || 1);
    const numOfRows = Math.min(20, Math.max(1, parseInt(String(d.numOfRows ?? '10'), 10) || 10));

    const searchTerms = buildDrugSearchTerms(itemName);
    const seen = new Set<string>();
    const mergedItems: any[] = [];
    let totalCount = 0;
    let resultCode = '';
    let resultMsg = '';

    for (const term of searchTerms) {
      const params: Record<string, string> = {
        serviceKey: DRUG_API_KEY_SECRET.value(),
        pageNo: String(pageNo),
        numOfRows: String(numOfRows),
        type: 'json',
        item_name: term,
      };

      let resp: any;
      try {
        resp = await callDrugApi(params);
      } catch (err: any) {
        if (term === searchTerms[0] && searchTerms.length === 1) {
          throw new HttpsError('internal', '식약처 서버에 연결할 수 없습니다');
        }
        continue;
      }

      const parsed = parseDrugItemsFromResponse(resp);
      resultCode = parsed.resultCode;
      resultMsg = parsed.resultMsg;

      if (resultCode && resultCode !== '00' && resultCode !== '0') {
        logger.warn('식약처 API 비정상 응답:', { resultCode, resultMsg, term });
        if (resultCode !== '03') {
          throw new HttpsError('internal', `식약처 API 오류 (${resultCode}): ${resultMsg}`);
        }
      }

      totalCount += parsed.totalCount;
      for (const item of parsed.items) {
        const key = item?.ITEM_SEQ || `${item?.ITEM_NAME || ''}__${item?.ENTP_NAME || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mergedItems.push(item);
      }
    }

    return {
      success: true,
      items: mergedItems.slice(0, numOfRows),
      totalCount: Math.max(totalCount, mergedItems.length),
      pageNo,
      numOfRows,
      searchedTerms: searchTerms,
      resultCode,
      resultMsg,
      disclaimer: '본 정보는 식품의약품안전처 공공데이터를 활용한 참고용이며, 의료 행위·처방을 대체하지 않습니다.',
    };
  }
);

// ===== 🏥 심평원 병원정보서비스 조회 (SAYU건강관리 - 동네병원정보) =====
// 출처: 건강보험심사평가원
// 실제 살아있는 endpoint: hospInfoServicev2/getHospBasisList (Cloud Logs 401 검증)
// 가이드 v1.2(2021)의 hospInfoService1은 폐지된 것으로 확인 (HTTP 500 응답)
const HIRA_CANDIDATES: { url: string }[] = [
  { url: 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList' },
  { url: 'http://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList' },
  { url: 'https://apis.data.go.kr/B551182/hospInfoService1/getHospBasisList1' },
];
let _hospitalApiUrlCache: string | null = null;

function encodePublicDataParam(key: string, value: unknown): string {
  const raw = String(value);
  if (key !== 'ServiceKey' && key !== 'serviceKey') {
    return encodeURIComponent(raw);
  }

  try {
    return encodeURIComponent(decodeURIComponent(raw));
  } catch {
    return encodeURIComponent(raw);
  }
}

function getPublicDataErrorKind(resultCode: string, resultMsg: string, snippet: string): string | null {
  const text = `${resultCode} ${resultMsg} ${snippet}`.toUpperCase();
  // 평문 "UNAUTHORIZED"도 인증 거부로 처리 (B551182의 401 응답 패턴)
  if (text.includes('UNAUTHORIZED')) {
    return 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR';
  }
  const knownErrors = [
    'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
    'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR',
    'INVALID_REQUEST_PARAMETER_ERROR',
    'SERVICE_ACCESS_DENIED_ERROR',
    'SERVICE_KEY_IS_NOT_REGISTERED',
    'UNREGISTERED_SERVICE_KEY',
  ];
  return knownErrors.find((code) => text.includes(code)) ?? null;
}

function hospitalEndpointLabel(url: string): string {
  return url.replace(/^https?:\/\/apis\.data\.go\.kr\/B551182\//, '');
}

async function callHospitalApi(params: Record<string, string>): Promise<any> {
  const tryUrls = _hospitalApiUrlCache
    ? [_hospitalApiUrlCache]
    : HIRA_CANDIDATES.map((c) => c.url);

  let lastError: any = null;
  let lastSnippet = '';
  let lastStatus = 0;
  const attempts: { url: string; status: number; snippet: string }[] = [];

  for (const url of tryUrls) {
    try {
      const resp = await axios.get(url, {
        params,
        timeout: 12000,
        headers: { Accept: 'application/json' },
        paramsSerializer: (p) =>
          Object.entries(p)
            .map(([k, v]) => `${k}=${encodePublicDataParam(k, v)}`)
            .join('&'),
      });
      const root = resp?.data?.response ?? resp?.data;
      const header = root?.header;
      const resultCode = header?.resultCode ?? '';
      const resultMsg = header?.resultMsg ?? '';
      const bodySnippet = typeof resp?.data === 'string'
        ? resp.data.slice(0, 500)
        : JSON.stringify(resp?.data || {}).slice(0, 500);

      logger.info('심평원 endpoint 응답', {
        endpoint: hospitalEndpointLabel(url),
        status: resp.status,
        resultCode,
        resultMsg,
      });

      // resultCode가 정상(00 또는 0)이면 endpoint 살아있음
      if (root && (root.body || root.header) && (resultCode === '00' || resultCode === '0' || resultCode === '')) {
        if (!_hospitalApiUrlCache) {
          _hospitalApiUrlCache = url;
          logger.info('심평원 endpoint 확정:', { endpoint: hospitalEndpointLabel(url) });
        }
        return resp;
      }

      const publicDataError = getPublicDataErrorKind(resultCode, resultMsg, bodySnippet);

      // 200이지만 비정상 응답 → 다음 후보로
      attempts.push({
        url: hospitalEndpointLabel(url),
        status: 200,
        snippet: `resultCode=${resultCode} ${resultMsg || bodySnippet}`.slice(0, 180),
      });

      if (publicDataError) {
        const error = new Error(`심평원 공공데이터 오류: ${publicDataError}`);
        (error as any).publicDataError = publicDataError;
        (error as any).resultCode = resultCode;
        (error as any).resultMsg = resultMsg;
        (error as any).attempts = attempts;
        throw error;
      }
    } catch (err: any) {
      lastError = err;
      lastStatus = err?.response?.status || 0;
      lastSnippet = typeof err?.response?.data === 'string'
        ? err.response.data.slice(0, 500)
        : JSON.stringify(err?.response?.data || {}).slice(0, 500);
      const root = err?.response?.data?.response ?? err?.response?.data;
      const header = root?.header;
      const resultCode = header?.resultCode ?? err?.resultCode ?? '';
      const resultMsg = header?.resultMsg ?? err?.resultMsg ?? '';
      const publicDataError = err?.publicDataError ?? getPublicDataErrorKind(resultCode, resultMsg, lastSnippet);

      attempts.push({
        url: hospitalEndpointLabel(url),
        status: lastStatus,
        snippet: `resultCode=${resultCode} ${resultMsg || lastSnippet}`.slice(0, 180),
      });

      logger.warn('심평원 endpoint 실패', {
        endpoint: hospitalEndpointLabel(url),
        status: lastStatus,
        resultCode,
        resultMsg,
        publicDataError,
        snippet: lastSnippet.slice(0, 180),
      });

      if (publicDataError) {
        err.publicDataError = publicDataError;
        err.resultCode = resultCode;
        err.resultMsg = resultMsg;
        err.attempts = attempts;
        throw err;
      }

      continue;
    }
  }

  logger.error('심평원 API 모든 endpoint 후보 실패', {
    lastStatus,
    lastSnippet,
    triedCount: tryUrls.length,
    attempts,
  });
  if (lastError) {
    lastError.attempts = attempts;
    throw lastError;
  }
  const error = new Error('심평원 API endpoint를 찾을 수 없습니다');
  (error as any).attempts = attempts;
  throw error;
}

const HIRA_SIDO_NM_TO_CD: Record<string, string> = {
  '서울특별시': '110000',
  '부산광역시': '210000',
  '대구광역시': '220000',
  '인천광역시': '230000',
  '광주광역시': '240000',
  '대전광역시': '250000',
  '울산광역시': '260000',
  '세종특별자치시': '290000',
  '경기도': '310000',
  '강원특별자치도': '320000',
  '충청북도': '330000',
  '충청남도': '340000',
  '전북특별자치도': '350000',
  '전라남도': '360000',
  '경상북도': '370000',
  '경상남도': '380000',
  '제주특별자치도': '390000',
};

export const getHospitalList = onCall(
  {
    region: 'asia-northeast3',
    secrets: [HIRA_API_KEY_SECRET],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const d = request.data || {};
    const pageNo = Math.max(1, parseInt(String(d.pageNo ?? '1'), 10) || 1);
    const numOfRows = Math.min(50, Math.max(1, parseInt(String(d.numOfRows ?? '10'), 10) || 10));

    const sidoCdNm = String(d.sidoCdNm ?? '').trim();
    const sgguCdNm = String(d.sgguCdNm ?? '').trim();
    const yadmNm = String(d.yadmNm ?? '').trim();
    const dgsbjtCd = String(d.dgsbjtCd ?? '').trim();

    if (!sidoCdNm && !sgguCdNm && !yadmNm) {
      throw new HttpsError('invalid-argument', '시·도, 시·군·구, 병원명 중 하나는 필요합니다');
    }

    // sgguCd는 6자리 코드라 한글→코드 매핑이 어려움.
    // 서버에는 sgguCd를 보내지 않고, 응답을 받은 후 sgguCdNm 필드로 필터링.
    // 시군구 필터링을 위해 페이지 사이즈를 넉넉히 받음.
    const fetchSize = sgguCdNm ? 50 : numOfRows;

    const params: Record<string, string> = {
      ServiceKey: HIRA_API_KEY_SECRET.value(),
      pageNo: String(pageNo),
      numOfRows: String(fetchSize),
      _type: 'json',
    };

    if (sidoCdNm && HIRA_SIDO_NM_TO_CD[sidoCdNm]) {
      params.sidoCd = HIRA_SIDO_NM_TO_CD[sidoCdNm];
    }
    if (yadmNm) params.yadmNm = yadmNm;
    if (dgsbjtCd) params.dgsbjtCd = dgsbjtCd;

    let resp: any;
    try {
      resp = await callHospitalApi(params);
    } catch (err: any) {
      logger.error('심평원 병원정보 조회 실패', {
        message: err?.message,
        status: err?.response?.status,
        code: err?.code,
        resultCode: err?.resultCode,
        resultMsg: err?.resultMsg,
        publicDataError: err?.publicDataError,
        attempts: err?.attempts,
      });

      // 공공데이터 표준 에러 코드별 사용자 친화적 메시지로 분기
      const pde: string | null = err?.publicDataError ?? null;
      let userMessage = '심평원 서버에 일시적 문제가 있습니다. 잠시 후 다시 시도해 주세요.';
      let httpsCode: 'internal' | 'permission-denied' | 'resource-exhausted' | 'invalid-argument' | 'unavailable' = 'internal';

      if (pde) {
        if (pde.includes('SERVICE_KEY_IS_NOT_REGISTERED')) {
          userMessage = '병원정보서비스 인증이 거부됐습니다. 공공데이터포털에서 병원정보서비스(15001698) 활용신청 상태를 확인해 주세요.';
          httpsCode = 'permission-denied';
        } else if (pde.includes('LIMITED_NUMBER_OF_SERVICE_REQUESTS')) {
          userMessage = '오늘 조회 한도(1,000회/일)를 초과했습니다. 내일 다시 시도해 주세요.';
          httpsCode = 'resource-exhausted';
        } else if (pde.includes('INVALID_REQUEST_PARAMETER')) {
          userMessage = '검색 조건이 올바르지 않습니다. 다시 확인해 주세요.';
          httpsCode = 'invalid-argument';
        } else if (pde.includes('SERVICE_ACCESS_DENIED')) {
          userMessage = '병원정보서비스 접근이 거부됐습니다. 활용신청 승인 상태를 확인해 주세요.';
          httpsCode = 'permission-denied';
        }
      }

      throw new HttpsError(httpsCode, userMessage);
    }

    const data = resp?.data;
    const root = data?.response ?? data;
    const header = root?.header;
    const body = root?.body;
    const resultCode = header?.resultCode ?? '';
    const resultMsg = header?.resultMsg ?? '';

    if (resultCode && resultCode !== '00' && resultCode !== '0') {
      logger.warn('심평원 API 비정상 응답:', { resultCode, resultMsg });
      if (resultCode === '03') {
        return {
          success: true,
          items: [],
          totalCount: 0,
          pageNo,
          numOfRows,
          resultCode,
          resultMsg,
        };
      }
      throw new HttpsError('internal', `심평원 API 오류 (${resultCode}): ${resultMsg}`);
    }

    const rawItems = body?.items;
    let items: any[] = [];
    if (Array.isArray(rawItems)) {
      items = rawItems;
    } else if (rawItems?.item) {
      items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
    }

    const apiTotalCount = parseInt(String(body?.totalCount ?? '0'), 10) || 0;

    // 시군구 필터링 (sgguCd 매핑 불가 → 응답의 sgguCdNm 필드로 부분 매치)
    let filteredItems = items;
    let filteredTotal = apiTotalCount;
    if (sgguCdNm) {
      filteredItems = items.filter((it: any) => {
        const nm = String(it?.sgguCdNm ?? '').trim();
        return nm.includes(sgguCdNm);
      });
      filteredTotal = filteredItems.length;
    }

    // numOfRows에 맞춰 잘라냄
    const finalItems = filteredItems.slice(0, numOfRows);

    return {
      success: true,
      items: finalItems,
      totalCount: filteredTotal,
      pageNo: parseInt(String(body?.pageNo ?? pageNo), 10) || pageNo,
      numOfRows,
      resultCode,
      resultMsg,
      disclaimer: '본 정보는 건강보험심사평가원 공공데이터를 활용한 참고용이며, 특정 기관·의사의 평가나 추천이 아닙니다.',
    };
  }
);

// ===== 🔬 약봉지 AI 사진 분석 (SAYU건강관리 - Gemini Vision) =====
// 입력: 사진 base64 배열 (1~3장)
// 처리: Gemini Vision으로 약 이름 후보만 추출 (공식 약정보 검색은 사용자가 확인 후 별도 실행)
// 개인정보 안전장치:
//   1) 프롬프트에 환자·의사·병원 정보 무시 명시
//   2) 사진·개인정보 로그 차단 (장수·바이트 길이만 로깅)
//   3) 분석 후 사진 즉시 폐기 (Storage 저장 없음)
//   4) 사용자 확인 전 공식 약정보를 자동 확정하지 않음
export const analyzeDrugPhoto = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const d = request.data || {};
    const rawImages = Array.isArray(d.images) ? d.images : [];
    const images: string[] = rawImages
      .filter((s: unknown) => typeof s === 'string' && s.length > 0)
      .map((s: string) => s.replace(/^data:image\/[a-zA-Z]+;base64,/, ''))
      .slice(0, 3);

    if (images.length === 0) {
      throw new HttpsError('invalid-argument', '사진이 필요합니다 (최소 1장, 최대 3장)');
    }

    // 사진 크기 검증 (각 장 최대 4MB base64 ≈ 3MB 원본)
    const totalKb = images.reduce((sum, b) => sum + Math.round(b.length * 0.75 / 1024), 0);
    if (totalKb > 12 * 1024) {
      throw new HttpsError('invalid-argument', '사진이 너무 큽니다. 1장당 4MB 이하로 줄여주세요');
    }

    // 🔒 로깅 안전장치: 사진·개인정보 절대 안 남기고 메타데이터만
    logger.info('analyzeDrugPhoto 호출', {
      imageCount: images.length,
      totalKb,
      uid: request.auth.uid.slice(0, 8) + '…',
    });

    // === 1단계: Gemini Vision으로 약 이름 "전부" 추출 (다중 약 지원) ===
    // 🔒 프롬프트 안전장치: 환자·의사·병원 정보 명시적 무시
    const prompt = `당신은 약봉지 사진에서 약 이름만 추출하는 도우미입니다.

[추출 대상 — 오직 이것만]
- 약의 제품명 (예: "타이레놀정500mg", "게보린", "베아제")
- 한 봉지 안에 여러 약이 있으면 **모든 약을 빠짐없이** 추출하세요
- 사진이 여러 장이면 각 사진의 약도 모두 추출하세요 (중복은 1번만)
- 한국 식약처에 등록된 의약품 제품명 형식

[절대 무시 — 분석·언급·저장 모두 금지]
- 환자 이름, 생년월일, 나이, 성별, 주민번호
- 처방 의사 이름, 면허번호
- 병원명, 의원명, 약국명, 주소, 전화번호
- 처방일자, 처방번호, 보험 식별번호
- 그 외 사람을 식별할 수 있는 모든 정보

위 무시 대상은 응답에 절대 포함하지 말고, 내부적으로도 텍스트화하지 마세요.

[출력 형식 — JSON 한 줄, 마크다운 금지]
{"drugs": [{"name": "약 이름1", "dosage": "500mg", "confidence": 0.86}, {"name": "약 이름2", "confidence": 0.62}], "note": "한 줄 메모"}

[규칙]
- 약 이름이 하나도 없으면 drugs=[] (빈 배열), note="약봉지 사진이 아닙니다" 또는 사유
- confidence는 0~1 숫자로 개별 평가
- 보이는 함량이 있으면 dosage에 넣고, 없으면 생략
- 같은 약이 여러 번 보이면 한 번만 포함
- 추측·환각 금지. 확실하지 않은 이름은 포함하지 마세요.
- 최대 10개까지만 추출`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const modelName = 'gemini-3.1-flash-lite';
    const visionModel = genAI.getGenerativeModel({ model: modelName });

    type ParsedDrug = { name: string; dosage?: string; confidence?: number };

    let parsedDrugs: ParsedDrug[] = [];
    let aiNote = '';
    try {
      const parts: any[] = [{ text: prompt }];
      for (const b64 of images) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: b64,
          },
        });
      }
      const result = await visionModel.generateContent({
        contents: [{ role: 'user', parts }],
      });
      const usage = getGeminiUsage(result);
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'drug_photo',
        plan: AI_USAGE_PLAN,
        model: modelName,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        imageCount: images.length,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: true,
        errorCode: null,
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      let raw = result.response.text().trim();
      // 마크다운 코드펜스 제거
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(raw);
      aiNote = String(parsed?.note ?? '').trim().slice(0, 100);

      // 신·구 응답 형식 모두 수용 (drugs 배열 우선, 없으면 drugName 단일 폴백)
      const rawList = Array.isArray(parsed?.drugs) ? parsed.drugs : [];
      const seen = new Set<string>();
      for (const item of rawList) {
        const name = String(item?.name ?? '').trim().slice(0, 60);
        if (!name) continue;
        const key = name.toLowerCase().replace(/\s+/g, '');
        if (seen.has(key)) continue;
        seen.add(key);
        const rawConfidence = Number(item?.confidence);
        const confidence = Number.isFinite(rawConfidence)
          ? Math.max(0, Math.min(1, rawConfidence))
          : undefined;
        const dosage = String(item?.dosage ?? '').trim().slice(0, 30) || undefined;
        parsedDrugs.push({ name, dosage, confidence });
        if (parsedDrugs.length >= 10) break;
      }

      // 구 형식 폴백 (drugName 단일 필드)
      if (parsedDrugs.length === 0 && parsed?.drugName) {
        const name = String(parsed.drugName).trim().slice(0, 60);
        if (name) {
          parsedDrugs.push({ name });
        }
      }
    } catch (err: any) {
      // 🔒 에러 로그에도 사진·prompt 데이터 노출 금지
      logger.error('Gemini Vision 분석 실패', { message: err?.message?.slice(0, 200) });
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'drug_photo',
        plan: AI_USAGE_PLAN,
        model: modelName,
        inputTokens: null,
        outputTokens: null,
        imageCount: images.length,
        externalApiProvider: null,
        externalApiCalled: false,
        groundingUsed: false,
        requestId: null,
        success: false,
        errorCode: getAiUsageErrorCode(err),
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      throw new HttpsError('internal', 'AI 분석 중 오류가 발생했습니다. 사진을 다시 찍어 주세요');
    }

    // 사진 base64 즉시 메모리 해제 (분석 끝났으니 보관 안 함)
    images.length = 0;

    const disclaimer = 'AI가 추정한 약 이름 후보입니다. 반드시 약봉지 원문과 대조해 확인한 뒤 공식 의약품 정보를 검색하세요.';

    if (parsedDrugs.length === 0) {
      return {
        success: true,
        rawText: aiNote || '',
        candidates: [],
        extractedName: '',
        confidence: 'none',
        aiNote: aiNote || '약 이름을 인식하지 못했습니다. 사진을 더 또렷이 찍거나 약 이름을 직접 입력해 주세요.',
        disclaimer,
      };
    }

    return {
      success: true,
      rawText: aiNote || '',
      candidates: parsedDrugs,
      // 하위 호환: 첫 후보명만 제공하되 약정보 확정값으로 쓰지 않음
      extractedName: parsedDrugs[0]?.name || '',
      confidence: 'none',
      aiNote,
      disclaimer,
    };
  }
);

// ===== 🩺 증상별 진료과 분석 (SayuHealth 명의찾기 — 심평원 API 대체) =====
// 입력: 사용자 증상 자유 텍스트 + (선택) 나이
// 출력: 추천 진료과 1~3개 + 지도/EBS 검색 키워드 + 면책 문구
// Firestore 저장 없음 (1회성 검색, 개인정보 부담 최소화)
export const analyzeSymptomsForSpecialty = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const d = request.data || {};
    const symptoms = typeof d.symptoms === 'string' ? d.symptoms.trim() : '';
    const ageRaw = d.age;
    const age = typeof ageRaw === 'number' && ageRaw > 0 && ageRaw < 150
      ? Math.floor(ageRaw)
      : null;

    if (!symptoms || symptoms.length < 5) {
      throw new HttpsError('invalid-argument', '증상을 5자 이상 입력해 주세요.');
    }
    if (symptoms.length > 1000) {
      throw new HttpsError('invalid-argument', '증상은 1000자 이내로 입력해 주세요.');
    }

    const systemPrompt = `당신은 한국 의료 안내 보조 AI입니다.
사용자의 증상을 듣고 적절한 진료과를 1~3개 추천하세요.

⚠️ 절대 준수:
- 진단·치료법 제안 금지
- "최고 의사"·"명의 추천" 같은 표현 금지
- 응급 증상(가슴 통증·호흡 곤란·의식 저하 등) 의심 시 119 안내를 disclaimer에 우선 명시
- 추천 진료과 외 의학적 조언 금지

응답은 반드시 아래 JSON 구조로만 출력하세요. 마크다운 코드펜스(\`\`\`) 없이 순수 JSON만:
{
  "recommendedSpecialties": ["순환기내과", "호흡기내과"],
  "searchKeyword": "순환기내과",
  "ebsKeyword": "심장",
  "disclaimer": "이 추천은 참고용이며 진료 효과를 보장하지 않습니다. 정확한 진단은 의료진과 상담하세요."
}

규칙:
- recommendedSpecialties: 1~3개의 한국 진료과명 (예: "순환기내과", "신경과", "정형외과")
- searchKeyword: 지도 앱에서 검색할 한 단어 진료과 (가장 적합한 1개)
- ebsKeyword: EBS 명의 다시보기에서 검색할 키워드 (예: "심장", "당뇨", "뇌졸중")
- disclaimer: 면책 문구. 응급 증상 의심 시 119 안내 추가`;

    const userPrompt = `[사용자 입력]
- 증상: ${symptoms}
- 나이: ${age !== null ? `${age}세` : '미입력'}

위 증상에 어울리는 진료과를 분석해 JSON으로만 응답하세요.`;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userPrompt);
      const raw = result.response.text().trim();
      // Gemini가 가끔 ```json ... ``` 으로 감쌀 수 있어 정리
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```\s*$/, '').trim();
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        logger.error('analyzeSymptomsForSpecialty: JSON 파싱 실패', { raw: raw.slice(0, 500) });
        throw new HttpsError('internal', '진료과 분석 응답을 해석할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      }

      const specialties: string[] = Array.isArray(parsed.recommendedSpecialties)
        ? parsed.recommendedSpecialties.filter((s: any) => typeof s === 'string' && s.trim().length > 0).slice(0, 3)
        : [];
      const searchKeyword = typeof parsed.searchKeyword === 'string' && parsed.searchKeyword.trim()
        ? parsed.searchKeyword.trim()
        : (specialties[0] || '내과');
      const ebsKeyword = typeof parsed.ebsKeyword === 'string' && parsed.ebsKeyword.trim()
        ? parsed.ebsKeyword.trim()
        : (specialties[0] || '건강');
      const disclaimer = typeof parsed.disclaimer === 'string' && parsed.disclaimer.trim()
        ? parsed.disclaimer.trim()
        : '이 추천은 참고용이며 진료 효과를 보장하지 않습니다. 정확한 진단은 의료진과 상담하세요. 응급 증상(가슴 통증·호흡 곤란·의식 저하 등)에는 즉시 119에 신고하세요.';

      return {
        recommendedSpecialties: specialties.length > 0 ? specialties : ['내과'],
        searchKeyword,
        ebsKeyword,
        disclaimer,
      };
    } catch (e: any) {
      if (e instanceof HttpsError) throw e;
      logger.error('analyzeSymptomsForSpecialty 실패', { message: e?.message });
      throw new HttpsError('internal', '진료과 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }
);

// ✅ K뉴스 자동 발행 도구 — 카드뉴스 이미지에서 메타데이터 자동 추출 (Gemini Vision)
export const extractKNewsMetadata = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!isInternalDeveloperUid(request.auth?.uid)) {
      throw new HttpsError('permission-denied', '개발자 전용 기능입니다.');
    }

    const { imageBase64, mimeType } = request.data as { imageBase64?: string; mimeType?: string };
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', '이미지 데이터(imageBase64)가 필요합니다.');
    }

    const prompt = `이 카드뉴스 이미지를 분석하여 아래 JSON 형식으로만 응답하세요. 다른 설명/마크다운 금지.

{
  "title": "카드뉴스 메인 제목 (한 줄, 30자 이내)",
  "subtitle": "부제 또는 핵심 요약 (50자 이내)",
  "category": "K-컬처/K-푸드/K-기술/K-스포츠/글로벌 위상/한국의 가치 중 가장 적합한 하나",
  "tags": ["관련 태그 3~5개"],
  "sources": ["이미지에 명시된 출처 (OECD/통계청/KOFICE 등). 없으면 빈 배열"],
  "summary": "카드뉴스 핵심 요약 1~2문장",
  "copyrightCheck": {
    "isAIGenerated": true 또는 false,
    "brandDetected": "방송사/언론사 로고·워터마크 검출 여부 (true/false)",
    "publicSource": "공공기관 출처가 명확한가? (true/false)"
  }
}

반드시 위 JSON 키 구조 그대로. category는 반드시 6개 중 정확히 하나.`;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType || 'image/png',
          },
        },
      ]);

      const text = result.response.text();
      const cleaned = text.replace(/```json|```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('extractKNewsMetadata 응답 JSON 미발견', { text });
        throw new HttpsError('internal', 'AI 응답에서 JSON을 찾을 수 없습니다.');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (e: any) {
      if (e instanceof HttpsError) throw e;
      logger.error('extractKNewsMetadata 실패', { message: e?.message });
      throw new HttpsError('internal', `메타데이터 추출 실패: ${e?.message || '알 수 없는 오류'}`);
    }
  }
);

// ===== 🌱 하루식물탐정 — Kindwise Plant.id 식별 + Gemini 해설 =====
// 1) Kindwise Plant.id v3 identification: 학명·일반명·확률 (전문 모델)
// 2) Gemini Flash Lite vision: 상태·관찰·돌봄 힌트·주의 신호 (해설 레이어)
// 두 호출 병렬 + Promise.allSettled로 graceful fallback.

type KindwiseSuggestion = {
  name?: string;
  probability?: number;
  score?: number;
  confidence?: number;
  similarity?: number;
  details?: {
    common_names?: string[];
    taxonomy?: { class?: string; family?: string; genus?: string; order?: string; phylum?: string; kingdom?: string };
    url?: string;
    description?: { value?: string };
  };
};

type KindwiseIdResult = {
  topPlantName: string;
  latinName: string;
  identificationProbability: number | null;
  isPlantProbability: number;
  alternativeCandidates: { name: string; latinName: string; probability: number | null }[];
  taxonomy?: { family?: string; genus?: string };
  kindwiseUrl?: string;
};

function pickApiScore(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

async function callKindwiseIdentification(
  base64: string,
  _mimeType: string,
  apiKey: string,
): Promise<KindwiseIdResult> {
  // Plant.id v3는 raw base64를 권장 (data URI prefix 없이)
  const detailsParam = encodeURIComponent('common_names,taxonomy,url');
  const endpoint = `https://api.plant.id/v3/identification?details=${detailsParam}&language=ko`;

  logger.info('Kindwise 요청 시작', {
    endpoint,
    base64Length: base64.length,
    base64FirstChars: base64.slice(0, 20),
    apiKeyLength: apiKey?.length || 0,
    apiKeyMasked: apiKey ? `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}` : 'EMPTY',
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      images: [base64],
      // Plant.id v3는 similar_images=false 를 modifier로 거부 → 필드 자체를 생략 (default 동작)
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    logger.error('Kindwise 응답 오류', {
      status: response.status,
      statusText: response.statusText,
      bodyPreview: errText.slice(0, 500),
      contentType: response.headers.get('content-type') || '',
    });
    throw new Error(`Kindwise ${response.status} ${response.statusText}: ${errText.slice(0, 200)}`);
  }
  const json: any = await response.json();
  logger.info('Kindwise 응답 OK', {
    status: response.status,
    keys: Object.keys(json || {}),
    resultKeys: Object.keys(json?.result || {}),
    suggestionsCount: json?.result?.classification?.suggestions?.length || 0,
    isPlantProb: json?.result?.is_plant?.probability,
  });
  const suggestions: KindwiseSuggestion[] = json?.result?.classification?.suggestions || [];
  const top = suggestions[0] || {};
  const isPlant = Number(json?.result?.is_plant?.probability ?? 0);

  const topCommon = top.details?.common_names?.[0];
  const topName = String(topCommon || top.name || '식물 이름 불확실').slice(0, 80);
  const latinName = String(top.name || '').slice(0, 120);
  const probability = pickApiScore(top.probability, top.score, top.confidence, top.similarity);
  logger.info('Kindwise 점수 필드 확인', {
    topKeys: Object.keys(top || {}),
    probability: top.probability ?? null,
    score: top.score ?? null,
    confidence: top.confidence ?? null,
    similarity: top.similarity ?? null,
    selectedScore: probability,
  });
  const taxonomy = top.details?.taxonomy
    ? { family: top.details.taxonomy.family, genus: top.details.taxonomy.genus }
    : undefined;

  const alternativeCandidates = suggestions.slice(1, 4).map((s) => ({
    name: String(s.details?.common_names?.[0] || s.name || '').slice(0, 80),
    latinName: String(s.name || '').slice(0, 120),
    probability: pickApiScore(s.probability, s.score, s.confidence, s.similarity),
  })).filter((c) => c.name);

  return {
    topPlantName: topName,
    latinName,
    identificationProbability: probability,
    isPlantProbability: isPlant,
    alternativeCandidates,
    taxonomy,
    kindwiseUrl: top.details?.url,
  };
}

type GeminiAdviceResult = {
  plantName: string;
  condition: string;
  confidence: 'high' | 'medium' | 'low';
  findings: string[];
  actions: string[];
  warningSigns: string[];
  note: string;
  usage?: { inputTokens: number | null; outputTokens: number | null };
};

async function callGeminiAdvice(
  base64: string,
  mimeType: string,
  apiKey: string,
  identifiedName?: string,
): Promise<GeminiAdviceResult> {
  const nameHint = identifiedName
    ? `\n[참고] 외부 식물 식별 모델은 이 사진을 "${identifiedName}"로 추정했습니다. 이름은 그대로 신뢰하되 상태·관찰·관리 힌트만 사진을 보고 한국어로 답하세요.\n`
    : '';

  const prompt = `당신은 텃밭과 화분 식물을 사진으로 살피는 식물 도우미입니다.
사진에서 보이는 정보만 근거로 식물 상태와 관리 힌트를 한국어로 답하세요.
${nameHint}
[중요 원칙]
- 사진만으로 확정 진단하지 말고 불확실하면 불확실하다고 말하세요.
- 농약·살충제 제품명이나 위험한 처방을 단정하지 마세요.
- 먹을 수 있는 식물/독성 여부는 확정하지 마세요.
- 응급 수준의 병충해나 고사 위험이 의심되면 전문가 상담을 권하세요.
- 응답은 JSON 하나만 출력하고 마크다운은 쓰지 마세요.

[JSON 형식]
{
  "plantName": "${identifiedName ? identifiedName : '가능한 식물 이름 또는 식물 이름 불확실'}",
  "condition": "한 줄 상태 요약",
  "confidence": "high|medium|low",
  "findings": ["사진에서 보이는 관찰 내용 1", "관찰 내용 2"],
  "actions": ["오늘 할 수 있는 관리 힌트 1", "관리 힌트 2"],
  "warningSigns": ["주의해서 다시 볼 신호 1"],
  "note": "사진 분석은 참고용이라는 짧은 안내"
}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = 'gemini-3.1-flash-lite';
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType: mimeType || 'image/jpeg' } },
  ]);
  const usage = getGeminiUsage(result);

  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini 응답에서 JSON을 찾을 수 없습니다.');

  const parsed = JSON.parse(jsonMatch[0]);
  const normalizeList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
      : [];

  const conf = String(parsed?.confidence);
  return {
    plantName: String(parsed?.plantName || identifiedName || '식물 이름 불확실').slice(0, 80),
    condition: String(parsed?.condition || '사진에서 확인 가능한 상태가 제한적입니다.').slice(0, 160),
    confidence: (['high', 'medium', 'low'].includes(conf) ? conf : 'low') as 'high' | 'medium' | 'low',
    findings: normalizeList(parsed?.findings),
    actions: normalizeList(parsed?.actions),
    warningSigns: normalizeList(parsed?.warningSigns),
    note: String(parsed?.note || '사진 분석은 참고용입니다. 상태가 악화되면 전문가에게 상담하세요.').slice(0, 200),
    usage,
  };
}

export const analyzePlantPhoto = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET, KINDWISE_PLANT_ID_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    await enforceRateLimit(request.auth.uid, 'analyzePlantPhoto', 5, 30);

    const { imageBase64, mimeType } = request.data as { imageBase64?: string; mimeType?: string };
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', '이미지 데이터(imageBase64)가 필요합니다.');
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const imageKb = Math.round(cleanBase64.length * 0.75 / 1024);
    if (imageKb > 6 * 1024) {
      throw new HttpsError('invalid-argument', '사진이 너무 큽니다. 더 작은 사진으로 다시 시도해 주세요.');
    }

    const finalMime = mimeType || 'image/jpeg';
    logger.info('analyzePlantPhoto 호출', {
      uid: request.auth.uid.slice(0, 8) + '…',
      imageKb,
      mimeType: finalMime,
    });

    // 1단계: Kindwise 식별 (먼저 식물 이름을 확보해 Gemini 프롬프트에 주입)
    let kindwise: KindwiseIdResult | null = null;
    let kindwiseError: string | undefined;
    try {
      kindwise = await callKindwiseIdentification(cleanBase64, finalMime, KINDWISE_PLANT_ID_API_KEY_SECRET.value());
    } catch (err: any) {
      kindwiseError = err?.message || 'Kindwise 호출 실패';
      // 메시지를 첫 인자에 결합 — Cloud Logging에서 본문 잘림 방지
      logger.warn(`Kindwise 식별 실패 — Gemini 단독 분석으로 진행: ${kindwiseError}`);
    }

    // 2단계: Gemini 해설 (Kindwise 결과를 힌트로 사용)
    let advice: GeminiAdviceResult;
    try {
      advice = await callGeminiAdvice(
        cleanBase64,
        finalMime,
        GEMINI_API_KEY_SECRET.value(),
        kindwise?.topPlantName,
      );
    } catch (err: any) {
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'plant_photo',
        plan: AI_USAGE_PLAN,
        model: 'gemini-3.1-flash-lite',
        inputTokens: null,
        outputTokens: null,
        imageCount: 1,
        externalApiProvider: 'kindwise',
        externalApiCalled: true,
        groundingUsed: false,
        requestId: null,
        success: false,
        errorCode: getAiUsageErrorCode(err),
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      if (err instanceof HttpsError) throw err;
      logger.error('Gemini 해설 실패', { message: err?.message, kindwiseError });
      // Gemini도 실패 — Kindwise만이라도 있으면 최소 응답, 아니면 에러
      if (!kindwise) {
        throw new HttpsError('internal', '식물 사진 분석에 실패했습니다. 사진을 다시 찍어 주세요.');
      }
      advice = {
        plantName: kindwise.topPlantName,
        condition: '해설을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        confidence: 'low',
        findings: [],
        actions: [],
        warningSigns: [],
        note: '사진 분석은 참고용입니다. 상태가 악화되면 전문가에게 상담하세요.',
      };
    }

    // 응답 합치기
    await logAiUsage({
      uid: request.auth.uid,
      featureName: 'plant_photo',
      plan: AI_USAGE_PLAN,
      model: 'gemini-3.1-flash-lite',
      inputTokens: advice.usage?.inputTokens ?? null,
      outputTokens: advice.usage?.outputTokens ?? null,
      imageCount: 1,
      externalApiProvider: 'kindwise',
      externalApiCalled: true,
      groundingUsed: false,
      requestId: null,
      success: true,
      errorCode: null,
      isDev: DEVELOPER_UIDS.has(request.auth.uid),
    });
    return {
      // 표시용 이름: Kindwise top 우선 → Gemini fallback
      plantName: kindwise?.topPlantName || advice.plantName,
      latinName: kindwise?.latinName || '',
      identificationConfidence: kindwise?.identificationProbability ?? null, // 0~1
      isPlantProbability: kindwise?.isPlantProbability ?? null,
      alternativeCandidates: kindwise?.alternativeCandidates || [],
      taxonomy: kindwise?.taxonomy,
      kindwiseUrl: kindwise?.kindwiseUrl,
      // 해설 (Gemini)
      condition: advice.condition,
      confidence: advice.confidence,
      findings: advice.findings,
      actions: advice.actions,
      warningSigns: advice.warningSigns,
      note: advice.note,
      // 메타 (디버깅·UI에서 비표시 가능)
      identifiedBy: kindwise ? 'kindwise' : 'gemini',
      kindwiseError: kindwiseError || null,
    };
  }
);

// ============================================================
// 🌿 detectPlantAdvanced — Plant.id + PlantNet + Gemini 교차검증
// ============================================================
// - Plant.id (Kindwise): 1차 식별 (전세계 도감 + 확률)
// - PlantNet k-world-flora: 2차 교차검증 (다중 사진 활용, 한국 산야초 강세)
// - Gemini: 두 결과를 비교 분석 + 독초/유사종/추가촬영 안내
// - 어느 한 API 실패해도 graceful fallback (남은 결과로 분석 진행)
const ENABLE_KINDWISE_PLANT_ID = false;
const KINDWISE_PLANT_ID_DISABLED_REASON = 'Kindwise Plant.id는 향후 지원금 확보 후 활성화 예정';

type PlantNetCandidate = {
  name: string;
  scientificName: string;
  score: number | null;
  family?: string;
  genus?: string;
};

type PlantNetIdResult = {
  top: PlantNetCandidate | null;
  alternatives: PlantNetCandidate[];
};

async function callPlantNetIdentification(
  images: { base64: string; mimeType: string }[],
  apiKey: string,
): Promise<PlantNetIdResult> {
  if (!apiKey) throw new Error('PLANTNET_API_KEY 없음');
  if (!images.length) throw new Error('PlantNet 호출에 이미지 없음');

  // 프로젝트: k-world-flora (전세계 식물 — 한국 산야초 포함)
  const project = 'k-world-flora';
  const endpoint = `https://my-api.plantnet.org/v2/identify/${project}?api-key=${encodeURIComponent(apiKey)}&lang=en&include-related-images=false&no-reject=false`;

  // PlantNet은 JPEG/PNG/GIF만 허용 — webp가 섞이면 INVALID_ARGUMENT.
  // sharp로 모든 이미지를 안전한 JPEG로 정규화 후 multipart 구성.
  const form = new FormData();
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    let bytes: Buffer;
    try {
      // 입력이 이미 JPEG든 webp/png든 일괄 JPEG로 재인코딩 — 가장 호환성 높은 형식
      bytes = await sharp(Buffer.from(img.base64, 'base64'))
        .rotate() // EXIF orientation 적용
        .jpeg({ quality: 88, mozjpeg: false })
        .toBuffer();
    } catch (e: any) {
      logger.warn(`PlantNet 이미지 ${i + 1} sharp 변환 실패 — 원본 사용: ${e?.message}`);
      bytes = Buffer.from(img.base64, 'base64');
    }
    // Node 20 의 global File 우선 사용 (undici가 multipart에서 가장 정확히 다룸).
    // 일부 환경에서 File이 없을 수 있어 Blob fallback 제공.
    // Buffer/Uint8Array → BlobPart 캐스팅은 TS strict(SharedArrayBuffer 분기) 회피용.
    const blobPart: BlobPart = bytes as unknown as BlobPart;
    let part: any;
    if (typeof (globalThis as any).File === 'function') {
      part = new (globalThis as any).File([blobPart], `image_${i + 1}.jpg`, { type: 'image/jpeg' });
      form.append('images', part);
    } else {
      part = new Blob([blobPart], { type: 'image/jpeg' });
      form.append('images', part, `image_${i + 1}.jpg`);
    }
    // organs=auto — PlantNet이 잎/꽃/줄기/열매 자동 추정. 이미지 개수와 1:1 매핑 유지.
    form.append('organs', 'auto');
  }

  logger.info('PlantNet 요청 시작', {
    project,
    imageCount: images.length,
    apiKeyMasked: apiKey ? `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}` : 'EMPTY',
    hasFileGlobal: typeof (globalThis as any).File === 'function',
  });

  // body 에 FormData 를 그대로 전달 — Content-Type/boundary 는 fetch(undici)가 자동 생성.
  // 수동 Content-Type 헤더 지정 금지 (boundary 깨짐 원인).
  const response = await fetch(endpoint, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    // 실패 원인 분류 — 코드 문제 vs 키/플랜/quota 문제 구분용. API key 값은 로그에 출력 금지.
    let failureCategory: 'auth_invalid_key' | 'auth_forbidden_or_plan' | 'not_found' | 'quota_exceeded' | 'unknown';
    if (response.status === 401) failureCategory = 'auth_invalid_key';
    else if (response.status === 403) failureCategory = 'auth_forbidden_or_plan';
    else if (response.status === 404) failureCategory = 'not_found';
    else if (response.status === 429) failureCategory = 'quota_exceeded';
    else failureCategory = 'unknown';
    logger.error('PlantNet 응답 오류', {
      status: response.status,
      statusText: response.statusText,
      failureCategory,
      bodyPreview: errText.slice(0, 800),
    });
    throw new Error(`PlantNet ${response.status} ${response.statusText} [${failureCategory}]: ${errText.slice(0, 200)}`);
  }
  const json: any = await response.json();
  const results: any[] = Array.isArray(json?.results) ? json.results : [];
  logger.info('PlantNet 응답 OK', {
    resultCount: results.length,
    topScore: results[0]?.score,
  });
  logger.info('PlantNet 점수 필드 확인', {
    topKeys: Object.keys(results[0] || {}),
    score: results[0]?.score ?? null,
    probability: results[0]?.probability ?? null,
    confidence: results[0]?.confidence ?? null,
    similarity: results[0]?.similarity ?? null,
    selectedScore: pickApiScore(
      results[0]?.score,
      results[0]?.probability,
      results[0]?.confidence,
      results[0]?.similarity,
    ),
  });

  const toCandidate = (r: any): PlantNetCandidate => {
    const species = r?.species || {};
    const commonArr = Array.isArray(species.commonNames) ? species.commonNames : [];
    const common = commonArr.length > 0 ? String(commonArr[0]) : '';
    const sci = String(species.scientificNameWithoutAuthor || species.scientificName || '');
    return {
      name: (common || sci || '').slice(0, 80),
      scientificName: sci.slice(0, 120),
      score: pickApiScore(r?.score, r?.probability, r?.confidence, r?.similarity),
      family: species?.family?.scientificNameWithoutAuthor || species?.family?.scientificName || undefined,
      genus: species?.genus?.scientificNameWithoutAuthor || species?.genus?.scientificName || undefined,
    };
  };

  const sorted = [...results].sort((a, b) => {
    const bScore = pickApiScore(b?.score, b?.probability, b?.confidence, b?.similarity) ?? -1;
    const aScore = pickApiScore(a?.score, a?.probability, a?.confidence, a?.similarity) ?? -1;
    return bScore - aScore;
  });
  const top = sorted.length > 0 ? toCandidate(sorted[0]) : null;
  const alternatives = sorted.slice(1, 4).map(toCandidate).filter((c) => c.name);

  return { top, alternatives };
}

// 🌿 학명 → plant_dictionary 캐시 키 정규화 (binomial nomenclature 기준 — author/cultivar 제외)
function normalizeScientificKey(scientific: string): string {
  const s = String(scientific || '').trim();
  if (!s) return '';
  const parts = s.split(/\s+/).filter(Boolean);
  const binomial = parts.slice(0, 2).join(' ');
  return binomial
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

// 🌿 PlantNet 결과 → 한국어명 검정 (plant_dictionary 캐시 우선, miss 시 Gemini 호출)
// 검정 실패 시 koName=null 반환 — 호출 측에서 영어명 fallback 처리 책임.
async function resolveKoreanPlantName(
  scientificName: string,
  englishName: string,
  geminiApiKey: string,
): Promise<{ koName: string | null; scientificKey: string; cached: boolean }> {
  const scientificKey = normalizeScientificKey(scientificName);
  if (!scientificKey) return { koName: null, scientificKey: '', cached: false };

  const ref = db.collection('plant_dictionary').doc(scientificKey);

  try {
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() as any;
      const koNames: string[] = Array.isArray(data?.koNames) ? data.koNames : [];
      const englishNames: string[] = Array.isArray(data?.englishNames) ? data.englishNames : [];
      if (englishName && !englishNames.includes(englishName)) {
        ref.update({
          englishNames: admin.firestore.FieldValue.arrayUnion(englishName),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
      return { koName: koNames[0] || null, scientificKey, cached: true };
    }
  } catch (e: any) {
    logger.warn('plant_dictionary 캐시 조회 실패: ' + (e?.message || ''));
  }

  try {
    const prompt = `다음 식물의 한국어 이름을 알려주세요.

학명: ${scientificName}
영문명: ${englishName || '(없음)'}

Return ONLY valid JSON.
No markdown.
No explanation.

{
  "koName": "...",
  "confidence": 0,
  "isValid": true,
  "note": "..."
}

규칙:
- koName: 한국에서 통용되는 식물 이름 (없으면 빈 문자열)
- confidence: 0~100 신뢰도 (정확하면 90 이상, 추정이면 60~80, 모호하면 60 미만)
- isValid: 위 학명·영문명 매핑이 정확하면 true, 모호하거나 후보가 여러 종이면 false
- note: 짧은 한국어 설명 (없으면 빈 문자열)
- JSON 하나만 출력, 마크다운/코드펜스 금지`;

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('한국어 검정 JSON 파싱 실패', { preview: cleaned.slice(0, 200) });
      return { koName: null, scientificKey, cached: false };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const koName = String(parsed?.koName || '').trim().slice(0, 60);
    const confidence = Number(parsed?.confidence ?? 0);
    const isValid = Boolean(parsed?.isValid);

    if (koName && isValid && confidence >= 70) {
      try {
        await ref.set({
          scientificName,
          englishNames: englishName ? [englishName] : [],
          koNames: [koName],
          verifiedByAI: true,
          confidence,
          source: 'PlantNet',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info('plant_dictionary 저장', { scientificKey, koName, confidence });
      } catch (e: any) {
        logger.warn('plant_dictionary 저장 실패: ' + (e?.message || ''));
      }
      return { koName, scientificKey, cached: false };
    }

    logger.info('한국어 검정 기준 미달', { scientificKey, koName, confidence, isValid });
    return { koName: null, scientificKey, cached: false };
  } catch (e: any) {
    logger.warn('한국어 검정 AI 호출 실패: ' + (e?.message || ''));
    return { koName: null, scientificKey, cached: false };
  }
}

type CrossVerificationResult = {
  finalGuess: string;
  finalLatinName: string;
  analysis: string;
  warning: string;
  edible: 'unknown' | 'yes' | 'no';
  poisonousRisk: boolean;
  similarSpecies: string[];
  needMorePhotos: string[];
  confidence: 'high' | 'medium' | 'low';
  growthStage: string;
  growthStagePercent: number | null;
  healthScore: number | null;
  pestDiseaseWatch: string;
  wateringAdvice: string;
  fertilizerAdvice: string;
  expectedHarvest: string;
  autoDiary: string;
  previousPhotoComparison: string;
  yearOverYearComparison: string;
  careSummary: string;
};

async function callGeminiCrossVerification(
  plantId: KindwiseIdResult | null,
  plantNet: PlantNetIdResult | null,
  images: { base64: string; mimeType: string }[],
  apiKey: string,
): Promise<CrossVerificationResult> {
  // 두 API 결과 요약을 JSON 문자열로 직렬화 (Gemini가 비교 분석)
  const plantIdSummary = plantId
    ? {
        topName: plantId.topPlantName,
        latinName: plantId.latinName,
        confidence: plantId.identificationProbability === null
          ? null
          : Math.round(plantId.identificationProbability * 100) / 100,
        family: plantId.taxonomy?.family,
        genus: plantId.taxonomy?.genus,
        alternatives: plantId.alternativeCandidates.slice(0, 3).map((c) => ({
          name: c.name,
          latinName: c.latinName,
          confidence: c.probability === null ? null : Math.round(c.probability * 100) / 100,
        })),
      }
    : null;

  const plantNetSummary = plantNet
    ? {
        top: plantNet.top
          ? {
              name: plantNet.top.name,
              scientificName: plantNet.top.scientificName,
              confidence: plantNet.top.score === null ? null : Math.round(plantNet.top.score * 100) / 100,
              family: plantNet.top.family,
              genus: plantNet.top.genus,
            }
          : null,
        alternatives: plantNet.alternatives.slice(0, 3).map((c) => ({
          name: c.name,
          scientificName: c.scientificName,
          confidence: c.score === null ? null : Math.round(c.score * 100) / 100,
        })),
      }
    : null;

  const prompt = `당신은 한국 산야초·나물·야생식물·텃밭작물 식별 전문가입니다.
아래 두 외부 식물 식별 모델의 결과와 첨부 사진들을 비교 분석하여 최종 답변을 한국어 JSON으로 제공하세요.

[Plant.id 결과]
${plantIdSummary ? JSON.stringify(plantIdSummary, null, 2) : '(호출 실패 또는 결과 없음)'}

[PlantNet (k-world-flora) 결과]
${plantNetSummary ? JSON.stringify(plantNetSummary, null, 2) : '(호출 실패 또는 결과 없음)'}

[판단 원칙]
- 두 API의 top 결과가 일치(같은 학명/속/과)하면 신뢰도 'high'
- 한쪽만 결과가 있으면 신뢰도는 그 confidence를 그대로 사용
- 두 결과가 다르면 사진을 직접 보고 어느 쪽이 맞는지 판단하되, 한국 산야초 가능성을 우선 고려
- "먹을 수 있다(edible: yes)"는 매우 보수적으로 — 확실하지 않으면 무조건 "unknown"
- 독초 가능성이 조금이라도 있으면 poisonousRisk: true
- 사진이 부족해 보이면 needMorePhotos에 구체적으로 (예: "꽃이 핀 모습", "잎 뒷면 클로즈업")
- JSON 하나만 출력, 마크다운 금지, 코드펜스 금지

[JSON 형식]
{
  "finalGuess": "최종 추정 한국어 이름 (불확실하면 '식물 이름 불확실')",
  "finalLatinName": "학명 (있을 때만)",
  "analysis": "왜 그렇게 판단했는지 2~3문장 한국어 설명",
  "warning": "독초·유사종·주의사항 한 문장 (없으면 빈 문자열)",
  "edible": "unknown | yes | no",
  "poisonousRisk": true | false,
  "similarSpecies": ["유사종1 (구분 포인트)", "유사종2 (구분 포인트)"],
  "needMorePhotos": ["꽃이 핀 모습이 필요합니다", ...],
  "confidence": "high | medium | low",
  "growthStage": "현재 생육단계. 예: 발아기, 활착기, 잎 성장기, 개화기, 열매 비대기, 성숙기, 휴면기, 불확실",
  "growthStagePercent": 0,
  "healthScore": 0,
  "pestDiseaseWatch": "사진에서 보이는 병충해 위험 또는 점검 포인트. 없거나 불확실하면 빈 문자열",
  "wateringAdvice": "물 주는 시기와 방법을 사진 상태 기준으로 한 문장",
  "fertilizerAdvice": "비료 추천을 생육단계 기준으로 한 문장",
  "expectedHarvest": "수확 예상. 수확 작물이 아니거나 불확실하면 빈 문자열",
  "autoDiary": "성장일기 자동 작성용 1~2문장",
  "previousPhotoComparison": "이전 사진이 없으면 '이전 사진이 없어 비교는 다음 촬영부터 가능합니다.'",
  "yearOverYearComparison": "작년 기록이 없으면 '작년 같은 시기 기록이 있으면 성장 속도를 비교할 수 있습니다.'",
  "careSummary": "오늘 사용자가 바로 할 일 1~2문장"
}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

  // 사진들을 모두 첨부 (Gemini는 multi-image 지원)
  const parts: any[] = [prompt];
  for (const img of images.slice(0, 5)) {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType || 'image/jpeg' } });
  }

  const result = await model.generateContent(parts);
  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini 응답에서 JSON을 찾을 수 없습니다.');

  const parsed = JSON.parse(jsonMatch[0]);
  const normList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5) : [];
  const edibleRaw = String(parsed?.edible || 'unknown').toLowerCase();
  const edible: 'unknown' | 'yes' | 'no' = (['unknown', 'yes', 'no'].includes(edibleRaw) ? edibleRaw : 'unknown') as any;
  const confRaw = String(parsed?.confidence || 'low').toLowerCase();
  const confidence: 'high' | 'medium' | 'low' = (['high', 'medium', 'low'].includes(confRaw) ? confRaw : 'low') as any;

  return {
    finalGuess: String(parsed?.finalGuess || '식물 이름 불확실').slice(0, 80),
    finalLatinName: String(parsed?.finalLatinName || '').slice(0, 120),
    analysis: String(parsed?.analysis || '').slice(0, 400),
    warning: String(parsed?.warning || '').slice(0, 200),
    edible,
    poisonousRisk: Boolean(parsed?.poisonousRisk),
    similarSpecies: normList(parsed?.similarSpecies),
    needMorePhotos: normList(parsed?.needMorePhotos),
    confidence,
    growthStage: String(parsed?.growthStage || '').slice(0, 80),
    growthStagePercent: typeof parsed?.growthStagePercent === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.growthStagePercent)))
      : null,
    healthScore: typeof parsed?.healthScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.healthScore)))
      : null,
    pestDiseaseWatch: String(parsed?.pestDiseaseWatch || '').slice(0, 240),
    wateringAdvice: String(parsed?.wateringAdvice || '').slice(0, 240),
    fertilizerAdvice: String(parsed?.fertilizerAdvice || '').slice(0, 240),
    expectedHarvest: String(parsed?.expectedHarvest || '').slice(0, 120),
    autoDiary: String(parsed?.autoDiary || '').slice(0, 320),
    previousPhotoComparison: String(parsed?.previousPhotoComparison || '').slice(0, 240),
    yearOverYearComparison: String(parsed?.yearOverYearComparison || '').slice(0, 240),
    careSummary: String(parsed?.careSummary || '').slice(0, 240),
  };
}

export const detectPlantAdvanced = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET, KINDWISE_PLANT_ID_API_KEY_SECRET, PLANTNET_API_KEY_SECRET],
    memory: '1GiB',
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const rawImages = (request.data as any)?.images;
    if (!Array.isArray(rawImages) || rawImages.length === 0) {
      throw new HttpsError('invalid-argument', '이미지 1장 이상이 필요합니다.');
    }
    if (rawImages.length > 5) {
      throw new HttpsError('invalid-argument', '최대 5장까지 업로드 가능합니다.');
    }

    // base64 정리 (data URI prefix 제거) + 타입 정규화
    const images = rawImages.map((it: any) => {
      const b64 = String(it?.imageBase64 || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      return { base64: b64, mimeType: String(it?.mimeType || 'image/jpeg') };
    }).filter((it) => it.base64.length > 0);

    if (images.length === 0) {
      throw new HttpsError('invalid-argument', '유효한 이미지 데이터가 없습니다.');
    }

    // 총 용량 가드 (≈ base64 75% 비율 = 실제 바이트)
    const totalKb = images.reduce((s, img) => s + Math.round(img.base64.length * 0.75 / 1024), 0);
    if (totalKb > 12 * 1024) {
      throw new HttpsError('invalid-argument', '사진 총 용량이 너무 큽니다 (최대 ~12MB). 압축 후 다시 시도해 주세요.');
    }

    logger.info('detectPlantAdvanced 호출', {
      uid: request.auth.uid.slice(0, 8) + '…',
      imageCount: images.length,
      totalKb,
    });

    // PlantNet 키 가용성 확인 (없으면 graceful skip)
    let plantNetKey = '';
    try {
      plantNetKey = PLANTNET_API_KEY_SECRET.value();
    } catch (_e) {
      plantNetKey = '';
    }

    // Plant.id는 Kindwise 크레딧 확보 후 다시 활성화할 수 있도록 호출부를 보존한다.
    const plantIdPromise: Promise<KindwiseIdResult | null> = ENABLE_KINDWISE_PLANT_ID
      ? callKindwiseIdentification(
          images[0].base64,
          images[0].mimeType,
          KINDWISE_PLANT_ID_API_KEY_SECRET.value(),
        ).catch((e: any) => {
          logger.warn('Plant.id 실패 — 계속 진행: ' + (e?.message || 'unknown'));
          return null;
        })
      : Promise.resolve(null);
    if (!ENABLE_KINDWISE_PLANT_ID) {
      logger.info('Plant.id 호출 생략', {
        plantIdStatus: 'disabled',
        reason: KINDWISE_PLANT_ID_DISABLED_REASON,
      });
    }

    // PlantNet은 모든 이미지를 함께 전달 (정확도 ↑)
    const plantNetPromise: Promise<PlantNetIdResult | null> = plantNetKey
      ? callPlantNetIdentification(images, plantNetKey).catch((e: any) => {
          logger.warn('PlantNet 실패 — 계속 진행: ' + (e?.message || 'unknown'));
          return null;
        })
      : Promise.resolve(null);

    const [plantIdResult, plantNetResult] = await Promise.all([plantIdPromise, plantNetPromise]);

    // Gemini 교차검증
    let cross: CrossVerificationResult | null = null;
    let geminiError: string | undefined;
    try {
      cross = await callGeminiCrossVerification(
        plantIdResult,
        plantNetResult,
        images,
        GEMINI_API_KEY_SECRET.value(),
      );
    } catch (e: any) {
      geminiError = e?.message || 'Gemini 교차검증 실패';
      logger.error('Gemini 교차검증 실패', { message: geminiError });
    }

    // 둘 다 실패 + Gemini도 실패 → 사용자에게 에러
    if (!plantIdResult && !plantNetResult && !cross) {
      await logAiUsage({
        uid: request.auth.uid,
        featureName: 'plant_advanced',
        plan: AI_USAGE_PLAN,
        model: null,
        inputTokens: null,
        outputTokens: null,
        imageCount: images.length,
        externalApiProvider: 'kindwise',
        externalApiCalled: ENABLE_KINDWISE_PLANT_ID,
        groundingUsed: false,
        requestId: null,
        success: false,
        errorCode: geminiError || 'plant_detection_failed',
        isDev: DEVELOPER_UIDS.has(request.auth.uid),
      });
      throw new HttpsError(
        'internal',
        '식물 식별에 실패했습니다. 사진을 다시 찍어 주세요 (잎·꽃·줄기가 모두 보이도록).',
      );
    }

    // 🌿 PlantNet top 결과 → 한국어명 검정 (캐시 우선, 실패 시 영어명 fallback)
    let plantNetKoName: string | null = null;
    let plantNetScientificKey: string | null = null;
    if (plantNetResult?.top?.scientificName) {
      const resolution = await resolveKoreanPlantName(
        plantNetResult.top.scientificName,
        plantNetResult.top.name || '',
        GEMINI_API_KEY_SECRET.value(),
      ).catch((e: any) => {
        logger.warn('한국어명 검정 fallback — ' + (e?.message || ''));
        return { koName: null as string | null, scientificKey: '', cached: false };
      });
      plantNetKoName = resolution.koName;
      plantNetScientificKey = resolution.scientificKey || null;
    }

    const plantIdConfidence = plantIdResult?.identificationProbability ?? null;
    const plantNetConfidence = plantNetResult?.top?.score ?? null;
    logger.info('detectPlantAdvanced 반환 점수 확인', {
      plantIdConfidence,
      plantNetConfidence,
      plantIdAlternativeScores: plantIdResult?.alternativeCandidates.map((c) => c.probability) || [],
      plantNetAlternativeScores: plantNetResult?.alternatives.map((c) => c.score) || [],
    });

    await logAiUsage({
      uid: request.auth.uid,
      featureName: 'plant_advanced',
      plan: AI_USAGE_PLAN,
      model: null,
      inputTokens: null,
      outputTokens: null,
      imageCount: images.length,
      externalApiProvider: 'kindwise',
      externalApiCalled: ENABLE_KINDWISE_PLANT_ID,
      groundingUsed: false,
      requestId: null,
      success: true,
      errorCode: null,
      isDev: DEVELOPER_UIDS.has(request.auth.uid),
    });

    return {
      plantId: plantIdResult
        ? {
            name: plantIdResult.topPlantName,
            latinName: plantIdResult.latinName,
            confidence: plantIdConfidence,
            isPlantProbability: plantIdResult.isPlantProbability,
            family: plantIdResult.taxonomy?.family,
            genus: plantIdResult.taxonomy?.genus,
            alternatives: plantIdResult.alternativeCandidates,
            url: plantIdResult.kindwiseUrl || null,
          }
        : null,
      plantNet: plantNetResult
        ? {
            name: plantNetResult.top?.name || '',
            scientificName: plantNetResult.top?.scientificName || '',
            confidence: plantNetConfidence,
            koName: plantNetKoName,
            scientificKey: plantNetScientificKey,
            family: plantNetResult.top?.family,
            genus: plantNetResult.top?.genus,
            alternatives: plantNetResult.alternatives,
          }
        : null,
      gemini: cross,
      meta: {
        imageCount: images.length,
        plantNetAvailable: Boolean(plantNetKey),
        plantIdStatus: ENABLE_KINDWISE_PLANT_ID ? 'enabled' : 'disabled',
        plantIdDisabledReason: ENABLE_KINDWISE_PLANT_ID ? null : KINDWISE_PLANT_ID_DISABLED_REASON,
        geminiError: geminiError || null,
      },
    };
  },
);

export { getGrammarExplainV2 } from './grammar/grammarV2';

// ===========================================
// 🌿 NIBR (국립생물자원관) 국가생물종목록 Open API 테스트 endpoint
//   - process.env.NIBR_API_KEY 사용 (응답/로그에 절대 노출하지 않음)
//   - process.env.NIBR_TEST_SECRET 으로 헤더 토큰 검증 (개발자 전용 잠금)
//   - 명세 기준: 키 파라미터명 oapiAcsUnqNo / page=1 / responseType=json
//   - 검색어 파라미터는 현재 명세에서 미확인 → 우선 목록 조회만 수행해 응답 구조 확인
//   - 호출 예: curl -H "x-internal-test-secret: $SECRET" \
//             "https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/testNibrPlantSearch?page=1"
// ===========================================
function maskAllSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (typeof s === 'string' && s.length > 0) {
      out = out.split(s).join('***REDACTED***');
    }
  }
  return out;
}

function sanitizeValue(v: any, secrets: string[]): any {
  if (v == null) return v;
  if (typeof v === 'string') return maskAllSecrets(v, secrets);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map((x) => sanitizeValue(x, secrets));
  if (typeof v === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(v)) {
      out[k] = sanitizeValue((v as any)[k], secrets);
    }
    return out;
  }
  return v;
}

export const testNibrPlantSearch = onRequest(
  { region: 'asia-northeast3', timeoutSeconds: 30 },
  async (req, res) => {
    const apiKey = String(process.env.NIBR_API_KEY || '').trim();
    const internalSecret = String(process.env.NIBR_TEST_SECRET || '').trim();
    if (!apiKey) {
      logger.error('NIBR_API_KEY missing in functions env');
      res.status(500).json({ ok: false, error: 'NIBR_API_KEY missing' });
      return;
    }
    if (!internalSecret) {
      logger.warn('NIBR_TEST_SECRET missing — endpoint locked');
      res.status(503).json({
        ok: false,
        error: 'NIBR_TEST_SECRET not configured; endpoint locked',
      });
      return;
    }

    // 내부 개발용 토큰 검증 (constant-time compare)
    const headerSecret = String(req.get('x-internal-test-secret') || '');
    const a = Buffer.from(headerSecret, 'utf8');
    const b = Buffer.from(internalSecret, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      logger.warn('NIBR test unauthorized', {
        ip: req.ip || null,
        ua: req.get('user-agent') || null,
      });
      res.status(403).json({ ok: false, error: 'forbidden' });
      return;
    }

    const secretsToMask = [apiKey, internalSecret];

    const pageRaw = typeof req.query.page === 'string' ? req.query.page.trim() : '';
    const page = /^\d+$/.test(pageRaw) ? Number(pageRaw) : 1;
    const endpoint = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';

    try {
      const response = await axios.get(endpoint, {
        params: {
          oapiAcsUnqNo: apiKey,
          page,
          responseType: 'json',
        },
        responseType: 'text',
        validateStatus: () => true,
        timeout: 15_000,
      });
      const httpStatus = response.status;
      const contentType = String(response.headers['content-type'] || '');
      const rawRaw =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data || {});
      const responseLength = rawRaw.length;
      const snippetMasked = maskAllSecrets(rawRaw.slice(0, 1500), secretsToMask);

      // JSON 파싱은 원본(rawRaw)으로 수행 — 파싱 결과는 sanitizeValue로 한 번 더 마스킹
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(rawRaw);
      } catch {
        /* not JSON — XML 가능성 */
      }

      // 응답 raw에서 명세 필드명 키워드 검출 (대표국명/학명/KTSN/관련분류군/정명·이명)
      const detected = {
        대표국명: /대표국명|repKorNm|repKorName|kor_nm|korNm/i.test(rawRaw),
        학명: /학명|scientificName|sciNm|sci_nm|scName/i.test(rawRaw),
        KTSN: /\bktsn\b|국가생물종번호|ktsnNo|ktsnId/i.test(rawRaw),
        관련분류군: /관련분류군|relatedTaxon|relTaxon|taxonGroup/i.test(rawRaw),
        정명이명: /정명|이명|namestatus|validity|accepted|synonym/i.test(rawRaw),
      };

      // 가능한 경우 항목 배열을 찾아 첫 항목 + 키 목록 노출
      let foundArrayPath: string | null = null;
      let firstItem: any = null;
      let itemCount: number | null = null;
      let itemKeys: string[] = [];
      if (parsedJson && typeof parsedJson === 'object') {
        const candidatePaths: Array<{ path: string; value: any }> = [
          { path: 'result.item', value: parsedJson?.result?.item },
          { path: 'result.items', value: parsedJson?.result?.items },
          { path: 'items', value: parsedJson?.items },
          { path: 'data.item', value: parsedJson?.data?.item },
          { path: 'data.items', value: parsedJson?.data?.items },
          { path: 'data.list', value: parsedJson?.data?.list },
          { path: 'response.body.items.item', value: parsedJson?.response?.body?.items?.item },
          { path: 'body.items', value: parsedJson?.body?.items },
          { path: 'list', value: parsedJson?.list },
        ];
        for (const c of candidatePaths) {
          if (Array.isArray(c.value) && c.value.length > 0) {
            foundArrayPath = c.path;
            firstItem = c.value[0];
            itemCount = c.value.length;
            break;
          }
        }
        if (firstItem && typeof firstItem === 'object') {
          itemKeys = Object.keys(firstItem);
        }
      }

      // 로그: 키 노출 없이 메타데이터만
      logger.info('NIBR test response', {
        page,
        httpStatus,
        contentType,
        responseLength,
        detected,
        foundArrayPath,
        itemCount,
        itemKeys,
      });

      const sanitizedFirstItem = firstItem
        ? sanitizeValue(firstItem, secretsToMask)
        : null;

      res.status(200).json({
        ok: true,
        page,
        endpoint,
        params: { oapiAcsUnqNo: '***REDACTED***', page, responseType: 'json' },
        nibrStatus: httpStatus,
        contentType,
        responseLength,
        snippet: snippetMasked,
        topLevelKeys:
          parsedJson && typeof parsedJson === 'object' ? Object.keys(parsedJson) : null,
        foundArrayPath,
        itemCount,
        itemKeys,
        detected,
        parsedFirstItem: sanitizedFirstItem,
      });
    } catch (err: any) {
      logger.error('NIBR test call failed', {
        message: err?.message || String(err),
        code: err?.code || null,
      });
      res.status(500).json({
        ok: false,
        page,
        endpoint,
        error: err?.message || 'NIBR call failed',
        code: err?.code || null,
      });
    }
  },
);

// ===========================================
// 🪟 OneDrive 연결 1단계 (Step 1)
//   목표: Microsoft 로그인 → 사용자별 OneDrive 연결 상태 저장 → /HARU2026 폴더 생성
//   이번 단계 금지: 파일 복사 / 이동 / AI 자동분류 / assetIndex 생성
//   env: process.env.MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_REDIRECT_URI(선택, 미설정 시 기본값)
//   token 저장 위치: users/{uid}/cloudConnections/oneDrive (서버 전용, 프론트 직접 접근 X)
// ===========================================
const ONEDRIVE_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const ONEDRIVE_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const ONEDRIVE_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const ONEDRIVE_HARU_FOLDER_NAME = 'HARU2026';
const ONEDRIVE_HARU_FOLDER_PATH = '/HARU2026';

function getOneDriveEnv(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || ONEDRIVE_REDIRECT_URI;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

async function ensureHaruFolderOnOneDrive(accessToken: string): Promise<{ folderId: string; folderPath: string }> {
  // 1) 기존 폴더 조회 (중복 생성 방지)
  try {
    const existing = await axios.get(
      `${ONEDRIVE_GRAPH_BASE}/me/drive/root:${ONEDRIVE_HARU_FOLDER_PATH}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true,
        timeout: 15_000,
      },
    );
    if (existing.status === 200 && existing.data?.id) {
      return { folderId: existing.data.id as string, folderPath: ONEDRIVE_HARU_FOLDER_PATH };
    }
  } catch {
    /* fall through to create */
  }
  // 2) 신규 생성 (conflictBehavior: fail → 409면 race condition으로 간주하고 재조회)
  try {
    const created = await axios.post(
      `${ONEDRIVE_GRAPH_BASE}/me/drive/root/children`,
      {
        name: ONEDRIVE_HARU_FOLDER_NAME,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
        timeout: 15_000,
      },
    );
    if (created.status === 201 && created.data?.id) {
      return { folderId: created.data.id as string, folderPath: ONEDRIVE_HARU_FOLDER_PATH };
    }
    if (created.status === 409) {
      // race or hidden conflict — 재조회 시도
      const re = await axios.get(
        `${ONEDRIVE_GRAPH_BASE}/me/drive/root:${ONEDRIVE_HARU_FOLDER_PATH}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, validateStatus: () => true, timeout: 15_000 },
      );
      if (re.status === 200 && re.data?.id) {
        return { folderId: re.data.id as string, folderPath: ONEDRIVE_HARU_FOLDER_PATH };
      }
    }
    throw new Error(`folder create failed: status ${created.status}`);
  } catch (e: any) {
    throw new Error(`folder create error: ${e?.message || 'unknown'}`);
  }
}

// 1) OAuth 시작 — authUrl 반환 (callable, uid 확인)
export const startOneDriveConnect = onCall(
  { region: 'asia-northeast3', secrets: [MICROSOFT_CLIENT_ID_SECRET, MICROSOFT_CLIENT_SECRET_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const env = getOneDriveEnv();
    if (!env) {
      logger.warn('OneDrive env missing — MICROSOFT_CLIENT_ID/SECRET not configured');
      throw new HttpsError(
        'failed-precondition',
        'OneDrive 연결이 아직 설정되지 않았습니다.',
      );
    }
    const state = crypto.randomBytes(32).toString('hex');
    await db.collection('oauth_states').doc(state).set({
      provider: 'oneDrive',
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
    });
    const params = new URLSearchParams({
      client_id: env.clientId,
      response_type: 'code',
      redirect_uri: env.redirectUri,
      scope: ONEDRIVE_OAUTH_SCOPE,
      response_mode: 'query',
      state,
    });
    return { authUrl: `${ONEDRIVE_AUTH_URL}?${params.toString()}` };
  },
);

// 2) OAuth callback — Microsoft 가 호출 → token 교환 → 폴더 생성 → Firestore 저장 → 프론트 redirect
export const oneDriveCallback = onRequest(
  { region: 'asia-northeast3', timeoutSeconds: 60, secrets: [MICROSOFT_CLIENT_ID_SECRET, MICROSOFT_CLIENT_SECRET_SECRET] },
  async (req, res) => {
    try {
      const env = getOneDriveEnv();
      if (!env) {
        logger.warn('OneDrive callback: env missing');
        res.redirect(`${FRONTEND_URL}/asset-explorer?onedrive=error`);
        return;
      }
      const { code, state } = req.query;
      if (req.query.error) {
        logger.error('OneDrive callback: Microsoft returned error — ' + String(req.query.error) + ' / ' + String(req.query.error_description || ''));
        res.redirect(`${FRONTEND_URL}/asset-explorer?onedrive=error`);
        return;
      }
      if (!code || typeof code !== 'string') throw new Error('missing code');
      if (!state || typeof state !== 'string') throw new Error('missing state');

      const stateDoc = await db.collection('oauth_states').doc(state).get();
      if (!stateDoc.exists) throw new Error('state not found');
      const stateData = stateDoc.data();
      if (!stateData) throw new Error('state empty');
      if (stateData.provider !== 'oneDrive') throw new Error('provider mismatch');
      if (stateData.expiresAt?.toMillis?.() < Date.now()) throw new Error('state expired');
      const uid = stateData.uid as string | undefined;
      if (!uid) throw new Error('uid missing in state');
      await stateDoc.ref.delete();

      // token 교환
      const tokenForm = new URLSearchParams({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.redirectUri,
        scope: ONEDRIVE_OAUTH_SCOPE,
      });
      const tokenRes = await axios.post(ONEDRIVE_TOKEN_URL, tokenForm.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true,
        timeout: 20_000,
      });
      if (tokenRes.status !== 200 || !tokenRes.data?.access_token) {
        logger.error('OneDrive token exchange failed — status=' + tokenRes.status + ' error=' + String(tokenRes.data?.error) + ' desc=' + String(tokenRes.data?.error_description || ''));
        throw new Error('token exchange failed');
      }
      const accessToken: string = tokenRes.data.access_token;
      const refreshToken: string | null = tokenRes.data.refresh_token || null;
      const expiresInSec: number = Number(tokenRes.data.expires_in) || 3600;
      const tokenExpiresAt = admin.firestore.Timestamp.fromMillis(
        Date.now() + expiresInSec * 1000,
      );

      // /HARU2026 폴더 생성 (또는 기존 사용)
      let folderId: string | null = null;
      let folderPath: string | null = null;
      try {
        const ensured = await ensureHaruFolderOnOneDrive(accessToken);
        folderId = ensured.folderId;
        folderPath = ensured.folderPath;
      } catch (e: any) {
        logger.error('OneDrive folder ensure failed', { message: e?.message || String(e) });
      }

      // Firestore 저장 — users/{uid}/cloudConnections/oneDrive
      const docRef = db.doc(`users/${uid}/cloudConnections/oneDrive`);
      await docRef.set(
        {
          provider: 'oneDrive',
          connected: true,
          status: folderId ? 'connected' : 'connected_no_folder',
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
          folderPath: folderPath || ONEDRIVE_HARU_FOLDER_PATH,
          folderId: folderId || null,
          scope: ONEDRIVE_OAUTH_SCOPE,
          accessToken,
          refreshToken,
          tokenExpiresAt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      res.redirect(`${FRONTEND_URL}/asset-explorer?onedrive=connected`);
    } catch (error: any) {
      logger.error('OneDrive callback failed — ' + (error?.message || String(error)));
      res.redirect(`${FRONTEND_URL}/asset-explorer?onedrive=error`);
    }
  },
);

// 3) HARU 폴더 보장 (멱등) — callable, 이미 있으면 기존 폴더 사용
export const ensureOneDriveHaruFolder = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const docRef = db.doc(`users/${uid}/cloudConnections/oneDrive`);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'OneDrive 연결이 필요합니다.');
    }
    const data = snap.data();
    const accessToken = data?.accessToken as string | undefined;
    if (!accessToken) {
      throw new HttpsError('failed-precondition', 'OneDrive 액세스 정보가 없습니다.');
    }
    try {
      const ensured = await ensureHaruFolderOnOneDrive(accessToken);
      await docRef.set(
        {
          folderId: ensured.folderId,
          folderPath: ensured.folderPath,
          status: 'connected',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { folderId: ensured.folderId, folderPath: ensured.folderPath };
    } catch (e: any) {
      logger.error('ensureOneDriveHaruFolder failed', { message: e?.message || String(e) });
      throw new HttpsError('internal', 'HARU 폴더 준비에 실패했습니다.');
    }
  },
);

// 4) 연결 상태 조회 — 토큰 없이 boolean + folder 상태만 반환
export const getOneDriveConnectionState = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const snap = await db.doc(`users/${uid}/cloudConnections/oneDrive`).get();
    if (!snap.exists) {
      return { connected: false, folderReady: false, folderPath: null };
    }
    const data = snap.data();
    const connected = Boolean(data?.connected && data?.accessToken);
    const folderReady = Boolean(data?.folderId);
    const folderPath = (data?.folderPath as string | null) || null;
    return { connected, folderReady, folderPath };
  },
);

// 5) 최근 자산 추천 + 가져오기 (Google Drive 미러링)
//   getOneDriveCandidates: Graph /me/drive/recent → 후보 필터 → 최대 20개
//   copyOneDriveAssets: 선택 파일 /HARU2026 복사(202 비동기) + assets 색인(status pending_copy)
function isOneDriveAssetCandidate(item: any): boolean {
  if (!item || item.folder) return false;
  const mt = item.file?.mimeType || '';
  return (
    mt === 'application/pdf' ||
    mt.startsWith('image/') ||
    mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mt === 'application/msword' ||
    mt === 'application/vnd.ms-excel' ||
    mt === 'application/vnd.ms-powerpoint'
  );
}

function getOneDriveFileKind(mt: string): string {
  if (mt === 'application/pdf') return 'PDF';
  if (mt.startsWith('image/')) return '이미지';
  if (mt.includes('wordprocessingml') || mt === 'application/msword') return '문서';
  if (mt.includes('spreadsheetml') || mt === 'application/vnd.ms-excel') return '스프레드시트';
  if (mt.includes('presentationml') || mt === 'application/vnd.ms-powerpoint') return '프레젠테이션';
  return '파일';
}

async function refreshOneDriveAccessToken(uid: string, data: any): Promise<string> {
  const expiresAt = data?.tokenExpiresAt?.toMillis?.() || 0;
  if (data?.accessToken && expiresAt > Date.now() + 60 * 1000) {
    return data.accessToken as string;
  }
  if (!data?.refreshToken) {
    throw new HttpsError('failed-precondition', 'OneDrive 연결이 만료되었습니다. 다시 연결해 주세요.');
  }
  const env = getOneDriveEnv();
  if (!env) {
    throw new HttpsError('failed-precondition', 'OneDrive 연결이 아직 설정되지 않았습니다.');
  }
  const form = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: data.refreshToken,
    grant_type: 'refresh_token',
    redirect_uri: env.redirectUri,
    scope: ONEDRIVE_OAUTH_SCOPE,
  });
  const res = await axios.post(ONEDRIVE_TOKEN_URL, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
    timeout: 20_000,
  });
  if (res.status !== 200 || !res.data?.access_token) {
    logger.error('OneDrive token refresh failed — status=' + res.status + ' error=' + String(res.data?.error) + ' desc=' + String(res.data?.error_description || ''));
    throw new HttpsError('failed-precondition', 'OneDrive 연결이 만료되었습니다. 다시 연결해 주세요.');
  }
  const accessToken: string = res.data.access_token;
  const newRefresh: string = res.data.refresh_token || data.refreshToken;
  const expiresInSec: number = Number(res.data.expires_in) || 3600;
  await db.doc(`users/${uid}/cloudConnections/oneDrive`).set(
    {
      accessToken,
      refreshToken: newRefresh,
      tokenExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + expiresInSec * 1000),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return accessToken;
}

async function getOneDriveAccessToken(uid: string): Promise<string> {
  const snap = await db.doc(`users/${uid}/cloudConnections/oneDrive`).get();
  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'OneDrive 연결이 필요합니다.');
  }
  return refreshOneDriveAccessToken(uid, snap.data());
}

export const getOneDriveCandidates = onCall(
  { region: 'asia-northeast3', secrets: [MICROSOFT_CLIENT_ID_SECRET, MICROSOFT_CLIENT_SECRET_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const accessToken = await getOneDriveAccessToken(uid);
    const res = await axios.get(`${ONEDRIVE_GRAPH_BASE}/me/drive/recent`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { $top: 40 },
      validateStatus: () => true,
      timeout: 20_000,
    });
    if (res.status !== 200) {
      logger.error('OneDrive recent list failed — status=' + res.status);
      throw new HttpsError('internal', '최근 자산 후보를 불러오지 못했습니다.');
    }
    const items = (res.data?.value || []) as any[];
    const candidates = items
      .filter(isOneDriveAssetCandidate)
      .slice(0, 20)
      .map((item) => {
        const mt = item.file?.mimeType || '';
        return {
          id: item.id as string,
          name: (item.name as string) || '이름 없는 파일',
          mimeType: mt,
          modifiedTime: (item.lastModifiedDateTime as string) || '',
          webViewLink: (item.webUrl as string) || '',
          thumbnailLink: '',
          iconLink: '',
          kind: getOneDriveFileKind(mt),
        };
      });
    return { candidates };
  },
);

export const copyOneDriveAssets = onCall(
  { region: 'asia-northeast3', secrets: [MICROSOFT_CLIENT_ID_SECRET, MICROSOFT_CLIENT_SECRET_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const fileIds = Array.isArray(request.data?.fileIds)
      ? (request.data.fileIds as unknown[]).filter((id) => typeof id === 'string' && (id as string).trim()) as string[]
      : [];
    if (fileIds.length === 0) {
      throw new HttpsError('invalid-argument', '가져올 파일을 선택해 주세요.');
    }
    if (fileIds.length > 20) {
      throw new HttpsError('invalid-argument', '한 번에 최대 20개까지 가져올 수 있습니다.');
    }
    const accessToken = await getOneDriveAccessToken(uid);
    const folder = await ensureHaruFolderOnOneDrive(accessToken);

    let requestedCount = 0;
    for (const fileId of fileIds) {
      const srcRes = await axios.get(
        `${ONEDRIVE_GRAPH_BASE}/me/drive/items/${encodeURIComponent(fileId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, validateStatus: () => true, timeout: 20_000 },
      );
      if (srcRes.status !== 200 || !srcRes.data?.id) continue;
      const src = srcRes.data;
      if (!isOneDriveAssetCandidate(src)) continue;

      const copyRes = await axios.post(
        `${ONEDRIVE_GRAPH_BASE}/me/drive/items/${encodeURIComponent(fileId)}/copy`,
        { parentReference: { id: folder.folderId }, name: src.name },
        {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          validateStatus: () => true,
          timeout: 20_000,
        },
      );
      const accepted = copyRes.status === 202 || copyRes.status === 200;
      const monitorUrl: string | null = (copyRes.headers?.location as string) || null;
      const mt = src.file?.mimeType || '';

      const assetRef = db.collection('users').doc(uid).collection('assets').doc(src.id as string);
      const now = admin.firestore.FieldValue.serverTimestamp();
      await assetRef.set(
        {
          title: src.name || '이름 없는 파일',
          mimeType: mt,
          source: 'onedrive',
          oneDriveItemId: src.id,
          sourceOneDriveItemId: src.id,
          driveUrl: src.webUrl || '',
          copyMonitorUrl: monitorUrl,
          status: accepted ? 'pending_copy' : 'copy_failed',
          folderPath: folder.folderPath,
          createdAt: now,
          updatedAt: now,
          tags: [],
          haruFolder: true,
          kind: getOneDriveFileKind(mt),
          thumbnailLink: '',
          iconLink: '',
        },
        { merge: true },
      );
      if (accepted) requestedCount += 1;
    }

    return { copiedCount: requestedCount };
  },
);

// ===========================================
// 🌿 국내 생물종(NIBR) 보강 — getKoreanPlantInfo
//   목적: PlantNet/Plant.id 판독 결과의 scientificName을 받아
//         NIBR 국가생물종지식정보시스템에서 한국어 국명/분류정보를 보강 조회.
//   원칙: 보강 정보 전용. 실패 시 throw 대신 fallback 응답으로 기존 흐름 무영향.
//   금지: public onRequest 노출 / 캐시 / mock / 키 echo / NIBR 결과를 사용자 확정값으로 저장.
//   Secret: defineSecret('NIBR_API_KEY')
//     - 미등록 시 status: "not_configured" 반환 (이번 1차 배포 dry-run 상태)
// ===========================================
const NIBR_API_KEY_SECRET = defineSecret('NIBR_API_KEY');

type NibrMatchStatus =
  | 'matched'
  | 'not_found'
  | 'api_unavailable'
  | 'not_configured';

type KoreanPlantInfoResponse = {
  koreanName: string | null;
  scientificName: string | null;
  phylumName: string | null;
  className: string | null;
  orderName: string | null;
  familyName: string | null;
  genusName: string | null;
  speciesKoreanName: string | null;
  source: 'NIBR';
  rawMatched: boolean;
  status: NibrMatchStatus;
};

function nibrPickString(...values: any[]): string | null {
  for (const v of values) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return null;
}

function nibrNormalizeSci(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function nibrExtractArray(parsed: any): any[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const candidates: any[] = [
    parsed?.data?.content, // ★ NIBR ktsn/taxons/search 공식 명세 (v1)
    parsed?.result?.item,
    parsed?.result?.items,
    parsed?.items,
    parsed?.data?.item,
    parsed?.data?.items,
    parsed?.data?.list,
    parsed?.response?.body?.items?.item,
    parsed?.body?.items,
    parsed?.list,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

// NIBR stnm은 권위명·연도가 붙는 형식("Cucurbita maxima Duchesne 1786") — 첫 두 토큰(속명+종소명)만 비교
function nibrSciBinomial(sci: string): string {
  const tokens = sci.trim().toLowerCase().replace(/\s+/g, ' ').split(' ');
  return tokens.slice(0, 2).join(' ');
}

function nibrEmptyResponse(status: NibrMatchStatus): KoreanPlantInfoResponse {
  return {
    koreanName: null,
    scientificName: null,
    phylumName: null,
    className: null,
    orderName: null,
    familyName: null,
    genusName: null,
    speciesKoreanName: null,
    source: 'NIBR',
    rawMatched: false,
    status,
  };
}

export const getKoreanPlantInfo = onCall(
  {
    region: 'asia-northeast3',
    secrets: [NIBR_API_KEY_SECRET],
    timeoutSeconds: 20,
  },
  async (request): Promise<KoreanPlantInfoResponse> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    // 🇰🇷 NIBR 보강은 관리자(허대표) 전용 — 비관리자는 NIBR 호출 자체를 차단
    if (!isInternalAdminUid(uid)) {
      throw new HttpsError('permission-denied', '관리자 전용 기능입니다.');
    }

    const sciInput = String(request.data?.scientificName || '').trim();
    if (!sciInput) {
      return nibrEmptyResponse('not_found');
    }

    // Secret 미등록 fallback (1차 dry-run 정상 경로)
    let apiKey = '';
    try {
      apiKey = String(NIBR_API_KEY_SECRET.value() || '').trim();
    } catch {
      apiKey = '';
    }
    if (!apiKey) {
      logger.warn('NIBR_API_KEY not configured — enrichment skipped');
      return nibrEmptyResponse('not_configured');
    }
    const endpoint = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';

    try {
      const response = await axios.get(endpoint, {
        params: {
          oapiAcsUnqNo: apiKey,
          page: 1,
          responseType: 'json',
        },
        responseType: 'text',
        validateStatus: () => true,
        timeout: 15_000,
      });
      const httpStatus = response.status;
      const rawRaw =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data || {});

      // 응답에서 NIBR errorCode 추출 (진단용 — 키 값은 절대 포함 X)
      let parsedForDiag: any = null;
      try {
        parsedForDiag = JSON.parse(rawRaw);
      } catch {
        /* not JSON — XML 가능성 */
      }
      const nibrErrorCode: string | null =
        parsedForDiag && typeof parsedForDiag === 'object'
          ? parsedForDiag.errorCode || null
          : null;

      // 신청 미완료 / 권한 오류 — fallback (throw 금지)
      const unavailableSignals = /APLY_NOT_FOUND|APLY_NOT_APRV|INVLD_API_KEY|UNAUTHORIZED|FORBIDDEN/i;
      if (
        httpStatus === 401 ||
        httpStatus === 403 ||
        httpStatus === 404 ||
        unavailableSignals.test(rawRaw)
      ) {
        logger.warn('NIBR enrichment unavailable', {
          httpStatus,
          nibrErrorCode,
        });
        return nibrEmptyResponse('api_unavailable');
      }
      if (httpStatus >= 400) {
        logger.warn('NIBR enrichment http error', {
          httpStatus,
          nibrErrorCode,
        });
        return nibrEmptyResponse('api_unavailable');
      }

      const parsed: any = parsedForDiag;
      if (!parsed) {
        return nibrEmptyResponse('api_unavailable');
      }

      const items = nibrExtractArray(parsed);
      if (items.length === 0) {
        logger.warn('NIBR response had no items array', {
          topLevelKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : null,
        });
        return nibrEmptyResponse('not_found');
      }

      const target = nibrSciBinomial(sciInput);
      let matched: any = null;
      for (const it of items) {
        // 1) stnm 첫 두 토큰(속명+종소명)
        const stnm = nibrPickString(it?.stnm, it?.scientificName);
        if (stnm && nibrSciBinomial(stnm) === target) {
          matched = it;
          break;
        }
        // 2) gnusKtsnLtnNm + specsKtsnLtnNm 조합
        const gnusL = nibrPickString(it?.gnusKtsnLtnNm);
        const specsL = nibrPickString(it?.specsKtsnLtnNm);
        if (gnusL && specsL && nibrSciBinomial(`${gnusL} ${specsL}`) === target) {
          matched = it;
          break;
        }
      }
      if (!matched) {
        logger.info('NIBR no binomial match in this page', {
          targetBinomial: target,
          itemsCount: items.length,
        });
        return nibrEmptyResponse('not_found');
      }

      // NIBR 명세 (ktsn taxons search) 우선 + 구버전/유사 키 후보 보존
      const koreanName = nibrPickString(
        matched?.ktsnKrnNm,
        matched?.kornm,
        matched?.korNm,
        matched?.kor_nm,
        matched?.repKorNm,
        matched?.repKorName,
        matched?.koreanName,
      );
      const speciesKoreanName =
        nibrPickString(
          matched?.specsKtsnKrnNm,
          matched?.specKorNm,
          matched?.species_kor,
          matched?.speciesKoreanName,
        ) || koreanName;
      const sciFinal = (() => {
        // 깨끗한 binomial 우선: gnusLtn + specsLtn
        const gnusL = nibrPickString(matched?.gnusKtsnLtnNm);
        const specsL = nibrPickString(matched?.specsKtsnLtnNm);
        if (gnusL && specsL) return `${gnusL} ${specsL}`;
        return nibrPickString(
          matched?.stnm,
          matched?.ktsnLtnNm,
          matched?.scientificName,
          matched?.sciNm,
        );
      })();
      const phylumName = nibrPickString(
        matched?.phlmKtsnKrnNm,
        matched?.phlmKtsnLtnNm,
        matched?.phylumName,
        matched?.phylumKornm,
        matched?.phylumKorNm,
        matched?.phylum,
      );
      const className = nibrPickString(
        matched?.classKtsnKrnNm,
        matched?.classKtsnLtnNm,
        matched?.className,
        matched?.classKornm,
        matched?.classKorNm,
        matched?.classNm,
      );
      const orderName = nibrPickString(
        matched?.orderKtsnKrnNm,
        matched?.orderKtsnLtnNm,
        matched?.orderName,
        matched?.orderKornm,
        matched?.orderKorNm,
        matched?.ordNm,
      );
      const familyName = nibrPickString(
        matched?.fmlyKtsnKrnNm,
        matched?.fmlyKtsnLtnNm,
        matched?.familyName,
        matched?.familyKornm,
        matched?.familyKorNm,
        matched?.famNm,
      );
      const genusName = nibrPickString(
        matched?.gnusKtsnKrnNm,
        matched?.gnusKtsnLtnNm,
        matched?.genusName,
        matched?.genusKornm,
        matched?.genusKorNm,
        matched?.genNm,
      );

      return {
        koreanName,
        scientificName: sciFinal,
        phylumName,
        className,
        orderName,
        familyName,
        genusName,
        speciesKoreanName,
        source: 'NIBR',
        rawMatched: true,
        status: 'matched',
      };
    } catch (err: any) {
      logger.warn('NIBR enrichment call failed', {
        message: err?.message || String(err),
      });
      return nibrEmptyResponse('api_unavailable');
    }
  },
);

// ===== 📁 보조장부 영수증 → 구글 드라이브 자동 업로드 =====
const DRIVE_ROOT_FOLDER_ID = '1mzrd3lgMRrCBRCowN0VfmvKhE_5IyJ9X';

async function getDriveClient(serviceAccountJson: string) {
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return google.drive({ version: 'v3', auth });
}

async function findDriveFolder(
  driveClient: ReturnType<typeof google.drive>,
  name: string,
  parentId: string,
): Promise<string | null> {
  const res = await driveClient.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createDriveFolder(
  driveClient: ReturnType<typeof google.drive>,
  name: string,
  parentId: string,
): Promise<string> {
  const res = await driveClient.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return res.data.id!;
}

async function getOrCreateMonthFolder(
  driveClient: ReturnType<typeof google.drive>,
  year: string,
  month: string,
): Promise<string> {
  let yearFolderId = await findDriveFolder(driveClient, year, DRIVE_ROOT_FOLDER_ID);
  if (!yearFolderId) yearFolderId = await createDriveFolder(driveClient, year, DRIVE_ROOT_FOLDER_ID);

  const monthLabel = `${month}월`;
  let monthFolderId = await findDriveFolder(driveClient, monthLabel, yearFolderId);
  if (!monthFolderId) monthFolderId = await createDriveFolder(driveClient, monthLabel, yearFolderId);

  return monthFolderId;
}

export const uploadReceiptToDrive = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GOOGLE_DRIVE_SERVICE_ACCOUNT_SECRET],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { imageUrls, date, merchant, category, amount } = request.data as {
      imageUrls: string[];
      date: string;
      merchant: string;
      category: string;
      amount: string | number;
    };

    if (!imageUrls?.length || !date) {
      throw new HttpsError('invalid-argument', 'imageUrls와 date는 필수입니다.');
    }

    const year = date.substring(0, 4);
    const month = date.substring(5, 7);
    const dateCompact = date.replace(/-/g, '');
    const safeMerchant = (merchant || '').replace(/[/\\?%*:|"<>]/g, '_').substring(0, 20);
    const safeCategory = (category || '').replace(/[/\\?%*:|"<>]/g, '_').substring(0, 20);

    const serviceAccountJson = GOOGLE_DRIVE_SERVICE_ACCOUNT_SECRET.value();
    const driveClient = await getDriveClient(serviceAccountJson);
    const folderId = await getOrCreateMonthFolder(driveClient, year, month);

    const { Readable } = await import('stream');
    const results: { fileId: string | null | undefined; webViewLink: string | null | undefined; fileName: string }[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const suffix = imageUrls.length > 1 ? `_${i + 1}` : '';
      const fileName = `${dateCompact}_${safeMerchant}_${safeCategory}_${amount}${suffix}.png`;

      const imageRes = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imageRes.data);
      const stream = Readable.from(buffer);

      const uploadRes = await driveClient.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType: 'image/png', body: stream },
        fields: 'id,webViewLink',
      });

      results.push({ fileId: uploadRes.data.id, webViewLink: uploadRes.data.webViewLink, fileName });
    }

    return { results };
  },
);

export { exportEpub } from './epubExport';

// ─────────────────────────────────────────
// 반려동물 식품 안전 확인 (petFoodCheck)
// ─────────────────────────────────────────
export const petFoodCheck = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await enforceRateLimit(uid, 'petFoodCheck', 5, 30);

    const { foodName } = request.data as { foodName: string };
    if (!foodName || foodName.trim().length === 0) {
      throw new HttpsError('invalid-argument', '식품명을 입력해주세요.');
    }

    type PetFoodItem = {
      nameKo: string[];
      nameEn: string[];
      riskLevel: string;
      answer: string;
      reason: string;
      symptoms?: string[];
      emergency: boolean;
      source: string;
    };

    const DB: PetFoodItem[] = [
      { nameKo: ['포도', '건포도'], nameEn: ['grape', 'raisin'], riskLevel: 'emergency', answer: '절대 금지', reason: '신장 손상 유발, 소량도 치명적', symptoms: ['구토', '무기력', '신부전'], emergency: true, source: 'ASPCA' },
      { nameKo: ['초콜릿'], nameEn: ['chocolate'], riskLevel: 'emergency', answer: '절대 금지', reason: '테오브로민 중독', symptoms: ['구토', '경련', '심부전'], emergency: true, source: 'ASPCA' },
      { nameKo: ['자일리톨'], nameEn: ['xylitol'], riskLevel: 'emergency', answer: '절대 금지', reason: '저혈당·간부전 유발', symptoms: ['구토', '경련', '황달'], emergency: true, source: 'ASPCA' },
      { nameKo: ['양파'], nameEn: ['onion'], riskLevel: 'danger', answer: '위험', reason: '적혈구 파괴 (용혈성 빈혈)', symptoms: ['빈혈', '무기력', '구토'], emergency: true, source: 'ASPCA' },
      { nameKo: ['마늘'], nameEn: ['garlic'], riskLevel: 'danger', answer: '위험', reason: '양파보다 5배 독성', symptoms: ['빈혈', '구토'], emergency: true, source: 'ASPCA' },
      { nameKo: ['대파', '쪽파', '부추'], nameEn: ['green onion', 'chive'], riskLevel: 'danger', answer: '위험', reason: '파 종류 전체 독성', symptoms: ['빈혈', '구토'], emergency: true, source: 'ASPCA' },
      { nameKo: ['알코올', '술', '맥주', '소주'], nameEn: ['alcohol', 'beer'], riskLevel: 'danger', answer: '절대 금지', reason: '신경계·간 손상', symptoms: ['구토', '경련', '혼수'], emergency: true, source: 'ASPCA' },
      { nameKo: ['카페인', '커피', '녹차'], nameEn: ['caffeine', 'coffee'], riskLevel: 'danger', answer: '위험', reason: '심박수 증가, 경련 유발', symptoms: ['떨림', '경련'], emergency: true, source: 'ASPCA' },
      { nameKo: ['아보카도'], nameEn: ['avocado'], riskLevel: 'danger', answer: '위험', reason: '퍼신(Persin) 독소', symptoms: ['구토', '호흡곤란'], emergency: true, source: 'ASPCA' },
      { nameKo: ['마카다미아'], nameEn: ['macadamia'], riskLevel: 'danger', answer: '위험', reason: '신경·근육 독성', symptoms: ['다리 떨림', '고열'], emergency: true, source: 'ASPCA' },
      { nameKo: ['닭뼈', '생선뼈', '뼈'], nameEn: ['chicken bone'], riskLevel: 'danger', answer: '위험', reason: '내장 천공 유발', symptoms: ['구토', '혈변'], emergency: true, source: 'ASPCA' },
      { nameKo: ['참치', '참치캔'], nameEn: ['tuna'], riskLevel: 'caution', answer: '소량만', reason: '과다 시 수은 중독', emergency: false, source: 'PetMD' },
      { nameKo: ['생고기', '날고기'], nameEn: ['raw meat'], riskLevel: 'caution', answer: '주의', reason: '살모넬라 위험', emergency: false, source: 'AVMA' },
      { nameKo: ['우유', '유제품'], nameEn: ['milk'], riskLevel: 'caution', answer: '소량만', reason: '유당불내증', emergency: false, source: 'PetMD' },
      { nameKo: ['날달걀', '생달걀'], nameEn: ['raw egg'], riskLevel: 'caution', answer: '익혀서', reason: '날것은 살모넬라', emergency: false, source: 'ASPCA' },
      { nameKo: ['감자'], nameEn: ['potato'], riskLevel: 'caution', answer: '익힌 것만', reason: '날감자·녹색감자는 솔라닌 독소', emergency: false, source: 'ASPCA' },
      { nameKo: ['사과'], nameEn: ['apple'], riskLevel: 'safe', answer: '먹어도 돼요', reason: '씨앗 제거 후 소량은 안전', emergency: false, source: 'ASPCA' },
      { nameKo: ['바나나'], nameEn: ['banana'], riskLevel: 'safe', answer: '먹어도 돼요', reason: '소량은 안전', emergency: false, source: 'ASPCA' },
      { nameKo: ['고구마'], nameEn: ['sweet potato'], riskLevel: 'safe', answer: '먹어도 돼요', reason: '익혀서 소량', emergency: false, source: 'ASPCA' },
      { nameKo: ['당근'], nameEn: ['carrot'], riskLevel: 'safe', answer: '먹어도 돼요', reason: '저칼로리, 치아 건강에 좋음', emergency: false, source: 'ASPCA' },
      { nameKo: ['브로콜리'], nameEn: ['broccoli'], riskLevel: 'safe', answer: '소량은 괜찮아요', reason: '소량은 안전', emergency: false, source: 'ASPCA' },
      // ── 2026-06-26 추가 ──
      { nameKo: ['땅콩', '피넛', '땅콩버터'], nameEn: ['peanut', 'peanut butter'], riskLevel: 'caution', answer: '소량은 괜찮지만 주의가 필요합니다.', reason: '무염·무가공 땅콩 소량은 독성은 없으나 지방 함량이 높아 과다 섭취 시 췌장염 위험. 땅콩버터는 자일리톨 함유 여부 확인 필수.', symptoms: ['구토', '설사', '무기력'], emergency: false, source: 'AKC' },
      { nameKo: ['익힌 계란', '삶은 계란', '계란', '달걀', '삶은 달걀'], nameEn: ['cooked egg', 'boiled egg', 'egg'], riskLevel: 'safe', answer: '익힌 계란은 먹여도 됩니다.', reason: '완전히 익힌 계란은 단백질 공급원으로 안전합니다. 날달걀은 살모넬라 위험이 있으니 반드시 익혀서 주세요.', emergency: false, source: 'AKC' },
      { nameKo: ['연어', '익힌 연어', '구운 연어'], nameEn: ['salmon', 'cooked salmon'], riskLevel: 'safe', answer: '익힌 연어는 먹여도 됩니다.', reason: '완전히 익힌 연어는 오메가-3가 풍부합니다. 생연어는 기생충 위험이 있으니 반드시 익혀서 주세요.', emergency: false, source: 'AKC' },
      { nameKo: ['생연어', '생선회', '회', '날생선'], nameEn: ['raw fish', 'raw salmon', 'sashimi'], riskLevel: 'caution', answer: '생선회·날생선은 주의가 필요합니다.', reason: '기생충 및 박테리아 감염 위험. 반드시 완전히 익혀서 주세요.', symptoms: ['구토', '설사', '무기력'], emergency: false, source: 'AKC' },
      { nameKo: ['수박', '멜론'], nameEn: ['watermelon', 'melon'], riskLevel: 'safe', answer: '씨와 껍질을 제거하면 먹어도 됩니다.', reason: '과육은 수분이 풍부해 여름 간식으로 좋습니다. 씨앗과 껍질은 반드시 제거하세요.', emergency: false, source: 'AKC' },
      { nameKo: ['블루베리', '딸기'], nameEn: ['blueberry', 'strawberry'], riskLevel: 'safe', answer: '소량은 먹여도 됩니다.', reason: '항산화 성분이 풍부해 소량의 간식으로 안전합니다. 당분이 있어 많이 주지 마세요.', emergency: false, source: 'AKC' },
      { nameKo: ['버섯', '표고버섯', '양송이'], nameEn: ['mushroom'], riskLevel: 'caution', answer: '마트 식용 버섯은 소량 괜찮지만 야생 버섯은 위험합니다.', reason: '마트용 식용 버섯(표고·양송이)은 소량 무해. 야생 버섯은 독성이 있어 절대 금지.', symptoms: ['구토', '설사', '경련'], emergency: false, source: 'ASPCA' },
      { nameKo: ['닭고기', '닭가슴살', '삶은 닭', '익힌 닭'], nameEn: ['chicken', 'chicken breast'], riskLevel: 'safe', answer: '양념 없이 익힌 닭고기는 먹여도 됩니다.', reason: '양념 없이 완전히 익힌 닭가슴살은 좋은 단백질 공급원입니다. 닭뼈는 위험하므로 반드시 제거하세요.', emergency: false, source: 'AKC' },
      { nameKo: ['쌀', '밥', '흰밥', '쌀밥'], nameEn: ['rice', 'cooked rice'], riskLevel: 'safe', answer: '소량은 먹여도 됩니다.', reason: '소화가 잘 되는 탄수화물 공급원으로 소량은 안전합니다. 주식으로 삼으면 영양 불균형이 생길 수 있어요.', emergency: false, source: 'PetMD' },
    ];

    const query = foodName.toLowerCase().trim();
    const matched = DB.find(item =>
      item.nameKo.some(k => k.toLowerCase().includes(query) || query.includes(k.toLowerCase())) ||
      item.nameEn.some(e => e.toLowerCase().includes(query) || query.includes(e.toLowerCase()))
    );

    if (!matched) {
      return {
        riskLevel: 'unknown',
        answer: 'DB 미등록',
        emergency: false,
        geminiText: null,
        source: null,
      };
    }

    const apiKey = GEMINI_API_KEY_SECRET.value();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `아래 반려동물 식품 안전 정보를 바탕으로 보호자에게 전달할 안내문을 작성해.
판정 결과를 바꾸거나 추가 판단하지 마.
위험도: ${matched.riskLevel}
이유: ${matched.reason}
증상: ${matched.symptoms?.join(', ') ?? '해당 없음'}
응급 여부: ${matched.emergency ? '응급' : '일반'}
2~4문장으로 간결하게 정리해.
마지막에는 반드시 "이 안내는 진료를 대신하지 않습니다."를 붙여.`;

    const result = await model.generateContent(prompt);
    const geminiText = result.response.text();

    return {
      riskLevel: matched.riskLevel,
      answer: matched.answer,
      reason: matched.reason,
      symptoms: matched.symptoms ?? [],
      emergency: matched.emergency,
      geminiText,
      source: matched.source,
    };
  },
);

export {
  requestAccountDeletion,
  cancelAccountDeletion,
  executeScheduledDeletion,
} from './accountDeletion';

export {
  getSubscriptionRefundEligibility,
  requestSubscriptionRefund,
  listSubscriptionRefundRequests,
  approveSubscriptionRefund,
  rejectSubscriptionRefund,
} from './subscriptionRefunds';
