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
exports.getWordMeaning = exports.polishElderBookChapters = exports.draftElderBookChapters = exports.assignElderBookSources = exports.buildElderBookOutline = exports.gatherElderBookSources = exports.convertToBookMaterial = exports.generateLawsuitClaimReason = exports.convertSnsToDiary = exports.analyzeFacebookZip = exports.suggestChapterTitle = exports.generateBook = exports.cleanupTtsUsage = exports.generateTTS = exports.lawPrecedent = exports.lawEasyExplain = exports.unpublishHaruLawSharedCard = exports.publishHaruLawSharedCard = exports.prepareHaruLawSharePreview = exports.lawSearch = exports.removeAllTags = exports.subscribeWithBillingKey = exports.verifyPayment = exports.generateGrowthTimelinePdf = exports.extractLedgerTextFromImage = exports.extractStockTradeTextFromPhoto = exports.extractReadingBookTextFromPhoto = exports.deleteRecordImage = exports.convertHeic = exports.sendBroadcastNotification = exports.scheduledPushNotification = exports.sendTestNotification = exports.copyHaruDriveAssets = exports.getHaruDriveCandidates = exports.haruDriveCallback = exports.startHaruDriveConnect = exports.googleCallback = exports.googleLoginStart = exports.naverCallback = exports.naverLoginStart = exports.kakaoCallback = exports.kakaoLoginStart = exports.generateTitlesForAll = exports.clearKeywordsCache = exports.extractKeywords = exports.generateHaruMemo = exports.extractTitle = exports.polishContent = exports.searchOfficialDrugs = exports.reverseGeocodeKakao = void 0;
exports.getKoreanPlantInfo = exports.copyOneDriveAssets = exports.getOneDriveCandidates = exports.getOneDriveConnectionState = exports.ensureOneDriveHaruFolder = exports.oneDriveCallback = exports.startOneDriveConnect = exports.testNibrPlantSearch = exports.detectPlantAdvanced = exports.analyzePlantPhoto = exports.extractKNewsMetadata = exports.analyzeSymptomsForSpecialty = exports.analyzeDrugPhoto = exports.getHospitalList = exports.getDrugInfo = exports.getOnbidRealEstateList = exports.getCustomToken = exports.getVerseWordMapping = exports.getVerseTranslation = exports.generateHaruProphecy = exports.analyzeRecordForProphecy = exports.refreshNews = exports.translateToEnglish = exports.getVerseQuiz = exports.preloadChapterGrammar = exports.getGrammarExplain = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const storage_1 = require("firebase-admin/storage");
const params_1 = require("firebase-functions/params");
const generative_ai_1 = require("@google/generative-ai");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const fs = __importStar(require("fs"));
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
const KAKAO_REST_API_KEY_SECRET = (0, params_1.defineSecret)('KAKAO_REST_API_KEY');
const NAVER_CLIENT_ID_SECRET = (0, params_1.defineSecret)('NAVER_CLIENT_ID');
const NAVER_CLIENT_SECRET_SECRET = (0, params_1.defineSecret)('NAVER_CLIENT_SECRET');
const PORTONE_API_SECRET = (0, params_1.defineSecret)('PORTONE_API_SECRET');
const LAW_API_KEY_SECRET = (0, params_1.defineSecret)('LAW_API_KEY');
const GOOGLE_CLOUD_API_KEY_SECRET = (0, params_1.defineSecret)('GOOGLE_CLOUD_API_KEY');
const OPENAI_API_KEY_SECRET = (0, params_1.defineSecret)('OPENAI_API_KEY');
const COLLECTOR_SECRET_KEY = (0, params_1.defineSecret)('COLLECTOR_SECRET_KEY');
const ONBID_API_KEY_SECRET = (0, params_1.defineSecret)('ONBID_API_KEY');
const DRUG_API_KEY_SECRET = (0, params_1.defineSecret)('DRUG_API_KEY');
const DRUG_API_SERVICE_KEY_SECRET = (0, params_1.defineSecret)('DRUG_API_SERVICE_KEY');
const HIRA_API_KEY_SECRET = (0, params_1.defineSecret)('HIRA_API_KEY');
const KINDWISE_PLANT_ID_API_KEY_SECRET = (0, params_1.defineSecret)('KINDWISE_PLANT_ID_API_KEY');
const PLANTNET_API_KEY_SECRET = (0, params_1.defineSecret)('PLANTNET_API_KEY');
const MICROSOFT_CLIENT_ID_SECRET = (0, params_1.defineSecret)('MICROSOFT_CLIENT_ID');
const MICROSOFT_CLIENT_SECRET_SECRET = (0, params_1.defineSecret)('MICROSOFT_CLIENT_SECRET');
const FRONTEND_URL = 'https://haru2026-8abb8.web.app';
// Storage 버킷
const bucket = () => (0, storage_1.getStorage)().bucket();
const DEVELOPER_UIDS = new Set([
    'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8',
]);
const READING_BOOK_OCR_LIMIT = 20;
const KAKAO_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/kakaoCallback';
const NAVER_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/naverCallback';
const GOOGLE_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/googleCallback';
const HARU_DRIVE_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/haruDriveCallback';
const ONEDRIVE_REDIRECT_URI = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/oneDriveCallback';
const ONEDRIVE_OAUTH_SCOPE = 'offline_access Files.ReadWrite User.Read';
const db = admin.firestore();
const SUBSCRIPTION_PLANS = {
    3500: 'basic',
    5000: 'premium',
};
const HARU_LAW_SHARE_DISCLAIMER = '본 내용은 법령 정보 제공 목적이며, 전문적인 법률·세무 자문을 대체하지 않습니다.\n구체적인 사건은 관련 자료를 가지고 전문가 상담을 받으시기 바랍니다.';
const HARU_LAW_SHARE_PREVIEW_TTL_MS = 30 * 60 * 1000;
const HARU_LAW_SHARE_DAILY_PREVIEW_LIMIT = 3;
function getSafeOAuthError(error) {
    var _a, _b;
    if (axios_1.default.isAxiosError(error)) {
        const data = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || {};
        return {
            message: error.message,
            status: (_b = error.response) === null || _b === void 0 ? void 0 : _b.status,
            providerError: typeof data.error === 'string' ? data.error : undefined,
            providerErrorCode: typeof data.error_code === 'string' ? data.error_code : undefined,
            providerErrorDescription: typeof data.error_description === 'string'
                ? data.error_description.slice(0, 120)
                : undefined,
        };
    }
    return {
        message: (error === null || error === void 0 ? void 0 : error.message) || String(error),
    };
}
function parseCoordinate(value, label) {
    const numeric = typeof value === 'number' ? value : Number(String(value !== null && value !== void 0 ? value : '').trim());
    if (!Number.isFinite(numeric)) {
        throw new https_2.HttpsError('invalid-argument', `${label} 좌표가 올바르지 않습니다`);
    }
    return numeric;
}
function buildKakaoRegionLabel(doc) {
    return [
        doc === null || doc === void 0 ? void 0 : doc.region_1depth_name,
        doc === null || doc === void 0 ? void 0 : doc.region_2depth_name,
        doc === null || doc === void 0 ? void 0 : doc.region_3depth_name,
    ]
        .filter((part) => typeof part === 'string' && part.trim())
        .join(' ');
}
function getSafeKakaoLocalError(error) {
    var _a, _b;
    if (axios_1.default.isAxiosError(error)) {
        const data = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || {};
        return {
            message: error.message,
            status: (_b = error.response) === null || _b === void 0 ? void 0 : _b.status,
            code: error.code,
            kakaoErrorType: typeof data.errorType === 'string' ? data.errorType : undefined,
            kakaoMessage: typeof data.message === 'string' ? data.message.slice(0, 120) : undefined,
        };
    }
    return {
        message: (error === null || error === void 0 ? void 0 : error.message) || String(error),
    };
}
// 좌표 주변 장소명(POI) 후보 조회 — 호텔/관광지/문화시설/음식점/카페 등
// (예: 경주나한호텔, 롯데호텔). 행정구역·주소만으로는 부족한 경우를 보완한다.
const KAKAO_POI_CATEGORY_CODES = ['AD5', 'AT4', 'CT1', 'FD6', 'CE7'];
const KAKAO_POI_RADIUS_M = 100;
async function lookupKakaoNearbyPlace(headers, x, y) {
    var _a;
    try {
        const responses = await Promise.all(KAKAO_POI_CATEGORY_CODES.map((code) => axios_1.default
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
            .catch(() => null)));
        let nearest = null;
        for (const resp of responses) {
            const docs = Array.isArray((_a = resp === null || resp === void 0 ? void 0 : resp.data) === null || _a === void 0 ? void 0 : _a.documents) ? resp.data.documents : [];
            for (const doc of docs) {
                const name = typeof (doc === null || doc === void 0 ? void 0 : doc.place_name) === 'string' ? doc.place_name.trim() : '';
                if (!name)
                    continue;
                const parsed = Number(doc === null || doc === void 0 ? void 0 : doc.distance);
                const distance = Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
                if (!nearest || distance < nearest.distance) {
                    nearest = {
                        name,
                        category: typeof (doc === null || doc === void 0 ? void 0 : doc.category_group_name) === 'string' ? doc.category_group_name : '',
                        distance,
                    };
                }
            }
        }
        if (!nearest)
            return null;
        return { placeName: nearest.name, placeCategory: nearest.category };
    }
    catch (error) {
        logger.warn('카카오 장소명 조회 실패:', getSafeKakaoLocalError(error));
        return null;
    }
}
exports.reverseGeocodeKakao = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [KAKAO_REST_API_KEY_SECRET],
    timeoutSeconds: 15,
}, async (request) => {
    var _a, _b, _c, _d, _f, _g;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const latitude = parseCoordinate((_a = request.data) === null || _a === void 0 ? void 0 : _a.latitude, 'latitude');
    const longitude = parseCoordinate((_b = request.data) === null || _b === void 0 ? void 0 : _b.longitude, 'longitude');
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new https_2.HttpsError('invalid-argument', '좌표 범위가 올바르지 않습니다');
    }
    const headers = {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY_SECRET.value().trim()}`,
        Accept: 'application/json',
    };
    const params = { x: String(longitude), y: String(latitude) };
    try {
        const [regionResp, addressResp, placeInfo] = await Promise.all([
            axios_1.default.get('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json', {
                params,
                headers,
                timeout: 8000,
            }),
            axios_1.default.get('https://dapi.kakao.com/v2/local/geo/coord2address.json', {
                params,
                headers,
                timeout: 8000,
            }),
            lookupKakaoNearbyPlace(headers, params.x, params.y),
        ]);
        const regionDocs = Array.isArray((_c = regionResp.data) === null || _c === void 0 ? void 0 : _c.documents) ? regionResp.data.documents : [];
        const addressDocs = Array.isArray((_d = addressResp.data) === null || _d === void 0 ? void 0 : _d.documents) ? addressResp.data.documents : [];
        const regionDoc = regionDocs.find((doc) => (doc === null || doc === void 0 ? void 0 : doc.region_type) === 'H') || regionDocs[0] || null;
        const addressDoc = addressDocs[0] || null;
        const roadAddress = ((_f = addressDoc === null || addressDoc === void 0 ? void 0 : addressDoc.road_address) === null || _f === void 0 ? void 0 : _f.address_name) || '';
        const jibunAddress = ((_g = addressDoc === null || addressDoc === void 0 ? void 0 : addressDoc.address) === null || _g === void 0 ? void 0 : _g.address_name) || '';
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
            placeName: (placeInfo === null || placeInfo === void 0 ? void 0 : placeInfo.placeName) || '',
            placeCategory: (placeInfo === null || placeInfo === void 0 ? void 0 : placeInfo.placeCategory) || '',
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
    }
    catch (error) {
        logger.warn('카카오 좌표 주소 변환 실패:', getSafeKakaoLocalError(error));
        return {
            success: false,
            reason: 'kakao_api_error',
            latitude,
            longitude,
        };
    }
});
function normalizeReadingBookField(s) {
    return String(s || '')
        .normalize('NFC')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}
function makeReadingBookIdForFunction(title, author) {
    const t = normalizeReadingBookField(title);
    const a = normalizeReadingBookField(author);
    if (!t && !a)
        return '';
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
const DRUG_API_BASE_URL = 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';
function normalizeDrugSearchTerm(input) {
    return input
        .replace(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)+\s*(?:mg|m|g|ml|mcg|ug|iu|㎎|μg|밀리그램|마이크로그램|그램|밀리리터|%)?/gi, ' ')
        .replace(/\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|ug|iu|㎎|μg|밀리그램|마이크로그램|그램|밀리리터|%)/gi, ' ')
        .replace(/[()[\]{}<>]/g, ' ')
        .replace(/[,:;]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function encodeServiceKeyForQuery(serviceKey) {
    return /%[0-9A-Fa-f]{2}/.test(serviceKey) ? serviceKey : encodeURIComponent(serviceKey);
}
function readDrugApiItems(data) {
    var _a;
    const items = (_a = data === null || data === void 0 ? void 0 : data.body) === null || _a === void 0 ? void 0 : _a.items;
    if (Array.isArray(items))
        return items;
    if (Array.isArray(items === null || items === void 0 ? void 0 : items.item))
        return items.item;
    if ((items === null || items === void 0 ? void 0 : items.item) && typeof items.item === 'object')
        return [items.item];
    if (Array.isArray(data === null || data === void 0 ? void 0 : data.items))
        return data.items;
    return [];
}
function readDrugTotalCount(data, fallback) {
    var _a, _b;
    const totalCount = Number((_b = (_a = data === null || data === void 0 ? void 0 : data.body) === null || _a === void 0 ? void 0 : _a.totalCount) !== null && _b !== void 0 ? _b : data === null || data === void 0 ? void 0 : data.totalCount);
    return Number.isFinite(totalCount) ? totalCount : fallback;
}
function readDrugField(item, keys) {
    for (const key of keys) {
        const value = item[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}
function normalizeDrugApiItem(item) {
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
exports.searchOfficialDrugs = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [DRUG_API_SERVICE_KEY_SECRET],
    timeoutSeconds: 30,
}, async (request) => {
    var _a, _b, _c;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const originalInput = typeof ((_a = request.data) === null || _a === void 0 ? void 0 : _a.originalInput) === 'string'
        ? request.data.originalInput.trim()
        : '';
    const queryInput = typeof ((_b = request.data) === null || _b === void 0 ? void 0 : _b.query) === 'string'
        ? request.data.query.trim()
        : originalInput;
    const query = normalizeDrugSearchTerm(queryInput);
    if (query.length < 2) {
        throw new https_2.HttpsError('invalid-argument', '약 이름을 2자 이상 입력해주세요.');
    }
    const serviceKey = DRUG_API_SERVICE_KEY_SECRET.value().trim();
    if (!serviceKey) {
        throw new https_2.HttpsError('failed-precondition', '공식 의약품 API 키가 설정되지 않았습니다.');
    }
    const url = `${DRUG_API_BASE_URL}?serviceKey=${encodeServiceKeyForQuery(serviceKey)}` +
        `&type=json&pageNo=1&numOfRows=30&itemName=${encodeURIComponent(query)}`;
    try {
        const response = await axios_1.default.get(url, {
            timeout: 12000,
            validateStatus: (status) => status >= 200 && status < 500,
        });
        if (response.status >= 400) {
            logger.error('공식 의약품 API 오류 응답:', {
                status: response.status,
                data: response.data,
            });
            throw new https_2.HttpsError('internal', '공식 의약품 검색 서버 응답이 올바르지 않습니다.');
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
    }
    catch (error) {
        if (error instanceof https_2.HttpsError)
            throw error;
        logger.error('공식 의약품 검색 실패:', {
            message: error === null || error === void 0 ? void 0 : error.message,
            response: (_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.data,
        });
        throw new https_2.HttpsError('internal', '공식 의약품 검색에 실패했습니다.');
    }
});
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
        // SAYU 형식별 3그룹 분기 (2026-05-13 도입)
        // 풍성형: 감성·문학 표현 환영
        // 균형형: 사실+감정 균형
        // 보수형: 사실 중심, 보수적 (디폴트 — 알 수 없는 format도 여기로)
        const RICH_FORMATS = ['diary', 'essay', 'travel'];
        const BALANCED_FORMATS = ['garden', 'pet', 'child'];
        const CONSERVATIVE_FORMATS = ['mission', 'report', 'work', 'memo'];
        const normalizedFormat = typeof format === 'string' ? format.toLowerCase().trim() : '';
        let formatGroup;
        if (RICH_FORMATS.includes(normalizedFormat)) {
            formatGroup = 'rich';
        }
        else if (BALANCED_FORMATS.includes(normalizedFormat)) {
            formatGroup = 'balanced';
        }
        else {
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
        }
        else if (formatGroup === 'rich') {
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
        }
        else if (formatGroup === 'balanced') {
            // 균형형 — 텃밭일지·반려동물·육아일기
            systemPrompt = `당신은 한국 중장년층의 일상 기록을 다듬는 에세이 작가입니다.
원문의 사실·감정·날짜·인물·장소는 그대로 보존하며, 다음을 자연스럽게 다듬습니다:
1. 사실 묘사 정돈: 관찰한 내용을 명확하고 읽기 좋게 정리
2. 감정 보존: 원문에 드러난 따뜻함·기쁨·걱정 등을 자연스럽게 살림
3. 문장 호흡: 자연스러운 리듬으로 다듬기

엄격한 금지: 새로운 사건·관찰·인물 추가 / 원문에 없는 감정 창작 / 시적 비유 과용 / 소제목 / 마크다운 기호 / 교훈
유지: 존댓말 / 시제 / 인칭 / 사실 관계 / 관찰의 객관성

