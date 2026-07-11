import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

/**
 * 統一 AI 呼叫入口：callAi(provider, model, prompt)。
 * 新增供應商：加一個 callXxx 函式並在 callAi 的 dispatcher 掛上分支，
 * 前端同步在 src/ai/providers.ts 註冊（下拉選單自動生效）。
 */

/** Claude 模型別名 → Anthropic API model id */
export const CLAUDE_API_MODELS: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5',
  opus: 'claude-opus-4-8',
  fable: 'claude-fable-5',
};

export const DEFAULT_TIMEOUT_MS = 600_000;

/** 呼叫本機已登入的 Claude Code（headless）；CLI 接受 haiku/sonnet/opus/fable 別名 */
function callClaudeCli(prompt: string, model: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE; // 允許在 Claude Code 之外以子行程執行
    const child = spawn('claude', ['-p', '--output-format', 'text', '--model', model], {
      env,
      cwd: tmpdir(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude CLI 逾時（${Math.round(timeoutMs / 1000)} 秒）`));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI 啟動失敗：${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude CLI 失敗（code ${code}）：${err.slice(0, 500)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function callClaudeApi(prompt: string, model: string, apiKey: string, timeoutMs: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_API_MODELS[model],
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

export async function callAi(provider: string, model: string, prompt: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  if (provider === 'claude') {
    if (!CLAUDE_API_MODELS[model]) throw new Error(`未知的 Claude 模型：${model}`);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) return callClaudeApi(prompt, model, apiKey, timeoutMs);
    return callClaudeCli(prompt, model, timeoutMs);
  }
  throw new Error(`供應商 ${provider} 尚未支援`);
}
