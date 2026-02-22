import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { PlusCircle } from 'lucide-react';
import { HaruLogoAnimation } from '../components/HaruLogoAnimation';

export function HomePage() {
  const navigate = useNavigate();
  const today = new Date();

  return (
    <div className="min-h-[calc(100vh-56px-80px)]" style={{ backgroundColor: '#FAF9F6' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* Logo & Identity */}
        <header className="text-center mb-16 md:mb-20">
          <HaruLogoAnimation />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md mx-auto mt-8 pt-8 border-t"
            style={{ borderColor: '#e5e5e5' }}
          >
            <p className="text-base md:text-lg leading-relaxed mb-3" style={{ color: '#333333' }}>
              간편하게 입력하고, 쓸모있게 남깁니다
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#999999' }}>
              감성적인 일기장이 아닌, 체계적인 기록 도구
            </p>
          </motion.div>
        </header>

        {/* Date Display */}
        <section className="text-center mb-10">
          <p className="text-lg tracking-wide" style={{ color: '#666666' }}>
            {today.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </section>

        {/* Write Button */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/record')}
            className="flex items-center gap-2 px-10 py-4 rounded-lg transition-all hover:opacity-90 shadow-lg"
            style={{ backgroundColor: '#1A3C6E', color: '#FAF9F6' }}
          >
            <PlusCircle className="w-6 h-6" />
            <span className="text-lg tracking-wide">오늘 기록 쓰기</span>
          </button>
        </div>
      </div>
    </div>
  );
}