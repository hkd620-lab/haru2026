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
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledPushNotification = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
// firebase-admin 초기화 (이미 초기화된 경우 재사용)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const messaging = admin.messaging();
// 한국 시간대
const KST_OFFSET_HOURS = 9;
/**
 * 현재 한국 시간 기준 HH:mm 문자열을 반환합니다.
 */
function getKSTTime() {
    const now = new Date();
    const kstNow = new Date(now.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);
    const hour = String(kstNow.getUTCHours()).padStart(2, '0');
    const minute = String(kstNow.getUTCMinutes()).padStart(2, '0');
    const year = kstNow.getUTCFullYear();
    const month = String(kstNow.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstNow.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return { hour, minute, dateStr };
}
/**
 * 특정 사용자가 당일 기록을 작성했는지 확인합니다.
 */
async function hasRecordToday(uid, dateStr) {
    try {
        const recordRef = db.doc(`users/${uid}/records/${dateStr}`);
        const snap = await recordRef.get();
        return snap.exists;
    }
    catch (error) {
        logger.error(`기록 확인 실패 (uid: ${uid}, date: ${dateStr}):`, error);
        return true; // 에러 시 알림 발송 안 함 (보수적 처리)
    }
}
/**
 * FCM 알림을 발송합니다.
 */
async function sendPushNotification(token, uid) {
    const message = {
        token,
        notification: {
            title: '하루 📖',
            body: '오늘의 이야기를 남겨주세요 📖',
        },
        data: {
            url: '/record',
            uid,
        },
        android: {
            notification: {
                channelId: 'haru_reminder',
                priority: 'high',
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                },
            },
        },
        webpush: {
            notification: {
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                tag: 'haru-notification',
                renotify: true,
            },
        },
    };
    await messaging.send(message);
    logger.info(`알림 발송 완료 (uid: ${uid})`);
}
/**
 * 매시간 실행: 각 사용자의 알림 설정 시간과 현재 KST 시간을 비교하여
 * 당일 기록이 없는 사용자에게 FCM 알림을 발송합니다.
 */
exports.scheduledPushNotification = (0, scheduler_1.onSchedule)({
    schedule: '0 * * * *', // 매시간 정각
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
}, async () => {
    var _a;
    const { hour, minute, dateStr } = getKSTTime();
    const currentTime = `${hour}:${minute}`;
    logger.info(`알림 스케줄러 실행 - KST 현재 시간: ${currentTime}, 날짜: ${dateStr}`);
    try {
        // 알림이 활성화된 모든 사용자의 설정 조회
        const settingsSnapshot = await db
            .collectionGroup('settings')
            .where('notificationEnabled', '==', true)
            .get();
        if (settingsSnapshot.empty) {
            logger.info('알림 활성화 사용자 없음');
            return;
        }
        const sendPromises = [];
        for (const settingDoc of settingsSnapshot.docs) {
            const data = settingDoc.data();
            const notificationTime = (_a = data.notificationTime) !== null && _a !== void 0 ? _a : '21:00';
            const fcmToken = data.fcmToken;
            // 현재 시간과 설정 시간이 일치하는지 확인 (분 단위까지)
            if (notificationTime !== currentTime) {
                continue;
            }
            if (!fcmToken) {
                logger.warn(`FCM 토큰 없음 - 문서 경로: ${settingDoc.ref.path}`);
                continue;
            }
            // users/{uid}/settings/notification 경로에서 uid 추출
            const pathSegments = settingDoc.ref.path.split('/');
            const uid = pathSegments[1];
            if (!uid) {
                logger.warn(`uid 추출 실패 - 경로: ${settingDoc.ref.path}`);
                continue;
            }
            // 당일 기록 확인 후 없으면 알림 발송
            sendPromises.push((async () => {
                var _a, _b;
                const hasRecord = await hasRecordToday(uid, dateStr);
                if (hasRecord) {
                    logger.info(`오늘 기록 있음, 알림 생략 (uid: ${uid})`);
                    return;
                }
                try {
                    await sendPushNotification(fcmToken, uid);
                }
                catch (error) {
                    // 토큰 만료/등록 취소 시 설정에서 토큰 제거
                    if (((_a = error === null || error === void 0 ? void 0 : error.errorInfo) === null || _a === void 0 ? void 0 : _a.code) === 'messaging/registration-token-not-registered' ||
                        ((_b = error === null || error === void 0 ? void 0 : error.errorInfo) === null || _b === void 0 ? void 0 : _b.code) === 'messaging/invalid-registration-token') {
                        logger.warn(`만료된 FCM 토큰 제거 (uid: ${uid})`);
                        await settingDoc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
                    }
                    else {
                        logger.error(`알림 발송 실패 (uid: ${uid}):`, error);
                    }
                }
            })());
        }
        await Promise.all(sendPromises);
        logger.info(`처리 완료 - ${sendPromises.length}건 처리`);
    }
    catch (error) {
        logger.error('스케줄러 실행 중 오류:', error);
        throw error;
    }
});
