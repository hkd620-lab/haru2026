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
exports.googleCallback = exports.googleLoginStart = exports.naverCallback = exports.naverLoginStart = exports.kakaoCallback = exports.kakaoLoginStart = exports.polishContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const generative_ai_1 = require("@google/generative-ai");
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
// Firebase Admin 초기화
if (!admin.apps.length) {
    admin.initializeApp();
}
// ===== 🔐 Secrets 정의 (보안) =====
const GEMINI_API_KEY_SECRET = (0, params_1.defineSecret)('GEMINI_API_KEY');
const GOOGLE_CLIENT_ID_SECRET = (0, params_1.defineSecret)('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET_SECRET = (0, params_1.defineSecret)('GOOGLE_CLIENT_SECRET');
// ===== 환경변수 직접 설정 (카카오/네이버는 비공개 아님) =====
const KAKAO_CLIENT_ID = 'b910c15fde12b678e612c23aa56fe27f';
const KAKAO_CLIENT_SECRET = 'a2wUyOK1MK9TcfSYw6e7BET7aU8Gn1au';
const NAVER_CLIENT_ID = 'mRSWCHU_IHbPE7teR4P5';
const NAVER_CLIENT_SECRET = 'EpEDTAjryH';
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
    try {
        const { text, mode = 'premium', format } = request.data;
        if (!text || typeof text !== 'string') {
            throw new https_2.HttpsError('invalid-argument', '텍스트가 필요합니다.');
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
            model: "gemini-2.5-flash",
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
            model: "gemini-2.5-flash"
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
exports.kakaoLoginStart = (0, https_1.onRequest)({ region: 'asia-northeast3' }, async (req, res) => {
    try {
        const state = crypto.randomBytes(32).toString('hex');
        await db.collection('oauth_states').doc(state).set({
            provider: 'kakao',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
        });
        const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?` +
            `client_id=${KAKAO_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&` +
            `response_type=code&` +
            `scope=account_email&` +
            `state=${state}`;
        res.redirect(kakaoAuthUrl);
    }
    catch (error) {
        console.error('❌ 카카오 로그인 시작 실패:', error);
        res.redirect(`${FRONTEND_URL}/login?error=start_failed`);
    }
});
// ===== 🟡 카카오 콜백 (통합 UID 적용) =====
exports.kakaoCallback = (0, https_1.onRequest)({ region: 'asia-northeast3' }, async (req, res) => {
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
                client_id: KAKAO_CLIENT_ID,
                client_secret: KAKAO_CLIENT_SECRET,
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
exports.naverLoginStart = (0, https_1.onRequest)({ region: 'asia-northeast3' }, async (req, res) => {
    try {
        const state = crypto.randomBytes(32).toString('hex');
        await db.collection('oauth_states').doc(state).set({
            provider: 'naver',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
        });
        const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?` +
            `client_id=${NAVER_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(NAVER_REDIRECT_URI)}&` +
            `response_type=code&` +
            `state=${state}`;
        res.redirect(naverAuthUrl);
    }
    catch (error) {
        console.error('❌ 네이버 로그인 시작 실패:', error);
        res.redirect(`${FRONTEND_URL}/login?error=start_failed`);
    }
});
// ===== 🟢 네이버 콜백 (통합 UID 적용) =====
exports.naverCallback = (0, https_1.onRequest)({ region: 'asia-northeast3' }, async (req, res) => {
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
                client_id: NAVER_CLIENT_ID,
                client_secret: NAVER_CLIENT_SECRET,
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
