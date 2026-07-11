import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, aiRequestParams, loadSettings } from '../settings';

function stubStorage(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('settings AI 欄位', () => {
  it('預設 claude/opus', () => {
    expect(DEFAULT_SETTINGS.aiProvider).toBe('claude');
    expect(DEFAULT_SETTINGS.aiModel).toBe('opus');
  });

  it('舊資料缺 AI 欄位時自動補預設', () => {
    stubStorage({ 'zhanyan-settings': JSON.stringify({ chartMode: 'full' }) });
    const s = loadSettings();
    expect(s.chartMode).toBe('full');
    expect(s.aiProvider).toBe('claude');
    expect(s.aiModel).toBe('opus');
  });

  it('aiRequestParams 讀出目前設定', () => {
    stubStorage({ 'zhanyan-settings': JSON.stringify({ aiProvider: 'claude', aiModel: 'haiku' }) });
    expect(aiRequestParams()).toEqual({ provider: 'claude', model: 'haiku' });
  });
});
