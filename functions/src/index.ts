import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import axios from 'axios';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
import * as fs from 'fs';
import * as path from 'path';

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
const NAVER_CLIENT_ID_SECRET = defineSecret('NAVER_CLIENT_ID');
const NAVER_CLIENT_SECRET_SECRET = defineSecret('NAVER_CLIENT_SECRET');
const PORTONE_API_SECRET = defineSecret('PORTONE_API_SECRET');
const LAW_API_KEY_SECRET = defineSecret('LAW_API_KEY');
const GOOGLE_CLOUD_API_KEY_SECRET = defineSecret('GOOGLE_CLOUD_API_KEY');
const OPENAI_API_KEY_SECRET = defineSecret('OPENAI_API_KEY');
const COLLECTOR_SECRET_KEY = defineSecret('COLLECTOR_SECRET_KEY');
const ONBID_API_KEY_SECRET = defineSecret('ONBID_API_KEY');
const DRUG_API_KEY_SECRET = defineSecret('DRUG_API_KEY');
const HIRA_API_KEY_SECRET = defineSecret('HIRA_API_KEY');
const FRONTEND_URL = 'https://haru2026-8abb8.web.app';

// Storage 버킷
const bucket = () => getStorage().bucket();

const KAKAO_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/kakaoCallback';
const NAVER_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/naverCallback';
const GOOGLE_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/googleCallback';

