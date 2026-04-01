import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';

const IMAGES = {
  hero: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/hero.png',
  feature_record: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/feature_record.png',
  feature_sayu: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/feature_sayu.png',
  feature_stats: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/feature_stats.png',
  sayu_premium: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/sayu_premium.png',
};

const VIDEOS = {
  horizontal: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/videos/promo_horizontal.mp4',
  vertical: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/videos/promo_vertical.mp4',
};

const FORMATS = [
  { name: '일기',           emoji: '📔', category: '생활' },
  { name: '에세이',         emoji: '✍️', category: '생활' },
  { name: '여행기록',       emoji: '✈️', category: '생활' },
  { name: '텃밭일지',       emoji: '🌱', category: '생활' },
  { name: '애완동물관찰일지', emoji: '🐾', category: '생활' },
  { name: '선교보고',       emoji: '📋', category: '업무' },
  { name: '일반보고',       emoji: '📊', category: '업무' },
  { name: '업무일지',       emoji: '💼', category: '업무' },
  { name: '육아일기',       emoji: '👶', category: '생활' },
  { name: '메모',           emoji: '📝', category: '업무', badge: 'AI 제목' },
];

/* ── 포도송이 로고 ── */
function GrapeLogo() {
  const dots = [
    { x: 50, y: 10 },
    { x: 30, y: 30 }, { x: 70, y: 30 },
    { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
    { x: 30, y: 70 }, { x: 70, y: 70 },
    { x: 10, y: 90 }, { x: 90, y: 90 },
  ];
  return (
    <svg width="48" height="56" viewBox="0 0 100 100" style={{ display: 'inline-block' }}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="9" fill="#10b981" />
      ))}
    </svg>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF9F6' }}>
        <div style={{ color: '#1A3C6E', fontSize: '18px' }}>로딩 중...</div>
      </div>
    );
  }

  const goToLogin = () => navigate('/login');
  const [mediaTab, setMediaTab] = useState<'image' | 'video'>('image');

  return (
    <div style={{ fontFamily: 'inherit', background: '#FAF9F6', overflowX: 'hidden' }}>

      {/* ══════════════════════════════
          섹션 1: 히어로
      ══════════════════════════════ */}
      <section style={{ background: '#1A3C6E', color: '#FAF9F6', padding: '64px 24px' }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '48px',
        }}>
          {/* 왼쪽 텍스트 */}
          <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
            {/* 포도송이 로고 + 브랜드명 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <GrapeLogo />
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '1px' }}>HARU 2026</div>
                <div style={{ fontSize: '12px', opacity: 0.6, letterSpacing: '2px', textTransform: 'uppercase' }}>Daily Journal App</div>
              </div>
            </div>

            <h1 style={{ fontSize: 'clamp(26px, 5vw, 46px)', fontWeight: 800, lineHeight: 1.25, marginBottom: '16px' }}>
              간편하게 입력하고,<br />쓸모있게 남깁니다
            </h1>
            <p style={{ fontSize: '17px', opacity: 0.8, lineHeight: 1.75, marginBottom: '32px' }}>
              일기, 에세이, 업무일지까지 —<br />
              10가지 형식으로 간편하게 입력하고<br />
              AI가 다듬어 드립니다
            </p>

            {/* CTA 버튼 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
              <button
                onClick={goToLogin}
                style={{
                  background: '#10b981', color: '#fff', border: 'none',
                  borderRadius: '12px', padding: '14px 28px',
                  fontSize: '17px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                지금 시작하기 →
              </button>
              <button
                onClick={() => document.getElementById('video-section')?.scrollIntoView({ behavior: 'smooth' })}
                style={{
                  background: 'transparent', color: '#FAF9F6',
                  border: '2px solid rgba(250,249,246,0.5)',
                  borderRadius: '12px', padding: '14px 28px',
                  fontSize: '17px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                영상 보기
              </button>
            </div>

            {/* 소셜 로그인 뱃지 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', opacity: 0.55, marginRight: '4px' }}>소셜 로그인:</span>
              {['Google', '카카오', '네이버'].map((s) => (
                <span key={s} style={{
                  background: 'rgba(255,255,255,0.12)', borderRadius: '20px',
                  padding: '4px 12px', fontSize: '13px', fontWeight: 600,
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* 오른쪽 hero 이미지 */}
          <div style={{ flex: '1 1 260px', minWidth: '240px', textAlign: 'center' }}>
            <img
              src={IMAGES.hero}
              alt="HARU 일기 앱"
              style={{
                width: '100%', maxWidth: '300px',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              }}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          섹션 2: 이미지 / 영상 토글
      ══════════════════════════════ */}
      <section id="video-section" style={{ background: '#FAF9F6', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#1A3C6E', marginBottom: '8px' }}>
          HARU2026 소개
        </h2>
        <p style={{ color: '#666', fontSize: '16px', marginBottom: '28px' }}>
          직접 보고 느껴보세요
        </p>

        {/* 토글 버튼 */}
        <div style={{ display: 'inline-flex', borderRadius: '12px', overflow: 'hidden', border: '2px solid #1A3C6E', marginBottom: '36px' }}>
          {(['image', 'video'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMediaTab(tab)}
              style={{
                padding: '10px 28px',
                fontSize: '16px', fontWeight: 700,
                cursor: 'pointer', border: 'none',
                background: mediaTab === tab ? '#1A3C6E' : '#fff',
                color: mediaTab === tab ? '#fff' : '#1A3C6E',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {tab === 'image' ? '🖼 이미지' : '🎬 영상'}
            </button>
          ))}
        </div>

        {/* 콘텐츠 — fade 전환 */}
        <div style={{ transition: 'opacity 0.3s ease', opacity: 1 }}>

          {mediaTab === 'image' && (
            <>
              {/* hero 이미지 (가로형) */}
              <div style={{ maxWidth: '720px', margin: '0 auto 32px' }}>
                <img
                  src={IMAGES.hero}
                  alt="HARU 앱 소개"
                  style={{ width: '100%', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                />
              </div>
              {/* feature_sayu 이미지 (좁은 폭) */}
              <div style={{ maxWidth: '360px', margin: '0 auto' }}>
                <img
                  src={IMAGES.feature_sayu}
                  alt="SAYU 다듬기 기능"
                  style={{ width: '100%', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                />
              </div>
            </>
          )}

          {mediaTab === 'video' && (
            <>
              {/* 가로형 영상 */}
              <div style={{ maxWidth: '720px', margin: '0 auto 32px' }}>
                <video
                  src={VIDEOS.horizontal}
                  autoPlay muted loop playsInline
                  style={{ width: '100%', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                />
              </div>
              {/* 세로형 영상 */}
              <div style={{ maxWidth: '360px', margin: '0 auto' }}>
                <video
                  src={VIDEOS.vertical}
                  autoPlay muted loop playsInline
                  style={{ width: '100%', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                />
              </div>
            </>
          )}

        </div>
      </section>

      {/* ══════════════════════════════
          섹션 3: 주요 기능 3개 카드
      ══════════════════════════════ */}
      <section style={{ background: '#fff', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#1A3C6E', marginBottom: '8px' }}>
            HARU가 특별한 이유
          </h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            매일의 기록이 자산이 됩니다
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center' }}>
            {[
              { img: IMAGES.feature_record, title: '10가지 기록 형식', desc: '일기부터 선교보고까지 — 상황에 맞는 형식으로 간편하게 작성' },
              { img: IMAGES.feature_sayu,   title: 'SAYU(사유) 다듬기', desc: '원문 감정 보존 원칙 — AI가 더 자연스럽게 표현을 다듬어 드립니다' },
              { img: IMAGES.feature_stats,  title: '통계 & 기록합치기', desc: '작성 현황을 한눈에 보고 여러 기록을 하나의 리포트로' },
            ].map((card) => (
              <div key={card.title} style={{
                flex: '1 1 280px', maxWidth: '340px',
                background: '#FAF9F6', borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden',
              }}>
                <img src={card.img} alt={card.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                <div style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1A3C6E', marginBottom: '8px' }}>{card.title}</h3>
                  <p style={{ fontSize: '15px', color: '#555', lineHeight: 1.65 }}>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          섹션 4: SAYU 소개 2단
      ══════════════════════════════ */}
      <section style={{ background: '#f0f4ff', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#1A3C6E', marginBottom: '8px' }}>
            SAYU(사유)란?
          </h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            내 글을 한 단계 끌어올려 드립니다
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center' }}>

            {/* BASIC */}
            <div style={{
              flex: '1 1 280px', maxWidth: '480px',
              background: '#1A3C6E', color: '#FAF9F6',
              borderRadius: '20px', overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(26,60,110,0.25)',
            }}>
              <img src={IMAGES.sayu_premium} alt="SAYU BASIC" style={{ width: '100%', height: '200px', objectFit: 'cover', opacity: 0.85 }} />
              <div style={{ padding: '24px' }}>
                <span style={{
                  display: 'inline-block',
                  background: '#10b981', color: '#fff',
                  borderRadius: '20px', padding: '3px 12px',
                  fontSize: '12px', fontWeight: 700, marginBottom: '12px',
                }}>
                  SAYU BASIC
                </span>
                <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px' }}>기본 다듬기</h3>
                <p style={{ fontSize: '15px', opacity: 0.8, lineHeight: 1.7 }}>
                  원문 감정과 내용을 보존하며 문장을 자연스럽게 다듬습니다
                </p>
              </div>
            </div>

            {/* PREMIUM */}
            <div style={{
              flex: '1 1 280px', maxWidth: '480px',
              background: '#fff', borderRadius: '20px', overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0,0,0,0.10)',
              border: '2px solid #10b981',
            }}>
              <img src={IMAGES.sayu_premium} alt="SAYU PREMIUM" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
              <div style={{ padding: '24px' }}>
                <span style={{
                  display: 'inline-block',
                  background: '#1A3C6E', color: '#fff',
                  borderRadius: '20px', padding: '3px 12px',
                  fontSize: '12px', fontWeight: 700, marginBottom: '12px',
                }}>
                  SAYU PREMIUM
                </span>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#1A3C6E', marginBottom: '10px' }}>프리미엄 다듬기</h3>
                <p style={{ fontSize: '15px', color: '#444', lineHeight: 1.7 }}>
                  Gemini AI가 더 풍부하고 깊이 있는 표현으로 다듬습니다. 구독 회원 전용
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          섹션 5: 기록 형식 10개 그리드
      ══════════════════════════════ */}
      <section style={{ background: '#FAF9F6', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#1A3C6E', marginBottom: '8px' }}>
            기록 형식 10가지
          </h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            내 상황에 맞게 선택
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '16px',
          }}
            className="format-grid"
          >
            {FORMATS.map((f) => {
              const isLife = f.category === '생활';
              return (
                <div key={f.name} style={{
                  background: isLife ? '#e8f5e9' : '#e3f0ff',
                  borderRadius: '12px', padding: '18px 10px',
                  textAlign: 'center', position: 'relative',
                  border: f.badge ? '2px solid #10b981' : `1px solid ${isLife ? '#a5d6a7' : '#90caf9'}`,
                }}>
                  {f.badge && (
                    <span style={{
                      position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                      background: '#10b981', color: '#fff',
                      borderRadius: '10px', padding: '2px 8px',
                      fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {f.badge}
                    </span>
                  )}
                  <div style={{ fontSize: '26px', marginBottom: '6px' }}>{f.emoji}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: isLife ? '#2e7d32' : '#1565c0' }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '3px', color: isLife ? '#4caf50' : '#2196f3', fontWeight: 600 }}>
                    {f.category}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          섹션 6: 하단 CTA
      ══════════════════════════════ */}
      <section style={{ background: '#1A3C6E', color: '#FAF9F6', padding: '64px 24px' }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: '32px',
        }}>
          {/* 왼쪽 텍스트 */}
          <div style={{ flex: '1 1 280px' }}>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, marginBottom: '12px' }}>
              지금 바로 하루를 기록해보세요
            </h2>
            <p style={{ fontSize: '16px', opacity: 0.75 }}>
              Google · 카카오 · 네이버 소셜 로그인으로 30초면 시작
            </p>
          </div>
          {/* 오른쪽 버튼 */}
          <div>
            <button
              onClick={goToLogin}
              style={{
                background: '#10b981', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '16px 40px',
                fontSize: '18px', fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              무료로 시작하기 →
            </button>
          </div>
        </div>
      </section>

      {/* 모바일 반응형 — format-grid */}
      <style>{`
        @media (max-width: 640px) {
          .format-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>

    </div>
  );
}
