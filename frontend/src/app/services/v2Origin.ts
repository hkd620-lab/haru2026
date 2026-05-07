// v2 진입 흔적을 sessionStorage로 보관해서, 통계/합본 등 깊은 경로에서
// 닫기를 눌러도 v2 홈으로 일관되게 복귀할 수 있도록 한다.
//
// - HomePageV2 마운트 시 setOrigin('/v2')
// - HomePage(v1) 마운트 시 clearOrigin()
// - 모든 닫기 핸들러: closeFallback(navigate) 호출 → origin 있으면 그쪽, 없으면 '/'

const ORIGIN_KEY = 'haru_origin';

export function setOrigin(path: string): void {
  try {
    sessionStorage.setItem(ORIGIN_KEY, path);
  } catch {
    // sessionStorage 비활성 브라우저는 무시
  }
}

export function getOrigin(): string | null {
  try {
    return sessionStorage.getItem(ORIGIN_KEY);
  } catch {
    return null;
  }
}

export function clearOrigin(): void {
  try {
    sessionStorage.removeItem(ORIGIN_KEY);
  } catch {
    // 무시
  }
}

// 닫기 fallback: fromPath가 없을 때 origin → '/' 순서로 이동
export function closeFallback(navigate: (path: string) => void): void {
  const origin = getOrigin();
  navigate(origin || '/');
}
