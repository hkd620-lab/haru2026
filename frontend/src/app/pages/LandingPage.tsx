import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

const IMAGES = {
  hero: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/hero.png',
  feature_record: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/feature_record.png',
  feature_sayu: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/feature_sayu.png',
  feature_stats: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/feature_stats.png',
  sayu_premium: 'https://storage.googleapis.com/haru2026-8abb8.firebasestorage.app/landing/sayu_premium.png',
};

const FORMATS = [
  { name: '일기', emoji: '📔', category: '생활' },
  { name: '에세이', emoji: '✍️', category: '생활' },
  { name: '여행기록', emoji: '✈️', category: '생활' },
  { name: '텃밭일지', emoji: '🌱', category: '생활' },
  { name: '애완동물관찰일지', emoji: '🐾', category: '생활' },
  { name: '선교보고', emoji: '📋', category: '업무' },
  { name: '일반보고', emoji: '📊', category: '업무' },
  { name: '업무일지', emoji: '💼', category: '업무' },
  { name: '육아일기', emoji: '👶', category: '생활' },
  { name: '메모', emoji: '📝', category: '업무' },
];

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

  return (
    <div style={{ fontFamily: 'inherit', background: '#FAF9F6', overflowX: 'hidden' }}>

      {/* ── 히어로 섹션 ── */}
      <section style={{
        background: '#1A3C6E',
        color: '#FAF9F6',
        padding: '60px 24px',
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '40px',
        }}>
          {/* 왼쪽 텍스트 */}
          <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
            <div style={{ fontSize: '13px', letterSpacing: '2px', opacity: 0.7, marginBottom: '12px', textTransform: 'uppercase' }}>
              HARU 2026
            </div>
            <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.2, marginBottom: '20px' }}>
              간편하게 입력하고,<br />쓸모있게 남깁니다
            </h1>
            <p style={{ fontSize: '17px', opacity: 0.85, lineHeight: 1.7, marginBottom: '32px' }}>
              10가지 맞춤 형식으로 하루를 기록하고,<br />
              AI가 글을 더 멋지게 다듬어줍니다.
            </p>
            <button
              onClick={goToLogin}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 32px',
                fontSize: '17px',
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: '16px',
                display: 'block',
              }}
            >
              지금 시작하기 →
            </button>
            <p style={{ fontSize: '14px', opacity: 0.6 }}>
              Google · 카카오 · 네이버 소셜 로그인 지원
            </p>
          </div>

          {/* 오른쪽 이미지 */}
          <div style={{ flex: '1 1 300px', minWidth: '280px', textAlign: 'center' }}>
            <img
              src={IMAGES.hero}
              alt="HARU 일기 앱"
              style={{
                width: '100%',
                maxWidth: '440px',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            />
          </div>
        </div>
      </section>

      {/* ── 기능 소개 3카드 ── */}
      <section style={{ padding: '60px 24px', background: '#FAF9F6' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#1A3C6E', marginBottom: '8px' }}>
            HARU가 특별한 이유
          </h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            매일의 기록이 자산이 됩니다
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            justifyContent: 'center',
          }}>
            {[
              {
                img: IMAGES.feature_record,
                title: '10가지 기록 형식',
                desc: '일기부터 업무일지까지, 상황에 맞는 맞춤 형식으로 빠르게 입력하세요.',
              },
              {
                img: IMAGES.feature_sayu,
                title: 'SAYU(사유) 다듬기',
                desc: 'AI가 내 글을 더 풍부하고 멋지게 다듬어 줍니다. 내 목소리는 그대로.',
              },
              {
                img: IMAGES.feature_stats,
                title: '통계 & 기록합치기',
                desc: '나의 기록 패턴을 한눈에 확인하고, 형식별 기록을 PDF로 합쳐 보세요.',
              },
            ].map((card) => (
              <div
                key={card.title}
                style={{
                  flex: '1 1 280px',
                  maxWidth: '340px',
                  background: '#fff',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={card.img}
                  alt={card.title}
                  style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                />
                <div style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1A3C6E', marginBottom: '8px' }}>
                    {card.title}
                  </h3>
                  <p style={{ fontSize: '15px', color: '#555', lineHeight: 1.6 }}>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SAYU 섹션 ── */}
      <section style={{ padding: '60px 24px', background: '#f0f4ff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#1A3C6E', marginBottom: '8px' }}>
            SAYU(사유)란?
          </h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            AI가 내 기록을 한 단계 끌어올려 줍니다
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            justifyContent: 'center',
          }}>
            {/* BASIC */}
            <div style={{
              flex: '1 1 280px',
              maxWidth: '480px',
              background: '#1A3C6E',
              color: '#FAF9F6',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(26,60,110,0.25)',
            }}>
              <img src={IMAGES.sayu_premium} alt="SAYU BASIC" style={{ width: '100%', height: '200px', objectFit: 'cover', opacity: 0.85 }} />
              <div style={{ padding: '24px' }}>
                <div style={{ fontSize: '12px', letterSpacing: '2px', opacity: 0.7, marginBottom: '8px' }}>FREE</div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px' }}>SAYU BASIC</h3>
                <ul style={{ fontSize: '15px', lineHeight: 2, paddingLeft: '0', listStyle: 'none' }}>
                  <li>✅ AI 글 다듬기 (월 10회)</li>
                  <li>✅ 기본 10가지 형식 기록</li>
                  <li>✅ 캘린더 기록 확인</li>
                  <li>✅ 기록 합치기 & PDF 내보내기</li>
                </ul>
              </div>
            </div>

            {/* PREMIUM */}
            <div style={{
              flex: '1 1 280px',
              maxWidth: '480px',
              background: '#fff',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
              border: '2px solid #10b981',
            }}>
              <img src={IMAGES.sayu_premium} alt="SAYU PREMIUM" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
              <div style={{ padding: '24px' }}>
                <div style={{ fontSize: '12px', letterSpacing: '2px', color: '#10b981', fontWeight: 700, marginBottom: '8px' }}>PREMIUM</div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#1A3C6E', marginBottom: '12px' }}>SAYU PREMIUM</h3>
                <ul style={{ fontSize: '15px', lineHeight: 2, paddingLeft: '0', listStyle: 'none', color: '#333' }}>
                  <li>✅ AI 글 다듬기 <strong>무제한</strong></li>
                  <li>✅ 형식별 통계 상세 분석</li>
                  <li>✅ 기록 원본 탭 편집 기능</li>
                  <li>✅ 우선 고객 지원</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 기록 형식 10개 그리드 ── */}
      <section style={{ padding: '60px 24px', background: '#FAF9F6' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#1A3C6E', marginBottom: '8px' }}>
            10가지 기록 형식
          </h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '16px', marginBottom: '40px' }}>
            상황에 맞는 형식을 선택해 바로 기록하세요
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '16px',
          }}>
            {FORMATS.map((f) => (
              <div
                key={f.name}
                style={{
                  background: f.category === '생활' ? '#e8f5e9' : '#e3f0ff',
                  borderRadius: '12px',
                  padding: '20px 12px',
                  textAlign: 'center',
                  border: `1px solid ${f.category === '생활' ? '#a5d6a7' : '#90caf9'}`,
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{f.emoji}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: f.category === '생활' ? '#2e7d32' : '#1565c0' }}>
                  {f.name}
                </div>
                <div style={{
                  fontSize: '11px',
                  marginTop: '4px',
                  color: f.category === '생활' ? '#4caf50' : '#2196f3',
                  fontWeight: 600,
                }}>
                  {f.category}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 하단 CTA 바 ── */}
      <section style={{
        background: '#1A3C6E',
        color: '#FAF9F6',
        padding: '56px 24px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, marginBottom: '12px' }}>
          지금 바로 하루를 기록해보세요
        </h2>
        <p style={{ fontSize: '17px', opacity: 0.8, marginBottom: '32px' }}>
          무료로 시작하고, 언제든지 업그레이드하세요
        </p>
        <button
          onClick={goToLogin}
          style={{
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '16px 48px',
            fontSize: '18px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          무료로 시작하기 →
        </button>
        <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '20px' }}>
          Google · 카카오 · 네이버 소셜 로그인 지원
        </p>
      </section>

    </div>
  );
}
