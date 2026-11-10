// 이 기기의 웹 푸시 구독 공개키(applicationServerKey)를 설정된 VAPID 키와 맞춘 뒤에만 FCM 토큰을 받는 순수 helper.
// 배경: 구독이 다른 키(예: Firebase 기본 키)로 만들어져 있으면 SDK getToken은 그 구독을 그대로 써서
// 토큰은 발급되지만 실제 발송은 WebPush 403으로 실패한다. 브라우저 API는 인자로 받아 테스트에서 검증한다.
// endpoint는 메모리에서 비교만 하고 기록하지 않는다.

export interface PushSubscriptionLike {
  endpoint: string;
  options?: { applicationServerKey?: ArrayBuffer | null } | null;
  unsubscribe: () => Promise<boolean>;
}

export interface PushManagerLike {
  getSubscription: () => Promise<PushSubscriptionLike | null>;
  subscribe: (options: { userVisibleOnly: true; applicationServerKey: ArrayBuffer }) => Promise<PushSubscriptionLike>;
}

export interface PushRegistrationLike {
  pushManager?: PushManagerLike;
}

const VAPID_PUBLIC_KEY_BYTES = 65;

// base64url VAPID 공개키를 바이트로 바꾼다. 65바이트 비압축 점(첫 바이트 0x04)이 아니면 null.
export function decodeVapidPublicKey(vapidKey: string | undefined | null): Uint8Array | null {
  if (typeof vapidKey !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(vapidKey)) return null;
  const base64 = vapidKey.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let binary: string;
  try {
    binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  } catch {
    return null;
  }
  if (binary.length !== VAPID_PUBLIC_KEY_BYTES) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes[0] === 0x04 ? bytes : null;
}

export function isValidVapidPublicKey(vapidKey: string | undefined | null): boolean {
  return decodeVapidPublicKey(vapidKey) !== null;
}

// 구독의 applicationServerKey가 기대 키와 바이트 단위로 같은지. 키를 알 수 없으면 다른 것으로 본다.
export function subscriptionHasKey(subscription: PushSubscriptionLike | null | undefined, expected: Uint8Array): boolean {
  const raw = subscription?.options?.applicationServerKey;
  if (!raw) return false;
  const actual = new Uint8Array(raw);
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

// 이 registration의 구독을 기대 키로 맞춘다. 같으면 그대로 두고, 다르면 이 registration의 구독만 해지한 뒤 기대 키로 새로 구독한다.
export async function ensurePushSubscriptionKey(
  pushManager: PushManagerLike,
  expected: Uint8Array,
): Promise<PushSubscriptionLike> {
  const current = await pushManager.getSubscription();
  if (current && subscriptionHasKey(current, expected)) return current;
  if (current) {
    const removed = await current.unsubscribe();
    if (!removed) throw new Error('push-unsubscribe-failed');
  }
  const applicationServerKey = new ArrayBuffer(expected.length);
  new Uint8Array(applicationServerKey).set(expected);
  const created = await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  if (!subscriptionHasKey(created, expected)) throw new Error('push-subscribe-key-mismatch');
  return created;
}

const MAX_TOKEN_ATTEMPTS = 2; // 처음 1회 + 경합(구독 교체) 시 재시도 1회

// 구독 키를 맞춘 뒤 getToken을 부르고, 그 사이 구독(키·endpoint)이 바뀌지 않았을 때만 토큰을 돌려준다.
// 실패하면 예외를 던진다(호출자는 토큰 실패로 처리하고 저장하지 않는다). registration이 없으면 SDK 기본 경로로 넘기지 않는다.
export async function getTokenWithMatchingSubscription<R extends PushRegistrationLike>(
  vapidKey: string,
  registration: R | undefined,
  getToken: (vapidKey: string, registration: R) => Promise<string | null | undefined>,
): Promise<string> {
  const expected = decodeVapidPublicKey(vapidKey);
  if (!expected) throw new Error('push-vapid-invalid');
  const pushManager = registration?.pushManager;
  if (!registration || !pushManager) throw new Error('push-registration-missing');

  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const before = await ensurePushSubscriptionKey(pushManager, expected);
    const token = await getToken(vapidKey, registration);
    if (!token) throw new Error('push-token-empty');
    const after = await pushManager.getSubscription();
    if (after && after.endpoint === before.endpoint && subscriptionHasKey(after, expected)) return token;
  }
  throw new Error('push-subscription-changed');
}
