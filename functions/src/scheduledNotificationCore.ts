// 기록 알림 판정 — 사용자가 고른 알림 시각과 '오늘'은 한국 시간(Asia/Seoul) 기준이다.
// Functions 실행 환경의 기본 시간대는 UTC 이므로 Date#getHours·toISOString 을 그대로 쓰지 않는다.

export const NOTIFICATION_TIME_ZONE = 'Asia/Seoul';
export const DEFAULT_NOTIFICATION_TIME = '21:00';

export type SeoulClock = {
  hour: number;
  minute: number;
  dateKey: string; // YYYY-MM-DD — records 문서의 date 필드 형식
};

export function getSeoulClock(now: Date): SeoulClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NOTIFICATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

// 매시 정각 실행에서 사용자의 알림 시각과 같은 시(정각)인지 본다.
export function isNotificationDue(notificationTime: unknown, clock: SeoulClock): boolean {
  const time = typeof notificationTime === 'string' && notificationTime ? notificationTime : DEFAULT_NOTIFICATION_TIME;
  const [targetHour] = time.split(':').map(Number);
  return clock.hour === targetHour && clock.minute === 0;
}
