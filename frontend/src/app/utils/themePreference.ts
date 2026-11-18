export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
// Screens outside this audited set retain their existing light appearance.
export function supportsDarkTheme(pathname: string): boolean {
  return ['/', '/v2', '/sayu', '/sayu-together', '/settings', '/record'].includes(pathname);
}
export function readThemePreference(saved: string | null): ThemePreference {
  return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'light';
}
export function resolveTheme(preference: ThemePreference, systemDark: boolean, pathname: string): Theme {
  if (!supportsDarkTheme(pathname)) return 'light';
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}
