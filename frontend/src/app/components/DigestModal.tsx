import { X, Download, Cloud, Sun, CloudRain, Smile, Meh, Frown } from 'lucide-react';

type DigestType = 'weekly' | 'monthly' | 'quarterly' | 'annual';

interface DigestConfig {
  type: DigestType;
  label: string;
  labelEn: string;
  period: string;
  backgroundColor: string;
  unlocked: boolean;
  description: string;
}

interface DigestModalProps {
  open: boolean;
  onClose: () => void;
  config: DigestConfig;
}

// Mock AI-generated content
const mockDigestContent: Record<DigestType, {
  summary: {
    avgMood: string;
    weatherDistribution: { icon: React.ReactNode; label: string; percentage: number }[];
    totalRecords: number;
  };
  content: string;
  keywords: string[];
}> = {
  weekly: {
    summary: {
      avgMood: '긍정적',
      weatherDistribution: [
        { icon: <Sun className="w-4 h-4" />, label: '맑음', percentage: 60 },
        { icon: <Cloud className="w-4 h-4" />, label: '흐림', percentage: 30 },
        { icon: <CloudRain className="w-4 h-4" />, label: '비', percentage: 10 },
      ],
      totalRecords: 7,
    },
    content: `이번 주는 새로운 프로젝트를 시작하면서 배움과 도전이 가득한 시간이었습니다. 월요일부터 목요일까지는 업무에 집중하며 생산적인 하루하루를 보냈고, 특히 수요일에는 팀원들과의 협업이 순조롭게 진행되어 큰 성취감을 느꼈습니다.

금요일에는 개인적인 시간을 가지며 독서와 산책을 통해 재충전의 시간을 가졌습니다. 주말에는 가족과 함께 시간을 보내며 일상의 소소한 행복을 느꼈습니다.

전반적으로 이번 주는 일과 삶의 균형을 잘 유지한 한 주였으며, 작은 성취들이 모여 만족스러운 일주일을 만들었습니다. 다음 주에는 더욱 체계적인 시간 관리를 통해 효율성을 높이고자 합니다.`,
    keywords: ['성취감', '협업', '균형', '성장', '재충전'],
  },
  monthly: {
    summary: {
      avgMood: '안정적',
      weatherDistribution: [
        { icon: <Sun className="w-4 h-4" />, label: '맑음', percentage: 55 },
        { icon: <Cloud className="w-4 h-4" />, label: '흐림', percentage: 35 },
        { icon: <CloudRain className="w-4 h-4" />, label: '비', percentage: 10 },
      ],
      totalRecords: 28,
    },
    content: `2월은 새로운 시작과 적응의 달이었습니다. 월초에는 연간 목표를 구체화하며 방향성을 설정했고, 중순부터는 실행에 옮기기 시작했습니다.

업무 측면에서는 새로운 기술을 학습하며 역량을 강화했고, 개인적으로는 규칙적인 운동과 독서 습관을 형성하는 데 집중했습니다. 특히 주말마다 진행한 문화 활동들이 창의성과 영감을 불어넣어 주었습니다.

월말에는 한 달을 돌아보며 성과를 정리하고 개선점을 찾았습니다. 전반적으로 안정적인 루틴을 유지하면서도 새로운 시도를 두려워하지 않은 달이었습니다.`,
    keywords: ['목표', '학습', '습관', '창의성', '성찰'],
  },
  quarterly: {
    summary: {
      avgMood: '발전적',
      weatherDistribution: [
        { icon: <Sun className="w-4 h-4" />, label: '맑음', percentage: 58 },
        { icon: <Cloud className="w-4 h-4" />, label: '흐림', percentage: 32 },
        { icon: <CloudRain className="w-4 h-4" />, label: '비', percentage: 10 },
      ],
      totalRecords: 84,
    },
    content: `첫 분기는 도약과 성장의 시간이었습니다. 1월의 계획 수립, 2월의 실행, 3월의 최적화 단계를 거치며 점진적인 발전을 이루었습니다.

이 기간 동안 가장 큰 변화는 자기 관리 시스템을 구축한 것입니다. 체계적인 기록과 분석을 통해 자신을 더 깊이 이해하게 되었고, 이는 더 나은 의사결정으로 이어졌습니다.`,
    keywords: ['도약', '성장', '시스템', '의사결정', '최적화'],
  },
  annual: {
    summary: {
      avgMood: '성숙적',
      weatherDistribution: [
        { icon: <Sun className="w-4 h-4" />, label: '맑음', percentage: 57 },
        { icon: <Cloud className="w-4 h-4" />, label: '흐림', percentage: 33 },
        { icon: <CloudRain className="w-4 h-4" />, label: '비', percentage: 10 },
      ],
      totalRecords: 336,
    },
    content: `2025년은 변화와 성장의 해였습니다. 매 분기마다 새로운 목표를 설정하고 달성하며 점진적으로 발전했습니다.

1년을 돌아보니 가장 의미 있었던 것은 지속적인 기록 습관이었습니다. 일상의 작은 순간들을 기록하고 되돌아보면서 삶의 패턴을 발견하고 개선할 수 있었습니다.

앞으로도 이 여정을 계속하며 더 나은 자신을 만들어가고자 합니다.`,
    keywords: ['변화', '성장', '지속성', '패턴', '여정'],
  },
};

