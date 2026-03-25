import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { useLocation } from 'react-router';

declare global {
  interface Window {
    Kakao: any;
  }
}

interface GrapePosition {
  x: number;
  y: number;
  icon: string;
  label: string;
}

const grapeLayout: GrapePosition[] = [
  { x: -55, y: -66, icon: 'diary', label: '일기' },
  { x: -18, y: -66, icon: 'essay', label: '에세이' },
  { x: 18, y: -66, icon: 'garden', label: '텃밭' },
  { x: 55, y: -66, icon: 'memo', label: '메모' },
  { x: -36, y: -26, icon: 'pet', label: '애완동물' },
  { x: 0, y: -26, icon: 'parenting', label: '육아일기' },
  { x: 36, y: -26, icon: 'travel', label: '여행기록' },
  { x: -18, y: 14, icon: 'mission', label: '선교보고' },
  { x: 18, y: 14, icon: 'report', label: '일반보고' },
  { x: 0, y: 54, icon: 'work', label: '업무일지' },
];

const Icon = ({ type }: { type: string }) => {
  const iconProps = {
    stroke: 'currentColor',
    fill: 'none',
    strokeWidth: '2.5',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (type) {
    case 'diary':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><rect x="7" y="5" width="10" height="14" rx="1" {...iconProps} /><line x1="9" y1="9" x2="15" y2="9" {...iconProps} /><line x1="9" y1="12" x2="15" y2="12" {...iconProps} /><line x1="9" y1="15" x2="13" y2="15" {...iconProps} /></svg>);
    case 'essay':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" {...iconProps} /><path d="M12 11 L12 16 M9 14 L15 14" {...iconProps} /><circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="17" cy="6" r="0.8" fill="currentColor" stroke="none" /></svg>);
    case 'garden':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 18 L12 10" {...iconProps} /><path d="M12 10 C9 10 7 8 7 6 C7 6 9 7 12 7 C15 7 17 6 17 6 C17 8 15 10 12 10" {...iconProps} /><path d="M12 13 C10 13 8.5 11.5 8.5 10 C8.5 10 10 10.5 12 10.5 C14 10.5 15.5 10 15.5 10 C15.5 11.5 14 13 12 13" {...iconProps} /></svg>);
    case 'pet':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M6 10 L7 6 L9 8 L9 10" {...iconProps} /><path d="M18 10 L17 6 L15 8 L15 10" {...iconProps} /><circle cx="12" cy="12" r="5" {...iconProps} /><circle cx="10" cy="11" r="0.8" fill="currentColor" stroke="none" /><circle cx="14" cy="11" r="0.8" fill="currentColor" stroke="none" /><path d="M10 14 Q12 15 14 14" {...iconProps} /></svg>);
    case 'parenting':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="8" r="2.5" {...iconProps} /><path d="M12 10.5 L12 15 M10 12.5 L14 12.5" {...iconProps} /><circle cx="10" cy="8" r="0.7" fill="currentColor" stroke="none" /><circle cx="14" cy="8" r="0.7" fill="currentColor" stroke="none" /><path d="M10.5 9.5 Q12 10 13.5 9.5" {...iconProps} /></svg>);
    case 'travel':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M16 12 L18 12 L20 14 L18 14 L16 12" {...iconProps} /><path d="M8 11 L16 11 L16 13 L8 13 L6 14 L5 13 L6 12 L8 11 Z" {...iconProps} /><path d="M8 12 L4 10 L4 9 L8 11" {...iconProps} /></svg>);
    case 'mission':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><line x1="12" y1="6" x2="12" y2="18" {...iconProps} /><line x1="8" y1="10" x2="16" y2="10" {...iconProps} /><path d="M9 18 L15 18" {...iconProps} /></svg>);
    case 'report':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 6 C7 6 8 5 9 6 L10 7 C10 7 10 8 9 9 C9 9 9 11 13 15 C13 15 15 15 16 14 L17 13 C18 12 19 13 19 13 L18 16 C18 16 16 18 12 14 C8 10 6 8 6 8 L7 6" {...iconProps} /></svg>);
    case 'work':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 12 L8 18 L16 18 L16 12" {...iconProps} /><path d="M12 12 C9 12 7 10 7 8 C7 8 12 6 12 6 C12 6 17 8 17 8 C17 10 15 12 12 12" {...iconProps} /><line x1="6" y1="18" x2="18" y2="18" {...iconProps} /></svg>);
    case 'memo':
      return (<svg width="18" height="18" viewBox="0 0 24 24"><path d="M17 3 L21 7 L9 19 L5 20 L6 16 L17 3" {...iconProps} /><line x1="15" y1="5" x2="19" y2="9" {...iconProps} /></svg>);
    default:
      return null;
  }
};

