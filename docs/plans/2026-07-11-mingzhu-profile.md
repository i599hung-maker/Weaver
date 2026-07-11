# 命主個人背景自述 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中欄標題下可收合的「個人背景」textarea（含建議小字），內容存進命主檔並餵給聊天與命書 prompt。

**Architecture:** `Mingzhu` 加選填 `profile?: string`；`chatPrompt.ts` 匯出 `profileSection(profile?)` 供兩處 prompt 共用；`buildChatPrompt` 與 `buildBookChapters` 各加選填參數；新元件 `ProfileCard` 插在 ChatPanel 的 `chatHead` 下方，儲存走既有 `onUpdate`＋`saveMingzhu`。

**Tech Stack:** React 19 + TypeScript + vitest。

**Spec:** `docs/specs/2026-07-11-mingzhu-profile-design.md`

## Global Constraints

- 未填（undefined／空白）時 prompt 與 UI 行為與現行完全相同，不出現【命主自述背景】。
- 使用者可見文案繁體中文；建議小字文案照 spec 原文。
- 測試指令 `npx vitest run <file>`；全套 `npm test`；`npm run lint`；`npm run build`。
- CSS 一律附加到 `src/App.css` 檔尾。

---

### Task 1: prompt 層——`profileSection`＋`buildChatPrompt` 參數

**Files:**
- Modify: `src/store/mingzhu.ts:24-30`（`Mingzhu` 加欄位）
- Modify: `src/analysis/chatPrompt.ts:82-106`
- Test: `src/analysis/__tests__/chatPrompt.test.ts`（附加測試）

**Interfaces:**
- Produces: `Mingzhu.profile?: string`；`profileSection(profile?: string): string`（無值回 `''`，有值回含【命主自述背景】的段落，export 供 reportBook 用）；`buildChatPrompt(analysis, history, question, currentYear, mode?, profile?)` 第 6 個選填參數。

- [ ] **Step 1: 附加失敗測試到 `src/analysis/__tests__/chatPrompt.test.ts`**

```ts
describe('個人背景 profile', () => {
  it('有 profile 時含自述段落與原文', () => {
    const prompt = buildChatPrompt(analysis, [], '問題', 2026, 'chat', '軟體工程師，2021 結婚');
    expect(prompt).toContain('【命主自述背景】');
    expect(prompt).toContain('軟體工程師，2021 結婚');
    expect(prompt).toContain('對照引動年份');
  });

  it('未傳或空白時不含自述段落', () => {
    expect(buildChatPrompt(analysis, [], '問題', 2026)).not.toContain('【命主自述背景】');
    expect(buildChatPrompt(analysis, [], '問題', 2026, 'chat', '   ')).not.toContain('【命主自述背景】');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/analysis/__tests__/chatPrompt.test.ts`
Expected: FAIL（不含【命主自述背景】）

- [ ] **Step 3: 實作**

`src/store/mingzhu.ts` 的 `Mingzhu` 介面加欄位（`createdAt` 之前）：

```ts
  /** 個人背景自述（選填）：職業、感情、重大事件年份等，餵給 AI 貼近解讀 */
  profile?: string;
```

`src/analysis/chatPrompt.ts` 加 export 函式（放在 `buildChatPrompt` 前）：

```ts
/** 命主自述背景段落：聊天與命書 prompt 共用；未填回空字串 */
export function profileSection(profile?: string): string {
  const p = profile?.trim();
  if (!p) return '';
  return `【命主自述背景】（命主自行填寫，僅供貼近解讀）\n${p}\n（自述中提到的事件年份可與引動年份對照驗盤，命中的引動可作為斷應期信心依據並向命主指出；解讀請貼合命主的實際處境。）`;
}
```

`buildChatPrompt` 簽名加第 6 參數並在引動年份段後插入：

```ts
export function buildChatPrompt(
  analysis: ChartAnalysis,
  history: ChatMessage[],
  question: string,
  currentYear: number,
  mode: 'chat' | 'report' = 'chat',
  profile?: string,
): string {
```

sections 組裝處，在【斷應期引動年份】那筆之後加：

```ts
  const ps = profileSection(profile);
  if (ps) sections.push(ps);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/analysis/__tests__/chatPrompt.test.ts`
Expected: PASS（既有＋新增全綠）

- [ ] **Step 5: Commit**

```bash
git add src/store/mingzhu.ts src/analysis/chatPrompt.ts src/analysis/__tests__/chatPrompt.test.ts
git commit -m "feat: Mingzhu.profile 與聊天 prompt 自述背景段落"
```

---

### Task 2: 命書九章 prompt 帶入自述

**Files:**
- Modify: `src/analysis/reportBook.ts:341-353`（`buildBookChapters`）
- Test: `src/analysis/__tests__/reportPrompts.test.ts`（附加測試；若該檔 fixture 不合用則另建 `src/analysis/__tests__/reportBookProfile.test.ts`）

