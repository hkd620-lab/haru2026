import type { LoginProvider } from './loginProvider';

type SocialLoginProvider = Extract<LoginProvider, 'google' | 'kakao' | 'naver'>;

const SOCIAL_LOGIN_URLS: Record<SocialLoginProvider, string> = {
  google: 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/googleLoginStart',
  kakao: 'https://kakaologinstart-6ieesxet3q-du.a.run.app',
  naver: 'https://naverloginstart-6ieesxet3q-du.a.run.app',
};

export function buildSocialLoginUrl(provider: SocialLoginProvider, returnOrigin = window.location.origin): string {
  const url = new URL(SOCIAL_LOGIN_URLS[provider]);
  url.searchParams.set('returnOrigin', returnOrigin);
  return url.toString();
}
