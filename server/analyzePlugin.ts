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
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
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
