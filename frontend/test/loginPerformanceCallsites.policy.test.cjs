const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const loginPerformanceSrc = fs.readFileSync(path.join(root, 'frontend/src/app/utils/loginPerformance.ts'), 'utf8');
const authContextSrc = fs.readFileSync(path.join(root, 'frontend/src/app/contexts/AuthContext.tsx'), 'utf8');
const authCallbackSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/AuthCallbackPage.tsx'), 'utf8');
const homeSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/HomePageV2.tsx'), 'utf8');
const loginSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/LoginPage.tsx'), 'utf8');
const landingSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/LandingPage.tsx'), 'utf8');

function assertBefore(source, earlier, later) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `missing earlier marker: ${earlier}`);
  assert.notEqual(laterIndex, -1, `missing later marker: ${later}`);
  assert(earlierIndex < laterIndex, `expected "${earlier}" before "${later}"`);
}

for (const source of [loginSrc, landingSrc]) {
  assert(source.includes("beginLoginTrace('google');"));
  assert(source.includes("beginLoginTrace('kakao');\n    markLoginTrace('T1_provider_redirect_requested');"));
  assert(source.includes("beginLoginTrace('naver');\n    markLoginTrace('T1_provider_redirect_requested');"));
}

assert(authCallbackSrc.includes("markLoginTrace('T2_callback_arrived');"));
assertBefore(authCallbackSrc, "markLoginTrace('T2_callback_arrived');", 'readCallbackParams();');
assert(authCallbackSrc.includes("callbackPhase = 'sign_in_with_custom_token';"));
assert(authCallbackSrc.includes("callbackPhase = 'post_sign_in';"));

assert(homeSrc.includes("finishLoginTrace('T9_home_core_data_ready');"));
assertBefore(homeSrc, "markLoginTrace('T8_home_first_render')", "finishLoginTrace('T9_home_core_data_ready');");

assert(authContextSrc.includes("blockLoginTrace('user_doc_error');"));
assert(authContextSrc.includes("blockLoginTrace('pending_deletion');"));
assert(authContextSrc.includes("blockLoginTrace('required_consent_missing');"));
assert(authContextSrc.includes("resumeLoginTrace('user_doc_retry');"));
assertBefore(authContextSrc, "markLoginTrace('T5_user_doc_ready');", "markLoginTrace('T6_required_access_ready');");
assertBefore(authContextSrc, "if (pendingDeletion) {", "markLoginTrace('T6_required_access_ready');");
assertBefore(authContextSrc, "if (pendingDeletion) {", "blockLoginTrace('pending_deletion');");
assertBefore(authContextSrc, "} else if (needsConsent) {", "blockLoginTrace('required_consent_missing');");
assert(authContextSrc.includes("} else {\n          markLoginTrace('T6_required_access_ready');\n        }"));

assert(loginPerformanceSrc.includes("events?: LoginTraceEvent[];"));
assert(loginPerformanceSrc.includes("outcome?: LoginTraceOutcome;"));
assert(loginPerformanceSrc.includes("outcomeHistory?: LoginTraceOutcome[];"));
assert(loginPerformanceSrc.includes("afterTerminal: isTerminalOutcome(trace.outcome)"));
assert(loginPerformanceSrc.includes("status: 'out_of_order'"));
assert(loginPerformanceSrc.includes("status: 'missing'"));
assert(loginPerformanceSrc.includes("{ label: 'T0→T2', from: 'T0_login_click', to: 'T2_callback_arrived' }"));
assert(loginPerformanceSrc.includes("{ label: 'T2→T3', from: 'T2_callback_arrived', to: 'T3_firebase_sign_in_complete' }"));
assert(loginPerformanceSrc.includes("{ label: 'T3→T4', from: 'T3_firebase_sign_in_complete', to: 'T4_auth_state_settled' }"));
assert(loginPerformanceSrc.includes("{ label: 'T4→T6', from: 'T4_auth_state_settled', to: 'T6_required_access_ready' }"));
assert(loginPerformanceSrc.includes("{ label: 'T7→T8', from: 'T7_home_route_start', to: 'T8_home_first_render' }"));
assert(loginPerformanceSrc.includes("{ label: 'T8→T9', from: 'T8_home_first_render', to: 'T9_home_core_data_ready' }"));
assert(loginPerformanceSrc.includes("{ label: 'T0→T8', from: 'T0_login_click', to: 'T8_home_first_render' }"));
assert(loginPerformanceSrc.includes("{ label: 'T0→T9', from: 'T0_login_click', to: 'T9_home_core_data_ready' }"));
assert(!loginPerformanceSrc.includes('Math.max(0'));

console.log('login performance callsite policy tests passed');
