import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleDeleteReport } from '../reportPlugin.js';

const DIR = join(process.cwd(), 'data', 'reports');

describe('handleDeleteReport', () => {
  it('刪除 html、md 與 status', () => {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, 'q_deltest.html'), '<html></html>');
    writeFileSync(join(DIR, 'q_deltest.md'), '# 報告');
    writeFileSync(join(DIR, 'q_deltest.status.json'), '{}');
    handleDeleteReport('q_deltest');
    expect(existsSync(join(DIR, 'q_deltest.html'))).toBe(false);
    expect(existsSync(join(DIR, 'q_deltest.md'))).toBe(false);
    expect(existsSync(join(DIR, 'q_deltest.status.json'))).toBe(false);
  });

  it('不存在的 key 不 throw', () => {
    expect(() => handleDeleteReport('q_nonexistent')).not.toThrow();
  });
});
