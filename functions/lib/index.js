"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lawPrecedent = exports.lawEasyExplain = exports.lawSearch = exports.removeAllTags = exports.verifyPayment = exports.generateMergePDFFast = exports.convertHeic = exports.sendBroadcastNotification = exports.scheduledPushNotification = exports.sendTestNotification = exports.googleCallback = exports.googleLoginStart = exports.naverCallback = exports.naverLoginStart = exports.kakaoCallback = exports.kakaoLoginStart = exports.generateTitlesForAll = exports.extractTitle = exports.polishContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const generative_ai_1 = require("@google/generative-ai");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const path = __importStar(require("path"));
// Firebase Admin 초기화
if (!admin.apps.length) {
    admin.initializeApp();
}
// ===== 🔐 Secrets 정의 (보안) =====
const GEMINI_API_KEY_SECRET = (0, params_1.defineSecret)('GEMINI_API_KEY');
const GOOGLE_CLIENT_ID_SECRET = (0, params_1.defineSecret)('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET_SECRET = (0, params_1.defineSecret)('GOOGLE_CLIENT_SECRET');
const KAKAO_CLIENT_ID_SECRET = (0, params_1.defineSecret)('KAKAO_CLIENT_ID');
const KAKAO_CLIENT_SECRET_SECRET = (0, params_1.defineSecret)('KAKAO_CLIENT_SECRET');
const NAVER_CLIENT_ID_SECRET = (0, params_1.defineSecret)('NAVER_CLIENT_ID');
const NAVER_CLIENT_SECRET_SECRET = (0, params_1.defineSecret)('NAVER_CLIENT_SECRET');
const PORTONE_API_SECRET = (0, params_1.defineSecret)('PORTONE_API_SECRET');
const LAW_API_KEY_SECRET = (0, params_1.defineSecret)('LAW_API_KEY');
const FRONTEND_URL = 'https://haru2026-8abb8.web.app';
const KAKAO_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/kakaoCallback';
const NAVER_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/naverCallback';
const GOOGLE_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/googleCallback';
const db = admin.firestore();
// ===== 🔑 이메일 기반 통합 UID 생성/조회 함수 (기존 UID 우선) =====
async function getOrCreateUnifiedUid(email, provider) {
    try {
        // 1. 이메일을 정규화 (소문자, 공백 제거)
        const normalizedEmail = email.toLowerCase().trim();
        // 2. Firestore에서 이메일 → UID 매핑 확인
        const emailDoc = await db.collection('email_to_uid').doc(normalizedEmail).get();
        if (emailDoc.exists) {
            // 기존 매핑 반환
            const data = emailDoc.data();
            console.log(`✅ 매핑된 UID 사용: ${data === null || data === void 0 ? void 0 : data.uid} (이메일: ${normalizedEmail})`);
            return data === null || data === void 0 ? void 0 : data.uid;
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
        }
        catch (authError) {
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
    }
    catch (error) {
        console.error('❌ 통합 UID 생성/조회 실패:', error);
        throw error;
    }
}
// ===== 🎨 AI 다듬기 =====
exports.polishContent = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET] // 🔐 Secret 연결
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    try {
        const { text, mode = 'premium', format } = request.data;
        if (!text || typeof text !== 'string') {
            throw new https_2.HttpsError('invalid-argument', '텍스트가 필요합니다.');
        }
        if (text.length > 5000) {
            throw new https_2.HttpsError('invalid-argument', '텍스트는 5000자 이내여야 합니다.');
        }
        let systemPrompt = '';
        if (mode === 'BASIC') {
            systemPrompt = `당신은 신중한 편집자입니다.
원문을 최대한 유지하며 맞춤법과 어색한 표현만 교정하세요.
존댓말 유지, 내용 추가 금지, 문단 분리 금지.`;
        }
        else { // 이건 PREMIUM 모드
            systemPrompt = `당신은 재능있는 에세이 작가입니다.
감동적인 글로 재구성하되 존댓말 유지.
새로운 사건 추가 금지.`;
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value()); // 🔐 Secret 값 사용
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
    }
    catch (error) {
        console.error('AI 처리 실패:', error);
        throw new https_2.HttpsError('internal', 'AI 처리에 실패했습니다.');
    }
});
// 숫자·기호만으로 이뤄진 제목인지 검사 (의미 없는 제목 걸러냄)
function isValidTitle(title) {
    if (!title || title.trim().length < 2)
        return false;
    // 숫자, 공백, 콜론, 점, 쉼표, 대시, 슬래시만으로 구성된 경우 거부
    // 예: "09:00", "1,234", "123", "12.5", "2026-03-28"
    return !/^[\d\s:.,\-\/]+$/.test(title.trim());
}
// ===== 🏷️ AI 제목 추출 =====
exports.extractTitle = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET]
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    try {
        const { text, format } = request.data;
        if (!text || typeof text !== 'string') {
            throw new https_2.HttpsError('invalid-argument', '텍스트가 필요합니다.');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
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
    }
    catch (error) {
        console.error('제목 추출 실패:', error);
        throw new https_2.HttpsError('internal', '제목 추출에 실패했습니다.');
    }
});
// ===== 🏷️ 기존 기록 AI 제목 일괄 생성 =====
exports.generateTitlesForAll = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    const FORMAT_PREFIX_MAP = {
        '일기': 'diary', '에세이': 'essay', '선교보고': 'mission',
        '일반보고': 'report', '업무일지': 'work', '여행기록': 'travel',
        '텃밭일지': 'garden', '애완동물관찰일지': 'pet', '육아일기': 'child', '메모': 'memo',
    };
    const EXCLUDE_ENDINGS = [
        '_images', '_style', '_sayu', '_rating', '_polished',
        '_polishedAt', '_mode', '_stats', '_space', '_title', '_tags',
    ];
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
    const snapshot = await db
        .collection('users').doc(uid).collection('records')
        .limit(500)
        .get();
    let count = 0;
    for (const docSnap of snapshot.docs) {
        const record = docSnap.data();
        const formats = record.formats || [];
        const updates = {};
        for (const format of formats) {
            const prefix = FORMAT_PREFIX_MAP[format];
            if (!prefix)
                continue;
            const existingTitle = record[`${prefix}_title`];
            // 유효한 제목이 이미 있으면 스킵, 숫자·기호만인 잘못된 제목은 덮어씀
            if (existingTitle && isValidTitle(existingTitle))
                continue;
            const simpleContent = record[`${prefix}_simple`] || '';
            const fieldContent = Object.entries(record)
                .filter(([key]) => key.startsWith(`${prefix}_`) &&
                !EXCLUDE_ENDINGS.some((s) => key.endsWith(s)) &&
                key !== `${prefix}_simple`)
                .map(([, v]) => v)
                .filter((v) => typeof v === 'string' && v.trim())
                .join(' ');
            const contentForTitle = (simpleContent || fieldContent).trim();
            if (!contentForTitle)
                continue;
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
                    updates[`${prefix}_title`] = title;
                    count++;
                }
            }
            catch (err) {
                logger.error(`제목 추출 실패 (${docSnap.id}, ${format}):`, err);
            }
        }
        if (Object.keys(updates).length > 0) {
            await docSnap.ref.update({ ...updates, updatedAt: new Date().toISOString() });
        }
    }
    return { count };
});
// ===== 📊 형식별 통계 분석 프롬프트 정의 =====
const STATS_PROMPTS = {
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
async function analyzeStats(text, format, apiKey) {
    try {
        const prompt = STATS_PROMPTS[format];
        if (!prompt) {
            console.log(`No stats prompt for format: ${format}`);
            return null;
        }
        const analysisPrompt = `${prompt}

기록 내용:
${text}`;
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
    }
    catch (error) {
        console.error('통계 분석 실패:', error);
        return null;
    }
}
// ===== 🟡 카카오 로그인 시작 =====
exports.kakaoLoginStart = (0, https_1.onRequest)({ region: 'asia-northeast3', secrets: [KAKAO_CLIENT_ID_SECRET, KAKAO_CLIENT_SECRET_SECRET] }, async (req, res) => {
    try {
        const state = crypto.randomBytes(32).toString('hex');
        await db.collection('oauth_states').doc(state).set({
            provider: 'kakao',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
        });
        const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?` +
            `client_id=${KAKAO_CLIENT_ID_SECRET.value().trim()}&` +
            `redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&` +
            `response_type=code&` +
            `scope=account_email&` +
            `state=${state}`;
        res.redirect(kakaoAuthUrl);
    }
    catch (error) {
        logger.error('❌ 카카오 로그인 시작 실패:', error);
        res.redirect(`${FRONTEND_URL}/login?error=start_failed`);
    }
});
// ===== 🟡 카카오 콜백 (통합 UID 적용) =====
exports.kakaoCallback = (0, https_1.onRequest)({ region: 'asia-northeast3', secrets: [KAKAO_CLIENT_ID_SECRET, KAKAO_CLIENT_SECRET_SECRET] }, async (req, res) => {
    var _a, _b, _c;
    try {
        const { code, state } = req.query;
        if (!state || typeof state !== 'string')
            throw new Error('Invalid state');
        const stateDoc = await db.collection('oauth_states').doc(state).get();
        if (!stateDoc.exists)
            throw new Error('State not found');
        const stateData = stateDoc.data();
        if ((stateData === null || stateData === void 0 ? void 0 : stateData.expiresAt.toMillis()) < Date.now()) {
            throw new Error('State expired');
        }
        await stateDoc.ref.delete();
        const tokenResponse = await axios_1.default.post('https://kauth.kakao.com/oauth/token', null, {
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
        });
        const { access_token } = tokenResponse.data;
        const userResponse = await axios_1.default.get('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${access_token}` } });
        const kakaoUser = userResponse.data;
        if (!kakaoUser.id) {
            throw new Error('카카오 사용자 ID를 가져올 수 없습니다');
        }
        const email = ((_a = kakaoUser.kakao_account) === null || _a === void 0 ? void 0 : _a.email) || `kakao_${kakaoUser.id}@placeholder.local`;
        const displayName = ((_c = (_b = kakaoUser.kakao_account) === null || _b === void 0 ? void 0 : _b.profile) === null || _c === void 0 ? void 0 : _c.nickname) || `kakao_user_${kakaoUser.id}`;
        // 🔑 통합 UID 생성/조회
        const uid = await getOrCreateUnifiedUid(email, 'kakao');
        // photoURL 완전히 제거 - 카카오는 photoURL 없이 생성
        try {
            await admin.auth().updateUser(uid, { email, displayName });
        }
        catch (error) {
            if (error.code === 'auth/user-not-found') {
                await admin.auth().createUser({ uid, email, displayName });
            }
            else
                throw error;
        }
        const customToken = await admin.auth().createCustomToken(uid);
        res.redirect(`${FRONTEND_URL}/auth/callback?customToken=${customToken}&provider=kakao`);
    }
    catch (error) {
        console.error('❌ 카카오 콜백 실패:', error);
        res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`);
    }
});
// ===== 🟢 네이버 로그인 시작 =====
exports.naverLoginStart = (0, https_1.onRequest)({ region: 'asia-northeast3', secrets: [NAVER_CLIENT_ID_SECRET, NAVER_CLIENT_SECRET_SECRET] }, async (req, res) => {
    try {
        const state = crypto.randomBytes(32).toString('hex');
        await db.collection('oauth_states').doc(state).set({
            provider: 'naver',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
        });
        const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?` +
            `client_id=${NAVER_CLIENT_ID_SECRET.value().trim()}&` +
            `redirect_uri=${encodeURIComponent(NAVER_REDIRECT_URI)}&` +
            `response_type=code&` +
            `state=${state}`;
        res.redirect(naverAuthUrl);
    }
    catch (error) {
        logger.error('❌ 네이버 로그인 시작 실패:', error);
        res.redirect(`${FRONTEND_URL}/login?error=start_failed`);
    }
});
// ===== 🟢 네이버 콜백 (통합 UID 적용) =====
exports.naverCallback = (0, https_1.onRequest)({ region: 'asia-northeast3', secrets: [NAVER_CLIENT_ID_SECRET, NAVER_CLIENT_SECRET_SECRET] }, async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!state || typeof state !== 'string')
            throw new Error('Invalid state');
        const stateDoc = await db.collection('oauth_states').doc(state).get();
        if (!stateDoc.exists)
            throw new Error('State not found');
        const stateData = stateDoc.data();
        if ((stateData === null || stateData === void 0 ? void 0 : stateData.expiresAt.toMillis()) < Date.now()) {
            throw new Error('State expired');
        }
        await stateDoc.ref.delete();
        const tokenResponse = await axios_1.default.post('https://nid.naver.com/oauth2.0/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: NAVER_CLIENT_ID_SECRET.value().trim(),
                client_secret: NAVER_CLIENT_SECRET_SECRET.value().trim(),
                redirect_uri: NAVER_REDIRECT_URI,
                code,
                state,
            },
        });
        const { access_token } = tokenResponse.data;
        const userResponse = await axios_1.default.get('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${access_token}` } });
        const naverUser = userResponse.data.response;
        const email = naverUser.email || `naver_${naverUser.id}@placeholder.local`;
        const displayName = naverUser.name || `naver_user_${naverUser.id}`;
        // 🔑 통합 UID 생성/조회
        const uid = await getOrCreateUnifiedUid(email, 'naver');
        // photoURL 완전히 제거 - 네이버는 photoURL 없이 생성
        try {
            await admin.auth().updateUser(uid, { email, displayName });
        }
        catch (error) {
            if (error.code === 'auth/user-not-found') {
                await admin.auth().createUser({ uid, email, displayName });
            }
            else
                throw error;
        }
        const customToken = await admin.auth().createCustomToken(uid);
        res.redirect(`${FRONTEND_URL}/auth/callback?customToken=${customToken}&provider=naver`);
    }
    catch (error) {
        console.error('❌ 네이버 콜백 실패:', error);
        res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`);
    }
});
// ===== 🔵 구글 로그인 시작 =====
exports.googleLoginStart = (0, https_1.onRequest)({
    region: 'asia-northeast3',
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET] // 🔐 Secret 연결
}, async (req, res) => {
    try {
        const GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID_SECRET.value(); // 🔐 Secret 값 사용
        const state = crypto.randomBytes(32).toString('hex');
        await db.collection('oauth_states').doc(state).set({
            provider: 'google',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
        });
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${GOOGLE_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&` +
            `response_type=code&` +
            `scope=email profile&` +
            `state=${state}`;
        res.redirect(googleAuthUrl);
    }
    catch (error) {
        console.error('❌ 구글 로그인 시작 실패:', error);
        res.redirect(`${FRONTEND_URL}/login?error=start_failed`);
    }
});
// ===== 🔵 구글 콜백 (통합 UID 적용) =====
exports.googleCallback = (0, https_1.onRequest)({
    region: 'asia-northeast3',
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET] // 🔐 Secret 연결
}, async (req, res) => {
    try {
        const GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID_SECRET.value(); // 🔐 Secret 값 사용
        const GOOGLE_CLIENT_SECRET = GOOGLE_CLIENT_SECRET_SECRET.value(); // 🔐 Secret 값 사용
        const { code, state } = req.query;
        if (!state || typeof state !== 'string')
            throw new Error('Invalid state');
        const stateDoc = await db.collection('oauth_states').doc(state).get();
        if (!stateDoc.exists)
            throw new Error('State not found');
        const stateData = stateDoc.data();
        if ((stateData === null || stateData === void 0 ? void 0 : stateData.expiresAt.toMillis()) < Date.now()) {
            throw new Error('State expired');
        }
        await stateDoc.ref.delete();
        const tokenResponse = await axios_1.default.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
        });
        const { access_token } = tokenResponse.data;
        const userResponse = await axios_1.default.get('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${access_token}` } });
        const googleUser = userResponse.data;
        const email = googleUser.email;
        const displayName = googleUser.name || `google_user_${googleUser.id}`;
        const photoURL = googleUser.picture || null;
        // 🔑 통합 UID 생성/조회
        const uid = await getOrCreateUnifiedUid(email, 'google');
        try {
            await admin.auth().updateUser(uid, { email, displayName, photoURL });
        }
        catch (error) {
            if (error.code === 'auth/user-not-found') {
                await admin.auth().createUser({ uid, email, displayName, photoURL });
            }
            else
                throw error;
        }
        const customToken = await admin.auth().createCustomToken(uid);
        res.redirect(`${FRONTEND_URL}/auth/callback?customToken=${customToken}&provider=google`);
    }
    catch (error) {
        console.error('❌ 구글 콜백 실패:', error);
        res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`);
    }
});
// ===== 🔔 테스트 알림 발송 =====
exports.sendTestNotification = (0, https_2.onCall)({ region: 'asia-northeast3' }, async (request) => {
    var _a;
    // 로그인 여부 확인
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    // 본인 토큰만 조회
    const settingsRef = db.doc(`users/${uid}/settings/settings`);
    const settingsSnap = await settingsRef.get();
    if (!settingsSnap.exists) {
        throw new https_2.HttpsError('not-found', 'FCM 토큰이 없습니다. 알림 권한을 허용해주세요.');
    }
    const fcmTokens = ((_a = settingsSnap.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens) || [];
    if (fcmTokens.length === 0) {
        throw new https_2.HttpsError('not-found', 'FCM 토큰이 없습니다. 알림 권한을 허용해주세요.');
    }
    const { title, body } = request.data;
    const message = {
        notification: {
            title: (title && typeof title === 'string' && title.trim()) || 'HARU 테스트 알림',
            body: (body && typeof body === 'string' && body.trim()) || '알림이 정상적으로 작동합니다! ✅',
        },
    };
    const results = await Promise.allSettled(fcmTokens.map((token) => admin.messaging().send({ ...message, token })));
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            logger.error(`FCM 발송 실패 — 토큰[${i}]: ${result.reason}`);
        }
    });
    logger.info(`테스트 알림 발송 완료 — uid: ${uid}, 성공: ${succeeded}, 실패: ${failed}`);
    return {
        success: true,
        total: fcmTokens.length,
        succeeded,
        failed,
    };
});
// ===== 🔔 알림 스케줄러 =====
var scheduledNotification_1 = require("./scheduledNotification");
Object.defineProperty(exports, "scheduledPushNotification", { enumerable: true, get: function () { return scheduledNotification_1.scheduledPushNotification; } });
// ===== 📢 전체 알림 발송 =====
var broadcastNotification_1 = require("./broadcastNotification");
Object.defineProperty(exports, "sendBroadcastNotification", { enumerable: true, get: function () { return broadcastNotification_1.sendBroadcastNotification; } });
// ===== 📷 HEIC → JPG 변환 (Cloudinary) =====
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { v2: cloudinary } = require('cloudinary');
exports.convertHeic = (0, https_2.onCall)({ region: 'asia-northeast3' }, async (request) => {
    const { imageBase64 } = request.data;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new https_2.HttpsError('invalid-argument', '이미지 데이터가 필요합니다.');
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
    }
    catch (error) {
        logger.error('Cloudinary HEIC 변환 오류:', error);
        throw new https_2.HttpsError('internal', `변환 실패: ${error.message}`);
    }
});
exports.generateMergePDFFast = (0, https_2.onCall)({ region: 'asia-northeast3', memory: '1GiB', timeoutSeconds: 300 }, async (request) => {
    const { title, dateRange, records } = request.data;
    const fontPath = path.join(__dirname, 'fonts', 'NotoSansKR.ttf');
    // 이미지 사전 다운로드
    const recordsWithImages = await Promise.all(records.map(async (record) => {
        const imageBuffers = [];
        if (record.images && record.images.length > 0) {
            for (const url of record.images) {
                try {
                    const res = await axios_1.default.get(url, { responseType: 'arraybuffer', timeout: 10000 });
                    // sharp로 리사이징: 최대 800px, JPEG 품질 70% → 응답 크기 축소
                    const resized = await sharp(Buffer.from(res.data))
                        .resize({ width: 800, withoutEnlargement: true })
                        .jpeg({ quality: 70 })
                        .toBuffer();
                    imageBuffers.push(resized);
                }
                catch (e) {
                    logger.warn(`이미지 다운로드/리사이징 실패: ${url}`);
                }
            }
        }
        return { ...record, imageBuffers };
    }));
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
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
            recordsWithImages.forEach((record, idx) => {
                if (idx > 0)
                    doc.moveDown(1);
                // 날짜
                doc.fontSize(12).fillColor('#1A3C6E').font(fontPath).text(record.date);
                // 구분선
                doc.moveDown(0.3);
                const y = doc.y;
                doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
                doc.moveDown(0.5);
                // 이미지
                if (record.imageBuffers && record.imageBuffers.length > 0) {
                    record.imageBuffers.forEach((imgBuffer) => {
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
        }
        catch (err) {
            reject(err);
        }
    });
});
// ===== 💳 결제 검증 (PortOne V2) =====
exports.verifyPayment = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] }, async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const { paymentId } = request.data;
    const uid = request.auth.uid;
    if (!paymentId || typeof paymentId !== 'string') {
        throw new https_2.HttpsError('invalid-argument', 'paymentId가 필요합니다.');
    }
    // PortOne V2 결제 조회
    let payment;
    try {
        const portoneRes = await axios_1.default.get(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `PortOne ${PORTONE_API_SECRET.value().trim()}` } });
        payment = portoneRes.data;
    }
    catch (e) {
        logger.error('PortOne 결제 조회 실패:', ((_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.data) || e.message);
        throw new https_2.HttpsError('internal', '결제 정보를 조회할 수 없습니다.');
    }
    // 결제 상태 검증
    if (payment.status !== 'PAID') {
        throw new https_2.HttpsError('failed-precondition', '결제가 완료되지 않았습니다.');
    }
    // 금액 검증 (월 3,000원 고정)
    const paidAmount = (_c = (_b = payment.amount) === null || _b === void 0 ? void 0 : _b.total) !== null && _c !== void 0 ? _c : payment.totalAmount;
    if (paidAmount !== 3000) {
        logger.error(`금액 불일치: 기대 3000, 실제 ${paidAmount}`);
        throw new https_2.HttpsError('invalid-argument', '결제 금액이 올바르지 않습니다.');
    }
    // 중복 처리 방지
    const subRef = db.doc(`users/${uid}/subscription/info`);
    const existing = await subRef.get();
    if (existing.exists && ((_d = existing.data()) === null || _d === void 0 ? void 0 : _d.paymentId) === paymentId) {
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
});
// ===== 🗑️ 일회성 마이그레이션: 모든 사용자 _tags 필드 일괄 삭제 =====
exports.removeAllTags = (0, https_1.onRequest)({ region: 'asia-northeast3' }, async (req, res) => {
    const db = admin.firestore();
    const usersSnap = await db.collection('users').get();
    let count = 0;
    for (const userDoc of usersSnap.docs) {
        const recordsSnap = await userDoc.ref.collection('records').get();
        for (const recordDoc of recordsSnap.docs) {
            const data = recordDoc.data();
            const tagFields = Object.keys(data).filter((k) => k.endsWith('_tags'));
            if (tagFields.length > 0) {
                const updateData = {};
                tagFields.forEach((f) => {
                    updateData[f] = admin.firestore.FieldValue.delete();
                });
                await recordDoc.ref.update(updateData);
                count++;
            }
        }
    }
    res.send(`완료: ${count}개 문서에서 _tags 필드 삭제`);
});
// ===== ⚖️ HARUraw — 법령 검색 + Gemini 해석 =====
exports.lawSearch = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [LAW_API_KEY_SECRET, GEMINI_API_KEY_SECRET],
}, async (request) => {
    var _a, _b, _c, _d, _e;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const { query } = request.data;
    if (!query || typeof query !== 'string' || !query.trim()) {
        throw new https_2.HttpsError('invalid-argument', '검색어가 필요합니다.');
    }
    const { XMLParser } = await Promise.resolve().then(() => __importStar(require('fast-xml-parser')));
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
        const { XMLParser } = await Promise.resolve().then(() => __importStar(require('fast-xml-parser')));
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_KEY);
        const kwModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
        const kwResult = await kwModel.generateContent(`다음 질문과 가장 관련된 대한민국 공식 법령 이름 1개만 출력하세요.
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

질문: ${query}`);
        const lawKeyword = kwResult.response.text().trim().split('\n')[0].trim();
        console.log('HARUraw 추출 키워드:', lawKeyword);
        // 1단계: 법제처 검색
        const searchUrl = `https://www.law.go.kr/DRF/lawSearch.do?OC=${LAW_API_KEY}&target=law&type=XML&query=${encodeURIComponent(lawKeyword)}`;
        const searchRes = await axios_1.default.get(searchUrl, axiosConfig);
        const searchJson = parser.parse(searchRes.data);
        const laws = ((_a = searchJson === null || searchJson === void 0 ? void 0 : searchJson.LawSearch) === null || _a === void 0 ? void 0 : _a.law) || ((_b = searchJson === null || searchJson === void 0 ? void 0 : searchJson.Law) === null || _b === void 0 ? void 0 : _b.law) || ((_c = searchJson === null || searchJson === void 0 ? void 0 : searchJson.LawList) === null || _c === void 0 ? void 0 : _c.law);
        if (!laws) {
            return { success: false, message: '관련 법령을 찾지 못했습니다.', data: [], aiSummary: '' };
        }
        const lawList = Array.isArray(laws) ? laws : [laws];
        // 정확한 법령명 우선 매칭
        const exactMatch = lawList.find((l) => (l === null || l === void 0 ? void 0 : l.법령명한글) === lawKeyword || (l === null || l === void 0 ? void 0 : l.법령명) === lawKeyword);
        const targetLaw = exactMatch || lawList[0];
        const mstId = targetLaw === null || targetLaw === void 0 ? void 0 : targetLaw.법령일련번호;
        const lawName = (targetLaw === null || targetLaw === void 0 ? void 0 : targetLaw.법령명한글) || lawKeyword;
        console.log('HARUraw 선택 법령:', lawName, 'MST:', mstId);
        if (!mstId) {
            return { success: false, message: '법령 정보를 가져올 수 없습니다.', data: [], aiSummary: '' };
        }
        // 2단계: 법령 전문 조회
        const serviceUrl = `https://www.law.go.kr/DRF/lawService.do?OC=${LAW_API_KEY}&target=law&MST=${mstId}&type=XML`;
        const serviceRes = await axios_1.default.get(serviceUrl, axiosConfig);
        const lawJson = parser.parse(serviceRes.data);
        const jomuns = ((_e = (_d = lawJson === null || lawJson === void 0 ? void 0 : lawJson.법령) === null || _d === void 0 ? void 0 : _d.조문) === null || _e === void 0 ? void 0 : _e.조문단위) || [];
        const arrayJomuns = Array.isArray(jomuns) ? jomuns : [jomuns];
        // 전체 조문 정제
        const allJomuns = arrayJomuns
            .map((j) => ({
            articleStr: `제${j === null || j === void 0 ? void 0 : j.조문번호}조`,
            title: String((j === null || j === void 0 ? void 0 : j.조문제목) || '제목 없음'),
            content: String((j === null || j === void 0 ? void 0 : j.조문내용) || ''),
            lawName,
            isPrecLinked: true,
        }))
            .filter((j) => j.articleStr !== '제undefined조' && j.content.length > 5);
        // 3단계: Gemini로 관련 조문만 선별 (최대 5개)
        const allText = allJomuns
            .map((j) => `${j.articleStr}(${j.title}): ${j.content}`)
            .join('\n');
        const selectModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
        const selectResult = await selectModel.generateContent(`다음은 ${lawName}의 조문 목록입니다.
사용자 질문 "${query}"과 가장 관련된 조문 번호를 최대 5개만 골라서
쉼표로 구분하여 출력하세요. 조문 번호만 (예: 제311조,제312조,제307조)

조문 목록:
${allText.slice(0, 8000)}`);
        const selectedNums = selectResult.response.text()
            .trim()
            .split(',')
            .map((s) => s.trim());
        const cleanedJomuns = allJomuns
            .filter((j) => selectedNums.includes(j.articleStr))
            .slice(0, 5);
        // 선별 실패 시 상위 3개
        const finalJomuns = cleanedJomuns.length > 0 ? cleanedJomuns : allJomuns.slice(0, 3);
        // 4단계: Gemini로 전체 요약 생성
        const summaryModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
        const lawText = finalJomuns
            .map((j) => `${j.articleStr}(${j.title}): ${j.content}`)
            .join('\n');
        const summaryResult = await summaryModel.generateContent(`당신은 실무 경력 20년의 대한민국 법률 전문가입니다.
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
${lawText}`);
        return {
            success: true,
            data: finalJomuns,
            aiSummary: summaryResult.response.text(),
        };
    }
    catch (error) {
        logger.error('HARUraw 법령 검색 실패:', error);
        throw new https_2.HttpsError('internal', '법령 검색에 실패했습니다.');
    }
});
// ===== 법령 쉬운 해설 =====
exports.lawEasyExplain = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
}, async (request) => {
    const { lawText, userQuery } = request.data;
    if (!lawText) {
        throw new https_2.HttpsError('invalid-argument', '법령 텍스트를 입력해주세요.');
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-pro',
            systemInstruction: `당신은 실무 경력 20년의 대한민국 법률 전문가입니다.
사용자의 질문에서 질문자의 역할(입장)을 먼저 파악하고, 그 입장에 맞게 답변하세요.

## 역할 판단 기준
- 피해자: "당했어요", "피해를 입었어요", "신고하고 싶어요"
- 피고발인: "고발당했어요", "억울해요", "나를 신고했어요", "지목됐어요"
- 제3자(관리자): "직원이 신고했어요", "어떻게 처리해야 하나요"
- 불명확: 역할을 먼저 명시하고 두 입장 모두 간략히 안내

## 답변 형식 (마크다운 기호 **, ##, --, > 사용 절대 금지)

📌 [역할 명시]
(예: "고발을 당하신 입장에서 안내드립니다.")

✅ 지금 당장 해야 할 일:
(질문자 입장에 맞는 실질적 행동 지침 2~3가지)

🔍 관련 법 조문 핵심:
(법조문 중 질문자에게 적용되는 내용만 쉽게 설명)

⚠️ 꼭 기억하세요:
(가장 중요한 주의사항 1가지)`
        });
        const prompt = userQuery
            ? `[사용자 질문]: ${userQuery}\n\n[관련 법조문]: ${lawText}`
            : lawText;
        const result = await model.generateContent(prompt);
        return {
            success: true,
            explanation: result.response.text(),
        };
    }
    catch (error) {
        logger.error('법령 해설 실패:', error);
        throw new https_2.HttpsError('internal', '법령 해설에 실패했습니다.');
    }
});
// ===== 법령 관련 판례 검색 =====
exports.lawPrecedent = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
}, async (request) => {
    const { lawText, userQuery } = request.data;
    if (!lawText) {
        throw new https_2.HttpsError('invalid-argument', '법령 텍스트를 입력해주세요.');
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-pro',
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
            precedents = JSON.parse(result.response.text());
        }
        catch (parseError) {
            throw new https_2.HttpsError('internal', '판례 정보 파싱에 실패했습니다.');
        }
        return {
            success: true,
            precedents: precedents,
        };
    }
    catch (error) {
        logger.error('판례 검색 실패:', error);
        throw new https_2.HttpsError('internal', '판례 검색에 실패했습니다.');
    }
});
