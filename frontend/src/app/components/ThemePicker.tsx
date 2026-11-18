import { useId } from 'react';
import { useTheme } from '../contexts/ThemeContext';
export function ThemePicker() {
  const name = useId();
  const { preference, setPreference } = useTheme();
  return <fieldset className="haru-theme-picker">
    <legend>화면 테마</legend>
    <div>{([['system', '기기 설정'], ['light', '라이트'], ['dark', '다크']] as const).map(([value, label]) =>
      <label key={value}><input type="radio" name={name} value={value} checked={preference === value} onChange={() => setPreference(value)} /><span>{label}</span></label>
    )}</div>
  </fieldset>;
}
