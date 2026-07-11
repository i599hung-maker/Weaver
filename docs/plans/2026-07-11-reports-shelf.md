# 報告書區塊 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中欄「報告書」區塊——列出完整命書與單題報告（自動命名＋時間），每本可開啟、輸出 JPG 長圖／PDF、刪除。

**Architecture:** `Mingzhu.reports` 記錄新報告、`mergeReports` 純函式合併舊資料推導；`reportPlugin` 加 DELETE 與 Playwright export；新元件 `ReportsCard` 插在 ChatPanel 對話列表視圖的 ProfileCard 下方；RightPanel／ChatPanel 生成時記錄。

**Tech Stack:** React 19 + TypeScript + Vite middleware + Playwright（devDependency 現成）+ vitest。

**Spec:** `docs/specs/2026-07-11-reports-shelf-design.md`

## Global Constraints

- 自動命名：完整命書「完整命書・白話版／書面版」；單題報告＝問題前 20 字（空白 fallback「單題報告」）。
- 舊資料零遷移：靠 `mergeReports` 推導；已記錄的優先、依 createdAt 新到舊排序。
- 刪除需 `window.confirm`；單題刪除後同步清除訊息 `reportKey`。
- 測試指令 `npx vitest run <file>`；全套 `npm test`；`npm run lint`；`npm run build`。CSS 附加到 `src/App.css` 檔尾。

---

### Task 1: `ReportMeta`＋`mergeReports` 純函式

**Files:**
- Modify: `src/store/mingzhu.ts`（加 `ReportMeta`、`Mingzhu.reports`）
- Create: `src/store/reportList.ts`
- Test: `src/store/__tests__/reportList.test.ts`

**Interfaces:**
- Produces:
  - `ReportMeta { key: string; title: string; kind: 'book' | 'question'; createdAt: string }`（mingzhu.ts export）
  - `Mingzhu.reports?: ReportMeta[]`
  - `bookTitle(style: 'plain' | 'classic'): string`
  - `questionTitle(question: string): string`
  - `upsertReport(m: Mingzhu, meta: ReportMeta): Mingzhu`（同 key 覆寫）
  - `bookStatusInfo = { done: boolean; updatedAt?: string }`
  - `mergeReports(m: Mingzhu, book: bookStatusInfo): ReportMeta[]`

- [ ] **Step 1: 寫失敗測試**

```ts
// src/store/__tests__/reportList.test.ts
import { describe, expect, it } from 'vitest';
import type { Mingzhu } from '../mingzhu';
import { bookTitle, mergeReports, questionTitle, upsertReport } from '../reportList';

function mz(over: Partial<Mingzhu> = {}): Mingzhu {
  return {
    id: 'm_test',
    name: '測試',
    birth: { name: '測試', date: '1990-01-01', time: '12:00', gender: '男', useTrueSolarTime: true, longitude: 121.5, tzOffset: 8 },
    createdAt: '2026-07-01T00:00:00.000Z',
    conversations: [],
    ...over,
  };
}

describe('命名', () => {
  it('bookTitle 依風格', () => {
    expect(bookTitle('plain')).toBe('完整命書・白話版');
    expect(bookTitle('classic')).toBe('完整命書・書面版');
  });
  it('questionTitle 截 20 字、空白 fallback', () => {
    expect(questionTitle('我明年適合換工作嗎？想聽聽事業與財運的整體分析')).toBe('我明年適合換工作嗎？想聽聽事業與財運');
    expect(questionTitle('  ')).toBe('單題報告');
  });
});

describe('upsertReport', () => {
  it('同 key 覆寫、不同 key 新增', () => {
    let m = mz();
    m = upsertReport(m, { key: 'm_test', title: 'A', kind: 'book', createdAt: '2026-07-10T00:00:00.000Z' });
    m = upsertReport(m, { key: 'm_test', title: 'B', kind: 'book', createdAt: '2026-07-11T00:00:00.000Z' });
    m = upsertReport(m, { key: 'q_1', title: 'Q', kind: 'question', createdAt: '2026-07-11T01:00:00.000Z' });
    expect(m.reports).toHaveLength(2);
    expect(m.reports!.find((r) => r.key === 'm_test')!.title).toBe('B');
  });
});

describe('mergeReports', () => {
  it('已記錄優先、命書推導補缺、依時間新到舊', () => {
    const m = mz({
      reports: [{ key: 'q_1', title: '已記錄問題', kind: 'question', createdAt: '2026-07-10T00:00:00.000Z' }],
      conversations: [
        {
          id: 'c1', title: 't', createdAt: '2026-07-09T00:00:00.000Z',
          messages: [
            { role: 'user', text: '這是一個舊的問題訊息用來推導標題', ts: '2026-07-09T01:00:00.000Z' },
            { role: 'assistant', text: '回覆', ts: '2026-07-09T01:05:00.000Z', mode: 'report', reportKey: 'q_legacy' },
            { role: 'assistant', text: '回覆2', ts: '2026-07-09T02:00:00.000Z', mode: 'report', reportKey: 'q_1' },
          ],
        },
      ],
    });
    const list = mergeReports(m, { done: true, updatedAt: '2026-07-11T03:00:00.000Z' });
    expect(list.map((r) => r.key)).toEqual(['m_test', 'q_1', 'q_legacy']); // 新到舊
    expect(list.find((r) => r.key === 'm_test')!.title).toBe('完整命書');
    expect(list.find((r) => r.key === 'q_legacy')!.title).toBe('這是一個舊的問題訊息用來推導標題');
    expect(list.find((r) => r.key === 'q_1')!.title).toBe('已記錄問題'); // 記錄優先，不被推導覆蓋
  });

  it('命書未完成且無紀錄時不出現', () => {
    expect(mergeReports(mz(), { done: false })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/store/__tests__/reportList.test.ts`
