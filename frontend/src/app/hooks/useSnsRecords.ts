import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { readSnsRecord } from '../utils/snsRecordState';
import type { SnsRecord } from '../utils/snsRecordState';

export function useSnsSession(uid: string | undefined) {
  const mounted = useRef(false);
  const firebaseUser = auth.currentUser;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return useMemo(() => ({
    uid,
    isCurrent: () => Boolean(mounted.current && uid && firebaseUser
      && firebaseUser.uid === uid && auth.currentUser === firebaseUser),
  }), [uid, firebaseUser]);
}

export function useSnsRecords(session: ReturnType<typeof useSnsSession>) {
  const [state, setState] = useState<{
    session: typeof session;
    records: SnsRecord[];
    loading: boolean;
    serverReady: boolean;
    error: string;
  }>({ session, records: [], loading: true, serverReady: false, error: '' });

  useEffect(() => {
    setState({ session, records: [], loading: Boolean(session.uid), serverReady: false, error: '' });
    if (!session.uid || !session.isCurrent()) return;
    let cancelled = false;
    const unsubscribe = onSnapshot(
      query(collection(db, 'users', session.uid, 'snsRecords'), orderBy('timestamp', 'desc')),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (cancelled || !session.isCurrent()) return;
        setState({
          session,
          records: snapshot.docs.map((item) => readSnsRecord(item.id, item.data())),
          loading: snapshot.metadata.fromCache && snapshot.empty,
          serverReady: !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites,
          error: '',
        });
      },
      () => {
        if (cancelled || !session.isCurrent()) return;
        setState({ session, records: [], loading: false, serverReady: false,
          error: 'SNS 기록을 불러오지 못했습니다. 연결과 로그인 상태를 확인해 주세요.' });
      },
    );
    return () => { cancelled = true; unsubscribe(); };
  }, [session]);

  // Never render the preceding user's state, even before effect cleanup runs.
  return state.session === session ? state : {
    session, records: [], loading: Boolean(session.uid), serverReady: false, error: '',
  };
}
