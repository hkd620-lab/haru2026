import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

interface GrapePosition {
  x: number;
  y: number;
  icon: string;
  label: string;
}

const grapeLayout: GrapePosition[] = [
  { x: -117, y: -140, icon: 'diary', label: '일기' },
  { x: -39, y: -140, icon: 'essay', label: '에세이' },
  { x: 39, y: -140, icon: 'garden', label: '텃밭' },
  { x: 117, y: -140, icon: 'memo', label: '메모' },
  { x: -78, y: -55, icon: 'pet', label: '애완동물' },
  { x: 0, y: -55, icon: 'parenting', label: '육아일기' },
  { x: 78, y: -55, icon: 'travel', label: '여행기록' },
  { x: -39, y: 30, icon: 'mission', label: '선교보고' },
  { x: 39, y: 30, icon: 'report', label: '일반보고' },
  { x: 0, y: 115, icon: 'work', label: '업무일지' },
];

export default function HaruLogo() {
  const location = useLocation();
  const [animationKey, setAnimationKey] = useState(0);

  const getRandomPosition = () => ({
    x: (Math.random() - 0.5) * 600,
    y: (Math.random() - 0.5) * 600,
    opacity: Math.random() * 0.5 + 0.5,
    scale: Math.random() * 0.2 + 0.8,
  });

  useEffect(() => {
    setAnimationKey(prevKey => prevKey + 1);
  }, [location.pathname]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
      <motion.svg
        key={animationKey}
        width="320"
        height="320"
        viewBox="-200 -200 400 400"
      >
        {grapeLayout.map((grape, index) => {
          const randomPos = getRandomPosition();
          return (
            <motion.g
              key={index}
              initial={{ x: randomPos.x, y: randomPos.y, opacity: 0, scale: randomPos.scale }}
              animate={{ x: grape.x, y: grape.y, opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: index * 0.06, ease: 'easeOut' }}
            >
              <circle cx="0" cy="0" r="35" fill="#1A3C6E" opacity="0.9" />
            </motion.g>
          );
        })}
      </motion.svg>
    </div>
  );
}
