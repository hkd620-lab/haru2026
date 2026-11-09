// 이 기기의 웹 푸시 권한·등록 상태와 포그라운드 알림 표시를 다루는 순수 helper.
// Firebase·브라우저 API는 deps로 주입받아 테스트에서 동작을 그대로 검증할 수 있게 한다.

export type DevicePermission = 'default' | 'granted' | 'denied' | 'unsupported';

export type DevicePushStatus =
  | 'checking'
  | 'unsupported'
  | 'needs-install'
  | 'denied'
  | 'needs-permission'
  | 'granted-unverified'
  | 'registered';

export interface DevicePushEnvironment {
  supported: boolean;
  permission: DevicePermission;
  isIOS: boolean;
  standalone: boolean;
}

// 계정 알림(notificationEnabled)과 별개로 "이 기기"가 알림을 받을 수 있는 상태인지 판정한다.
// 권한이 허용돼 있고 토큰이 캐시돼 있어도, 이번에 등록을 끝낸 경우가 아니면 등록 완료로 단정하지 않는다.
export function resolveDevicePushStatus(
  env: DevicePushEnvironment | null,
  registeredThisSession: boolean,
): DevicePushStatus {
  if (!env) return 'checking';
  if (!env.supported || env.permission === 'unsupported') {
    return env.isIOS && !env.standalone ? 'needs-install' : 'unsupported';
  }
  if (env.permission === 'denied') return 'denied';
  if (env.permission === 'default') return 'needs-permission';
  return registeredThisSession ? 'registered' : 'granted-unverified';
}

export interface DevicePushStatusView {
  label: string;
  hint: string;
  canRegister: boolean;
  buttonLabel: string;
}

export function describeDevicePushStatus(status: DevicePushStatus): DevicePushStatusView {
  switch (status) {
    case 'checking':
      return { label: '이 기기: 상태 확인 중', hint: '', canRegister: false, buttonLabel: '이 기기에서 알림 받기' };
    case 'needs-install':
      return {
        label: '이 기기: 홈 화면 앱에서만 알림 가능',
        hint: '아이폰은 Safari 공유 버튼 → "홈 화면에 추가"로 설치한 뒤, 홈 화면의 haru2026 앱에서 알림을 켜 주세요.',
        canRegister: false,
        buttonLabel: '이 기기에서 알림 받기',
      };
    case 'unsupported':
      return {
        label: '이 기기: 알림 미지원',
        hint: '이 브라우저에서는 웹 알림을 받을 수 없습니다.',
        canRegister: false,
        buttonLabel: '이 기기에서 알림 받기',
      };
    case 'denied':
      return {
        label: '이 기기: 알림 차단됨',
        hint: '기기 설정에서 haru2026 알림을 허용한 뒤 이 화면으로 돌아와 주세요. (아이폰: 설정 → 알림 → haru2026)',
        canRegister: false,
        buttonLabel: '이 기기에서 알림 받기',
      };
    case 'needs-permission':
      return {
        label: '이 기기: 알림 허용 필요',
        hint: '계정 알림은 켜져 있지만 이 기기는 아직 알림을 허용하지 않았습니다. 아래 버튼을 눌러 허용해 주세요.',
        canRegister: true,
        buttonLabel: '이 기기에서 알림 받기',
      };
    case 'granted-unverified':
      return {
        label: '이 기기: 권한 허용됨 (등록 확인 전)',
        hint: '알림이 오지 않으면 아래 버튼으로 이 기기를 이 계정에 다시 등록해 주세요.',
        canRegister: true,
        buttonLabel: '이 기기 다시 등록하기',
      };
    case 'registered':
      return {
        label: '이 기기: 등록 완료',
        hint: '방금 이 기기를 이 계정의 알림 받을 기기로 등록했습니다.',
        canRegister: true,
        buttonLabel: '이 기기 다시 등록하기',
      };
  }
}

