/**
 * 真太陽時 = 鐘錶時間 + 經度修正 + 均時差。
 * 文墨天機以真太陽時定時辰；此處用 NOAA 簡化均時差公式（誤差 < 1 分鐘）。
 */

/** 均時差（分鐘），dayOfYear 由 1 起算 */
export function equationOfTime(dayOfYear: number): number {
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

function dayOfYear(y: number, m: number, d: number): number {
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return cum[m - 1] + d + (leap && m > 2 ? 1 : 0);
}

export interface SolarTimeResult {
  date: string; // YYYY-MM-DD
  hm: string; // HH:MM
}

/** 把鐘錶時間換算為真太陽時（可能跨日） */
export function toTrueSolarTime(
  date: string,
  time: string,
  longitude: number,
  tzOffset = 8,
): SolarTimeResult {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const offsetMin = 4 * (longitude - 15 * tzOffset) + equationOfTime(dayOfYear(y, m, d));
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm));
  t.setUTCMinutes(t.getUTCMinutes() + Math.round(offsetMin));
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    hm: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  };
}