export function DigestModal({ open, onClose, config }: DigestModalProps) {
  if (!open) return null;

  const digestData = mockDigestContent[config.type];
  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Document Container */}
        <div
          className="rounded-lg shadow-2xl overflow-hidden"
          style={{ backgroundColor: config.backgroundColor }}
        >
          {/* Toolbar */}
          <div className="bg-white px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: '#e5e5e5' }}>
            <div className="flex items-center gap-3">
              <span className="text-sm tracking-wide" style={{ color: '#003366' }}>
                {config.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => alert('다운로드 기능 준비 중입니다')}
                className="p-3 rounded hover:bg-gray-50 transition-all"
                style={{ color: '#003366' }}
                title="다운로드"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-3 rounded hover:bg-gray-50 transition-all"
                style={{ color: '#999999' }}
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Document Content */}
          <div className="px-8 md:px-16 py-12 md:py-16 space-y-12">
            {/* Header */}
            <header className="text-center border-b pb-8" style={{ borderColor: '#00336620' }}>
              <h1 className="text-3xl md:text-4xl mb-3 tracking-wide" style={{ color: '#003366' }}>
                {config.label}
              </h1>
              <p className="text-sm tracking-wider mb-6" style={{ color: '#666666' }}>
                {config.labelEn}
              </p>
              <div className="inline-block px-6 py-2 rounded-full" style={{ backgroundColor: '#003366', color: '#F9F8F3' }}>
                <span className="text-sm">{config.period}</span>
              </div>
            </header>

            {/* Summary Section */}
            <section>
              <h2 className="text-lg mb-6 tracking-wide" style={{ color: '#003366' }}>
                개요
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Records */}
                <div className="bg-white rounded-lg p-5 shadow-sm">
                  <p className="text-xs mb-2" style={{ color: '#999999' }}>
                    총 기록 수
                  </p>
                  <p className="text-2xl" style={{ color: '#003366' }}>
                    {digestData.summary.totalRecords}
                  </p>
                </div>

                {/* Average Mood */}
                <div className="bg-white rounded-lg p-5 shadow-sm">
                  <p className="text-xs mb-2" style={{ color: '#999999' }}>
                    평균 기분
                  </p>
                  <div className="flex items-center gap-2">
                    <Smile className="w-5 h-5" style={{ color: '#003366' }} />
                    <p className="text-lg" style={{ color: '#003366' }}>
                      {digestData.summary.avgMood}
                    </p>
                  </div>
                </div>

                {/* Weather Distribution */}
                <div className="bg-white rounded-lg p-5 shadow-sm">
                  <p className="text-xs mb-3" style={{ color: '#999999' }}>
                    날씨 분포
                  </p>
                  <div className="space-y-2">
                    {digestData.summary.weatherDistribution.map((weather, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2" style={{ color: '#666666' }}>
                          {weather.icon}
                          <span>{weather.label}</span>
                        </div>
                        <span style={{ color: '#003366' }}>{weather.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Body - AI Generated Content */}
            <section>
              <h2 className="text-lg mb-6 tracking-wide" style={{ color: '#003366' }}>
                분석
              </h2>
              <div className="bg-white rounded-lg p-8 shadow-sm">
                <div 
                  className="leading-relaxed text-sm md:text-base whitespace-pre-wrap"
                  style={{ color: '#333333' }}
                >
                  {digestData.content}
                </div>
              </div>
            </section>

            {/* Keywords/Insights */}
            <section>
              <h2 className="text-lg mb-6 tracking-wide" style={{ color: '#003366' }}>
                핵심 키워드
              </h2>
              <div className="flex flex-wrap gap-3">
                {digestData.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-5 py-3 rounded-lg text-sm shadow-sm"
                    style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </section>

            {/* Footer */}
            <footer className="pt-8 border-t text-center" style={{ borderColor: '#00336620' }}>
              <div className="space-y-2 text-xs" style={{ color: '#999999' }}>
                <p>발행일: {currentDate}</p>
                <p>작성자: 허교장</p>
                <p>HARU v1.0 · SAYU Report</p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
