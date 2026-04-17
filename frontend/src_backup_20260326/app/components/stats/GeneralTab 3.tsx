import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Sankey, Rectangle } from 'recharts';

const projectProgressData = [
  { label: '프로젝트 A', value: 85 },
  { label: '프로젝트 B', value: 62 },
  { label: '프로젝트 C', value: 78 },
  { label: '프로젝트 D', value: 45 },
];

const cumulativePerformanceData = [
  { date: '2/10', planning: 20, execution: 15, review: 10 },
  { date: '2/11', planning: 25, execution: 22, review: 15 },
  { date: '2/12', planning: 32, execution: 30, review: 22 },
  { date: '2/13', planning: 38, execution: 38, review: 30 },
  { date: '2/14', planning: 45, execution: 45, review: 38 },
  { date: '2/15', planning: 52, execution: 52, review: 45 },
  { date: '2/16', planning: 58, execution: 58, review: 52 },
];

const issueAnalysisData = [
  { issue: '기술 문제', count: 12 },
  { issue: '일정 지연', count: 8 },
  { issue: '커뮤니케이션', count: 15 },
  { issue: '리소스 부족', count: 6 },
  { issue: '요구사항 변경', count: 10 },
];

const sankeyData = {
  nodes: [
    { name: '계획' },
    { name: '실행' },
    { name: '검토' },
    { name: '완료' },
    { name: '보류' },
    { name: '수정' },
  ],
  links: [
    { source: 0, target: 1, value: 45 },
    { source: 1, target: 2, value: 38 },
    { source: 1, target: 4, value: 7 },
    { source: 2, target: 3, value: 28 },
    { source: 2, target: 5, value: 10 },
    { source: 5, target: 1, value: 10 },
  ],
};

export function GeneralTab() {
  return (
    <div className="space-y-6">
      {/* Gauge Bar - Project Progress */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          프로젝트 진행률
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Project Progress Rate
        </p>
        <div className="space-y-6 py-4">
          {projectProgressData.map((item, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm tracking-wide" style={{ color: '#666666' }}>
                  {item.label}
                </span>
                <span className="text-sm" style={{ color: '#003366' }}>
                  {item.value}%
                </span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#F9F8F3' }}>
                <div
                  className="h-full rounded-full transition-all relative overflow-hidden"
                  style={{
                    width: `${item.value}%`,
                    backgroundColor: '#003366',
                  }}
                >
                  {/* Animated gradient effect */}
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stacked Area Chart - Cumulative Performance */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          누적 성과 지표
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Cumulative Performance Indicator
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={cumulativePerformanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
            />
            <YAxis 
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '8px'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="planning" 
              stackId="1"
              stroke="#003366" 
              fill="#003366"
              fillOpacity={0.8}
              name="계획"
            />
            <Area 
              type="monotone" 
              dataKey="execution" 
              stackId="1"
              stroke="#5B8BB4" 
              fill="#5B8BB4"
              fillOpacity={0.8}
              name="실행"
            />
            <Area 
              type="monotone" 
              dataKey="review" 
              stackId="1"
              stroke="#B5D5F0" 
              fill="#B5D5F0"
              fillOpacity={0.8}
              name="검토"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart - Issue Analysis */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          이슈 분석
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Issue Analysis
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={issueAnalysisData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              type="number"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
            />
            <YAxis 
              type="category"
              dataKey="issue" 
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              width={120}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '8px'
              }}
            />
            <Bar dataKey="count" fill="#003366" name="발생 횟수" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sankey Diagram - Activity Continuity */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          활동 연속성
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Activity Continuity Flow
        </p>
        <div className="py-8">
          <div className="relative" style={{ height: '300px' }}>
            {/* Simplified Sankey visualization */}
            <svg width="100%" height="100%" viewBox="0 0 800 300">
              {/* Nodes */}
              <rect x="50" y="100" width="100" height="100" fill="#003366" opacity="0.8" rx="8" />
              <text x="100" y="155" textAnchor="middle" fill="#F9F8F3" fontSize="14" fontWeight="500">계획</text>
              
              <rect x="250" y="50" width="100" height="200" fill="#2D5F8D" opacity="0.8" rx="8" />
              <text x="300" y="155" textAnchor="middle" fill="#F9F8F3" fontSize="14" fontWeight="500">실행</text>
              
              <rect x="450" y="80" width="100" height="140" fill="#5B8BB4" opacity="0.8" rx="8" />
              <text x="500" y="155" textAnchor="middle" fill="#F9F8F3" fontSize="14" fontWeight="500">검토</text>
              
              <rect x="650" y="100" width="100" height="80" fill="#88B7DB" opacity="0.8" rx="8" />
              <text x="700" y="145" textAnchor="middle" fill="#F9F8F3" fontSize="14" fontWeight="500">완료</text>
              
              {/* Flow lines */}
              <path d="M 150 150 Q 200 150 250 150" stroke="#003366" strokeWidth="40" fill="none" opacity="0.3" />
              <path d="M 350 130 Q 400 130 450 130" stroke="#2D5F8D" strokeWidth="35" fill="none" opacity="0.3" />
              <path d="M 550 140 Q 600 140 650 140" stroke="#5B8BB4" strokeWidth="25" fill="none" opacity="0.3" />
            </svg>
          </div>
          <div className="text-center mt-4 text-xs" style={{ color: '#999999' }}>
            계획 → 실행 → 검토 → 완료 프로세스 흐름
          </div>
        </div>
      </div>
    </div>
  );
}
