/** 出生時間滾輪的日期輔助：月天數與日數夾回（month 為 1–12） */

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
