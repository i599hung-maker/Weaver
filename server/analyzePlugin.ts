import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { Plugin } from 'vite';

/**
 * 本地分析伺服器（dev middleware）：POST /api/analyze { prompt } → { text }
 * 優先呼叫本機已登入的 Claude Code（headless），若設有 ANTHROPIC_API_KEY 則走 API。
 */

function callClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE; // 允許在 Claude Code 之外以子行程執行
    const child = spawn('claude', ['-p', '--output-format', 'text', '--model', 'sonnet'], {
      env,
      cwd: tmpdir(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('claude CLI 逾時（600 秒）'));
    }, 600_000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude CLI 失敗（code ${code}）：${err.slice(0, 500)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function callApi(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

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
            const { prompt } = JSON.parse(body) as { prompt: string };
            if (!prompt) throw new Error('missing prompt');
            const apiKey = process.env.ANTHROPIC_API_KEY;
            const text = apiKey ? await callApi(prompt, apiKey) : await callClaudeCli(prompt);
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