Expected: FAIL（Cannot find module '../reportList'）

- [ ] **Step 3: 實作**

`src/store/mingzhu.ts` 在 `Conversation` 之後加：

```ts
/** 一本已生成（或生成中）的報告：完整命書或單題報告 */
export interface ReportMeta {
  key: string;
  title: string;
  kind: 'book' | 'question';
  /** ISO 時間戳（生成當下） */
  createdAt: string;
}
```

`Mingzhu` 介面 `profile?` 之後加：

```ts
  /** 報告書紀錄（新生成才有；舊報告由 mergeReports 推導） */
  reports?: ReportMeta[];
```

`src/store/reportList.ts`：

```ts
import type { Mingzhu, ReportMeta } from './mingzhu';

/** 報告書清單邏輯：命名、記錄 upsert、與舊資料（無紀錄的命書／單題）合併推導 */

export function bookTitle(style: 'plain' | 'classic'): string {
  return style === 'plain' ? '完整命書・白話版' : '完整命書・書面版';
}

export function questionTitle(question: string): string {
  const t = question.trim().slice(0, 20);
  return t || '單題報告';
}

/** 同 key 覆寫（命書重生成更新標題與時間），否則附加 */
export function upsertReport(m: Mingzhu, meta: ReportMeta): Mingzhu {
  const rest = (m.reports ?? []).filter((r) => r.key !== meta.key);
  return { ...m, reports: [...rest, meta] };
}

export interface BookStatusInfo {
  done: boolean;
  updatedAt?: string;
}

/** 已記錄＋舊資料推導合併，createdAt 新到舊 */
export function mergeReports(m: Mingzhu, book: BookStatusInfo): ReportMeta[] {
  const recorded = m.reports ?? [];
  const keys = new Set(recorded.map((r) => r.key));
  const derived: ReportMeta[] = [];

  if (book.done && !keys.has(m.id)) {
    derived.push({ key: m.id, title: '完整命書', kind: 'book', createdAt: book.updatedAt ?? m.createdAt });
  }
  for (const conv of m.conversations) {
    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i];
      if (msg.role !== 'assistant' || !msg.reportKey || keys.has(msg.reportKey)) continue;
      const prev = conv.messages
        .slice(0, i)
        .reverse()
        .find((x) => x.role === 'user');
      derived.push({ key: msg.reportKey, title: questionTitle(prev?.text ?? ''), kind: 'question', createdAt: msg.ts });
    }
  }
  return [...recorded, ...derived].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/store/__tests__/reportList.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add src/store/mingzhu.ts src/store/reportList.ts src/store/__tests__/reportList.test.ts
git commit -m "feat: ReportMeta 與報告書清單合併邏輯"
```

---

### Task 2: 伺服器 DELETE＋export

**Files:**
- Modify: `server/reportPlugin.ts`（路由與兩個 handler）
- Test: `server/__tests__/reportDelete.test.ts`

**Interfaces:**
- Produces: `DELETE /api/report/:key` → `{ ok: true }`；`POST /api/report/:key/export` body `{ format: 'jpg' | 'pdf' }` → binary（`image/jpeg`／`application/pdf`）；export `handleDeleteReport(key: string): void`（供測試）。

