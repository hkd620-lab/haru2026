const UTM_STORAGE_KEYS = {
  source: 'haru_utm_source',
  medium: 'haru_utm_medium',
  campaign: 'haru_utm_campaign',
} as const;

function getSessionValue(key: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = window.sessionStorage.getItem(key);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function setSessionValueIfEmpty(key: string, value: string | null): void {
  if (typeof window === 'undefined' || !value) return;

  try {
    if (!window.sessionStorage.getItem(key)) {
      window.sessionStorage.setItem(key, value);
    }
  } catch {
    // Attribution capture must never affect app startup.
  }
}

function getReferrerOrigin(): string | null {
  if (typeof document === 'undefined' || !document.referrer) return null;

  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

export function captureUtmParams(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  setSessionValueIfEmpty(UTM_STORAGE_KEYS.source, params.get('utm_source'));
  setSessionValueIfEmpty(UTM_STORAGE_KEYS.medium, params.get('utm_medium'));
  setSessionValueIfEmpty(UTM_STORAGE_KEYS.campaign, params.get('utm_campaign'));
}

export function getSignupAttribution(): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  signupReferrerOrigin: string | null;
} {
  return {
    utmSource: getSessionValue(UTM_STORAGE_KEYS.source),
    utmMedium: getSessionValue(UTM_STORAGE_KEYS.medium),
    utmCampaign: getSessionValue(UTM_STORAGE_KEYS.campaign),
    signupReferrerOrigin: getReferrerOrigin(),
  };
}
