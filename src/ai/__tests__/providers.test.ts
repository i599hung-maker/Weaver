import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, findProvider } from '../providers';

describe('AI_PROVIDERS', () => {
  it('含 claude 供應商與四個模型', () => {
    const claude = findProvider('claude');
    expect(claude).toBeDefined();
    expect(claude!.models.map((m) => m.id)).toEqual(['haiku', 'sonnet', 'opus', 'fable']);
  });

  it('每個供應商至少一個模型且 id 不重複', () => {
    const ids = AI_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of AI_PROVIDERS) expect(p.models.length).toBeGreaterThan(0);
  });

  it('findProvider 未知 id 回 undefined', () => {
    expect(findProvider('nope')).toBeUndefined();
  });
});
