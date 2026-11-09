import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createClassificationService } from './aiLibraryClassificationService';
import { classificationPaths } from './aiLibraryClassificationStore';
import { classifyApprovedText } from './aiLibraryJevChoice';
import { createJevChoiceHttpTransport } from './aiLibraryJevTransport';

// Declaration/binding only. No credential exists or is read by importing this module.
const typesafeKey = defineSecret('HARU_TYPESAFE_API_KEY');
const service = createClassificationService({ db: () => admin.firestore(), providerForOwner: owner => {
  const transport = createJevChoiceHttpTransport({
    fetchImpl: fetch,
    getApiKey: async () => typesafeKey.value(),
    isRuntimePermitted: async () => {
      const runtime = (await classificationPaths(admin.firestore(), owner).runtime.get()).data();
      return runtime?.enabled === true && runtime?.credentialsReady === true;
    },
  });
  return { model: 'jev-1.14.0', maxRequestCostMicrousd: 2753, classify: text => classifyApprovedText(text, transport) };
} });
export const aiLibraryClassification = onCall({ region: 'asia-northeast3', timeoutSeconds: 120, memory: '256MiB', cors: ['https://haru2026.com'], secrets: [typesafeKey] }, async request => {
  try {
    return await service({ uid: request.auth?.uid, email: request.auth?.token.email,
      emailVerified: request.auth?.token.email_verified, origin: request.rawRequest.headers.origin }, request.data ?? {});
  } catch (error) {
    // Never propagate Firestore/provider exceptions or record text to caller/logs.
    const code = error instanceof Error ? error.message : '';
    if (['permission_denied', 'origin_denied'].includes(code)) throw new HttpsError('permission-denied', '분류 접근 권한이 없습니다.');
    if (code === 'scope_too_large') throw new HttpsError('resource-exhausted', '전체 기록이 1,000개를 초과합니다. 범위를 나누어 계획해 주세요.');
    throw new HttpsError('failed-precondition', '분류 실행이 비활성화되어 있거나 계획·검토·승인이 유효하지 않습니다.');
  }
});
