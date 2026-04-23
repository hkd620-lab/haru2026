import { motion, AnimatePresence } from 'motion/react';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
}

const grapePositions = [
  { x: -38, y: -52, ic: 'diary' },
  { x: -13, y: -52, ic: 'essay' },
  { x:  13, y: -52, ic: 'garden' },
  { x:  38, y: -52, ic: 'memo' },
  { x: -26, y: -22, ic: 'pet' },
  { x:   0, y: -22, ic: 'parenting' },
  { x:  26, y: -22, ic: 'travel' },
  { x: -13, y:   8, ic: 'mission' },
  { x:  13, y:   8, ic: 'report' },
  { x:   0, y:  38, ic: 'work' },
];

const GrapeIcon = ({ type }: { type: string }) => {
  const p = { stroke: 'white', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'diary': return <svg width="18" height="18" viewBox="0 0 18 18"><rect x="5" y="3" width="8" height="11" rx="1" {...p}/><line x1="7" y1="7" x2="11" y2="7" {...p}/><line x1="7" y1="9.5" x2="11" y2="9.5" {...p}/><line x1="7" y1="12" x2="10" y2="12" {...p}/></svg>;
    case 'essay': return <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="6" r="2.5" {...p}/><path d="M9 8.5 L9 13" {...p}/><line x1="7" y1="11" x2="11" y2="11" {...p}/></svg>;
    case 'garden': return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 15 L9 8" {...p}/><path d="M9 8 C7 8 5.5 6.5 5.5 5 C5.5 5 7 5.5 9 5.5 C11 5.5 12.5 5 12.5 5 C12.5 6.5 11 8 9 8" {...p}/></svg>;
    case 'memo': return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M13 2 L16 5 L6 15 L3 16 L4 13 L13 2" {...p}/><line x1="11" y1="4" x2="14" y2="7" {...p}/></svg>;
    case 'pet': return <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="4" {...p}/><circle cx="7.5" cy="8" r="0.7" fill="white" stroke="none"/><circle cx="10.5" cy="8" r="0.7" fill="white" stroke="none"/><path d="M7.5 11 Q9 12 10.5 11" {...p}/></svg>;
    case 'parenting': return <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="6" r="2" {...p}/><path d="M9 8 L9 13 M7 10 L11 10" {...p}/></svg>;
    case 'travel': return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M12 9 L14 9 L16 11 L14 11 L12 9" {...p}/><path d="M5 8.5 L12 8.5 L12 10.5 L5 10.5 L3 11.5 L2.5 10.5 L3.5 9.5 Z" {...p}/></svg>;
    case 'mission': return <svg width="18" height="18" viewBox="0 0 18 18"><line x1="9" y1="4" x2="9" y2="15" {...p}/><line x1="6" y1="8" x2="12" y2="8" {...p}/><line x1="7" y1="15" x2="11" y2="15" {...p}/></svg>;
    case 'report': return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M5 4 L5 15 L13 15 L13 7 L10 4 Z" {...p}/><line x1="7" y1="9" x2="11" y2="9" {...p}/><line x1="7" y1="11.5" x2="11" y2="11.5" {...p}/></svg>;
    case 'work': return <svg width="18" height="18" viewBox="0 0 18 18"><rect x="4" y="7" width="10" height="7" rx="1" {...p}/><path d="M7 7 L7 5 L11 5 L11 7" {...p}/></svg>;
    default: return null;
  }
};

export function LoadingOverlay({ visible, message = '잠시만 기다려주세요', progress }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <svg
              viewBox="-70 -80 140 170"
              style={{
                width: 'min(55vw, 180px)',
                height: 'min(55vw, 180px)',
                display: 'block',
                margin: '0 auto',
                overflow: 'visible',
              }}
            >
              <path d="M0 -68 C0 -62 3 -58 6 -54" stroke="#5a3a2a" strokeWidth="5" strokeLinecap="round" fill="none"/>

              {grapePositions.map((grape, i) => (
                <motion.g
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    duration: 1.4 + (i % 3) * 0.25,
                    repeat: Infinity,
                    delay: i * 0.07,
                    ease: 'easeInOut',
                  }}
                >
                  <defs>
                    <radialGradient id={`gg${i}`} cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="#9B5799"/>
                      <stop offset="40%" stopColor="#7B4777"/>
                      <stop offset="100%" stopColor="#4a2349"/>
                    </radialGradient>
                  </defs>
                  <circle
                    cx={grape.x} cy={grape.y} r="15"
                    fill={`url(#gg${i})`}
                    style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.5))' }}
                  />
                  <foreignObject
                    x={grape.x - 9} y={grape.y - 9}
                    width="18" height="18"
                  >
                    <GrapeIcon type={grape.ic} />
                  </foreignObject>
                </motion.g>
              ))}
            </svg>

            <div style={{ marginTop: 4 }}>
              <span style={{
                fontSize: 'clamp(20px, 6vw, 28px)',
                fontWeight: 500,
                letterSpacing: '0.2em',
                background: 'linear-gradient(135deg, #cc4400, #ff6600, #ffaa44, #ff6600, #cc4400)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>HARU</span>
              <span style={{
                fontSize: 'clamp(8px, 2vw, 11px)',
                color: 'rgba(255,255,255,0.45)',
                display: 'block',
                letterSpacing: '0.28em',
              }}>2026</span>
            </div>

            <p style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 'clamp(11px, 3vw, 13px)',
              marginTop: 10,
            }}>{message}</p>

            {progress !== undefined ? (
              <div style={{ marginTop: 8 }}>
                <div style={{
                  width: 'min(40vw, 140px)',
                  height: 3,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 2,
                  margin: '0 auto',
                }}>
                  <div style={{
                    height: 3,
                    background: '#10b981',
                    borderRadius: 2,
                    width: `${progress}%`,
                    transition: 'width 0.3s',
                  }}/>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
                  {Math.round(progress)}%
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 8 }}>
                {[0, 0.3, 0.6].map((delay, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.8)' }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
