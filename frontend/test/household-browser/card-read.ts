// 실제 파서를 유지하면서 계정 전환 중 늦은 응답을 재현하는 합성 검증 전용 경계.
export * from '../../src/app/services/householdCardImport';
import { readHouseholdCardFile as realRead } from '../../src/app/services/householdCardImport';
let paused = false;
let resume: (() => void) | undefined;
export function pauseCardRead(value: boolean) { paused = value; }
export function resumeCardRead() { paused = false; resume?.(); resume = undefined; }
export async function readHouseholdCardFile(...args: Parameters<typeof realRead>) {
  if (paused) await new Promise<void>(resolve => { resume = resolve; });
  return realRead(...args);
}
