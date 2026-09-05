const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');
const monthlyAiQuotaSrc = fs.readFileSync(path.join(root, 'functions/src/utils/monthlyAiQuota.ts'), 'utf8');
const landingPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/LandingPage.tsx'), 'utf8');
const assistantOnboardingDetailPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/AssistantOnboardingDetailPage.tsx'), 'utf8');
const subscriptionPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/SubscriptionPage.tsx'), 'utf8');
const singlePaymentPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/SinglePaymentPage.tsx'), 'utf8');
const subscriptionModalSrc = fs.readFileSync(path.join(root, 'frontend/src/app/components/SubscriptionModal.tsx'), 'utf8');
const premiumLockSrc = fs.readFileSync(path.join(root, 'frontend/src/app/components/PremiumLock.tsx'), 'utf8');
const termsPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/TermsPage.tsx'), 'utf8');
const gyeongdaePreviewPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/GyeongdaePreviewPage.tsx'), 'utf8');
const useSubscriptionSrc = fs.readFileSync(path.join(root, 'frontend/src/app/hooks/useSubscription.ts'), 'utf8');
const mergeWorkflowSrc = fs.readFileSync(path.join(root, '.github/workflows/firebase-hosting-merge.yml'), 'utf8');

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const launchPlanSection = section(indexSrc, 'function assertLaunchPurchasablePlan', 'function createPortOneRequestId');
const userPlanSection = section(indexSrc, 'async function getUserPlan', 'type PaidServiceUsageEvent');
const createSingleSection = section(indexSrc, 'export const createSinglePaymentRequest = onCall', 'export const createSubscriptionBillingRequest = onCall');
const createSubscriptionSection = section(indexSrc, 'export const createSubscriptionBillingRequest = onCall', 'export const recoverSubscriptionBillingRequest = onCall');
const recoverSubscriptionSection = section(indexSrc, 'export const recoverSubscriptionBillingRequest = onCall', '// ===== 💳 결제 검증 (PortOne V2) =====');
const verifyPaymentSection = section(indexSrc, 'export const verifyPayment = onCall', '// ===== 💳 정기결제 시작 (PortOne V2 빌링키) =====');
const subscribeSection = section(indexSrc, 'export const subscribeWithBillingKey = onCall', '// ===== 💳 정기구독 해지 =====');
const recurringSection = section(indexSrc, 'export const processRecurringSubscriptions = onSchedule', '// ===== 💳 일반(단건) 1개월 이용권 검증 =====');
const verifySingleSection = section(indexSrc, 'export const verifySinglePayment = onCall', '// ===== 💳 PortOne V2 결제 웹훅 =====');
const webhookSection = section(indexSrc, 'export const portoneWebhook = onRequest', '// ===== 🗑️ 일회성 마이그레이션');
const buildEffectiveSection = section(useSubscriptionSrc, 'function buildEffectiveSubscription', 'export function useSubscription');

assert(indexSrc.includes("function assertPaidPlan(plan: unknown): 'basic' | 'premium'"));
assert(indexSrc.includes("type HaruPaidPlan = 'basic' | 'premium'"));
assert(launchPlanSection.includes("if (!isLaunchPurchasablePlan(paidPlan))"));
assert(launchPlanSection.includes('프리미엄 신규 결제는 준비 중입니다.'));
assert(launchPlanSection.includes('베이직 월 4,000원'));

assert(createSingleSection.includes('const plan = assertLaunchPurchasablePlan(request.data?.plan)'));
assert(createSubscriptionSection.includes('const plan = assertLaunchPurchasablePlan(request.data?.plan)'));
assert(createSubscriptionSection.includes('premium_sales_not_open'));
assert(recoverSubscriptionSection.includes('const plan = assertLaunchPurchasablePlan(requestData.plan)'));
assert(verifyPaymentSection.includes('const purchasablePlan = assertLaunchPurchasablePlan(orderData.plan)'));
assert(verifyPaymentSection.includes('freshData.plan !== purchasablePlan'));
assert(subscribeSection.includes('const plan = assertLaunchPurchasablePlan(requestData.plan)'));
assert(verifySingleSection.includes('const requestedPlan = assertLaunchPurchasablePlan(orderData.plan)'));
assert(verifySingleSection.includes('freshOrderData.plan !== requestedPlan'));
assert(webhookSection.includes('const plan = isLaunchPurchasablePlan(freshOrderData.plan) ? freshOrderData.plan : null;'));

