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

      let systemPrompt = '';

      if (mode === 'BASIC') {
        systemPrompt = `당신은 신중한 편집자입니다.
원문을 최대한 유지하며 맞춤법과 어색한 표현만 교정하세요.
존댓말 유지, 내용 추가 금지, 문단 분리 금지.`;
      } else {  // 이건 PREMIUM 모드
        systemPrompt = `당신은 재능있는 에세이 작가입니다.
감동적인 글로 재구성하되 존댓말 유지.
새로운 사건 추가 금지.
소제목 추가 금지. 마크다운 기호(**, ##, __, --, >) 절대 사용 금지.
본문만 자연스럽게 이어지는 문단으로 작성하세요.`;
      }

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());  // 🔐 Secret 값 사용
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite-preview",
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
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

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
      model: "gemini-3.1-flash-lite-preview"
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

export const convertHeic = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const { imageBase64 } = request.data;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', '이미지 데이터가 필요합니다.');
    }

    cloudinary.config({
      cloud_name: 'dmhutjnpn',
      api_key: '752573158646558',
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

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
      const kwModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
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

      const selectModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
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

// ===== 법령 관련 판례 검색 =====
export const lawPrecedent = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
  },
  async (request) => {
    const { lawText, userQuery } = request.data;

    if (!lawText) {
      throw new HttpsError('invalid-argument', '법령 텍스트를 입력해주세요.');
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: `당신은 실무 경력 20년의 대한민국 법률 전문가입니다.
해당 법 조문과 사용자 질문에 맞는 실제 대법원 판례를 2개 제시하세요.
반드시 JSON 배열 형식으로만 출력하세요. 다른 텍스트 없이.
형식:
[
  {
    "caseName": "사건명 (예: 모욕죄 성립 여부)",
    "caseNum": "대법원 연도. 월. 일. 선고 사건번호",
    "summary": "summary는 60자 이내, 마크다운 기호 절대 금지, 줄바꿈 없이 한 문장으로"
  }
]`
      });

      const prompt = `법령: ${lawText}\n사용자 질문: ${userQuery || ''}`;
      const result = await model.generateContent(prompt);

      // JSON 파싱 시도
      let precedents;
      try {
        let rawText = result.response.text().trim();
        rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        precedents = JSON.parse(rawText);
      } catch (parseError) {
        logger.error('판례 JSON 파싱 실패, 원문:', result.response.text());
        throw new HttpsError('internal', '판례 정보 파싱에 실패했습니다.');
      }

      return {
        success: true,
        precedents: precedents,
      };

    } catch (error: any) {
      logger.error('판례 검색 실패:', error);
      throw new HttpsError('internal', '판례 검색에 실패했습니다.');
    }
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
      // 1. Storage 캐시 확인 — 캐시된 경우 서명된 URL 반환
      const [exists] = await file.exists();
      if (exists) {
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 3600 * 1000, // 1시간
        });
        return { success: true, audioUrl: signedUrl, cached: true };
      }

      // 2. OpenAI TTS 생성
      const OPENAI_KEY = OPENAI_API_KEY_SECRET.value();

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

      const ttsResponse = await axios.post(
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

      const audioBuffer = Buffer.from(ttsResponse.data);
      if (!audioBuffer.length) {
        throw new HttpsError('internal', 'TTS 생성에 실패했습니다.');
      }

      await file.save(audioBuffer, {
        metadata: { contentType: 'audio/mpeg' },
      });

      // 서명된 URL 반환 (긴 텍스트도 안전하게 처리)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 3600 * 1000, // 1시간
      });
      return { success: true, audioUrl: signedUrl, cached: false };

    } catch (error: any) {
      logger.error('TTS 생성 실패:', error);
      throw new HttpsError('internal', 'TTS 생성에 실패했습니다.');
    }
  }
);

export { generateBook } from "./bookStudio";

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

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

    // 3. GPT-4o 검증
    let verified = parsed;
    let gptChanges: string[] = [];
    try {
      const OPENAI_KEY = OPENAI_API_KEY_SECRET.value();
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
      verifiedByGPT: true,
      gptChanges: gptChanges,
    });

    logger.info(`[getGrammarExplain] 캐시 저장: ${verseKey}`);
    return verified;
  }
);

