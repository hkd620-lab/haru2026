import { useEffect } from 'react';

export function LibraryTitleAnimation() {
  useEffect(() => {
    const linkId = 'haru-playfair-font';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div style={{ width: '100%', textAlign: 'center', padding: '32px 16px 28px', backgroundColor: '#FAF9F6' }}>
      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(52px, 12vw, 88px)', fontWeight: 400, letterSpacing: '0.18em', color: '#1A3C6E', margin: 0, lineHeight: 1 }}>
        HARU
      </h1>
      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '13px', letterSpacing: '0.22em', color: '#1A3C6E', opacity: 0.75, margin: '10px 0 0 0' }}>
        by JOYEL
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px auto 0', gap: '6px' }}>
        <div style={{ width: '40px', height: '1px', backgroundColor: '#1A3C6E', opacity: 0.3 }} />
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#1A3C6E', opacity: 0.4 }} />
        <div style={{ width: '40px', height: '1px', backgroundColor: '#1A3C6E', opacity: 0.3 }} />
      </div>
      <div style={{ width: '100%', height: '1px', backgroundColor: '#1A3C6E', opacity: 0.1, margin: '20px 0 18px' }} />
      <p style={{ fontSize: 'clamp(15px, 3.5vw, 19px)', fontWeight: 700, color: '#1A3C6E', margin: '0 0 8px 0', lineHeight: 1.4 }}>
        간편하게 입력하고, 쓸모있게 남깁니다
      </p>
      <p style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', color: '#888888', margin: 0 }}>
        감성적인 일기장이 아닌, 체계적인 기록 도구
      </p>
    </div>
  );
}
