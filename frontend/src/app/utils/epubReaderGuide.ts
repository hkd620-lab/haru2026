// EPUB 파일을 여는 방법 안내 — EPUB 지원 앱이 없는 기기에서는 내려받은 파일이 열리지 않을 수 있다.
// 기기별로 무료 전자책 앱과 여는 방법을 알려 준다.

export type EpubReaderPlatform = 'android' | 'ios' | 'desktop';

export interface EpubReaderGuide {
  platform: EpubReaderPlatform;
  title: string;
  steps: string[];
  linkLabel?: string;
  linkUrl?: string;
}

export const GOOGLE_PLAY_BOOKS_URL = 'https://play.google.com/store/apps/details?id=com.google.android.apps.books';

export function detectEpubReaderPlatform(userAgent: string, maxTouchPoints = 0): EpubReaderPlatform {
  if (/android/i.test(userAgent)) return 'android';
  // iPadOS 13+ 는 Mac 으로 보이므로 터치 지원으로 구분한다.
  if (/iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

export function getEpubReaderGuide(platform: EpubReaderPlatform): EpubReaderGuide {
  if (platform === 'android') {
    return {
      platform,
      title: '안드로이드에서 EPUB 여는 방법',
      steps: [
        '안드로이드 휴대폰(갤럭시 등)에 EPUB 지원 앱이 없다면 별도 리더 앱이 필요합니다.',
        '지원 앱이 없으면 ‘Google Play 북’을 설치할 수 있습니다.',
        '설치 후 ‘내 파일 → 다운로드’에서 EPUB을 누르고 Play 북으로 여세요.',
        '바로 열리지 않으면 ‘다운로드’ 또는 ‘파일’ 앱에서 EPUB의 ‘연결 프로그램 → Play 북’ 또는 ‘Play 북에 업로드’를 선택하세요. 업로드한 파일은 Play 북 → 라이브러리 → 업로드에서 찾을 수 있습니다.',
      ],
      linkLabel: 'Google Play 북 설치하기',
      linkUrl: GOOGLE_PLAY_BOOKS_URL,
    };
  }
  if (platform === 'ios') {
    return {
      platform,
      title: '아이폰·아이패드에서 EPUB 여는 방법',
      steps: [
        '기본 앱 ‘도서(Books)’로 열 수 있습니다.',
        '‘파일’ 앱 → 다운로드에서 EPUB을 누르고, 공유(□↑) → ‘도서’를 고르세요.',
      ],
    };
  }
  return {
    platform,
    title: '컴퓨터에서 EPUB 여는 방법',
    steps: [
      'Mac은 기본 앱 ‘도서(Books)’로 열 수 있습니다.',
      'Windows는 EPUB을 지원하는 전자책 뷰어 프로그램이 필요합니다.',
      '휴대폰에서 보려면 파일을 휴대폰으로 옮긴 뒤 위 안내대로 전자책 앱에서 여세요.',
    ],
  };
}

export function getCurrentEpubReaderGuide(): EpubReaderGuide {
  if (typeof navigator === 'undefined') return getEpubReaderGuide('desktop');
  return getEpubReaderGuide(detectEpubReaderPlatform(navigator.userAgent || '', navigator.maxTouchPoints || 0));
}

// 저장 완료 알림에 붙이는 한 줄 안내
export function getEpubReaderHint(guide: EpubReaderGuide = getCurrentEpubReaderGuide()): string {
  if (guide.platform === 'android') return '파일이 열리지 않으면 ‘Google Play 북’ 같은 전자책 앱이 필요합니다.';
  if (guide.platform === 'ios') return '‘파일’ 앱에서 EPUB을 눌러 ‘도서’ 앱으로 여세요.';
  return 'EPUB은 전자책 앱(Mac ‘도서’, Windows 전자책 뷰어)에서 열립니다.';
}
