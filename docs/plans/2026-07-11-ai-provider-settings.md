# AI 供應商與模型設定＋測試串接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定頁可選 AI 供應商與模型（首發 Claude：haiku/sonnet/opus/fable），並有「測試串接」按鈕亮綠燈確認可用；聊天分析與命書報告都吃這組設定。

**Architecture:** 前端一份供應商註冊表（`src/ai/providers.ts`）驅動 UI 下拉；設定存 localStorage；每次 API 請求 body 帶 `provider`/`model`；後端 `server/aiCall.ts` 統一分發（合併原本兩份重複的 `callClaudeCli`）；新端點 `POST /api/ai/test` 供綠燈測試。

**Tech Stack:** React 19 + TypeScript + Vite dev-server middleware（vite plugin）+ vitest。

**Spec:** `docs/specs/2026-07-11-ai-provider-settings-design.md`

## Global Constraints

- 預設值必須維持現行為：provider `claude`、model `opus`。
- 所有使用者可見文案為繁體中文。
- 後端 plugin 之間共用程式碼一律放 `server/aiCall.ts`，不得再複製 `callClaudeCli`。
- 測試指令：`npx vitest run <file>`；全部測試 `npm test`；lint `npm run lint`。
- server 端 import 同層檔案需帶 `.js` 副檔名（現有慣例，如 `./reportTemplate.js`）。

---

### Task 1: 供應商註冊表 `src/ai/providers.ts`

**Files:**
- Create: `src/ai/providers.ts`
- Test: `src/ai/__tests__/providers.test.ts`

**Interfaces:**
- Produces: `AI_PROVIDERS: AiProvider[]`、`findProvider(id: string): AiProvider | undefined`、型別 `AiProvider { id, label, models: AiModel[] }`、`AiModel { id, label }`。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/ai/__tests__/providers.test.ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/ai/__tests__/providers.test.ts`
Expected: FAIL（Cannot find module '../providers'）

- [ ] **Step 3: 實作**

```ts
// src/ai/providers.ts
/**
 * AI 供應商註冊表：前端下拉選單與模型清單的唯一來源。
 * 新增供應商：在 AI_PROVIDERS 加一筆，並在 server/aiCall.ts 的 callAi 掛上對應呼叫函式。
 */

export interface AiModel {
  id: string;
  label: string;
}

export interface AiProvider {
  id: string;
  label: string;
  models: AiModel[];
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'claude',
    label: 'Claude',
    models: [
      { id: 'haiku', label: 'Haiku（最快）' },
      { id: 'sonnet', label: 'Sonnet（均衡）' },
      { id: 'opus', label: 'Opus（深入）' },
      { id: 'fable', label: 'Fable（最強）' },
    ],
  },
];

export function findProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/ai/__tests__/providers.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add src/ai
git commit -m "feat: AI 供應商註冊表（首發 Claude 四模型）"
```

---

### Task 2: settings 擴充 `aiProvider` / `aiModel`

**Files:**
- Modify: `src/store/settings.ts`
- Test: `src/store/__tests__/settings.test.ts`

**Interfaces:**
- Consumes: 無。
- Produces: `Settings` 新欄位 `aiProvider: string`、`aiModel: string`；`DEFAULT_SETTINGS = { chartMode: 'simple', aiProvider: 'claude', aiModel: 'opus' }`；新函式 `aiRequestParams(): { provider: string; model: string }`（呼叫端組 request body 用）。

- [ ] **Step 1: 寫失敗測試**（vitest 為 node 環境，需自行 stub `localStorage`）

```ts
// src/store/__tests__/settings.test.ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/store/__tests__/settings.test.ts`
Expected: FAIL（aiRequestParams 未匯出 / aiProvider undefined）

- [ ] **Step 3: 實作** — `src/store/settings.ts` 改為：

```ts
/** 使用者介面設定：localStorage 持久化 */

export interface Settings {
  /** 右側盤面顯示模式，預設精簡盤 */
  chartMode: 'simple' | 'full';
  /** AI 供應商 id，對應 src/ai/providers.ts 的 AI_PROVIDERS */
  aiProvider: string;
  /** 模型 id（該供應商底下） */
  aiModel: string;
}

const KEY = 'zhanyan-settings';

export const DEFAULT_SETTINGS: Settings = { chartMode: 'simple', aiProvider: 'claude', aiModel: 'opus' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 存不了就算了 */
  }
}

/** 給 API 呼叫端組 request body 用的 AI 參數 */
export function aiRequestParams(): { provider: string; model: string } {
  const s = loadSettings();
  return { provider: s.aiProvider, model: s.aiModel };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/store/__tests__/settings.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat: settings 加 aiProvider/aiModel 與 aiRequestParams"
```

