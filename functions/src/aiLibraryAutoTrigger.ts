import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { hasAiLibraryDeveloperEmail } from './aiLibrary';
import { createNewAiLogClassifier, type AutoAnswer } from './aiLibraryAutoClassification';
import { buildJevChoiceRequest, parseJevChoiceResponse } from './aiLibraryJevChoice';
import { createJevChoiceHttpTransport } from './aiLibraryJevTransport';
const key = defineSecret('HARU_TYPESAFE_API_KEY');

export const classifyNewAiLibraryLog = onDocumentCreated({ document: 'users/{uid}/records/{recordId}',
  region: 'asia-northeast3', secrets: [key], timeoutSeconds: 120, memory: '256MiB', maxInstances: 2, retry: false }, async event => {
  const snapshot = event.data;
  if (!snapshot || snapshot.get('type') !== 'ai_log' || snapshot.get('aiCategorySource') === 'manual') return;
  try {
    const uid = event.params.uid;
    const owner = await admin.auth().getUser(uid);
    if (!hasAiLibraryDeveloperEmail(owner.email, owner.emailVerified) || owner.disabled || !snapshot.createTime) return;
    const db = admin.firestore();
    const config = db.doc(`aiLibraryClassificationPrivate/${uid}/control/autoNew`);
    const transport = createJevChoiceHttpTransport({ fetchImpl: fetch, getApiKey: () => key.value(),
      isRuntimePermitted: async () => { const c = await config.get(); return c.get('enabled') === true && c.get('credentialsReady') === true; } });
    const classify = async (text: string): Promise<AutoAnswer> => {
      const raw = await transport(buildJevChoiceRequest(text));
      const parsed = parseJevChoiceResponse(raw);
      const valid = parsed.decision.status === 'classified' || parsed.decision.reason !== 'invalid_response';
      return { ...parsed, recommendation: valid ? (raw as { answers: { category: { choice: string } } }).answers.category.choice : null };
    };
    await createNewAiLogClassifier(db, classify)({ uid, id: snapshot.id,
      identity: `${snapshot.createTime.seconds}:${snapshot.createTime.nanoseconds}`,
      createdAtMs: snapshot.createTime.toMillis(), record: snapshot.data()! });
  } catch { console.warn('AI library automatic classification stopped; no automatic retry.'); }
});
