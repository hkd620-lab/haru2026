export type LoginOAuthProvider = 'kakao' | 'naver' | 'google';

type OAuthStateDoc = {
  exists: boolean;
  data(): Record<string, any> | undefined;
};

type OAuthStateTransaction = {
  get(ref: unknown): Promise<OAuthStateDoc>;
  delete(ref: unknown): void;
};

type OAuthStateDb = {
  collection(name: string): {
    doc(id: string): unknown;
  };
  runTransaction<T>(task: (tx: OAuthStateTransaction) => Promise<T>): Promise<T>;
};

function getOAuthStateExpiryMs(data: Record<string, any> | undefined): number {
  const expiresAt = data?.expiresAt;
  return typeof expiresAt?.toMillis === 'function' ? expiresAt.toMillis() : 0;
}

export async function consumeLoginOAuthStateWithDb(
  db: OAuthStateDb,
  state: string,
  provider: LoginOAuthProvider,
  nowMs = Date.now(),
) {
  const stateRef = db.collection('oauth_states').doc(state);
  return db.runTransaction(async (tx) => {
    const stateDoc = await tx.get(stateRef);
    if (!stateDoc.exists) throw new Error('State not found');

    const stateData = stateDoc.data();
    if (stateData?.provider !== provider) throw new Error('State provider mismatch');
    if (getOAuthStateExpiryMs(stateData) < nowMs) throw new Error('State expired');

    tx.delete(stateRef);
    return stateData;
  });
}
