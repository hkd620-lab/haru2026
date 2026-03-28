import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const bubbleData = [
  { x: 45, y: 78, z: 850, label: '인간관계' },
  { x: 62, y: 85, z: 1200, label: '가치관' },
  { x: 38, y: 62, z: 650, label: '사회' },
  { x: 75, y: 92, z: 1500, label: '성장' },
  { x: 55, y: 70, z: 920, label: '자아' },
  { x: 68, y: 80, z: 1100, label: '감정' },
];

const scatterData = [
  { observation: 45, insight: 52 },
  { observation: 62, insight: 68 },
  { observation: 38, insight: 42 },
  { observation: 75, insight: 82 },
  { observation: 55, insight: 60 },
  { observation: 68, insight: 75 },
  { observation: 72, insight: 78 },
  { observation: 48, insight: 55 },
  { observation: 85, insight: 90 },
  { observation: 60, insight: 65 },
];

const inspirationKeywords = [
  { text: '통찰', value: 92 },
  { text: '관점', value: 88 },
  { text: '성찰', value: 85 },
  { text: '질문', value: 78 },
  { text: '영감', value: 95 },
  { text: '발견', value: 82 },
  { text: '이해', value: 75 },
  { text: '깨달음', value: 90 },
];

export function EssayTab() {
  return (
    <div className="space-y-6">
      {/* Expanding Bubble Chart */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          관점 확장 지표
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          주제별 사고의 깊이와 범위
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              type="number" 
              dataKey="x" 
              name="깊이"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '깊이', position: 'insideBottom', offset: -10, fill: '#666666' }}
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name="범위"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '범위', angle: -90, position: 'insideLeft', fill: '#666666' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '8px'
              }}
              formatter={(value: any, name: string, props: any) => {
                if (name === 'z') return [props.payload.label, '주제'];
                return [value, name];
              }}
            />
            <Scatter 
              name="주제" 
              data={bubbleData} 
              fill="#003366"
            >
              {bubbleData.map((entry, index) => {
                const size = entry.z / 20;
                return (
                  <circle 
                    key={index} 
                    cx={0} 
                    cy={0} 
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

      {/* Gauge Bar - Positive Diffusion */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          긍정 확산 지표
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          긍정적 영향력의 확산 정도
        </p>
        <div className="space-y-6 py-4">
          {[
            { label: '자기 이해', value: 85 },
            { label: '타인 공감', value: 72 },
            { label: '사회 인식', value: 68 },
            { label: '미래 전망', value: 78 },
          ].map((item, index) => (
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
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${item.value}%`,
                    backgroundColor: '#003366',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scatter Plot - Observation vs Insight */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          관찰과 통찰의 상관관계
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Observation · Insight Correlation
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              type="number" 
              dataKey="observation" 
              name="관찰"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '관찰', position: 'insideBottom', offset: -10, fill: '#666666' }}
            />
            <YAxis 
              type="number" 
              dataKey="insight" 
              name="통찰"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '통찰', angle: -90, position: 'insideLeft', fill: '#666666' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '8px'
              }}
            />
            <Scatter 
              name="데이터 포인트" 
              data={scatterData} 
              fill="#003366"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Word Cloud - Inspiration Keywords */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          영감 키워드
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          에세이에서 추출된 핵심 개념
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 py-8">
          {inspirationKeywords.map((keyword, index) => {
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