---

### Task 3: 後端統一呼叫 `server/aiCall.ts`，analyze / report 改用

**Files:**
- Create: `server/aiCall.ts`
- Modify: `server/analyzePlugin.ts`（移除本地 callClaudeCli/callApi，body 收 provider/model）
- Modify: `server/reportPlugin.ts:90-116`（移除本地 callClaudeCli）、`GenerateBody` 加欄位、`runGenerateJob` 傳遞
- Test: `server/__tests__/aiCall.test.ts`

**Interfaces:**
- Consumes: 無（自足模組）。
- Produces: `callAi(provider: string, model: string, prompt: string, timeoutMs?: number): Promise<string>`、`CLAUDE_API_MODELS: Record<string, string>`、`DEFAULT_TIMEOUT_MS = 600_000`。

- [ ] **Step 1: 寫失敗測試**

```ts
// server/__tests__/aiCall.test.ts
import { describe, expect, it } from 'vitest';
import { CLAUDE_API_MODELS, callAi } from '../aiCall.js';
import { AI_PROVIDERS } from '../../src/ai/providers';

describe('callAi', () => {
  it('未知供應商 throw 尚未支援', async () => {
    await expect(callAi('antigravity', 'gemini-3', 'hi')).rejects.toThrow('尚未支援');
  });

  it('未知 claude 模型 throw', async () => {
    await expect(callAi('claude', 'nope', 'hi')).rejects.toThrow('未知的 Claude 模型');
  });

  it('註冊表中每個 claude 模型都有 API model id 映射', () => {
    const claude = AI_PROVIDERS.find((p) => p.id === 'claude')!;
    for (const m of claude.models) expect(CLAUDE_API_MODELS[m.id]).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run server/__tests__/aiCall.test.ts`
Expected: FAIL（Cannot find module '../aiCall.js'）

- [ ] **Step 3: 實作 `server/aiCall.ts`**

```ts
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run server/__tests__/aiCall.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: `server/analyzePlugin.ts` 改用 callAi** — 整檔改為：

```ts
import type { Plugin } from 'vite';
import { callAi } from './aiCall.js';