**Interfaces:**
- Consumes: `profileSection`（Task 1，自 `./chatPrompt` import）。
- Produces: `buildBookChapters(analysis, book, currentYear, profile?)` 第 4 個選填參數；有值時每章 prompt 結尾附上自述段落。

- [ ] **Step 1: 附加失敗測試**（新檔 `src/analysis/__tests__/reportBookProfile.test.ts`）

```ts
import { describe, expect, it } from 'vitest';
import { cast } from '../../engine/cast';
import { buildAnalysis } from '../analysis';
import { buildBookChapters, buildBookData } from '../reportBook';

const result = cast({ date: '1996-05-12', time: '23:40', gender: '男' });
const analysis = buildAnalysis(result);
const book = buildBookData(result, analysis, 2026);

describe('buildBookChapters profile', () => {
  it('有 profile 時每章 prompt 都含自述段落', () => {
    const chapters = buildBookChapters(analysis, book, 2026, '目前經營小吃店，2019 開業');
    expect(chapters).toHaveLength(9);
    for (const c of chapters) {
      expect(c.prompt).toContain('【命主自述背景】');
      expect(c.prompt).toContain('2019 開業');
    }
  });

  it('未傳時不含自述段落', () => {
    for (const c of buildBookChapters(analysis, book, 2026)) {
      expect(c.prompt).not.toContain('【命主自述背景】');
    }
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/analysis/__tests__/reportBookProfile.test.ts`
Expected: FAIL（prompt 不含段落）

- [ ] **Step 3: 實作** — `src/analysis/reportBook.ts` 頂部 import 區加：

```ts
import { profileSection } from './chatPrompt';
```

`buildBookChapters` 改為：

```ts
export function buildBookChapters(analysis: ChartAnalysis, book: BookData, currentYear: number, profile?: string): ReportChapterSpec[] {
  const ps = profileSection(profile);
  const withProfile = (prompt: string): string => (ps ? `${prompt}\n\n${ps}` : prompt);
  return [
    { key: 'hero', title: '開卷', prompt: withProfile(heroPrompt(analysis, book, currentYear)) },
    { key: 'gift', title: '天賦印象', prompt: withProfile(giftPrompt(analysis, book)) },
    { key: 'topic_benming', title: '性格', prompt: withProfile(topicPrompt(analysis, book, '本命', '性格')) },
    { key: 'topic_shiye', title: '事業', prompt: withProfile(topicPrompt(analysis, book, '事業', '事業')) },
    { key: 'topic_caiyun', title: '金錢', prompt: withProfile(topicPrompt(analysis, book, '財運', '金錢')) },
    { key: 'topic_aiqing', title: '感情', prompt: withProfile(topicPrompt(analysis, book, '愛情', '感情')) },
    { key: 'lims', title: '大限走勢', prompt: withProfile(limsPrompt(analysis, book, currentYear)) },
    { key: 'events', title: '重點應期', prompt: withProfile(eventsPrompt(analysis, book, currentYear)) },
    { key: 'compass', title: '人生羅盤', prompt: withProfile(compassPrompt(analysis, book, currentYear)) },
  ];
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/analysis/__tests__/reportBookProfile.test.ts && npm test`
Expected: 全數 PASS

- [ ] **Step 5: Commit**

```bash
git add src/analysis/reportBook.ts src/analysis/__tests__/reportBookProfile.test.ts
git commit -m "feat: 命書九章 prompt 帶入命主自述背景"
```

---

### Task 3: ProfileCard 元件＋接線＋樣式

**Files:**
- Create: `src/components/ProfileCard.tsx`
- Modify: `src/components/ChatPanel.tsx`（兩個視圖 `{chatHead}` 後插入；`buildChatPrompt` 兩處呼叫帶 `mingzhu.profile`）
- Modify: `src/components/RightPanel.tsx:77`（`buildBookChapters` 帶 `mingzhu.profile`）
- Modify: `src/App.css`（檔尾附加）

**Interfaces:**
- Consumes: `Mingzhu`（含 Task 1 的 `profile`）、`saveMingzhu`；ChatPanel 既有 `onUpdate: (m: Mingzhu) => void`。
- Produces: `<ProfileCard mingzhu={mingzhu} onUpdate={onUpdate} />`。

- [ ] **Step 1: 建立 `src/components/ProfileCard.tsx`**

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { saveMingzhu, type Mingzhu } from '../store/mingzhu';

interface Props {
  mingzhu: Mingzhu;
  onUpdate: (m: Mingzhu) => void;
}

