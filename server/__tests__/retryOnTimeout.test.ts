import { describe, expect, it, vi } from 'vitest';
import { AiTimeoutError } from '../aiCall.js';
import { retryOnTimeout } from '../reportPlugin.js';

describe('retryOnTimeout', () => {
  it('逾時錯誤重試一次後成功', async () => {
    const call = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new AiTimeoutError('claude CLI 逾時（600 秒）'))
      .mockResolvedValueOnce('章節內容');
    await expect(retryOnTimeout(call, '第8章')).resolves.toBe('章節內容');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('連續兩次逾時就拋出，不無限重試', async () => {
    const call = vi.fn<() => Promise<string>>().mockRejectedValue(new AiTimeoutError('claude CLI 逾時（600 秒）'));
    await expect(retryOnTimeout(call, '第8章')).rejects.toThrow('逾時');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('非逾時錯誤不重試', async () => {
    const call = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('claude CLI 失敗（code 1）'));
    await expect(retryOnTimeout(call, '第8章')).rejects.toThrow('code 1');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('逾時重試時呼叫 onRetry 一次', async () => {
    const onRetry = vi.fn();
    const call = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new AiTimeoutError('claude CLI 逾時（600 秒）'))
      .mockResolvedValueOnce('章節內容');
    await expect(retryOnTimeout(call, '第8章', onRetry)).resolves.toBe('章節內容');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('未逾時不呼叫 onRetry', async () => {
    const onRetry = vi.fn();
    const call = vi.fn<() => Promise<string>>().mockResolvedValue('章節內容');
    await retryOnTimeout(call, '第8章', onRetry);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
