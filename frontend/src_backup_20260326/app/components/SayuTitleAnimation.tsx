import { motion, useAnimation } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const chars = ['S', 'A', 'Y', 'U'];

export function SayuTitleAnimation() {
  const shimmerControls = useAnimation();
  const [animationDone, setAnimationDone] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const totalDuration = 0.25 + chars.length * 0.17 + 0.65;
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
        {/* Sparkles 아이콘 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{
            delay: 0.1,
            duration: 0.7,
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
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            <path d="M20 3v4" />
            <path d="M22 5h-4" />
            <path d="M4 17v2" />
            <path d="M5 18H3" />
          </svg>
        </motion.div>

        {/* S A Y U 글자 */}
        <div
          className="relative flex items-center overflow-hidden"
          style={{ paddingBottom: '2px' }}
        >
          {chars.map((char, i) => (
            <motion.span
              key={char + i}
              initial={{ opacity: 0, y: 22, filter: 'blur(8px)', scale: 0.88 }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
              transition={{
                delay: 0.25 + i * 0.17,
                duration: 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                display: 'inline-block',
                fontSize: 'clamp(1.5rem, 5vw, 1.875rem)',
                letterSpacing: '0.1em',
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
          delay: 1.0,
          duration: 0.7,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ fontSize: '0.875rem', color: '#666666', margin: 0 }}
      >
        다듬어진 기록을 확인하고 최종 편집하세요
      </motion.p>
    </div>
  );
}
