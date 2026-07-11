import { describe, expect, it } from 'vitest';
import { CLAUDE_API_MODELS, ANTIGRAVITY_MODELS, callAi } from '../aiCall.js';
import { AI_PROVIDERS } from '../../src/ai/providers';

describe('callAi', () => {
  it('未知供應商 throw 尚未支援', async () => {
    await expect(callAi('unknown_provider', 'gemini-3', 'hi')).rejects.toThrow('尚未支援');
  });

  it('未知 claude 模型 throw', async () => {
    await expect(callAi('claude', 'nope', 'hi')).rejects.toThrow('未知的 Claude 模型');
  });

  it('未知 antigravity 模型 throw', async () => {
    await expect(callAi('antigravity', 'nope', 'hi')).rejects.toThrow('未知的 Antigravity 模型');
  });

  it('註冊表中每個 claude 模型都有 API model id 映射', () => {
    const claude = AI_PROVIDERS.find((p) => p.id === 'claude')!;
    for (const m of claude.models) expect(CLAUDE_API_MODELS[m.id]).toBeTruthy();
  });

  it('註冊表中每個 antigravity 模型都有 CLI model id 映射', () => {
    const agy = AI_PROVIDERS.find((p) => p.id === 'antigravity')!;
    for (const m of agy.models) expect(ANTIGRAVITY_MODELS[m.id]).toBeTruthy();
  });
});
