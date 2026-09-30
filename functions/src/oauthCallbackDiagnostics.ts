export type OAuthCallbackPhase =
  | 'initialization'
  | 'state_validation'
  | 'provider_response'
  | 'token_exchange'
  | 'userinfo'
  | 'custom_token'
  | 'app_redirect';

const ALLOWED_PROVIDER_ERROR_CODES = new Set([
  'access_denied',
  'invalid_client',
  'invalid_grant',
  'invalid_request',
  'server_error',
  'temporarily_unavailable',
  'unauthorized_client',
  'unsupported_grant_type',
]);

export type OAuthPhaseLogInput = {
  requestId: string;
  provider: 'google';
  phase: OAuthCallbackPhase;
  outcome: 'success' | 'error';
  httpStatus: number | null;
  elapsedMs: number;
  error?: unknown;
};

function getAllowedProviderErrorCode(error: unknown): string | undefined {
  const value = (error as any)?.response?.data?.error;
  return typeof value === 'string' && ALLOWED_PROVIDER_ERROR_CODES.has(value)
    ? value
    : undefined;
}

function normalizeHttpStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

export function buildOAuthPhaseLog(input: OAuthPhaseLogInput) {
  const providerErrorCode = getAllowedProviderErrorCode(input.error);
  return {
    requestId: input.requestId,
    provider: input.provider,
    phase: input.phase,
    outcome: input.outcome,
    httpStatus: normalizeHttpStatus(input.httpStatus),
    elapsedMs: Math.max(0, Math.round(input.elapsedMs)),
    ...(providerErrorCode ? { providerErrorCode } : {}),
  };
}

export function buildGoogleTokenRequestBody(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  return new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });
}
