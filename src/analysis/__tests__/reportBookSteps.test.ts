import { describe, expect, it } from 'vitest';
import { cast } from '../../engine/cast';
import { buildAnalysis } from '../analysis';
import { buildBookChapters, buildBookData, buildBookSteps } from '../reportBook';

const result = cast({ date: '1996-05-12', time: '23:40', gender: '男' });
const analysis = buildAnalysis(result);
const book = buildBookData(result, analysis, 2026);
const steps = buildBookSteps(analysis, book);

describe('buildBookSteps', () => {
  it('九章、key 與順序同 buildBookChapters', () => {
    const chapters = buildBookChapters(analysis, book, 2026);
    expect(steps.map((s) => s.key)).toEqual(chapters.map((c) => c.key));
  });

  it('每章都有標題、至少兩句步驟，末句是停留句（…結尾）', () => {
    for (const s of steps) {
      expect(s.title).toBeTruthy();
      expect(s.steps.length).toBeGreaterThanOrEqual(2);
      expect(s.steps[s.steps.length - 1].endsWith('…')).toBe(true);
    }
  });

  it('開卷首句帶命主標頭（含命主、身主）', () => {
    expect(steps[0].steps[0]).toContain('命主');
    expect(steps[0].steps[0]).toContain('身主');
  });

  it('大限走勢末句標出大限卡張數', () => {
    const lims = steps.find((s) => s.key === 'lims')!;
    expect(lims.steps[lims.steps.length - 1]).toContain(String(book.decadals.length));
  });
});
