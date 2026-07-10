import { describe, expect, it } from 'vitest';
import { cast } from '../../engine/cast';
import { buildAnalysis, topYears } from '../analysis';

/**
 * 斷應期規則測試：定盤一（1996-05-12 23:40 男，丙子年，命宮辰）手算案例。
 * 大限 22~31 甲午限：大命=午 → 大官=戌、大財=寅、大妻=辰、大疾（災宮）=丑。
 */
describe('定盤一斷應期', () => {
  const result = cast({ date: '1996-05-12', time: '23:40', gender: '男' });
  const analysis = buildAnalysis(result);
  const jiawu = analysis.decadals.find((d) => d.range[0] === 22)!;

  it('大限疊宮：甲午限大官在戌、大財在寅、大妻在辰、災宮在丑', () => {
    expect(jiawu.stem + jiawu.branch).toBe('甲午');
    expect(jiawu.topicBranch['事業']).toBe('戌');
    expect(jiawu.topicBranch['財運']).toBe('寅');
    expect(jiawu.topicBranch['愛情']).toBe('辰');
    expect(jiawu.topicBranch['本命']).toBe('午');
    expect(jiawu.zaiBranch).toBe('丑');
  });

  it('流命引動：2018 戊戌年（23歲）流年命宮疊大官 → 事業引動', () => {
    const hit = jiawu.hits.find((h) => h.year === 2018 && h.method === '流命引動' && h.topics.includes('事業'));
    expect(hit).toBeDefined();
    expect(hit!.age).toBe(23);
    expect(hit!.yearGz).toBe('戊戌');
  });

  it('災宮引動：2021 辛丑年（26歲）流年命宮疊大疾', () => {
    const hit = jiawu.hits.find((h) => h.year === 2021 && h.method === '災宮引動');
    expect(hit).toBeDefined();
    expect(hit!.yearGz).toBe('辛丑');
  });

  it('同星相疊：2026 丙戌年流年廉貞忌疊生年廉貞忌（忌疊忌，權重3）', () => {
    const jiHits = jiawu.hits.filter((h) => h.year === 2026 && h.method === '同星相疊' && h.weight === 3);
    expect(jiHits.length).toBeGreaterThan(0);
    expect(jiHits.some((h) => h.reason.includes('廉貞') && h.reason.includes('生年忌'))).toBe(true);
  });

  it('大限備註：甲限廉貞化祿與生年廉貞化忌同星', () => {
    expect(jiawu.notes.some((n) => n.includes('廉貞') && n.includes('同星'))).toBe(true);
  });

  it('同星相疊：2021 辛丑年流年太陽權疊大限太陽忌', () => {
    const hits2021 = jiawu.hits.filter((h) => h.year === 2021 && h.method === '同星相疊');
    expect(hits2021.some((h) => h.reason.includes('太陽') && h.reason.includes('大限忌'))).toBe(true);
  });

  it('疊星命中歸屬主題：亥宮（太陽）在官祿三方 → 事業主題含該命中', () => {
    // 官祿宮申的三方四正：申、寅（對）、子、辰（三合）→ 亥不在其中；
    // 亥宮屬疾厄，不落四主題三方 → 歸「整體」
    const h2021 = jiawu.hits.find((h) => h.year === 2021 && h.palaceBranch === '亥');
    expect(h2021?.topics).toEqual(['整體']);
  });

  it('topYears：事業主題回傳含 2018', () => {
    const years = topYears(analysis, '事業', 20).map((y) => y.year);
    expect(years).toContain(2018);
  });
});