assert(recurringSection.includes("freshData.plan === 'basic' ? 'basic' : freshData.plan === 'premium' ? 'premium' : ''"));
assert(userPlanSection.includes("status !== 'active' && status !== 'cancelled'"));
assert(monthlyAiQuotaSrc.includes("status !== 'active' && status !== 'cancelled'"));
assert(useSubscriptionSrc.includes("subscription.status === 'active' || subscription.status === 'cancelled'"));
assert(buildEffectiveSection.includes("status: 'active'"));

assert(subscriptionPageSrc.includes("const [selectedPlan, setSelectedPlan] = useState<PaidPlan>('basic')"));
assert(!subscriptionPageSrc.includes("useState<PaidPlan>('premium')"));
assert(subscriptionPageSrc.includes('프리미엄은 준비 중입니다. 현재는 베이직 월 4,000원만 결제할 수 있습니다.'));
assert(subscriptionPageSrc.includes('독서 OCR 월 20장'));
assert(subscriptionPageSrc.includes('독서 OCR 월 100장'));
assert(subscriptionPageSrc.includes('독서 OCR 월 300장 예정'));
assert(subscriptionPageSrc.includes('하루LAW 첨부파일'));
assert(subscriptionPageSrc.includes('더 넉넉한 AI 이용'));
assert(!subscriptionPageSrc.includes('하루LAW 결과 대화'));
assert(!subscriptionPageSrc.includes('SNS 하루탭'));
assert(subscriptionPageSrc.includes("disabled={!isAvailable || loading}"));
assert(subscriptionPageSrc.includes("selectedPlan !== 'basic'"));
assert(subscriptionPageSrc.includes("const plan = parsed.plan === 'basic' ? parsed.plan : null;"));
assert(!subscriptionPageSrc.includes('무료 체험'));

assert(singlePaymentPageSrc.includes("const [selectedPlan, setSelectedPlan] = useState<PaidPlan>('basic')"));
assert(!singlePaymentPageSrc.includes("useState<PaidPlan>('premium')"));
assert(singlePaymentPageSrc.includes('프리미엄은 준비 중입니다. 현재는 베이직 4,000원 이용권만 결제할 수 있습니다.'));
assert(singlePaymentPageSrc.includes("disabled={loading || !isAvailable}"));
assert(singlePaymentPageSrc.includes("selectedPlan !== 'basic'"));
assert(singlePaymentPageSrc.includes('if (!redirectedPaymentId)'));
assert(singlePaymentPageSrc.includes("if (redirectedPlanParam === 'premium') setResultMessage(PREMIUM_COMING_SOON_MESSAGE);"));
assert(!singlePaymentPageSrc.includes("const redirectedPlan = params.get('plan') === 'basic' ? 'basic' : 'premium';"));

assert(subscriptionModalSrc.includes("id: 'free'"));
assert(subscriptionModalSrc.includes("id: 'basic'"));
assert(subscriptionModalSrc.includes("id: 'premium'"));
assert(subscriptionModalSrc.includes('독서 OCR 월 20장'));
assert(subscriptionModalSrc.includes('독서 OCR 월 100장'));
assert(subscriptionModalSrc.includes('독서 OCR 월 300장 예정'));
assert(subscriptionModalSrc.includes('하루LAW 첨부파일'));
assert(subscriptionModalSrc.includes('더 넉넉한 AI 이용'));
assert(!subscriptionModalSrc.includes('하루LAW 결과 대화'));
assert(!subscriptionModalSrc.includes('SNS 하루탭'));
assert(subscriptionModalSrc.includes("if (planId !== 'basic') return;"));
assert(subscriptionModalSrc.includes('프리미엄은 준비 중이며 이번 출시에서는 결제되지 않습니다'));
assert(!subscriptionModalSrc.includes('무료 체험'));