- [ ] **Step 1: 寫失敗測試**

```ts
// server/__tests__/reportDelete.test.ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleDeleteReport } from '../reportPlugin.js';

const DIR = join(process.cwd(), 'data', 'reports');

describe('handleDeleteReport', () => {
  it('刪除 html 與 status', () => {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, 'q_deltest.html'), '<html></html>');
    writeFileSync(join(DIR, 'q_deltest.status.json'), '{}');
    handleDeleteReport('q_deltest');
    expect(existsSync(join(DIR, 'q_deltest.html'))).toBe(false);
    expect(existsSync(join(DIR, 'q_deltest.status.json'))).toBe(false);
  });

  it('不存在的 key 不 throw', () => {
    expect(() => handleDeleteReport('q_nonexistent')).not.toThrow();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run server/__tests__/reportDelete.test.ts`
Expected: FAIL（handleDeleteReport 未匯出）

- [ ] **Step 3: 實作** — `server/reportPlugin.ts`：

fs import 加 `rmSync`：

```ts
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
```

`handleGetHtml` 之後加兩個 handler：

```ts
/** 刪報告：html 與 status 檔都移除（不存在視同成功） */
export function handleDeleteReport(key: string): void {
  rmSync(htmlPath(key), { force: true });
  rmSync(statusPath(key), { force: true });
}

/** Playwright 輸出：jpg＝整頁長圖、pdf＝A4 含背景。reducedMotion 讓模板進場動畫區塊直接顯示 */
async function handleExport(key: string, raw: string, res: ServerResponse): Promise<void> {
  if (!existsSync(htmlPath(key))) return sendJson(res, 404, { error: '找不到報告' });
  const { format } = JSON.parse(raw || '{}') as { format?: string };
  if (format !== 'jpg' && format !== 'pdf') return sendJson(res, 400, { error: 'format 需為 jpg 或 pdf' });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      reducedMotion: 'reduce',
      viewport: { width: 960, height: 1200 },
      deviceScaleFactor: format === 'jpg' ? 2 : 1,
    });
    await page.goto(`file://${htmlPath(key)}`, { waitUntil: 'networkidle' });
    const buf =
      format === 'jpg'
        ? await page.screenshot({ fullPage: true, type: 'jpeg', quality: 90 })
        : await page.pdf({ format: 'A4', printBackground: true });
    res.statusCode = 200;
    res.setHeader('content-type', format === 'jpg' ? 'image/jpeg' : 'application/pdf');
    res.end(buf);
  } finally {
    await browser.close();
  }
}
```

路由（`configureServer` 內）改：

```ts
            if (!action) {
              if (req.method === 'GET') return handleGetHtml(key, res);
              if (req.method === 'DELETE') {
                handleDeleteReport(key);
                return sendJson(res, 200, { ok: true });
              }
              return sendJson(res, 405, { error: 'method not allowed' });
            }
```

與 generate/render 同段加：

```ts
            if (action === 'export') {
              if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
              const raw = await readBody(req);
              return handleExport(key, raw, res);
            }
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run server/__tests__/reportDelete.test.ts && npm test`
Expected: 全數 PASS

- [ ] **Step 5: Commit**

```bash
git add server/reportPlugin.ts server/__tests__/reportDelete.test.ts
git commit -m "feat: 報告 DELETE 與 Playwright 輸出（JPG 長圖／PDF）端點"
```

---

### Task 3: 生成時記錄（RightPanel／ChatPanel）

**Files:**
- Modify: `src/components/RightPanel.tsx`（Props 加 `onUpdate`；generate 202 後記錄）
- Modify: `src/App.tsx`（RightPanel 傳 `onUpdate={updateMingzhu}`）
- Modify: `src/components/ChatPanel.tsx`（單題 render 成功後記錄）

**Interfaces:**
- Consumes: `bookTitle`、`questionTitle`、`upsertReport`（Task 1）、`saveMingzhu`。

- [ ] **Step 1: RightPanel**

Props 加：

```ts
interface Props {
  mingzhu: Mingzhu;
  result: CastResult;
  /** 精簡盤（true）／完整盤（false），由左下角「設定」控制 */
  simple: boolean;
  onUpdate: (m: Mingzhu) => void;
}
```

（解構處補 `onUpdate`。）import 加：

```ts
import { bookTitle, upsertReport } from '../store/reportList';
import { saveMingzhu } from '../store/mingzhu';
```

`generate` 內 202/409 檢查之後、`setRs` 之前加：

```ts
      const style = loadSettings().reportStyle;
      const next = upsertReport(mingzhu, {
        key: mingzhu.id,
        title: bookTitle(style),
        kind: 'book',
        createdAt: new Date().toISOString(),
      });
      onUpdate(next);
      void saveMingzhu(next);
