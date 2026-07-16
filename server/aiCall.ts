import { spawn } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';

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

/** Antigravity 模型別名 → Antigravity CLI model id */
export const ANTIGRAVITY_MODELS: Record<string, string> = {
  'flash-low': 'Gemini 3.5 Flash (Low)',
  'flash': 'Gemini 3.5 Flash (Medium)',
  'flash-high': 'Gemini 3.5 Flash (High)',
  'pro-low': 'Gemini 3.1 Pro (Low)',
  'pro': 'Gemini 3.1 Pro (High)',
  'sonnet-4.6': 'Claude Sonnet 4.6 (Thinking)',
  'opus-4.6': 'Claude Opus 4.6 (Thinking)',
};

export const DEFAULT_TIMEOUT_MS = 600_000;

/** 逾時專屬錯誤：呼叫端據此判斷可否重試（其他錯誤如登入失效重試也沒用） */
export class AiTimeoutError extends Error {}

/**
 * claude CLI 額度用完時會把上限訊息印到 stdout 正常結束（如
 * 「You've hit your limit · resets 7:50pm」），若不攔截會被當成章節內容存進續跑快取。
 * 上限訊息必是單行短輸出，長度門檻避免長章節剛好引用到字眼被誤殺。
 */
export function isUsageLimitMessage(out: string): boolean {
  return out.length < 200 && /(hit|reached) your (usage )?limit|usage limit reached/i.test(out);
}

/** 呼叫本機已登入的 Claude Code（headless）；CLI 接受 haiku/sonnet/opus/fable 別名 */
function callClaudeCli(prompt: string, model: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE; // 允許在 Claude Code 之外以子行程執行
    // prompt 以「命令列參數」傳入，不走 stdin：Windows 上 claude CLI（Bun 打包）從 pipe 讀 stdin
    // 會間歇性崩潰（exit code 3）；Node 會以 UTF-16 正確傳參給 CreateProcess，中文不會亂碼。
    const child = spawn('claude', ['-p', prompt, '--output-format', 'text', '--model', model], {
      env,
      cwd: tmpdir(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // 收集 Buffer 後一次性 UTF-8 解碼：避免多位元組中文被切在 chunk 邊界而亂碼
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      const err = Buffer.concat(errChunks).toString('utf8').trim();
      reject(
        new AiTimeoutError(
          `claude CLI 逾時（${Math.round(timeoutMs / 1000)} 秒）${err ? `：${err.slice(0, 300)}` : ''}`,
        ),
      );
    }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => outChunks.push(d));
    child.stderr.on('data', (d: Buffer) => errChunks.push(d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI 啟動失敗：${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(outChunks).toString('utf8').trim();
      const err = Buffer.concat(errChunks).toString('utf8');
      // claude CLI（Bun 打包）在 Windows 上常於「印完完整輸出後」的結束清理階段崩潰（code 3），
      // 此時 stdout 已是完整結果 → 有輸出就採用，不因結束碼非 0 而丟棄好的回應。
      if (isUsageLimitMessage(out)) reject(new Error(`Claude 用量已達上限，重置後再產生即可續跑：${out.slice(0, 200)}`));
      else if (out) resolve(out);
      else reject(new Error(`claude CLI 失敗（code ${code}）：${err.slice(0, 500)}`));
    });
  });
}

async function callClaudeApi(prompt: string, model: string, apiKey: string, timeoutMs: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    // fetch 逾時拋 DOMException（TimeoutError），在 callAi 統一轉成 AiTimeoutError
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

/** 呼叫本機已登入的 Antigravity CLI（headless）；CLI 接受完整模型顯示名稱 */
function callAntigravityCli(prompt: string, model: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    const timeoutSec = Math.round(timeoutMs / 1000);
    const args = ['-p', prompt, '--model', model, '--print-timeout', `${timeoutSec}s`];

    const launch = (cmd: string, isFallback: boolean) => {
      const child = spawn(cmd, args, {
        env,
        cwd: tmpdir(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const outChunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      const timer = setTimeout(() => {
        child.kill();
        const err = Buffer.concat(errChunks).toString('utf8').trim();
        reject(new AiTimeoutError(`agy CLI 逾時（${timeoutSec} 秒）${err ? `：${err.slice(0, 300)}` : ''}`));
      }, timeoutMs);

      child.stdout.on('data', (d: Buffer) => outChunks.push(d));
      child.stderr.on('data', (d: Buffer) => errChunks.push(d));

      let retrying = false;
      child.on('error', (e: any) => {
        clearTimeout(timer);
        if (!isFallback && e.code === 'ENOENT') {
          retrying = true;
          launch(`${homedir()}/.local/bin/agy`, true);
        } else {
          reject(new Error(`agy CLI 啟動失敗：${e.message}`));
        }
      });
      child.on('close', (code) => {
        if (retrying) return;
        clearTimeout(timer);
        const out = Buffer.concat(outChunks).toString('utf8');
        const err = Buffer.concat(errChunks).toString('utf8');
        if (code === 0) resolve(out.trim());
        else reject(new Error(`agy CLI 失敗（code ${code}）：${err.slice(0, 500)}`));
      });
    };
    launch('agy', false);
  });
}

export async function callAi(provider: string, model: string, prompt: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  if (provider === 'claude') {
    if (!CLAUDE_API_MODELS[model]) throw new Error(`未知的 Claude 模型：${model}`);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        return await callClaudeApi(prompt, model, apiKey, timeoutMs);
      } catch (e) {
        if ((e as Error).name === 'TimeoutError') {
          throw new AiTimeoutError(`Anthropic API 逾時（${Math.round(timeoutMs / 1000)} 秒）`);
        }
        throw e;
      }
    }
    return callClaudeCli(prompt, model, timeoutMs);
  }
  if (provider === 'antigravity') {
    if (!ANTIGRAVITY_MODELS[model]) throw new Error(`未知的 Antigravity 模型：${model}`);
    return callAntigravityCli(prompt, ANTIGRAVITY_MODELS[model], timeoutMs);
  }
  throw new Error(`供應商 ${provider} 尚未支援`);
}
