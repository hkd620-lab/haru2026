import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const recordTypeData = [
  { name: 'Diary', value: 45, color: '#003366' },
  { name: 'Essay', value: 12, color: '#2D5F8D' },
  { name: 'Mission', value: 8, color: '#5B8BB4' },
  { name: 'General', value: 15, color: '#88B7DB' },
  { name: 'Work', value: 32, color: '#B5D5F0' },
  { name: 'Travel', value: 8, color: '#C8E0F7' },
];

const weeklyActivityData = [
  { week: 'W1', records: 12, avgLength: 450 },
  { week: 'W2', records: 15, avgLength: 520 },
  { week: 'W3', records: 18, avgLength: 480 },
  { week: 'W4', records: 14, avgLength: 510 },
];

const monthlyTrendData = [
  { month: 'Jan', count: 28 },
  { month: 'Feb', count: 32 },
  { month: 'Mar', count: 45 },
  { month: 'Apr', count: 38 },
  { month: 'May', count: 52 },
  { month: 'Jun', count: 48 },
];

export function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>
            총 기록 수
          </p>
          <p className="text-2xl md:text-3xl" style={{ color: '#003366' }}>
            120
          </p>
        </div>
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>
            평균 작성 길이
          </p>
          <p className="text-2xl md:text-3xl" style={{ color: '#003366' }}>
            490
          </p>
        </div>
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>
            연속 기록 일
          </p>
          <p className="text-2xl md:text-3xl" style={{ color: '#003366' }}>
            15
          </p>
        </div>
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>
            가장 활발한 형식
          </p>
          <p className="text-lg md:text-xl" style={{ color: '#003366' }}>
            Diary
          </p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Record Type Distribution */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-base mb-6 tracking-wide" style={{ color: '#003366' }}>
            형식별 기록 분포
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={recordTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {recordTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Trend */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-base mb-6 tracking-wide" style={{ color: '#003366' }}>
            월별 기록 추이
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis 
                dataKey="month" 
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
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#003366" 
                strokeWidth={2}
                dot={{ fill: '#003366', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-6 tracking-wide" style={{ color: '#003366' }}>
          주간 활동 분석
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyActivityData}>
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
            <Bar dataKey="records" fill="#003366" name="기록 수" />
            <Bar dataKey="avgLength" fill="#88B7DB" name="평균 길이" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
