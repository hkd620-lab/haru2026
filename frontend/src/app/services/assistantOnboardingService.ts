import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getSignupAttribution } from '../utils/utmAttribution';

export const ASSISTANT_ONBOARDING_SEEN_FIELD = 'assistantOnboardingV1SeenAt';

export async function getAssistantOnboardingSeenAt(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const value = snap.data()?.[ASSISTANT_ONBOARDING_SEEN_FIELD];
  return typeof value === 'string' && value.trim() ? value : null;
}

export async function userHasAnyRecord(uid: string): Promise<boolean> {
  const recordsRef = collection(db, 'users', uid, 'records');
  const snap = await getDocs(query(recordsRef, limit(1)));
  return !snap.empty;
}

export async function shouldShowAssistantOnboarding(uid: string): Promise<boolean> {
  const seenAt = await getAssistantOnboardingSeenAt(uid);
  if (seenAt) return false;

  const hasRecord = await userHasAnyRecord(uid);
  return !hasRecord;
}

export async function markAssistantOnboardingSeen(uid: string): Promise<string> {
  const seenAt = new Date().toISOString();
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const payload: Record<string, unknown> = { [ASSISTANT_ONBOARDING_SEEN_FIELD]: seenAt };

  if (!userSnap.exists()) {
    Object.assign(payload, getSignupAttribution(), { signupAt: serverTimestamp() });
  }

  await setDoc(
    userRef,
    payload,
    { merge: true },
  );
  return seenAt;
}
