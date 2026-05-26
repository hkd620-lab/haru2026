import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { GrapeAnimation } from '../components/GrapeAnimation';

const IMAGES = {
  hero: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/hero.png',
  feature_record: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/feature_record.png',
  feature_sayu: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/feature_sayu.png',
  feature_stats: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/feature_stats.png',
  sayu_premium: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/sayu_premium.png',
};


const FORMATS = [
  { name: '일기',           emoji: '📔', category: '생활' },
  { name: '에세이',         emoji: '✍️', category: '생활' },
  { name: '여행기록',       emoji: '✈️', category: '생활' },
  { name: '독서사유',       emoji: '📚', category: '생활' },
  { name: '텃밭일지',       emoji: '🌱', category: '생활' },
  { name: '애완동물관찰',   emoji: '🐾', category: '생활' },
  { name: '육아일기',       emoji: '👶', category: '생활' },
  { name: '선교보고',       emoji: '📋', category: '업무' },
  { name: '일반보고',       emoji: '📊', category: '업무' },
  { name: '업무일지',       emoji: '💼', category: '업무' },
  { name: '메모',           emoji: '📝', category: '업무', badge: 'AI 제목' },
  { name: 'HARU보조장부',   emoji: '🧾', category: '업무' },
  { name: 'HARU주식관리',   emoji: '📈', category: '자산' },
  { name: '하루LAW',        emoji: '⚖️', category: '전문' },
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
        <circle key={i} cx={d.x} cy={d.y} r="9" fill="#7A8B4E" />
      ))}
    </svg>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const { user, loading, googleSignIn } = useAuth();
  const [showBanner, setShowBanner] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('haru_tip_banner_dismissed');
    if (dismissed === 'true') {
      setShowBanner(false);
    }
  }, []);

  const handleCloseBanner = () => {
    localStorage.setItem('haru_tip_banner_dismissed', 'true');
    setShowBanner(false);
  };

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F0E8' }}>
        <div style={{ color: '#4A5A2C', fontSize: '18px' }}>로딩 중...</div>
      </div>
    );
  }

  const goToLogin = () => navigate('/login');

  const handleGoogleLogin = async () => {
    setIsLoginLoading(true);
    if (import.meta.env.DEV) {
      try {
        await googleSignIn();
        navigate('/');
      } catch (e: any) {
        console.error('[dev] Google login failed:', e);
        toast.error('Google 로그인 실패');
        setIsLoginLoading(false);
      }
      return;
    }
    setTimeout(() => {
      window.location.href = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/googleLoginStart';
    }, 1500);
  };

  const handleKakaoLogin = () => {
    setIsLoginLoading(true);
    setTimeout(() => {
      window.location.href = 'https://kakaologinstart-6ieesxet3q-du.a.run.app';
    }, 1500);
  };

  const handleNaverLogin = () => {
    setIsLoginLoading(true);
    setTimeout(() => {
      window.location.href = 'https://naverloginstart-6ieesxet3q-du.a.run.app';
    }, 1500);
  };

  const socialLoginButtons = [
    { label: 'Google', onClick: handleGoogleLogin },
    { label: '카카오', onClick: handleKakaoLogin },
    { label: '네이버', onClick: handleNaverLogin },
  ];

  return (
    <div className="lp-page" style={{ fontFamily: 'inherit', background: '#F5F0E8', overflowX: 'hidden' }}>

      <style>{`
        @media (max-width: 640px) {
          .hero-section {
            padding-bottom: 24px !important;
            min-height: auto !important;
          }
          .hero-login {
            margin-top: -8px !important;
            margin-bottom: 18px !important;
          }
          .hero-login-title {
            width: 100% !important;
            font-size: 13px !important;
          }
          .hero-login-button {
            flex: 1 1 calc(33.333% - 8px) !important;
            min-width: 72px !important;
            padding: 8px 10px !important;
            font-size: 13px !important;
          }
          .grape-animation-container {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
          }
          .next-section-after-hero {
            padding-top: 24px !important;
            margin-top: 0 !important;
          }
        }
      `}</style>

      {showBanner && (
        <>
          <style>{`
            @media (max-width: 640px) {
              .haru-tip-banner-icon {
                width: 28px !important;
                height: 28px !important;
                font-size: 14px !important;
              }
              .haru-tip-banner-title {
                font-size: 13px !important;
              }
              .haru-tip-banner-content {
                font-size: 12px !important;
                line-height: 1.4 !important;
              }
            }
          `}</style>
          <div
            style={{
              background: 'linear-gradient(90deg, #F5F0E8 0%, #EDE8DC 100%)',
              borderBottom: '1px solid #D8D1BC',
              padding: '14px 20px',
              paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              position: 'relative',
              zIndex: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                flex: 1,
                maxWidth: '900px',
                margin: '0 auto',
              }}
            >
              <div
                className="haru-tip-banner-icon"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#7A8B4E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 500,
                }}
              >
                ✦
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="haru-tip-banner-content"
                  style={{
                    color: '#4A5A2C',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    opacity: 0.85,
                  }}
                >
                  <div>
                    📱 스마트폰으로{' '}
                    <span style={{ color: '#7A8B4E', fontWeight: 600 }}>간편하게</span>{' '}
                    입력
                  </div>
                  <div>
                    💻 웹브라우저에서{' '}
                    <span style={{ color: '#7A8B4E', fontWeight: 600 }}>쓸모있게</span>{' '}
                    완성
                  </div>
                  <div style={{ marginTop: '4px', borderTop: '1px solid rgba(74,90,44,0.15)', paddingTop: '6px' }}>
                    🪶 나도작가 —{' '}
                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>기록을 바탕으로 글의 재료를 만듭니다</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseBanner}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#4A5A2C',
                  opacity: 0.5,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                  flexShrink: 0,
                  alignSelf: 'flex-start',
                }}
                aria-label="배너 닫기"
              >
                ×
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════
          섹션 1: 히어로
      ══════════════════════════════ */}
      <section className="hero-section" style={{ background: '#4A5A2C', color: '#F5F0E8', padding: '12px 24px', paddingTop: 'max(32px, env(safe-area-inset-top, 32px))', maxHeight: '100dvh', overflow: 'hidden' }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
        }}>
          {/* 왼쪽 텍스트 */}
          <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
            {/* 포도송이 로고 + 브랜드명 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <GrapeLogo />
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '1px' }}>HARU 2026</div>
                <div style={{ fontSize: '12px', opacity: 0.6, letterSpacing: '2px', textTransform: 'uppercase' }}>AI Life Platform</div>
              </div>
            </div>

            <h1 style={{ fontSize: 'clamp(26px, 5vw, 46px)', fontWeight: 800, lineHeight: 1.25, marginBottom: '16px' }}>
              기록을 모아,<br />삶의 도구로 바꿉니다
            </h1>
            <p style={{ fontSize: '17px', opacity: 0.8, lineHeight: 1.75, marginBottom: '32px' }}>
              목적별 형식으로 하루를 남기고<br />
              AI와 전문 데이터가 기록을 해석해<br />
              다시 꺼내 쓰는 자산으로 정리합니다
            </p>


            {/* 상단 소셜 로그인 */}
            <div
              className="hero-login"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                alignItems: 'center',
                maxWidth: '420px',
              }}
            >
              <span
                className="hero-login-title"
                style={{ fontSize: '13px', opacity: 0.72, marginRight: '4px', fontWeight: 600 }}
              >
                기존 회원은 바로 로그인하세요
              </span>
              {socialLoginButtons.map((button) => (
                <button
                  key={button.label}
                  type="button"
                  onClick={button.onClick}
                  disabled={isLoginLoading}
                  className="hero-login-button"
                  style={{
                    background: 'rgba(245,240,232,0.14)',
                    color: '#F5F0E8',
                    border: '1px solid rgba(245,240,232,0.18)',
                    borderRadius: '20px',
                    padding: '7px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isLoginLoading ? 'default' : 'pointer',
                    opacity: isLoginLoading ? 0.55 : 1,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>

          {/* 오른쪽 GrapeAnimation + HARU 타이틀 + 서브타이틀 */}
          <div className="grape-animation-container" style={{ flex: '1 1 260px', minWidth: '240px', textAlign: 'center' }}>
            <div style={{
              width: '100%',
              borderRadius: '24px',
              background: '#4A5A2C',
              padding: '8px 20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              {/* 포도송이 애니메이션 */}
              <GrapeAnimation />

              {/* HARU 타이틀 - 포도송이 바로 아래 바짝 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                marginTop: '-240px',
              }}>
                {['H', 'A', 'R', 'U'].map((letter, index) => (
                  <motion.span
                    key={index}
                    className="font-bold"
                    style={{
                      fontSize: 'clamp(40px, 8vw, 64px)',
                      backgroundImage: 'linear-gradient(135deg, #cc4400 0%, #ff6600 20%, #ffaa44 40%, #fff0dd 50%, #ffaa44 60%, #ff6600 80%, #cc4400 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      backgroundSize: '300% 100%',
                      filter: 'drop-shadow(0 0 8px rgba(255,102,0,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                    }}
                    initial={{ opacity: 0, y: 20, scale: 0.5 }}
                    animate={{ opacity: 1, y: 0, backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                    transition={{
                      opacity: { delay: 1.0 + index * 0.1, duration: 0.5 },
                      y: { delay: 1.0 + index * 0.1, duration: 0.5 },
                      backgroundPosition: { delay: 1.7 + index * 0.15, duration: 2.5, repeat: Infinity, repeatDelay: 1, ease: 'linear' },
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </div>

              {/* 서브타이틀 - HARU 바로 아래 바짝 */}
              <motion.p
                style={{
                  fontSize: 'clamp(13px, 2.2vw, 16px)',
                  color: '#F5F0E8',
                  opacity: 0.85,
                  marginTop: '-8px',
                  marginBottom: '0',
                  textAlign: 'center',
                  lineHeight: '1.5',
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0.85, y: 0 }}
                transition={{ delay: 2.5, duration: 0.6 }}
              >
                하루를{' '}
                <motion.span
                  className="font-semibold"
                  style={{ color: '#ff6600' }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ delay: 3.0, duration: 0.8 }}
                >
                  간편하게
                </motion.span>{' '}
                입력하고{' '}
                <motion.span
                  className="font-semibold"
                  style={{ color: '#ff6600' }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ delay: 3.5, duration: 0.8 }}
                >
                  쓸모있게
                </motion.span>{' '}
                남기고{' '}
                <motion.span
                  className="font-semibold"
                  style={{ color: '#ff6600' }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ delay: 4.0, duration: 0.8 }}
                >
                  다시 쓰는
                </motion.span>{' '}
                AI 라이프 플랫폼
              </motion.p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          섹션 2: 왜 기록인가? (뇌과학)
      ══════════════════════════════ */}
      <section className="next-section-after-hero" style={{ background: 'linear-gradient(160deg, #3F4F26 0%, #4A5A2C 100%)', padding: '72px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <span style={{
              border: '1px solid rgba(122,139,78,0.5)', color: '#7A8B4E',
              fontSize: '11px', letterSpacing: '3px', padding: '5px 18px', borderRadius: '20px'
            }}>
              BRAIN SCIENCE × DAILY RECORD
            </span>
          </div>
          <h2 style={{ color: '#F5F0E8', fontSize: 'clamp(22px,4vw,36px)', textAlign: 'center', fontWeight: 400, margin: '0 0 8px' }}>
            왜 <em style={{ color: '#7A8B4E' }}>기록</em>인가?
          </h2>
          <p style={{ color: 'rgba(250,249,246,0.5)', textAlign: 'center', fontSize: '14px', marginBottom: '40px' }}>
            세계적인 연구자들이 임상으로 입증한 기록의 과학
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '36px' }}>
            {[
              { emoji: '✍️', name: '페니베이커 박사', role: '임상심리학자', quote: '하루 15분, 감정을 글로 쓰는 것만으로 스트레스 호르몬이 감소한다' },
              { emoji: '💚', name: '맥크러티 박사', role: 'HeartMath 연구소', quote: '감사 일기는 심박·혈압·호흡을 동기화하여 신체를 최적 상태로 만든다' },
            ].map((r, i) => (
              <div key={i} style={{
                background: 'rgba(250,249,246,0.04)',
                border: '1px solid rgba(250,249,246,0.1)',
                borderRadius: '14px', padding: '22px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{
                    fontSize: '22px', background: 'rgba(122,139,78,0.1)',
                    borderRadius: '10px', width: '44px', height: '44px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {r.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#F5F0E8', fontSize: '16px', fontWeight: 700 }}>{r.name}</span>
                      <span style={{ color: '#7A8B4E', fontSize: '11px', background: 'rgba(122,139,78,0.1)', padding: '2px 10px', borderRadius: '10px' }}>{r.role}</span>
                    </div>
                    <blockquote style={{
                      margin: 0, color: 'rgba(250,249,246,0.8)', fontSize: '14px',
                      lineHeight: 1.8, fontStyle: 'italic',
                      borderLeft: '2px solid rgba(122,139,78,0.4)', paddingLeft: '12px'
                    }}>
                      "{r.quote}"
                    </blockquote>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{
            background: 'rgba(122,139,78,0.06)',
            border: '1px solid rgba(122,139,78,0.15)',
            borderRadius: '14px', padding: '28px', textAlign: 'center'
          }}>
            <p style={{ color: 'rgba(250,249,246,0.75)', fontSize: '15px', lineHeight: 1.9, margin: 0 }}>
              기록은 단순한 메모가 아닙니다.<br />
              감정을 객관화하고, 삶을 데이터로 편집하는<br />
              <strong style={{ color: '#F5F0E8' }}>'인지 재구조화'</strong> 전략입니다.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          섹션 3: 주요 기능 카드
      ══════════════════════════════ */}
      <section style={{ background: '#fff', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#4A5A2C', marginBottom: '8px' }}>
            HARU가 기록을 다루는 방식
          </h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            입력, 해석, 축적, 활용이 한 흐름으로 이어집니다
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center' }}>
            {[
              { img: IMAGES.feature_record, title: '목적별 기록 하네스', desc: '일상, 업무, 독서, 자산, 법률 질문까지 목적에 맞는 형식으로 남깁니다' },
              { img: IMAGES.feature_sayu,   title: 'SAYU와 사실 기반 정리', desc: '원문 사실과 감정을 보존하며 문장을 다듬고, 기록을 검색·분류 가능한 자산으로 만듭니다' },
              { img: IMAGES.feature_stats,  title: '통계·합본·AI 비서실', desc: '쌓인 기록을 통계와 리포트로 묶고, 법률·건강·학습·자산 비서가 다시 활용합니다' },
            ].map((card) => (
              <div key={card.title} style={{
                flex: '1 1 280px', maxWidth: '340px',
                background: '#F5F0E8', borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden',
              }}>
                <img src={card.img} alt={card.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                <div style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#4A5A2C', marginBottom: '8px' }}>{card.title}</h3>
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
      <section style={{ background: '#EDE8DC', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'left', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#4A5A2C', marginBottom: '8px' }}>
            SAYU(사유:思惟)는 글을 대신 쓰는 기능이 아니라,<br />당신의 기록을 보존하며 정리하는 해석 공간입니다.
          </h2>
          <p style={{ textAlign: 'left', color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            사실은 지키고, 문장은 다듬고, 나중에 다시 꺼내 쓸 수 있게 남깁니다.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center' }}>

            {/* BASIC */}
            <div style={{
              flex: '1 1 280px', maxWidth: '480px',
              background: '#4A5A2C', color: '#F5F0E8',
              borderRadius: '20px', overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(74,90,44,0.25)',
            }}>
              <img src={IMAGES.sayu_premium} alt="SAYU BASIC" style={{ width: '100%', height: '200px', objectFit: 'cover', opacity: 0.85 }} />
              <div style={{ padding: '24px' }}>
                <span style={{
                  display: 'inline-block',
                  background: '#7A8B4E', color: '#fff',
                  borderRadius: '20px', padding: '3px 12px',
                  fontSize: '12px', fontWeight: 700, marginBottom: '12px',
                }}>
                  SAYU BASIC
                </span>
                <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px' }}>원문 보존 다듬기</h3>
                <p style={{ fontSize: '15px', opacity: 0.8, lineHeight: 1.7 }}>
                  사용자가 쓴 사건과 감정을 지키면서 문장을 자연스럽게 정리합니다
                </p>
              </div>
            </div>

            {/* PREMIUM */}
            <div style={{
              flex: '1 1 280px', maxWidth: '480px',
              background: '#fff', borderRadius: '20px', overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0,0,0,0.10)',
              border: '2px solid #7A8B4E',
            }}>
              <img src={IMAGES.sayu_premium} alt="SAYU PREMIUM" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
              <div style={{ padding: '24px' }}>
                <span style={{
                  display: 'inline-block',
                  background: '#4A5A2C', color: '#fff',
                  borderRadius: '20px', padding: '3px 12px',
                  fontSize: '12px', fontWeight: 700, marginBottom: '12px',
                }}>
                  SAYU PREMIUM
                </span>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#4A5A2C', marginBottom: '10px' }}>누적 기록 해석</h3>
                <p style={{ fontSize: '15px', color: '#444', lineHeight: 1.7 }}>
                  기록의 흐름을 요약하고 사유 질문을 더해 장기 자산으로 남깁니다
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          섹션 5: 목적별 기록 형식 그리드
      ══════════════════════════════ */}
      <section style={{ background: '#F5F0E8', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#4A5A2C', marginBottom: '8px' }}>
            목적별 기록 형식
          </h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            생활·업무·자산·전문 영역을 한 곳에 모읍니다
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
              const isAsset = f.category === '자산';
              const isSpecial = f.category === '전문';
              return (
                <div key={f.name} style={{
                  background: isLife ? '#E8E8C0' : isAsset ? '#DDE8E5' : isSpecial ? '#E8E1D6' : '#E5DFE8',
                  borderRadius: '12px', padding: '18px 10px',
                  textAlign: 'center', position: 'relative',
                  border: f.badge ? '2px solid #7A8B4E' : `1px solid ${isLife ? '#D4DEA0' : isAsset ? '#BFD4CE' : isSpecial ? '#D6C7B6' : '#C9C0DE'}`,
                }}>
                  {f.badge && (
                    <span style={{
                      position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                      background: '#7A8B4E', color: '#fff',
                      borderRadius: '10px', padding: '2px 8px',
                      fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {f.badge}
                    </span>
                  )}
                  <div style={{ fontSize: '26px', marginBottom: '6px' }}>{f.emoji}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: isLife ? '#4A5A2C' : isAsset ? '#2E5B55' : isSpecial ? '#735538' : '#5C5078' }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '3px', color: isLife ? '#7A8B4E' : isAsset ? '#4B8078' : isSpecial ? '#9A7042' : '#7A6F8E', fontWeight: 600 }}>
                    {f.category}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          섹션 5-1: HARU의 날개 — AI 비서실 (v2 홈과 동기화)
      ══════════════════════════════ */}
      <section style={{ background: '#3F4F26', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <span style={{
              border: '1px solid rgba(122,139,78,0.4)', color: '#7A8B4E',
              fontSize: '11px', letterSpacing: '3px', padding: '5px 18px', borderRadius: '20px'
            }}>
              HARU EXCLUSIVE · AI LIFE ASSISTANTS
            </span>
          </div>
          <h2 style={{
            textAlign: 'center', fontSize: 'clamp(26px,5vw,44px)',
            fontWeight: 800, color: '#F5F0E8', margin: '12px 0 8px', letterSpacing: '-0.5px'
          }}>
            🪶 HARU의 날개
          </h2>
          <p style={{
            textAlign: 'center', color: 'rgba(250,249,246,0.65)',
            fontSize: '16px', lineHeight: 1.7, marginBottom: '56px',
            maxWidth: '640px', margin: '0 auto 56px',
          }}>
            기록을 바탕으로 법률·건강·학습·자산·창작 영역까지<br />
            <strong style={{ color: '#7A8B4E', fontWeight: 700 }}>전문 AI 비서실</strong>이 함께합니다
          </p>
          <div className="agents-8" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px',
          }}>
            {[
              { emoji: '🔮', title: 'HARU미래전망', sub: 'DAILY ORACLE',  desc: '오늘의 한 줄 기록이 모여 당신의 미래를 전망합니다.',                              color: '#a78bfa' },
              { emoji: '⚖️', title: '하루LAW',      sub: 'LAW · 판례',    desc: '법령·판례를 정부 데이터 그대로, 풀이는 AI가 쉬운 말로 풀어드립니다. 환각 제로.', color: '#f59e0b' },
              { emoji: '📖', title: '영어성경',     sub: 'BIBLE',         desc: '영어·영한·한영 듣기·말하기·해석·단어·문법을 한 번에 — 영어성경 학습의 결정판', color: '#38bdf8' },
              { emoji: '🌐', title: '영어일기',     sub: 'EN DIARY',      desc: '내가 기록한 일기와 에세이로 자연스러운 영작 학습',                                color: '#7A8B4E' },
              { emoji: '📥', title: 'SNS가져오기',  sub: 'IMPORT',        desc: '페이스북과 인스타그램의 추억들을 입맛대로 정렬하고 나만의 책으로 출간해 드립니다.', color: '#ec4899' },
              { emoji: '📈', title: 'HARU주식',     sub: 'MARKET',        desc: '내가 매도·매수한 종목 기록을 모아 투자 흐름을 점검합니다.',                  color: '#22d3ee' },
              { emoji: '🌿', title: '원기충전소',   sub: 'RECOVERY',      desc: '오늘 컨디션을 기록하면 AI가 맞춤 회복 루틴을 처방해드립니다.',                    color: '#84cc16' },
              { emoji: '🏠', title: '온비드 부동산', sub: 'BID · 부동산', desc: '온비드 공매 부동산을 한눈에 — 입찰 일정·최저가·소재지까지 검색.',                color: '#a78bfa', beta: true },
              { emoji: '💚', title: 'HARU건강관리', sub: 'CARE · 건강',  desc: '명의찾기 · 약봉지 약정보 · 건강 인포그래픽 — HARU와 함께 챙기는 건강.',          color: '#10b981', beta: true },
              { emoji: '✍️', title: '나도작가',     sub: 'WRITE · 창작', desc: 'AI와 함께 글쓰기 — 시놉시스부터 단편소설까지 손쉽게 완성합니다.',                color: '#f97316' },
              { emoji: '✨', title: '새 비서 예정', sub: 'COMING SOON',  desc: '곧 새로운 동료가 합류합니다.',                                                    color: '#888780', placeholder: true },
            ].map((a) => (
              <div key={a.title} style={{
                background: a.placeholder
                  ? 'rgba(255,255,255,0.03)'
                  : `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, ${a.color}1f 100%)`,
                border: `1.5px solid ${a.color}44`,
                borderRadius: '18px', padding: '28px 22px',
                position: 'relative', overflow: 'hidden',
                opacity: a.placeholder ? 0.72 : 1,
              }}>
                <div style={{
                  position: 'absolute', top: '-20px', right: '-20px',
                  width: '90px', height: '90px', borderRadius: '50%',
                  background: `radial-gradient(circle, ${a.color}26 0%, transparent 70%)`,
                  pointerEvents: 'none',
                }} />
                {a.beta && (
                  <span style={{
                    position: 'absolute', top: '12px', right: '12px',
                    background: '#1A3C6E', color: '#fff',
                    fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px',
                    padding: '3px 8px', borderRadius: '999px', zIndex: 2,
                  }}>
                    BETA
                  </span>
                )}
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>{a.emoji}</div>
                <span style={{
                  background: `${a.color}26`, color: a.color,
                  fontSize: '10px', fontWeight: 700, padding: '3px 9px',
                  borderRadius: '10px', letterSpacing: '1px',
                }}>
                  {a.sub}
                </span>
                <h3 style={{
                  fontSize: '18px', fontWeight: 800, color: '#F5F0E8',
                  margin: '10px 0 8px',
                }}>
                  {a.title}
                </h3>
                <p style={{
                  fontSize: '13px', color: 'rgba(250,249,246,0.62)',
                  lineHeight: 1.7, margin: 0,
                }}>
                  {a.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          섹션 5-2: 구독 요금 — LIGHT/PREMIUM + 7일 무료 체험
          ⚠️ 2026-05-13 임시 비노출 (모두의 창업 신청서 D-2)
          복원: 아래 false → true 로 변경 또는 VITE_SHOW_PRICING=true 설정
      ══════════════════════════════ */}
      {(import.meta.env.VITE_SHOW_PRICING === 'true' || false) && (
      <section style={{ background: '#EDE8DC', padding: '72px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
          {/* 7일 무료 체험 배너 */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: '#7A8B4E', color: '#fff',
            borderRadius: '999px', padding: '8px 20px',
            fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px',
            boxShadow: '0 8px 24px -8px rgba(122,139,78,0.55)',
            marginBottom: '18px',
          }}>
            <span style={{ fontSize: '14px' }}>🎁</span>
            지금 가입하면{' '}
            <span style={{ background: 'rgba(255,255,255,0.22)', padding: '2px 8px', borderRadius: '999px' }}>
              7일 무료 체험
            </span>
          </div>

          <h2 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 800, color: '#4A5A2C', marginBottom: '8px' }}>
            구독 요금 안내
          </h2>
          <p style={{ color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            하루의 기록이 쌓여 인생의 빅데이터가 됩니다
          </p>

          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              {
                plan: 'LIGHT', price: '₩4,000', period: '/월',
                note: '목적별 기록 + SAYU BASIC + AI 비서 월 10회',
                bullets: ['목적별 기록 형식', 'SAYU BASIC 다듬기', '통계·합본'],
                highlight: false,
              },
              {
                plan: 'PREMIUM', price: '₩5,000', period: '/월',
                note: '라이트 전체 + AI 비서 일 2회 / 월 40회',
                bullets: ['LIGHT 모든 기능', '전문 AI 비서실', 'SAYU PREMIUM (Gemini)'],
                highlight: true,
                badge: 'RECOMMENDED',
              },
            ].map((p) => (
              <div key={p.plan} style={{
                flex: '1 1 240px', maxWidth: '320px', position: 'relative',
                background: p.highlight ? '#4A5A2C' : '#fff',
                border: p.highlight ? 'none' : '2px solid #E5DFD0',
                borderRadius: '20px', padding: '36px 28px',
                boxShadow: p.highlight ? '0 12px 40px rgba(74,90,44,0.25)' : '0 4px 16px rgba(0,0,0,0.06)',
                textAlign: 'left',
              }}>
                {p.badge && (
                  <span style={{
                    position: 'absolute', top: '-12px', right: '20px',
                    background: '#7A8B4E', color: '#fff',
                    fontSize: '10px', fontWeight: 800, letterSpacing: '1.5px',
                    padding: '4px 10px', borderRadius: '999px',
                  }}>
                    {p.badge}
                  </span>
                )}
                <p style={{
                  color: p.highlight ? '#7A8B4E' : '#4A5A2C',
                  fontSize: '13px', fontWeight: 800, margin: '0 0 12px', letterSpacing: '2px',
                }}>
                  {p.plan}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                  <span style={{ color: p.highlight ? '#F5F0E8' : '#4A5A2C', fontSize: '40px', fontWeight: 800 }}>{p.price}</span>
                  <span style={{ color: p.highlight ? 'rgba(250,249,246,0.55)' : '#999', fontSize: '14px' }}>{p.period}</span>
                </div>
                <p style={{ color: p.highlight ? 'rgba(250,249,246,0.6)' : '#888', fontSize: '12px', margin: '0 0 20px' }}>{p.note}</p>
                <ul style={{
                  listStyle: 'none', padding: 0, margin: '0 0 22px',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  {p.bullets.map((b) => (
                    <li key={b} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      color: p.highlight ? 'rgba(250,249,246,0.85)' : '#444', fontSize: '13px',
                    }}>
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: p.highlight ? 'rgba(122,139,78,0.25)' : '#d1fae5',
                        color: '#7A8B4E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 800, flexShrink: 0,
                      }}>✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={goToLogin}
                  style={{
                    background: p.highlight ? '#7A8B4E' : '#4A5A2C',
                    color: '#fff', border: 'none',
                    borderRadius: '50px', padding: '12px 0',
                    fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer', width: '100%',
                  }}
                >
                  7일 무료 체험 시작
                </button>
              </div>
            ))}
          </div>

          <p style={{ color: '#888', fontSize: '12px', marginTop: '20px' }}>
            7일 체험 기간 중 언제든 해지 가능 · 결제는 체험 종료 후 시작됩니다
          </p>
        </div>
      </section>
      )}

      {/* ══════════════════════════════
          섹션 6: 하단 CTA
      ══════════════════════════════ */}
      <section className="lp-cta" style={{ background: '#4A5A2C', color: '#F5F0E8', padding: '64px 24px' }}>
        <div className="lp-cta-wrap" style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: '32px',
        }}>
          {/* 왼쪽 텍스트 */}
          <div className="lp-cta-text" style={{ flex: '1 1 280px' }}>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, marginBottom: '12px' }}>
              지금 바로 하루를 기록해보세요
            </h2>
            <p style={{ fontSize: '16px', opacity: 0.75 }}>
              Google · 카카오 · 네이버 소셜 로그인으로 30초면 시작
            </p>
          </div>
          {/* 오른쪽 버튼 */}
          <div className="lp-cta-btn">
            <button
              onClick={goToLogin}
              style={{
                background: '#7A8B4E', color: '#fff', border: 'none',
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

      {/* 반응형: 모바일 / 태블릿 / 데스크톱 3-tier */}
      <style>{`
        /* ─── 태블릿 (641-1024px) ─── */
        @media (min-width: 641px) and (max-width: 1024px) {
          .agents-8     { grid-template-columns: repeat(2, 1fr) !important; }
          .format-grid  { grid-template-columns: repeat(5, 1fr) !important; }
        }

        /* ─── 모바일 (≤640px) ─── */
        @media (max-width: 640px) {
          /* 그리드: 2열 */
          .format-grid  { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .agents-8     { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }

          /* Hero 제약 해제 + 패딩 축소 (노치 영역 보호 유지) */
          .lp-page .hero-section {
            max-height: none !important;
            overflow: visible !important;
            padding: 16px 18px 32px !important;
            padding-top: max(16px, env(safe-area-inset-top, 16px)) !important;
          }

          /* 모든 일반 섹션 패딩 축소 (Hero·CTA·안내 배너 제외) */
          .lp-page > section:not(.hero-section):not(.lp-cta) {
            padding-top: 48px !important;
            padding-bottom: 48px !important;
            padding-left: 18px !important;
            padding-right: 18px !important;
          }

          /* 하단 CTA: 텍스트 + 버튼 가운데 세로 배치 */
          .lp-cta { padding: 48px 18px !important; }
          .lp-cta-wrap { flex-direction: column !important; text-align: center !important; gap: 20px !important; }
          .lp-cta-btn { width: 100% !important; }
          .lp-cta-btn button { width: 100% !important; padding: 14px 0 !important; font-size: 16px !important; }

          /* 박사 인용 / SAYU / 기능 카드 패딩 미세 축소 */
          .lp-page blockquote { font-size: 13px !important; padding-left: 10px !important; }
        }
      `}</style>

    </div>
  );
}
