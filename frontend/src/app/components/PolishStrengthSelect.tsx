import { useEffect } from 'react';
import { toast } from 'sonner';

export type PolishStrength = 'WEAK' | 'STRONG';
const GUIDE_STORAGE_KEY = 'haru-polish-strength-guide-hidden-v1';
const GUIDE_TOAST_ID = 'haru-polish-strength-guide';

export function PolishStrengthSelect({ onChange, disabled = false, showGuide = true }: {
  onChange: (value: PolishStrength) => void;
  disabled?: boolean;
  showGuide?: boolean;
}) {
  useEffect(() => {
    if (!showGuide) return;
    try {
      if (window.localStorage.getItem(GUIDE_STORAGE_KEY) === '1') return;
    } catch { /* 저장소를 사용할 수 없어도 안내는 표시한다. */ }

    toast.custom((toastId) => (
      <div className="w-[min(92vw,420px)] rounded-xl border border-[#bfd1e8] bg-white p-4 text-left shadow-xl">
        <p className="text-base font-bold text-[#1A3C6E]">약·강 다듬기 안내</p>
        <p className="mt-2 text-sm leading-6 text-[#374151]"><strong>약</strong>은 원문의 문장과 흐름을 자연스럽게 정돈합니다.</p>
        <p className="mt-1 text-sm leading-6 text-[#374151]"><strong>강</strong>은 원문에 있는 사실과 감정을 바탕으로 표현을 더 풍성하게 풀어 씁니다.</p>
        <p className="mt-1 text-xs leading-5 text-[#6B7280]">보고·관찰 기록은 사실 중심으로 다듬습니다. 결과를 확인한 뒤 저장해 주세요.</p>
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
  }, [showGuide]);

  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: '16px 0', minWidth: 0 }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: '#1A3C6E', marginBottom: 8 }}>다듬기 정도</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {([
          ['WEAK', '약', '문장과 흐름을 자연스럽게'],
          ['STRONG', '강', '원문의 내용을 더 풍성하게'],
        ] as const).map(([strength, label, description]) => (
          <button
            key={strength}
            type="button"
            onClick={() => onChange(strength)}
            className="rounded-lg border border-[#93a9c2] bg-white p-3 text-left text-[#1A3C6E] disabled:opacity-50"
          >
            <span className="block font-bold">{label}</span>
            <span className="mt-1 block text-xs text-[#4B5563]">{description}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