for (const [name, source] of [
  ['LandingPage', landingPageSrc],
  ['AssistantOnboardingDetailPage', assistantOnboardingDetailPageSrc],
  ['TermsPage', termsPageSrc],
  ['PremiumLock', premiumLockSrc],
  ['GyeongdaePreviewPage', gyeongdaePreviewPageSrc],
]) {
  assert(!source.includes('7일 무료'), `${name} must not display the old 7-day free start copy`);
  assert(!source.includes('무료 체험'), `${name} must not display free trial copy`);
  assert(!source.includes('무료체험'), `${name} must not display free trial copy`);
  assert(!source.includes('체험 종료 후'), `${name} must not imply post-trial billing`);
  assert(!source.includes('월 6,000원으로 시작'), `${name} must not show immediate premium purchase copy`);
}

assert(landingPageSrc.includes("plan: '무료'"));
assert(landingPageSrc.includes("price: '₩0'"));
assert(landingPageSrc.includes("plan: '베이직'"));
assert(landingPageSrc.includes("price: '₩4,000'"));
assert(landingPageSrc.includes("plan: '프리미엄'"));
assert(landingPageSrc.includes("price: '₩6,000 예정'"));
assert(landingPageSrc.includes("badge: '준비 중'"));
assert(landingPageSrc.includes("disabled={!p.available}"));
assert(landingPageSrc.includes('일부 AI 기능 무료 한도 내 체험'));
assert(landingPageSrc.includes('하루LAW 첨부파일'));
assert(landingPageSrc.includes('독서 OCR 월 20장'));
assert(landingPageSrc.includes('독서 OCR 월 100장'));
assert(landingPageSrc.includes('독서 OCR 월 300장 예정'));
assert(!landingPageSrc.includes('RECOMMENDED'));

assert(assistantOnboardingDetailPageSrc.includes("title: '9. 구독 플랜'"));
assert(!assistantOnboardingDetailPageSrc.includes('구독과 무료체험'));
assert(!assistantOnboardingDetailPageSrc.includes('LIGHT'));
assert(assistantOnboardingDetailPageSrc.includes('<div style={planNameStyle}>무료</div>'));
assert(assistantOnboardingDetailPageSrc.includes('<div style={planNameStyle}>베이직</div>'));
assert(assistantOnboardingDetailPageSrc.includes('<div style={planNameStyle}>프리미엄</div>'));
assert(assistantOnboardingDetailPageSrc.includes('₩4,000 / 월'));
assert(assistantOnboardingDetailPageSrc.includes('₩6,000 예정 / 월'));
assert(assistantOnboardingDetailPageSrc.includes('준비 중'));
assert(assistantOnboardingDetailPageSrc.includes('일부 AI 기능을 무료 한도 내에서 제한적으로 이용'));

assert(termsPageSrc.includes('현재 무료 플랜은 0원'));
assert(termsPageSrc.includes('베이직은 4,000원'));
assert(termsPageSrc.includes('프리미엄은 월 6,000원 예정으로 준비 중이고 신규 결제가 제공되지 않습니다'));
assert(termsPageSrc.includes('무료 플랜 이용만으로 결제수단이 등록되거나 유료 결제로 자동 전환되지 않습니다'));

assert(premiumLockSrc.includes('프리미엄은 준비 중입니다. 이번 출시에서는 결제되지 않습니다.'));
assert(premiumLockSrc.includes('disabled'));
assert(premiumLockSrc.includes('프리미엄 준비 중'));

assert(mergeWorkflowSrc.includes('VITE_PORTONE_KAKAOPAY_BILLING_CHANNEL_KEY'));
assert(mergeWorkflowSrc.includes('VITE_PORTONE_INICIS_BILLING_CHANNEL_KEY'));
assert(mergeWorkflowSrc.includes('echo "::error::$name is not configured"'));
assert(!mergeWorkflowSrc.includes('echo "${!name}"'));

console.log('subscription launch policy tests passed');
