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
exports.naverCallback = exports.naverLoginStart = exports.kakaoCallback = exports.kakaoLoginStart = exports.polishContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const generative_ai_1 = require("@google/generative-ai");
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
// Firebase Admin 초기화
if (!admin.apps.length) {
    admin.initializeApp();
}
// ===== 환경변수 직접 설정 =====
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const KAKAO_CLIENT_ID = 'b910c15fde12b678e612c23aa56fe27f';
const KAKAO_CLIENT_SECRET = 'a2wUyOK1MK9TcfSYw6e7BET7aU8Gn1au';
const NAVER_CLIENT_ID = 'mRSWCHU_IHbPE7teR4P5';
const NAVER_CLIENT_SECRET = 'EpEDTAjryH';
const FRONTEND_URL = 'https://haru2026-8abb8.web.app';
const KAKAO_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/kakaoCallback';
const NAVER_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/naverCallback';
const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
const db = admin.firestore();
// ===== 🎨 AI 다듬기 =====
exports.polishContent = (0, https_2.onCall)({ region: 'asia-northeast3' }, async (request) => {
    try {
        const { text, mode = 'premium' } = request.data;
        if (!text || typeof text !== 'string') {
            throw new https_2.HttpsError('invalid-argument', '텍스트가 필요합니다.');
        }
        let systemPrompt = '';
        if (mode === 'basic') {
            systemPrompt = `당신은 신중한 편집자입니다.
원문을 최대한 유지하며 맞춤법과 어색한 표현만 교정하세요.
존댓말 유지, 내용 추가 금지, 문단 분리 금지.`;
        }
        else {
            systemPrompt = `당신은 재능있는 에세이 작가입니다.
감동적인 글로 재구성하되 존댓말 유지.
새로운 사건 추가 금지.`;
        }
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt
        });
        const result = await model.generateContent(text);
        const polishedText = result.response.text();
        return { text: polishedText };
    }
    catch (error) {
        console.error('AI 처리 실패:', error);
        throw new https_2.HttpsError('internal', 'AI 처리에 실패했습니다.');
    }
});
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
            `state=${state}`;
        res.redirect(kakaoAuthUrl);
    }
    catch (error) {
        console.error('❌ 카카오 로그인 시작 실패:', error);
        res.redirect(`${FRONTEND_URL}/login?error=start_failed`);
    }
});
// ===== 🟡 카카오 콜백 =====
exports.kakaoCallback = (0, https_1.onRequest)({ region: 'asia-northeast3' }, async (req, res) => {
    var _a, _b, _c, _d, _e;
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
        const uid = `kakao_${kakaoUser.id}`;
        const email = ((_a = kakaoUser.kakao_account) === null || _a === void 0 ? void 0 : _a.email) || `kakao_${kakaoUser.id}@placeholder.local`;
        const displayName = ((_c = (_b = kakaoUser.kakao_account) === null || _b === void 0 ? void 0 : _b.profile) === null || _c === void 0 ? void 0 : _c.nickname) || `kakao_user_${kakaoUser.id}`;
        const photoURL = ((_e = (_d = kakaoUser.kakao_account) === null || _d === void 0 ? void 0 : _d.profile) === null || _e === void 0 ? void 0 : _e.profile_image_url) || null;
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
// ===== 🟢 네이버 콜백 =====
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
        const uid = `naver_${naverUser.id}`;
        const email = naverUser.email || `naver_${naverUser.id}@placeholder.local`;
        const displayName = naverUser.name || `naver_user_${naverUser.id}`;
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
