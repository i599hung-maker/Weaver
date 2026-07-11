# 出生時間滾輪選擇 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增命主表單改為 稱呼→性別→出生地→出生時間 順序，出生時間用 iOS 式五欄滾輪（年/月/日/時/分，上下滑動置中選取）。

**Architecture:** 通用單欄滾輪元件 `WheelPicker`（原生捲動＋CSS scroll-snap，捲停 debounce 回報置中項，點擊置中）；日數計算抽純函式 `birthWheel.ts`；`MingzhuModal` 改以五個數字 state 組回既有的 `date`/`time` 字串，`BirthInput` 與引擎零改動。

**Tech Stack:** React 19 + TypeScript + CSS scroll-snap + vitest。

**Spec:** `docs/specs/2026-07-11-birth-wheel-picker-design.md`

## Global Constraints

- 送出格式不變：`date = "YYYY-MM-DD"`、`time = "HH:MM"`（零填充）。
- 預設值維持 1990/1/1 12:00；年範圍 1920～當年（上到下遞增）。
- 使用者可見文案繁體中文；欄位 label 帶單位（`1995年`、`2月`、`18日`、`14時`、`30分`）。
- 無新依賴。測試指令 `npx vitest run <file>`；全套 `npm test`；`npm run lint`；`npm run build`。
- `src/App.css` 有使用者未提交的星空背景 WIP 修改：只能「附加」樣式到檔尾，commit 時用 index 技巧只納入自己的區塊（見 Task 2 Step 4）。

---

### Task 1: 日數純函式 `birthWheel.ts`

**Files:**
- Create: `src/components/birthWheel.ts`
- Test: `src/components/__tests__/birthWheel.test.ts`

**Interfaces:**
- Produces: `daysInMonth(year: number, month: number): number`（month 1–12）、`clampDay(year: number, month: number, day: number): number`、`pad2(n: number): string`。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/components/__tests__/birthWheel.test.ts
import { describe, expect, it } from 'vitest';
import { clampDay, daysInMonth, pad2 } from '../birthWheel';

describe('daysInMonth', () => {
  it('大小月', () => {
    expect(daysInMonth(1995, 1)).toBe(31);
    expect(daysInMonth(1995, 4)).toBe(30);
    expect(daysInMonth(1995, 2)).toBe(28);
  });
  it('閏年 2 月', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29); // 400 倍數閏
    expect(daysInMonth(1900, 2)).toBe(28); // 100 倍數不閏
  });
});

describe('clampDay', () => {
  it('超過月底夾回', () => {
    expect(clampDay(1995, 2, 31)).toBe(28);
    expect(clampDay(2024, 2, 30)).toBe(29);
  });
  it('合法值不動', () => {
    expect(clampDay(1995, 1, 31)).toBe(31);
  });
});

