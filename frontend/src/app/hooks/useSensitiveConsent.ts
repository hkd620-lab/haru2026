import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';

export type SensitiveConsentKind = 'sensitiveHealth' | 'sensitiveLegal';

// 건강·법률 등 민감정보 기능 최초 진입 시 별도 동의를 받기 위한 훅.
// users/{uid}.consents.sensitiveHealth / consents.sensitiveLegal 필드를 실시간으로 확인한다.
// hasConsent는 null(확인 전/비로그인) / true(동의함) / false(동의 필요) 세 상태를 가진다.
export function useSensitiveConsent(kind: SensitiveConsentKind) {
  const { user } = useAuth();
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setHasConsent(null);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      setHasConsent(Boolean(snap.data()?.consents?.[kind]));
    });

    return () => unsubscribe();
  }, [user?.uid, kind]);

  const grantConsent = async () => {
    if (!user?.uid) return;
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          consents: {
            [kind]: true,
            [`${kind}AgreedAt`]: serverTimestamp(),
          },
        },
        { merge: true },
      );
      // hasConsent는 위 onSnapshot 리스너가 자동으로 갱신한다.
    } finally {
      setIsSaving(false);
    }
  };

  return { hasConsent, isSaving, grantConsent };
}
