import { useEffect, useId, useRef } from 'react';
import { toast } from 'sonner';

export type PolishStrength = 'WEAK' | 'STRONG';
const GUIDE_STORAGE_KEY = 'haru-polish-strong-guide-hidden';

export function PolishStrengthSelect({ onChange, disabled = false }: {
  onChange: (value: PolishStrength) => void;
  disabled?: boolean;
}) {
  const toastId = useId();
  const pending = useRef(false);
  const current = useRef({ onChange, disabled });

  useEffect(() => {
    current.current = { onChange, disabled };
  }, [onChange, disabled]);

  useEffect(() => () => {
    if (pending.current) toast.dismiss(toastId);
    pending.current = false;
  }, [disabled, toastId]);

  function chooseStrength(strength: PolishStrength) {
    if (disabled) return;
    if (strength === 'WEAK') {
      if (pending.current) toast.dismiss(toastId);
      pending.current = false;
      onChange(strength);
      return;
    }
    if (pending.current) return;

    let hideGuide = false;
    try {
      hideGuide = window.localStorage.getItem(GUIDE_STORAGE_KEY) === '1';
    } catch { /* 저장소를 사용할 수 없어도 안내는 표시한다. */ }
    if (hideGuide) {
      onChange(strength);
      return;
    }

    pending.current = true;
    const closeGuide = () => {
      pending.current = false;
      toast.dismiss(toastId);
    };
    toast.custom(() => (
      <div className="w-[min(92vw,420px)] rounded-xl border border-[#bfd1e8] bg-white p-4 text-left shadow-xl">
        <p className="text-base font-bold text-[#1A3C6E]">강하게 다듬기</p>
        <p className="mt-2 text-sm leading-6 text-[#374151]">
          원본을 바탕으로 글을 더 풍성하게 다듬어요. 장면과 분위기를 살리기 위해 묘사나 문장이 추가될 수 있어요.
        </p>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[#374151]">
          <input
            type="checkbox"
            className="h-4 w-4"
            onChange={(event) => {
              try {
                if (event.target.checked) window.localStorage.setItem(GUIDE_STORAGE_KEY, '1');
                else window.localStorage.removeItem(GUIDE_STORAGE_KEY);
              } catch { /* 저장소를 사용할 수 없으면 다음에 다시 안내한다. */ }
            }}
          />
          이 안내 다시 보지 않기
        </label>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={closeGuide} className="min-h-9 rounded-lg border border-[#93a9c2] px-4 text-sm font-semibold text-[#1A3C6E]">닫기</button>
          <button type="button" onClick={() => {
            if (!pending.current) return;
            closeGuide();
            if (!current.current.disabled) current.current.onChange(strength);
          }} className="min-h-9 rounded-lg bg-[#1A3C6E] px-4 text-sm font-semibold text-white">다듬기</button>
        </div>
      </div>
    ), {
      id: toastId,
      duration: Infinity,
      position: 'top-center',
      dismissible: false,
    });
  }

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
            onClick={() => chooseStrength(strength)}
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
