import { useId } from 'react';

export type PolishStrength = 'WEAK' | 'STRONG';

export function PolishStrengthSelect({ value, onChange, disabled = false }: {
  value: PolishStrength;
  onChange: (value: PolishStrength) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: '16px 0', minWidth: 0 }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>다듬기 정도</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {([
          ['WEAK', '약', '문장과 흐름을 자연스럽게'],
          ['STRONG', '강', '원문의 내용을 더 풍성하게'],
        ] as const).map(([strength, label, description]) => (
          <label key={strength} style={{ display: 'block', padding: 12, border: `1px solid ${value === strength ? '#059669' : '#D1D5DB'}`, borderRadius: 8, background: value === strength ? '#ECFDF5' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#1A3C6E' }}>
              <input type="radio" name={name} value={strength} checked={value === strength} onChange={() => onChange(strength)} />
              {label}
            </span>
            <span style={{ display: 'block', fontSize: 12, lineHeight: 1.5, marginTop: 6, color: '#4B5563' }}>{description}</span>
          </label>
        ))}
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: '#6B7280', margin: '8px 0 0' }}>둘 다 원문의 사실과 감정을 지키며, 없는 내용을 만들거나 덧붙이지 않아요.</p>
    </fieldset>
  );
}
