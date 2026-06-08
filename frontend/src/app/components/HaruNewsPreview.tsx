import './HaruNewsPreview.css';

const STEPS = [
  {
    num: 'STEP 1',
    title: '기록',
    desc: '일기·건강·메모 등\n12종 형식으로\n간편하게 쓴다',
  },
  {
    num: 'STEP 2',
    title: '12개 분야\n전문 비서',
    desc: '법률·건강·재테크 등\n목적별 자료로 정리한다',
  },
  {
    num: 'STEP 3',
    title: '합본 검색\n통계보기',
    desc: '흩어진 기록을 찾고\n삶의 패턴을 확인한다',
  },
  {
    num: 'STEP 4',
    title: '미래보기',
    desc: '다음 선택을\n준비하게 한다',
  },
] as const;

export default function HaruNewsPreview() {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className="haru-news-preview" aria-label="HARU2026 서비스 소개">
      {/* 헤더 바 */}
      <header className="haru-news-preview__header">
        <span className="haru-news-preview__brand">HARU2026</span>
        <span className="haru-news-preview__tagline">지능형 기록관리 플랫폼</span>
        <span className="haru-news-preview__date">{today}</span>
      </header>

      <div className="haru-news-preview__divider" aria-hidden="true" />

      {/* 본문 */}
      <div className="haru-news-preview__body">
        <span className="haru-news-preview__tag">
          쓰고 끝나던 기록이, 처음으로 나를 위해 일한다
        </span>

        <h2 className="haru-news-preview__headline">
          잊히는 하루를 삶의 자산으로…<br />
          HARU2026, 지능형 기록관리 시대 연다
        </h2>

        <p className="haru-news-preview__subhead">
          법률·건강·재테크 등 12개 분야 전문 비서가 일상기록을 목적별 자료로 정리하고,
          합본 검색·통계보기·미래보기로 삶의 흐름을 보여준다
        </p>

        <p className="haru-news-preview__lead">
          어제 적은 두통 기록은 오늘 병원 상담 자료가 되고, 억울했던 하루의 메모는
          법적 대응을 준비하는 단서가 된다. HARU2026은 사라지던 일상기록을
          법률·건강·재테크 등 12개 분야 전문 비서가 목적별 자료로 정리하고,
          합본 검색과 통계보기, 미래보기를 통해 사용자가 자신의 삶을 다시 찾고
          점검하며 다음 선택을 준비하도록 돕는 지능형 기록관리 플랫폼이다.
        </p>

        {/* 4단계 카드 */}
        <div className="haru-news-preview__steps" role="list">
          {STEPS.map((step) => (
            <div key={step.num} className="haru-news-preview__step" role="listitem">
              {/* 모바일에서 step-content로 텍스트 묶음 */}
              <span className="haru-news-preview__step-num">{step.num}</span>
              <span className="haru-news-preview__step-content">
                <span className="haru-news-preview__step-title" style={{ whiteSpace: 'pre-line' }}>
                  {step.title}
                </span>
                <span className="haru-news-preview__step-desc" style={{ whiteSpace: 'pre-line' }}>
                  {step.desc}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* 강조 문구 */}
        <p className="haru-news-preview__highlight">
          매일의 기록이 전문가 상담과 다음 선택을 준비하는 자료가 된다
        </p>
      </div>

      {/* 푸터 */}
      <footer className="haru-news-preview__footer">
        <span className="haru-news-preview__footer-dot" aria-hidden="true" />
        <span className="haru-news-preview__footer-text">HARU by JOYEL — 간편하게 입력하고, 쓸모있게 남깁니다</span>
        <span className="haru-news-preview__footer-dot" aria-hidden="true" />
      </footer>
    </article>
  );
}
