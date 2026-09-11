import type { LoginProvider } from './loginProvider';

type LoginTraceStep =
  | 'T0_login_click'
  | 'T1_provider_redirect_requested'
  | 'T2_callback_arrived'
  | 'T3_firebase_sign_in_complete'
  | 'T4_auth_state_settled'
  | 'T5_home_data_ready'
  | 'T6_home_interactive';

type LoginTrace = {
  traceId: string;
  provider: LoginProvider;
  startedAt: number;
  marks: Partial<Record<LoginTraceStep, number>>;
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
  'T5_home_data_ready',
  'T6_home_interactive',
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

export function finishLoginTrace(step: LoginTraceStep = 'T6_home_interactive') {
  const trace = markLoginTrace(step);
  if (!trace) return;
  persistLastTrace(trace);
  logTrace(trace);
}
