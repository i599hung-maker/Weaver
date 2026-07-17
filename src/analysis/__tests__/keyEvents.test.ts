import { describe, expect, it } from 'vitest';
import type { ChartAnalysis } from '../analysis';
import type { TriggerHit } from '../trigger';
import { selectKeyEvents } from '../reportBook';
import { cast } from '../../engine/cast';
import { buildAnalysis } from '../analysis';
import { buildBookChapters, buildBookData } from '../reportBook';

const CURRENT = 2026;

/** 手作單筆命中：selectKeyEvents 只讀 year/age/yearGz/method/weight/reason */
function hit(year: number, birthYear: number, weight = 2, method: TriggerHit['method'] = '流命引動'): TriggerHit {
  return { year, age: year - birthYear + 1, yearGz: '甲子', method, topics: ['本命'], weight, reason: `${year}年測試命中` };
}

/** 手作最小 ChartAnalysis：只帶 decadals[].hits */
function fakeAnalysis(hits: TriggerHit[]): ChartAnalysis {
  return { decadals: [{ hits }] } as unknown as ChartAnalysis;
}

/** 產生連續年份命中 */
function yearsRange(from: number, to: number, birthYear: number, weight = 2): TriggerHit[] {
  const out: TriggerHit[] = [];
  for (let y = from; y <= to; y++) out.push(hit(y, birthYear, weight));
  return out;
}

describe('selectKeyEvents 過往池（年齡級距）', () => {
  it('<35 歲：回看 8 年、最多 6 筆、同權取較近年', () => {
    const birthYear = 1996; // 虛歲 31
    const events = selectKeyEvents(fakeAnalysis(yearsRange(2000, 2025, birthYear)), CURRENT, birthYear);
    const past = events.filter((e) => e.isPast);
    // 窗口 2018~2025 全是同權重 → 取較近的 2020~2025 六筆
    expect(past.map((e) => e.year)).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  });

  it('35~55 歲：回看 15 年、最多 9 筆', () => {
    const birthYear = 1980; // 虛歲 47
    const events = selectKeyEvents(fakeAnalysis(yearsRange(1990, 2025, birthYear)), CURRENT, birthYear);
    const past = events.filter((e) => e.isPast);
    expect(past).toHaveLength(9);
    for (const e of past) expect(e.year).toBeGreaterThanOrEqual(CURRENT - 15);
  });

  it('>55 歲：回看 25 年、最多 12 筆', () => {
    const birthYear = 1960; // 虛歲 67
    const events = selectKeyEvents(fakeAnalysis(yearsRange(1980, 2025, birthYear)), CURRENT, birthYear);
    const past = events.filter((e) => e.isPast);
    expect(past).toHaveLength(12);
    for (const e of past) expect(e.year).toBeGreaterThanOrEqual(CURRENT - 25);
  });

  it('級距邊界：55 歲回看 15 年（撈不到 2003）、56 歲回看 25 年（撈得到）', () => {
    // 2003 給權重 3：若在窗口內必進前幾名，用它探測回看範圍
    const pastYears = (birthYear: number) =>
      selectKeyEvents(fakeAnalysis([...yearsRange(2018, 2025, birthYear), hit(2003, birthYear, 3)]), CURRENT, birthYear)
        .filter((e) => e.isPast)
        .map((e) => e.year);
    expect(pastYears(1972)).not.toContain(2003); // 虛歲 55 → 35~55 級距，窗口 2011 起
    expect(pastYears(1971)).toContain(2003); // 虛歲 56 → >55 級距，窗口 2001 起
  });

  it('級距邊界：34 歲回看 8 年（撈不到 2015）、35 歲回看 15 年（撈得到）', () => {
    // 2015 給權重 3：若在窗口內必進前幾名，用它探測回看範圍
    const pastYears = (birthYear: number) =>
      selectKeyEvents(fakeAnalysis([...yearsRange(2022, 2025, birthYear), hit(2015, birthYear, 3)]), CURRENT, birthYear)
        .filter((e) => e.isPast)
        .map((e) => e.year);
    expect(pastYears(1993)).not.toContain(2015); // 虛歲 34 → <35 級距，窗口 2018 起
    expect(pastYears(1992)).toContain(2015); // 虛歲 35 → 35~55 級距，窗口 2011 起
  });

  it('年輕命主：過往窗口整段早於虛歲 15 時過往池為空、不報錯', () => {
    const birthYear = 2015; // 虛歲 12，下限 2029 > 今年 → 過往全被擋
    const events = selectKeyEvents(fakeAnalysis(yearsRange(2018, 2030, birthYear)), CURRENT, birthYear);
    expect(events.filter((e) => e.isPast)).toHaveLength(0);
    expect(events.filter((e) => !e.isPast).length).toBeGreaterThan(0);
  });

  it('過往入選年份虛歲不早於 15', () => {
    const birthYear = 2010; // 虛歲 17，回看 8 年窗口踩到童年
    const events = selectKeyEvents(fakeAnalysis(yearsRange(2018, 2025, birthYear)), CURRENT, birthYear);
    const past = events.filter((e) => e.isPast);
    // 下限 birthYear+14 = 2024 → 只剩 2024、2025
    expect(past.map((e) => e.year)).toEqual([2024, 2025]);
  });

  it('權重門檻：weight 1 的疊星不入選', () => {
    const birthYear = 1980;
    const hits = [hit(2024, birthYear, 1, '同星相疊'), hit(2025, birthYear, 2)];
    const past = selectKeyEvents(fakeAnalysis(hits), CURRENT, birthYear).filter((e) => e.isPast);
    expect(past.map((e) => e.year)).toEqual([2025]);
  });
});

