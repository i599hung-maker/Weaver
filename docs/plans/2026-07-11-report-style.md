# 命書風格（白話／書面） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定頁可選命書文風——白話（預設，接地氣）／書面（現行正式風），套用到完整命書九章與聊天報告模式。

**Architecture:** `chatPrompt.ts` 匯出 `ReportStyle` 型別與 `styleSection(style?)`（plain 回白話寫作規則、classic／未傳回空字串）；`buildChatPrompt` 與 `buildBookChapters` 各加選填 `style` 參數；`Settings.reportStyle` 預設 `'plain'`，設定頁一列下拉；呼叫端 `loadSettings().reportStyle` 帶上。

**Tech Stack:** React 19 + TypeScript + vitest。

**Spec:** `docs/specs/2026-07-11-report-style-design.md`

## Global Constraints

- `classic` 與未傳 style 時，prompt 輸出與現行**完全一致**（零改動）。
- 聊天模式（mode `'chat'`）永遠不附加風格段。
- UI 文案：「白話（接地氣）」「書面（正式）」，預設白話。
- 測試指令 `npx vitest run <file>`；全套 `npm test`；`npm run lint`；`npm run build`。

---

### Task 1: `styleSection`＋`buildChatPrompt` 的 style 參數

**Files:**
- Modify: `src/analysis/chatPrompt.ts`（`profileSection` 附近）
- Test: `src/analysis/__tests__/chatPrompt.test.ts`（附加）

**Interfaces:**
- Produces: `export type ReportStyle = 'plain' | 'classic'`；`export function styleSection(style?: ReportStyle): string`；`buildChatPrompt(analysis, history, question, currentYear, mode?, profile?, style?)` 第 7 個選填參數（僅 `mode === 'report'` 生效）。

- [ ] **Step 1: 附加失敗測試到 `src/analysis/__tests__/chatPrompt.test.ts`**

```ts
describe('命書風格 style', () => {
  it('report＋plain 時含白話風格段', () => {
    const prompt = buildChatPrompt(analysis, [], '問題', 2026, 'report', undefined, 'plain');
    expect(prompt).toContain('【寫作風格：白話】');
    expect(prompt).toContain('像跟朋友喝咖啡聊天');
  });

  it('report＋classic 與未傳時不含風格段且輸出一致', () => {
    const classic = buildChatPrompt(analysis, [], '問題', 2026, 'report', undefined, 'classic');
    const none = buildChatPrompt(analysis, [], '問題', 2026, 'report');
    expect(classic).not.toContain('【寫作風格');
    expect(classic).toBe(none);
  });

  it('chat 模式即使 plain 也不含風格段', () => {
    const prompt = buildChatPrompt(analysis, [], '問題', 2026, 'chat', undefined, 'plain');
    expect(prompt).not.toContain('【寫作風格');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/analysis/__tests__/chatPrompt.test.ts`
Expected: FAIL（styleSection 未定義／不含段落）

- [ ] **Step 3: 實作** — `src/analysis/chatPrompt.ts` 在 `profileSection` 之後加：

```ts
export type ReportStyle = 'plain' | 'classic';

/** 命書寫作風格段：plain 回白話規則（語感對標使用者認可的舊版報告），classic／未傳回空字串維持現行輸出 */
export function styleSection(style?: ReportStyle): string {
  if (style !== 'plain') return '';
  return `【寫作風格：白話】
1. 像跟朋友喝咖啡聊天那樣講，直接對「你」說話；短句優先，一句一個重點。
2. 每個術語（星曜、宮位、四化、格局）出現後，緊接一句生活白話翻譯它對命主的意思。
3. 多用具體生活場景與比喻，語感範例：「東西交到你手上會變穩、變大」「錢會來，也容易莫名其妙少一塊」「幫忙可以，擔保不行」。
4. 結論先講、依據後講；禁止文言堆疊、對仗排比、連續抽象形容詞。`;
}
```

`buildChatPrompt` 簽名加第 7 參數，並在最後一個 `sections.push` 之後加風格段：

```ts
export function buildChatPrompt(
  analysis: ChartAnalysis,
  history: ChatMessage[],
  question: string,
  currentYear: number,
  mode: 'chat' | 'report' = 'chat',
  profile?: string,
  style?: ReportStyle,
): string {
```

```ts
  sections.push(mode === 'report' ? REPORT_REQUIREMENTS : CHAT_REQUIREMENTS);
  if (mode === 'report') {
    const ss = styleSection(style);
    if (ss) sections.push(ss);
  }
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/analysis/__tests__/chatPrompt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analysis/chatPrompt.ts src/analysis/__tests__/chatPrompt.test.ts
git commit -m "feat: styleSection 白話風格段與聊天報告模式 style 參數"
```

---

### Task 2: `buildBookChapters` 的 style 參數

**Files:**
- Modify: `src/analysis/reportBook.ts`（import 與 `buildBookChapters`）
- Test: `src/analysis/__tests__/reportBookProfile.test.ts`（附加）

**Interfaces:**
- Consumes: `styleSection`、`ReportStyle`（Task 1，自 `./chatPrompt` import——reportBook 已 import `profileSection`，無循環）。
- Produces: `buildBookChapters(analysis, book, currentYear, profile?, style?)` 第 5 個選填參數。

- [ ] **Step 1: 附加失敗測試到 `src/analysis/__tests__/reportBookProfile.test.ts`**

