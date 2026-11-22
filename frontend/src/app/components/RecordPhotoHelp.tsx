import { useSyncExternalStore } from 'react';

const HIDDEN_KEY = 'haru:record-photo-help-hidden';
let hiddenForSession = false;

function isHidden() {
  try {
    return hiddenForSession || window.localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return hiddenForSession;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(HIDDEN_KEY, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(HIDDEN_KEY, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function hideHelp() {
  try {
    window.localStorage.setItem(HIDDEN_KEY, '1');
  } catch {
    hiddenForSession = true;
  }
  window.dispatchEvent(new Event(HIDDEN_KEY));
}

export function RecordPhotoHelp() {
  const hidden = useSyncExternalStore(subscribe, isHidden, () => false);
  if (hidden) return null;

  return (
    <details className="mt-2 text-xs leading-relaxed text-gray-600">
      <summary className="w-fit cursor-pointer font-medium text-[#1A3C6E]">
        Mac·Windows에서 사진 추가하는 방법
      </summary>
      <ul className="mt-1 space-y-1">
        <li>
          <strong>Mac</strong> · 사진 선택 창에서 Mac에 저장된 파일을 고르세요. 사진 앱에 있다면
          원하는 사진을 선택하고 ‘파일 → 내보내기 → 사진 내보내기’에서 JPEG로 저장한 뒤 고르세요.
        </li>
        <li>
          <strong>Windows</strong> · 사진 선택 창에서 ‘사진’이나 ‘다운로드’ 폴더의 파일을 고르세요.
          OneDrive에만 있는 사진은 파일 탐색기에서 먼저 열어 다운로드한 뒤 고르세요.
        </li>
      </ul>
      <label className="mt-2 inline-flex cursor-pointer items-center gap-2">
        <input type="checkbox" onChange={hideHelp} />
        이 브라우저에서 다시 보지 않기
      </label>
    </details>
  );
}
