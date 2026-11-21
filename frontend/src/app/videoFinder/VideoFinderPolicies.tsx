const youtubeAttribution = new URL('./assets/developed-with-youtube.png', import.meta.url).href;
const youtubeTerms = 'https://www.youtube.com/t/terms';
const googlePrivacy = 'https://policies.google.com/privacy';
const linkClass = 'font-semibold underline underline-offset-4';

export function YouTubeAttribution() {
  return (
    <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer"
      className="inline-flex min-h-[44px] items-center rounded-md bg-white px-2 focus-visible:outline focus-visible:outline-2"
      aria-label="Developed with YouTube · YouTube 열기 (새 창)">
      <img src={youtubeAttribution} width="140" height="50" alt="Developed with YouTube" />
    </a>
  );
}

export function VideoFinderPolicyLinks({ haruOrigin }: { haruOrigin: string }) {
  return (
    <nav aria-label="영상 찾기 이용약관과 개인정보" className="flex flex-wrap gap-x-4 gap-y-2 text-base">
      <a className={linkClass} href={`${haruOrigin}/terms#video-finder`} target="_blank" rel="noopener noreferrer">HARU 이용약관</a>
      <a className={linkClass} href={`${haruOrigin}/privacy#video-finder`} target="_blank" rel="noopener noreferrer">HARU 개인정보 처리방침</a>
      <a className={linkClass} href={youtubeTerms} target="_blank" rel="noopener noreferrer">YouTube 서비스 약관</a>
      <a className={linkClass} href={googlePrivacy} target="_blank" rel="noopener noreferrer">Google 개인정보처리방침</a>
    </nav>
  );
}

export function VideoFinderPolicySummary() {
  return (
    <>
      <p>내 영상 찾기는 YouTube API 서비스로 공개 영상 정보를 표시합니다. 영상은 원본 YouTube 페이지에서 재생됩니다.</p>
      <p>HARU 계정에 저장하는 항목은 지난 검색 조건, 보관 링크, 직접 쓴 메모·태그입니다. 보관함의 ‘내 기록 관리’에서 내보내거나 삭제할 수 있습니다. 작성 중인 메모는 사용 중인 브라우저에도 임시 보관됩니다.</p>
      <p>프리미엄 영상 질문의 Google Gemini 정보 전송은 처음 질문하기 전에 별도로 안내하고 동의를 받습니다.</p>
      <p>HARU 개인정보 처리방침에 동의하고 내 영상 찾기를 이용하면 YouTube 서비스 약관도 적용됩니다.</p>
    </>
  );
}
