import { describe, expect, it } from 'vitest';
import { CLAUDE_API_MODELS, ANTIGRAVITY_MODELS, callAi, isUsageLimitMessage } from '../aiCall.js';
import { AI_PROVIDERS } from '../../src/ai/providers';

describe('isUsageLimitMessage', () => {
  it('CLI 印出的用量上限訊息要被攔截，不能當章節內容', () => {
    expect(isUsageLimitMessage("You've hit your limit · resets 7:50pm (Asia/Taipei)")).toBe(true);
    expect(isUsageLimitMessage("You've reached your usage limit.")).toBe(true);
    expect(isUsageLimitMessage('Claude usage limit reached|1752404400')).toBe(true);
  });

  it('正常章節輸出不誤判', () => {
    expect(isUsageLimitMessage('{"epithet":"執樞","seal":"府相朝垣"}')).toBe(false);
    expect(isUsageLimitMessage('本命盤紫微獨坐命宮，格局清貴。')).toBe(false);
  });

  it('長文中剛好引用到 limit 字眼不誤判（上限訊息必是短輸出）', () => {
    expect(isUsageLimitMessage(`長篇章節內容。${'內文。'.repeat(100)}如 You've hit your limit 這句話只是引用。`)).toBe(false);
  });
});

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
