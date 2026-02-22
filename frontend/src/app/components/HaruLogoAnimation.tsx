import { motion, useAnimation } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const haruLetters = ['H', 'A', 'R', 'U'];
const joyel = 'by JOYEL';

export function HaruLogoAnimation() {
  const shimmerControls = useAnimation();
  const [animationDone, setAnimationDone] = useState(false);
  const [visibleJoyelCount, setVisibleJoyelCount] = useState(0);
  const [showCursor, setShowCursor] = useState(false);
  const [cursorBlink, setCursorBlink] = useState(true);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // HARU shimmer 반복
  useEffect(() => {
    const totalLetterDuration = 0.15 * haruLetters.length + 0.65 + 0.2;
    const timer = setTimeout(() => {
      if (!isMounted.current) return;
      setAnimationDone(true);

      const runShimmer = async () => {
        if (!isMounted.current) return;
        await shimmerControls.start({
          x: ['-100%', '220%'],
          transition: { duration: 1.1, ease: 'easeInOut' },
        });
        if (isMounted.current) {
          setTimeout(runShimmer, 4500);
        }
      };
      setTimeout(runShimmer, 400);
    }, totalLetterDuration * 1000);

    return () => clearTimeout(timer);
  }, [shimmerControls]);

  // by JOYEL 타이프라이터
  useEffect(() => {
    const startDelay = 1350; // HARU 끝나고 시작
    const charInterval = 80;  // 한 글자 간격

    const startTimer = setTimeout(() => {
      if (!isMounted.current) return;
      setShowCursor(true);

      let idx = 0;
      const interval = setInterval(() => {
        if (!isMounted.current) { clearInterval(interval); return; }
        idx += 1;
        setVisibleJoyelCount(idx);
        if (idx >= joyel.length) {
          clearInterval(interval);
          // 커서 깜빡임 시작
          let blink = true;
          const blinkInterval = setInterval(() => {
            if (!isMounted.current) { clearInterval(blinkInterval); return; }
            blink = !blink;
            setCursorBlink(blink);
          }, 530);
          // 5초 후 커서 숨김
          setTimeout(() => {
            if (!isMounted.current) return;
            setShowCursor(false);
            clearInterval(blinkInterval);
          }, 5000);
        }
      }, charInterval);
    }, startDelay);

    return () => clearTimeout(startTimer);
  }, []);

  return (
    <div className="flex flex-col items-center select-none">
      {/* ── HARU : 위에서 낙하 + 스프링 바운스 ── */}
      <div
        className="relative flex items-end overflow-hidden"
        style={{ gap: '0.08em', paddingBottom: '4px' }}
      >
        {haruLetters.map((letter, i) => (
          <motion.span
            key={letter}
            initial={{ opacity: 0, y: -44, scale: 1.2, rotateX: -35 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            transition={{
              delay: 0.2 + i * 0.15,
              duration: 0.65,
              ease: [0.34, 1.56, 0.64, 1], // spring overshoot
            }}
            style={{
              display: 'inline-block',
              fontSize: 'clamp(3rem, 12vw, 4.5rem)',
              letterSpacing: '0.22em',
              color: '#1A3C6E',
              fontFamily: 'Georgia, serif',
              lineHeight: 1,
              transformOrigin: 'top center',
            }}
          >
            {letter}
          </motion.span>
        ))}

        {/* Shimmer overlay */}
        {animationDone && (
          <motion.span
            animate={shimmerControls}
            initial={{ x: '-100%' }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '45%',
              height: '100%',
              background:
                'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}
      </div>

      {/* ── by JOYEL : 타이프라이터 ── */}
      <div
        style={{
          fontSize: '0.72rem',
          color: '#999999',
          marginTop: '2px',
          fontFamily: 'Georgia, serif',
          letterSpacing: '0.18em',
          minHeight: '1em',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span>{joyel.slice(0, visibleJoyelCount)}</span>
        {showCursor && (
          <span
            style={{
              display: 'inline-block',
              width: '1px',
              height: '0.85em',
              backgroundColor: '#999999',
              marginLeft: '1px',
              opacity: cursorBlink ? 1 : 0,
              transition: 'opacity 0.1s',
              verticalAlign: 'middle',
            }}
          />
        )}
      </div>

      {/* Underline decoration */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{
          delay: 2.2,
          duration: 0.8,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          marginTop: '14px',
          height: '1px',
          width: '48px',
          background: 'linear-gradient(90deg, transparent, #1A3C6E, transparent)',
          transformOrigin: 'center',
        }}
      />
    </div>
  );
}
