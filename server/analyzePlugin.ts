import type { Plugin } from 'vite';
import { callAi } from './aiCall.js';

/**
 * 本地分析伺服器（dev middleware）：POST /api/analyze { prompt, provider?, model? } → { text }
 * 實際呼叫邏輯集中在 server/aiCall.ts（本機 Claude Code headless，設 ANTHROPIC_API_KEY 則走 API）。
 */

export default function analyzePlugin(): Plugin {
  return {
    name: 'zhanyan-analyze',
    configureServer(server) {
      server.middlewares.use('/api/analyze', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', async () => {
          const body = Buffer.concat(chunks).toString('utf8'); // 一次性 UTF-8 解碼，避免中文跨 chunk 亂碼
          res.setHeader('content-type', 'application/json');
          try {
            const { prompt, provider, model } = JSON.parse(body) as {
              prompt: string;
              provider?: string;
              model?: string;
            };
            if (!prompt) throw new Error('missing prompt');
            const text = await callAi(provider ?? 'claude', model ?? 'opus', prompt);
            res.end(JSON.stringify({ text }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: (e as Error).message }));
          }
        });
      });
    },
  };
}
