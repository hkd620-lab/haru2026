// 명시적 기기 등록 직전에 FCM SW registration을 update()하고, 새 worker(없으면 현재 active)가 activated가 될 때까지 제한시간 안에서 기다리는 순수 helper.
// 배경: FCM SW scope에는 페이지 이동이 없어 이전 SW 스크립트(이전 appId)가 계속 남을 수 있고, 이전 SW가 구독을 다른 키로 다시 만들 수 있다.
// update 오류·시간 초과·redundant·active 없음은 모두 예외로 끝낸다(호출자는 토큰 실패로 처리하고 저장하지 않는다).
// skipWaiting·clients.claim·Workbox SW 갱신은 하지 않는다. FCM scope는 앱 페이지를 제어하지 않아 새 worker는 보통 스스로 활성화된다.

export interface ServiceWorkerLike {
  readonly state: string;
  addEventListener: (type: 'statechange', listener: () => void) => void;
  removeEventListener: (type: 'statechange', listener: () => void) => void;
}

export interface UpdatableRegistrationLike {
  readonly installing: ServiceWorkerLike | null;
  readonly waiting: ServiceWorkerLike | null;
  readonly active: ServiceWorkerLike | null;
  update: () => Promise<unknown>;
}

// fn을 ms 뒤에 실행하고, 취소 함수를 돌려준다. 시험에서는 가짜 시계를 넣는다.
export type FcmUpdateTimer = (fn: () => void, ms: number) => () => void;

export interface FcmUpdateOptions {
  timeoutMs?: number;
  timer?: FcmUpdateTimer;
}

export const FCM_SW_UPDATE_TIMEOUT_MS = 10_000; // update()와 활성화 대기를 합친 전체 제한시간

const defaultTimer: FcmUpdateTimer = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

// worker가 activated가 되면 끝나고 redundant가 되면 실패한다. 붙인 리스너는 cleanups로 반드시 뗀다.
function waitActivated(worker: ServiceWorkerLike, cleanups: Array<() => void>): Promise<void> {
  if (worker.state === 'activated') return Promise.resolve();
  if (worker.state === 'redundant') return Promise.reject(new Error('fcm-sw-redundant'));
  return new Promise<void>((resolve, reject) => {
    const onStateChange = () => {
      if (worker.state === 'activated') resolve();
      else if (worker.state === 'redundant') reject(new Error('fcm-sw-redundant'));
    };
    worker.addEventListener('statechange', onStateChange);
    cleanups.push(() => worker.removeEventListener('statechange', onStateChange));
  });
}

export async function updateFcmRegistrationAndWaitActive<R extends UpdatableRegistrationLike>(
  registration: R | undefined,
  { timeoutMs = FCM_SW_UPDATE_TIMEOUT_MS, timer = defaultTimer }: FcmUpdateOptions = {},
): Promise<R> {
  if (!registration) throw new Error('fcm-sw-registration-missing');

  const cleanups: Array<() => void> = [];
  const timeout = new Promise<never>((_, reject) => {
    cleanups.push(timer(() => reject(new Error('fcm-sw-update-timeout')), timeoutMs));
  });
  try {
    await Promise.race([Promise.resolve().then(() => registration.update()), timeout]);
    // update로 생긴 새 worker를 우선 기다린다. 이미 활성화까지 끝났으면 installing·waiting이 비고 active가 새 worker다.
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) throw new Error('fcm-sw-active-missing');
    await Promise.race([waitActivated(worker, cleanups), timeout]);
    return registration;
  } finally {
    for (const cleanup of cleanups) cleanup();
  }
}
