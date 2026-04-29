interface AnalysisData {
  chars: string;
  relationship: string;
  desire: string;
  shackle: string;
  events: string;
  theme: string;
}

export function ProphecyDiagram({ analysis }: { analysis: AnalysisData }) {
  const characters = analysis.chars
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div style={{
      background: '#fff', border: '0.5px solid #e5e7eb',
      borderRadius: 12, padding: 16, marginTop: 8,
    }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#1A3C6E', marginBottom: 10, marginTop: 0 }}>
        📊 이야기 흐름도
      </p>

      <svg viewBox="0 0 600 240" style={{ width: '100%', height: 'auto' }}>
        {characters.map((char, i) => {
          const x = 60 + i * 130;
          return (
            <g key={i}>
              <rect x={x} y={20} width={110} height={36} rx={8}
                fill="#FAF9F6" stroke="#1A3C6E" strokeWidth={1} />
              <text x={x + 55} y={43} fontSize={11} textAnchor="middle"
                fill="#1A3C6E" fontWeight={600}>
                {char.length > 8 ? char.slice(0, 8) + '…' : char}
              </text>
            </g>
          );
        })}

        {characters.length > 1 && (
          <text x={300} y={75} fontSize={10} textAnchor="middle" fill="#6b7280">
            {(analysis.relationship || '인간관계').slice(0, 30)}
          </text>
        )}

        <line x1={60} y1={130} x2={540} y2={130}
          stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" />

        {[
          { x: 30, label: '추구', value: analysis.desire },
          { x: 170, label: '극복', value: analysis.shackle },
          { x: 310, label: '사건', value: analysis.events },
          { x: 450, label: '주제', value: analysis.theme },
        ].map((step, i) => (
          <g key={i}>
            <rect x={step.x} y={110} width={120} height={50} rx={8}
              fill="#EEF3FA" stroke="#1A3C6E" strokeWidth={1} />
            <text x={step.x + 60} y={128} fontSize={10} textAnchor="middle"
              fill="#1A3C6E" fontWeight={700}>
              {step.label}
            </text>
            <text x={step.x + 60} y={146} fontSize={9} textAnchor="middle"
              fill="#6b7280">
              {(step.value || '미입력').slice(0, 14)}
            </text>
          </g>
        ))}

        {[150, 290, 430].map((x, i) => (
          <polygon key={i} points={`${x},130 ${x + 14},125 ${x + 14},135`}
            fill="#10b981" />
        ))}

        <text x={300} y={210} fontSize={11} textAnchor="middle"
          fill="#10b981" fontWeight={600}>
          {(analysis.theme || '주제').slice(0, 40)}
        </text>
      </svg>
    </div>
  );
}
