import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const radarData = [
  { subject: 'Action', value: 85 },
  { subject: 'Good Things', value: 92 },
  { subject: 'Conflict', value: 45 },
  { subject: 'Regret', value: 38 },
  { subject: 'Learning', value: 78 },
  { subject: 'Void', value: 52 },
];

const weeklyRatioData = [
  { week: 'W1', positive: 65, reflection: 35 },
  { week: 'W2', positive: 70, reflection: 30 },
  { week: 'W3', positive: 55, reflection: 45 },
  { week: 'W4', positive: 72, reflection: 28 },
];

const trendData = [
  { date: '2/10', conflict: 45, void: 32 },
  { date: '2/11', conflict: 38, void: 28 },
  { date: '2/12', conflict: 52, void: 45 },
  { date: '2/13', conflict: 35, void: 30 },
  { date: '2/14', conflict: 42, void: 38 },
  { date: '2/15', conflict: 48, void: 42 },
  { date: '2/16', conflict: 40, void: 35 },
];

const keywords = [
  { text: '감사', value: 95 },
  { text: '성장', value: 88 },
  { text: '반성', value: 72 },
  { text: '목표', value: 85 },
  { text: '배움', value: 78 },
  { text: '도전', value: 68 },
  { text: '변화', value: 75 },
  { text: '행복', value: 92 },
];

export function DiaryTab() {
  return (
    <div className="space-y-6">
      {/* Radar Chart - Writing Balance */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          작성 균형도
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Action · Good Things · Conflict · Regret · Learning · Void
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#e5e5e5" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#666666', fontSize: 12 }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 100]}
              tick={{ fill: '#999999', fontSize: 10 }}
            />
            <Radar 
              name="균형도" 
              dataKey="value" 
              stroke="#003366" 
              fill="#003366" 
              fillOpacity={0.6} 
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '8px'
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked Bar Chart - Weekly Ratio */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          주간 긍정·반성 지표 비율
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Positive · Reflection Index
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyRatioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              dataKey="week" 
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
            <Legend />
            <Bar dataKey="positive" stackId="a" fill="#003366" name="긍정" />
            <Bar dataKey="reflection" stackId="a" fill="#88B7DB" name="반성" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Dual Axis Line Chart - Conflict vs Void */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          Conflict vs. Void 추세
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          갈등과 공허함의 상관관계
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
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
            <Legend />
            <Line 
              type="monotone" 
              dataKey="conflict" 
              stroke="#003366" 
              strokeWidth={2}
              name="갈등"
              dot={{ fill: '#003366', r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="void" 
              stroke="#88B7DB" 
              strokeWidth={2}
              name="공허함"
              dot={{ fill: '#88B7DB', r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Word Cloud - Keywords */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          핵심 키워드
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Learning & Void 섹션에서 추출
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 py-8">
          {keywords.map((keyword, index) => {
            const fontSize = Math.max(14, Math.min(48, keyword.value / 2));
            const opacity = Math.max(0.4, keyword.value / 100);
            return (
              <span
                key={index}
                className="tracking-wider cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  fontSize: `${fontSize}px`,
                  color: '#003366',
                  opacity: opacity,
                  fontWeight: 500,
                }}
              >
                {keyword.text}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