```

（注意 `loadSettings()` 在上方已呼叫過一次取 style 組 chapters——把那次的結果存變數共用：`const reportStyle = loadSettings().reportStyle;` 提到 `buildBookChapters` 前，兩處共用。）

- [ ] **Step 2: App.tsx** — RightPanel 呼叫處加 prop：

```tsx
          <RightPanel
            key={mingzhu.id}
            mingzhu={mingzhu}
            result={result}
            simple={settings.chartMode === 'simple'}
            onUpdate={updateMingzhu}
          />
```

- [ ] **Step 3: ChatPanel** — import 加：

```ts
import { questionTitle, upsertReport } from '../store/reportList';
```

`ask` 內單題報告成功處（`reply = { ...reply, mode: 'report', reportKey: key };` 之後的訊息儲存）改：原本

```ts
      const next = withConv(base, { ...conv, messages: [...conv.messages, reply] });
```

改為：

```ts
      let next = withConv(base, { ...conv, messages: [...conv.messages, reply] });
      if (reply.mode === 'report' && reply.reportKey) {
        next = upsertReport(next, {
          key: reply.reportKey,
          title: questionTitle(question),
          kind: 'question',
          createdAt: reply.ts,
        });
      }
```

- [ ] **Step 4: 驗證**

Run: `npm run lint && npm run build && npm test`
Expected: 全數通過

- [ ] **Step 5: Commit**

```bash
git add src/components/RightPanel.tsx src/components/ChatPanel.tsx src/App.tsx
git commit -m "feat: 命書與單題報告生成時記錄到 mingzhu.reports"
```

---

### Task 4: `ReportsCard` 元件＋CSS

**Files:**
- Create: `src/components/ReportsCard.tsx`
- Modify: `src/components/ChatPanel.tsx`（對話列表視圖 ProfileCard 下插入）
- Modify: `src/App.css`（檔尾附加）

**Interfaces:**
- Consumes: `mergeReports`、`upsertReport` 型別（Task 1）、`DELETE /api/report/:key`、`POST /api/report/:key/export`（Task 2）、`saveMingzhu`。
- Produces: `<ReportsCard mingzhu={mingzhu} onUpdate={onUpdate} />`。

- [ ] **Step 1: 實作元件**

```tsx
// src/components/ReportsCard.tsx
import { useEffect, useState } from 'react';
import { BookOpen, Download, LoaderCircle, Trash2 } from 'lucide-react';
import { saveMingzhu, type Mingzhu, type ReportMeta } from '../store/mingzhu';
import { mergeReports, type BookStatusInfo } from '../store/reportList';