/**
 * 本地分析伺服器（dev middleware）：POST /api/analyze { prompt, provider?, model? } → { text }
 * 實際呼叫邏輯集中在 server/aiCall.ts。
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
```

- [ ] **Step 6: `server/reportPlugin.ts` 改用 callAi**

刪除第 1 行的 `import { spawn } from 'node:child_process';`、第 4 行 `tmpdir` import、第 90–116 行整段 `callClaudeCli`，改在頂部加 `import { callAi } from './aiCall.js';`。

`GenerateBody` 加欄位：

```ts
interface GenerateBody {
  title: string;
  name: string;
  header: ReportHeader;
  chapters: ReportChapterSpec[];
  /** AI 供應商/模型（未帶預設 claude/opus） */
  provider?: string;
  model?: string;
  /** 視覺化命書 v2：有 book 走 renderBookHtml（章節輸出為 JSON 槽位），無則走舊版逐章文章 */
  book?: BookData;
}
```

`runGenerateJob` 內呼叫處改為：

```ts
    for (const chapter of body.chapters) {
      const text = await callAi(body.provider ?? 'claude', body.model ?? 'opus', chapter.prompt);
```

- [ ] **Step 7: 跑全部測試確認沒破壞**

Run: `npm test`
Expected: 全數 PASS（含既有 reportTemplate、trigger 等測試）

- [ ] **Step 8: Commit**

```bash
git add server
git commit -m "refactor: 統一 AI 呼叫至 server/aiCall.ts，analyze/report 接受 provider/model"
```

---

### Task 4: 測試串接端點 `POST /api/ai/test`

**Files:**
- Create: `server/aiTestPlugin.ts`
- Modify: `vite.config.ts`
- Test: `server/__tests__/aiTestPlugin.test.ts`

**Interfaces:**
- Consumes: `callAi`（Task 3）。
- Produces: HTTP `POST /api/ai/test` body `{ provider, model }` → `{ ok: true, latencyMs: number }` 或 `{ ok: false, error: string }`（一律 HTTP 200）；可注入 caller 的 `runAiTest(provider, model, caller?)`。

- [ ] **Step 1: 寫失敗測試**

```ts
// server/__tests__/aiTestPlugin.test.ts
import { describe, expect, it } from 'vitest';
import { TEST_PROMPT, runAiTest } from '../aiTestPlugin.js';

describe('runAiTest', () => {
  it('caller 成功 → ok 與 latencyMs', async () => {
    const r = await runAiTest('claude', 'haiku', async (_p, _m, prompt) => {
      expect(prompt).toBe(TEST_PROMPT);
      return 'OK';
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('caller 失敗 → ok:false 帶錯誤訊息', async () => {
    const r = await runAiTest('antigravity', 'x', async () => {
      throw new Error('供應商 antigravity 尚未支援');
    });
    expect(r).toEqual({ ok: false, error: '供應商 antigravity 尚未支援' });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run server/__tests__/aiTestPlugin.test.ts`
Expected: FAIL（Cannot find module '../aiTestPlugin.js'）

- [ ] **Step 3: 實作 `server/aiTestPlugin.ts`**

```ts
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
```

- [ ] **Step 4: 註冊到 `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import analyzePlugin from './server/analyzePlugin.js'
import storagePlugin from './server/storagePlugin.js'
import reportPlugin from './server/reportPlugin.js'
import aiTestPlugin from './server/aiTestPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), analyzePlugin(), storagePlugin(), reportPlugin(), aiTestPlugin()],
})
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run server/__tests__/aiTestPlugin.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 6: Commit**

```bash
git add server vite.config.ts
git commit -m "feat: POST /api/ai/test 測試串接端點"
```

---

### Task 5: 設定頁 UI — AI 區塊＋綠燈測試按鈕

**Files:**
- Modify: `src/components/SettingsModal.tsx`
- Modify: `src/App.css`（`.m-row` 區附近加燈號樣式）

**Interfaces:**
- Consumes: `AI_PROVIDERS`、`findProvider`（Task 1）；`Settings.aiProvider/aiModel`（Task 2）；`POST /api/ai/test`（Task 4）。
- Produces: 無（純 UI）。

- [ ] **Step 1: 改寫 `src/components/SettingsModal.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Settings } from '../store/settings';
import { AI_PROVIDERS, findProvider } from '../ai/providers';

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onChange: (s: Settings) => void;
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; latencyMs: number }
  | { status: 'fail'; error: string };

export default function SettingsModal({ open, settings, onClose, onChange }: Props) {
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const provider = findProvider(settings.aiProvider) ?? AI_PROVIDERS[0];

  const changeProvider = (id: string) => {
    const p = findProvider(id) ?? AI_PROVIDERS[0];
    onChange({ ...settings, aiProvider: p.id, aiModel: p.models[0].id });
    setTest({ status: 'idle' });
  };

  const changeModel = (id: string) => {
    onChange({ ...settings, aiModel: id });
    setTest({ status: 'idle' });
  };

  const runTest = async () => {
    setTest({ status: 'testing' });
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: settings.aiProvider, model: settings.aiModel }),
      });
      const data = (await res.json()) as { ok: boolean; latencyMs?: number; error?: string };
      if (data.ok) setTest({ status: 'ok', latencyMs: data.latencyMs ?? 0 });
      else setTest({ status: 'fail', error: data.error ?? '測試失敗' });
    } catch (e) {
      setTest({ status: 'fail', error: (e as Error).message });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>設定</h2>
        <label className="m-row">
          <span className="m-label">盤面顯示</span>
          <select
            value={settings.chartMode}
            onChange={(e) => onChange({ ...settings, chartMode: e.target.value as Settings['chartMode'] })}
          >
            <option value="simple">精簡盤</option>
            <option value="full">完整盤</option>
          </select>
        </label>

        <h3 className="m-section">AI 模型</h3>
        <label className="m-row">
          <span className="m-label">供應商</span>
          <select value={provider.id} onChange={(e) => changeProvider(e.target.value)}>
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="m-row">
          <span className="m-label">模型</span>
          <select value={settings.aiModel} onChange={(e) => changeModel(e.target.value)}>
            {provider.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="m-row">
          <span className="m-label">串接狀態</span>
          <span className="ai-test">
            <button onClick={runTest} disabled={test.status === 'testing'}>
              {test.status === 'testing' ? '測試中…' : '測試串接'}
            </button>
            <i className={`ai-dot ${test.status}`} />
            {test.status === 'ok' && <small className="ai-msg ok">連線正常（{(test.latencyMs / 1000).toFixed(1)} 秒）</small>}
            {test.status === 'fail' && <small className="ai-msg fail">{test.error}</small>}
          </span>
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/App.css` 加樣式**（加在 `.m-label` 規則之後）

```css
.m-section {
  margin: 14px 0 6px;
  font-size: 14px;
  color: #888;
}
.ai-test {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.ai-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
  background: #999; /* idle：未測試 */
}
.ai-dot.testing {
  background: #e6b800;
  animation: ai-dot-blink 1s infinite;
}
.ai-dot.ok {
  background: #2ecc71;
}
.ai-dot.fail {
  background: #e74c3c;
}
@keyframes ai-dot-blink {
  50% {
    opacity: 0.3;
  }
}
.ai-msg {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-msg.ok {
  color: #2ecc71;
}
.ai-msg.fail {
  color: #e74c3c;
}
```

- [ ] **Step 3: 驗證 build 與 lint**

Run: `npm run lint && npm run build`
Expected: 無錯誤

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsModal.tsx src/App.css
git commit -m "feat: 設定頁 AI 供應商/模型選擇與測試串接綠燈"
```

---

### Task 6: 前端呼叫端帶上 provider/model

**Files:**
- Modify: `src/components/AnalysisPanel.tsx:56-60`
- Modify: `src/components/ChatPanel.tsx:178-182`
- Modify: `src/components/RightPanel.tsx:77-87`

**Interfaces:**
- Consumes: `aiRequestParams()`（Task 2）。

- [ ] **Step 1: 三處 fetch body 加 AI 參數**

每檔加 import：`import { aiRequestParams } from '../store/settings';`（AnalysisPanel / ChatPanel 若已 import settings 相關則併入）。

`AnalysisPanel.tsx` 的 `/api/analyze` body：

```ts
        body: JSON.stringify({ prompt, ...aiRequestParams() }),
```

`ChatPanel.tsx` 的 `/api/analyze` body：

```ts
        body: JSON.stringify({ prompt, ...aiRequestParams() }),
```

（`/api/report/:key/render` 不呼叫 AI，不用改。）

`RightPanel.tsx` 的 `/api/report/${mingzhu.id}/generate` body：

```ts
        body: JSON.stringify({
          title: `${mingzhu.name}・完整命書`,
          name: mingzhu.name,
          header: buildReportHeader(analysis, result.meta),
          book,
          chapters,
          ...aiRequestParams(),
        }),
```

- [ ] **Step 2: 驗證**

Run: `npm run lint && npm run build && npm test`
Expected: 全數通過

- [ ] **Step 3: Commit**

```bash
git add src/components
git commit -m "feat: 分析與命書生成請求帶上使用者選定的 AI 供應商/模型"
```

---

### Task 7: 端到端驗證

- [ ] **Step 1: 全部測試＋lint＋build**

Run: `npm test && npm run lint && npm run build`
Expected: 全數通過

- [ ] **Step 2: 實測測試串接端點（真的打一次 claude CLI）**

Run: `npm run dev` 背景啟動後：
`curl -s -X POST localhost:5173/api/ai/test -H 'content-type: application/json' -d '{"provider":"claude","model":"haiku"}'`
Expected: `{"ok":true,"latencyMs":<數字>}`；再測未知供應商 `{"provider":"antigravity","model":"x"}` 應回 `{"ok":false,"error":"供應商 antigravity 尚未支援"}`

- [ ] **Step 3: 瀏覽器手動驗證**

開設定 → AI 模型區塊：換模型、按「測試串接」看黃燈閃爍 → 綠燈＋秒數；重整頁面設定仍在。

- [ ] **Step 4: Commit（如有殘餘變更）**
