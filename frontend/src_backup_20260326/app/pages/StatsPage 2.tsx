import { motion } from 'motion/react';
import { StatsTitleAnimation } from '../components/StatsTitleAnimation';

export function StatsPage() {
  const listItems = [
    { icon: '📅', text: '월별/연도별 기록 빈도' },
    { icon: '📂', text: '형식별 기록 분포' },
    { icon: '🌤', text: '기분/날씨 트렌드' },
    { icon: '✍️', text: '기록 작성 패턴' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex flex-col items-start gap-6">

        {/* 애니메이션 타이틀 */}
        <StatsTitleAnimation />

        {/* 콘텐츠 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-xl shadow-sm w-full max-w-2xl px-6 py-8"
        >
          <p className="text-base mb-5" style={{ color: '#333' }}>
            통계 페이지에서는
          </p>

          <ul className="space-y-3">
            {listItems.map((item, i) => (
              <motion.li
                key={item.text}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 1.15 + i * 0.12,
                  duration: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex items-center gap-3 text-base"
                style={{ color: '#333' }}
              >
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                {item.text}
              </motion.li>
            ))}
          </ul>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.75, duration: 0.6 }}
            className="pt-6 mt-6 border-t"
            style={{ borderColor: '#e5e5e5' }}
          >
            <p className="text-sm" style={{ color: '#999' }}>
              이 기능은 향후 업데이트에서 제공될 예정입니다
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}