```ts
describe('buildBookChapters style', () => {
  it('plain 時每章 prompt 都含白話風格段', () => {
    for (const c of buildBookChapters(analysis, book, 2026, undefined, 'plain')) {
      expect(c.prompt).toContain('【寫作風格：白話】');
    }
  });

  it('classic 與未傳輸出一致且不含風格段', () => {
    const classic = buildBookChapters(analysis, book, 2026, undefined, 'classic');
    const none = buildBookChapters(analysis, book, 2026);
    expect(classic.map((c) => c.prompt)).toEqual(none.map((c) => c.prompt));
    for (const c of classic) expect(c.prompt).not.toContain('【寫作風格');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/analysis/__tests__/reportBookProfile.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作** — `src/analysis/reportBook.ts`：

import 行改為：

```ts
import { profileSection, styleSection, type ReportStyle } from './chatPrompt';
```

`buildBookChapters` 簽名與附加段改為：

```ts
export function buildBookChapters(analysis: ChartAnalysis, book: BookData, currentYear: number, profile?: string, style?: ReportStyle): ReportChapterSpec[] {
  const extra = [styleSection(style), profileSection(profile)].filter(Boolean).join('\n\n');
  const withProfile = (prompt: string): string => (extra ? `${prompt}\n\n${extra}` : prompt);
```

（其餘 9 章列表不動，仍用 `withProfile(...)` 包。）

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/analysis/__tests__/reportBookProfile.test.ts && npm test`
Expected: 全數 PASS

- [ ] **Step 5: Commit**

```bash
git add src/analysis/reportBook.ts src/analysis/__tests__/reportBookProfile.test.ts
git commit -m "feat: 命書九章 prompt 支援白話風格段"
```

---

### Task 3: Settings＋設定頁下拉＋呼叫端

**Files:**
- Modify: `src/store/settings.ts`（`Settings` 加 `reportStyle`）
- Modify: `src/components/SettingsModal.tsx`（AI 區塊加一列）
- Modify: `src/components/RightPanel.tsx`（`buildBookChapters` 呼叫）
- Modify: `src/components/ChatPanel.tsx`（兩處 `buildChatPrompt` 呼叫）
- Test: `src/store/__tests__/settings.test.ts`（附加）

**Interfaces:**
- Consumes: `ReportStyle`（Task 1）。
- Produces: `Settings.reportStyle: ReportStyle`，預設 `'plain'`。

- [ ] **Step 1: 附加失敗測試到 `src/store/__tests__/settings.test.ts`**

```ts
describe('reportStyle', () => {
  it('預設白話', () => {
    expect(DEFAULT_SETTINGS.reportStyle).toBe('plain');
  });

  it('舊資料缺欄位時自動補 plain', () => {
    stubStorage({ 'zhanyan-settings': JSON.stringify({ chartMode: 'full' }) });
    expect(loadSettings().reportStyle).toBe('plain');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/store/__tests__/settings.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 settings** — `src/store/settings.ts`：

```ts
import type { ReportStyle } from '../analysis/chatPrompt';
```

`Settings` 加欄位與預設：

```ts
  /** 命書文風：白話（預設）或書面（正式） */
  reportStyle: ReportStyle;
```

```ts
export const DEFAULT_SETTINGS: Settings = { chartMode: 'simple', aiProvider: 'claude', aiModel: 'opus', reportStyle: 'plain' };
```

- [ ] **Step 4: 設定頁** — `src/components/SettingsModal.tsx` 在「串接狀態」那列之後加：

```tsx
        <label className="m-row">
          <span className="m-label">命書風格</span>
          <select
            value={settings.reportStyle}
            onChange={(e) => onChange({ ...settings, reportStyle: e.target.value as Settings['reportStyle'] })}
          >
            <option value="plain">白話（接地氣）</option>
            <option value="classic">書面（正式）</option>
          </select>
        </label>
```

- [ ] **Step 5: 呼叫端**

`src/components/RightPanel.tsx`：import 改 `import { aiRequestParams, loadSettings } from '../store/settings';`（原本只有 aiRequestParams），呼叫改：

```ts
      const chapters = buildBookChapters(analysis, book, currentYear, mingzhu.profile, loadSettings().reportStyle);
```

`src/components/ChatPanel.tsx`：import 改 `import { aiRequestParams, loadSettings } from '../store/settings';`，兩處呼叫改：

```ts
      const prompt = buildChatPrompt(analysis, history, question, new Date().getFullYear(), qMode, mingzhu.profile, loadSettings().reportStyle);
```

usagePct 的 useMemo 內：

```ts
    const prompt = buildChatPrompt(
      analysis,
      activeConv.messages,
      input || '（估算用）',
      new Date().getFullYear(),
      mode,
      mingzhu.profile,
      loadSettings().reportStyle,
    );
```

- [ ] **Step 6: 驗證**

Run: `npx vitest run src/store/__tests__/settings.test.ts && npm test && npm run lint && npm run build`
Expected: 全數通過

- [ ] **Step 7: Commit**

```bash
git add src/store/settings.ts src/store/__tests__/settings.test.ts src/components/SettingsModal.tsx src/components/RightPanel.tsx src/components/ChatPanel.tsx
git commit -m "feat: 設定頁命書風格下拉（白話預設／書面），生成與報告帶入"
```

---

### Task 4: E2E 驗證

- [ ] **Step 1**: dev server ＋ Playwright：開設定 → 截圖確認「命書風格」下拉存在且預設「白話（接地氣）」；切到書面 → 重整 → 確認保留。
- [ ] **Step 2**: 關 server、`npm test && npm run lint`，殘餘變更 commit。
