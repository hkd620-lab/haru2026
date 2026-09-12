import type { LoginProvider } from './loginProvider';

type LoginTraceStep =
  | 'T0_login_click'
  | 'T1_provider_redirect_requested'
  | 'T2_callback_arrived'
  | 'T3_firebase_sign_in_complete'
  | 'T4_auth_state_settled'
  | 'T5_user_doc_ready'
  | 'T6_required_access_ready'
  | 'T7_home_route_start'
  | 'T8_home_first_render'
  | 'T9_home_core_data_ready';

type LoginFailureStage =
  | 'provider_error_param'
  | 'missing_custom_token'
  | 'firebase_custom_token_sign_in'
  | 'callback_processing';

type LoginFailureType =
  | 'provider_redirect_error'
  | 'missing_custom_token'
  | 'firebase_auth_error'
  | 'callback_unexpected_error';

type LoginTrace = {
  traceId: string;
  provider: LoginProvider | 'unknown';
  startedAt: number;
  marks: Partial<Record<LoginTraceStep, number>>;
  failure?: {
    stage: LoginFailureStage;
    errorType: LoginFailureType;
    elapsedMs: number;
  };
};

const ACTIVE_TRACE_KEY = 'haru.loginPerformanceTrace.v1';
const LAST_TRACE_KEY = 'haru.loginPerformanceLastTrace.v1';
const DEBUG_FLAG_KEY = 'haru_login_perf_debug';
const ORDERED_STEPS: LoginTraceStep[] = [
  'T0_login_click',
  'T1_provider_redirect_requested',
  'T2_callback_arrived',
  'T3_firebase_sign_in_complete',
  'T4_auth_state_settled',
  'T5_user_doc_ready',
  'T6_required_access_ready',
  'T7_home_route_start',
  'T8_home_first_render',
  'T9_home_core_data_ready',
];

function canUseStorage() {
  if (typeof window === 'undefined') return false;
  try {
    return typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

function canUsePerformance() {
  return typeof window !== 'undefined' && typeof window.performance !== 'undefined';
}

function nowMs() {
  return Date.now();
}

function createTraceId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function readTrace(): LoginTrace | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_TRACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoginTrace;
    if (!parsed?.traceId || !parsed?.provider || !parsed?.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeTrace(trace: LoginTrace) {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(ACTIVE_TRACE_KEY, JSON.stringify(trace));
  } catch {
    // ignore
  }
}

function markBrowserPerformance(step: LoginTraceStep) {
  if (!canUsePerformance()) return;
  try {
    window.performance.mark(`haru-login:${step}`);
  } catch {
    // ignore
  }
}

function shouldLogTrace() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEBUG_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function persistLastTrace(trace: LoginTrace) {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(LAST_TRACE_KEY, JSON.stringify(trace));
    window.sessionStorage.removeItem(ACTIVE_TRACE_KEY);
  } catch {
    // ignore
  }
}

function logTrace(trace: LoginTrace) {
  if (!shouldLogTrace()) return;

  const rows = ORDERED_STEPS
    .filter((step) => typeof trace.marks[step] === 'number')
    .map((step, index, steps) => {
      const value = trace.marks[step] || trace.startedAt;
      const previousStep = steps[index - 1];
      const previousValue = previousStep ? trace.marks[previousStep] || trace.startedAt : trace.startedAt;
      return {
        step,
        elapsedMs: Math.max(0, Math.round(value - trace.startedAt)),
        sincePreviousMs: Math.max(0, Math.round(value - previousValue)),
      };
    });

  console.info('[HARU login trace]', { traceId: trace.traceId, provider: trace.provider });
  console.table(rows);
}

function logFailureTrace(trace: LoginTrace) {
  if (!shouldLogTrace() || !trace.failure) return;

  console.info('[HARU login trace failure]', {
    traceId: trace.traceId,
    provider: trace.provider,
    stage: trace.failure.stage,
    errorType: trace.failure.errorType,
    elapsedMs: trace.failure.elapsedMs,
  });
}

export function beginLoginTrace(provider: LoginProvider) {
  const startedAt = nowMs();
  const trace: LoginTrace = {
    traceId: createTraceId(),
    provider,
    startedAt,
    marks: {
      T0_login_click: startedAt,
    },
  };

  writeTrace(trace);
  markBrowserPerformance('T0_login_click');
  return trace.traceId;
}

export function markLoginTrace(step: LoginTraceStep) {
  const trace = readTrace();
  if (!trace) return null;
  if (!trace.marks[step]) {
    trace.marks[step] = nowMs();
    writeTrace(trace);
  }
  markBrowserPerformance(step);
  return trace;
}

export function finishLoginTrace(step: LoginTraceStep = 'T9_home_core_data_ready') {
  const trace = markLoginTrace(step);
  if (!trace) return;
  persistLastTrace(trace);
  logTrace(trace);
}

export function failLoginTrace(
  stage: LoginFailureStage,
  errorType: LoginFailureType,
  providerOverride?: LoginProvider | null,
) {
  const failedAt = nowMs();
  const existingTrace = readTrace();
  const trace: LoginTrace = existingTrace || {
    traceId: createTraceId(),
    provider: providerOverride || 'unknown',
    startedAt: failedAt,
    marks: {},
  };

  if (providerOverride) {
    trace.provider = providerOverride;
  }

  trace.failure = {
    stage,
    errorType,
    elapsedMs: Math.max(0, Math.round(failedAt - trace.startedAt)),
  };

  persistLastTrace(trace);
  logFailureTrace(trace);
}
