// 개발자 계정 판별(홈·하단 탭이 쓰는 값과 같다). 화면 노출 제한용이며 권한 검증은 서버 Rules·함수가 맡는다.
const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export function isDeveloperUid(uid: string | null | undefined): boolean {
  return uid === DEVELOPER_UID;
}
