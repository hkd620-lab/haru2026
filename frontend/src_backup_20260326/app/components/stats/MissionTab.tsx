import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Treemap } from 'recharts';

const ministryFieldData = [
  { x: 45, y: 78, z: 850, label: '예배' },
  { x: 62, y: 85, z: 1200, label: '소그룹' },
  { x: 38, y: 62, z: 650, label: '봉사' },
  { x: 75, y: 52, z: 920, label: '전도' },
  { x: 55, y: 70, z: 1100, label: '교육' },
];

const energyWeightData = [
  { name: '기도', size: 3500, fill: '#003366' },
  { name: '말씀', size: 3000, fill: '#2D5F8D' },
  { name: '교제', size: 2500, fill: '#5B8BB4' },
  { name: '섬김', size: 2200, fill: '#88B7DB' },
  { name: '찬양', size: 1800, fill: '#B5D5F0' },
  { name: '나눔', size: 1500, fill: '#C8E0F7' },
];

const graceChangeData = [
  { date: '2/10', grace: 65, change: 58 },
  { date: '2/11', grace: 70, change: 62 },
  { date: '2/12', grace: 68, change: 65 },
  { date: '2/13', grace: 75, change: 70 },
  { date: '2/14', grace: 72, change: 68 },
  { date: '2/15', grace: 78, change: 75 },
  { date: '2/16', grace: 80, change: 78 },
];

const prayerResponseData = [
  { date: '2/10', response: 2 },
  { date: '2/11', response: 2 },
  { date: '2/12', response: 3 },
  { date: '2/13', response: 3 },
  { date: '2/14', response: 4 },
  { date: '2/15', response: 4 },
  { date: '2/16', response: 5 },
];

const CustomizedTreemapContent = (props: any) => {
  const { x, y, width, height, name, size } = props;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: props.fill,
          stroke: '#fff',
          strokeWidth: 2,
        }}
      />
      {width > 60 && height > 40 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 8}
            textAnchor="middle"
            fill="#F9F8F3"
            fontSize={14}
            fontWeight={500}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 12}
            textAnchor="middle"
            fill="#F9F8F3"
            fontSize={12}
          >
            {size}
          </text>
        </>
      )}
    </g>
  );
};

export function MissionTab() {
  return (
    <div className="space-y-6">
      {/* Bubble Chart - Ministry Field Distribution */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          사역 분야 분포
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Ministry Field Distribution
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              type="number" 
              dataKey="x" 
              name="빈도"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '빈도', position: 'insideBottom', offset: -10, fill: '#666666' }}
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name="강도"
              tick={{ fill: '#999999', fontSize: 12 }}
              stroke="#e5e5e5"
              label={{ value: '강도', angle: -90, position: 'insideLeft', fill: '#666666' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e5e5',
                borderRadius: '8px'
              }}
              formatter={(value: any, name: string, props: any) => {
                if (name === 'z') return [props.payload.label, '분야'];
                return [value, name];
              }}
            />
            <Scatter 
              name="사역 분야" 
              data={ministryFieldData} 
              fill="#003366"
            >
              {ministryFieldData.map((entry, index) => {
                const size = entry.z / 20;
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

      {/* Treemap - Ministry Energy Weight */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          사역 에너지 가중치
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Ministry Energy Weight
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <Treemap
            data={energyWeightData}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#fff"
            content={<CustomizedTreemapContent />}
          />
        </ResponsiveContainer>
      </div>

      {/* Area Chart - Grace & Inner Change Trend */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          은혜와 내적 변화 추세
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Grace & Inner Change Trend
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={graceChangeData}>
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
              dataKey="grace" 
              stackId="1"
              stroke="#003366" 
              fill="#003366"
              fillOpacity={0.6}
              name="은혜"
            />
            <Area 
              type="monotone" 
              dataKey="change" 
              stackId="1"
              stroke="#88B7DB" 
              fill="#88B7DB"
              fillOpacity={0.6}
              name="내적 변화"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Step Chart - Prayer Response Continuity */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-base mb-2 tracking-wide" style={{ color: '#003366' }}>
          기도 응답 연속성
        </h3>
        <p className="text-xs mb-6" style={{ color: '#999999' }}>
          Prayer Response Continuity
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={prayerResponseData}>
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
              type="step" 
              dataKey="response" 
              stroke="#003366" 
              fill="#003366"
              fillOpacity={0.3}
              strokeWidth={2}
              name="응답 수준"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
