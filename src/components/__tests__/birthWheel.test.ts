import { describe, expect, it } from 'vitest';
import { clampDay, daysInMonth, pad2 } from '../birthWheel';

describe('daysInMonth', () => {
  it('大小月', () => {
    expect(daysInMonth(1995, 1)).toBe(31);
    expect(daysInMonth(1995, 4)).toBe(30);
    expect(daysInMonth(1995, 2)).toBe(28);
  });
  it('閏年 2 月', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29); // 400 倍數閏
    expect(daysInMonth(1900, 2)).toBe(28); // 100 倍數不閏
  });
});

describe('clampDay', () => {
  it('超過月底夾回', () => {
    expect(clampDay(1995, 2, 31)).toBe(28);
    expect(clampDay(2024, 2, 30)).toBe(29);
  });
  it('合法值不動', () => {
    expect(clampDay(1995, 1, 31)).toBe(31);
  });
});

describe('pad2', () => {
  it('零填充', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(12)).toBe('12');
  });
});
