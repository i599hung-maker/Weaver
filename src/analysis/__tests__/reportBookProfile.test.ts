import { describe, expect, it } from 'vitest';
import { cast } from '../../engine/cast';
import { buildAnalysis } from '../analysis';
import { buildBookChapters, buildBookData } from '../reportBook';

const result = cast({ date: '1996-05-12', time: '23:40', gender: '男' });
const analysis = buildAnalysis(result);
const book = buildBookData(result, analysis, 2026);

describe('buildBookChapters profile', () => {
  it('有 profile 時每章 prompt 都含自述段落', () => {
    const chapters = buildBookChapters(analysis, book, 2026, '目前經營小吃店，2019 開業');
    expect(chapters).toHaveLength(9);
    for (const c of chapters) {
      expect(c.prompt).toContain('【命主自述背景】');
      expect(c.prompt).toContain('2019 開業');
    }
  });

  it('未傳時不含自述段落', () => {
    for (const c of buildBookChapters(analysis, book, 2026)) {
      expect(c.prompt).not.toContain('【命主自述背景】');
    }
  });
});

describe('buildBookChapters style', () => {
  it('plain 時每章 prompt 都含白話風格段', () => {
    for (const c of buildBookChapters(analysis, book, 2026, undefined, 'plain')) {
      expect(c.prompt).toContain('【寫作風格：白話】');
    }
  });

  it('classic 與未傳輸出一致且不含風格段', () => {
    const classic = buildBookChapters(analysis, book, 2026, undefined, 'classic');
    const none = buildBookChapters(analysis, book, 2026);
    expect(classic.map((c) => c.prompt)).toEqual(none.map((c) => c.prompt));
    for (const c of classic) expect(c.prompt).not.toContain('【寫作風格');
  });
});
