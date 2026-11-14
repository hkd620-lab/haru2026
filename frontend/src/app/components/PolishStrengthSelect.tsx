import { useEffect, useId } from 'react';
import { toast } from 'sonner';

export type PolishStrength = 'WEAK' | 'STRONG';
const GUIDE_STORAGE_KEY = 'haru-polish-strength-guide-hidden-v1';
const GUIDE_TOAST_ID = 'haru-polish-strength-guide';

export function PolishStrengthSelect({ value, onChange, disabled = false, saveImmediately = false, runOnClick = false }: {
  value: PolishStrength;
  onChange: (value: PolishStrength) => void;
  disabled?: boolean;
  saveImmediately?: boolean;
  runOnClick?: boolean;
}) {
  const name = useId();
  useEffect(() => {
    try {
      if (window.localStorage.getItem(GUIDE_STORAGE_KEY) === '1') return;
    } catch { /* 저장소를 사용할 수 없어도 안내는 표시한다. */ }

    toast.custom((toastId) => (
      <div className="w-[min(92vw,420px)] rounded-xl border border-[#bfd1e8] bg-white p-4 text-left shadow-xl">
        <p className="text-base font-bold text-[#1A3C6E]">약·강 다듬기 안내</p>
        <p className="mt-2 text-sm leading-6 text-[#374151]"><strong>약</strong>은 원문의 문장과 흐름을 자연스럽게 정돈합니다.</p>
        <p className="mt-1 text-sm leading-6 text-[#374151]"><strong>강</strong>은 내용을 더 풍성하게 풀어 씁니다. 일기·에세이·여행기록에서는 상황과 감정을 추정해 묘사할 수 있습니다.</p>
        <p className="mt-1 text-xs leading-5 text-[#6B7280]">보고·관찰 기록은 사실 중심으로 다듬습니다. {saveImmediately ? '다시 다듬기 결과는 바로 저장되니 확인 후 필요하면 수정해 주세요.' : '결과를 확인한 뒤 저장해 주세요.'}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#374151]">
            <input
              type="checkbox"
              className="h-4 w-4"
              onChange={(event) => {
                if (!event.target.checked) return;
                try { window.localStorage.setItem(GUIDE_STORAGE_KEY, '1'); } catch { /* 저장소를 사용할 수 없으면 다음에 다시 안내한다. */ }
                toast.dismiss(toastId);
              }}
            />
            다시 보지 않기
          </label>
          <button type="button" onClick={() => toast.dismiss(toastId)} className="min-h-9 rounded-lg bg-[#1A3C6E] px-4 text-sm font-semibold text-white">닫기</button>
        </div>
      </div>
    ), { id: GUIDE_TOAST_ID, duration: Infinity, position: 'top-center' });
    return () => toast.dismiss(GUIDE_TOAST_ID);
  }, [saveImmediately]);

  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: '16px 0', minWidth: 0 }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>다듬기 정도</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {([
          ['WEAK', '약', '문장과 흐름을 자연스럽게'],
          ['STRONG', '강', '원문의 내용을 더 풍성하게'],
        ] as const).map(([strength, label, description]) => runOnClick ? (
          <button
            key={strength}
            type="button"
            onClick={() => onChange(strength)}
            className="rounded-lg border border-[#93a9c2] bg-white p-3 text-left text-[#1A3C6E] disabled:opacity-50"
          >
            <span className="block font-bold">{label}</span>
            <span className="mt-1 block text-xs text-[#4B5563]">{description}</span>
          </button>
        ) : (
          <label key={strength} style={{ display: 'block', padding: 12, border: `1px solid ${value === strength ? '#059669' : '#D1D5DB'}`, borderRadius: 8, background: value === strength ? '#ECFDF5' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#1A3C6E' }}>
              <input type="radio" name={name} value={strength} checked={value === strength} onChange={() => onChange(strength)} />
              {label}
            </span>
            <span style={{ display: 'block', fontSize: 12, lineHeight: 1.5, marginTop: 6, color: '#4B5563' }}>{description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