export default function HaruLogo() {
  const location = useLocation();
  const [animationKey, setAnimationKey] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [showCheckMark, setShowCheckMark] = useState(false);

  const getRandomPosition = () => ({
    x: (Math.random() - 0.5) * 600,
    y: (Math.random() - 0.5) * 600,
    opacity: Math.random() * 0.5 + 0.5,
    scale: Math.random() * 0.2 + 0.8,
  });

  useEffect(() => {
    setAnimationKey(prevKey => prevKey + 1);
    setShowComplete(false);
    setShowCheckMark(false);
  }, [location.pathname]);

  useEffect(() => {
    const timer = setTimeout(() => { setShowComplete(true); }, 1000);
    return () => clearTimeout(timer);
  }, [animationKey]);

  useEffect(() => {
    const timer = setTimeout(() => { setShowCheckMark(true); }, 4500);
    return () => clearTimeout(timer);
  }, [animationKey]);

  return (
    <div className="flex items-center justify-center w-full pt-16 pb-2" style={{ backgroundColor: 'transparent' }}>
      <div className="flex flex-col items-center justify-center">
        <div key={animationKey} className="relative flex items-center justify-center" style={{ width: 'min(200px, 55vw)', height: 'min(200px, 55vw)', overflow: 'visible' }}>
          <div
            style={{
              position: 'absolute',
              top: '-36px',
              left: '50%',
              transform: 'translateX(-50%) rotate(15deg)',
              transformOrigin: 'bottom center',
            }}
          >
            <svg width="30" height="46" viewBox="0 0 30 46" fill="none">
              <path
                d="M15 44 C15 34 15 22 15 14 C15 8 18 4 22 2"
                stroke="#5a3a2a"
                strokeWidth="7.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
          {grapeLayout.map((grape, index) => {
            const randomPos = getRandomPosition();
            const isCenterGrape = index === 5;
            return (
              <motion.div key={index} className={`absolute rounded-full flex items-center justify-center text-[#F7F5F2] ${isCenterGrape ? 'z-10' : ''}`} style={{ width: 'min(36px, 10vw)', height: 'min(36px, 10vw)', background: 'radial-gradient(circle at 35% 35%, #8B4789 0%, #6B3767 30%, #4a2349 60%, #2a1329 100%)', boxShadow: '0 10px 25px rgba(0,0,0,0.5), 0 5px 10px rgba(0,0,0,0.3), inset -6px -6px 15px rgba(0,0,0,0.6), inset 6px 6px 15px rgba(255,255,255,0.15)' }}
                initial={{ x: randomPos.x, y: randomPos.y, opacity: randomPos.opacity, scale: randomPos.scale }}
                animate={{ x: grape.x, y: grape.y, opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: index * 0.05, ease: [0.43, 0.13, 0.23, 0.96] }}
              >
                <Icon type={grape.icon} />
              </motion.div>
            );
          })}
          {showCheckMark && (
            <motion.div className="absolute flex items-center justify-center" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
              <svg width="48" height="48" viewBox="0 0 24 24"><path d="M5 12 L10 17 L19 7" stroke="#00E676" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </motion.div>
          )}
        </div>
        <div className="text-center" style={{ marginTop: '-10px', marginBottom: '4px' }}>
          {showComplete && (
            <div className="flex items-center justify-center gap-1" style={{ marginBottom: '-12px' }}>
              {['H', 'A', 'R', 'U'].map((letter, index) => (
                <motion.span key={index} className="font-bold relative"
                  style={{ fontSize: 'clamp(48px, 10vw, 72px)', backgroundImage: 'linear-gradient(135deg, #cc4400 0%, #ff6600 20%, #ffaa44 40%, #fff0dd 50%, #ffaa44 60%, #ff6600 80%, #cc4400 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', backgroundSize: '300% 100%', filter: 'drop-shadow(0 0 8px rgba(255,102,0,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                  initial={{ opacity: 0, y: 20, scale: 0.5 }}
                  animate={{ opacity: 1, y: 0, backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                  transition={{ opacity: { delay: 1.0 + index * 0.1, duration: 0.5 }, y: { delay: 1.0 + index * 0.1, duration: 0.5 }, backgroundPosition: { delay: 1.7 + index * 0.15, duration: 2.5, repeat: Infinity, repeatDelay: 1, ease: 'linear' } }}
                >{letter}</motion.span>
              ))}
            </div>
          )}
          {showComplete && (
            <motion.p className="text-base" style={{ fontSize: 'clamp(14px, 2.5vw, 18px)', color: '#2C2C2C', opacity: 0.7 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 0.7, y: 0 }} transition={{ delay: 2.5, duration: 0.6 }}>
              하루를{' '}
              <motion.span className="font-semibold" style={{ color: '#ff6600' }} animate={{ scale: [1, 1.15, 1] }} transition={{ delay: 3.0, duration: 0.8 }}>간편하게</motion.span>{' '}
              입력하고{' '}
              <motion.span className="font-semibold" style={{ color: '#ff6600' }} animate={{ scale: [1, 1.15, 1] }} transition={{ delay: 3.5, duration: 0.8 }}>쓸모있게</motion.span>{' '}
              남기는 앱
            </motion.p>
          )}
        </div>
      </div>
      <button className="absolute bottom-5 right-5 bg-blue-500 text-white px-4 py-2 rounded-full shadow-md hover:bg-blue-600" onClick={() => {}}>
        <Share2 size={20} />
      </button>
    </div>
  );
}