export type PushRegistrationFailure =
  | 'unsupported'
  | 'denied'
  | 'dismissed'
  | 'config'
  | 'token'
  | 'save';

// 서버(fcmTokens) 저장은 끝났지만 그 뒤 기기 쪽 후처리가 실패한 경우.
// cache: localStorage에 토큰을 기억하지 못함 / listener: 포그라운드 수신 준비 시작에 실패함.
export type PushRegistrationWarning = 'cache' | 'listener';

export type PushRegistrationResult =
  | { ok: true; warning?: PushRegistrationWarning }
  | { ok: false; reason: PushRegistrationFailure };

export interface PushRegistrationDeps<R> {
  getPermission: () => DevicePermission;
  requestPermission: () => Promise<DevicePermission>;
  isSupported: () => Promise<boolean>;
  getVapidKey: () => string | undefined;
  getSwRegistration: () => Promise<R | undefined>;
  getToken: (vapidKey: string, registration: R | undefined) => Promise<string | null | undefined>;
  saveToken: (token: string) => Promise<void>;
  cacheToken: (token: string) => void;
  onRegistered?: () => void;
}

// 권한 요청 → 토큰 발급 → 계정 저장까지 모두 끝나야 ok: true.
// iOS는 사용자 제스처 안에서만 권한 창을 띄우므로, 다른 await보다 먼저 requestPermission을 시작한다.
export async function registerDeviceForPush<R>(deps: PushRegistrationDeps<R>): Promise<PushRegistrationResult> {
  const initialPermission = deps.getPermission();
  if (initialPermission === 'unsupported') return { ok: false, reason: 'unsupported' };
  // 요청은 여기서 동기적으로 시작하고, 지원 확인을 기다리기 전에 곧바로 거부 처리를 붙인다.
  // (붙이지 않으면 isSupported를 기다리는 동안 거부가 처리되지 않은 거부로 먼저 보고된다.)
  // 동기 예외도 같은 '창 닫힘'으로 처리한다.
  let permissionRequest: Promise<DevicePermission>;
  if (initialPermission === 'default') {
    try {
      permissionRequest = Promise.resolve(deps.requestPermission())
        .catch((): DevicePermission => 'default');
    } catch {
      permissionRequest = Promise.resolve('default');
    }
  } else {
    permissionRequest = Promise.resolve(initialPermission);
  }

  let supported = false;
  try {
    supported = await deps.isSupported();
  } catch {
    supported = false;
  }

  let permission: DevicePermission;
  try {
    permission = await permissionRequest;
  } catch {
    permission = 'default';
  }

  if (!supported) return { ok: false, reason: 'unsupported' };
  if (permission === 'denied') return { ok: false, reason: 'denied' };
  if (permission !== 'granted') return { ok: false, reason: 'dismissed' };

  const vapidKey = deps.getVapidKey();
  if (!vapidKey) return { ok: false, reason: 'config' };

  let token: string | null | undefined;
  try {
    const registration = await deps.getSwRegistration();
    token = await deps.getToken(vapidKey, registration);
  } catch {
    token = undefined;
  }
  if (!token) return { ok: false, reason: 'token' };

  try {
    await deps.saveToken(token);
  } catch {
    return { ok: false, reason: 'save' };
  }

  // 여기부터는 서버 저장이 이미 성공했으므로 실패로 되돌리지 않는다. 후처리 오류는 warning으로만 알린다.
  let warning: PushRegistrationWarning | undefined;
  try {
    deps.cacheToken(token);
  } catch {
    warning = 'cache';
  }
  try {
    deps.onRegistered?.();
  } catch {
    warning = warning ?? 'listener';
  }
  return warning ? { ok: true, warning } : { ok: true };
}

