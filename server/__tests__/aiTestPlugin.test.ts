import { describe, expect, it } from 'vitest';
import { TEST_PROMPT, runAiTest } from '../aiTestPlugin.js';

describe('runAiTest', () => {
  it('caller 成功 → ok 與 latencyMs', async () => {
    const r = await runAiTest('claude', 'haiku', async (_p, _m, prompt) => {
      expect(prompt).toBe(TEST_PROMPT);
      return 'OK';
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('caller 失敗 → ok:false 帶錯誤訊息', async () => {
    const r = await runAiTest('antigravity', 'x', async () => {
      throw new Error('供應商 antigravity 尚未支援');
    });
    expect(r).toEqual({ ok: false, error: '供應商 antigravity 尚未支援' });
  });
});