본문만 자연스럽게 이어지는 문단으로 작성하세요.`;
        }
        else {
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value()); // 🔐 Secret 값 사용
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
    }
    catch (error) {
        console.error('제목 추출 실패:', error);
        throw new https_2.HttpsError('internal', '제목 추출에 실패했습니다.');
    }
});
// ===== 🔑 SAYU 리스트 미리보기 키워드 추출 =====
// 본문에서 핵심 고유어(서비스명·전략명·시장명·기능명·제품명) 3~6개를 JSON 배열로 반환.
// 일반 추상명사·1글자·단독 "AI" 등은 후처리에서 제거.
const KW_STRICT_STOP = new Set([
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
exports.generateHaruMemo = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    try {
        const { formatType, fields, date } = (request.data || {});
        if (!formatType || typeof formatType !== 'string') {
            throw new https_2.HttpsError('invalid-argument', 'formatType이 필요합니다.');
        }
        if (!fields || typeof fields !== 'object') {
            throw new https_2.HttpsError('invalid-argument', 'fields가 필요합니다.');
        }
        // 메타·이미지·sayu·점수 같은 비-본문 필드 제외 후 텍스트 합성
        const META_SUFFIXES = ['_sayu', '_polished', '_polishedAt', '_mode', '_stats', '_images', '_rating', '_keywords', '_ai_title', '_tags', '_space', '_style'];
        const lines = [];
        Object.keys(fields).forEach((k) => {
            if (META_SUFFIXES.some((s) => k.endsWith(s)))
                return;
            const v = fields[k];
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
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
    }
    catch (error) {
        if (error instanceof https_2.HttpsError)
            throw error;
        console.error('HARU 메모 생성 실패:', error);
        throw new https_2.HttpsError('internal', 'HARU 메모 생성에 실패했습니다.');
    }
});
exports.extractKeywords = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET]
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    try {
        const { text, title, max } = request.data || {};
        if (!text || typeof text !== 'string' || !text.trim()) {
            throw new https_2.HttpsError('invalid-argument', '텍스트가 필요합니다.');
        }
        // 클라이언트가 더 큰 값을 보내도 6으로 cap. 최소 3.
        const requested = typeof max === 'number' && max > 0 && max <= 20 ? Math.floor(max) : 6;
        const limit = Math.max(3, Math.min(6, requested));
        const titleLine = typeof title === 'string' && title.trim() ? title.trim().slice(0, 80) : '';
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
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
        let parsed = null;
        try {
            parsed = JSON.parse(cleaned);
        }
        catch {
            const m = cleaned.match(/\[[\s\S]*?\]/);
            if (m) {
                try {
                    parsed = JSON.parse(m[0]);
                }
                catch { /* keep null */ }
            }
        }
        if (!Array.isArray(parsed))
            return { keywords: [] };
        const keywords = parsed
            .filter((k) => typeof k === 'string')
            .map((k) => k.trim().replace(/^["'`*#\-•·\s]+|["'`*#\-•·\s]+$/g, '').trim())
            .filter((k) => k.length >= 2 && k.length <= 14)
            .filter((k) => !KW_STRICT_STOP.has(k) && !KW_STRICT_STOP.has(k.toLowerCase()))
            .filter((k) => !/^\d+$/.test(k))
            .filter((k) => !KW_NUMUNIT_RE.test(k))
            .filter((k, i, arr) => arr.indexOf(k) === i)
            .slice(0, limit);
        return { keywords };
    }
    catch (error) {
        console.error('키워드 추출 실패:', error);
        throw new https_2.HttpsError('internal', '키워드 추출에 실패했습니다.');
    }
});
// ===== 🧹 기존 저품질 keywords 캐시 일괄 삭제 (호출자 본인 데이터 한정) =====
// 사용법: 브라우저 콘솔에서 한 줄 호출 — 결과로 {docsExamined, docsUpdated, fieldsCleared} 반환.
// const { getFunctions, httpsCallable } = await import('firebase/functions');
// const r = await httpsCallable(getFunctions(undefined,'asia-northeast3'),'clearKeywordsCache')();
// console.log(r.data);
exports.clearKeywordsCache = (0, https_2.onCall)({ region: 'asia-northeast3' }, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
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
        const data = docSnap.data();
        const updates = {};
        Object.keys(data).forEach((k) => {
            if (k === 'keywords' || k.endsWith('_keywords')) {
                updates[k] = FieldValue.delete();
                fieldsCleared++;
            }
        });
        if (Object.keys(updates).length === 0)
            continue;
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
    const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    if (request.auth.uid !== DEV_UID) {
        throw new https_2.HttpsError('permission-denied', '개발자 전용 기능입니다');
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
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
                    updates[`${prefix}_ai_title`] = title;
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
    var _a, _b, _c, _d, _f;
    try {
        const { code, state } = req.query;
        if (!code || typeof code !== 'string')
            throw new Error('Invalid code');
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
        const kakaoTokenParams = {
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
            tokenResponse = await axios_1.default.post('https://kauth.kakao.com/oauth/token', null, {
                params: kakaoTokenParams,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
        }
        catch (tokenError) {
            const data = axios_1.default.isAxiosError(tokenError) ? (_a = tokenError.response) === null || _a === void 0 ? void 0 : _a.data : null;
            if (kakaoClientSecret &&
                ((_b = tokenError === null || tokenError === void 0 ? void 0 : tokenError.response) === null || _b === void 0 ? void 0 : _b.status) === 401 &&
                (data === null || data === void 0 ? void 0 : data.error) === 'invalid_client') {
                logger.warn('카카오 client_secret 거절됨. client_secret 없이 토큰 교환 재시도');
                const { client_secret, ...retryParams } = kakaoTokenParams;
                tokenResponse = await axios_1.default.post('https://kauth.kakao.com/oauth/token', null, {
                    params: retryParams,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });
            }
            else {
                throw tokenError;
            }
        }
        const { access_token } = tokenResponse.data;
        const userResponse = await axios_1.default.get('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${access_token}` } });
        const kakaoUser = userResponse.data;
        if (!kakaoUser.id) {
            throw new Error('카카오 사용자 ID를 가져올 수 없습니다');
        }
        const email = ((_c = kakaoUser.kakao_account) === null || _c === void 0 ? void 0 : _c.email) || `kakao_${kakaoUser.id}@placeholder.local`;
        const displayName = ((_f = (_d = kakaoUser.kakao_account) === null || _d === void 0 ? void 0 : _d.profile) === null || _f === void 0 ? void 0 : _f.nickname) || `kakao_user_${kakaoUser.id}`;
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
        logger.error('❌ 카카오 콜백 실패:', getSafeOAuthError(error));
        res.redirect(`${FRONTEND_URL}/login?error=kakao_login_failed`);
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
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const HARU_DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/drive.file',
];
const DRIVE_FILE_FIELDS = 'id,name,mimeType,modifiedTime,webViewLink,iconLink,thumbnailLink';
const DRIVE_FILE_FIELDS_PARAM = `files(${DRIVE_FILE_FIELDS})`;
function driveTokenRef(uid) {
    return db.doc(`users/${uid}/integrations/googleDrive`);
}
function isHaruAssetCandidate(file) {
    const mimeType = file.mimeType || '';
    return (mimeType === 'application/pdf' ||
        mimeType.startsWith('image/') ||
        mimeType === 'application/vnd.google-apps.document' ||
        mimeType === 'application/vnd.google-apps.spreadsheet' ||
        mimeType === 'application/vnd.google-apps.presentation');
}
function getDriveFileKind(mimeType) {
    if (mimeType === 'application/pdf')
        return 'PDF';
    if (mimeType.startsWith('image/'))
        return '이미지';
    if (mimeType === 'application/vnd.google-apps.document')
        return '문서';
    if (mimeType === 'application/vnd.google-apps.spreadsheet')
        return '스프레드시트';
    if (mimeType === 'application/vnd.google-apps.presentation')
        return '프레젠테이션';
    return '파일';
}
async function refreshDriveAccessToken(uid, tokenData) {
    var _a;
    const expiresAt = ((_a = tokenData.expiresAt) === null || _a === void 0 ? void 0 : _a.toMillis()) || 0;
    if (tokenData.accessToken && expiresAt > Date.now() + 60 * 1000) {
        return tokenData.accessToken;
    }
    if (!tokenData.refreshToken) {
        throw new https_2.HttpsError('failed-precondition', 'Google Drive 연결이 만료되었습니다. 다시 연결해 주세요.');
    }
    const tokenResponse = await axios_1.default.post('https://oauth2.googleapis.com/token', {
        client_id: GOOGLE_CLIENT_ID_SECRET.value(),
        client_secret: GOOGLE_CLIENT_SECRET_SECRET.value(),
        refresh_token: tokenData.refreshToken,
        grant_type: 'refresh_token',
    });
    const accessToken = tokenResponse.data.access_token;
    const expiresIn = Number(tokenResponse.data.expires_in || 3600);
    await driveTokenRef(uid).set({
        accessToken,
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + expiresIn * 1000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return accessToken;
}
async function getDriveAccessToken(uid) {
    const snap = await driveTokenRef(uid).get();
    if (!snap.exists) {
        throw new https_2.HttpsError('failed-precondition', 'Google Drive 연결이 필요합니다.');
    }
    return refreshDriveAccessToken(uid, snap.data());
}
async function ensureHaruDriveFolder(accessToken) {
    var _a;
    const folderQuery = [
        "name = 'HARU'",
        `mimeType = '${DRIVE_FOLDER_MIME}'`,
        'trashed = false',
    ].join(' and ');
    const existing = await axios_1.default.get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
            q: folderQuery,
            spaces: 'drive',
            pageSize: 1,
            fields: DRIVE_FILE_FIELDS_PARAM,
        },
    });
    const first = (_a = existing.data.files) === null || _a === void 0 ? void 0 : _a[0];
    if (first)
        return first;
    const created = await axios_1.default.post('https://www.googleapis.com/drive/v3/files', { name: 'HARU', mimeType: DRIVE_FOLDER_MIME }, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { fields: DRIVE_FILE_FIELDS },
    });
    return created.data;
}
// ===== 📦 HARU자산탐정: Google Drive 연결 시작 =====
exports.startHaruDriveConnect = (0, https_2.onCall)({
    region: 'asia-northeast3',
    cors: [
        'https://haru2026-8abb8.web.app',
        'https://haru2026.com',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET],
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
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
});
// ===== 📦 HARU자산탐정: Google Drive OAuth 콜백 =====
exports.haruDriveCallback = (0, https_1.onRequest)({
    region: 'asia-northeast3',
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET],
}, async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || typeof code !== 'string')
            throw new Error('Invalid code');
        if (!state || typeof state !== 'string')
            throw new Error('Invalid state');
        const stateDoc = await db.collection('oauth_states').doc(state).get();
        if (!stateDoc.exists)
            throw new Error('State not found');
        const stateData = stateDoc.data();
        if ((stateData === null || stateData === void 0 ? void 0 : stateData.provider) !== 'haru-drive')
            throw new Error('Invalid provider');
        if ((stateData === null || stateData === void 0 ? void 0 : stateData.expiresAt.toMillis()) < Date.now())
            throw new Error('State expired');
        await stateDoc.ref.delete();
        const tokenResponse = await axios_1.default.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: GOOGLE_CLIENT_ID_SECRET.value(),
            client_secret: GOOGLE_CLIENT_SECRET_SECRET.value(),
            redirect_uri: HARU_DRIVE_REDIRECT_URI,
            grant_type: 'authorization_code',
        });
        const tokenData = tokenResponse.data;
        await driveTokenRef(stateData.uid).set({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || null,
            scope: tokenData.scope || HARU_DRIVE_SCOPES.join(' '),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + Number(tokenData.expires_in || 3600) * 1000),
            connectedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        res.redirect(`${FRONTEND_URL}/asset-explorer?drive=connected`);
    }
    catch (error) {
        console.error('❌ HARU Drive 콜백 실패:', error);
        res.redirect(`${FRONTEND_URL}/asset-explorer?drive=error`);
    }
});
// ===== 📦 HARU자산탐정: 최근 후보 탐색 + /HARU 폴더 보장 =====
exports.getHaruDriveCandidates = (0, https_2.onCall)({
    region: 'asia-northeast3',
    cors: [
        'https://haru2026-8abb8.web.app',
        'https://haru2026.com',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET],
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    const accessToken = await getDriveAccessToken(uid);
    const folder = await ensureHaruDriveFolder(accessToken);
    const response = await axios_1.default.get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
            q: 'trashed = false',
            spaces: 'drive',
            pageSize: 30,
            orderBy: 'modifiedTime desc',
            fields: DRIVE_FILE_FIELDS_PARAM,
        },
    });
    const candidates = (response.data.files || [])
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
});
// ===== 📦 HARU자산탐정: 선택 파일만 /HARU 폴더로 복사 =====
exports.copyHaruDriveAssets = (0, https_2.onCall)({
    region: 'asia-northeast3',
    cors: [
        'https://haru2026-8abb8.web.app',
        'https://haru2026.com',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
    secrets: [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET],
}, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const fileIds = Array.isArray((_a = request.data) === null || _a === void 0 ? void 0 : _a.fileIds)
        ? request.data.fileIds.filter((id) => typeof id === 'string' && id.trim())
        : [];
    if (fileIds.length === 0) {
        throw new https_2.HttpsError('invalid-argument', '복사할 파일을 선택해 주세요.');
    }
    if (fileIds.length > 20) {
        throw new https_2.HttpsError('invalid-argument', '한 번에 최대 20개까지 복사할 수 있습니다.');
    }
    const uid = request.auth.uid;
    const accessToken = await getDriveAccessToken(uid);
    const folder = await ensureHaruDriveFolder(accessToken);
    const copiedAssets = [];
    for (const fileId of fileIds) {
        const source = await axios_1.default.get(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { fields: DRIVE_FILE_FIELDS },
        });
        const sourceFile = source.data;
        if (!isHaruAssetCandidate(sourceFile)) {
            continue;
        }
        const copied = await axios_1.default.post(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/copy`, {
            name: sourceFile.name,
            parents: [folder.id],
        }, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { fields: DRIVE_FILE_FIELDS },
        });
        const copiedFile = copied.data;
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
    // NotRegistered 만료 토큰 자동 삭제
    const expiredTokens = [];
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
        const { FieldValue } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
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
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dmhutjnpn';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '752573158646558';
function configureCloudinary() {
    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}
function safeCloudinarySegment(value, fallback) {
    const raw = String(value || fallback).trim();
    return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || fallback;
}
function extractCloudinaryPublicId(imageUrl) {
    try {
        const parsed = new URL(imageUrl);
        if (!parsed.hostname.includes('cloudinary.com'))
            return null;
        const parts = parsed.pathname.split('/').filter(Boolean);
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1)
            return null;
        const idParts = parts.slice(uploadIndex + 1);
        if (idParts[0] && /^v\d+$/.test(idParts[0])) {
            idParts.shift();
        }
        const publicIdWithExtension = idParts.join('/');
        return publicIdWithExtension.replace(/\.[a-zA-Z0-9]+$/, '') || null;
    }
    catch {
        return null;
    }
}
function extractFirebaseStorageTarget(imageUrl) {
    const trimmed = imageUrl.trim();
    if (!trimmed)
        return null;
    try {
        if (trimmed.startsWith('gs://')) {
            const withoutScheme = trimmed.slice('gs://'.length);
            const slashIndex = withoutScheme.indexOf('/');
            if (slashIndex === -1)
                return null;
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
    }
    catch {
        return null;
    }
    return null;
}
function isStorageObjectNotFound(error) {
    const code = String((error === null || error === void 0 ? void 0 : error.code) || '').toLowerCase();
    const message = String((error === null || error === void 0 ? void 0 : error.message) || '').toLowerCase();
    return code === '404' ||
        code.includes('not-found') ||
        message.includes('no such object') ||
        message.includes('not found');
}
exports.convertHeic = (0, https_2.onCall)({ region: 'asia-northeast3' }, async (request) => {
    const { imageBase64 } = request.data;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new https_2.HttpsError('invalid-argument', '이미지 데이터가 필요합니다.');
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
    }
    catch (error) {
        logger.error('Cloudinary HEIC 변환 오류:', error);
        throw new https_2.HttpsError('internal', `변환 실패: ${error.message}`);
    }
});
// uploadRecordImage 는 정책 복구(Firebase Storage 메인)에 따라 제거됨.
// 일반 업로드는 frontend가 Firebase Storage 직접 처리.
// HEIC만 convertHeic(임시 변환) 거친 후 Firebase Storage에 영구 저장.
exports.deleteRecordImage = (0, https_2.onCall)({ region: 'asia-northeast3' }, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
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
            throw new https_2.HttpsError('permission-denied', '삭제 권한이 없는 이미지입니다.');
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
                alreadyDeleted: (result === null || result === void 0 ? void 0 : result.result) === 'not found',
            };
        }
        catch (error) {
            if (error instanceof https_2.HttpsError)
                throw error;
            logger.error('Cloudinary 기록 사진 삭제 오류:', error);
            throw new https_2.HttpsError('internal', `삭제 실패: ${error.message}`);
        }
    }
    if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
        throw new https_2.HttpsError('invalid-argument', '이미지 URL이 필요합니다.');
    }
    const storageTarget = extractFirebaseStorageTarget(imageUrl);
    if (!storageTarget) {
        return { success: true, storage: 'unknown', skipped: true };
    }
    if (!storageTarget.path.startsWith(`users/${uid}/format_photos/`)) {
        throw new https_2.HttpsError('permission-denied', '삭제 권한이 없는 이미지입니다.');
    }
    try {
        const targetBucket = storageTarget.bucketName
            ? (0, storage_1.getStorage)().bucket(storageTarget.bucketName)
            : bucket();
        await targetBucket.file(storageTarget.path).delete();
        return { success: true, storage: 'firebase', path: storageTarget.path };
    }
    catch (error) {
        if (isStorageObjectNotFound(error)) {
            return {
                success: true,
                storage: 'firebase',
                path: storageTarget.path,
                alreadyDeleted: true,
            };
        }
        logger.error('Firebase Storage 기록 사진 삭제 오류:', error);
        throw new https_2.HttpsError('internal', `삭제 실패: ${error.message}`);
    }
});
// ===== 📚 독서사유 책 본문 사진 → 텍스트 변환 (Gemini Vision OCR) =====
exports.extractReadingBookTextFromPhoto = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
}, async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
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
        throw new https_2.HttpsError('invalid-argument', '책 제목이 필요합니다.');
    }
    if (!imageBase64) {
        throw new https_2.HttpsError('invalid-argument', '이미지 데이터(imageBase64)가 필요합니다.');
    }
    const imageKb = Math.round(imageBase64.length * 0.75 / 1024);
    if (imageKb > 7 * 1024) {
        throw new https_2.HttpsError('invalid-argument', '사진이 너무 큽니다. 한 장당 7MB 이하로 줄여주세요.');
    }
    if (!isDeveloper) {
        const subSnap = await db.doc(`users/${uid}/subscription/info`).get();
        const plan = String(((_a = subSnap.data()) === null || _a === void 0 ? void 0 : _a.plan) || '').toLowerCase();
        if (plan !== 'premium') {
            throw new https_2.HttpsError('permission-denied', '책 본문 사진 텍스트 변환은 PREMIUM 구독자 전용 기능입니다.');
        }
    }
    const usageRef = db.doc(`users/${uid}/readingOcrUsage/${bookId}`);
    let usedCount = null;
    let slotReserved = false;
    if (!isDeveloper) {
        usedCount = await db.runTransaction(async (tx) => {
            var _a;
            const snap = await tx.get(usageRef);
            const current = Number(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.photoCount) || 0);
            if (current >= READING_BOOK_OCR_LIMIT) {
                throw new https_2.HttpsError('resource-exhausted', '책 한 권당 본문 사진은 총 20장까지 변환할 수 있습니다.');
            }
            const next = current + 1;
            const dataToSave = {
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
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
    }
    catch (error) {
        imageBase64 = '';
        if (slotReserved) {
            try {
                await usageRef.set({
                    photoCount: admin.firestore.FieldValue.increment(-1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            catch (rollbackError) {
                logger.warn('독서 OCR 사용량 롤백 실패', { message: rollbackError === null || rollbackError === void 0 ? void 0 : rollbackError.message });
            }
        }
        if (error instanceof https_2.HttpsError)
            throw error;
        logger.error('독서 본문 OCR 실패', { message: (_b = error === null || error === void 0 ? void 0 : error.message) === null || _b === void 0 ? void 0 : _b.slice(0, 200) });
        throw new https_2.HttpsError('internal', '책 본문 텍스트 변환에 실패했습니다. 사진을 더 또렷이 찍어 주세요.');
    }
});
// ===== 📈 주식거래 캡처 이미지 → 거래 텍스트/필드 추출 (Gemini Vision OCR) =====
exports.extractStockTradeTextFromPhoto = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
}, async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    let imageBase64 = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.imageBase64) || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const mimeType = String(((_b = request.data) === null || _b === void 0 ? void 0 : _b.mimeType) || 'image/jpeg').startsWith('image/')
        ? String(((_c = request.data) === null || _c === void 0 ? void 0 : _c.mimeType) || 'image/jpeg')
        : 'image/jpeg';
    if (!imageBase64) {
        throw new https_2.HttpsError('invalid-argument', '이미지 데이터(imageBase64)가 필요합니다.');
    }
    const imageKb = Math.round(imageBase64.length * 0.75 / 1024);
    if (imageKb > 7 * 1024) {
        throw new https_2.HttpsError('invalid-argument', '사진이 너무 큽니다. 한 장당 7MB 이하로 줄여주세요.');
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
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
        let parsed = {};
        try {
            parsed = JSON.parse(rawText);
        }
        catch {
            parsed = { text: rawText, trade: {} };
        }
        const trade = (parsed === null || parsed === void 0 ? void 0 : parsed.trade) && typeof parsed.trade === 'object' ? parsed.trade : {};
        const safeTrade = {
            stock_type: String(trade.stock_type || '').slice(0, 40),
            stock_name: String(trade.stock_name || '').slice(0, 120),
            stock_price: String(trade.stock_price || '').slice(0, 80),
            stock_quantity: String(trade.stock_quantity || '').slice(0, 80),
            stock_total: String(trade.stock_total || '').slice(0, 80),
            stock_date: String(trade.stock_date || '').slice(0, 80),
        };
        return {
            text: String((parsed === null || parsed === void 0 ? void 0 : parsed.text) || rawText || '').slice(0, 12000),
            trade: safeTrade,
        };
    }
    catch (error) {
        imageBase64 = '';
        if (error instanceof https_2.HttpsError)
            throw error;
        logger.error('주식 거래 캡처 OCR 실패', { message: (_d = error === null || error === void 0 ? void 0 : error.message) === null || _d === void 0 ? void 0 : _d.slice(0, 200) });
        throw new https_2.HttpsError('internal', '거래 캡처 텍스트 추출에 실패했습니다. 사진을 더 또렷하게 올려 주세요.');
    }
});
const LEDGER_OCR_ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
function cleanLedgerOcrText(value, maxLength) {
    return String(value !== null && value !== void 0 ? value : '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim()
        .slice(0, maxLength);
}
function maskLedgerSensitiveText(value, maxLength) {
    const cleaned = cleanLedgerOcrText(value, maxLength);
    return cleaned
        .replace(/(?:\d[\s-]?){8,}\d/g, (match) => {
        const digits = match.replace(/\D/g, '');
        if (digits.length < 8)
            return match;
        if (digits.length <= 12)
            return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
        return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
    })
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
}
function parseLedgerJsonObject(text) {
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
function normalizeLedgerType(value) {
    const compact = cleanLedgerOcrText(value, 20).replace(/\s+/g, '');
    return ['수입', '지출', '이체', '기타'].find((type) => compact.includes(type)) || '';
}
// ===== 📒 HARU보조장부 영수증/통장 캡처 → 임시 장부 필드 추출 (이미지 비저장) =====
exports.extractLedgerTextFromImage = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
}, async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const rawImages = Array.isArray((_a = request.data) === null || _a === void 0 ? void 0 : _a.images) ? request.data.images : [];
    if (rawImages.length === 0) {
        throw new https_2.HttpsError('invalid-argument', '이미지 데이터가 필요합니다.');
    }
    if (rawImages.length > 3) {
        throw new https_2.HttpsError('invalid-argument', '이미지는 최대 3장까지 처리할 수 있습니다.');
    }
    const inlineParts = [];
    let totalImageKb = 0;
    for (const rawImage of rawImages) {
        const image = rawImage;
        const mimeType = String((image === null || image === void 0 ? void 0 : image.mimeType) || 'image/jpeg').toLowerCase().trim();
        if (!LEDGER_OCR_ALLOWED_MIME_TYPES.has(mimeType)) {
            throw new https_2.HttpsError('invalid-argument', 'JPG, PNG, WEBP 이미지만 처리할 수 있습니다.');
        }
        let dataBase64 = String((image === null || image === void 0 ? void 0 : image.dataBase64) || (image === null || image === void 0 ? void 0 : image.imageBase64) || '')
            .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
        if (!dataBase64) {
            throw new https_2.HttpsError('invalid-argument', '이미지 base64 데이터가 비어 있습니다.');
        }
        const imageKb = Math.round(dataBase64.length * 0.75 / 1024);
        if (imageKb > 7 * 1024) {
            dataBase64 = '';
            throw new https_2.HttpsError('invalid-argument', '사진이 너무 큽니다. 한 장당 7MB 이하로 줄여주세요.');
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
        var _a;
        for (const part of inlineParts) {
            if ((_a = part === null || part === void 0 ? void 0 : part.inlineData) === null || _a === void 0 ? void 0 : _a.data) {
                part.inlineData.data = '';
            }
        }
    };
    try {
        logger.info('extractLedgerTextFromImage 호출', {
            uid: request.auth.uid.slice(0, 8) + '…',
            imageCount: inlineParts.length,
            totalImageKb,
        });
        const prompt = `영수증, 통장 거래내역, 계좌이체 캡처, 카드매출전표 이미지에서 HARU보조장부 입력에 필요한 텍스트와 필드를 추출하세요.

[절대 규칙]
- 이미지에 보이는 내용만 사용하고, 보이지 않는 값은 추측하지 마세요.
- 확실하지 않은 값은 빈 문자열로 둡니다.
- 계좌번호, 카드번호, 승인번호, 전화번호처럼 긴 식별번호는 원문과 메모에서 ****로 마스킹하세요.
- 세무 신고용 확정 판단을 하지 마세요. 보조장부 입력 후보만 만듭니다.
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
  "fields": {
    "transactionAt": "",
    "type": "",
    "category": "",
    "partner": "",
    "amount": "",
    "paymentMethod": "",
    "proofType": "",
    "memo": ""
  },
  "warnings": []
}`;
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
        const result = await model.generateContent([
            prompt,
            ...inlineParts,
        ]);
        const responseText = result.response.text()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
        clearInlineParts();
        const warnings = [];
        let parsed = {};
        try {
            parsed = parseLedgerJsonObject(responseText);
        }
        catch {
            parsed = { rawText: responseText, fields: {} };
            warnings.push('추출 결과 형식이 불안정해 원문 위주로 표시합니다.');
        }
        const rawFields = (parsed === null || parsed === void 0 ? void 0 : parsed.fields) && typeof parsed.fields === 'object' ? parsed.fields : {};
        const fields = {
            transactionAt: cleanLedgerOcrText(rawFields.transactionAt, 80),
            type: normalizeLedgerType(rawFields.type),
            category: maskLedgerSensitiveText(rawFields.category, 120),
            partner: maskLedgerSensitiveText(rawFields.partner, 160),
            amount: cleanLedgerOcrText(rawFields.amount, 80),
            paymentMethod: maskLedgerSensitiveText(rawFields.paymentMethod, 80),
            proofType: maskLedgerSensitiveText(rawFields.proofType, 80),
            memo: maskLedgerSensitiveText(rawFields.memo, 500),
        };
        const parsedWarnings = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.warnings)
            ? parsed.warnings
                .map((warning) => cleanLedgerOcrText(warning, 180))
                .filter(Boolean)
            : [];
        const hasAnyField = Object.values(fields).some((value) => String(value || '').trim());
        if (!hasAnyField) {
            warnings.push('장부 입력 필드를 충분히 찾지 못했습니다. 직접 확인해 주세요.');
        }
        return {
            rawText: maskLedgerSensitiveText((parsed === null || parsed === void 0 ? void 0 : parsed.rawText) || (parsed === null || parsed === void 0 ? void 0 : parsed.text) || responseText, 12000),
            fields,
            warnings: Array.from(new Set([...warnings, ...parsedWarnings])).slice(0, 6),
        };
    }
    catch (error) {
        clearInlineParts();
        if (error instanceof https_2.HttpsError)
            throw error;
        logger.error('보조장부 이미지 텍스트 추출 실패', { message: (_b = error === null || error === void 0 ? void 0 : error.message) === null || _b === void 0 ? void 0 : _b.slice(0, 200) });
        throw new https_2.HttpsError('internal', '영수증·통장 캡처 텍스트 추출에 실패했습니다. 사진을 더 또렷하게 올려 주세요.');
    }
});
const GROWTH_TIMELINE_PDF_SCHEMA_VERSION = 3;
const GROWTH_TIMELINE_PDF_MAX_ITEMS = 80;
function cleanTimelinePdfText(value, maxLength) {
    return String(value !== null && value !== void 0 ? value : '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
function formatTimelinePdfDate(value) {
    const [yyyy, mm, dd] = value.split('-');
    if (!yyyy || !mm || !dd)
        return value || '-';
    return `${yyyy}.${mm}.${dd}`;
}
function safeTimelinePdfFilename(title) {
    return `HARU타임라인_${(title || '성장타임라인').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)}.pdf`;
}
function getTimelinePdfLocationLabel(item) {
    return item.locationLabel
        || item.locationCandidate.placeName
        || item.locationCandidate.regionLabel
        || item.locationCandidate.roadAddress
        || item.locationCandidate.jibunAddress
        || '';
}
function getTimelinePdfLocationDetail(item) {
    if (item.locationCandidate.placeName) {
        return item.locationCandidate.regionLabel
            || item.locationCandidate.roadAddress
            || item.locationCandidate.jibunAddress
            || '';
    }
    return item.locationCandidate.roadAddress || item.locationCandidate.jibunAddress || '';
}
function normalizeGrowthTimelinePdfPayload(data) {
    const title = cleanTimelinePdfText(data === null || data === void 0 ? void 0 : data.title, 80) || '성장타임라인';
    const createdLabel = cleanTimelinePdfText(data === null || data === void 0 ? void 0 : data.createdLabel, 30)
        || formatTimelinePdfDate(new Date().toISOString().slice(0, 10));
    const rawItems = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : [];
    if (rawItems.length === 0) {
        throw new https_2.HttpsError('invalid-argument', 'PDF로 만들 사진이 없습니다');
    }
    if (rawItems.length > GROWTH_TIMELINE_PDF_MAX_ITEMS) {
        throw new https_2.HttpsError('invalid-argument', `사진은 최대 ${GROWTH_TIMELINE_PDF_MAX_ITEMS}장까지 PDF로 만들 수 있습니다`);
    }
    const items = rawItems.map((item, index) => {
        var _a, _b, _c, _d;
        const url = cleanTimelinePdfText(item === null || item === void 0 ? void 0 : item.url, 2000);
        if (!/^https?:\/\//.test(url)) {
            throw new https_2.HttpsError('invalid-argument', '사진 URL이 올바르지 않습니다');
        }
        const takenDate = cleanTimelinePdfText(item === null || item === void 0 ? void 0 : item.takenDate, 20);
        return {
            url,
            takenDate,
            memo: cleanTimelinePdfText(item === null || item === void 0 ? void 0 : item.memo, 500),
            order: Number.isFinite(Number(item === null || item === void 0 ? void 0 : item.order)) ? Number(item.order) : index,
            locationLabel: cleanTimelinePdfText(item === null || item === void 0 ? void 0 : item.locationLabel, 120),
            locationCandidate: {
                placeName: cleanTimelinePdfText((_a = item === null || item === void 0 ? void 0 : item.locationCandidate) === null || _a === void 0 ? void 0 : _a.placeName, 120),
                regionLabel: cleanTimelinePdfText((_b = item === null || item === void 0 ? void 0 : item.locationCandidate) === null || _b === void 0 ? void 0 : _b.regionLabel, 160),
                roadAddress: cleanTimelinePdfText((_c = item === null || item === void 0 ? void 0 : item.locationCandidate) === null || _c === void 0 ? void 0 : _c.roadAddress, 180),
                jibunAddress: cleanTimelinePdfText((_d = item === null || item === void 0 ? void 0 : item.locationCandidate) === null || _d === void 0 ? void 0 : _d.jibunAddress, 180),
            },
        };
    }).sort((a, b) => a.takenDate.localeCompare(b.takenDate) || a.order - b.order);
    return { title, createdLabel, items };
}
async function isPremiumUser(uid) {
    var _a;
    if (DEVELOPER_UIDS.has(uid))
        return true;
    const subSnap = await db.doc(`users/${uid}/subscription/info`).get();
    return subSnap.exists && ((_a = subSnap.data()) === null || _a === void 0 ? void 0 : _a.plan) === 'premium';
}
function buildGrowthTimelinePdfHash(uid, payload) {
    const stablePayload = JSON.stringify({
        schemaVersion: GROWTH_TIMELINE_PDF_SCHEMA_VERSION,
        uid,
        title: payload.title,
        createdLabel: payload.createdLabel,
        items: payload.items,
    });
    return crypto.createHash('sha256').update(stablePayload).digest('hex');
}
async function prepareTimelinePdfImage(url, widthPt, heightPt) {
    try {
        const response = await axios_1.default.get(url, {
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
    }
    catch (error) {
        logger.warn('타임라인 PDF 이미지 준비 실패:', {
            message: (error === null || error === void 0 ? void 0 : error.message) || String(error),
            urlPrefix: url.slice(0, 80),
        });
        return null;
    }
}
function registerTimelinePdfFont(doc) {
    const fontPath = path.join(__dirname, 'fonts', 'NotoSansKR.ttf');
    if (fs.existsSync(fontPath)) {
        doc.registerFont('NotoSansKR', fontPath);
        doc.font('NotoSansKR');
    }
}
function fitTimelinePdfLine(doc, text, width) {
    const value = String(text || '').trim();
    if (!value)
        return '';
    if (doc.widthOfString(value) <= width)
        return value;
    const suffix = '...';
    if (doc.widthOfString(suffix) > width)
        return '';
    let low = 0;
    let high = value.length;
    let best = 0;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = `${value.slice(0, mid).trimEnd()}${suffix}`;
        if (doc.widthOfString(candidate) <= width) {
            best = mid;
            low = mid + 1;
        }
        else {
            high = mid - 1;
        }
    }
    const prefix = value.slice(0, best).trimEnd();
    return prefix ? `${prefix}${suffix}` : suffix;
}
function splitTimelinePdfLines(doc, text, width, maxLines) {
    let remaining = String(text || '').trim();
    const lines = [];
    for (let lineIndex = 0; lineIndex < maxLines && remaining; lineIndex += 1) {
        const isLastLine = lineIndex === maxLines - 1;
        if (doc.widthOfString(remaining) <= width) {
            lines.push(remaining);
            break;
        }
        if (isLastLine) {
            const fitted = fitTimelinePdfLine(doc, remaining, width);
            if (fitted)
                lines.push(fitted);
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
            }
            else {
                high = mid - 1;
            }
        }
        if (best <= 0) {
            const fitted = fitTimelinePdfLine(doc, remaining, width);
            if (fitted)
                lines.push(fitted);
            break;
        }
        const prefix = remaining.slice(0, best);
        const lastSpace = prefix.lastIndexOf(' ');
        const cutAt = lastSpace >= Math.max(4, Math.floor(best * 0.55)) ? lastSpace : best;
        const line = remaining.slice(0, cutAt).trim();
        if (line)
            lines.push(line);
        remaining = remaining.slice(cutAt).trim();
    }
    return lines;
}
function drawTimelinePdfLines(doc, text, x, y, width, options) {
    const availableLines = typeof options.maxHeight === 'number'
        ? Math.floor(options.maxHeight / options.lineHeight)
        : options.maxLines;
    const maxLines = Math.max(0, Math.min(options.maxLines, availableLines));
    if (maxLines <= 0)
        return y;
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
async function buildGrowthTimelinePdfBuffer(payload) {
    return await new Promise(async (resolve, reject) => {
        var _a, _b;
        const doc = new PDFDocument({
            size: 'A4',
            margin: 42,
            info: {
                Title: payload.title,
                Author: 'HARU2026',
                Subject: 'HARU Timeline',
            },
        });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
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
            const periodStart = ((_a = payload.items[0]) === null || _a === void 0 ? void 0 : _a.takenDate) || '';
            const periodEnd = ((_b = payload.items[payload.items.length - 1]) === null || _b === void 0 ? void 0 : _b.takenDate) || '';
            const periodText = `${formatTimelinePdfDate(periodStart)}${periodEnd && periodEnd !== periodStart ? ` ~ ${formatTimelinePdfDate(periodEnd)}` : ''}`;
            const coverImage = payload.items[0] ? await prepareTimelinePdfImage(payload.items[0].url, pageWidth - margin * 2, 420) : null;
            if (coverImage) {
                doc.save();
                doc.roundedRect(margin, margin, pageWidth - margin * 2, 420, 12).clip();
                doc.image(coverImage, margin, margin, { width: pageWidth - margin * 2, height: 420 });
                doc.restore();
            }
            else {
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
                    }
                    else {
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
        }
        catch (error) {
            reject(error);
        }
    });
}
exports.generateGrowthTimelinePdf = (0, https_2.onCall)({ region: 'asia-northeast3', memory: '1GiB', timeoutSeconds: 300 }, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const uid = request.auth.uid;
    if (!(await isPremiumUser(uid))) {
        throw new https_2.HttpsError('permission-denied', 'PREMIUM 구독 후 이용 가능한 기능입니다');
    }
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
    return {
        success: true,
        cached: exists,
        hash,
        filePath,
        downloadUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
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
    // 금액 검증 (베이직 3,500원 / 프리미엄 5,000원)
    const paidAmount = (_c = (_b = payment.amount) === null || _b === void 0 ? void 0 : _b.total) !== null && _c !== void 0 ? _c : payment.totalAmount;
    const plan = SUBSCRIPTION_PLANS[paidAmount];
    if (!plan) {
        logger.error(`금액 불일치: 기대 3500 또는 5000, 실제 ${paidAmount}`);
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
        plan,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        paymentId,
        updatedAt: now.toISOString(),
    });
    logger.info(`✅ 결제 검증 완료 — uid: ${uid}, paymentId: ${paymentId}`);
    return { success: true };
});
// ===== 💳 정기결제 시작 (PortOne V2 빌링키) =====
exports.subscribeWithBillingKey = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    const { billingKey, plan, payMethod } = request.data || {};
    if (!billingKey || typeof billingKey !== 'string') {
        throw new https_2.HttpsError('invalid-argument', 'billingKey가 필요합니다.');
    }
    if (plan !== 'basic' && plan !== 'premium') {
        throw new https_2.HttpsError('invalid-argument', 'plan 값이 올바르지 않습니다.');
    }
    const amount = plan === 'basic' ? 3500 : 5000;
    const orderName = plan === 'basic' ? 'HARU 베이직 월 구독' : 'HARU 프리미엄 월 구독';
    const paymentId = `haru-${uid}-${Date.now()}`;
    let payment;
    try {
        const portoneRes = await axios_1.default.post(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}/billing-key`, {
            billingKey,
            orderName,
            amount: { total: amount },
            currency: 'KRW',
        }, { headers: { Authorization: `PortOne ${PORTONE_API_SECRET.value().trim()}` } });
        payment = portoneRes.data;
    }
    catch (e) {
        logger.error('PortOne 빌링키 첫 결제 실패:', ((_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.data) || e.message);
        throw new https_2.HttpsError('internal', '첫 결제에 실패했습니다.');
    }
    if ((payment === null || payment === void 0 ? void 0 : payment.status) && payment.status !== 'PAID') {
        logger.error('PortOne 빌링키 첫 결제 미완료:', {
            uid,
            paymentId,
            status: payment.status,
        });
        throw new https_2.HttpsError('failed-precondition', '첫 결제가 완료되지 않았습니다.');
    }
    const now = new Date();
    const nextBillingDate = new Date(now);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    const subRef = db.doc(`users/${uid}/subscription/info`);
    await subRef.set({
        plan,
        status: 'active',
        billingKey,
        payMethod: payMethod || null,
        startDate: now.toISOString(),
        endDate: nextBillingDate.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
        paymentId,
        updatedAt: now.toISOString(),
    });
    logger.info('✅ 정기구독 시작 — uid: %s, plan: %s, paymentId: %s', uid, plan, paymentId);
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
function isDeveloperUid(uid) {
    return DEVELOPER_UIDS.has(uid);
}
async function assertHaruLawPremiumAccess(uid) {
    var _a, _b;
    if (isDeveloperUid(uid))
        return;
    const subSnap = await db.doc(`users/${uid}/subscription/info`).get();
    const plan = String(((_a = subSnap.data()) === null || _a === void 0 ? void 0 : _a.plan) || '').toLowerCase();
    const endDate = (_b = subSnap.data()) === null || _b === void 0 ? void 0 : _b.endDate;
    const endTime = typeof endDate === 'string' ? Date.parse(endDate) : Number.NaN;
    const expired = Number.isFinite(endTime) && endTime < Date.now();
    if (plan !== 'premium' || expired) {
        throw new https_2.HttpsError('permission-denied', '하루LAW 익명 공유는 PREMIUM 구독자 전용 기능입니다.');
    }
}
function getKstDateKey() {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
async function enforceHaruLawSharePreviewLimit(uid) {
    if (isDeveloperUid(uid))
        return;
    const usageRef = db.doc(`users/${uid}/haruLawShareUsage/${getKstDateKey()}`);
    await db.runTransaction(async (tx) => {
        var _a, _b;
        const snap = await tx.get(usageRef);
        const used = Number(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.previewCount) || 0);
        if (used >= HARU_LAW_SHARE_DAILY_PREVIEW_LIMIT) {
            throw new https_2.HttpsError('resource-exhausted', '하루LAW 익명 공유 미리보기는 하루 3회까지 만들 수 있습니다.');
        }
        tx.set(usageRef, {
            previewCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: snap.exists ? ((_b = snap.data()) === null || _b === void 0 ? void 0 : _b.createdAt) || admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
}
async function getOwnedHaruLawRecord(uid, sourceRecordId) {
    if (typeof sourceRecordId !== 'string' || !sourceRecordId.trim()) {
        throw new https_2.HttpsError('invalid-argument', 'sourceRecordId가 필요합니다.');
    }
    const recordRef = db.collection('users').doc(uid).collection('records').doc(sourceRecordId.trim());
    const recordSnap = await recordRef.get();
    if (!recordSnap.exists) {
        throw new https_2.HttpsError('not-found', '원본 하루LAW 기록을 찾을 수 없습니다.');
    }
    const record = recordSnap.data() || {};
    const formats = Array.isArray(record.formats) ? record.formats : [];
    const isHaruRaw = formats.includes('HARUraw')
        || typeof record.haruraw_query === 'string'
        || typeof record.haruraw_summary === 'string';
    if (!isHaruRaw) {
        throw new https_2.HttpsError('failed-precondition', '하루LAW 기록만 익명 공유를 신청할 수 있습니다.');
    }
    return { recordRef, recordSnap, record };
}
function removeHaruLawSensitiveInfo(input) {
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
function hasHaruLawSensitivePattern(input) {
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
function clampHaruLawText(input, maxLength) {
    return removeHaruLawSensitiveInfo(input)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}
function softenHaruLawPublicText(input) {
    return clampHaruLawText(input, 1200)
        .replace(/합법입니다/g, '가능성이 있습니다')
        .replace(/문제없습니다/g, '사례관계에 따라 달라질 수 있습니다')
        .replace(/반드시 인정됩니다/g, '인정될 가능성이 있습니다')
        .replace(/무조건 가능합니다/g, '가능성이 있습니다');
}
function parseHaruLawPublicStatutes(rawArticles) {
    return String(rawArticles || '')
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((block) => {
        const headerMatch = block.match(/^\[([^\]]+)\]\s*([^\n]+)/);
        const title = clampHaruLawText((headerMatch === null || headerMatch === void 0 ? void 0 : headerMatch[1]) || '관련 법령', 60) || '관련 법령';
        const article = clampHaruLawText((headerMatch === null || headerMatch === void 0 ? void 0 : headerMatch[2]) || '관련 조문', 80) || '관련 조문';
        return {
            title,
            article,
            easySummary: '공개용 사례 판단에 참고할 관련 조문입니다. 구체적 적용은 사실관계에 따라 달라질 수 있습니다.',
        };
    });
}
function parseGeminiJsonObject(text) {
    const cleaned = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end < start) {
        throw new https_2.HttpsError('internal', '익명화 응답을 해석할 수 없습니다.');
    }
    return JSON.parse(cleaned.slice(start, end + 1));
}
function normalizeHaruLawPreview(raw, fallbackStatutes) {
    const judgmentType = ['possible', 'caution', 'need_check'].includes(raw === null || raw === void 0 ? void 0 : raw.judgmentType)
        ? raw.judgmentType
        : 'need_check';
    const relatedStatutes = Array.isArray(raw === null || raw === void 0 ? void 0 : raw.relatedStatutes)
        ? raw.relatedStatutes.slice(0, 3).map((item) => ({
            title: clampHaruLawText((item === null || item === void 0 ? void 0 : item.title) || '관련 법령', 60) || '관련 법령',
            article: clampHaruLawText((item === null || item === void 0 ? void 0 : item.article) || '', 80) || undefined,
            easySummary: softenHaruLawPublicText((item === null || item === void 0 ? void 0 : item.easySummary) || '사례관계에 따라 적용 여부가 달라질 수 있습니다.').slice(0, 240),
        }))
        : fallbackStatutes;
    return {
        title: clampHaruLawText((raw === null || raw === void 0 ? void 0 : raw.title) || '하루LAW 익명 공유 사례', 80) || '하루LAW 익명 공유 사례',
        anonymizedQuestion: softenHaruLawPublicText((raw === null || raw === void 0 ? void 0 : raw.anonymizedQuestion) || '').slice(0, 600),
        summary: softenHaruLawPublicText((raw === null || raw === void 0 ? void 0 : raw.summary) || '').slice(0, 900),
        judgmentType,
        relatedStatutes: relatedStatutes.length > 0 ? relatedStatutes : [{
                title: '관련 법령',
                article: '관련 조문',
                easySummary: '사례관계에 따라 적용 여부가 달라질 수 있습니다.',
            }],
        disclaimer: HARU_LAW_SHARE_DISCLAIMER,
    };
}
function assertHaruLawPreviewSafe(preview) {
    const combined = [
        preview.title,
        preview.anonymizedQuestion,
        preview.summary,
        preview.disclaimer,
        ...preview.relatedStatutes.flatMap((item) => [item.title, item.article || '', item.easySummary]),
    ].join('\n');
    if (!preview.title ||
        !preview.anonymizedQuestion ||
        !preview.summary ||
        hasHaruLawSensitivePattern(combined)) {
        throw new https_2.HttpsError('failed-precondition', '개인정보 보호를 위해 공유 미리보기를 만들 수 없습니다. 내용을 줄이거나 개인정보를 제거한 뒤 다시 시도해 주세요.');
    }
}
function getHaruLawSharedCardId(uid, sourceRecordId) {
    return crypto
        .createHash('sha256')
        .update(`haruLawShare:${uid}:${sourceRecordId}`)
        .digest('hex')
        .slice(0, 32);
}
// ===== ⚖️ HARUraw — 법령 검색 + Gemini 해석 =====
exports.lawSearch = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [LAW_API_KEY_SECRET, GEMINI_API_KEY_SECRET],
}, async (request) => {
    var _a, _b, _c, _d, _f;
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
        const LAW_API_KEY = LAW_API_KEY_SECRET.value().trim();
        const GEMINI_KEY = GEMINI_API_KEY_SECRET.value().trim();
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
        const axiosConfig = {
            headers: {
                Referer: 'https://haru2026.com/',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                Connection: 'close',
            },
            timeout: 10000,
        };
        const getLawXmlWithRetry = async (url) => {
            var _a;
            let lastError;
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                try {
                    return await axios_1.default.get(url, axiosConfig);
                }
                catch (error) {
                    lastError = error;
                    const status = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status;
                    const retriable = (error === null || error === void 0 ? void 0 : error.code) === 'ECONNRESET' ||
                        (error === null || error === void 0 ? void 0 : error.code) === 'ETIMEDOUT' ||
                        (error === null || error === void 0 ? void 0 : error.code) === 'ECONNABORTED' ||
                        !(error === null || error === void 0 ? void 0 : error.response) ||
                        status >= 500;
                    if (!retriable || attempt === 3) {
                        throw error;
                    }
                    logger.warn('HARUraw 법제처 API 재시도', {
                        attempt,
                        code: error === null || error === void 0 ? void 0 : error.code,
                        status,
                    });
                    await new Promise((resolve) => setTimeout(resolve, attempt * 700));
                }
            }
            throw lastError;
        };
        // 0단계: Gemini로 정확한 법령 이름 추출
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_KEY);
        const kwModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
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
        const searchRes = await getLawXmlWithRetry(searchUrl);
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
        const serviceRes = await getLawXmlWithRetry(serviceUrl);
        const lawJson = parser.parse(serviceRes.data);
        const jomuns = ((_f = (_d = lawJson === null || lawJson === void 0 ? void 0 : lawJson.법령) === null || _d === void 0 ? void 0 : _d.조문) === null || _f === void 0 ? void 0 : _f.조문단위) || [];
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
        const jomunCatalog = allJomuns
            .map((j) => `${j.articleStr}(${j.title})`)
            .join('\n');
        const selectModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
        const selectResult = await selectModel.generateContent(`다음은 ${lawName}의 조문 목차입니다.
사용자 질문 "${query}"과 가장 관련된 조문 번호를 최대 3개만 골라서
쉼표로 구분하여 출력하세요. 조문 번호만 (예: 제311조,제312조,제307조)

조문 목차:
${jomunCatalog}`);
        const selectedNums = selectResult.response.text()
            .trim()
            .split(',')
            .map((s) => s.trim());
        const cleanedJomuns = allJomuns
            .filter((j) => selectedNums.includes(j.articleStr))
            .slice(0, 3);
        // 선별 실패 시 상위 3개
        const finalJomuns = cleanedJomuns.length > 0 ? cleanedJomuns : allJomuns.slice(0, 3);
        // 4단계: Gemini로 전체 요약 생성
        const summaryModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
        const lawText = finalJomuns
            .map((j) => `${j.articleStr}(${j.title}): ${j.content}`)
            .join('\n');
        const summaryResult = await summaryModel.generateContent(`당신은 실무 경력 20년의 대한민국 법률 전문가입니다.
다음 원칙을 반드시 지키세요:

[정확성 가드레일]
- 관할 법원, 소송·소청의 제기 기한, 사전 절차(소청 전치 여부) 등
  선거의 종류(대통령·국회의원·시도지사·기초자치단체장·지방의원 등)나
  지역, 사건 유형에 따라 답이 달라지는 정보는 하나로 단정하지 마라.
- 이런 경우 유형별 갈래로 나누어 안내하라.
  (예: "선거소송 관할 — 시·도지사·국회의원·비례대표 시도의원은 대법원,
   자치구·시·군의 장·기초의원은 고등법원")
- 지방선거(시도지사·기초단체장·지방의원 등)는 소송 전에 선거소청을
  반드시 먼저 거쳐야 하는 절차임을 분명히 하라.
  "거칠 수도 있다"처럼 선택사항으로 안내하지 마라.
- 사용자가 선거의 종류나 구체적 상황을 밝히지 않았다면, 단정하기 전에
  주요 갈래를 모두 제시하라.
- 이 원칙은 관할·기한·절차 등 분기되는 모든 법률 정보에 동일 적용된다.

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
exports.prepareHaruLawSharePreview = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
}, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await assertHaruLawPremiumAccess(uid);
    await enforceHaruLawSharePreviewLimit(uid);
    try {
        const { record } = await getOwnedHaruLawRecord(uid, (_a = request.data) === null || _a === void 0 ? void 0 : _a.sourceRecordId);
        const sourceRecordId = String(request.data.sourceRecordId).trim();
        const sourceRecordDate = String(record.date || '');
        const redactedQuery = clampHaruLawText(record.haruraw_query || '', 1200);
        const redactedSummary = clampHaruLawText(record.haruraw_summary || '', 3000);
        const redactedArticles = clampHaruLawText(record.haruraw_articles || '', 5000);
        const fallbackStatutes = parseHaruLawPublicStatutes(record.haruraw_articles);
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value().trim());
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
        const result = await model.generateContent(`다음 하루LAW 기록을 다른 PREMIUM 구독자가 참고할 수 있는 익명 공개 카드로 바꾸세요.

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
    }
    catch (error) {
        if (error instanceof https_2.HttpsError)
            throw error;
        logger.error('하루LAW 익명 공유 미리보기 실패:', error);
        throw new https_2.HttpsError('internal', '개인정보 보호를 위해 공유 미리보기를 만들 수 없습니다. 내용을 줄이거나 개인정보를 제거한 뒤 다시 시도해 주세요.');
    }
});
exports.publishHaruLawSharedCard = (0, https_2.onCall)({
    region: 'asia-northeast3',
    timeoutSeconds: 120,
}, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    await assertHaruLawPremiumAccess(uid);
    const previewId = (_a = request.data) === null || _a === void 0 ? void 0 : _a.previewId;
    if (typeof previewId !== 'string' || !previewId.trim()) {
        throw new https_2.HttpsError('invalid-argument', 'previewId가 필요합니다.');
    }
    const previewRef = db.collection('haruLawSharePreviews').doc(previewId.trim());
    const previewSnap = await previewRef.get();
    if (!previewSnap.exists) {
        throw new https_2.HttpsError('not-found', '공유 미리보기를 찾을 수 없습니다.');
    }
    const previewData = previewSnap.data() || {};
    if (previewData.ownerUid !== uid) {
        throw new https_2.HttpsError('permission-denied', '공유 미리보기 소유자가 아닙니다.');
    }
    const expiresAt = previewData.expiresAt;
    if (!(expiresAt === null || expiresAt === void 0 ? void 0 : expiresAt.toMillis) || expiresAt.toMillis() < Date.now()) {
        throw new https_2.HttpsError('failed-precondition', '공유 미리보기 유효 시간이 지났습니다. 다시 미리보기를 만들어 주세요.');
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
        var _a;
        const metaSnap = await tx.get(metaRef);
        const currentStatus = String(((_a = metaSnap.data()) === null || _a === void 0 ? void 0 : _a.status) || '');
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
});
exports.unpublishHaruLawSharedCard = (0, https_2.onCall)({
    region: 'asia-northeast3',
    timeoutSeconds: 120,
}, async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    const sourceRecordId = typeof ((_a = request.data) === null || _a === void 0 ? void 0 : _a.sourceRecordId) === 'string'
        ? request.data.sourceRecordId.trim()
        : '';
    const explicitCardId = typeof ((_b = request.data) === null || _b === void 0 ? void 0 : _b.cardId) === 'string'
        ? request.data.cardId.trim()
        : '';
    const cardId = explicitCardId || (sourceRecordId ? getHaruLawSharedCardId(uid, sourceRecordId) : '');
    if (!cardId) {
        throw new https_2.HttpsError('invalid-argument', 'cardId 또는 sourceRecordId가 필요합니다.');
    }
    const cardRef = db.collection('sharedHaruLawCards').doc(cardId);
    const metaRef = db.collection('sharedHaruLawCardMeta').doc(cardId);
    const metaSnap = await metaRef.get();
    if (!metaSnap.exists) {
        throw new https_2.HttpsError('not-found', '공유 카드 메타 정보를 찾을 수 없습니다.');
    }
    const meta = metaSnap.data() || {};
    if (meta.ownerUid !== uid && !isDeveloperUid(uid)) {
        throw new https_2.HttpsError('permission-denied', '공유 취소 권한이 없습니다.');
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
});
// ===== 법령 쉬운 해설 =====
exports.lawEasyExplain = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const { lawText, userQuery } = request.data;
    if (!lawText) {
        throw new https_2.HttpsError('invalid-argument', '법령 텍스트를 입력해주세요.');
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
        const model = genAI.getGenerativeModel({
            model: 'gemini-3.1-flash-lite',
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
    }
    catch (error) {
        logger.error('법령 해설 실패:', error);
        throw new https_2.HttpsError('internal', '법령 해설에 실패했습니다.');
    }
});
// ===== 법령 관련 판례 검색 (국가법령정보 OpenAPI 연동) =====
exports.lawPrecedent = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [LAW_API_KEY_SECRET, GEMINI_API_KEY_SECRET],
    timeoutSeconds: 300,
}, async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const { lawText, userQuery } = request.data;
    if (!lawText || String(lawText).trim().length === 0) {
        throw new https_2.HttpsError('invalid-argument', '법령 정보가 필요합니다');
    }
    const DISCLAIMER = '이 정보는 국가법령정보센터에서 제공한 실제 판례입니다. AI 요약은 참고용이며, 정확한 내용은 법령정보센터에서 확인하세요.';
    const NO_RESULT_DISCLAIMER = '이 검색은 국가법령정보센터의 실제 판례 데이터를 기반으로 합니다.';
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    // 1. Gemini로 검색 키워드 추출 (lawSearch 0단계 패턴)
    let searchKeyword = '';
    try {
        const kwModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
        const kwResult = await kwModel.generateContent(`다음 법령 조문과 사용자 질문에 가장 관련된 판례 검색용 핵심 키워드 1개만 출력하세요.
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
사용자 질문: ${userQuery || '없음'}`);
        searchKeyword = kwResult.response.text().trim().split('\n')[0].trim();
        // 한글 1자 이상 포함 검증 (한자/기호만 나오면 폴백)
        if (!/[가-힣]/.test(searchKeyword) || searchKeyword.length === 0) {
            searchKeyword = '';
        }
    }
    catch (kwErr) {
        logger.warn('판례 키워드 추출 실패, 폴백 사용:', kwErr === null || kwErr === void 0 ? void 0 : kwErr.message);
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
    let response;
    try {
        response = await axios_1.default.get(searchUrl, {
            timeout: 10000,
            headers: {
                'Referer': 'https://haru2026.com/',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
        });
    }
    catch (apiErr) {
        logger.error('판례 OpenAPI 호출 실패:', {
            message: apiErr === null || apiErr === void 0 ? void 0 : apiErr.message,
            status: (_a = apiErr === null || apiErr === void 0 ? void 0 : apiErr.response) === null || _a === void 0 ? void 0 : _a.status,
            code: apiErr === null || apiErr === void 0 ? void 0 : apiErr.code,
        });
        throw new https_2.HttpsError('internal', '판례 검색 서버에 연결할 수 없습니다');
    }
    // 3. 응답 파싱
    const precSearch = (_b = response.data) === null || _b === void 0 ? void 0 : _b.PrecSearch;
    const totalCnt = parseInt((precSearch === null || precSearch === void 0 ? void 0 : precSearch.totalCnt) || '0', 10);
    const rawList = precSearch === null || precSearch === void 0 ? void 0 : precSearch.prec;
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
    let summaries = [];
    try {
        const sumModel = genAI.getGenerativeModel({
            model: 'gemini-3.1-flash-lite',
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
            .map((p, i) => `${i + 1}. 사건명: ${(p === null || p === void 0 ? void 0 : p.사건명) || '(없음)'} / 사건번호: ${(p === null || p === void 0 ? void 0 : p.사건번호) || '(없음)'} / 법원: ${(p === null || p === void 0 ? void 0 : p.법원명) || '(없음)'} / 선고일: ${(p === null || p === void 0 ? void 0 : p.선고일자) || '(없음)'}`)
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
    }
    catch (sumErr) {
        logger.warn('판례 요약 생성 실패, 기본값 사용:', sumErr === null || sumErr === void 0 ? void 0 : sumErr.message);
        summaries = [];
    }
    // 7. 반환 객체 조립 (기존 호환 + 신규 필드)
    const precedents = top3.map((p, idx) => {
        var _a;
        return ({
            caseName: (p === null || p === void 0 ? void 0 : p.사건명) || '',
            caseNum: `${(p === null || p === void 0 ? void 0 : p.법원명) || ''} ${(p === null || p === void 0 ? void 0 : p.선고일자) || ''} 선고 ${(p === null || p === void 0 ? void 0 : p.사건번호) || ''}`.trim(),
            summary: ((_a = summaries[idx]) === null || _a === void 0 ? void 0 : _a.summary) || 'AI 요약 생성 실패',
            courtName: (p === null || p === void 0 ? void 0 : p.법원명) || '',
            sentenceDate: (p === null || p === void 0 ? void 0 : p.선고일자) || '',
            caseId: (p === null || p === void 0 ? void 0 : p.판례일련번호) || '',
            detailLink: (p === null || p === void 0 ? void 0 : p.판례상세링크)
                ? `https://www.law.go.kr${p.판례상세링크}`
                : '',
        });
    });
    return {
        success: true,
        precedents,
        totalCount: totalCnt,
        searchKeyword,
        disclaimer: DISCLAIMER,
    };
});
// ===== TTS 음성 생성 =====
exports.generateTTS = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET, GOOGLE_CLOUD_API_KEY_SECRET, OPENAI_API_KEY_SECRET],
    timeoutSeconds: 120,
}, async (request) => {
    var _a, _b, _c, _d, _f, _g;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const { text, cacheKey, voice = 'nova' } = request.data;
    if (!text || !cacheKey) {
        throw new https_2.HttpsError('invalid-argument', '텍스트와 캐시키가 필요합니다.');
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
        const currentCount = usageSnap.exists ? ((_b = (_a = usageSnap.data()) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0) : 0;
        if (currentCount >= 500) {
            throw new https_2.HttpsError('resource-exhausted', '오늘 TTS 사용 한도를 초과했습니다');
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
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        // 429(rate limit) 백오프: OpenAI Retry-After 헤더 우선, 미제공 시 5/10/20초 + jitter, 총 3회 시도
        const BACKOFF_MS = [5000, 10000, 20000];
        const MAX_ATTEMPTS = 3;
        let ttsResponse = null;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                ttsResponse = await axios_1.default.post('https://api.openai.com/v1/audio/speech', {
                    model: 'tts-1',
                    input: cleanedText,
                    voice: safeVoice,
                    response_format: 'mp3',
                    speed: 0.95,
                }, {
                    headers: {
                        'Authorization': `Bearer ${OPENAI_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    responseType: 'arraybuffer',
                    timeout: 60000,
                });
                break;
            }
            catch (err) {
                const status = (_c = err === null || err === void 0 ? void 0 : err.response) === null || _c === void 0 ? void 0 : _c.status;
                if (status === 429 && attempt < MAX_ATTEMPTS - 1) {
                    const retryAfterRaw = (_f = (_d = err === null || err === void 0 ? void 0 : err.response) === null || _d === void 0 ? void 0 : _d.headers) === null || _f === void 0 ? void 0 : _f['retry-after'];
                    const serverHintMs = retryAfterRaw ? Math.ceil(Number(retryAfterRaw) * 1000) : 0;
                    const baseDelay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
                    const jitter = Math.floor(Math.random() * 1000);
                    const delay = Math.max(serverHintMs, baseDelay) + jitter;
                    logger.warn(`TTS 429 재시도 ${attempt + 1}회 (${delay}ms 대기, retry-after=${retryAfterRaw !== null && retryAfterRaw !== void 0 ? retryAfterRaw : 'none'})`);
                    await sleep(delay);
                }
                else {
                    throw err;
                }
            }
        }
        // 절 사이 호출 간격 확보 (OpenAI rate-limit 자체 유발 방지)
        await sleep(500);
        const audioBuffer = Buffer.from(ttsResponse.data);
        if (!audioBuffer.length) {
            throw new https_2.HttpsError('internal', 'TTS 생성에 실패했습니다.');
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
    }
    catch (error) {
        // 보안: axios 에러 객체를 통째로 로깅하면 Authorization 헤더(OpenAI API 키)가 노출됨.
        // 안전한 필드만 남긴다.
        logger.error('TTS 생성 실패:', {
            message: error === null || error === void 0 ? void 0 : error.message,
            status: (_g = error === null || error === void 0 ? void 0 : error.response) === null || _g === void 0 ? void 0 : _g.status,
            code: error === null || error === void 0 ? void 0 : error.code,
            cacheKey,
        });
        throw new https_2.HttpsError('internal', 'TTS 생성에 실패했습니다.');
    }
});
// ===== ttsUsage 30일 이상 문서 자동 청소 (매일 0시 KST) =====
exports.cleanupTtsUsage = (0, scheduler_1.onSchedule)({
    schedule: '0 0 * * *',
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
}, async () => {
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
    }
    catch (error) {
        logger.error('ttsUsage 청소 실패:', error);
    }
});
var bookStudio_1 = require("./bookStudio");
Object.defineProperty(exports, "generateBook", { enumerable: true, get: function () { return bookStudio_1.generateBook; } });
Object.defineProperty(exports, "suggestChapterTitle", { enumerable: true, get: function () { return bookStudio_1.suggestChapterTitle; } });
var snsAnalyzer_1 = require("./snsAnalyzer");
Object.defineProperty(exports, "analyzeFacebookZip", { enumerable: true, get: function () { return snsAnalyzer_1.analyzeFacebookZip; } });
var snsToDiary_1 = require("./snsToDiary");
Object.defineProperty(exports, "convertSnsToDiary", { enumerable: true, get: function () { return snsToDiary_1.convertSnsToDiary; } });
var generateLawsuitClaimReason_1 = require("./generateLawsuitClaimReason");
Object.defineProperty(exports, "generateLawsuitClaimReason", { enumerable: true, get: function () { return generateLawsuitClaimReason_1.generateLawsuitClaimReason; } });
var bookMaterial_1 = require("./bookMaterial");
Object.defineProperty(exports, "convertToBookMaterial", { enumerable: true, get: function () { return bookMaterial_1.convertToBookMaterial; } });
var elderBook_1 = require("./elderBook");
Object.defineProperty(exports, "gatherElderBookSources", { enumerable: true, get: function () { return elderBook_1.gatherElderBookSources; } });
Object.defineProperty(exports, "buildElderBookOutline", { enumerable: true, get: function () { return elderBook_1.buildElderBookOutline; } });
Object.defineProperty(exports, "assignElderBookSources", { enumerable: true, get: function () { return elderBook_1.assignElderBookSources; } });
Object.defineProperty(exports, "draftElderBookChapters", { enumerable: true, get: function () { return elderBook_1.draftElderBookChapters; } });
Object.defineProperty(exports, "polishElderBookChapters", { enumerable: true, get: function () { return elderBook_1.polishElderBookChapters; } });
// ===== 단어 뜻 조회 =====
exports.getWordMeaning = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] }, async (request) => {
    const { word } = request.data;
    if (!word)
        throw new https_2.HttpsError('invalid-argument', '단어가 필요합니다.');
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
    const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
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
});
// ===== 문법 해설 =====
exports.getGrammarExplain = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET, OPENAI_API_KEY_SECRET] }, async (request) => {
    var _a, _b;
    const { verseKey, verseText } = request.data;
    if (!verseText)
        throw new https_2.HttpsError('invalid-argument', '절 내용이 필요합니다.');
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
    const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
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
    let gptChanges = [];
    if (useGPT4o)
        try {
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
            const gptRes = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4o',
                messages: [{ role: 'user', content: gptPrompt }],
                temperature: 0.2,
            }, {
                headers: {
                    Authorization: `Bearer ${OPENAI_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 25000,
            });
            const gptRaw = gptRes.data.choices[0].message.content.trim();
            const gptClean = gptRaw.replace(/```json|```/g, '').trim();
            const gptParsed = JSON.parse(gptClean);
            verified = (_a = gptParsed.result) !== null && _a !== void 0 ? _a : gptParsed;
            gptChanges = (_b = gptParsed.changes) !== null && _b !== void 0 ? _b : [];
            if (gptChanges.length > 0) {
                logger.info(`[getGrammarExplain] GPT-4o 수정 내역 (${verseKey}): ${JSON.stringify(gptChanges)}`);
            }
            else {
                logger.info(`[getGrammarExplain] GPT-4o 수정 없음: ${verseKey}`);
            }
        }
        catch (gptErr) {
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
});
// ===== 장 문법 사전생성 =====
exports.preloadChapterGrammar = (0, https_2.onCall)({ region: 'asia-northeast3', timeoutSeconds: 540, secrets: [GEMINI_API_KEY_SECRET, OPENAI_API_KEY_SECRET] }, async (request) => {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const { book, chapter, verses, verseTexts } = request.data;
    const results = [];
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
            const verseText = (verseTexts === null || verseTexts === void 0 ? void 0 : verseTexts[verseKey]) || '';
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
            let geminiText = ((_f = (_d = (_c = (_b = (_a = geminiJson === null || geminiJson === void 0 ? void 0 : geminiJson.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _f === void 0 ? void 0 : _f.text) || '';
            geminiText = geminiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            // 제어문자 제거 (JSON 파싱 오류 방지)
            geminiText = geminiText.replace(/[\x00-\x1F\x7F]/g, (c) => c === '\n' || c === '\r' || c === '\t' ? c : '');
            const geminiData = JSON.parse(geminiText);
            // 3. GPT-4o 검증
            let finalData = geminiData;
            let gptChanges = [];
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
                    let gptText = ((_j = (_h = (_g = gptJson === null || gptJson === void 0 ? void 0 : gptJson.choices) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.message) === null || _j === void 0 ? void 0 : _j.content) || '';
                    gptText = gptText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    const gptResult = JSON.parse(gptText);
                    gptChanges = gptResult.changes || [];
                    if (gptResult.corrected) {
                        finalData = gptResult.corrected;
                    }
                    verifiedByGPT = true;
                }
            }
            catch (gptErr) {
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
        }
        catch (err) {
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
        const tokens = ((_k = settingsDoc.data()) === null || _k === void 0 ? void 0 : _k.fcmTokens) || [];
        if (tokens.length > 0) {
            const { getMessaging } = await Promise.resolve().then(() => __importStar(require('firebase-admin/messaging')));
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
    }
    catch (fcmErr) {
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
});
// ===== 퀴즈 생성 =====
exports.getVerseQuiz = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] }, async (request) => {
    const { verseKey, verseText, level = 'basic' } = request.data;
    if (!verseText)
        throw new https_2.HttpsError('invalid-argument', '절 내용이 필요합니다.');
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
    const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
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
});
// 영어 일기 학습 — 한국어 → 영어 번역
exports.translateToEnglish = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] }, async (request) => {
    const text = request.data.text || '';
    if (!text)
        throw new Error('텍스트가 없습니다');
    const GEMINI_KEY = GEMINI_API_KEY_SECRET.value();
    const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
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
});
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
exports.refreshNews = (0, https_2.onCall)({ secrets: [GEMINI_API_KEY_SECRET], region: 'asia-northeast3' }, async (request) => {
    var _a;
    // 개발자 UID — 향후 일반 사용자 개방 시 한도 체크 로직 추가 예정
    const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    const isDeveloper = ((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid) === DEV_UID;
    if (!isDeveloper) {
        // TODO: 정식 출시 시 일반 사용자 한도 체크 로직 추가
        // 예: 일 1회 / 월 30회 한도, 또는 유료 구독자만 허용
        throw new https_2.HttpsError('permission-denied', '뉴스 새로고침 권한이 없습니다');
    }
    try {
        const RSS_URLS = [
            'https://www.aljazeera.com/xml/rss/all.xml',
            'https://www.theguardian.com/world/rss',
            'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
        ];
        let allItems = [];
        for (const url of RSS_URLS) {
            try {
                const res = await axios_1.default.get(url, { timeout: 8000, responseType: 'text' });
                const xml = res.data;
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
            }
            catch (e) {
                logger.warn('RSS 수집 실패:', url);
            }
        }
        if (allItems.length === 0)
            return { success: false, message: '뉴스 없음' };
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
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
    }
    catch (err) {
        logger.error('뉴스 새로고침 오류:', err);
        return { success: false };
    }
});
// ===== 🔮 HARU예언 — 기록 자동 분석 (인물·욕망·족쇄·사건 추출) =====
exports.analyzeRecordForProphecy = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 60,
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const { content, userAnalysis, round } = request.data;
    if (!content || typeof content !== 'string' || content.trim().length < 10) {
        throw new https_2.HttpsError('invalid-argument', '분석할 기록 내용이 너무 짧습니다.');
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
    let userPrompt;
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
    }
    else {
        userPrompt = `[기록 내용]\n${content.slice(0, 4000)}\n\n위 기록에서 10개 항목을 추출해 JSON으로만 답하세요.`;
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
        const model = genAI.getGenerativeModel({
            model: 'gemini-3.1-flash-lite',
            systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userPrompt);
        let text = result.response.text().trim();
        text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        let parsed = {
            chars: '', desire: '', shackle: '', events: '',
            relationship: '', personality: '', motive: '', theme: '',
            oneLiner: '', threeLiner: ''
        };
        try {
            parsed = JSON.parse(text);
        }
        catch {
            const m = text.match(/\{[\s\S]*\}/);
            if (m) {
                try {
                    parsed = JSON.parse(m[0]);
                }
                catch { /* keep defaults */ }
            }
        }
        const toStr = (v) => {
            if (typeof v === 'string')
                return v;
            if (Array.isArray(v))
                return v.join(', ');
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
    }
    catch (error) {
        console.error('analyzeRecordForProphecy 실패:', error);
        throw new https_2.HttpsError('internal', '기록 분석에 실패했습니다.');
    }
});
// ===== 🔮 HARU예언 시놉시스 생성 =====
exports.generateHaruProphecy = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 120,
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const { motive, motiveCustom, chars, birth, desire, shackle, events, luck, unluck, narrative, type, fromRecord, recordContent, recordTitle, recordDate, recordFormat, prophecyType, timeOption, question, extractedChars, extractedDesire, extractedShackle, extractedEvents, extractedRelationship, extractedPersonality, extractedMotive, extractedTheme, extractedOneLiner, extractedThreeLiner, prophecyGoalType, prophecyGoal, prophecyWall, extractedGoal, persons, extractedEvent, extractedDailyAchieve, currentAge, baseYear, futureYear, futureAge, protagonistName: rawProtagonistName } = request.data;
    // 서버측 한 번 더 sanitize (클라 우회 방지)
    const sanitizedProtagonistName = (() => {
        if (typeof rawProtagonistName !== 'string')
            return null;
        const cleaned = rawProtagonistName
            .replace(/[\n\r\t`{}$\\<>"]/g, '')
            .replace(/[^\p{L}\p{N} \-_.]/gu, '')
            .trim()
            .slice(0, 20);
        return cleaned || null;
    })();
    // type: 'synopsis' | 'story'
    if (!fromRecord && !motive) {
        throw new https_2.HttpsError('invalid-argument', '예언 모티브가 필요합니다.');
    }
    // ── 사용량 체크 (하루 1회 / 월 30회) ──
    const uid = request.auth.uid;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const thisMonth = today.slice(0, 7); // YYYY-MM
    const usageRef = db.collection('prophecyUsage').doc(uid);
    const usageSnap = await usageRef.get();
    const usage = usageSnap.exists
        ? usageSnap.data()
        : { daily: '', dailyCount: 0, monthly: '', monthlyCount: 0 };
    const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    const isDeveloper = uid === DEV_UID;
    // 하루 타입별 생성 제한 체크 (개발자 제외)
    const dailyLimit = type === 'story' ? 1 : 5;
    if (!isDeveloper && usage.daily === today && usage.dailyCount >= dailyLimit) {
        const msg = type === 'story'
            ? '오늘의 이야기 생성을 완료했습니다. 내일 새로운 이야기를 만들어보세요.'
            : '오늘의 시놉시스 생성 횟수(5회)를 모두 사용했습니다. 내일 다시 시도해주세요.';
        throw new https_2.HttpsError('resource-exhausted', msg);
    }
    // 월 30회 체크 (개발자 제외)
    if (!isDeveloper && usage.monthly === thisMonth && usage.monthlyCount >= 30) {
        throw new https_2.HttpsError('resource-exhausted', '이번 달 예언 횟수(30회)를 모두 사용했습니다.');
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
        let userPrompt;
        if (fromRecord) {
            const toLine = (v) => {
                if (!v)
                    return '';
                if (Array.isArray(v))
                    return v.filter(Boolean).join(', ');
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
                    .filter((p) => p && (p.name || p.relation || p.personality))
                    .map((p) => {
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
            const goalTypeMap = {
                me: '나의 미래 (초목표를 향한 서사)',
                child: '자식의 미래 (자식에게 바라는 것의 서사)',
                past: '과거를 바꿨다면 (그때 달랐다면 지금은 어땠을까)',
            };
            const goalTypeLabel = goalTypeMap[prophecyGoalType] || '';
            const goalTypeLine = goalTypeLabel ? `[예언 유형]: ${goalTypeLabel}` : '';
            const goalLine = prophecyGoal ? `[사용자의 초목표/바람]: ${prophecyGoal}` : '';
            const wallLine = prophecyWall ? `[지금 가장 넘고 싶은 것]: ${prophecyWall}` : '';
            const goalBlock = [goalTypeLine, goalLine, wallLine].filter(Boolean).join('\n');
            const personsNameList = (() => {
                const names = [];
                if (Array.isArray(persons)) {
                    persons.forEach((p) => {
                        var _a;
                        if ((_a = p === null || p === void 0 ? void 0 : p.name) === null || _a === void 0 ? void 0 : _a.trim())
                            names.push(p.name.trim());
                    });
                }
                if (extractedChars)
                    names.push(extractedChars);
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
                ? `\n[사용자 연령 정보 — 절대 준수]\n- 사용자의 현재 나이: ${currentAge}세 (기준 연도: ${baseYear !== null && baseYear !== void 0 ? baseYear : new Date().getFullYear()}년)\n- 미래 시점: ${futureYear !== null && futureYear !== void 0 ? futureYear : ''}년 — 이 시점의 사용자는 ${futureAge !== null && futureAge !== void 0 ? futureAge : ''}세입니다.\n- AI는 사용자의 나이를 임의로 추정하지 않습니다. 위 수치만 사용합니다.\n- "30대", "40대", "서른 후반", "오십대" 등 연령대 표현은 ${futureAge !== null && futureAge !== void 0 ? futureAge : ''}세와 맞지 않으면 절대 쓰지 않습니다.\n- 주인공·사용자의 외모·체력·인생 단계·사회적 위치 묘사는 ${futureAge !== null && futureAge !== void 0 ? futureAge : ''}세에 부합해야 합니다.\n`
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
        }
        else {
            const motiveLabel = motiveCustom || motive;
            const eventsStr = Array.isArray(events) && events.length > 0
                ? events.map((e) => `${e.isCore ? '[핵심] ' : ''}${e.title}${e.timing ? `(${e.timing})` : ''}${e.impact ? ': ' + e.impact : ''}`).join(' / ')
                : '';
            const charsStr = Array.isArray(chars) && chars.length > 0
                ? chars.map((c) => { var _a, _b, _c; return `${c.name || c.role}(${c.role})${((_a = c.personalities) === null || _a === void 0 ? void 0 : _a.length) ? ' — ' + c.personalities.join(', ') : ''}${((_b = c.desires) === null || _b === void 0 ? void 0 : _b.length) ? ' / 욕망: ' + c.desires.join(', ') : ''}${((_c = c.shackles) === null || _c === void 0 ? void 0 : _c.length) ? ' / 족쇄: ' + c.shackles.join(', ') : ''}`; }).join('\n')
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
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
    }
    catch (error) {
        console.error('HARU예언 생성 실패:', error);
        if (error instanceof https_2.HttpsError)
            throw error;
        throw new https_2.HttpsError('internal', 'HARU예언 생성에 실패했습니다.');
    }
});
exports.getVerseTranslation = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] }, async (request) => {
    var _a;
    const { verseKey, text } = request.data;
    // Firestore 캐시 확인
    const cacheRef = db.collection('translationCache').doc(verseKey);
    const cached = await cacheRef.get();
    if (cached.exists) {
        return { translation: (_a = cached.data()) === null || _a === void 0 ? void 0 : _a.translation };
    }
    // Gemini로 번역
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const prompt = `다음 KJV 성경 구절을 자연스러운 한국어로 번역해주세요. 번역문만 출력하세요.\n\n${text}`;
    const result = await model.generateContent(prompt);
    const translation = result.response.text().trim();
    // Firestore 캐시 저장
    await cacheRef.set({ translation, verseKey, createdAt: new Date() });
    return { translation };
});
exports.getVerseWordMapping = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [GEMINI_API_KEY_SECRET] }, async (request) => {
    const { verseKey, enText, koText } = request.data;
    if (!enText || !koText)
        throw new https_2.HttpsError('invalid-argument', '영어/한국어 텍스트가 필요합니다.');
    const cacheRef = db.collection('wordMappingCache').doc(verseKey);
    const cached = await cacheRef.get();
    if (cached.exists)
        return cached.data();
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
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
});
exports.getCustomToken = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [COLLECTOR_SECRET_KEY],
}, async (request) => {
    var _a;
    const DEV_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    const provided = (_a = request.data) === null || _a === void 0 ? void 0 : _a.secretKey;
    if (provided !== COLLECTOR_SECRET_KEY.value()) {
        throw new https_2.HttpsError('permission-denied', '권한 없음');
    }
    const token = await admin.auth().createCustomToken(DEV_UID);
    return { token };
});
// ===== 🏠 온비드 부동산 물건목록 조회 (공공데이터포털 KAMCO) =====
// 출처: 한국자산관리공사 온비드 / Endpoint: apis.data.go.kr/B010003/OnbidRlstListSrvc2
exports.getOnbidRealEstateList = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [ONBID_API_KEY_SECRET],
    timeoutSeconds: 30,
}, async (request) => {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l, _m;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const d = request.data || {};
    const pageNo = Math.max(1, parseInt(String((_a = d.pageNo) !== null && _a !== void 0 ? _a : '1'), 10) || 1);
    const numOfRows = Math.min(50, Math.max(1, parseInt(String((_b = d.numOfRows) !== null && _b !== void 0 ? _b : '10'), 10) || 10));
    // v2.0 필수: prptDivCd, pvctTrgtYn — 사용자가 안 보내면 안전한 기본값으로 채움
    const params = {
        serviceKey: ONBID_API_KEY_SECRET.value(),
        pageNo: String(pageNo),
        numOfRows: String(numOfRows),
        resultType: 'json',
        prptDivCd: (String((_c = d.prptDivCd) !== null && _c !== void 0 ? _c : '').trim()) || '0007',
        pvctTrgtYn: (String((_d = d.pvctTrgtYn) !== null && _d !== void 0 ? _d : '').trim()) || 'N',
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
    let resp;
    try {
        resp = await axios_1.default.get(url, {
            params,
            timeout: 15000,
            headers: { Accept: 'application/json' },
            // serviceKey 가 이미 인코딩되어 있을 수 있으므로 URLSearchParams 가 한번 더 인코딩하지 않도록 주의
            paramsSerializer: (p) => Object.entries(p)
                .map(([k, v]) => k === 'serviceKey'
                ? `${k}=${encodeURIComponent(decodeURIComponent(String(v)))}`
                : `${k}=${encodeURIComponent(String(v))}`)
                .join('&'),
        });
    }
    catch (err) {
        logger.error('온비드 API 호출 실패:', {
            message: err === null || err === void 0 ? void 0 : err.message,
            status: (_f = err === null || err === void 0 ? void 0 : err.response) === null || _f === void 0 ? void 0 : _f.status,
            code: err === null || err === void 0 ? void 0 : err.code,
        });
        throw new https_2.HttpsError('internal', '온비드 서버에 연결할 수 없습니다');
    }
    const data = resp === null || resp === void 0 ? void 0 : resp.data;
    // 응답 형태 두 가지 모두 지원:
    //   (A) { response: { header, body } }  — OpenAPI 가이드 예제
    //   (B) { header, body }                — 실제 Onbid v2 응답
    const root = (_g = data === null || data === void 0 ? void 0 : data.response) !== null && _g !== void 0 ? _g : data;
    const header = root === null || root === void 0 ? void 0 : root.header;
    const body = root === null || root === void 0 ? void 0 : root.body;
    const resultCode = (_h = header === null || header === void 0 ? void 0 : header.resultCode) !== null && _h !== void 0 ? _h : '';
    const resultMsg = (_j = header === null || header === void 0 ? void 0 : header.resultMsg) !== null && _j !== void 0 ? _j : '';
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
        throw new https_2.HttpsError('internal', `온비드 API 오류 (${resultCode}): ${resultMsg}`);
    }
    const rawItems = body === null || body === void 0 ? void 0 : body.items;
    let items = [];
    if (Array.isArray(rawItems)) {
        items = rawItems;
    }
    else if (rawItems === null || rawItems === void 0 ? void 0 : rawItems.item) {
        items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
    }
    return {
        success: true,
        items,
        totalCount: parseInt(String((_k = body === null || body === void 0 ? void 0 : body.totalCount) !== null && _k !== void 0 ? _k : '0'), 10) || 0,
        pageNo: parseInt(String((_l = body === null || body === void 0 ? void 0 : body.pageNo) !== null && _l !== void 0 ? _l : pageNo), 10) || pageNo,
        numOfRows: parseInt(String((_m = body === null || body === void 0 ? void 0 : body.numOfRows) !== null && _m !== void 0 ? _m : numOfRows), 10) || numOfRows,
        resultCode,
        resultMsg,
        disclaimer: '본 정보는 한국자산관리공사 온비드 공공데이터를 활용한 참고용이며, 실제 입찰은 온비드 공식사이트(onbid.co.kr)에서 확인하세요.',
    };
});
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
let _drugApiUrlCache = null;
async function callDrugApiOnce(url, params) {
    var _a, _b;
    const resp = await axios_1.default.get(url, {
        params,
        timeout: 12000,
        headers: { Accept: 'application/json' },
        paramsSerializer: (p) => Object.entries(p)
            .map(([k, v]) => k === 'serviceKey'
            ? `${k}=${encodeURIComponent(decodeURIComponent(String(v)))}`
            : `${k}=${encodeURIComponent(String(v))}`)
            .join('&'),
    });
    const data = resp === null || resp === void 0 ? void 0 : resp.data;
    const root = (_a = data === null || data === void 0 ? void 0 : data.response) !== null && _a !== void 0 ? _a : data;
    if (!root || (!root.body && !root.header)) {
        throw new Error('식약처 응답 구조 비정상');
    }
    const body = root.body;
    const rawItems = body === null || body === void 0 ? void 0 : body.items;
    let items = [];
    if (Array.isArray(rawItems))
        items = rawItems;
    else if (rawItems === null || rawItems === void 0 ? void 0 : rawItems.item)
        items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
    const itemCount = items.length;
    const totalCount = parseInt(String((_b = body === null || body === void 0 ? void 0 : body.totalCount) !== null && _b !== void 0 ? _b : '0'), 10) || 0;
    const hasResults = itemCount > 0 || totalCount > 0;
    // 상세 화면이 필요로 하는 문서 필드가 하나라도 들어있는지
    const hasDetailFields = items.some((it) => ((it === null || it === void 0 ? void 0 : it.EE_DOC_DATA) && String(it.EE_DOC_DATA).trim()) ||
        ((it === null || it === void 0 ? void 0 : it.UD_DOC_DATA) && String(it.UD_DOC_DATA).trim()) ||
        ((it === null || it === void 0 ? void 0 : it.NB_DOC_DATA) && String(it.NB_DOC_DATA).trim()));
    return { resp, hasResults, hasDetailFields, totalCount, itemCount };
}
async function callDrugApi(params) {
    var _a, _b, _c, _d;
    // 1단계: 캐시된 endpoint 우선 시도.
    // 응답 자체가 실패한 경우만 캐시 무효화 후 전체 후보 재시도.
    if (_drugApiUrlCache) {
        try {
            const { resp } = await callDrugApiOnce(_drugApiUrlCache, params);
            return resp;
        }
        catch (err) {
            logger.warn('식약처 캐시 endpoint 실패 — 캐시 무효화 후 전체 후보 재시도', {
                cached: _drugApiUrlCache.split('/').pop(),
                status: ((_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status) || 0,
            });
            _drugApiUrlCache = null;
        }
    }
    // 2단계: 전체 후보 순회 — 우선순위
    //   ① 상세 필드(EE/UD/NB_DOC_DATA) 있는 endpoint → 즉시 캐시 + 반환
    //   ② items만 있고 상세 필드 없는 endpoint → fallback 후보, 캐시 보류
    //   ③ 0건이지만 정상 응답 → 마지막 fallback 후보, 캐시 보류
    const tryUrls = DRUG_API_OPS.map((op) => DRUG_API_BASE + op);
    let firstResultResp = null;
    let firstResultOp = null;
    let firstValidResp = null;
    let firstValidOp = null;
    let lastError = null;
    let lastSnippet = '';
    let lastStatus = 0;
    for (const url of tryUrls) {
        const op = url.split('/').pop() || '';
        try {
            const { resp, hasResults, hasDetailFields, totalCount, itemCount } = await callDrugApiOnce(url, params);
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
        }
        catch (err) {
            lastError = err;
            lastStatus = ((_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.status) || 0;
            lastSnippet = typeof ((_c = err === null || err === void 0 ? void 0 : err.response) === null || _c === void 0 ? void 0 : _c.data) === 'string'
                ? err.response.data.slice(0, 200)
                : JSON.stringify(((_d = err === null || err === void 0 ? void 0 : err.response) === null || _d === void 0 ? void 0 : _d.data) || {}).slice(0, 200);
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
function buildDrugSearchTerms(raw) {
    var _a;
    const original = raw.trim();
    const terms = [];
    const add = (s) => {
        const v = s.trim().replace(/\s+/g, ' ');
        if (v && !terms.includes(v))
            terms.push(v);
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
    const firstWord = ((_a = withoutDosage.match(/[가-힣A-Za-z]+/)) === null || _a === void 0 ? void 0 : _a[0]) || '';
    add(firstWord);
    if (firstWord.endsWith('정') && firstWord.length > 2) {
        add(firstWord.slice(0, -1));
    }
    return terms.slice(0, 5);
}
function parseDrugItemsFromResponse(resp) {
    var _a, _b, _c, _d;
    const data = resp === null || resp === void 0 ? void 0 : resp.data;
    const root = (_a = data === null || data === void 0 ? void 0 : data.response) !== null && _a !== void 0 ? _a : data;
    const header = root === null || root === void 0 ? void 0 : root.header;
    const body = root === null || root === void 0 ? void 0 : root.body;
    const rawItems = body === null || body === void 0 ? void 0 : body.items;
    let items = [];
    if (Array.isArray(rawItems)) {
        items = rawItems;
    }
    else if (rawItems === null || rawItems === void 0 ? void 0 : rawItems.item) {
        items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
    }
    return {
        items,
        totalCount: parseInt(String((_b = body === null || body === void 0 ? void 0 : body.totalCount) !== null && _b !== void 0 ? _b : '0'), 10) || 0,
        pageNo: body === null || body === void 0 ? void 0 : body.pageNo,
        numOfRows: body === null || body === void 0 ? void 0 : body.numOfRows,
        resultCode: (_c = header === null || header === void 0 ? void 0 : header.resultCode) !== null && _c !== void 0 ? _c : '',
        resultMsg: (_d = header === null || header === void 0 ? void 0 : header.resultMsg) !== null && _d !== void 0 ? _d : '',
    };
}
exports.getDrugInfo = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [DRUG_API_KEY_SECRET],
    timeoutSeconds: 30,
}, async (request) => {
    var _a, _b, _c;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const d = request.data || {};
    const itemName = String((_a = d.itemName) !== null && _a !== void 0 ? _a : '').trim();
    if (!itemName) {
        throw new https_2.HttpsError('invalid-argument', '약 이름을 입력하세요');
    }
    const pageNo = Math.max(1, parseInt(String((_b = d.pageNo) !== null && _b !== void 0 ? _b : '1'), 10) || 1);
    const numOfRows = Math.min(20, Math.max(1, parseInt(String((_c = d.numOfRows) !== null && _c !== void 0 ? _c : '10'), 10) || 10));
    const searchTerms = buildDrugSearchTerms(itemName);
    const seen = new Set();
    const mergedItems = [];
    let totalCount = 0;
    let resultCode = '';
    let resultMsg = '';
    for (const term of searchTerms) {
        const params = {
            serviceKey: DRUG_API_KEY_SECRET.value(),
            pageNo: String(pageNo),
            numOfRows: String(numOfRows),
            type: 'json',
            item_name: term,
        };
        let resp;
        try {
            resp = await callDrugApi(params);
        }
        catch (err) {
            if (term === searchTerms[0] && searchTerms.length === 1) {
                throw new https_2.HttpsError('internal', '식약처 서버에 연결할 수 없습니다');
            }
            continue;
        }
        const parsed = parseDrugItemsFromResponse(resp);
        resultCode = parsed.resultCode;
        resultMsg = parsed.resultMsg;
        if (resultCode && resultCode !== '00' && resultCode !== '0') {
            logger.warn('식약처 API 비정상 응답:', { resultCode, resultMsg, term });
            if (resultCode !== '03') {
                throw new https_2.HttpsError('internal', `식약처 API 오류 (${resultCode}): ${resultMsg}`);
            }
        }
        totalCount += parsed.totalCount;
        for (const item of parsed.items) {
            const key = (item === null || item === void 0 ? void 0 : item.ITEM_SEQ) || `${(item === null || item === void 0 ? void 0 : item.ITEM_NAME) || ''}__${(item === null || item === void 0 ? void 0 : item.ENTP_NAME) || ''}`;
            if (seen.has(key))
                continue;
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
});
// ===== 🏥 심평원 병원정보서비스 조회 (SAYU건강관리 - 동네병원정보) =====
// 출처: 건강보험심사평가원
// 실제 살아있는 endpoint: hospInfoServicev2/getHospBasisList (Cloud Logs 401 검증)
// 가이드 v1.2(2021)의 hospInfoService1은 폐지된 것으로 확인 (HTTP 500 응답)
const HIRA_CANDIDATES = [
    { url: 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList' },
    { url: 'http://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList' },
    { url: 'https://apis.data.go.kr/B551182/hospInfoService1/getHospBasisList1' },
];
let _hospitalApiUrlCache = null;
function encodePublicDataParam(key, value) {
    const raw = String(value);
    if (key !== 'ServiceKey' && key !== 'serviceKey') {
        return encodeURIComponent(raw);
    }
    try {
        return encodeURIComponent(decodeURIComponent(raw));
    }
    catch {
        return encodeURIComponent(raw);
    }
}
function getPublicDataErrorKind(resultCode, resultMsg, snippet) {
    var _a;
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
    return (_a = knownErrors.find((code) => text.includes(code))) !== null && _a !== void 0 ? _a : null;
}
function hospitalEndpointLabel(url) {
    return url.replace(/^https?:\/\/apis\.data\.go\.kr\/B551182\//, '');
}
async function callHospitalApi(params) {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    const tryUrls = _hospitalApiUrlCache
        ? [_hospitalApiUrlCache]
        : HIRA_CANDIDATES.map((c) => c.url);
    let lastError = null;
    let lastSnippet = '';
    let lastStatus = 0;
    const attempts = [];
    for (const url of tryUrls) {
        try {
            const resp = await axios_1.default.get(url, {
                params,
                timeout: 12000,
                headers: { Accept: 'application/json' },
                paramsSerializer: (p) => Object.entries(p)
                    .map(([k, v]) => `${k}=${encodePublicDataParam(k, v)}`)
                    .join('&'),
            });
            const root = (_b = (_a = resp === null || resp === void 0 ? void 0 : resp.data) === null || _a === void 0 ? void 0 : _a.response) !== null && _b !== void 0 ? _b : resp === null || resp === void 0 ? void 0 : resp.data;
            const header = root === null || root === void 0 ? void 0 : root.header;
            const resultCode = (_c = header === null || header === void 0 ? void 0 : header.resultCode) !== null && _c !== void 0 ? _c : '';
            const resultMsg = (_d = header === null || header === void 0 ? void 0 : header.resultMsg) !== null && _d !== void 0 ? _d : '';
            const bodySnippet = typeof (resp === null || resp === void 0 ? void 0 : resp.data) === 'string'
                ? resp.data.slice(0, 500)
                : JSON.stringify((resp === null || resp === void 0 ? void 0 : resp.data) || {}).slice(0, 500);
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
                error.publicDataError = publicDataError;
                error.resultCode = resultCode;
                error.resultMsg = resultMsg;
                error.attempts = attempts;
                throw error;
            }
        }
        catch (err) {
            lastError = err;
            lastStatus = ((_f = err === null || err === void 0 ? void 0 : err.response) === null || _f === void 0 ? void 0 : _f.status) || 0;
            lastSnippet = typeof ((_g = err === null || err === void 0 ? void 0 : err.response) === null || _g === void 0 ? void 0 : _g.data) === 'string'
                ? err.response.data.slice(0, 500)
                : JSON.stringify(((_h = err === null || err === void 0 ? void 0 : err.response) === null || _h === void 0 ? void 0 : _h.data) || {}).slice(0, 500);
            const root = (_l = (_k = (_j = err === null || err === void 0 ? void 0 : err.response) === null || _j === void 0 ? void 0 : _j.data) === null || _k === void 0 ? void 0 : _k.response) !== null && _l !== void 0 ? _l : (_m = err === null || err === void 0 ? void 0 : err.response) === null || _m === void 0 ? void 0 : _m.data;
            const header = root === null || root === void 0 ? void 0 : root.header;
            const resultCode = (_p = (_o = header === null || header === void 0 ? void 0 : header.resultCode) !== null && _o !== void 0 ? _o : err === null || err === void 0 ? void 0 : err.resultCode) !== null && _p !== void 0 ? _p : '';
            const resultMsg = (_r = (_q = header === null || header === void 0 ? void 0 : header.resultMsg) !== null && _q !== void 0 ? _q : err === null || err === void 0 ? void 0 : err.resultMsg) !== null && _r !== void 0 ? _r : '';
            const publicDataError = (_s = err === null || err === void 0 ? void 0 : err.publicDataError) !== null && _s !== void 0 ? _s : getPublicDataErrorKind(resultCode, resultMsg, lastSnippet);
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
    error.attempts = attempts;
    throw error;
}
const HIRA_SIDO_NM_TO_CD = {
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
exports.getHospitalList = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [HIRA_API_KEY_SECRET],
    timeoutSeconds: 30,
}, async (request) => {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const d = request.data || {};
    const pageNo = Math.max(1, parseInt(String((_a = d.pageNo) !== null && _a !== void 0 ? _a : '1'), 10) || 1);
    const numOfRows = Math.min(50, Math.max(1, parseInt(String((_b = d.numOfRows) !== null && _b !== void 0 ? _b : '10'), 10) || 10));
    const sidoCdNm = String((_c = d.sidoCdNm) !== null && _c !== void 0 ? _c : '').trim();
    const sgguCdNm = String((_d = d.sgguCdNm) !== null && _d !== void 0 ? _d : '').trim();
    const yadmNm = String((_f = d.yadmNm) !== null && _f !== void 0 ? _f : '').trim();
    const dgsbjtCd = String((_g = d.dgsbjtCd) !== null && _g !== void 0 ? _g : '').trim();
    if (!sidoCdNm && !sgguCdNm && !yadmNm) {
        throw new https_2.HttpsError('invalid-argument', '시·도, 시·군·구, 병원명 중 하나는 필요합니다');
    }
    // sgguCd는 6자리 코드라 한글→코드 매핑이 어려움.
    // 서버에는 sgguCd를 보내지 않고, 응답을 받은 후 sgguCdNm 필드로 필터링.
    // 시군구 필터링을 위해 페이지 사이즈를 넉넉히 받음.
    const fetchSize = sgguCdNm ? 50 : numOfRows;
    const params = {
        ServiceKey: HIRA_API_KEY_SECRET.value(),
        pageNo: String(pageNo),
        numOfRows: String(fetchSize),
        _type: 'json',
    };
    if (sidoCdNm && HIRA_SIDO_NM_TO_CD[sidoCdNm]) {
        params.sidoCd = HIRA_SIDO_NM_TO_CD[sidoCdNm];
    }
    if (yadmNm)
        params.yadmNm = yadmNm;
    if (dgsbjtCd)
        params.dgsbjtCd = dgsbjtCd;
    let resp;
    try {
        resp = await callHospitalApi(params);
    }
    catch (err) {
        logger.error('심평원 병원정보 조회 실패', {
            message: err === null || err === void 0 ? void 0 : err.message,
            status: (_h = err === null || err === void 0 ? void 0 : err.response) === null || _h === void 0 ? void 0 : _h.status,
            code: err === null || err === void 0 ? void 0 : err.code,
            resultCode: err === null || err === void 0 ? void 0 : err.resultCode,
            resultMsg: err === null || err === void 0 ? void 0 : err.resultMsg,
            publicDataError: err === null || err === void 0 ? void 0 : err.publicDataError,
            attempts: err === null || err === void 0 ? void 0 : err.attempts,
        });
        // 공공데이터 표준 에러 코드별 사용자 친화적 메시지로 분기
        const pde = (_j = err === null || err === void 0 ? void 0 : err.publicDataError) !== null && _j !== void 0 ? _j : null;
        let userMessage = '심평원 서버에 일시적 문제가 있습니다. 잠시 후 다시 시도해 주세요.';
        let httpsCode = 'internal';
        if (pde) {
            if (pde.includes('SERVICE_KEY_IS_NOT_REGISTERED')) {
                userMessage = '병원정보서비스 인증이 거부됐습니다. 공공데이터포털에서 병원정보서비스(15001698) 활용신청 상태를 확인해 주세요.';
                httpsCode = 'permission-denied';
            }
            else if (pde.includes('LIMITED_NUMBER_OF_SERVICE_REQUESTS')) {
                userMessage = '오늘 조회 한도(1,000회/일)를 초과했습니다. 내일 다시 시도해 주세요.';
                httpsCode = 'resource-exhausted';
            }
            else if (pde.includes('INVALID_REQUEST_PARAMETER')) {
                userMessage = '검색 조건이 올바르지 않습니다. 다시 확인해 주세요.';
                httpsCode = 'invalid-argument';
            }
            else if (pde.includes('SERVICE_ACCESS_DENIED')) {
                userMessage = '병원정보서비스 접근이 거부됐습니다. 활용신청 승인 상태를 확인해 주세요.';
                httpsCode = 'permission-denied';
            }
        }
        throw new https_2.HttpsError(httpsCode, userMessage);
    }
    const data = resp === null || resp === void 0 ? void 0 : resp.data;
    const root = (_k = data === null || data === void 0 ? void 0 : data.response) !== null && _k !== void 0 ? _k : data;
    const header = root === null || root === void 0 ? void 0 : root.header;
    const body = root === null || root === void 0 ? void 0 : root.body;
    const resultCode = (_l = header === null || header === void 0 ? void 0 : header.resultCode) !== null && _l !== void 0 ? _l : '';
    const resultMsg = (_m = header === null || header === void 0 ? void 0 : header.resultMsg) !== null && _m !== void 0 ? _m : '';
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
        throw new https_2.HttpsError('internal', `심평원 API 오류 (${resultCode}): ${resultMsg}`);
    }
    const rawItems = body === null || body === void 0 ? void 0 : body.items;
    let items = [];
    if (Array.isArray(rawItems)) {
        items = rawItems;
    }
    else if (rawItems === null || rawItems === void 0 ? void 0 : rawItems.item) {
        items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
    }
    const apiTotalCount = parseInt(String((_o = body === null || body === void 0 ? void 0 : body.totalCount) !== null && _o !== void 0 ? _o : '0'), 10) || 0;
    // 시군구 필터링 (sgguCd 매핑 불가 → 응답의 sgguCdNm 필드로 부분 매치)
    let filteredItems = items;
    let filteredTotal = apiTotalCount;
    if (sgguCdNm) {
        filteredItems = items.filter((it) => {
            var _a;
            const nm = String((_a = it === null || it === void 0 ? void 0 : it.sgguCdNm) !== null && _a !== void 0 ? _a : '').trim();
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
        pageNo: parseInt(String((_p = body === null || body === void 0 ? void 0 : body.pageNo) !== null && _p !== void 0 ? _p : pageNo), 10) || pageNo,
        numOfRows,
        resultCode,
        resultMsg,
        disclaimer: '본 정보는 건강보험심사평가원 공공데이터를 활용한 참고용이며, 특정 기관·의사의 평가나 추천이 아닙니다.',
    };
});
// ===== 🔬 약봉지 AI 사진 분석 (SAYU건강관리 - Gemini Vision) =====
// 입력: 사진 base64 배열 (1~3장)
// 처리: Gemini Vision으로 약 이름 후보만 추출 (공식 약정보 검색은 사용자가 확인 후 별도 실행)
// 개인정보 안전장치:
//   1) 프롬프트에 환자·의사·병원 정보 무시 명시
//   2) 사진·개인정보 로그 차단 (장수·바이트 길이만 로깅)
//   3) 분석 후 사진 즉시 폐기 (Storage 저장 없음)
//   4) 사용자 확인 전 공식 약정보를 자동 확정하지 않음
exports.analyzeDrugPhoto = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 60,
    memory: '512MiB',
}, async (request) => {
    var _a, _b, _c, _d, _f;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const d = request.data || {};
    const rawImages = Array.isArray(d.images) ? d.images : [];
    const images = rawImages
        .filter((s) => typeof s === 'string' && s.length > 0)
        .map((s) => s.replace(/^data:image\/[a-zA-Z]+;base64,/, ''))
        .slice(0, 3);
    if (images.length === 0) {
        throw new https_2.HttpsError('invalid-argument', '사진이 필요합니다 (최소 1장, 최대 3장)');
    }
    // 사진 크기 검증 (각 장 최대 4MB base64 ≈ 3MB 원본)
    const totalKb = images.reduce((sum, b) => sum + Math.round(b.length * 0.75 / 1024), 0);
    if (totalKb > 12 * 1024) {
        throw new https_2.HttpsError('invalid-argument', '사진이 너무 큽니다. 1장당 4MB 이하로 줄여주세요');
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
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
    const visionModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    let parsedDrugs = [];
    let aiNote = '';
    try {
        const parts = [{ text: prompt }];
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
        aiNote = String((_a = parsed === null || parsed === void 0 ? void 0 : parsed.note) !== null && _a !== void 0 ? _a : '').trim().slice(0, 100);
        // 신·구 응답 형식 모두 수용 (drugs 배열 우선, 없으면 drugName 단일 폴백)
        const rawList = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.drugs) ? parsed.drugs : [];
        const seen = new Set();
        for (const item of rawList) {
            const name = String((_b = item === null || item === void 0 ? void 0 : item.name) !== null && _b !== void 0 ? _b : '').trim().slice(0, 60);
            if (!name)
                continue;
            const key = name.toLowerCase().replace(/\s+/g, '');
            if (seen.has(key))
                continue;
            seen.add(key);
            const rawConfidence = Number(item === null || item === void 0 ? void 0 : item.confidence);
            const confidence = Number.isFinite(rawConfidence)
                ? Math.max(0, Math.min(1, rawConfidence))
                : undefined;
            const dosage = String((_c = item === null || item === void 0 ? void 0 : item.dosage) !== null && _c !== void 0 ? _c : '').trim().slice(0, 30) || undefined;
            parsedDrugs.push({ name, dosage, confidence });
            if (parsedDrugs.length >= 10)
                break;
        }
        // 구 형식 폴백 (drugName 단일 필드)
        if (parsedDrugs.length === 0 && (parsed === null || parsed === void 0 ? void 0 : parsed.drugName)) {
            const name = String(parsed.drugName).trim().slice(0, 60);
            if (name) {
                parsedDrugs.push({ name });
            }
        }
    }
    catch (err) {
        // 🔒 에러 로그에도 사진·prompt 데이터 노출 금지
        logger.error('Gemini Vision 분석 실패', { message: (_d = err === null || err === void 0 ? void 0 : err.message) === null || _d === void 0 ? void 0 : _d.slice(0, 200) });
        throw new https_2.HttpsError('internal', 'AI 분석 중 오류가 발생했습니다. 사진을 다시 찍어 주세요');
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
        extractedName: ((_f = parsedDrugs[0]) === null || _f === void 0 ? void 0 : _f.name) || '',
        confidence: 'none',
        aiNote,
        disclaimer,
    };
});
// ===== 🩺 증상별 진료과 분석 (SayuHealth 명의찾기 — 심평원 API 대체) =====
// 입력: 사용자 증상 자유 텍스트 + (선택) 나이
// 출력: 추천 진료과 1~3개 + 지도/EBS 검색 키워드 + 면책 문구
// Firestore 저장 없음 (1회성 검색, 개인정보 부담 최소화)
exports.analyzeSymptomsForSpecialty = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 30,
}, async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const d = request.data || {};
    const symptoms = typeof d.symptoms === 'string' ? d.symptoms.trim() : '';
    const ageRaw = d.age;
    const age = typeof ageRaw === 'number' && ageRaw > 0 && ageRaw < 150
        ? Math.floor(ageRaw)
        : null;
    if (!symptoms || symptoms.length < 5) {
        throw new https_2.HttpsError('invalid-argument', '증상을 5자 이상 입력해 주세요.');
    }
    if (symptoms.length > 1000) {
        throw new https_2.HttpsError('invalid-argument', '증상은 1000자 이내로 입력해 주세요.');
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
        const model = genAI.getGenerativeModel({
            model: 'gemini-3.1-flash-lite',
            systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userPrompt);
        const raw = result.response.text().trim();
        // Gemini가 가끔 ```json ... ``` 으로 감쌀 수 있어 정리
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```\s*$/, '').trim();
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        }
        catch (e) {
            logger.error('analyzeSymptomsForSpecialty: JSON 파싱 실패', { raw: raw.slice(0, 500) });
            throw new https_2.HttpsError('internal', '진료과 분석 응답을 해석할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        }
        const specialties = Array.isArray(parsed.recommendedSpecialties)
            ? parsed.recommendedSpecialties.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 3)
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
    }
    catch (e) {
        if (e instanceof https_2.HttpsError)
            throw e;
        logger.error('analyzeSymptomsForSpecialty 실패', { message: e === null || e === void 0 ? void 0 : e.message });
        throw new https_2.HttpsError('internal', '진료과 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
});
// ✅ K뉴스 자동 발행 도구 — 카드뉴스 이미지에서 메타데이터 자동 추출 (Gemini Vision)
exports.extractKNewsMetadata = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
}, async (request) => {
    var _a;
    const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    if (((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid) !== DEVELOPER_UID) {
        throw new https_2.HttpsError('permission-denied', '개발자 전용 기능입니다.');
    }
    const { imageBase64, mimeType } = request.data;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new https_2.HttpsError('invalid-argument', '이미지 데이터(imageBase64)가 필요합니다.');
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY_SECRET.value());
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
            throw new https_2.HttpsError('internal', 'AI 응답에서 JSON을 찾을 수 없습니다.');
        }
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
    }
    catch (e) {
        if (e instanceof https_2.HttpsError)
            throw e;
        logger.error('extractKNewsMetadata 실패', { message: e === null || e === void 0 ? void 0 : e.message });
        throw new https_2.HttpsError('internal', `메타데이터 추출 실패: ${(e === null || e === void 0 ? void 0 : e.message) || '알 수 없는 오류'}`);
    }
});
function pickApiScore(...values) {
    for (const value of values) {
        if (value === undefined || value === null || value === '')
            continue;
        const n = Number(value);
        if (Number.isFinite(n))
            return n;
    }
    return null;
}
async function callKindwiseIdentification(base64, _mimeType, apiKey) {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    // Plant.id v3는 raw base64를 권장 (data URI prefix 없이)
    const detailsParam = encodeURIComponent('common_names,taxonomy,url');
    const endpoint = `https://api.plant.id/v3/identification?details=${detailsParam}&language=ko`;
    logger.info('Kindwise 요청 시작', {
        endpoint,
        base64Length: base64.length,
        base64FirstChars: base64.slice(0, 20),
        apiKeyLength: (apiKey === null || apiKey === void 0 ? void 0 : apiKey.length) || 0,
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
    const json = await response.json();
    logger.info('Kindwise 응답 OK', {
        status: response.status,
        keys: Object.keys(json || {}),
        resultKeys: Object.keys((json === null || json === void 0 ? void 0 : json.result) || {}),
        suggestionsCount: ((_c = (_b = (_a = json === null || json === void 0 ? void 0 : json.result) === null || _a === void 0 ? void 0 : _a.classification) === null || _b === void 0 ? void 0 : _b.suggestions) === null || _c === void 0 ? void 0 : _c.length) || 0,
        isPlantProb: (_f = (_d = json === null || json === void 0 ? void 0 : json.result) === null || _d === void 0 ? void 0 : _d.is_plant) === null || _f === void 0 ? void 0 : _f.probability,
    });
    const suggestions = ((_h = (_g = json === null || json === void 0 ? void 0 : json.result) === null || _g === void 0 ? void 0 : _g.classification) === null || _h === void 0 ? void 0 : _h.suggestions) || [];
    const top = suggestions[0] || {};
    const isPlant = Number((_l = (_k = (_j = json === null || json === void 0 ? void 0 : json.result) === null || _j === void 0 ? void 0 : _j.is_plant) === null || _k === void 0 ? void 0 : _k.probability) !== null && _l !== void 0 ? _l : 0);
    const topCommon = (_o = (_m = top.details) === null || _m === void 0 ? void 0 : _m.common_names) === null || _o === void 0 ? void 0 : _o[0];
    const topName = String(topCommon || top.name || '식물 이름 불확실').slice(0, 80);
    const latinName = String(top.name || '').slice(0, 120);
    const probability = pickApiScore(top.probability, top.score, top.confidence, top.similarity);
    logger.info('Kindwise 점수 필드 확인', {
        topKeys: Object.keys(top || {}),
        probability: (_p = top.probability) !== null && _p !== void 0 ? _p : null,
        score: (_q = top.score) !== null && _q !== void 0 ? _q : null,
        confidence: (_r = top.confidence) !== null && _r !== void 0 ? _r : null,
        similarity: (_s = top.similarity) !== null && _s !== void 0 ? _s : null,
        selectedScore: probability,
    });
    const taxonomy = ((_t = top.details) === null || _t === void 0 ? void 0 : _t.taxonomy)
        ? { family: top.details.taxonomy.family, genus: top.details.taxonomy.genus }
        : undefined;
    const alternativeCandidates = suggestions.slice(1, 4).map((s) => {
        var _a, _b;
        return ({
            name: String(((_b = (_a = s.details) === null || _a === void 0 ? void 0 : _a.common_names) === null || _b === void 0 ? void 0 : _b[0]) || s.name || '').slice(0, 80),
            latinName: String(s.name || '').slice(0, 120),
            probability: pickApiScore(s.probability, s.score, s.confidence, s.similarity),
        });
    }).filter((c) => c.name);
    return {
        topPlantName: topName,
        latinName,
        identificationProbability: probability,
        isPlantProbability: isPlant,
        alternativeCandidates,
        taxonomy,
        kindwiseUrl: (_u = top.details) === null || _u === void 0 ? void 0 : _u.url,
    };
}
async function callGeminiAdvice(base64, mimeType, apiKey, identifiedName) {
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
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType: mimeType || 'image/jpeg' } },
    ]);
    const text = result.response.text();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('Gemini 응답에서 JSON을 찾을 수 없습니다.');
    const parsed = JSON.parse(jsonMatch[0]);
    const normalizeList = (value) => Array.isArray(value)
        ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
        : [];
    const conf = String(parsed === null || parsed === void 0 ? void 0 : parsed.confidence);
    return {
        plantName: String((parsed === null || parsed === void 0 ? void 0 : parsed.plantName) || identifiedName || '식물 이름 불확실').slice(0, 80),
        condition: String((parsed === null || parsed === void 0 ? void 0 : parsed.condition) || '사진에서 확인 가능한 상태가 제한적입니다.').slice(0, 160),
        confidence: (['high', 'medium', 'low'].includes(conf) ? conf : 'low'),
        findings: normalizeList(parsed === null || parsed === void 0 ? void 0 : parsed.findings),
        actions: normalizeList(parsed === null || parsed === void 0 ? void 0 : parsed.actions),
        warningSigns: normalizeList(parsed === null || parsed === void 0 ? void 0 : parsed.warningSigns),
        note: String((parsed === null || parsed === void 0 ? void 0 : parsed.note) || '사진 분석은 참고용입니다. 상태가 악화되면 전문가에게 상담하세요.').slice(0, 200),
    };
}
exports.analyzePlantPhoto = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET, KINDWISE_PLANT_ID_API_KEY_SECRET],
    memory: '512MiB',
    timeoutSeconds: 60,
}, async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const { imageBase64, mimeType } = request.data;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new https_2.HttpsError('invalid-argument', '이미지 데이터(imageBase64)가 필요합니다.');
    }
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const imageKb = Math.round(cleanBase64.length * 0.75 / 1024);
    if (imageKb > 6 * 1024) {
        throw new https_2.HttpsError('invalid-argument', '사진이 너무 큽니다. 더 작은 사진으로 다시 시도해 주세요.');
    }
    const finalMime = mimeType || 'image/jpeg';
    logger.info('analyzePlantPhoto 호출', {
        uid: request.auth.uid.slice(0, 8) + '…',
        imageKb,
        mimeType: finalMime,
    });
    // 1단계: Kindwise 식별 (먼저 식물 이름을 확보해 Gemini 프롬프트에 주입)
    let kindwise = null;
    let kindwiseError;
    try {
        kindwise = await callKindwiseIdentification(cleanBase64, finalMime, KINDWISE_PLANT_ID_API_KEY_SECRET.value());
    }
    catch (err) {
        kindwiseError = (err === null || err === void 0 ? void 0 : err.message) || 'Kindwise 호출 실패';
        // 메시지를 첫 인자에 결합 — Cloud Logging에서 본문 잘림 방지
        logger.warn(`Kindwise 식별 실패 — Gemini 단독 분석으로 진행: ${kindwiseError}`);
    }
    // 2단계: Gemini 해설 (Kindwise 결과를 힌트로 사용)
    let advice;
    try {
        advice = await callGeminiAdvice(cleanBase64, finalMime, GEMINI_API_KEY_SECRET.value(), kindwise === null || kindwise === void 0 ? void 0 : kindwise.topPlantName);
    }
    catch (err) {
        if (err instanceof https_2.HttpsError)
            throw err;
        logger.error('Gemini 해설 실패', { message: err === null || err === void 0 ? void 0 : err.message, kindwiseError });
        // Gemini도 실패 — Kindwise만이라도 있으면 최소 응답, 아니면 에러
        if (!kindwise) {
            throw new https_2.HttpsError('internal', '식물 사진 분석에 실패했습니다. 사진을 다시 찍어 주세요.');
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
    return {
        // 표시용 이름: Kindwise top 우선 → Gemini fallback
        plantName: (kindwise === null || kindwise === void 0 ? void 0 : kindwise.topPlantName) || advice.plantName,
        latinName: (kindwise === null || kindwise === void 0 ? void 0 : kindwise.latinName) || '',
        identificationConfidence: (_a = kindwise === null || kindwise === void 0 ? void 0 : kindwise.identificationProbability) !== null && _a !== void 0 ? _a : null, // 0~1
        isPlantProbability: (_b = kindwise === null || kindwise === void 0 ? void 0 : kindwise.isPlantProbability) !== null && _b !== void 0 ? _b : null,
        alternativeCandidates: (kindwise === null || kindwise === void 0 ? void 0 : kindwise.alternativeCandidates) || [],
        taxonomy: kindwise === null || kindwise === void 0 ? void 0 : kindwise.taxonomy,
        kindwiseUrl: kindwise === null || kindwise === void 0 ? void 0 : kindwise.kindwiseUrl,
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
});
// ============================================================
// 🌿 detectPlantAdvanced — Plant.id + PlantNet + Gemini 교차검증
// ============================================================
// - Plant.id (Kindwise): 1차 식별 (전세계 도감 + 확률)
// - PlantNet k-world-flora: 2차 교차검증 (다중 사진 활용, 한국 산야초 강세)
// - Gemini: 두 결과를 비교 분석 + 독초/유사종/추가촬영 안내
// - 어느 한 API 실패해도 graceful fallback (남은 결과로 분석 진행)
const ENABLE_KINDWISE_PLANT_ID = false;
const KINDWISE_PLANT_ID_DISABLED_REASON = 'Kindwise Plant.id는 향후 지원금 확보 후 활성화 예정';
async function callPlantNetIdentification(images, apiKey) {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (!apiKey)
        throw new Error('PLANTNET_API_KEY 없음');
    if (!images.length)
        throw new Error('PlantNet 호출에 이미지 없음');
    // 프로젝트: k-world-flora (전세계 식물 — 한국 산야초 포함)
    const project = 'k-world-flora';
    const endpoint = `https://my-api.plantnet.org/v2/identify/${project}?api-key=${encodeURIComponent(apiKey)}&lang=en&include-related-images=false&no-reject=false`;
    // PlantNet은 JPEG/PNG/GIF만 허용 — webp가 섞이면 INVALID_ARGUMENT.
    // sharp로 모든 이미지를 안전한 JPEG로 정규화 후 multipart 구성.
    const form = new FormData();
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let bytes;
        try {
            // 입력이 이미 JPEG든 webp/png든 일괄 JPEG로 재인코딩 — 가장 호환성 높은 형식
            bytes = await sharp(Buffer.from(img.base64, 'base64'))
                .rotate() // EXIF orientation 적용
                .jpeg({ quality: 88, mozjpeg: false })
                .toBuffer();
        }
        catch (e) {
            logger.warn(`PlantNet 이미지 ${i + 1} sharp 변환 실패 — 원본 사용: ${e === null || e === void 0 ? void 0 : e.message}`);
            bytes = Buffer.from(img.base64, 'base64');
        }
        // Node 20 의 global File 우선 사용 (undici가 multipart에서 가장 정확히 다룸).
        // 일부 환경에서 File이 없을 수 있어 Blob fallback 제공.
        // Buffer/Uint8Array → BlobPart 캐스팅은 TS strict(SharedArrayBuffer 분기) 회피용.
        const blobPart = bytes;
        let part;
        if (typeof globalThis.File === 'function') {
            part = new globalThis.File([blobPart], `image_${i + 1}.jpg`, { type: 'image/jpeg' });
            form.append('images', part);
        }
        else {
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
        hasFileGlobal: typeof globalThis.File === 'function',
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
        let failureCategory;
        if (response.status === 401)
            failureCategory = 'auth_invalid_key';
        else if (response.status === 403)
            failureCategory = 'auth_forbidden_or_plan';
        else if (response.status === 404)
            failureCategory = 'not_found';
        else if (response.status === 429)
            failureCategory = 'quota_exceeded';
        else
            failureCategory = 'unknown';
        logger.error('PlantNet 응답 오류', {
            status: response.status,
            statusText: response.statusText,
            failureCategory,
            bodyPreview: errText.slice(0, 800),
        });
        throw new Error(`PlantNet ${response.status} ${response.statusText} [${failureCategory}]: ${errText.slice(0, 200)}`);
    }
    const json = await response.json();
    const results = Array.isArray(json === null || json === void 0 ? void 0 : json.results) ? json.results : [];
    logger.info('PlantNet 응답 OK', {
        resultCount: results.length,
        topScore: (_a = results[0]) === null || _a === void 0 ? void 0 : _a.score,
    });
    logger.info('PlantNet 점수 필드 확인', {
        topKeys: Object.keys(results[0] || {}),
        score: (_c = (_b = results[0]) === null || _b === void 0 ? void 0 : _b.score) !== null && _c !== void 0 ? _c : null,
        probability: (_f = (_d = results[0]) === null || _d === void 0 ? void 0 : _d.probability) !== null && _f !== void 0 ? _f : null,
        confidence: (_h = (_g = results[0]) === null || _g === void 0 ? void 0 : _g.confidence) !== null && _h !== void 0 ? _h : null,
        similarity: (_k = (_j = results[0]) === null || _j === void 0 ? void 0 : _j.similarity) !== null && _k !== void 0 ? _k : null,
        selectedScore: pickApiScore((_l = results[0]) === null || _l === void 0 ? void 0 : _l.score, (_m = results[0]) === null || _m === void 0 ? void 0 : _m.probability, (_o = results[0]) === null || _o === void 0 ? void 0 : _o.confidence, (_p = results[0]) === null || _p === void 0 ? void 0 : _p.similarity),
    });
    const toCandidate = (r) => {
        var _a, _b, _c, _d;
        const species = (r === null || r === void 0 ? void 0 : r.species) || {};
        const commonArr = Array.isArray(species.commonNames) ? species.commonNames : [];
        const common = commonArr.length > 0 ? String(commonArr[0]) : '';
        const sci = String(species.scientificNameWithoutAuthor || species.scientificName || '');
        return {
            name: (common || sci || '').slice(0, 80),
            scientificName: sci.slice(0, 120),
            score: pickApiScore(r === null || r === void 0 ? void 0 : r.score, r === null || r === void 0 ? void 0 : r.probability, r === null || r === void 0 ? void 0 : r.confidence, r === null || r === void 0 ? void 0 : r.similarity),
            family: ((_a = species === null || species === void 0 ? void 0 : species.family) === null || _a === void 0 ? void 0 : _a.scientificNameWithoutAuthor) || ((_b = species === null || species === void 0 ? void 0 : species.family) === null || _b === void 0 ? void 0 : _b.scientificName) || undefined,
            genus: ((_c = species === null || species === void 0 ? void 0 : species.genus) === null || _c === void 0 ? void 0 : _c.scientificNameWithoutAuthor) || ((_d = species === null || species === void 0 ? void 0 : species.genus) === null || _d === void 0 ? void 0 : _d.scientificName) || undefined,
        };
    };
    const sorted = [...results].sort((a, b) => {
        var _a, _b;
        const bScore = (_a = pickApiScore(b === null || b === void 0 ? void 0 : b.score, b === null || b === void 0 ? void 0 : b.probability, b === null || b === void 0 ? void 0 : b.confidence, b === null || b === void 0 ? void 0 : b.similarity)) !== null && _a !== void 0 ? _a : -1;
        const aScore = (_b = pickApiScore(a === null || a === void 0 ? void 0 : a.score, a === null || a === void 0 ? void 0 : a.probability, a === null || a === void 0 ? void 0 : a.confidence, a === null || a === void 0 ? void 0 : a.similarity)) !== null && _b !== void 0 ? _b : -1;
        return bScore - aScore;
    });
    const top = sorted.length > 0 ? toCandidate(sorted[0]) : null;
    const alternatives = sorted.slice(1, 4).map(toCandidate).filter((c) => c.name);
    return { top, alternatives };
}
// 🌿 학명 → plant_dictionary 캐시 키 정규화 (binomial nomenclature 기준 — author/cultivar 제외)
function normalizeScientificKey(scientific) {
    const s = String(scientific || '').trim();
    if (!s)
        return '';
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
async function resolveKoreanPlantName(scientificName, englishName, geminiApiKey) {
    var _a;
    const scientificKey = normalizeScientificKey(scientificName);
    if (!scientificKey)
        return { koName: null, scientificKey: '', cached: false };
    const ref = db.collection('plant_dictionary').doc(scientificKey);
    try {
        const snap = await ref.get();
        if (snap.exists) {
            const data = snap.data();
            const koNames = Array.isArray(data === null || data === void 0 ? void 0 : data.koNames) ? data.koNames : [];
            const englishNames = Array.isArray(data === null || data === void 0 ? void 0 : data.englishNames) ? data.englishNames : [];
            if (englishName && !englishNames.includes(englishName)) {
                ref.update({
                    englishNames: admin.firestore.FieldValue.arrayUnion(englishName),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }).catch(() => { });
            }
            return { koName: koNames[0] || null, scientificKey, cached: true };
        }
    }
    catch (e) {
        logger.warn('plant_dictionary 캐시 조회 실패: ' + ((e === null || e === void 0 ? void 0 : e.message) || ''));
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiApiKey);
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
        const koName = String((parsed === null || parsed === void 0 ? void 0 : parsed.koName) || '').trim().slice(0, 60);
        const confidence = Number((_a = parsed === null || parsed === void 0 ? void 0 : parsed.confidence) !== null && _a !== void 0 ? _a : 0);
        const isValid = Boolean(parsed === null || parsed === void 0 ? void 0 : parsed.isValid);
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
            }
            catch (e) {
                logger.warn('plant_dictionary 저장 실패: ' + ((e === null || e === void 0 ? void 0 : e.message) || ''));
            }
            return { koName, scientificKey, cached: false };
        }
        logger.info('한국어 검정 기준 미달', { scientificKey, koName, confidence, isValid });
        return { koName: null, scientificKey, cached: false };
    }
    catch (e) {
        logger.warn('한국어 검정 AI 호출 실패: ' + ((e === null || e === void 0 ? void 0 : e.message) || ''));
        return { koName: null, scientificKey, cached: false };
    }
}
async function callGeminiCrossVerification(plantId, plantNet, images, apiKey) {
    var _a, _b;
    // 두 API 결과 요약을 JSON 문자열로 직렬화 (Gemini가 비교 분석)
    const plantIdSummary = plantId
        ? {
            topName: plantId.topPlantName,
            latinName: plantId.latinName,
            confidence: plantId.identificationProbability === null
                ? null
                : Math.round(plantId.identificationProbability * 100) / 100,
            family: (_a = plantId.taxonomy) === null || _a === void 0 ? void 0 : _a.family,
            genus: (_b = plantId.taxonomy) === null || _b === void 0 ? void 0 : _b.genus,
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
  "confidence": "high | medium | low"
}`;
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    // 사진들을 모두 첨부 (Gemini는 multi-image 지원)
    const parts = [prompt];
    for (const img of images.slice(0, 5)) {
        parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType || 'image/jpeg' } });
    }
    const result = await model.generateContent(parts);
    const text = result.response.text();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('Gemini 응답에서 JSON을 찾을 수 없습니다.');
    const parsed = JSON.parse(jsonMatch[0]);
    const normList = (v) => Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5) : [];
    const edibleRaw = String((parsed === null || parsed === void 0 ? void 0 : parsed.edible) || 'unknown').toLowerCase();
    const edible = (['unknown', 'yes', 'no'].includes(edibleRaw) ? edibleRaw : 'unknown');
    const confRaw = String((parsed === null || parsed === void 0 ? void 0 : parsed.confidence) || 'low').toLowerCase();
    const confidence = (['high', 'medium', 'low'].includes(confRaw) ? confRaw : 'low');
    return {
        finalGuess: String((parsed === null || parsed === void 0 ? void 0 : parsed.finalGuess) || '식물 이름 불확실').slice(0, 80),
        finalLatinName: String((parsed === null || parsed === void 0 ? void 0 : parsed.finalLatinName) || '').slice(0, 120),
        analysis: String((parsed === null || parsed === void 0 ? void 0 : parsed.analysis) || '').slice(0, 400),
        warning: String((parsed === null || parsed === void 0 ? void 0 : parsed.warning) || '').slice(0, 200),
        edible,
        poisonousRisk: Boolean(parsed === null || parsed === void 0 ? void 0 : parsed.poisonousRisk),
        similarSpecies: normList(parsed === null || parsed === void 0 ? void 0 : parsed.similarSpecies),
        needMorePhotos: normList(parsed === null || parsed === void 0 ? void 0 : parsed.needMorePhotos),
        confidence,
    };
}
exports.detectPlantAdvanced = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY_SECRET, KINDWISE_PLANT_ID_API_KEY_SECRET, PLANTNET_API_KEY_SECRET],
    memory: '1GiB',
    timeoutSeconds: 120,
}, async (request) => {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l, _m;
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const rawImages = (_a = request.data) === null || _a === void 0 ? void 0 : _a.images;
    if (!Array.isArray(rawImages) || rawImages.length === 0) {
        throw new https_2.HttpsError('invalid-argument', '이미지 1장 이상이 필요합니다.');
    }
    if (rawImages.length > 5) {
        throw new https_2.HttpsError('invalid-argument', '최대 5장까지 업로드 가능합니다.');
    }
    // base64 정리 (data URI prefix 제거) + 타입 정규화
    const images = rawImages.map((it) => {
        const b64 = String((it === null || it === void 0 ? void 0 : it.imageBase64) || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
        return { base64: b64, mimeType: String((it === null || it === void 0 ? void 0 : it.mimeType) || 'image/jpeg') };
    }).filter((it) => it.base64.length > 0);
    if (images.length === 0) {
        throw new https_2.HttpsError('invalid-argument', '유효한 이미지 데이터가 없습니다.');
    }
    // 총 용량 가드 (≈ base64 75% 비율 = 실제 바이트)
    const totalKb = images.reduce((s, img) => s + Math.round(img.base64.length * 0.75 / 1024), 0);
    if (totalKb > 12 * 1024) {
        throw new https_2.HttpsError('invalid-argument', '사진 총 용량이 너무 큽니다 (최대 ~12MB). 압축 후 다시 시도해 주세요.');
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
    }
    catch (_e) {
        plantNetKey = '';
    }
    // Plant.id는 Kindwise 크레딧 확보 후 다시 활성화할 수 있도록 호출부를 보존한다.
    const plantIdPromise = ENABLE_KINDWISE_PLANT_ID
        ? callKindwiseIdentification(images[0].base64, images[0].mimeType, KINDWISE_PLANT_ID_API_KEY_SECRET.value()).catch((e) => {
            logger.warn('Plant.id 실패 — 계속 진행: ' + ((e === null || e === void 0 ? void 0 : e.message) || 'unknown'));
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
    const plantNetPromise = plantNetKey
        ? callPlantNetIdentification(images, plantNetKey).catch((e) => {
            logger.warn('PlantNet 실패 — 계속 진행: ' + ((e === null || e === void 0 ? void 0 : e.message) || 'unknown'));
            return null;
        })
        : Promise.resolve(null);
    const [plantIdResult, plantNetResult] = await Promise.all([plantIdPromise, plantNetPromise]);
    // Gemini 교차검증
    let cross = null;
    let geminiError;
    try {
        cross = await callGeminiCrossVerification(plantIdResult, plantNetResult, images, GEMINI_API_KEY_SECRET.value());
    }
    catch (e) {
        geminiError = (e === null || e === void 0 ? void 0 : e.message) || 'Gemini 교차검증 실패';
        logger.error('Gemini 교차검증 실패', { message: geminiError });
    }
    // 둘 다 실패 + Gemini도 실패 → 사용자에게 에러
    if (!plantIdResult && !plantNetResult && !cross) {
        throw new https_2.HttpsError('internal', '식물 식별에 실패했습니다. 사진을 다시 찍어 주세요 (잎·꽃·줄기가 모두 보이도록).');
    }
    // 🌿 PlantNet top 결과 → 한국어명 검정 (캐시 우선, 실패 시 영어명 fallback)
    let plantNetKoName = null;
    let plantNetScientificKey = null;
    if ((_b = plantNetResult === null || plantNetResult === void 0 ? void 0 : plantNetResult.top) === null || _b === void 0 ? void 0 : _b.scientificName) {
        const resolution = await resolveKoreanPlantName(plantNetResult.top.scientificName, plantNetResult.top.name || '', GEMINI_API_KEY_SECRET.value()).catch((e) => {
            logger.warn('한국어명 검정 fallback — ' + ((e === null || e === void 0 ? void 0 : e.message) || ''));
            return { koName: null, scientificKey: '', cached: false };
        });
        plantNetKoName = resolution.koName;
        plantNetScientificKey = resolution.scientificKey || null;
    }
    const plantIdConfidence = (_c = plantIdResult === null || plantIdResult === void 0 ? void 0 : plantIdResult.identificationProbability) !== null && _c !== void 0 ? _c : null;
    const plantNetConfidence = (_f = (_d = plantNetResult === null || plantNetResult === void 0 ? void 0 : plantNetResult.top) === null || _d === void 0 ? void 0 : _d.score) !== null && _f !== void 0 ? _f : null;
    logger.info('detectPlantAdvanced 반환 점수 확인', {
        plantIdConfidence,
        plantNetConfidence,
        plantIdAlternativeScores: (plantIdResult === null || plantIdResult === void 0 ? void 0 : plantIdResult.alternativeCandidates.map((c) => c.probability)) || [],
        plantNetAlternativeScores: (plantNetResult === null || plantNetResult === void 0 ? void 0 : plantNetResult.alternatives.map((c) => c.score)) || [],
    });
    return {
        plantId: plantIdResult
            ? {
                name: plantIdResult.topPlantName,
                latinName: plantIdResult.latinName,
                confidence: plantIdConfidence,
                isPlantProbability: plantIdResult.isPlantProbability,
                family: (_g = plantIdResult.taxonomy) === null || _g === void 0 ? void 0 : _g.family,
                genus: (_h = plantIdResult.taxonomy) === null || _h === void 0 ? void 0 : _h.genus,
                alternatives: plantIdResult.alternativeCandidates,
                url: plantIdResult.kindwiseUrl || null,
            }
            : null,
        plantNet: plantNetResult
            ? {
                name: ((_j = plantNetResult.top) === null || _j === void 0 ? void 0 : _j.name) || '',
                scientificName: ((_k = plantNetResult.top) === null || _k === void 0 ? void 0 : _k.scientificName) || '',
                confidence: plantNetConfidence,
                koName: plantNetKoName,
                scientificKey: plantNetScientificKey,
                family: (_l = plantNetResult.top) === null || _l === void 0 ? void 0 : _l.family,
                genus: (_m = plantNetResult.top) === null || _m === void 0 ? void 0 : _m.genus,
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
});
// ===========================================
// 🌿 NIBR (국립생물자원관) 국가생물종목록 Open API 테스트 endpoint
//   - process.env.NIBR_API_KEY 사용 (응답/로그에 절대 노출하지 않음)
//   - process.env.NIBR_TEST_SECRET 으로 헤더 토큰 검증 (개발자 전용 잠금)
//   - 명세 기준: 키 파라미터명 oapiAcsUnqNo / page=1 / responseType=json
//   - 검색어 파라미터는 현재 명세에서 미확인 → 우선 목록 조회만 수행해 응답 구조 확인
//   - 호출 예: curl -H "x-internal-test-secret: $SECRET" \
//             "https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/testNibrPlantSearch?page=1"
// ===========================================
function maskAllSecrets(text, secrets) {
    let out = text;
    for (const s of secrets) {
        if (typeof s === 'string' && s.length > 0) {
            out = out.split(s).join('***REDACTED***');
        }
    }
    return out;
}
function sanitizeValue(v, secrets) {
    if (v == null)
        return v;
    if (typeof v === 'string')
        return maskAllSecrets(v, secrets);
    if (typeof v === 'number' || typeof v === 'boolean')
        return v;
    if (Array.isArray(v))
        return v.map((x) => sanitizeValue(x, secrets));
    if (typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v)) {
            out[k] = sanitizeValue(v[k], secrets);
        }
        return out;
    }
    return v;
}
exports.testNibrPlantSearch = (0, https_1.onRequest)({ region: 'asia-northeast3', timeoutSeconds: 30 }, async (req, res) => {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k;
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
        const response = await axios_1.default.get(endpoint, {
            params: {
                oapiAcsUnqNo: apiKey,
                page,
                responseType: 'json',
            },
            responseType: 'text',
            validateStatus: () => true,
            timeout: 15000,
        });
        const httpStatus = response.status;
        const contentType = String(response.headers['content-type'] || '');
        const rawRaw = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data || {});
        const responseLength = rawRaw.length;
        const snippetMasked = maskAllSecrets(rawRaw.slice(0, 1500), secretsToMask);
        // JSON 파싱은 원본(rawRaw)으로 수행 — 파싱 결과는 sanitizeValue로 한 번 더 마스킹
        let parsedJson = null;
        try {
            parsedJson = JSON.parse(rawRaw);
        }
        catch {
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
        let foundArrayPath = null;
        let firstItem = null;
        let itemCount = null;
        let itemKeys = [];
        if (parsedJson && typeof parsedJson === 'object') {
            const candidatePaths = [
                { path: 'result.item', value: (_a = parsedJson === null || parsedJson === void 0 ? void 0 : parsedJson.result) === null || _a === void 0 ? void 0 : _a.item },
                { path: 'result.items', value: (_b = parsedJson === null || parsedJson === void 0 ? void 0 : parsedJson.result) === null || _b === void 0 ? void 0 : _b.items },
                { path: 'items', value: parsedJson === null || parsedJson === void 0 ? void 0 : parsedJson.items },
                { path: 'data.item', value: (_c = parsedJson === null || parsedJson === void 0 ? void 0 : parsedJson.data) === null || _c === void 0 ? void 0 : _c.item },
                { path: 'data.items', value: (_d = parsedJson === null || parsedJson === void 0 ? void 0 : parsedJson.data) === null || _d === void 0 ? void 0 : _d.items },
                { path: 'data.list', value: (_f = parsedJson === null || parsedJson === void 0 ? void 0 : parsedJson.data) === null || _f === void 0 ? void 0 : _f.list },
                { path: 'response.body.items.item', value: (_j = (_h = (_g = parsedJson === null || parsedJson === void 0 ? void 0 : parsedJson.response) === null || _g === void 0 ? void 0 : _g.body) === null || _h === void 0 ? void 0 : _h.items) === null || _j === void 0 ? void 0 : _j.item },
                { path: 'body.items', value: (_k = parsedJson === null || parsedJson === void 0 ? void 0 : parsedJson.body) === null || _k === void 0 ? void 0 : _k.items },
                { path: 'list', value: parsedJson === null || parsedJson === void 0 ? void 0 : parsedJson.list },
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
            topLevelKeys: parsedJson && typeof parsedJson === 'object' ? Object.keys(parsedJson) : null,
            foundArrayPath,
            itemCount,
            itemKeys,
            detected,
            parsedFirstItem: sanitizedFirstItem,
        });
    }
    catch (err) {
        logger.error('NIBR test call failed', {
            message: (err === null || err === void 0 ? void 0 : err.message) || String(err),
            code: (err === null || err === void 0 ? void 0 : err.code) || null,
        });
        res.status(500).json({
            ok: false,
            page,
            endpoint,
            error: (err === null || err === void 0 ? void 0 : err.message) || 'NIBR call failed',
            code: (err === null || err === void 0 ? void 0 : err.code) || null,
        });
    }
});
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
function getOneDriveEnv() {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || ONEDRIVE_REDIRECT_URI;
    if (!clientId || !clientSecret)
        return null;
    return { clientId, clientSecret, redirectUri };
}
async function ensureHaruFolderOnOneDrive(accessToken) {
    var _a, _b, _c;
    // 1) 기존 폴더 조회 (중복 생성 방지)
    try {
        const existing = await axios_1.default.get(`${ONEDRIVE_GRAPH_BASE}/me/drive/root:${ONEDRIVE_HARU_FOLDER_PATH}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            validateStatus: () => true,
            timeout: 15000,
        });
        if (existing.status === 200 && ((_a = existing.data) === null || _a === void 0 ? void 0 : _a.id)) {
            return { folderId: existing.data.id, folderPath: ONEDRIVE_HARU_FOLDER_PATH };
        }
    }
    catch {
        /* fall through to create */
    }
    // 2) 신규 생성 (conflictBehavior: fail → 409면 race condition으로 간주하고 재조회)
    try {
        const created = await axios_1.default.post(`${ONEDRIVE_GRAPH_BASE}/me/drive/root/children`, {
            name: ONEDRIVE_HARU_FOLDER_NAME,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            validateStatus: () => true,
            timeout: 15000,
        });
        if (created.status === 201 && ((_b = created.data) === null || _b === void 0 ? void 0 : _b.id)) {
            return { folderId: created.data.id, folderPath: ONEDRIVE_HARU_FOLDER_PATH };
        }
        if (created.status === 409) {
            // race or hidden conflict — 재조회 시도
            const re = await axios_1.default.get(`${ONEDRIVE_GRAPH_BASE}/me/drive/root:${ONEDRIVE_HARU_FOLDER_PATH}`, { headers: { Authorization: `Bearer ${accessToken}` }, validateStatus: () => true, timeout: 15000 });
            if (re.status === 200 && ((_c = re.data) === null || _c === void 0 ? void 0 : _c.id)) {
                return { folderId: re.data.id, folderPath: ONEDRIVE_HARU_FOLDER_PATH };
            }
        }
        throw new Error(`folder create failed: status ${created.status}`);
    }
    catch (e) {
        throw new Error(`folder create error: ${(e === null || e === void 0 ? void 0 : e.message) || 'unknown'}`);
    }
}
// 1) OAuth 시작 — authUrl 반환 (callable, uid 확인)
exports.startOneDriveConnect = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [MICROSOFT_CLIENT_ID_SECRET, MICROSOFT_CLIENT_SECRET_SECRET] }, async (request) => {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const env = getOneDriveEnv();
    if (!env) {
        logger.warn('OneDrive env missing — MICROSOFT_CLIENT_ID/SECRET not configured');
        throw new https_2.HttpsError('failed-precondition', 'OneDrive 연결이 아직 설정되지 않았습니다.');
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
});
// 2) OAuth callback — Microsoft 가 호출 → token 교환 → 폴더 생성 → Firestore 저장 → 프론트 redirect
exports.oneDriveCallback = (0, https_1.onRequest)({ region: 'asia-northeast3', timeoutSeconds: 60, secrets: [MICROSOFT_CLIENT_ID_SECRET, MICROSOFT_CLIENT_SECRET_SECRET] }, async (req, res) => {
    var _a, _b, _c, _d, _f;
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
        if (!code || typeof code !== 'string')
            throw new Error('missing code');
        if (!state || typeof state !== 'string')
            throw new Error('missing state');
        const stateDoc = await db.collection('oauth_states').doc(state).get();
        if (!stateDoc.exists)
            throw new Error('state not found');
        const stateData = stateDoc.data();
        if (!stateData)
            throw new Error('state empty');
        if (stateData.provider !== 'oneDrive')
            throw new Error('provider mismatch');
        if (((_b = (_a = stateData.expiresAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) < Date.now())
            throw new Error('state expired');
        const uid = stateData.uid;
        if (!uid)
            throw new Error('uid missing in state');
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
        const tokenRes = await axios_1.default.post(ONEDRIVE_TOKEN_URL, tokenForm.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: () => true,
            timeout: 20000,
        });
        if (tokenRes.status !== 200 || !((_c = tokenRes.data) === null || _c === void 0 ? void 0 : _c.access_token)) {
            logger.error('OneDrive token exchange failed — status=' + tokenRes.status + ' error=' + String((_d = tokenRes.data) === null || _d === void 0 ? void 0 : _d.error) + ' desc=' + String(((_f = tokenRes.data) === null || _f === void 0 ? void 0 : _f.error_description) || ''));
            throw new Error('token exchange failed');
        }
        const accessToken = tokenRes.data.access_token;
        const refreshToken = tokenRes.data.refresh_token || null;
        const expiresInSec = Number(tokenRes.data.expires_in) || 3600;
        const tokenExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + expiresInSec * 1000);
        // /HARU2026 폴더 생성 (또는 기존 사용)
        let folderId = null;
        let folderPath = null;
        try {
            const ensured = await ensureHaruFolderOnOneDrive(accessToken);
            folderId = ensured.folderId;
            folderPath = ensured.folderPath;
        }
        catch (e) {
            logger.error('OneDrive folder ensure failed', { message: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
        // Firestore 저장 — users/{uid}/cloudConnections/oneDrive
        const docRef = db.doc(`users/${uid}/cloudConnections/oneDrive`);
        await docRef.set({
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
        }, { merge: true });
        res.redirect(`${FRONTEND_URL}/asset-explorer?onedrive=connected`);
    }
    catch (error) {
        logger.error('OneDrive callback failed — ' + ((error === null || error === void 0 ? void 0 : error.message) || String(error)));
        res.redirect(`${FRONTEND_URL}/asset-explorer?onedrive=error`);
    }
});
// 3) HARU 폴더 보장 (멱등) — callable, 이미 있으면 기존 폴더 사용
exports.ensureOneDriveHaruFolder = (0, https_2.onCall)({ region: 'asia-northeast3' }, async (request) => {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    const docRef = db.doc(`users/${uid}/cloudConnections/oneDrive`);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new https_2.HttpsError('failed-precondition', 'OneDrive 연결이 필요합니다.');
    }
    const data = snap.data();
    const accessToken = data === null || data === void 0 ? void 0 : data.accessToken;
    if (!accessToken) {
        throw new https_2.HttpsError('failed-precondition', 'OneDrive 액세스 정보가 없습니다.');
    }
    try {
        const ensured = await ensureHaruFolderOnOneDrive(accessToken);
        await docRef.set({
            folderId: ensured.folderId,
            folderPath: ensured.folderPath,
            status: 'connected',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { folderId: ensured.folderId, folderPath: ensured.folderPath };
    }
    catch (e) {
        logger.error('ensureOneDriveHaruFolder failed', { message: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        throw new https_2.HttpsError('internal', 'HARU 폴더 준비에 실패했습니다.');
    }
});
// 4) 연결 상태 조회 — 토큰 없이 boolean + folder 상태만 반환
exports.getOneDriveConnectionState = (0, https_2.onCall)({ region: 'asia-northeast3' }, async (request) => {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    const snap = await db.doc(`users/${uid}/cloudConnections/oneDrive`).get();
    if (!snap.exists) {
        return { connected: false, folderReady: false, folderPath: null };
    }
    const data = snap.data();
    const connected = Boolean((data === null || data === void 0 ? void 0 : data.connected) && (data === null || data === void 0 ? void 0 : data.accessToken));
    const folderReady = Boolean(data === null || data === void 0 ? void 0 : data.folderId);
    const folderPath = (data === null || data === void 0 ? void 0 : data.folderPath) || null;
    return { connected, folderReady, folderPath };
});
// 5) 최근 자산 추천 + 가져오기 (Google Drive 미러링)
//   getOneDriveCandidates: Graph /me/drive/recent → 후보 필터 → 최대 20개
//   copyOneDriveAssets: 선택 파일 /HARU2026 복사(202 비동기) + assets 색인(status pending_copy)
function isOneDriveAssetCandidate(item) {
    var _a;
    if (!item || item.folder)
        return false;
    const mt = ((_a = item.file) === null || _a === void 0 ? void 0 : _a.mimeType) || '';
    return (mt === 'application/pdf' ||
        mt.startsWith('image/') ||
        mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        mt === 'application/msword' ||
        mt === 'application/vnd.ms-excel' ||
        mt === 'application/vnd.ms-powerpoint');
}
function getOneDriveFileKind(mt) {
    if (mt === 'application/pdf')
        return 'PDF';
    if (mt.startsWith('image/'))
        return '이미지';
    if (mt.includes('wordprocessingml') || mt === 'application/msword')
        return '문서';
    if (mt.includes('spreadsheetml') || mt === 'application/vnd.ms-excel')
        return '스프레드시트';
    if (mt.includes('presentationml') || mt === 'application/vnd.ms-powerpoint')
        return '프레젠테이션';
    return '파일';
}
async function refreshOneDriveAccessToken(uid, data) {
    var _a, _b, _c, _d, _f;
    const expiresAt = ((_b = (_a = data === null || data === void 0 ? void 0 : data.tokenExpiresAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0;
    if ((data === null || data === void 0 ? void 0 : data.accessToken) && expiresAt > Date.now() + 60 * 1000) {
        return data.accessToken;
    }
    if (!(data === null || data === void 0 ? void 0 : data.refreshToken)) {
        throw new https_2.HttpsError('failed-precondition', 'OneDrive 연결이 만료되었습니다. 다시 연결해 주세요.');
    }
    const env = getOneDriveEnv();
    if (!env) {
        throw new https_2.HttpsError('failed-precondition', 'OneDrive 연결이 아직 설정되지 않았습니다.');
    }
    const form = new URLSearchParams({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        refresh_token: data.refreshToken,
        grant_type: 'refresh_token',
        redirect_uri: env.redirectUri,
        scope: ONEDRIVE_OAUTH_SCOPE,
    });
    const res = await axios_1.default.post(ONEDRIVE_TOKEN_URL, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true,
        timeout: 20000,
    });
    if (res.status !== 200 || !((_c = res.data) === null || _c === void 0 ? void 0 : _c.access_token)) {
        logger.error('OneDrive token refresh failed — status=' + res.status + ' error=' + String((_d = res.data) === null || _d === void 0 ? void 0 : _d.error) + ' desc=' + String(((_f = res.data) === null || _f === void 0 ? void 0 : _f.error_description) || ''));
        throw new https_2.HttpsError('failed-precondition', 'OneDrive 연결이 만료되었습니다. 다시 연결해 주세요.');
    }
    const accessToken = res.data.access_token;
    const newRefresh = res.data.refresh_token || data.refreshToken;
    const expiresInSec = Number(res.data.expires_in) || 3600;
    await db.doc(`users/${uid}/cloudConnections/oneDrive`).set({
        accessToken,
        refreshToken: newRefresh,
        tokenExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + expiresInSec * 1000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return accessToken;
}
async function getOneDriveAccessToken(uid) {
    const snap = await db.doc(`users/${uid}/cloudConnections/oneDrive`).get();
    if (!snap.exists) {
        throw new https_2.HttpsError('failed-precondition', 'OneDrive 연결이 필요합니다.');
    }
    return refreshOneDriveAccessToken(uid, snap.data());
}
exports.getOneDriveCandidates = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [MICROSOFT_CLIENT_ID_SECRET, MICROSOFT_CLIENT_SECRET_SECRET] }, async (request) => {
    var _a, _b;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    const accessToken = await getOneDriveAccessToken(uid);
    const res = await axios_1.default.get(`${ONEDRIVE_GRAPH_BASE}/me/drive/recent`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { $top: 40 },
        validateStatus: () => true,
        timeout: 20000,
    });
    if (res.status !== 200) {
        logger.error('OneDrive recent list failed — status=' + res.status);
        throw new https_2.HttpsError('internal', '최근 자산 후보를 불러오지 못했습니다.');
    }
    const items = (((_b = res.data) === null || _b === void 0 ? void 0 : _b.value) || []);
    const candidates = items
        .filter(isOneDriveAssetCandidate)
        .slice(0, 20)
        .map((item) => {
        var _a;
        const mt = ((_a = item.file) === null || _a === void 0 ? void 0 : _a.mimeType) || '';
        return {
            id: item.id,
            name: item.name || '이름 없는 파일',
            mimeType: mt,
            modifiedTime: item.lastModifiedDateTime || '',
            webViewLink: item.webUrl || '',
            thumbnailLink: '',
            iconLink: '',
            kind: getOneDriveFileKind(mt),
        };
    });
    return { candidates };
});
exports.copyOneDriveAssets = (0, https_2.onCall)({ region: 'asia-northeast3', secrets: [MICROSOFT_CLIENT_ID_SECRET, MICROSOFT_CLIENT_SECRET_SECRET] }, async (request) => {
    var _a, _b, _c, _d, _f;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    const fileIds = Array.isArray((_b = request.data) === null || _b === void 0 ? void 0 : _b.fileIds)
        ? request.data.fileIds.filter((id) => typeof id === 'string' && id.trim())
        : [];
    if (fileIds.length === 0) {
        throw new https_2.HttpsError('invalid-argument', '가져올 파일을 선택해 주세요.');
    }
    if (fileIds.length > 20) {
        throw new https_2.HttpsError('invalid-argument', '한 번에 최대 20개까지 가져올 수 있습니다.');
    }
    const accessToken = await getOneDriveAccessToken(uid);
    const folder = await ensureHaruFolderOnOneDrive(accessToken);
    let requestedCount = 0;
    for (const fileId of fileIds) {
        const srcRes = await axios_1.default.get(`${ONEDRIVE_GRAPH_BASE}/me/drive/items/${encodeURIComponent(fileId)}`, { headers: { Authorization: `Bearer ${accessToken}` }, validateStatus: () => true, timeout: 20000 });
        if (srcRes.status !== 200 || !((_c = srcRes.data) === null || _c === void 0 ? void 0 : _c.id))
            continue;
        const src = srcRes.data;
        if (!isOneDriveAssetCandidate(src))
            continue;
        const copyRes = await axios_1.default.post(`${ONEDRIVE_GRAPH_BASE}/me/drive/items/${encodeURIComponent(fileId)}/copy`, { parentReference: { id: folder.folderId }, name: src.name }, {
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            validateStatus: () => true,
            timeout: 20000,
        });
        const accepted = copyRes.status === 202 || copyRes.status === 200;
        const monitorUrl = ((_d = copyRes.headers) === null || _d === void 0 ? void 0 : _d.location) || null;
        const mt = ((_f = src.file) === null || _f === void 0 ? void 0 : _f.mimeType) || '';
        const assetRef = db.collection('users').doc(uid).collection('assets').doc(src.id);
        const now = admin.firestore.FieldValue.serverTimestamp();
        await assetRef.set({
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
        }, { merge: true });
        if (accepted)
            requestedCount += 1;
    }
    return { copiedCount: requestedCount };
});
// ===========================================
// 🌿 국내 생물종(NIBR) 보강 — getKoreanPlantInfo
//   목적: PlantNet/Plant.id 판독 결과의 scientificName을 받아
//         NIBR 국가생물종지식정보시스템에서 한국어 국명/분류정보를 보강 조회.
//   원칙: 보강 정보 전용. 실패 시 throw 대신 fallback 응답으로 기존 흐름 무영향.
//   금지: public onRequest 노출 / 캐시 / mock / 키 echo / NIBR 결과를 사용자 확정값으로 저장.
//   Secret: defineSecret('NIBR_API_KEY')
//     - 미등록 시 status: "not_configured" 반환 (이번 1차 배포 dry-run 상태)
// ===========================================
const NIBR_API_KEY_SECRET = (0, params_1.defineSecret)('NIBR_API_KEY');
function nibrPickString(...values) {
    for (const v of values) {
        if (typeof v === 'string') {
            const t = v.trim();
            if (t.length > 0)
                return t;
        }
    }
    return null;
}
function nibrNormalizeSci(s) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
function nibrExtractArray(parsed) {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l;
    if (!parsed || typeof parsed !== 'object')
        return [];
    const candidates = [
        (_a = parsed === null || parsed === void 0 ? void 0 : parsed.data) === null || _a === void 0 ? void 0 : _a.content, // ★ NIBR ktsn/taxons/search 공식 명세 (v1)
        (_b = parsed === null || parsed === void 0 ? void 0 : parsed.result) === null || _b === void 0 ? void 0 : _b.item,
        (_c = parsed === null || parsed === void 0 ? void 0 : parsed.result) === null || _c === void 0 ? void 0 : _c.items,
        parsed === null || parsed === void 0 ? void 0 : parsed.items,
        (_d = parsed === null || parsed === void 0 ? void 0 : parsed.data) === null || _d === void 0 ? void 0 : _d.item,
        (_f = parsed === null || parsed === void 0 ? void 0 : parsed.data) === null || _f === void 0 ? void 0 : _f.items,
        (_g = parsed === null || parsed === void 0 ? void 0 : parsed.data) === null || _g === void 0 ? void 0 : _g.list,
        (_k = (_j = (_h = parsed === null || parsed === void 0 ? void 0 : parsed.response) === null || _h === void 0 ? void 0 : _h.body) === null || _j === void 0 ? void 0 : _j.items) === null || _k === void 0 ? void 0 : _k.item,
        (_l = parsed === null || parsed === void 0 ? void 0 : parsed.body) === null || _l === void 0 ? void 0 : _l.items,
        parsed === null || parsed === void 0 ? void 0 : parsed.list,
    ];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0)
            return c;
    }
    return [];
}
// NIBR stnm은 권위명·연도가 붙는 형식("Cucurbita maxima Duchesne 1786") — 첫 두 토큰(속명+종소명)만 비교
function nibrSciBinomial(sci) {
    const tokens = sci.trim().toLowerCase().replace(/\s+/g, ' ').split(' ');
    return tokens.slice(0, 2).join(' ');
}
function nibrEmptyResponse(status) {
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
exports.getKoreanPlantInfo = (0, https_2.onCall)({
    region: 'asia-northeast3',
    secrets: [NIBR_API_KEY_SECRET],
    timeoutSeconds: 20,
}, async (request) => {
    var _a, _b;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new https_2.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    // 🇰🇷 NIBR 보강은 관리자(허대표) 전용 — 비관리자는 NIBR 호출 자체를 차단
    const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
    if (uid !== ADMIN_UID) {
        throw new https_2.HttpsError('permission-denied', '관리자 전용 기능입니다.');
    }
    const sciInput = String(((_b = request.data) === null || _b === void 0 ? void 0 : _b.scientificName) || '').trim();
    if (!sciInput) {
        return nibrEmptyResponse('not_found');
    }
    // Secret 미등록 fallback (1차 dry-run 정상 경로)
    let apiKey = '';
    try {
        apiKey = String(NIBR_API_KEY_SECRET.value() || '').trim();
    }
    catch {
        apiKey = '';
    }
    if (!apiKey) {
        logger.warn('NIBR_API_KEY not configured — enrichment skipped');
        return nibrEmptyResponse('not_configured');
    }
    const endpoint = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';
    try {
        const response = await axios_1.default.get(endpoint, {
            params: {
                oapiAcsUnqNo: apiKey,
                page: 1,
                responseType: 'json',
            },
            responseType: 'text',
            validateStatus: () => true,
            timeout: 15000,
        });
        const httpStatus = response.status;
        const rawRaw = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data || {});
        // 응답에서 NIBR errorCode 추출 (진단용 — 키 값은 절대 포함 X)
        let parsedForDiag = null;
        try {
            parsedForDiag = JSON.parse(rawRaw);
        }
        catch {
            /* not JSON — XML 가능성 */
        }
        const nibrErrorCode = parsedForDiag && typeof parsedForDiag === 'object'
            ? parsedForDiag.errorCode || null
            : null;
        // 신청 미완료 / 권한 오류 — fallback (throw 금지)
        const unavailableSignals = /APLY_NOT_FOUND|APLY_NOT_APRV|INVLD_API_KEY|UNAUTHORIZED|FORBIDDEN/i;
        if (httpStatus === 401 ||
            httpStatus === 403 ||
            httpStatus === 404 ||
            unavailableSignals.test(rawRaw)) {
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
        const parsed = parsedForDiag;
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
        let matched = null;
        for (const it of items) {
            // 1) stnm 첫 두 토큰(속명+종소명)
            const stnm = nibrPickString(it === null || it === void 0 ? void 0 : it.stnm, it === null || it === void 0 ? void 0 : it.scientificName);
            if (stnm && nibrSciBinomial(stnm) === target) {
                matched = it;
                break;
            }
            // 2) gnusKtsnLtnNm + specsKtsnLtnNm 조합
            const gnusL = nibrPickString(it === null || it === void 0 ? void 0 : it.gnusKtsnLtnNm);
            const specsL = nibrPickString(it === null || it === void 0 ? void 0 : it.specsKtsnLtnNm);
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
        const koreanName = nibrPickString(matched === null || matched === void 0 ? void 0 : matched.ktsnKrnNm, matched === null || matched === void 0 ? void 0 : matched.kornm, matched === null || matched === void 0 ? void 0 : matched.korNm, matched === null || matched === void 0 ? void 0 : matched.kor_nm, matched === null || matched === void 0 ? void 0 : matched.repKorNm, matched === null || matched === void 0 ? void 0 : matched.repKorName, matched === null || matched === void 0 ? void 0 : matched.koreanName);
        const speciesKoreanName = nibrPickString(matched === null || matched === void 0 ? void 0 : matched.specsKtsnKrnNm, matched === null || matched === void 0 ? void 0 : matched.specKorNm, matched === null || matched === void 0 ? void 0 : matched.species_kor, matched === null || matched === void 0 ? void 0 : matched.speciesKoreanName) || koreanName;
        const sciFinal = (() => {
            // 깨끗한 binomial 우선: gnusLtn + specsLtn
            const gnusL = nibrPickString(matched === null || matched === void 0 ? void 0 : matched.gnusKtsnLtnNm);
            const specsL = nibrPickString(matched === null || matched === void 0 ? void 0 : matched.specsKtsnLtnNm);
            if (gnusL && specsL)
                return `${gnusL} ${specsL}`;
            return nibrPickString(matched === null || matched === void 0 ? void 0 : matched.stnm, matched === null || matched === void 0 ? void 0 : matched.ktsnLtnNm, matched === null || matched === void 0 ? void 0 : matched.scientificName, matched === null || matched === void 0 ? void 0 : matched.sciNm);
        })();
        const phylumName = nibrPickString(matched === null || matched === void 0 ? void 0 : matched.phlmKtsnKrnNm, matched === null || matched === void 0 ? void 0 : matched.phlmKtsnLtnNm, matched === null || matched === void 0 ? void 0 : matched.phylumName, matched === null || matched === void 0 ? void 0 : matched.phylumKornm, matched === null || matched === void 0 ? void 0 : matched.phylumKorNm, matched === null || matched === void 0 ? void 0 : matched.phylum);
        const className = nibrPickString(matched === null || matched === void 0 ? void 0 : matched.classKtsnKrnNm, matched === null || matched === void 0 ? void 0 : matched.classKtsnLtnNm, matched === null || matched === void 0 ? void 0 : matched.className, matched === null || matched === void 0 ? void 0 : matched.classKornm, matched === null || matched === void 0 ? void 0 : matched.classKorNm, matched === null || matched === void 0 ? void 0 : matched.classNm);
        const orderName = nibrPickString(matched === null || matched === void 0 ? void 0 : matched.orderKtsnKrnNm, matched === null || matched === void 0 ? void 0 : matched.orderKtsnLtnNm, matched === null || matched === void 0 ? void 0 : matched.orderName, matched === null || matched === void 0 ? void 0 : matched.orderKornm, matched === null || matched === void 0 ? void 0 : matched.orderKorNm, matched === null || matched === void 0 ? void 0 : matched.ordNm);
        const familyName = nibrPickString(matched === null || matched === void 0 ? void 0 : matched.fmlyKtsnKrnNm, matched === null || matched === void 0 ? void 0 : matched.fmlyKtsnLtnNm, matched === null || matched === void 0 ? void 0 : matched.familyName, matched === null || matched === void 0 ? void 0 : matched.familyKornm, matched === null || matched === void 0 ? void 0 : matched.familyKorNm, matched === null || matched === void 0 ? void 0 : matched.famNm);
        const genusName = nibrPickString(matched === null || matched === void 0 ? void 0 : matched.gnusKtsnKrnNm, matched === null || matched === void 0 ? void 0 : matched.gnusKtsnLtnNm, matched === null || matched === void 0 ? void 0 : matched.genusName, matched === null || matched === void 0 ? void 0 : matched.genusKornm, matched === null || matched === void 0 ? void 0 : matched.genusKorNm, matched === null || matched === void 0 ? void 0 : matched.genNm);
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
    }
    catch (err) {
        logger.warn('NIBR enrichment call failed', {
            message: (err === null || err === void 0 ? void 0 : err.message) || String(err),
        });
        return nibrEmptyResponse('api_unavailable');
    }
});