export function describeRegistrationWarning(warning: PushRegistrationWarning): string {
  switch (warning) {
    case 'cache':
      return '이 기기를 알림 받을 기기로 등록했습니다. 다만 이 기기에 등록 정보를 기억하지 못해, 나중에 알림을 꺼도 이 기기 등록이 자동으로 지워지지 않을 수 있습니다.';
    case 'listener':
      return '이 기기를 알림 받을 기기로 등록했습니다. 다만 앱이 열려 있을 때의 알림 표시 준비에 실패했습니다. 앱을 다시 열면 다시 준비합니다.';
  }
}

export interface DeviceRegistrationFeedback {
  setBusy: (busy: boolean) => void;
  setRegistered: (registered: boolean) => void;
  notifySuccess: (message: string) => void;
  notifyWarning: (message: string) => void;
  notifyError: (message: string) => void;
  refresh: () => void;
}

export const UNEXPECTED_REGISTRATION_ERROR = '이 기기 등록 중 예기치 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

// 설정 화면 '이 기기에서 알림 받기' 버튼 처리. register는 첫 await 전에 동기적으로 호출한다(제스처 유지).
// 예기치 못한 예외·거부도 여기서 처리해 로딩이 풀리고, 등록 완료로 표시하지 않는다.
export async function runDeviceRegistration(
  register: () => Promise<PushRegistrationResult>,
  ui: DeviceRegistrationFeedback,
): Promise<void> {
  ui.setBusy(true);
  try {
    const result = await register();
    ui.setRegistered(result.ok);
    if (!result.ok) {
      ui.notifyError(describeRegistrationFailure(result.reason));
    } else if (result.warning) {
      ui.notifyWarning(describeRegistrationWarning(result.warning));
    } else {
      ui.notifySuccess('이 기기를 알림 받을 기기로 등록했습니다.');
    }
  } catch {
    ui.setRegistered(false);
    try {
      ui.notifyError(UNEXPECTED_REGISTRATION_ERROR);
    } catch {
      // 안내 표시 실패는 무시한다.
    }
  } finally {
    ui.setBusy(false);
    try {
      ui.refresh();
    } catch {
      // 상태 재확인 실패는 무시한다.
    }
  }
}

export function describeRegistrationFailure(reason: PushRegistrationFailure): string {
  switch (reason) {
    case 'unsupported':
      return '이 기기에서는 알림을 받을 수 없습니다.';
    case 'denied':
      return '알림이 차단되어 있습니다. 기기 설정에서 haru2026 알림을 허용해 주세요.';
    case 'dismissed':
      return '알림 권한을 허용하지 않았습니다. 다시 눌러 허용해 주세요.';
    case 'config':
      return '알림 설정 오류로 이 기기를 등록하지 못했습니다.';
    case 'token':
      return '이 기기의 알림 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    case 'save':
      return '이 기기 정보를 계정에 저장하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.';
  }
}

// ===== 내 기기 테스트 알림 =====

export const SELF_TEST_CALLABLE = 'sendTestNotification';

export type SelfTestCall = (name: string, data: { title: string; body: string }) => Promise<{ data: unknown }>;

// 기존 sendTestNotification callable만 호출한다. 서버가 요청자(auth.uid)의 등록 기기 전체에 보낸다.
export async function sendSelfTestNotification(call: SelfTestCall): Promise<{ data: unknown }> {
  return call(SELF_TEST_CALLABLE, {
    title: 'HARU 테스트 알림',
    body: '이 알림이 보이면 이 기기에서 알림을 받을 수 있습니다.',
  });
}

export interface SelfTestView {
  tone: 'success' | 'error';
  text: string;
}