/** 中欄標題下的個人背景卡片：收合一行摘要，展開為 textarea＋建議小字 */
export default function ProfileCard({ mingzhu, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(mingzhu.profile ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = mingzhu.profile?.trim() ?? '';
  const summary = saved ? saved.split('\n')[0].slice(0, 40) : '';

  const save = async () => {
    setSaving(true);
    setError(null);
    const next = { ...mingzhu, profile: draft.trim() };
    try {
      await saveMingzhu(next);
      onUpdate(next);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button className="profile-bar" onClick={() => { setDraft(mingzhu.profile ?? ''); setOpen(true); }}>
        <ChevronRight size={14} strokeWidth={1.8} />
        {saved ? (
          <span className="pb-summary">個人背景：{summary}{saved.length > 40 ? '…' : ''}</span>
        ) : (
          <span className="pb-empty">＋ 填寫個人背景，讓解讀更貼近你（選填）</span>
        )}
      </button>
    );
  }

  return (
    <div className="profile-card">
      <button className="profile-bar" onClick={() => setOpen(false)}>
        <ChevronDown size={14} strokeWidth={1.8} />
        <span className="pb-summary">個人背景</span>
      </button>
      <textarea
        rows={5}
        placeholder="自我介紹：你在做什麼、目前的生活狀態…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="pc-hint">
        💡 建議可寫：職業與工作現況、感情／婚姻狀況、最想了解的事、重大事件與年份（如 2018
        換工作、2021 結婚）——寫得越具體，解讀越貼近你
      </div>
      {error && <div className="pc-error">儲存失敗：{error}</div>}
      <div className="pc-actions">
        <button onClick={() => setOpen(false)}>收合</button>
        <button className="primary" disabled={saving} onClick={() => void save()}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ChatPanel 接線**

`src/components/ChatPanel.tsx` 頂部加 `import ProfileCard from './ProfileCard';`。
兩個視圖的 `{chatHead}` 後各插入一行：

```tsx
        {chatHead}
        <ProfileCard mingzhu={mingzhu} onUpdate={onUpdate} />
```

兩處 `buildChatPrompt(...)` 呼叫（送出與 usagePct 估算）補第 6 參數 `mingzhu.profile`：

```ts
      const prompt = buildChatPrompt(analysis, history, question, new Date().getFullYear(), qMode, mingzhu.profile);
```

```ts
    const prompt = buildChatPrompt(
      analysis,
      activeConv.messages,
      input || '（估算用）',
      new Date().getFullYear(),
      mode,
      mingzhu.profile,
    );
```

（usagePct 的 useMemo 依賴陣列補 `mingzhu.profile`。）

- [ ] **Step 3: RightPanel 接線** — `buildBookChapters` 呼叫改：

```ts
      const chapters = buildBookChapters(analysis, book, currentYear, mingzhu.profile);
```

- [ ] **Step 4: `src/App.css` 檔尾附加樣式**

```css

/* 個人背景卡片：中欄標題下，收合一行／展開 textarea＋建議 */
.profile-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 4px;
  background: none;
  border: none;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.profile-bar:hover {
  color: var(--text);
}
.pb-empty {
  color: var(--text-3);
}
.pb-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 12px 12px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.profile-card textarea {
  width: 100%;
  resize: vertical;
  min-height: 90px;
}
.pc-hint {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.6;
}
.pc-error {
  font-size: 12px;
  color: #e74c3c;
}
.pc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
```

- [ ] **Step 5: 驗證**

Run: `npm run lint && npm run build && npm test`
Expected: 全數通過

- [ ] **Step 6: Commit**

```bash
git add src/components/ProfileCard.tsx src/components/ChatPanel.tsx src/components/RightPanel.tsx src/App.css
git commit -m "feat: 個人背景卡片——自述餵給聊天與命書解讀"
```

---

### Task 4: 端到端驗證（Playwright）

- [ ] **Step 1: dev server＋腳本**：開站→點側欄某命主→截圖（收合一行）→點展開→填文字→儲存→重新整理→確認摘要仍顯示。

```js
import { chromium } from 'file:///Users/jared/LifePath/ziwei-web/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto('http://localhost:5199');
await p.locator('.sb-name').first().click();
await p.waitForTimeout(800);
await p.screenshot({ path: process.env.S + '/profile-collapsed.png' });
await p.locator('.profile-bar').click();
await p.locator('.profile-card textarea').fill('測試背景：軟體工程師，2021 結婚');
await p.screenshot({ path: process.env.S + '/profile-open.png' });
await p.getByText('儲存', { exact: true }).click();
await p.waitForTimeout(600);
await p.reload();
await p.locator('.sb-name').first().click();
await p.waitForTimeout(800);
await p.screenshot({ path: process.env.S + '/profile-saved.png' });
await b.close();
```

- [ ] **Step 2: 檢視截圖確認**；測完把該命主 profile 清回原狀（再開卡片清空儲存，或直接還原 data 檔）。

- [ ] **Step 3: 收尾**：關 server、`npm test && npm run lint`，殘餘變更 commit。