const db = admin.firestore();

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
    try {
      const { text, mode = 'premium', format } = request.data;

      if (!text || typeof text !== 'string') {
        throw new HttpsError('invalid-argument', '텍스트가 필요합니다.');
      }
      if (text.length > 5000) {
        throw new HttpsError('invalid-argument', '텍스트는 5000자 이내여야 합니다.');
      }

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
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: systemPrompt
      });

      const result = await model.generateContent(text);
      const polishedText = result.response.text();

      // ===== 통계 분석 (모든 형식) =====
      let stats = null;
      if (format) {
        stats = await analyzeStats(text, format, GEMINI_API_KEY_SECRET.value());
      }

      return { 
        text: polishedText,
        stats: stats
      };

    } catch (error: any) {
      console.error('AI 처리 실패:', error);
      throw new HttpsError('internal', 'AI 처리에 실패했습니다.');
    }
  }
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
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

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
    const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    if (request.auth.uid !== DEV_UID) {
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
async function analyzeStats(text: string, format: string, apiKey: string) {
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
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite"
    });

    const result = await model.generateContent(analysisPrompt);
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

      if (!state || typeof state !== 'string') throw new Error('Invalid state');

      const stateDoc = await db.collection('oauth_states').doc(state).get();
      if (!stateDoc.exists) throw new Error('State not found');

      const stateData = stateDoc.data();
      if (stateData?.expiresAt.toMillis() < Date.now()) {
        throw new Error('State expired');
      }

      await stateDoc.ref.delete();

      const tokenResponse = await axios.post(
        'https://kauth.kakao.com/oauth/token',
        null,
        {
          params: {
            grant_type: 'authorization_code',
            client_id: KAKAO_CLIENT_ID_SECRET.value().trim(),
            client_secret: KAKAO_CLIENT_SECRET_SECRET.value().trim(),
            redirect_uri: KAKAO_REDIRECT_URI,
            code,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

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
      console.error('❌ 카카오 콜백 실패:', error);
      res.redirect(
        `${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`
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

export const uploadRecordImage = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { imageBase64, mimeType, recordId, prefix, fileName } = request.data || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', '이미지 데이터가 필요합니다.');
    }

    const contentType = typeof mimeType === 'string' && mimeType.startsWith('image/')
      ? mimeType
      : 'image/jpeg';
    const uid = request.auth.uid;
    const safeRecordId = safeCloudinarySegment(recordId, 'record');
    const safePrefix = safeCloudinarySegment(prefix, 'format');
    const safeFileName = safeCloudinarySegment(String(fileName || 'image').replace(/\.[^.]+$/, ''), 'image');

    configureCloudinary();

    try {
      const dataUri = `data:${contentType};base64,${imageBase64}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        resource_type: 'image',
        folder: `haru2026/records/${uid}/${safePrefix}`,
        public_id: `${safeRecordId}_${safeFileName}`,
        overwrite: false,
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error: any) {
      logger.error('Cloudinary 기록 사진 업로드 오류:', error);
      throw new HttpsError('internal', `업로드 실패: ${error.message}`);
    }
  }
);

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

export const generateMergePDFFast = onCall({ region: 'asia-northeast3', memory: '1GiB', timeoutSeconds: 300 }, async (request) => {
  const { title, dateRange, records } = request.data;

  const fontPath = path.join(__dirname, 'fonts', 'NotoSansKR.ttf');

  // 이미지 사전 다운로드
  const recordsWithImages = await Promise.all(
    records.map(async (record: any) => {
      const imageBuffers: Buffer[] = [];
      if (record.images && record.images.length > 0) {
        for (const url of record.images) {
          try {
            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
            // sharp로 리사이징: 최대 800px, JPEG 품질 70% → 응답 크기 축소
            const resized = await sharp(Buffer.from(res.data))
              .resize({ width: 800, withoutEnlargement: true })
              .jpeg({ quality: 70 })
              .toBuffer();
            imageBuffers.push(resized);
          } catch (e) {
            logger.warn(`이미지 다운로드/리사이징 실패: ${url}`);
          }
        }
      }
      return { ...record, imageBuffers };
    })
  );

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve({ pdf: pdfBuffer.toString('base64') });
      });
      doc.on('error', reject);

      // 표지
      doc.font(fontPath).fontSize(22).fillColor('#1A3C6E').text(title, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#999999').text(dateRange, { align: 'center' });
      doc.moveDown(2);

      // 각 기록
      recordsWithImages.forEach((record: any, idx: number) => {
        if (idx > 0) doc.moveDown(1);
        // 날짜
        doc.fontSize(12).fillColor('#1A3C6E').font(fontPath).text(record.date);
        // 구분선
        doc.moveDown(0.3);
        const y = doc.y;
        doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
        doc.moveDown(0.5);
        // 이미지
        if (record.imageBuffers && record.imageBuffers.length > 0) {
          record.imageBuffers.forEach((imgBuffer: Buffer) => {
            doc.image(imgBuffer, { width: 495, align: 'center' });
            doc.moveDown(0.5);
          });
        }
        // 본문
        doc.fontSize(11).fillColor('#333333').font(fontPath).text(record.content || '', {
          lineGap: 4,
          paragraphGap: 4,
        });
      });

      // 푸터 텍스트
      doc.moveDown(2);
      doc.fontSize(9).fillColor('#CCCCCC').text('HARU by JOYEL', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
});

// ===== 💳 결제 검증 (PortOne V2) =====
export const verifyPayment = onCall(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { paymentId } = request.data;
    const uid = request.auth.uid;

    if (!paymentId || typeof paymentId !== 'string') {
      throw new HttpsError('invalid-argument', 'paymentId가 필요합니다.');
    }

    // PortOne V2 결제 조회
    let payment: any;
    try {
      const portoneRes = await axios.get(
        `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
        { headers: { Authorization: `PortOne ${PORTONE_API_SECRET.value().trim()}` } }
      );
      payment = portoneRes.data;
    } catch (e: any) {
      logger.error('PortOne 결제 조회 실패:', e?.response?.data || e.message);
      throw new HttpsError('internal', '결제 정보를 조회할 수 없습니다.');
    }

    // 결제 상태 검증
    if (payment.status !== 'PAID') {
      throw new HttpsError('failed-precondition', '결제가 완료되지 않았습니다.');
    }

    // 금액 검증 (월 3,000원 고정)
    const paidAmount = payment.amount?.total ?? payment.totalAmount;
    if (paidAmount !== 3000) {
      logger.error(`금액 불일치: 기대 3000, 실제 ${paidAmount}`);
      throw new HttpsError('invalid-argument', '결제 금액이 올바르지 않습니다.');
    }

    // 중복 처리 방지
    const subRef = db.doc(`users/${uid}/subscription/info`);
    const existing = await subRef.get();
    if (existing.exists && existing.data()?.paymentId === paymentId) {
      return { success: true, alreadyProcessed: true };
    }

    // Firestore 저장
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await subRef.set({
      plan: 'premium',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      paymentId,
      updatedAt: now.toISOString(),
    });

    logger.info(`✅ 결제 검증 완료 — uid: ${uid}, paymentId: ${paymentId}`);
    return { success: true };
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

// ===== ⚖️ HARUraw — 법령 검색 + Gemini 해석 =====
export const lawSearch = onCall(
  {
    region: 'asia-northeast3',
    secrets: [LAW_API_KEY_SECRET, GEMINI_API_KEY_SECRET],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { query } = request.data;
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new HttpsError('invalid-argument', '검색어가 필요합니다.');
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
      const LAW_API_KEY = LAW_API_KEY_SECRET.value();
      const GEMINI_KEY = GEMINI_API_KEY_SECRET.value();

      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
      const axiosConfig = {
        headers: {
          Referer: 'https://haru2026.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
        timeout: 10000,
      };

      // 0단계: Gemini로 정확한 법령 이름 추출
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const kwModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
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
      const lawKeyword = kwResult.response.text().trim().split('\n')[0].trim();
      console.log('HARUraw 추출 키워드:', lawKeyword);

      // 1단계: 법제처 검색
      const searchUrl = `https://www.law.go.kr/DRF/lawSearch.do?OC=${LAW_API_KEY}&target=law&type=XML&query=${encodeURIComponent(lawKeyword)}`;
      const searchRes = await axios.get(searchUrl, axiosConfig);
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
      const serviceRes = await axios.get(serviceUrl, axiosConfig);
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
      const allText = allJomuns
        .map((j: any) => `${j.articleStr}(${j.title}): ${j.content}`)
        .join('\n');

      const selectModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      const selectResult = await selectModel.generateContent(
        `다음은 ${lawName}의 조문 목록입니다.
사용자 질문 "${query}"과 가장 관련된 조문 번호를 최대 3개만 골라서
쉼표로 구분하여 출력하세요. 조문 번호만 (예: 제311조,제312조,제307조)

조문 목록:
${allText.slice(0, 8000)}`
      );

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
      const summaryModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
      const lawText = finalJomuns
        .map((j: any) => `${j.articleStr}(${j.title}): ${j.content}`)
        .join('\n');

      const summaryResult = await summaryModel.generateContent(
        `당신은 실무 경력 20년의 대한민국 법률 전문가입니다.
다음 원칙을 반드시 지키세요:

1. 사용자 질문을 정확히 이해하고 핵심 법적 쟁점을 파악하세요.
2. 관련 법 조문을 근거로 명확한 법적 판단을 내려주세요.
3. 어려운 법률 용어는 반드시 쉬운 말로 풀어 설명하세요.
4. 실무적 행동 지침을 구체적으로 안내하세요.
   (예: "경찰서에 고소장을 제출하세요", "내용증명을 보내세요")
5. 답변 구조:
   ⚖️ 법적 판단: (핵심 결론 1~2문장)
   📌 근거 조문: (관련 법 조문 언급)
   💡 실무 조언: (당장 할 수 있는 행동)
   ⚠️ 주의사항: (놓치기 쉬운 점)
6. 마지막에 반드시 추가:
   "본 내용은 법령 정보 제공 목적이며, 전문적인 법률 자문을 대체할 수 없습니다."

사용자 질문: ${query}
관련 법령(${lawName}):
${lawText}`
      );

      return {
        success: true,
        data: finalJomuns,
        aiSummary: summaryResult.response.text(),
      };

    } catch (error: any) {
      logger.error('HARUraw 법령 검색 실패:', error);
      throw new HttpsError('internal', '법령 검색에 실패했습니다.');
    }
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
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
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
      return {
        success: true,
        explanation: result.response.text(),
      };

    } catch (error: any) {
      logger.error('법령 해설 실패:', error);
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

    const DISCLAIMER = '이 정보는 국가법령정보센터에서 제공한 실제 판례입니다. AI 요약은 참고용이며, 정확한 내용은 법령정보센터에서 확인하세요.';
    const NO_RESULT_DISCLAIMER = '이 검색은 국가법령정보센터의 실제 판례 데이터를 기반으로 합니다.';

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());

    // 1. Gemini로 검색 키워드 추출 (lawSearch 0단계 패턴)
    let searchKeyword = '';
    try {
      const kwModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
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
      searchKeyword = kwResult.response.text().trim().split('\n')[0].trim();
      // 한글 1자 이상 포함 검증 (한자/기호만 나오면 폴백)
      if (!/[가-힣]/.test(searchKeyword) || searchKeyword.length === 0) {
        searchKeyword = '';
      }
    } catch (kwErr: any) {
      logger.warn('판례 키워드 추출 실패, 폴백 사용:', kwErr?.message);
      searchKeyword = '';
    }

    // 키워드 추출 실패 시 폴백 (userQuery → lawText 첫 20자)
    if (!searchKeyword) {
      const fallback = (userQuery && String(userQuery).trim()) || String(lawText).trim().slice(0, 20);
      searchKeyword = fallback.slice(0, 20);
    }

    logger.info('lawPrecedent 검색 키워드:', searchKeyword);

    // 2. 국가법령정보 OpenAPI 호출 (판례 검색)
    const ocKey = LAW_API_KEY_SECRET.value();
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
      throw new HttpsError('internal', '판례 검색 서버에 연결할 수 없습니다');
    }

    // 3. 응답 파싱
    const precSearch = response.data?.PrecSearch;
    const totalCnt = parseInt(precSearch?.totalCnt || '0', 10);
    const rawList = precSearch?.prec;

    // 4. 0건 또는 비정상 구조 처리
    if (!precSearch || totalCnt === 0 || !rawList) {
      logger.info('lawPrecedent 0건 응답:', { searchKeyword, userQuery: userQuery || '' });
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
    try {
      const sumModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
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
      let rawSum = sumResult.response.text().trim();
      rawSum = rawSum.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(rawSum);
      if (Array.isArray(parsed)) {
        summaries = parsed;
      }
    } catch (sumErr: any) {
      logger.warn('판례 요약 생성 실패, 기본값 사용:', sumErr?.message);
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

export { generateBook } from "./bookStudio";
export { analyzeFacebookZip } from "./snsAnalyzer";
export { convertSnsToDiary } from "./snsToDiary";

// ===== 단어 뜻 조회 =====
export const getWordMeaning = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] },
  async (request) => {
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
    const { verseKey, verseText } = request.data;
    if (!verseText) throw new HttpsError('invalid-argument', '절 내용이 필요합니다.');

    const db = admin.firestore();
    const cacheRef = db.collection('grammarCache').doc(verseKey);

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
- 반드시 동일한 JSON 구조로만 응답
- 마크다운 없이 순수 JSON만

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
      verified = gptParsed.result ?? gptParsed;
      gptChanges = gptParsed.changes ?? [];
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
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

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
    const adminUid = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
    const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    const isDeveloper = request.auth?.uid === DEV_UID;

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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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

    const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    const isDeveloper = uid === DEV_UID;

    // 하루 1회 체크 (개발자 제외)
    if (!isDeveloper && usage.daily === today && usage.dailyCount >= 1) {
      throw new HttpsError('resource-exhausted', '오늘은 이미 예언을 생성했습니다. 내일 다시 시도해주세요.');
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

${type === 'story'
  ? '분량: A4 5페이지 분량 (4000~6000자). 기승전결 구조로 작성.'
  : '분량: A4 1페이지 분량 시놉시스 (800~1200자). 핵심 줄거리만 간결하게.'}
`;
      } else {
        const motiveLabel = motiveCustom || motive;
        userPrompt = `
[예언 모티브]: ${motiveLabel}
[인물 설정]: ${JSON.stringify(chars || [])}
[탄생 배경]: ${birth || ''}
[욕망]: ${desire || ''}
[족쇄]: ${shackle || ''}
[사건]: ${JSON.stringify(events || [])}
[운]: ${luck || ''}
[불운]: ${unluck || ''}
[서사 스타일]: ${narrative || ''}

${type === 'story'
  ? '위 설정을 바탕으로 A4 5페이지 분량(4000~6000자)의 이야기를 소설 형식으로 작성해주세요.'
  : '위 설정을 바탕으로 A4 1페이지 분량(800~1200자)의 시놉시스를 작성해주세요.'}
`;
      }

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
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
    const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    const provided = request.data?.secretKey;
    if (provided !== COLLECTOR_SECRET_KEY.value()) {
      throw new HttpsError('permission-denied', '권한 없음');
    }
    const token = await admin.auth().createCustomToken(DEV_UID);
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

    const params: Record<string, string> = {
      serviceKey: DRUG_API_KEY_SECRET.value(),
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
      type: 'json',
      item_name: itemName,
    };

    let resp: any;
    try {
      resp = await callDrugApi(params);
    } catch (err: any) {
      throw new HttpsError('internal', '식약처 서버에 연결할 수 없습니다');
    }

    const data = resp?.data;
    const root = data?.response ?? data;
    const header = root?.header;
    const body = root?.body;
    const resultCode = header?.resultCode ?? '';
    const resultMsg = header?.resultMsg ?? '';

    if (resultCode && resultCode !== '00' && resultCode !== '0') {
      logger.warn('식약처 API 비정상 응답:', { resultCode, resultMsg });
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
      throw new HttpsError('internal', `식약처 API 오류 (${resultCode}): ${resultMsg}`);
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
// 처리: Gemini Vision으로 약 이름만 추출 → 식약처 API로 공식 정보 조회
// 개인정보 안전장치:
//   1) 프롬프트에 환자·의사·병원 정보 무시 명시
//   2) 사진·개인정보 로그 차단 (장수·바이트 길이만 로깅)
//   3) 분석 후 사진 즉시 폐기 (Storage 저장 없음)
//   4) 추출 결과는 식약처 공식 데이터로 한 번 더 검증
export const analyzeDrugPhoto = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET, DRUG_API_KEY_SECRET],
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
{"drugs": [{"name": "약 이름1", "confidence": "high|medium|low"}, {"name": "약 이름2", "confidence": "high|medium|low"}], "note": "한 줄 메모"}

[규칙]
- 약 이름이 하나도 없으면 drugs=[] (빈 배열), note="약봉지 사진이 아닙니다" 또는 사유
- 약마다 confidence 개별 평가 (흐릿한 약은 "low")
- 같은 약이 여러 번 보이면 한 번만 포함
- 추측·환각 금지. 확실하지 않은 이름은 포함하지 마세요.
- 최대 10개까지만 추출`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const visionModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    type DrugConfidence = 'high' | 'medium' | 'low' | 'none';
    type ParsedDrug = { name: string; confidence: DrugConfidence };

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
        const c = String(item?.confidence ?? 'medium').trim().toLowerCase();
        const confidence: DrugConfidence =
          (['high', 'medium', 'low', 'none'].includes(c) ? c : 'medium') as DrugConfidence;
        parsedDrugs.push({ name, confidence });
        if (parsedDrugs.length >= 10) break;
      }

      // 구 형식 폴백 (drugName 단일 필드)
      if (parsedDrugs.length === 0 && parsed?.drugName) {
        const name = String(parsed.drugName).trim().slice(0, 60);
        if (name) {
          const c = String(parsed?.confidence ?? 'none').trim().toLowerCase();
          const confidence: DrugConfidence =
            (['high', 'medium', 'low', 'none'].includes(c) ? c : 'none') as DrugConfidence;
          parsedDrugs.push({ name, confidence });
        }
      }
    } catch (err: any) {
      // 🔒 에러 로그에도 사진·prompt 데이터 노출 금지
      logger.error('Gemini Vision 분석 실패', { message: err?.message?.slice(0, 200) });
      throw new HttpsError('internal', 'AI 분석 중 오류가 발생했습니다. 사진을 다시 찍어 주세요');
    }

    // 사진 base64 즉시 메모리 해제 (분석 끝났으니 보관 안 함)
    images.length = 0;

    const disclaimer = 'AI 분석은 참고용이며, 정확한 정보는 식약처 자료를 우선합니다. 약 이름만 추출하며, 환자·의사 등 개인정보는 저장·전송하지 않습니다.';

    if (parsedDrugs.length === 0) {
      return {
        success: true,
        recognized: [],
        extractedName: '',
        confidence: 'none' as DrugConfidence,
        aiNote: aiNote || '약 이름을 인식하지 못했습니다. 사진을 더 또렷이 찍거나 약 이름을 직접 입력해 주세요.',
        items: [],
        totalCount: 0,
        disclaimer,
      };
    }

    // === 2단계: 추출된 약 이름들 각각 식약처 API 폴백 검색 ===
    // 식약처 DB는 함량·표기 차이로 정확명 매칭이 안 될 수 있어 단계별 폴백
    const searchDrug = async (name: string): Promise<{ items: any[]; totalCount: number }> => {
      const params: Record<string, string> = {
        serviceKey: DRUG_API_KEY_SECRET.value(),
        pageNo: '1',
        numOfRows: '10',
        type: 'json',
        item_name: name,
      };
      try {
        const resp = await callDrugApi(params);
        const root = resp?.data?.response ?? resp?.data;
        const body = root?.body;
        const rawItems = body?.items;
        let items: any[] = [];
        if (Array.isArray(rawItems)) items = rawItems;
        else if (rawItems?.item) items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
        const totalCount = parseInt(String(body?.totalCount ?? '0'), 10) || items.length;
        return { items, totalCount };
      } catch {
        return { items: [], totalCount: 0 };
      }
    };

    // 함량·용량·괄호·슬래시 등을 제거해 베이스 약명만 추출
    // "텔미누보정40/2.5mg" → "텔미누보정"
    const stripDosage = (s: string): string =>
      s
        .replace(/\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?\s*(mg|g|ml|mcg|µg|μg|IU|%)?/gi, '')
        .replace(/\d+(\.\d+)?\s*(mg|g|ml|mcg|µg|μg|IU|%)/gi, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/[\/·,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // 한글·영문 단어만 추출 (더 적극적 폴백)
    const baseWord = (s: string): string => {
      const m = s.match(/[가-힣A-Za-z]+/g);
      return m ? m[0] : '';
    };

    // 약 1개에 대한 3단 폴백 검색
    const searchWithFallback = async (extractedName: string) => {
      let items: any[] = [];
      let totalCount = 0;
      let searchUsedName = extractedName;
      let stageUsed: 'original' | 'stripDosage' | 'baseWord' | 'none' = 'none';

      const r1 = await searchDrug(extractedName);
      logger.info('식약처 검색 단계', {
        stage: 'original',
        name: extractedName,
        totalCount: r1.totalCount,
        op: _drugApiUrlCache?.split('/').pop() || '?',
      });
      if (r1.totalCount > 0) {
        items = r1.items;
        totalCount = r1.totalCount;
        stageUsed = 'original';
      } else {
        const stripped = stripDosage(extractedName);
        if (stripped && stripped !== extractedName && stripped.length >= 2) {
          const r2 = await searchDrug(stripped);
          logger.info('식약처 검색 단계', {
            stage: 'stripDosage',
            name: stripped,
            totalCount: r2.totalCount,
            op: _drugApiUrlCache?.split('/').pop() || '?',
          });
          if (r2.totalCount > 0) {
            items = r2.items;
            totalCount = r2.totalCount;
            searchUsedName = stripped;
            stageUsed = 'stripDosage';
          } else {
            const word = baseWord(stripped);
            if (word && word !== stripped && word.length >= 2) {
              const r3 = await searchDrug(word);
              logger.info('식약처 검색 단계', {
                stage: 'baseWord',
                name: word,
                totalCount: r3.totalCount,
                op: _drugApiUrlCache?.split('/').pop() || '?',
              });
              items = r3.items;
              totalCount = r3.totalCount;
              searchUsedName = word;
              stageUsed = 'baseWord';
            }
          }
        }
      }
      logger.info('식약처 검색 최종', {
        extractedName,
        finalName: searchUsedName,
        totalCount,
        stageUsed,
        op: _drugApiUrlCache?.split('/').pop() || '?',
      });
      return { items, totalCount, searchUsedName, fallbackUsed: searchUsedName !== extractedName };
    };

    // 각 약에 대해 병렬 검색
    const recognized = await Promise.all(
      parsedDrugs.map(async (d) => {
        const r = await searchWithFallback(d.name);
        return {
          extractedName: d.name,
          confidence: d.confidence,
          items: r.items,
          totalCount: r.totalCount,
          searchUsedName: r.searchUsedName,
          fallbackUsed: r.fallbackUsed,
        };
      })
    );

    // 하위 호환: 첫 번째 약 기준 단일 필드도 함께 반환
    const first = recognized[0];

    return {
      success: true,
      recognized,
      // 하위 호환 (구 클라이언트가 깨지지 않도록 첫 번째 약 기준)
      extractedName: first.extractedName,
      confidence: first.confidence,
      aiNote,
      items: first.items,
      totalCount: first.totalCount,
      searchUsedName: first.searchUsedName,
      fallbackUsed: first.fallbackUsed,
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
    const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    if (request.auth?.uid !== DEVELOPER_UID) {
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