export function describeSelfTestResult(data: unknown): SelfTestView {
  const d = data as { total?: unknown; succeeded?: unknown; failed?: unknown } | null;
  const total = typeof d?.total === 'number' ? d.total : NaN;
  const succeeded = typeof d?.succeeded === 'number' ? d.succeeded : NaN;
  const failed = typeof d?.failed === 'number' ? d.failed : NaN;
  if (!Number.isFinite(total) || !Number.isFinite(succeeded) || !Number.isFinite(failed)) {
    return { tone: 'error', text: '서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.' };
  }
  if (succeeded === 0) {
    return {
      tone: 'error',
      text: `서버가 이 계정에 등록된 기기 ${total}개 모두에 보내지 못했습니다. 이 기기에서 "이 기기 다시 등록하기"를 눌러 주세요.`,
    };
  }
  return {
    tone: 'success',
    text: `서버 발송 접수: 등록된 기기 ${total}개 중 ${succeeded}개 성공${failed > 0 ? `, ${failed}개 실패` : ''}. `
      + '서버 성공은 알림 서비스가 접수했다는 뜻이며, 이 기기에 실제로 알림이 왔는지는 직접 확인해 주세요.',
  };
}

export function describeSelfTestError(error: unknown): SelfTestView {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'functions/not-found') {
    return { tone: 'error', text: '이 계정에 등록된 기기가 없습니다. 먼저 "이 기기에서 알림 받기"를 눌러 주세요.' };
  }
  if (code === 'functions/unauthenticated') {
    return { tone: 'error', text: '로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.' };
  }
  return { tone: 'error', text: '테스트 알림 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
}

// ===== 포그라운드(앱이 열려 있을 때) 알림 =====

export interface ForegroundPayload {
  notification?: { title?: string; body?: string };
}

export interface ShowableRegistration {
  showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
}

export interface ForegroundShowDeps {
  getPermission: () => DevicePermission;
  getRegistration: () => Promise<ShowableRegistration | undefined>;
  createWindowNotification?: (title: string, options: NotificationOptions) => void;
}

export type ForegroundShowResult = 'shown-sw' | 'shown-window' | 'skipped-permission' | 'skipped-empty' | 'failed';

export const FOREGROUND_NOTIFICATION_OPTIONS = {
  icon: '/icons/icon-grape-v1-192.png',
  badge: '/icons/badge-grape-v1-96.png',
  tag: 'haru-notification',
} as const;

// iOS 설치 PWA는 new Notification을 지원하지 않으므로 서비스워커 registration.showNotification을 먼저 쓴다.
export async function showForegroundNotification(
  payload: ForegroundPayload,
  deps: ForegroundShowDeps,
): Promise<ForegroundShowResult> {
  const title = payload.notification?.title;
  const body = payload.notification?.body || '';
  if (!title && !body) return 'skipped-empty';
  if (deps.getPermission() !== 'granted') return 'skipped-permission';
  const options: NotificationOptions = { body, ...FOREGROUND_NOTIFICATION_OPTIONS };
  try {
    const registration = await deps.getRegistration();
    if (registration) {
      await registration.showNotification(title || 'HARU', options);
      return 'shown-sw';
    }
  } catch {
    // 아래 창 알림으로 넘어간다.
  }
  try {
    if (!deps.createWindowNotification) return 'failed';
    deps.createWindowNotification(title || 'HARU', options);
    return 'shown-window';
  } catch {
    return 'failed';
  }
}

export interface ForegroundListenerDeps {
  isSupported: () => Promise<boolean>;
  subscribe: (handler: (payload: ForegroundPayload) => void) => void;
  show: (payload: ForegroundPayload) => Promise<unknown>;
}

// onMessage를 한 번만 등록한다. 여러 곳에서 호출해도 같은 Promise를 돌려준다(실패 시에만 다시 시도).
export function createForegroundListenerInstaller(deps: ForegroundListenerDeps): () => Promise<boolean> {
  let installing: Promise<boolean> | null = null;
  return () => {
    if (!installing) {
      installing = deps.isSupported()
        .then((supported) => {
          if (!supported) return false;
          deps.subscribe((payload) => {
            void deps.show(payload).catch(() => undefined);
          });
          return true;
        })
        .catch(() => {
          installing = null;
          return false;
        });
    }
    return installing;
  };
}
