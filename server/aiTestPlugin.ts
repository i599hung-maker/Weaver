import type { Plugin } from 'vite';
import { callAi } from './aiCall.js';

/**
 * 測試 AI 串接（dev middleware）：POST /api/ai/test { provider, model }
 * → { ok: true, latencyMs } | { ok: false, error }（一律 HTTP 200，錯誤語意在 payload）
 */

export const TEST_PROMPT = '請只回覆兩個大寫英文字母：OK';
export const TEST_TIMEOUT_MS = 60_000;

export type AiCaller = (provider: string, model: string, prompt: string, timeoutMs?: number) => Promise<string>;

export type AiTestResult = { ok: true; latencyMs: number } | { ok: false; error: string };

/** caller 可注入以便測試 */
export async function runAiTest(provider: string, model: string, caller: AiCaller = callAi): Promise<AiTestResult> {
  const t0 = Date.now();
  try {
    await caller(provider, model, TEST_PROMPT, TEST_TIMEOUT_MS);
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export default function aiTestPlugin(): Plugin {
  return {
    name: 'zhanyan-ai-test',
    configureServer(server) {
      server.middlewares.use('/api/ai/test', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          res.setHeader('content-type', 'application/json');
          try {
            const { provider, model } = JSON.parse(body) as { provider?: string; model?: string };
            if (!provider || !model) throw new Error('缺少 provider 或 model');
            res.end(JSON.stringify(await runAiTest(provider, model)));
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: (e as Error).message }));
          }
        });
      });
    },
  };
}
