// 기록 알림 판정 — 사용자가 고른 알림 시각과 '오늘'은 사용자의 시간대 기준이다.
// 시간대는 알림 설정 저장 시 기기 시간대(IANA, 예: 'Asia/Seoul')를 notificationTimeZone 으로 함께 저장한다.
// 값이 없거나(기존 사용자) 잘못되었으면 한국 시간으로 본다.
// Functions 실행 환경의 기본 시간대는 UTC 이므로 Date#getHours·toISOString 을 그대로 쓰지 않는다.

export const DEFAULT_NOTIFICATION_TIME_ZONE = 'Asia/Seoul';
export const DEFAULT_NOTIFICATION_TIME = '21:00';

export type ZonedClock = {
  timeZone: string;
  hour: number;
  minute: number;
  dateKey: string; // YYYY-MM-DD — records 문서의 date 필드 형식(기기 현지 날짜)
};

export function resolveNotificationTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_NOTIFICATION_TIME_ZONE;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).resolvedOptions().timeZone;
  } catch {
    return DEFAULT_NOTIFICATION_TIME_ZONE;
  }
}

export function getZonedClock(now: Date, timeZone: string): ZonedClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return {
    timeZone,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

// 스케줄러는 매시 정각(UTC 기준 매시)에 한 번 돈다. 그 실행 시점의 사용자 현지 '시'가 설정한 시와 같으면 보낸다.
// 분은 보지 않는다(기존 동작). 30·45분 시차 지역은 현지 HH:30·HH:45 에 발송된다.
// 서머타임이 끝나는 날 같은 현지 시가 다시 오면(1시간 후퇴, Antarctica/Troll 같은 2시간 후퇴 포함), 직전 실행들 중
// 같은 현지 날짜·같은 시가 이미 있었는지 보고 처음 한 번만 보낸다.
export const DST_REPEAT_LOOKBACK_HOURS = 3;

export function isNotificationDue(notificationTime: unknown, clock: ZonedClock, earlier: ZonedClock[] = []): boolean {
  const time = typeof notificationTime === 'string' && notificationTime ? notificationTime : DEFAULT_NOTIFICATION_TIME;
  const [targetHour] = time.split(':').map(Number);
  if (clock.hour !== targetHour) return false;
  return !earlier.some((past) => past.dateKey === clock.dateKey && past.hour === clock.hour);
}

// 사용자 현지 기준 지금 시각과 직전 1~3시간 실행 시각(서머타임 반복 시각 판정용)
export function getNotificationClocks(now: Date, timeZone: string): { clock: ZonedClock; earlier: ZonedClock[] } {
  const earlier: ZonedClock[] = [];
  for (let hours = 1; hours <= DST_REPEAT_LOOKBACK_HOURS; hours += 1) {
    earlier.push(getZonedClock(new Date(now.getTime() - hours * 60 * 60 * 1000), timeZone));
  }
  return { clock: getZonedClock(now, timeZone), earlier };
}
