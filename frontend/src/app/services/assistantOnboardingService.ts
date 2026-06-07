import { collection, doc, getDoc, getDocs, limit, query, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

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
  await setDoc(
    doc(db, 'users', uid),
    { [ASSISTANT_ONBOARDING_SEEN_FIELD]: seenAt },
    { merge: true },
  );
  return seenAt;
}
