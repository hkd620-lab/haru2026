import {
  buildGoogleTokenRequestBody,
  type OAuthCallbackPhase,
  type OAuthPhaseLogInput,
} from './oauthCallbackDiagnostics';

type CallbackQuery = Record<string, unknown>;

type GoogleUserInfo = {
  email?: unknown;
  verified_email?: unknown;
  name?: unknown;
  id?: unknown;
  picture?: unknown;
};

type CallbackResponse = {
  redirect(url: string): void;
};

type GoogleOAuthPerformanceTimings = Record<
  'stateMs' | 'tokenMs' | 'profileMs' | 'uidMs' | 'authUserMs' | 'customTokenMs',
  number
>;

type GoogleOAuthCallbackDependencies = {
  defaultFrontendOrigin: string;
  redirectUri: string;
  getClientId(): string;
  getClientSecret(): string;
  consumeState(state: string): Promise<Record<string, any> | undefined>;
  resolveFrontendOrigin(origin: unknown): string;
  getCallbackCode(code: unknown, providerError: unknown): string;
  exchangeToken(body: string): Promise<{ status: number; data: { access_token?: unknown } }>;
  getUserInfo(accessToken: string): Promise<{ status: number; data: GoogleUserInfo }>;
  getOrCreateUid(email: string): Promise<string>;
  upsertAuthUser(input: {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
  }): Promise<void>;
  createCustomToken(uid: string): Promise<string>;
  buildSuccessRedirect(customToken: string, frontendOrigin: string): string;
  buildErrorRedirect(frontendOrigin: string): string;
  getHttpStatus(error: unknown): number | null;
  onPhase(input: OAuthPhaseLogInput): void;
  onCompleted(startedAt: number, timings: GoogleOAuthPerformanceTimings): void;
  createRequestId(): string;
  now(): number;
};

export async function handleGoogleOAuthCallback(
  query: CallbackQuery,
  response: CallbackResponse,
  dependencies: GoogleOAuthCallbackDependencies,
) {
  let frontendOrigin = dependencies.defaultFrontendOrigin;
  const callbackStartedAt = dependencies.now();
  const timings = {} as GoogleOAuthPerformanceTimings;
  const requestId = dependencies.createRequestId();
  let currentPhase: OAuthCallbackPhase = 'initialization';
  let phaseStartedAt = dependencies.now();

  const setPhase = (phase: OAuthCallbackPhase) => {
    currentPhase = phase;
    phaseStartedAt = dependencies.now();
  };
  const reportPhase = (
    outcome: 'success' | 'error',
    httpStatus: number | null,
    error?: unknown,
  ) => dependencies.onPhase({
    requestId,
    provider: 'google',
    phase: currentPhase,
    outcome,
    httpStatus,
    elapsedMs: dependencies.now() - phaseStartedAt,
    error,
  });
  const measurePerformancePhase = async <T>(
    phase: keyof GoogleOAuthPerformanceTimings,
    task: () => Promise<T>,
  ): Promise<T> => {
    const startedAt = dependencies.now();
    try {
      return await task();
    } finally {
      timings[phase] = dependencies.now() - startedAt;
    }
  };

  try {
    const clientId = dependencies.getClientId();
    const clientSecret = dependencies.getClientSecret();
    const { code, state, error: providerError } = query;

    setPhase('state_validation');
    if (!state || typeof state !== 'string') throw new Error('Invalid state');
    const oauthState = await measurePerformancePhase('stateMs', () => dependencies.consumeState(state));
    frontendOrigin = dependencies.resolveFrontendOrigin(oauthState?.returnOrigin);

    setPhase('provider_response');
    const callbackCode = dependencies.getCallbackCode(code, providerError);
    const tokenRequestBody = buildGoogleTokenRequestBody({
      code: callbackCode,
      clientId,
      clientSecret,
      redirectUri: dependencies.redirectUri,
    });

    // Keep this assignment immediately adjacent to the actual provider request.
    setPhase('token_exchange');
    const tokenResponse = await measurePerformancePhase(
      'tokenMs',
      () => dependencies.exchangeToken(tokenRequestBody.toString()),
    );
    reportPhase('success', tokenResponse.status);
    const accessToken = tokenResponse.data.access_token;
    if (!accessToken || typeof accessToken !== 'string') throw new Error('Google access token missing');

    setPhase('userinfo');
    const userResponse = await measurePerformancePhase(
      'profileMs',
      () => dependencies.getUserInfo(accessToken),
    );
    const googleUser = userResponse.data;
    const email = googleUser.email;
    if (!email || typeof email !== 'string') throw new Error('Google email missing');
    if (googleUser.verified_email !== true) throw new Error('Google email is not verified');
    reportPhase('success', userResponse.status);

    setPhase('custom_token');
    const displayName = typeof googleUser.name === 'string'
      ? googleUser.name
      : `google_user_${String(googleUser.id || '')}`;
    const photoURL = typeof googleUser.picture === 'string' ? googleUser.picture : null;
    const uid = await measurePerformancePhase('uidMs', () => dependencies.getOrCreateUid(email));
    await measurePerformancePhase(
      'authUserMs',
      () => dependencies.upsertAuthUser({ uid, email, displayName, photoURL }),
    );
    const customToken = await measurePerformancePhase(
      'customTokenMs',
      () => dependencies.createCustomToken(uid),
    );
    reportPhase('success', null);
    dependencies.onCompleted(callbackStartedAt, timings);

    setPhase('app_redirect');
    response.redirect(dependencies.buildSuccessRedirect(customToken, frontendOrigin));
    reportPhase('success', 302);
  } catch (error) {
    reportPhase('error', dependencies.getHttpStatus(error), error);
    response.redirect(dependencies.buildErrorRedirect(frontendOrigin));
  }
}
