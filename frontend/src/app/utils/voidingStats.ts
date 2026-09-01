export type VoidingEntryType = 'drink' | 'void';

export type VoidingSymptom = '절박감' | '통증' | '유실' | '요의로 깸' | '없음';

export interface VoidingEntry {
  id: string;
  time: string;        // "HH:MM"
  type: VoidingEntryType;
  amountMl: number;
  symptom?: VoidingSymptom;
  note?: string;
}

export interface VoidingStats {
  totalDrinkMl: number;
  totalVoidMl: number;
  dayVoidMl: number;
  nightVoidMl: number;
  nightRatioPercent: number;
  isNocturiaSuspected: boolean;
  totalVoidCount: number;
  dayVoidCount: number;
  nightVoidCount: number;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isNightTime(time: string, bedtime: string, waketime: string): boolean {
  const t = toMinutes(time);
  const b = toMinutes(bedtime);
  const w = toMinutes(waketime);

  if (b > w) {
    // 자정을 넘기는 경우: 취침 이후 OR 기상 이전 → 야간
    return t > b || t < w;
  }
  // 같은 날 취침·기상: 취침~기상 사이만 야간
  return t > b && t < w;
}

export function calcVoidingStats(
  entries: VoidingEntry[],
  bedtime: string,
  waketime: string,
): VoidingStats {
  let totalDrinkMl = 0;
  let totalVoidMl = 0;
  let dayVoidMl = 0;
  let nightVoidMl = 0;
  let totalVoidCount = 0;
  let dayVoidCount = 0;
  let nightVoidCount = 0;

  for (const e of entries) {
    if (e.type === 'drink') {
      totalDrinkMl += e.amountMl;
    } else {
      totalVoidMl += e.amountMl;
      totalVoidCount++;
      if (isNightTime(e.time, bedtime, waketime)) {
        nightVoidMl += e.amountMl;
        nightVoidCount++;
      } else {
        dayVoidMl += e.amountMl;
        dayVoidCount++;
      }
    }
  }

  const nightRatioPercent = totalVoidMl > 0
    ? Math.round((nightVoidMl / totalVoidMl) * 1000) / 10
    : 0;

  return {
    totalDrinkMl,
    totalVoidMl,
    dayVoidMl,
    nightVoidMl,
    nightRatioPercent,
    isNocturiaSuspected: nightRatioPercent >= 30,
    totalVoidCount,
    dayVoidCount,
    nightVoidCount,
  };
}
