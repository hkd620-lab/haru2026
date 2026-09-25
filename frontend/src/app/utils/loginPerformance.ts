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

type LoginTraceBlockedReason =
  | 'user_doc_error'
  | 'required_consent_missing'
  | 'pending_deletion'
  | 'account_switch';

type LoginTraceResumeReason = 'user_doc_retry';

type LoginTraceOutcomeStatus = 'in_progress' | 'success' | 'failed' | 'blocked';

type LoginTraceEvent = {
  step: LoginTraceStep;
  at: number;
  sequence: number;
  duplicate: boolean;
  afterTerminal: boolean;
};

type LoginTraceOutcome = {
  status: LoginTraceOutcomeStatus;
  reason: string;
  at: number;
  sequence: number;
  step?: LoginTraceStep;
};

type LoginTrace = {
  version?: 2;
  traceId: string;
  provider: LoginProvider | 'unknown';
  startedAt: number;
  marks: Partial<Record<LoginTraceStep, number>>;
  events?: LoginTraceEvent[];
  outcome?: LoginTraceOutcome;
  outcomeHistory?: LoginTraceOutcome[];
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

const LOGIN_TRACE_INTERVALS: Array<{ label: string; from: LoginTraceStep; to: LoginTraceStep }> = [
  { label: 'T0→T2', from: 'T0_login_click', to: 'T2_callback_arrived' },
  { label: 'T2→T3', from: 'T2_callback_arrived', to: 'T3_firebase_sign_in_complete' },
  { label: 'T3→T4', from: 'T3_firebase_sign_in_complete', to: 'T4_auth_state_settled' },
  { label: 'T4→T6', from: 'T4_auth_state_settled', to: 'T6_required_access_ready' },
  { label: 'T7→T8', from: 'T7_home_route_start', to: 'T8_home_first_render' },
  { label: 'T8→T9', from: 'T8_home_first_render', to: 'T9_home_core_data_ready' },
  { label: 'T0→T8', from: 'T0_login_click', to: 'T8_home_first_render' },
  { label: 'T0→T9', from: 'T0_login_click', to: 'T9_home_core_data_ready' },
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

function getStepIndex(step: LoginTraceStep) {
  return ORDERED_STEPS.indexOf(step);
}

function isTerminalOutcome(outcome?: LoginTraceOutcome) {
  return Boolean(outcome && outcome.status !== 'in_progress');
}

function nextSequence(trace: LoginTrace) {
  const eventMax = (trace.events || []).reduce((max, event) => Math.max(max, event.sequence), 0);
  const outcomeMax = (trace.outcomeHistory || []).reduce((max, outcome) => Math.max(max, outcome.sequence), 0);
  return Math.max(eventMax, outcomeMax) + 1;
}

function makeOutcome(
  trace: LoginTrace,
  status: LoginTraceOutcomeStatus,
  reason: string,
  at: number,
  step?: LoginTraceStep,
): LoginTraceOutcome {
  return {
    status,
    reason,
    at,
    sequence: nextSequence(trace),
    ...(step ? { step } : {}),
  };
}

function synthesizeEventsFromMarks(trace: LoginTrace): LoginTraceEvent[] {
  return ORDERED_STEPS
    .filter((step) => typeof trace.marks?.[step] === 'number')
    .map((step) => ({
      step,
      at: trace.marks[step] as number,
      sequence: getStepIndex(step) + 1,
      duplicate: false,
      afterTerminal: false,
    }))
    .sort((a, b) => a.at - b.at || a.sequence - b.sequence);
}

function normalizeTrace(trace: LoginTrace) {
  trace.version = 2;
  trace.marks = trace.marks || {};
  if (!Array.isArray(trace.events)) {
    trace.events = synthesizeEventsFromMarks(trace);
  }
  if (!Array.isArray(trace.outcomeHistory)) {
    trace.outcomeHistory = [];
  }
  if (!trace.outcome) {
    trace.outcome = {
      status: 'in_progress',
      reason: 'trace_active',
      at: trace.startedAt,
      sequence: 0,
    };
  }
  return trace;
}

function readTrace(): LoginTrace | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_TRACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoginTrace;
    if (!parsed?.traceId || !parsed?.provider || !parsed?.startedAt) return null;
    return normalizeTrace(parsed);
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
    window.sessionStorage.setItem(ACTIVE_TRACE_KEY, JSON.stringify(trace));
    window.sessionStorage.setItem(LAST_TRACE_KEY, JSON.stringify(trace));
  } catch {
    // ignore
  }
}

function markTraceEvent(trace: LoginTrace, step: LoginTraceStep, at: number) {
  normalizeTrace(trace);
  const duplicate = typeof trace.marks[step] === 'number';
  const event: LoginTraceEvent = {
    step,
    at,
    sequence: nextSequence(trace),
    duplicate,
    afterTerminal: isTerminalOutcome(trace.outcome),
  };

  trace.events?.push(event);
  if (!duplicate) {
    trace.marks[step] = at;
  }
  return event;
}

function setTraceOutcome(
  trace: LoginTrace,
  status: LoginTraceOutcomeStatus,
  reason: string,
  at: number,
  step?: LoginTraceStep,
) {
  normalizeTrace(trace);
  const outcome = makeOutcome(trace, status, reason, at, step);
  trace.outcome = outcome;
  trace.outcomeHistory?.push(outcome);
  return outcome;
}

function roundDelta(value: number) {
  return Math.round(value);
}

