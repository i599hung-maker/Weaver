import { describe, expect, it } from 'vitest';
import { cast } from '../../engine/cast';
import { buildAnalysis, buildPrompt } from '../analysis';
import { buildFullReportChapters, buildReportHeader } from '../reportPrompts';

/**
 * 命書報告 prompt 組裝測試：命例 1996-05-12 23:40 男（晚子時，丙子年）
 */

const result = cast({ date: '1996-05-12', time: '23:40', gender: '男' });
const analysis = buildAnalysis(result);

describe('buildReportHeader', () => {
  it('欄位齊全且與 analysis.header / meta 一致', () => {
    const h = buildReportHeader(analysis, result.meta);
    expect(h.gender).toBe(analysis.header.gender);
    expect(h.yinYang).toBe(analysis.header.yinYang);
    expect(h.yearGz).toBe(analysis.header.yearGz);
    expect(h.lunarDate).toBe(analysis.header.lunarDate);
    expect(h.fiveElementsClass).toBe(analysis.header.fiveElementsClass);
    expect(h.soul).toBe(analysis.header.soul);
    expect(h.body).toBe(analysis.header.body);
    expect(h.clockDate).toBe('1996-05-12');
    expect(h.clockTime).toBe('23:40');
    expect(h.solarDate).toBe(result.meta.solarTimeDate);
    expect(h.solarTime).toBe(result.meta.solarTimeHM);
    // 每個欄位都非空字串
    for (const [k, v] of Object.entries(h)) {
      expect(v, `欄位 ${k} 不可為空`).toBeTruthy();
      expect(typeof v).toBe('string');
    }
  });
});

describe('buildFullReportChapters', () => {
  const chapters = buildFullReportChapters(analysis, 2026);

  it('六章的 key 與標題順序正確', () => {
    expect(chapters.map((c) => c.key)).toEqual(['zonglun', 'benming', 'caiyun', 'shiye', 'aiqing', 'luopan']);
    expect(chapters.map((c) => c.title)).toEqual(['命格總論', '本命', '財運', '事業', '愛情', '人生羅盤']);
    for (const c of chapters) expect(c.prompt.length).toBeGreaterThan(100);
  });

  it('命格總論含命宮三方四正、命主身主、五行局與命格稱號要求', () => {
    const p = chapters[0].prompt;
    const h = analysis.header;
    const benming = analysis.topics.find((t) => t.topic === '本命')!;
    expect(p).toContain('命格總論');
    expect(p).toContain(`命宮（${benming.branch}宮）三方四正`);
    for (const g of benming.group) expect(p).toContain(`${g.role}【${g.palaceName}宮・${g.branch}】`);
    expect(p).toContain(`命主${h.soul}`);
    expect(p).toContain(`身主${h.body}`);
    expect(p).toContain(h.fiveElementsClass);
    expect(p).toContain('2~4 字的命格稱號');
    expect(p).toContain('markdown');
    expect(p).toContain('繁體中文');
    expect(p).toContain('不要免責聲明');
  });

  it('本命／財運／事業／愛情四章直接沿用 buildPrompt', () => {
    expect(chapters[1].prompt).toBe(buildPrompt(analysis, '本命', 2026));
    expect(chapters[2].prompt).toBe(buildPrompt(analysis, '財運', 2026));
    expect(chapters[3].prompt).toBe(buildPrompt(analysis, '事業', 2026));
    expect(chapters[4].prompt).toBe(buildPrompt(analysis, '愛情', 2026));
  });

  it('人生羅盤含四主題三方四正與引動年份', () => {
    const p = chapters[5].prompt;
    expect(p).toContain('人生羅盤');
    for (const t of analysis.topics) {
      expect(p).toContain(`〈${t.topic}〉主題宮位：${t.palaceName}（${t.branch}宮）`);
    }
    // 大限與引動年份行（格式仿 buildPrompt 的 decadalDesc）
    expect(p).toMatch(/- \d+~\d+歲 .{2}限/);
    expect(p).toMatch(/\[權重\d\]〔[^〕]+〕/);
    // 發展方向、防守弱項、未來十年
    expect(p).toContain('2~3 個方向');
    expect(p).toContain('2~3 個弱項');
    expect(p).toContain('2026~2035');
    expect(p).toContain('markdown');
    expect(p).toContain('繁體中文');
    expect(p).toContain('不要免責聲明');
  });

  it('所有章節 prompt 都含命主基本資訊與盤面事實限制', () => {
    const h = analysis.header;
    for (const c of chapters) {
      expect(c.prompt).toContain(`${h.yinYang}${h.gender}`);
      expect(c.prompt).toContain(h.yearGz);
      expect(c.prompt).toContain('盤面事實');
    }
  });
});