describe('selectKeyEvents 未來池', () => {
  it('今年~+22 年取權重前 12、今年命中必收、不佔過往名額', () => {
    const birthYear = 1980;
    // 今年 weight 2；2027~2039 十三筆 weight 3 → 前 12 擠掉今年，但今年必收
    const hits = [hit(CURRENT, birthYear, 2), ...yearsRange(2027, 2039, birthYear, 3)];
    const events = selectKeyEvents(fakeAnalysis(hits), CURRENT, birthYear);
    const future = events.filter((e) => !e.isPast);
    expect(future).toHaveLength(12);
    expect(future.some((e) => e.isCurrent)).toBe(true);
    expect(events.filter((e) => e.isPast)).toHaveLength(0);
  });

  it('超過 +22 年不入選', () => {
    const birthYear = 1996;
    const events = selectKeyEvents(fakeAnalysis([hit(CURRENT + 23, birthYear, 3)]), CURRENT, birthYear);
    expect(events).toHaveLength(0);
  });

  it('合併結果依年份升冪且 isPast 標記正確', () => {
    const birthYear = 1960;
    const events = selectKeyEvents(fakeAnalysis(yearsRange(1980, 2048, birthYear)), CURRENT, birthYear);
    const years = events.map((e) => e.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    for (const e of events) expect(e.isPast).toBe(e.year < CURRENT);
  });
});

describe('eventsPrompt 過往/未來分列', () => {
  const result = cast({ date: '1960-09-20', time: '10:30', gender: '女' }); // 高齡命主，過往池必有料
  const analysis = buildAnalysis(result);
  const book = buildBookData(result, analysis, CURRENT);
  const prompt = buildBookChapters(analysis, book, CURRENT).find((c) => c.key === 'events')!.prompt;

  it('年份清單分列過往與未來', () => {
    expect(prompt).toContain('【過往年份（對答案）】');
    expect(prompt).toContain('【未來年份】');
  });

  it('advice 語意分流：過往寫驗證點、未來給建議', () => {
    expect(prompt).toContain('驗證點');
    expect(prompt).toContain('命中自述');
  });

  it('年份清單仍要求一一對應全部年份', () => {
    const allYears = book.events.map((e) => e.year).join('、');
    expect(prompt).toContain(allYears);
  });
});
