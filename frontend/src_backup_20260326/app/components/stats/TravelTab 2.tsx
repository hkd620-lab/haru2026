import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

const themeData = [
  { name: '자연', value: 35, color: '#2D5F8D' },
  { name: '도시', value: 25, color: '#5B8BB4' },
  { name: '문화', value: 20, color: '#88B7DB' },
  { name: '휴식', value: 15, color: '#B5D5F0' },
  { name: '모험', value: 5, color: '#C8E0F7' },
];

const sensoryDensityData = [
  { date: '여행 1일', visual: 85, auditory: 72, tactile: 65, taste: 80, smell: 70 },
  { date: '여행 2일', visual: 90, auditory: 78, tactile: 72, taste: 85, smell: 75 },
  { date: '여행 3일', visual: 88, auditory: 75, tactile: 68, taste: 78, smell: 72 },
  { date: '여행 4일', visual: 92, auditory: 82, tactile: 75, taste: 88, smell: 80 },
];

const reflectionDepthData = [
  { point: '출발', depth: 30 },
  { point: '도착', depth: 45 },
  { point: '탐험', depth: 65 },
  { point: '경험', depth: 80 },
  { point: '성찰', depth: 88 },
  { point: '귀가', depth: 72 },
  { point: '정리', depth: 85 },
];

const temperatureData = [
  { x: 45, y: 78, label: '설렘', size: 850 },
  { x: 62, y: 85, label: '기쁨', size: 1200 },
  { x: 38, y: 52, label: '평온', size: 650 },
  { x: 75, y: 92, label: '감동', size: 1500 },
  { x: 55, y: 68, label: '그리움', size: 920 },
  { x: 68, y: 75, label: '만족', size: 1100 },
];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      fontSize={12}
      fontWeight={500}
    >
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function TravelTab() {
  return (
    <div className="space-y-8">
      {/* Special styling note */}
      <div 
        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border-l-4"
        style={{ borderColor: '#003366' }}
      >
        <p className="text-sm leading-relaxed tracking-wider" style={{ color: '#003366', letterSpacing: '0.1em' }}>
          여행 기록은 감성적인 UI로 표현됩니다.
          <br />
          확장된 자간과 행간, 곡선 그래프 강조를 통해 여행의 온도를 담았습니다.
        </p>
      </div>

      {/* Iconic Pie Chart - Travel Theme Analysis */}
      <div className="bg-white rounded-lg p-8 shadow-sm">
        <h3 
          className="text-lg mb-3 tracking-wider" 
          style={{ color: '#003366', letterSpacing: '0.15em', lineHeight: '1.8' }}
        >
          여행 테마 분석
        </h3>
        <p 
          className="text-xs mb-8 tracking-widest" 
          style={{ color: '#999999', letterSpacing: '0.1em' }}
        >
          Travel Theme Analysis
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={themeData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {themeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                letterSpacing: '0.05em',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked Bar Chart - Sensory Record Density */}
      <div className="bg-white rounded-lg p-8 shadow-sm">
        <h3 
          className="text-lg mb-3 tracking-wider" 
          style={{ color: '#003366', letterSpacing: '0.15em', lineHeight: '1.8' }}
        >
          감각 기록 밀도
        </h3>
        <p 
          className="text-xs mb-8 tracking-widest" 
          style={{ color: '#999999', letterSpacing: '0.1em' }}
        >
          Sensory Record Density
        </p>
        <div className="space-y-6">
          {sensoryDensityData.map((day, dayIndex) => (
            <div key={dayIndex}>
              <p className="text-sm mb-3 tracking-wider" style={{ color: '#666666', letterSpacing: '0.08em' }}>
                {day.date}
              </p>
              <div className="space-y-3">
                {['visual', 'auditory', 'tactile', 'taste', 'smell'].map((sense, senseIndex) => {
                  const labels: Record<string, string> = {
                    visual: '시각',
                    auditory: '청각',
                    tactile: '촉각',
                    taste: '미각',
                    smell: '후각',
                  };
                  const value = day[sense as keyof typeof day] as number;
                  return (
                    <div key={senseIndex}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs tracking-wider" style={{ color: '#999999', letterSpacing: '0.08em' }}>
                          {labels[sense]}
                        </span>
                        <span className="text-xs tracking-wider" style={{ color: '#003366' }}>
                          {value}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F9F8F3' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${value}%`,
                            backgroundColor: '#003366',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wave Area Chart - Depth of Reflection */}
      <div className="bg-white rounded-lg p-8 shadow-sm">
        <h3 
          className="text-lg mb-3 tracking-wider" 
          style={{ color: '#003366', letterSpacing: '0.15em', lineHeight: '1.8' }}
        >
          성찰의 깊이
        </h3>
        <p 
          className="text-xs mb-8 tracking-widest" 
          style={{ color: '#999999', letterSpacing: '0.1em' }}
        >
          Depth of Reflection
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={reflectionDepthData}>
            <defs>
              <linearGradient id="colorDepth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#003366" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#003366" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              dataKey="point" 
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              style={{ letterSpacing: '0.05em' }}
            />
            <YAxis 
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              domain={[0, 100]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '12px',
                letterSpacing: '0.05em',
              }}
            />
            <Area 
              type="natural" 
              dataKey="depth" 
              stroke="#003366" 
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorDepth)"
              name="깊이"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Scatter Plot - Temperature of Travel */}
      <div className="bg-white rounded-lg p-8 shadow-sm">
        <h3 
          className="text-lg mb-3 tracking-wider" 
          style={{ color: '#003366', letterSpacing: '0.15em', lineHeight: '1.8' }}
        >
          여행의 온도
        </h3>
        <p 
          className="text-xs mb-8 tracking-widest" 
          style={{ color: '#999999', letterSpacing: '0.1em' }}
        >
          Temperature of Travel
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              type="number" 
              dataKey="x" 
              name="강도"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '강도', position: 'insideBottom', offset: -10, fill: '#666666', letterSpacing: '0.05em' }}
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name="지속성"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '지속성', angle: -90, position: 'insideLeft', fill: '#666666', letterSpacing: '0.05em' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '12px',
                letterSpacing: '0.05em',
              }}
              formatter={(value: any, name: string, props: any) => {
                if (name === 'label') return [props.payload.label, '감정'];
                return [value, name];
              }}
            />
            <Scatter 
              name="감정" 
              data={temperatureData} 
              fill="#003366"
            >
              {temperatureData.map((entry, index) => {
                const size = entry.size / 25;
                return (
                  <circle 
                    key={index} 
                    r={size}
                    fill="#003366"
                    opacity={0.6}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Emotional Keywords */}
      <div className="bg-white rounded-lg p-8 shadow-sm">
        <h3 
          className="text-lg mb-3 tracking-wider text-center" 
          style={{ color: '#003366', letterSpacing: '0.15em', lineHeight: '1.8' }}
        >
          여행의 순간들
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-6 py-8">
          {['설렘', '기쁨', '평온', '감동', '그리움', '만족', '자유', '발견'].map((word, index) => (
            <span
              key={index}
              className="tracking-widest cursor-pointer hover:opacity-70 transition-opacity"
              style={{
                fontSize: `${20 + Math.random() * 20}px`,
                color: '#003366',
                opacity: 0.6 + Math.random() * 0.4,
                fontWeight: 400,
                letterSpacing: '0.2em',
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