export function summarizeLoginTrace(trace: LoginTrace) {
  const normalized = normalizeTrace({
    ...trace,
    marks: { ...trace.marks },
    events: trace.events ? trace.events.map((event) => ({ ...event })) : undefined,
    outcome: trace.outcome ? { ...trace.outcome } : undefined,
    outcomeHistory: trace.outcomeHistory ? trace.outcomeHistory.map((outcome) => ({ ...outcome })) : undefined,
  });

  const events = (normalized.events || [])
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((event) => ({
      step: event.step,
      elapsedMs: roundDelta(event.at - normalized.startedAt),
      sequence: event.sequence,
      duplicate: event.duplicate,
      afterTerminal: event.afterTerminal,
    }));

  const missingSteps = ORDERED_STEPS.filter((step) => typeof normalized.marks[step] !== 'number');
  const duplicateSteps = ORDERED_STEPS.filter((step) => (
    (normalized.events || []).filter((event) => event.step === step).length > 1
  ));
  const lateSteps = (normalized.events || [])
    .filter((event) => event.afterTerminal)
    .map((event) => event.step);

  const intervals = LOGIN_TRACE_INTERVALS.map(({ label, from, to }) => {
    const fromAt = normalized.marks[from];
    const toAt = normalized.marks[to];
    if (typeof fromAt !== 'number' || typeof toAt !== 'number') {
      return {
        label,
        from,
        to,
        status: 'missing' as const,
        durationMs: null,
        actualDeltaMs: null,
        missing: [from, to].filter((step) => typeof normalized.marks[step] !== 'number'),
      };
    }

    const actualDeltaMs = roundDelta(toAt - fromAt);
    if (actualDeltaMs < 0) {
      return {
        label,
        from,
        to,
        status: 'out_of_order' as const,
        durationMs: null,
        actualDeltaMs,
        missing: [],
      };
    }

    return {
      label,
      from,
      to,
      status: 'ok' as const,
      durationMs: actualDeltaMs,
      actualDeltaMs,
      missing: [],
    };
  });

  return {
    traceId: normalized.traceId,
    provider: normalized.provider,
    outcome: normalized.outcome,
    outcomeHistory: normalized.outcomeHistory,
    failure: normalized.failure,
    events,
    intervals,
    missingSteps,
    duplicateSteps,
    lateSteps,
  };
}

function logTrace(trace: LoginTrace) {
  if (!shouldLogTrace()) return;

  const summary = summarizeLoginTrace(trace);

  console.info('[HARU login trace]', {
    traceId: trace.traceId,
    provider: trace.provider,
    outcome: summary.outcome,
    missingSteps: summary.missingSteps,
    duplicateSteps: summary.duplicateSteps,
    lateSteps: summary.lateSteps,
  });
  console.table(summary.events);
  console.table(summary.intervals);
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
  const outcome: LoginTraceOutcome = {
    status: 'in_progress',
    reason: 'login_click',
    at: startedAt,
    sequence: 0,
    step: 'T0_login_click',
  };
  const trace: LoginTrace = {
    version: 2,
    traceId: createTraceId(),
    provider,
    startedAt,
    marks: {
      T0_login_click: startedAt,
    },
    events: [{
      step: 'T0_login_click',
      at: startedAt,
      sequence: 1,
      duplicate: false,
      afterTerminal: false,
    }],
    outcome,
    outcomeHistory: [outcome],
  };

  writeTrace(trace);
  markBrowserPerformance('T0_login_click');
  return trace.traceId;
}

export function markLoginTrace(step: LoginTraceStep) {
  const trace = readTrace();
  if (!trace) return null;
  markTraceEvent(trace, step, nowMs());
  if (isTerminalOutcome(trace.outcome)) persistLastTrace(trace);
  else writeTrace(trace);
  markBrowserPerformance(step);
  return trace;
}

export function finishLoginTrace(step: LoginTraceStep = 'T9_home_core_data_ready') {
  const trace = markLoginTrace(step);
  if (!trace) return;
  if (trace.outcome?.status !== 'in_progress') {
    persistLastTrace(trace);
    logTrace(trace);
    return;
  }
  setTraceOutcome(trace, 'success', 'home_core_data_ready', nowMs(), step);
  persistLastTrace(trace);
  logTrace(trace);
}

export function blockLoginTrace(reason: LoginTraceBlockedReason) {
  const trace = readTrace();
  if (!trace) return null;
  if (trace.outcome?.status === 'success' || trace.outcome?.status === 'failed') {
    return trace;
  }
  if (trace.outcome?.status === 'blocked' && trace.outcome.reason === reason) {
    persistLastTrace(trace);
    return trace;
  }
  setTraceOutcome(trace, 'blocked', reason, nowMs());
  persistLastTrace(trace);
  logTrace(trace);
  return trace;
}

export function resumeLoginTrace(reason: LoginTraceResumeReason) {
  const trace = readTrace();
  if (!trace) return null;
  if (trace.outcome?.status === 'success' || trace.outcome?.status === 'failed') {
    return trace;
  }
  setTraceOutcome(trace, 'in_progress', reason, nowMs());
  writeTrace(trace);
  return trace;
}

export function failLoginTrace(
  stage: LoginFailureStage,
  errorType: LoginFailureType,
  providerOverride?: LoginProvider | null,
) {
  const failedAt = nowMs();
  const existingTrace = readTrace();
  const trace: LoginTrace = existingTrace || {
    version: 2,
    traceId: createTraceId(),
    provider: providerOverride || 'unknown',
    startedAt: failedAt,
    marks: {},
    events: [],
    outcome: {
      status: 'in_progress',
      reason: 'trace_active',
      at: failedAt,
      sequence: 0,
    },
    outcomeHistory: [],
  };

  if (providerOverride) {
    trace.provider = providerOverride;
  }

  trace.failure = {
    stage,
    errorType,
    elapsedMs: roundDelta(failedAt - trace.startedAt),
  };

  setTraceOutcome(trace, 'failed', stage, failedAt);
  persistLastTrace(trace);
  logFailureTrace(trace);
}
