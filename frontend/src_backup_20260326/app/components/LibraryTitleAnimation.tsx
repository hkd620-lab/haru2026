import { motion, useAnimation } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const chars = ['서', '재'];

export function LibraryTitleAnimation() {
  const shimmerControls = useAnimation();
  const [animationDone, setAnimationDone] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const totalDuration = 0.3 + chars.length * 0.2 + 0.65;
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
          setTimeout(runShimmer, 5000);
        }
      };
      setTimeout(runShimmer, 200);
    }, totalDuration * 1000);

    return () => clearTimeout(timer);
  }, [shimmerControls]);

  return (
    <div className="flex flex-col gap-1">
      {/* Title row */}
      <div className="flex items-center gap-3">
        {/* BookOpen 아이콘 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6, rotate: -15 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{
            delay: 0.1,
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1A3C6E"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </motion.div>

        {/* 서재 글자 */}
        <div
          className="relative flex items-center overflow-hidden"
          style={{ paddingBottom: '2px' }}
        >
          {chars.map((char, i) => (
            <motion.span
              key={char + i}
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)', scale: 0.88 }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
              transition={{
                delay: 0.3 + i * 0.2,
                duration: 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                display: 'inline-block',
                fontSize: 'clamp(1.5rem, 5vw, 1.875rem)',
                letterSpacing: '0.08em',
                color: '#1A3C6E',
                lineHeight: 1.2,
              }}
            >
              {char}
            </motion.span>
          ))}

          {/* Shimmer sweep */}
          {animationDone && (
            <motion.span
              animate={shimmerControls}
              initial={{ x: '-100%' }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '50%',
                height: '100%',
                background:
                  'linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.65) 50%, transparent 75%)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          )}
        </div>
      </div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          delay: 0.85,
          duration: 0.7,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ fontSize: '0.875rem', color: '#666666', margin: 0 }}
      >
        오늘의 기록을 작성하세요
      </motion.p>
    </div>
  );
}