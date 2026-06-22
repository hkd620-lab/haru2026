// Growth percentile helpers for HARU child records.

export function calcAgeInMonths(birthdate: string, measureDate: string): number {
  const birth = new Date(birthdate + "T00:00:00");
  const measure = new Date(measureDate + "T00:00:00");

  if (Number.isNaN(birth.getTime()) || Number.isNaN(measure.getTime()) || measure < birth) {
    return 0;
  }

  let months = (measure.getFullYear() - birth.getFullYear()) * 12 + (measure.getMonth() - birth.getMonth());
  if (measure.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, Math.min(83, months));
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absX);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function calcPercentile(X: number, L: number, M: number, S: number): number {
  if (!Number.isFinite(X) || X <= 0 || !Number.isFinite(M) || M <= 0 || !Number.isFinite(S) || S <= 0) return 0;

  const z = L === 0
    ? Math.log(X / M) / S
    : (Math.pow(X / M, L) - 1) / (L * S);

  return Math.max(0, Math.min(100, Math.round(normalCDF(z) * 100)));
}
