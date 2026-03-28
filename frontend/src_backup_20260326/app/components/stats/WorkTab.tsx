import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, ScatterChart, Scatter } from 'recharts';

const satisfactionHeatmapData = [
  { day: '월', satisfaction: [7, 8, 6, 9, 7] },
  { day: '화', satisfaction: [8, 7, 8, 8, 9] },
  { day: '수', satisfaction: [6, 7, 9, 7, 8] },
  { day: '목', satisfaction: [9, 8, 7, 8, 7] },
  { day: '금', satisfaction: [8, 9, 8, 9, 8] },
];

const stepSpendingData = [
  { date: '2/10', steps: 8500, spending: 35000 },
  { date: '2/11', steps: 10200, spending: 28000 },
  { date: '2/12', steps: 6800, spending: 52000 },
  { date: '2/13', steps: 12500, spending: 18000 },
  { date: '2/14', steps: 9200, spending: 42000 },
  { date: '2/15', steps: 11000, spending: 25000 },
  { date: '2/16', steps: 7500, spending: 38000 },
];

const taskCompletionData = [
  { category: '기획', completed: 85, pending: 15 },
  { category: '개발', completed: 72, pending: 28 },
  { category: '디자인', completed: 90, pending: 10 },
  { category: '테스트', completed: 68, pending: 32 },
  { category: '문서화', completed: 78, pending: 22 },
];

const focusIntensityData = [
  { time: '09:00', intensity: 65 },
  { time: '10:00', intensity: 78 },
  { time: '11:00', intensity: 85 },
  { time: '12:00', intensity: 45 },
  { time: '13:00', intensity: 40 },
  { time: '14:00', intensity: 72 },
  { time: '15:00', intensity: 88 },
  { time: '16:00', intensity: 92 },
  { time: '17:00', intensity: 75 },
  { time: '18:00', intensity: 50 },
];

export function WorkTab() {
  return (
    <div className="space-y-6">
      {/* Calendar Heatmap - Work Satisfaction */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          업무 만족도 히트맵
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Work Satisfaction Calendar Heatmap
        </p>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="space-y-2">
              {satisfactionHeatmapData.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-2">
                  <span className="text-xs w-8 text-right" style={{ color: '#666666' }}>
                    {row.day}
                  </span>
                  <div className="flex gap-1">
                    {row.satisfaction.map((value, colIndex) => {
                      const opacity = value / 10;
                      return (
                        <div
                          key={colIndex}
                          className="w-12 h-12 rounded flex items-center justify-center text-xs transition-all hover:scale-110 cursor-pointer"
                          style={{
                            backgroundColor: '#003366',
                            opacity: opacity,
                            color: value > 5 ? '#F9F8F3' : '#003366',
                          }}
                          title={`만족도: ${value}/10`}
                        >
                          {value}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <span className="text-xs" style={{ color: '#999999' }}>낮음</span>
              <div className="flex gap-1">
                {[0.3, 0.5, 0.7, 0.9].map((opacity, index) => (
                  <div
                    key={index}
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: '#003366', opacity }}
                  />
                ))}
              </div>
              <span className="text-xs" style={{ color: '#999999' }}>높음</span>
            </div>
          </div>
        </div>
      </div>

      {/* Combo Chart - Step Count & Spending Correlation */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          걸음 수 · 지출 상관관계
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Step Count · Spending Correlation
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={stepSpendingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '걸음 수', angle: -90, position: 'insideLeft', fill: '#666666' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '지출 (원)', angle: 90, position: 'insideRight', fill: '#666666' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="steps" fill="#003366" name="걸음 수" />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="spending" 
              stroke="#88B7DB" 
              strokeWidth={2}
              name="지출"
              dot={{ fill: '#88B7DB', r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Side-by-Side Bar Chart - Task Completion Rate */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          작업 완료율
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Task Completion Rate
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={taskCompletionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              dataKey="category" 
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
            <Bar dataKey="completed" fill="#003366" name="완료" />
            <Bar dataKey="pending" fill="#B5D5F0" name="진행 중" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Density Chart - Focus Intensity by Time Slot */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          시간대별 집중 강도
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Focus Intensity by Time Slot
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={focusIntensityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              dataKey="time" 
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
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
                borderRadius: '8px'
              }}
            />
            <Bar 
              dataKey="intensity" 
              fill="#003366"
              opacity={0.6}
              name="집중도"
            />
            <Line 
              type="monotone" 
              dataKey="intensity" 
              stroke="#003366" 
              strokeWidth={3}
              dot={{ fill: '#003366', r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
