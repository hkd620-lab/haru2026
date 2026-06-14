export type InAppBrowserInfo = {
  isInAppBrowser: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  appName: string | null;
};

const IN_APP_RULES: Array<{ name: string; pattern: RegExp }> = [
  // KAKAOTALK/i : 구버전 대문자(KAKAOTALK), 신버전 혼합(KakaoTalk) 모두 매칭
  // com\.kakao\.talk : 일부 Android 기기에서 패키지명이 UA에 포함되는 변형 대응
  { name: '카카오톡', pattern: /KAKAOTALK|com\.kakao\.talk/i },
  { name: '네이버', pattern: /NAVER|NAVER\(inapp/i },
  { name: '라인', pattern: /Line\//i },
  { name: '인스타그램', pattern: /Instagram/i },
  { name: '페이스북', pattern: /FBAN|FBAV|FB_IAB/i },
];

export function getInAppBrowserInfo(): InAppBrowserInfo {
  if (typeof navigator === 'undefined') {
    return { isInAppBrowser: false, isAndroid: false, isIOS: false, appName: null };
  }

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  const matched = IN_APP_RULES.find((rule) => rule.pattern.test(ua));
  const isAndroidWebView = isAndroid && (/\bwv\b/i.test(ua) || /; wv\)/i.test(ua));

  return {
    isInAppBrowser: Boolean(matched) || isAndroidWebView,
    isAndroid,
    isIOS,
    appName: matched?.name || (isAndroidWebView ? '앱 내 브라우저' : null),
  };
}

export async function copyCurrentPageUrl() {
  if (typeof window === 'undefined') return false;
  const url = window.location.href;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return true;
  }

  const textArea = document.createElement('textarea');
  textArea.value = url;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textArea);
  return copied;
}

export function openCurrentPageInChrome() {
  if (typeof window === 'undefined') return;
  const { protocol, host, pathname, search, hash } = window.location;
  const scheme = protocol.replace(':', '') || 'https';
  const fullUrl = `${scheme}://${host}${pathname}${search}${hash}`;
  // S.browser_fallback_url: Chrome 미설치 단말에서 기본 브라우저로 폴백
  window.location.href = `intent://${host}${pathname}${search}${hash}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fullUrl)};end`;
}