// ===== 장 문법 사전생성 =====
export const preloadChapterGrammar = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET, OPENAI_API_KEY_SECRET] },
  async (request) => {
    const { book, chapter, verses, verseTexts } = request.data;

    const results: any[] = [];

    for (const verseKey of verses) {
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

        const geminiPrompt = `다음 영어 성경 구절(KJV)의 핵심 문법 요소를 JSON으로 분석해주세요.
구절: "${verseText}"
verseKey: "${verseKey}"

반드시 아래 JSON 형식으로만 응답하세요:
{
  "items": [
    {
      "type": "동사|전치사|관계사|구동사|의문사|명령감탄",
      "word": "분석할 단어",
      "explanation": "한국어 설명 (2줄 이내)",
      "example": "영어 예문",
      "exampleKr": "한국어 번역"
    }
  ],
  "mySentence": "이 구절 핵심 단어로 만든 새 영어 문장",
  "mySentenceKr": "한국어 번역"
}`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }],
            generationConfig: { temperature: 0.3 }
          })
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
          const openaiApiKey = OPENAI_API_KEY_SECRET.value();
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
                  content: `다음 문법 분석이 정확한지 검증하고 오류가 있으면 수정해주세요.
구절: "${verseText}"
분석: ${JSON.stringify(geminiData)}

수정사항이 있으면 corrected 필드에 수정된 전체 데이터를, changes 배열에 변경 내역을 담아주세요.
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

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

// ===== 뉴스 수동 새로고침 (개발자용) =====
export const refreshNews = onCall(
  { secrets: [GEMINI_API_KEY_SECRET], region: 'asia-northeast3' },
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
    const { content } = request.data;
    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      throw new HttpsError('invalid-argument', '분석할 기록 내용이 너무 짧습니다.');
    }

    const systemPrompt = `당신은 HARU예언 분석가입니다.
사용자가 작성한 기록(일기·에세이·여행기 등)에서 미래 예언 소설 생성에 필요한 핵심 항목을 추출합니다.

[추출 항목 — 4가지]
1. chars (등장인물): 기록에 등장한 사람들. 쉼표로 구분된 한 줄 문자열. 본인은 "나"로 표기. 최대 5명.
2. desire (소망): 작성자가 지금 가장 원하는 것·이루고 싶은 것. 짧은 한 문장.
3. shackle (극복할 것): 작성자를 막고 있는 것·두려움·제약. 짧은 한 문장.
4. events (주요 사건): 기록에 나타난 의미 있는 사건/장면. 쉼표로 구분된 짧은 문구들. 최대 5개.

[출력 규칙]
- 반드시 JSON 한 덩어리만 출력. 마크다운/설명 절대 금지.
- 모든 필드는 string. 명확히 읽히지 않으면 빈 문자열("")로.
- 추측하거나 만들어내지 말 것. 빈 칸으로 두고 사용자가 직접 채우게 한다.

출력 형식 (필드 4개 모두 string):
{
  "chars": "나, 아내, 딸 찬미",
  "desire": "Flutter 앱 출시",
  "shackle": "두려움, 게으름",
  "events": "앱 개발 시작, 사업자 등록"
}`;

    const userPrompt = `[기록 내용]\n${content.slice(0, 4000)}\n\n위 기록에서 4개 항목을 추출해 JSON으로만 답하세요.`;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite-preview',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userPrompt);
      let text = result.response.text().trim();
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

      let parsed: any = { chars: '', desire: '', shackle: '', events: '' };
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
            extractedChars, extractedDesire, extractedShackle, extractedEvents } = request.data;
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
      const systemPrompt = `당신은 한국 최고의 소설가이자 인생 예언가입니다.
아래 [HARU예언 인생 법칙]을 이야기 속에 직접 언급하지 말고 자연스럽게 녹여서 생성하세요.

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
        const charsLine = charsStr ? `[등장 인물]: ${charsStr}` : '';
        const desireLine = desireStr ? `[작성자의 소망]: ${desireStr}` : '';
        const shackleLine = shackleStr ? `[극복할 것]: ${shackleStr}` : '';
        const eventsLine = eventsStr ? `[주요 사건]: ${eventsStr}` : '';
        const extractedBlock = [charsLine, desireLine, shackleLine, eventsLine].filter(Boolean).join('\n');
        userPrompt = `
[창작 모드]: 내 기록으로 창작
[기록 제목]: ${recordTitle}
[기록 날짜]: ${recordDate}
[기록 형식]: ${recordFormat}
[예언 종류]: ${prophecyType}
[시간 배경]: ${timeOption}
[핵심 질문]: ${question}
${extractedBlock ? '\n[AI가 기록에서 추출한 핵심 요소]:\n' + extractedBlock + '\n' : ''}
[실제 기록 내용]:
${recordContent}

위 실제 기록과 추출된 핵심 요소를 바탕으로 ${timeOption} 뒤의 이야기를 예언 소설 형식으로 작성해주세요.
기록 속 인물, 감정, 사건을 최대한 살려서 "내 이야기 같다"는 느낌이 들게 해주세요.
예언 종류: ${prophecyType}

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
        model: 'gemini-3.1-flash-lite-preview',
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
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
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

