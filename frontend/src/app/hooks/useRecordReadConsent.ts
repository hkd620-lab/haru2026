import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

// Read only: never grants consent or writes a profile from the records viewer.
export function useRecordReadConsent(uid: string | undefined, kind: 'sensitiveHealth' | 'sensitiveLegal') {
  const [result, setResult] = useState<{ uid: string; kind: string; allowed: boolean } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let active = true;
    const unsubscribe = onSnapshot(doc(db, 'users', uid), snapshot => {
      if (active) setResult({ uid, kind, allowed: snapshot.data()?.consents?.[kind] === true });
    }, () => { if (active) setResult({ uid, kind, allowed: false }); });
    return () => { active = false; unsubscribe(); };
  }, [uid, kind]);
  if (!uid || !result || result.uid !== uid || result.kind !== kind) return null;
  return result.allowed;
}