describe('pad2', () => {
  it('零填充', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(12)).toBe('12');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/__tests__/birthWheel.test.ts`
Expected: FAIL（Cannot find module '../birthWheel'）

- [ ] **Step 3: 實作**

```ts
// src/components/birthWheel.ts
/** 出生時間滾輪的日期輔助：月天數與日數夾回（month 為 1–12） */

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/__tests__/birthWheel.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add src/components/birthWheel.ts src/components/__tests__/birthWheel.test.ts
git commit -m "feat: 出生時間滾輪日數輔助函式"
```

---

### Task 2: 通用滾輪元件 `WheelPicker`＋樣式

**Files:**
- Create: `src/components/WheelPicker.tsx`
- Modify: `src/App.css`（附加到檔尾）

**Interfaces:**
- Produces: `WheelPicker` 元件，Props `{ options: WheelOption[]; value: number; onChange: (value: number) => void }`，`WheelOption = { value: number; label: string }`；格高常數 `ITEM_H = 32`（CSS 的 `.wheel-item` 高度與 `.wheel-col` padding 必須配合：容器高 160、上下 padding 64）。

- [ ] **Step 1: 實作元件**

```tsx
// src/components/WheelPicker.tsx
import { useEffect, useRef } from 'react';

export interface WheelOption {
  value: number;
  label: string;
}

interface Props {
  options: WheelOption[];
  value: number;
  onChange: (value: number) => void;
}

/** 格高 px：與 App.css 的 .wheel-item 高度、.wheel-col padding（2 格）連動 */
const ITEM_H = 32;

/** 單欄上下滑動滾輪：scroll-snap 置中吸附，捲停回報置中項，點擊任一格置中 */
export default function WheelPicker({ options, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);

  // 外部 value 變更（含初始、日數夾回）→ 同步捲動位置
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTo({ top: target });
  }, [value, options]);

  // 捲動停止（debounce 120ms）→ 以位置反推置中項
  const onScroll = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (options[idx].value !== value) onChange(options[idx].value);
    }, 120);
  };

  return (
    <div className="wheel-col" ref={ref} onScroll={onScroll}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`wheel-item${o.value === value ? ' sel' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

（點擊只呼叫 `onChange`，捲動定位交給上方的 useEffect，避免兩處捲動打架。）

- [ ] **Step 2: 附加樣式到 `src/App.css` 檔尾**（用 `cat >>`，勿動檔案其他部分）

```css

/* 出生時間滾輪：五欄 年/月/日/時/分，上下滑動置中選取 */
.wheel-row {
  position: relative;
  display: flex;
  gap: 2px;
  margin: 4px 0 10px;
}
.wheel-row::before,
.wheel-row::after {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  height: 1px;
  background: #555;
  pointer-events: none;
}
.wheel-row::before {
  top: calc(50% - 16px);
}
.wheel-row::after {
  top: calc(50% + 16px);
}
.wheel-col {
  flex: 1;
  height: 160px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  padding: 64px 0;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent, #000 25%, #000 75%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 25%, #000 75%, transparent);
}
.wheel-col::-webkit-scrollbar {
  display: none;
}
.wheel-item {
  display: block;
  width: 100%;
  height: 32px;
  line-height: 32px;
  scroll-snap-align: center;
  text-align: center;
  background: none;
  border: none;
  padding: 0;
  font-size: 14px;
  color: #777;
  cursor: pointer;
}
.wheel-item.sel {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}
```

- [ ] **Step 3: 驗證 lint 與 build**

Run: `npm run lint && npm run build`
Expected: 無錯誤（chunk 大小警告為既有現象，忽略）

- [ ] **Step 4: Commit（App.css 只納入自己附加的區塊）**

```bash
S=<scratchpad 目錄>
git show HEAD:src/App.css > "$S/head-app.css"
LINE=$(grep -n '出生時間滾輪' src/App.css | cut -d: -f1)
tail -n +"$((LINE-1))" src/App.css > "$S/my-tail.css"
cat "$S/head-app.css" "$S/my-tail.css" > "$S/staged-app.css"
BLOB=$(git hash-object -w "$S/staged-app.css")
git update-index --cacheinfo 100644 "$BLOB" src/App.css
git add src/components/WheelPicker.tsx
git commit -m "feat: WheelPicker 滾輪選擇元件"
```

**注意：** 若 HEAD 的 App.css 已含先前 commit 的 AI 綠燈樣式，此法直接適用；`git diff src/App.css` 提交後應只剩使用者的星空背景 WIP。

---

### Task 3: MingzhuModal 改版（欄位順序＋五欄滾輪）

**Files:**
- Modify: `src/components/MingzhuModal.tsx`（整檔改寫）
- Test: `src/components/__tests__/birthWheel.test.ts`（沿用，無新增）

**Interfaces:**
- Consumes: `WheelPicker`／`WheelOption`（Task 2）、`daysInMonth`/`clampDay`/`pad2`（Task 1）。
- Produces: 對外 Props 不變（`open`/`onClose`/`onSubmit(name, birth)`），`BirthInput` 格式不變。

- [ ] **Step 1: 整檔改寫 `src/components/MingzhuModal.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { BirthInput, Gender } from '../engine/types';
import { PLACES } from './places';
import WheelPicker, { type WheelOption } from './WheelPicker';
import { clampDay, daysInMonth, pad2 } from './birthWheel';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, birth: BirthInput) => void;
}

const CUSTOM = '自訂';

