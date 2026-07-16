import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deletePartial, handleDeleteReport, promptHash, readResumable, savePartialChapter } from '../reportPlugin.js';

const DIR = join(process.cwd(), 'data', 'reports');
const KEY = 'b_resumetest';
const CHAPTERS = [
  { key: 'hero', title: '開卷', prompt: '寫開卷' },
  { key: 'gift', title: '天賦印象', prompt: '寫天賦' },
];

describe('章節續跑（partial 檔）', () => {
  it('沒有 partial 檔時回空', () => {
    deletePartial(KEY);
    expect(readResumable(KEY, 'claude', 'opus', CHAPTERS)).toEqual({});
  });

  it('已完成章節在 provider/model/prompt 都相同時可沿用', () => {
    deletePartial(KEY);
    savePartialChapter(KEY, 'claude', 'opus', 'hero', promptHash('寫開卷'), '開卷內容');
    const got = readResumable(KEY, 'claude', 'opus', CHAPTERS);
    expect(got).toEqual({ hero: '開卷內容' });
  });

  it('模型不同時整份 partial 作廢', () => {
    deletePartial(KEY);
    savePartialChapter(KEY, 'claude', 'opus', 'hero', promptHash('寫開卷'), '開卷內容');
    expect(readResumable(KEY, 'claude', 'sonnet', CHAPTERS)).toEqual({});
    expect(readResumable(KEY, 'antigravity', 'opus', CHAPTERS)).toEqual({});
  });

  it('prompt 變更的章節不沿用，其他章不受影響', () => {
    deletePartial(KEY);
    savePartialChapter(KEY, 'claude', 'opus', 'hero', promptHash('舊版開卷提示詞'), '開卷內容');
    savePartialChapter(KEY, 'claude', 'opus', 'gift', promptHash('寫天賦'), '天賦內容');
    expect(readResumable(KEY, 'claude', 'opus', CHAPTERS)).toEqual({ gift: '天賦內容' });
  });

  it('deletePartial 移除 partial 檔', () => {
    savePartialChapter(KEY, 'claude', 'opus', 'hero', promptHash('寫開卷'), '開卷內容');
    deletePartial(KEY);
    expect(existsSync(join(DIR, `${KEY}.chapters.json`))).toBe(false);
  });

  it('刪除報告時連 partial 檔一起刪', () => {
    savePartialChapter(KEY, 'claude', 'opus', 'hero', promptHash('寫開卷'), '開卷內容');
    handleDeleteReport(KEY);
    expect(existsSync(join(DIR, `${KEY}.chapters.json`))).toBe(false);
  });

  it('partial 檔毀損時視同無檔，不 throw', () => {
    deletePartial(KEY);
    savePartialChapter(KEY, 'claude', 'opus', 'hero', promptHash('寫開卷'), '開卷內容');
    writeFileSync(join(DIR, `${KEY}.chapters.json`), '{壞掉的json');
    expect(readResumable(KEY, 'claude', 'opus', CHAPTERS)).toEqual({});
    deletePartial(KEY);
  });
});
