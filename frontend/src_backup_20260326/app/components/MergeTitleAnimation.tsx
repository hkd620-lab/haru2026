import { motion, useAnimation } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const chars = ['기', '록', '합', '치', '기'];

export function MergeTitleAnimation() {
  const shimmerControls = useAnimation();
  const [animationDone, setAnimationDone] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const totalDuration = 0.2 + chars.length * 0.14 + 0.65;
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
        {/* Layers 아이콘 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            delay: 0.1,
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1A3C6E"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
            <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
            <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
          </svg>
        </motion.div>

        {/* 기록합치기 글자 */}
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
                delay: 0.2 + i * 0.14,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                display: 'inline-block',
                fontSize: 'clamp(1.35rem, 4.5vw, 1.75rem)',
                letterSpacing: '0.06em',
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
                width: '40%',
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
          delay: 1.05,
          duration: 0.65,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}
      >
        SAYU 별점 기준으로 기록을 합칩니다
      </motion.p>
    </div>
  );
}