const THIS_YEAR = new Date().getFullYear();

function range(from: number, to: number, unit: string): WheelOption[] {
  const list: WheelOption[] = [];
  for (let v = from; v <= to; v++) list.push({ value: v, label: `${v}${unit}` });
  return list;
}

const YEARS = range(1920, THIS_YEAR, '年');
const MONTHS = range(1, 12, '月');
const HOURS = range(0, 23, '時');
const MINUTES = range(0, 59, '分');

export default function MingzhuModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('男');
  const [place, setPlace] = useState('台北');
  const [customLng, setCustomLng] = useState(121);
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const valid = name.trim() !== '';
  /** 月底夾回：例如選了 31 日再切到 2 月 → 顯示與送出都用 28/29 */
  const safeDay = clampDay(year, month, day);
  const days = range(1, daysInMonth(year, month), '日');

  const submit = () => {
    if (!valid) return;
    const p = PLACES.find((pl) => pl.name === place);
    const geo = p ? { longitude: p.longitude, tzOffset: p.tzOffset } : { longitude: customLng, tzOffset: 8 };
    onSubmit(name.trim(), {
      name: name.trim(),
      date: `${year}-${pad2(month)}-${pad2(safeDay)}`,
      time: `${pad2(hour)}:${pad2(minute)}`,
      gender,
      useTrueSolarTime: true,
      ...geo,
    });
    setName('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>新增命主</h2>
        <label className="m-row">
          <span className="m-label">稱呼＊</span>
          <input
            autoFocus
            placeholder="必填"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="m-row">
          <span className="m-label">性別</span>
          <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </label>
        <label className="m-row">
          <span className="m-label">出生地</span>
          <select value={place} onChange={(e) => setPlace(e.target.value)}>
            {PLACES.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
            <option value={CUSTOM}>{CUSTOM}經度</option>
          </select>
        </label>
        {place === CUSTOM && (
          <label className="m-row">
            <span className="m-label">東經</span>
            <input
              type="number"
              value={customLng}
              step="0.1"
              onChange={(e) => setCustomLng(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
        )}
        <div className="m-row">
          <span className="m-label">出生時間</span>
        </div>
        <div className="wheel-row">
          <WheelPicker options={YEARS} value={year} onChange={setYear} />
          <WheelPicker options={MONTHS} value={month} onChange={setMonth} />
          <WheelPicker options={days} value={safeDay} onChange={setDay} />
          <WheelPicker options={HOURS} value={hour} onChange={setHour} />
          <WheelPicker options={MINUTES} value={minute} onChange={setMinute} />
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" disabled={!valid} onClick={submit}>
            排盤並儲存
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 驗證**

Run: `npm run lint && npm run build && npm test`
Expected: 全數通過

- [ ] **Step 3: Commit**

```bash
git add src/components/MingzhuModal.tsx
git commit -m "feat: 命主表單改版——出生時間五欄滾輪選擇"
```

---

### Task 4: 端到端驗證（Playwright 截圖）

- [ ] **Step 1: 啟動 dev server 並用 Playwright 操作**

```bash
npm run dev -- --port 5199 &   # 背景
```

腳本（node，playwright 從專案 node_modules 以絕對 file:// URL import）：

```js
import { chromium } from 'file:///Users/jared/LifePath/ziwei-web/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto('http://localhost:5199');
await p.locator('button[title="新增命主"]').click();
await p.waitForTimeout(400);
await p.screenshot({ path: process.env.S + '/mingzhu-modal.png' });
// 滾動年欄驗證選取會變
await p.locator('.wheel-col').first().hover();
await p.mouse.wheel(0, 160); // 往下 5 格
await p.waitForTimeout(500);
await p.screenshot({ path: process.env.S + '/mingzhu-scrolled.png' });
await b.close();
```

- [ ] **Step 2: 檢視截圖**

確認：欄位順序 稱呼→性別→出生地→出生時間；五欄滾輪一行排開、置中帶上下細線、選中項白色粗體；滾動後年值改變。

- [ ] **Step 3: 收尾**

關 dev server；`npm test && npm run lint` 最終確認；如有殘餘變更 commit。
