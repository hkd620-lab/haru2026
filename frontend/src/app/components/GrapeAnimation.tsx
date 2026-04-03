import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

const imageModules = import.meta.glob('../../imports/*.png', { eager: true, import: 'default' });
const imageKeys = Object.keys(imageModules).sort();
const imageSources = imageKeys.map(key => imageModules[key] as string);

const grapeImages = [
  { id: 0, src: imageSources[0], row: 0, col: 0 },
  { id: 1, src: imageSources[1], row: 0, col: 1 },
  { id: 2, src: imageSources[2], row: 0, col: 2 },
  { id: 3, src: imageSources[3], row: 0, col: 3 },
  { id: 4, src: imageSources[4], row: 1, col: 0.5 },
  { id: 5, src: imageSources[5], row: 1, col: 1.5 },
  { id: 6, src: imageSources[6], row: 1, col: 2.5 },
  { id: 7, src: imageSources[7], row: 2, col: 1 },
  { id: 8, src: imageSources[8], row: 2, col: 2 },
  { id: 9, src: imageSources[9], row: 3, col: 1.5 },
];

export function GrapeAnimation() {
  const [animationStage, setAnimationStage] = useState<'scattered' | 'gathering' | 'shining'>('scattered');
  const [shinePosition, setShinePosition] = useState(0);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const gatherTimer = setTimeout(() => setAnimationStage('gathering'), 2000);
    const shineTimer = setTimeout(() => setAnimationStage('shining'), 4000);
    const resetTimer = setTimeout(() => {
      setAnimationStage('scattered');
      setShinePosition(0);
      setKey(prev => prev + 1);
    }, 13000);
    return () => { clearTimeout(gatherTimer); clearTimeout(shineTimer); clearTimeout(resetTimer); };
  }, [key]);

  useEffect(() => {
    if (animationStage === 'shining') {
      const interval = setInterval(() => setShinePosition((prev) => (prev + 1) % 10), 300);
      return () => clearInterval(interval);
    }
  }, [animationStage]);

  const getGrapePosition = (grape: typeof grapeImages[0]) => {
    const spacing = 38;
    return { x: grape.col * spacing + 28, y: grape.row * spacing };
  };

  const getRandomPosition = (grapeId: number) => ({
    x: (Math.random() - 0.5) * 600,
    y: 300 + Math.random() * 150,
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ minHeight: 400 }}>
      <div className="relative" style={{ transform: 'translate(-50%, -50%)' }}>
        <motion.div
          className="absolute"
          style={{ left: 65.5, top: -140, width: 150, height: 140 }}
          initial={{ opacity: 0, y: -50 }}
          animate={{
            opacity: animationStage === 'shining' ? 1 : 0,
            y: animationStage === 'shining' ? 0 : -50,
          }}
          transition={{ delay: animationStage === 'shining' ? 0.3 : 0, duration: 1, type: 'spring', stiffness: 80 }}
        >
          <svg width="150" height="140" viewBox="-20 -40 190 180">
            <path d="M 75 120 Q 75 90, 75 60 Q 75 30, 68 10" stroke="#6B4423" strokeWidth="7.8" fill="none" strokeLinecap="round" />
            <path d="M 75 70 Q 60 60, 40 50" stroke="#7D5A3B" strokeWidth="5.2" fill="none" strokeLinecap="round" />
            <path d="M 75 70 Q 95 55, 115 45" stroke="#7D5A3B" strokeWidth="5.2" fill="none" strokeLinecap="round" />
            <g transform="translate(-10, 25) rotate(-90, 50, 17.5)">
              <path d="M 50 35 Q 35 32, 28 20 Q 25 10, 27 0 Q 28 -5, 32 -3 Q 33 2, 35 8 Q 38 -2, 40 -10 Q 42 -12, 45 -8 Q 45 -2, 44 5 Q 48 -5, 52 -12 Q 55 -13, 58 -8 Q 58 0, 56 8 Q 62 -3, 66 -8 Q 69 -8, 71 -3 Q 70 3, 68 10 Q 73 0, 78 -3 Q 81 -2, 82 3 Q 80 12, 75 22 Q 68 30, 50 35 Z" fill="#7DB855" stroke="#4A7C2E" strokeWidth="1.5" />
            </g>
            <g transform="translate(65, 27.5) rotate(90, 50, 17.5)">
              <path d="M 50 35 Q 35 32, 28 20 Q 25 10, 27 0 Q 28 -5, 32 -3 Q 33 2, 35 8 Q 38 -2, 40 -10 Q 42 -12, 45 -8 Q 45 -2, 44 5 Q 48 -5, 52 -12 Q 55 -13, 58 -8 Q 58 0, 56 8 Q 62 -3, 66 -8 Q 69 -8, 71 -3 Q 70 3, 68 10 Q 73 0, 78 -3 Q 81 -2, 82 3 Q 80 12, 75 22 Q 68 30, 50 35 Z" fill="#6FA344" stroke="#3D5E2A" strokeWidth="1.5" />
            </g>
          </svg>
        </motion.div>

        {grapeImages.map((grape) => {
          const finalPos = getGrapePosition(grape);
          const randomPos = getRandomPosition(grape.id);
          const isShining = animationStage === 'shining' && grape.id === shinePosition;
          return (
            <motion.div
              key={`${grape.id}-${key}`}
              className="absolute"
              initial={{ x: randomPos.x, y: randomPos.y, opacity: 0.3, scale: 0.5 }}
              animate={{
                x: animationStage === 'scattered' ? randomPos.x : finalPos.x,
                y: animationStage === 'scattered' ? randomPos.y : finalPos.y,
                opacity: animationStage === 'scattered' ? 0.3 : 1,
                scale: animationStage === 'scattered' ? 0.5 : 1,
              }}
              transition={{ duration: animationStage === 'scattered' ? 0 : 1.5, delay: animationStage === 'gathering' ? grape.id * 0.1 : 0, type: 'spring', stiffness: 100, damping: 15 }}
              style={{ width: 40, height: 40, left: -20, top: -20 }}
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 shadow-lg"
                animate={{ boxShadow: isShining ? '0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(255,255,255,0.5)' : '0 10px 25px rgba(0,0,0,0.3)' }}
                transition={{ duration: 0.3 }}
              />
              {isShining && (
                <motion.div className="absolute inset-0 rounded-full" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 1.5] }} transition={{ duration: 0.6, ease: 'easeOut' }} style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)' }} />
              )}
              <div className="absolute inset-2 rounded-full overflow-hidden flex items-center justify-center bg-white/10 backdrop-blur-sm">
                <img src={grape.src} alt={`Grape ${grape.id + 1}`} className="w-full h-full object-cover rounded-full" />
              </div>
              <div className="absolute top-2 left-2 w-3 h-3 bg-white/40 rounded-full blur-sm" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