interface Props {
  mingzhu: Mingzhu;
  onUpdate: (m: Mingzhu) => void;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 中欄報告書清單：開啟／輸出 JPG／輸出 PDF／刪除 */
export default function ReportsCard({ mingzhu, onUpdate }: Props) {
  const [bookStatus, setBookStatus] = useState<BookStatusInfo>({ done: false });
  const [busy, setBusy] = useState<string | null>(null); // `${key}:${format}` 或 `${key}:del`
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    void (async () => {
      try {
        const res = await fetch(`/api/report/${mingzhu.id}/status`);
        const s = (await res.json()) as { status: string; updatedAt?: string };
        if (!stop) setBookStatus({ done: s.status === 'done', updatedAt: s.updatedAt });
      } catch {
        /* 靜默：沒有命書就不顯示 */
      }
    })();
    return () => {
      stop = true;
    };
  }, [mingzhu.id, mingzhu.reports]);

  const list = mergeReports(mingzhu, bookStatus);
  if (list.length === 0) return null;

  const exportReport = async (r: ReportMeta, format: 'jpg' | 'pdf') => {
    setBusy(`${r.key}:${format}`);
    setError(null);
    try {
      const res = await fetch(`/api/report/${r.key}/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${r.title} ${r.createdAt.slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(`輸出失敗：${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: ReportMeta) => {
    if (!window.confirm(`刪除「${r.title}」？報告檔會一併移除。`)) return;
    setBusy(`${r.key}:del`);
    setError(null);
    try {
      const res = await fetch(`/api/report/${r.key}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let next: Mingzhu = { ...mingzhu, reports: (mingzhu.reports ?? []).filter((x) => x.key !== r.key) };
      if (r.kind === 'question') {
        next = {
          ...next,
          conversations: next.conversations.map((c) => ({
            ...c,
            messages: c.messages.map((msg) => (msg.reportKey === r.key ? { ...msg, mode: 'chat' as const, reportKey: undefined } : msg)),
          })),
        };
      }
      if (r.kind === 'book') setBookStatus({ done: false });
      onUpdate(next);
      await saveMingzhu(next);
    } catch (e) {
      setError(`刪除失敗：${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="reports-card">
      <div className="rc-title">報告書</div>
      {error && <div className="pc-error">{error}</div>}
      {list.map((r) => (
        <div key={r.key} className="report-row">
          <button className="rr-open" onClick={() => window.open(`/api/report/${r.key}`)}>
            <BookOpen size={14} strokeWidth={1.8} />
            <span className="rr-name">{r.title}</span>
            <span className="rr-time">{fmtTime(r.createdAt)}</span>
          </button>
          <span className="rr-actions">
            {(['jpg', 'pdf'] as const).map((f) => (
              <button key={f} disabled={busy !== null} onClick={() => void exportReport(r, f)} title={`輸出 ${f.toUpperCase()}`}>
                {busy === `${r.key}:${f}` ? <LoaderCircle size={13} className="spin" /> : <Download size={13} strokeWidth={1.8} />}
                {f.toUpperCase()}
              </button>
            ))}
            <button className="rr-del" disabled={busy !== null} title="刪除" onClick={() => void remove(r)}>
              {busy === `${r.key}:del` ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} strokeWidth={1.8} />}
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
```

（注意：ChatPanel 既有 `.rc-head`／`.rc-icon` class 前綴已被使用，故此處用 `reports-card`／`rr-` 前綴避免衝突。）

- [ ] **Step 2: ChatPanel 插入** — 對話列表視圖：

```tsx
        {chatHead}
        <ProfileCard mingzhu={mingzhu} onUpdate={onUpdate} />
        <ReportsCard mingzhu={mingzhu} onUpdate={onUpdate} />
```

import：`import ReportsCard from './ReportsCard';`

- [ ] **Step 3: CSS 附加到 `src/App.css` 檔尾**

```css

/* 報告書清單：中欄個人背景下方 */
.reports-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rc-title {
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 2px;
}
.report-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.report-row .rr-open {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 4px;
  background: none;
  border: none;
  color: var(--text);
  font-size: 13.5px;
  cursor: pointer;
  text-align: left;
  border-radius: 8px;
}
.report-row .rr-open:hover {
  background: var(--bg-hover);
}
.rr-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rr-time {
  flex: none;
  font-size: 11.5px;
  color: var(--text-3);
}
.rr-actions {
  display: inline-flex;
  gap: 4px;
  flex: none;
}
.rr-actions button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  padding: 3px 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
}
.rr-actions button:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-hover);
}
.rr-actions .rr-del:hover:not(:disabled) {
  color: var(--malefic);
}
```

- [ ] **Step 4: 驗證**

Run: `npm run lint && npm run build && npm test`
Expected: 全數通過

- [ ] **Step 5: Commit**

```bash
git add src/components/ReportsCard.tsx src/components/ChatPanel.tsx src/App.css
git commit -m "feat: 中欄報告書區塊（開啟／輸出／刪除）"
```

---

### Task 5: E2E 驗證

- [ ] **Step 1: dev server＋fixture**：`data/reports/` 已有 `m_mrf1pie09mzfzs.html`（既有命書）。啟動 dev server 後：
  - `curl -s -X POST localhost:5199/api/report/m_mrf1pie09mzfzs/export -H 'content-type: application/json' -d '{"format":"jpg"}' -o /tmp-scratch/book.jpg`，確認檔案 >100KB 且 `file` 判定為 JPEG。
  - 同 key `{"format":"pdf"}` → PDF 檔 >50KB。
  - 建假檔 `q_e2edel.html` → `curl -X DELETE /api/report/q_e2edel` → 檔案消失。
- [ ] **Step 2: Playwright UI**：選有命書的命主 → 截圖確認「報告書」區塊出現「完整命書」列＋時間＋JPG/PDF/刪除按鈕。
- [ ] **Step 3: 收尾**：關 server、全套測試 lint build，殘餘變更 commit。
