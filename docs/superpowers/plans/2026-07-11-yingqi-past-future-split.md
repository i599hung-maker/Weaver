# 重點應期拆「過往對答案／未來引動」實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 命書「肆 重點應期」拆成兩池：過往對答案（回看範圍與筆數隨命主虛歲級距）與未來引動（今年~+22 年權重前 8），選材、AI 提示詞、HTML 與 Markdown 渲染同步分段。

**Architecture:** 只改選材與呈現，不動斷應期引擎（`trigger.ts`）。`selectKeyEvents` 拆兩池後仍輸出單一 `BookEvent[]`（年份升冪），渲染端用既有 `isPast` 分段，型別零改動。

**Tech Stack:** TypeScript、Vitest。spec：`docs/superpowers/specs/2026-07-11-yingqi-past-future-split-design.md`。

## Global Constraints

- 專案根目錄：`/Users/jared/LifePath/ziwei-web`，所有指令在此執行。
- 程式註解、測試描述一律繁體中文（專有名詞保留英文）。
- **不要 git commit**：Jared 的工作流是直接改 main、說「推播上去」才 commit＋push。每個 task 結尾跑測試即可，跳過 commit 步驟。
- 排盤引擎（`src/engine/`）勿動；`npm test` 全套（含 `dingpan.test.ts` 23 tests）必須全過。
- 型別檢查指令：`npx tsc -b`（改完必跑）。
- 年齡級距（虛歲 = currentYear − birthYear + 1）：`age < 35` → 回看 8 年最多 4 筆；`age <= 55` → 回看 15 年最多 6 筆；其餘 → 回看 25 年最多 8 筆。過往入選年份虛歲不得早於 15（即 `year >= birthYear + 14`）。
- 未來池：`year >= currentYear` 且 `year <= currentYear + 22`，權重前 8，今年有命中必收。
- 兩池共同門檻（同現行）：`weight >= 2` 或 method 為「流命引動」／「災宮引動」。

---

### Task 1: `selectKeyEvents` 拆兩池

**Files:**
- Modify: `src/analysis/reportBook.ts:87-117`（`selectKeyEvents`）、`src/analysis/reportBook.ts:174`（`buildBookData` 呼叫處）
- Test: `src/analysis/__tests__/keyEvents.test.ts`（新建）

**Interfaces:**
- Consumes: `ChartAnalysis`（`src/analysis/analysis.ts`）、`TriggerHit`（`src/analysis/trigger.ts`）、`BookEvent`（同檔已定義，欄位不變）
- Produces: `selectKeyEvents(analysis: ChartAnalysis, currentYear: number, birthYear: number): BookEvent[]`（簽名多收 `birthYear`；回傳仍為單一陣列、年份升冪、`isPast` 標記正確）。Task 2~4 皆依賴 `book.events` 中 `isPast` 的正確性。

- [ ] **Step 1: 寫失敗測試**

新建 `src/analysis/__tests__/keyEvents.test.ts`。用手作的最小 `ChartAnalysis`（`selectKeyEvents` 只讀 `analysis.decadals[].hits`）做確定性測試：

```ts
import { describe, expect, it } from 'vitest';
import type { ChartAnalysis } from '../analysis';
import type { TriggerHit } from '../trigger';
import { selectKeyEvents } from '../reportBook';

const CURRENT = 2026;

/** 手作單筆命中：selectKeyEvents 只讀 year/age/yearGz/method/weight/reason */
function hit(year: number, birthYear: number, weight = 2, method: TriggerHit['method'] = '流命引動'): TriggerHit {
  return { year, age: year - birthYear + 1, yearGz: '甲子', method, topics: ['本命'], weight, reason: `${year}年測試命中` };
}

/** 手作最小 ChartAnalysis：只帶 decadals[].hits */
function fakeAnalysis(hits: TriggerHit[]): ChartAnalysis {
  return { decadals: [{ hits }] } as unknown as ChartAnalysis;
}

/** 產生連續年份命中 */
function yearsRange(from: number, to: number, birthYear: number, weight = 2): TriggerHit[] {
  const out: TriggerHit[] = [];
  for (let y = from; y <= to; y++) out.push(hit(y, birthYear, weight));
  return out;
}

describe('selectKeyEvents 過往池（年齡級距）', () => {
  it('<35 歲：回看 8 年、最多 4 筆、同權取較近年', () => {
    const birthYear = 1996; // 虛歲 31
    const events = selectKeyEvents(fakeAnalysis(yearsRange(2000, 2025, birthYear)), CURRENT, birthYear);
    const past = events.filter((e) => e.isPast);
    // 窗口 2018~2025 全是同權重 → 取較近的 2022~2025 四筆
    expect(past.map((e) => e.year)).toEqual([2022, 2023, 2024, 2025]);
  });

  it('35~55 歲：回看 15 年、最多 6 筆', () => {
    const birthYear = 1980; // 虛歲 47
    const events = selectKeyEvents(fakeAnalysis(yearsRange(1990, 2025, birthYear)), CURRENT, birthYear);
    const past = events.filter((e) => e.isPast);
    expect(past).toHaveLength(6);
    for (const e of past) expect(e.year).toBeGreaterThanOrEqual(CURRENT - 15);
  });

  it('>55 歲：回看 25 年、最多 8 筆', () => {
    const birthYear = 1960; // 虛歲 67
    const events = selectKeyEvents(fakeAnalysis(yearsRange(1980, 2025, birthYear)), CURRENT, birthYear);
    const past = events.filter((e) => e.isPast);
    expect(past).toHaveLength(8);
    for (const e of past) expect(e.year).toBeGreaterThanOrEqual(CURRENT - 25);
  });

  it('級距邊界：55 歲回看 15 年（撈不到 2003）、56 歲回看 25 年（撈得到）', () => {
    // 2003 給權重 3：若在窗口內必進前幾名，用它探測回看範圍
    const pastYears = (birthYear: number) =>
      selectKeyEvents(fakeAnalysis([...yearsRange(2018, 2025, birthYear), hit(2003, birthYear, 3)]), CURRENT, birthYear)
        .filter((e) => e.isPast)
        .map((e) => e.year);
    expect(pastYears(1972)).not.toContain(2003); // 虛歲 55 → 35~55 級距，窗口 2011 起
    expect(pastYears(1971)).toContain(2003); // 虛歲 56 → >55 級距，窗口 2001 起
  });

  it('過往入選年份虛歲不早於 15', () => {
    const birthYear = 2010; // 虛歲 17，回看 8 年窗口踩到童年
    const events = selectKeyEvents(fakeAnalysis(yearsRange(2018, 2025, birthYear)), CURRENT, birthYear);
    const past = events.filter((e) => e.isPast);
    // 下限 birthYear+14 = 2024 → 只剩 2024、2025
    expect(past.map((e) => e.year)).toEqual([2024, 2025]);
  });

  it('權重門檻：weight 1 的疊星不入選', () => {
    const birthYear = 1980;
    const hits = [hit(2024, birthYear, 1, '同星相疊'), hit(2025, birthYear, 2)];
    const past = selectKeyEvents(fakeAnalysis(hits), CURRENT, birthYear).filter((e) => e.isPast);
    expect(past.map((e) => e.year)).toEqual([2025]);
  });
});

describe('selectKeyEvents 未來池', () => {
  it('今年~+22 年取權重前 8、今年命中必收、不佔過往名額', () => {
    const birthYear = 1980;
    // 今年 weight 2；2027~2035 九筆 weight 3 → 前 8 擠掉今年，但今年必收
    const hits = [hit(CURRENT, birthYear, 2), ...yearsRange(2027, 2035, birthYear, 3)];
    const events = selectKeyEvents(fakeAnalysis(hits), CURRENT, birthYear);
    const future = events.filter((e) => !e.isPast);
    expect(future).toHaveLength(8);
    expect(future.some((e) => e.isCurrent)).toBe(true);
    expect(events.filter((e) => e.isPast)).toHaveLength(0);
  });

  it('超過 +22 年不入選', () => {
    const birthYear = 1996;
    const events = selectKeyEvents(fakeAnalysis([hit(CURRENT + 23, birthYear, 3)]), CURRENT, birthYear);
    expect(events).toHaveLength(0);
  });

  it('合併結果依年份升冪且 isPast 標記正確', () => {
    const birthYear = 1960;
    const events = selectKeyEvents(fakeAnalysis(yearsRange(1980, 2048, birthYear)), CURRENT, birthYear);
    const years = events.map((e) => e.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    for (const e of events) expect(e.isPast).toBe(e.year < CURRENT);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/analysis/__tests__/keyEvents.test.ts`
Expected: FAIL——`selectKeyEvents` 目前只收 2 個參數、窗口是 −6~+22 混池，多數斷言不成立（TS 對多傳參數不會擋執行，vitest 會照跑）。

- [ ] **Step 3: 改 `selectKeyEvents` 與呼叫處**

`src/analysis/reportBook.ts` 把 87~117 行的 `selectKeyEvents`（含上方註解）整段換成：

```ts
/** 年齡級距（虛歲）：過往池回看年數與筆數上限 */
function pastQuota(age: number): { lookback: number; max: number } {
  if (age < 35) return { lookback: 8, max: 4 };
  if (age <= 55) return { lookback: 15, max: 6 };
  return { lookback: 25, max: 8 };
}

/**
 * 重點應期拆兩池（年份升冪合併輸出）：
 * - 過往對答案：回看範圍與筆數隨虛歲級距，權重優先、同權取較近年，且虛歲不早於 15
 * - 未來引動：今年~+22 年權重前 8，今年命中必收
 */
export function selectKeyEvents(analysis: ChartAnalysis, currentYear: number, birthYear: number): BookEvent[] {
  const quota = pastQuota(currentYear - birthYear + 1);
  const minPastYear = Math.max(currentYear - quota.lookback, birthYear + 14);
  const byYear = new Map<number, BookEvent>();
  for (const d of analysis.decadals) {
    for (const h of d.hits) {
      if (h.weight < 2 && h.method !== '流命引動' && h.method !== '災宮引動') continue;
      if (h.year < currentYear ? h.year < minPastYear : h.year > currentYear + 22) continue;
      const e =
        byYear.get(h.year) ??
        ({
          year: h.year,
          gz: h.yearGz,
          age: h.age,
          isCurrent: h.year === currentYear,
          isPast: h.year < currentYear,
          marks: [],
          weight: 0,
          reasons: [],
        } satisfies BookEvent);
      e.weight += h.weight;
      e.reasons.push(h.reason);
      if (!e.marks.includes(h.method)) e.marks.push(h.method);
      byYear.set(h.year, e);
    }
  }
  const all = [...byYear.values()];
  const past = all
    .filter((e) => e.isPast)
    .sort((a, b) => b.weight - a.weight || b.year - a.year)
    .slice(0, quota.max);
  const futureAll = all.filter((e) => !e.isPast).sort((a, b) => b.weight - a.weight || a.year - b.year);
  let future = futureAll.slice(0, 8);
  const cur = futureAll.find((e) => e.isCurrent);
  if (cur && !future.includes(cur)) future = [...future.slice(0, 7), cur];
  return [...past, ...future].sort((a, b) => a.year - b.year);
}
```

`buildBookData` 內（原 174 行）呼叫處改為：

```ts
    events: selectKeyEvents(analysis, currentYear, birthYear),
```

（`birthYear` 該函式開頭已有：`const birthYear = analysis.header.birthYear;`）

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/analysis/__tests__/keyEvents.test.ts`
Expected: PASS（10 tests）

- [ ] **Step 5: 型別檢查＋全套測試**

Run: `npx tsc -b && npm test`
Expected: 全過（既有 `reportBookProfile.test.ts` 呼叫的是 `buildBookData`，簽名沒變，不受影響）

---

### Task 2: `eventsPrompt` 分列過往／未來＋驗證點指示

**Files:**
- Modify: `src/analysis/reportBook.ts:300-316`（`eventsPrompt`）
- Test: `src/analysis/__tests__/keyEvents.test.ts`（追加 describe）

**Interfaces:**
- Consumes: Task 1 的 `book.events`（`isPast` 正確）、既有 `eventLines`／`headerDesc`／`JSON_RULE`／`withProfile`（`buildBookChapters` 內已把命主自述接到本章，不用改）
- Produces: `events` 章 prompt 內含「【過往年份（對答案）】」「【未來年份】」「驗證點」與「命中自述」指示。JSON 輸出格式（`{"events":[{year,title,desc,why,advice}]}`）不變，下游 `eventsSection`／`eventsMd` 解析不受影響。

- [ ] **Step 1: 寫失敗測試**

在 `src/analysis/__tests__/keyEvents.test.ts` 檔尾追加（用真盤走整條組裝鏈）：

```ts
import { cast } from '../../engine/cast';
import { buildAnalysis } from '../analysis';
import { buildBookChapters, buildBookData } from '../reportBook';

describe('eventsPrompt 過往/未來分列', () => {
  const result = cast({ date: '1960-09-20', time: '10:30', gender: '女' }); // 高齡命主，過往池必有料
  const analysis = buildAnalysis(result);
  const book = buildBookData(result, analysis, CURRENT);
  const prompt = buildBookChapters(analysis, book, CURRENT).find((c) => c.key === 'events')!.prompt;

  it('年份清單分列過往與未來', () => {
    expect(prompt).toContain('【過往年份（對答案）】');
    expect(prompt).toContain('【未來年份】');
  });

  it('advice 語意分流：過往寫驗證點、未來給建議', () => {
    expect(prompt).toContain('驗證點');
    expect(prompt).toContain('命中自述');
  });

  it('年份清單仍要求一一對應全部年份', () => {
    const allYears = book.events.map((e) => e.year).join('、');
    expect(prompt).toContain(allYears);
  });
});
```

（import 併入檔頭既有 import 區。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/analysis/__tests__/keyEvents.test.ts`
Expected: FAIL——現行 prompt 只有【年份清單】，無分列與驗證點字樣。

- [ ] **Step 3: 改 `eventsPrompt`**

`src/analysis/reportBook.ts` 的 `eventsPrompt` 整個函式換成：

```ts
function eventsPrompt(analysis: ChartAnalysis, book: BookData, currentYear: number): string {
  const past = book.events.filter((e) => e.isPast);
  const future = book.events.filter((e) => !e.isPast);
  const allYears = book.events.map((e) => e.year).join('、');
  return `你是占驗派紫微斗數論命助手。以下是規則引擎推算的重點應期年份與原因（占驗派流命引動法＋疊星引動法，程式計算，勿自行增減），請為視覺化命書的「重點應期」時間軸產生每年的解讀。時間軸分兩段：過往年份用來對答案驗盤，未來年份給建議。

【命主】${headerDesc(analysis)}。今年西元 ${currentYear} 年。${book.meta.natalMutText}。

【過往年份（對答案）】${past.length > 0 ? past.map((e) => e.year).join('、') : '（無）'}
【未來年份】${future.map((e) => e.year).join('、')}

【各年引動原因】
${eventLines(book.events)}

【輸出 JSON 格式（結構範例，值請換成內容）】
{"events":[{"year":2026,"title":"該年主題（≤16字）","desc":"40~80字，白話講會發生什麼","why":"60~120字，完整原因鏈：看到什麼（星＋宮＋四化）→ 所以推論什麼","advice":"≤60字；未來年份給具體建議；過往年份寫驗證點——一句可回想對照的問句（例：這年是否換了工作？）"}]}
events 必須一一對應全部年份（${allYears}），全部涵蓋、依年份升冪、不得新增或刪除年份。
過往年份若命主自述有提到對應年份的事件，desc 或 advice 要直接指出「此年命中自述的○○」，作為驗盤信心依據。

${JSON_RULE}`;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/analysis/__tests__/keyEvents.test.ts`
Expected: PASS

- [ ] **Step 5: 型別檢查＋全套測試**

Run: `npx tsc -b && npm test`
Expected: 全過

---

### Task 3: HTML 渲染 `eventsSection` 兩段時間軸

**Files:**
- Modify: `server/reportTemplate.ts:912-944`（`eventsSection`）、`server/reportTemplate.ts:547` 附近（`.tl` CSS 區塊加 `.tlh` 樣式）
- Test: `server/__tests__/reportTemplate.test.ts`（追加斷言）

**Interfaces:**
- Consumes: `book.events`（`isPast`／`isCurrent`）、章節 JSON `{events:[{year,title,desc,why,advice}]}`、既有 `eventMark`／`slot`／`escapeHtml`／`fallbackBlock`
- Produces: 「肆 重點應期」章內兩段：`<h3 class="tlh">過往對答案…` 段（過往為空時整段不輸出，鏈尾標籤「驗證點」）＋`<h3 class="tlh">未來引動…` 段（鏈尾標籤「建議」）。

- [ ] **Step 1: 寫失敗測試**

`server/__tests__/reportTemplate.test.ts` 內找到 renderBookHtml 的 describe（269 行附近有 `for (const e of book.events) expect(html).toContain(...)`），在同一個 describe 追加：

```ts
  it('重點應期分過往對答案與未來引動兩段', () => {
    expect(html).toContain('過往對答案');
    expect(html).toContain('未來引動');
    // 過往年份（2023/2024）的鏈尾標籤是驗證點，未來是建議
    expect(html).toContain('<em>驗證點</em>');
    expect(html).toContain('<em>建議</em>');
    expect(html).not.toContain('<em>回看</em>');
    // 過往段在未來段之前
    expect(html.indexOf('過往對答案')).toBeLessThan(html.indexOf('未來引動'));
  });
```

（`html` 為該 describe 既有的 renderBookHtml 輸出變數，沿用；fixture events 已含 2023、2024 兩筆 `isPast: true`。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run server/__tests__/reportTemplate.test.ts`
Expected: FAIL——現行是單一時間軸、標籤是「回看」。

- [ ] **Step 3: 改 `eventsSection` 與 CSS**

`server/reportTemplate.ts` 把 `eventsSection`（912~944 行）換成（單筆渲染抽成 `eventRow`）：

```ts
/** 單筆應期列：過往鏈尾標「驗證點」、未來標「建議」 */
function eventRow(e: BookEvent, byYear: Map<number, Dict>): string {
  const c = byYear.get(e.year);
  const mk = eventMark(e);
  const title = c && str(c.title) ? slot(c.title) : `${escapeHtml(mk.text)}年`;
  const desc = c && str(c.desc) ? slot(c.desc) : '';
  const why = c && str(c.why) ? slot(c.why) : e.reasons.map((r) => escapeHtml(r)).join('；');
  const advice = c && str(c.advice) ? slot(c.advice) : '';
  const chain = `<div class="chain"><em>為什麼</em>：${why}${advice ? `<br><em>${e.isPast ? '驗證點' : '建議'}</em>：${advice}` : ''}</div>`;
  return `<div class="ev${e.isCurrent ? ' hot' : ''}">
        <div class="y"><div class="yy">${e.year}</div><div class="gz2">${escapeHtml(e.gz)} · ${e.age}歲${e.isCurrent ? ' · 今年' : ''}</div><span class="mk ${mk.cls}">${escapeHtml(mk.text)}</span></div>
        <div>
          <h5>${title}</h5>
          ${desc ? `<p>${desc}</p>` : ''}
          ${chain}
        </div>
      </div>`;
}

function eventsSection(book: BookData, ch: unknown): string {
  const head = `<div class="syshead"><div class="idx">肆</div><h2>重點應期</h2><div class="en">哪些年要特別注意 · 附為什麼</div></div>
    <p class="desc" style="text-align:center; margin:20px auto 4px; max-width:680px; color:var(--silk-dim)">年份由程式照占驗派規則推算（流命引動法＋疊星引動法）。</p>`;
  const o = asObj(ch);
  const items = o ? arr(o.events).map(asObj).filter((x): x is Dict => !!x && typeof x.year === 'number') : [];
  if (items.length === 0) return `<div class="sys">${head}</div>${fallbackBlock('重點應期', ch)}`;
  const byYear = new Map(items.map((x) => [x.year as number, x]));
  const past = book.events.filter((e) => e.isPast);
  const future = book.events.filter((e) => !e.isPast);
  const seg = (label: string, sub: string, evs: BookEvent[]): string =>
    evs.length === 0
      ? ''
      : `<h3 class="tlh">${label}<span>${sub}</span></h3>
    <div class="tl">
      ${evs.map((e) => eventRow(e, byYear)).join('\n\n      ')}
    </div>`;
  return `<div class="sys">
    ${head}
    ${seg('過往對答案', '拿實際發生的事驗盤', past)}
    ${seg('未來引動', '每年附建議', future)}
  </div>`;
}
```

CSS：在 `.tl{margin-top:28px; ...}`（547 行）之前加：

```css
  .tlh{margin-top:34px; font-family:var(--serif); font-weight:900; font-size:18px; color:var(--gold); letter-spacing:.12em}
  .tlh span{margin-left:10px; font-size:12px; font-weight:400; color:var(--silk-dim); letter-spacing:.08em}
```

（`.tl` 自身的 `margin-top:28px` 改為 `14px`，因為上方多了段標題。）

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run server/__tests__/reportTemplate.test.ts`
Expected: PASS（含既有斷言；fixture 會輸出 `data/reports/__fixture__.html` 可人工開來看兩段版型）

- [ ] **Step 5: 型別檢查＋全套測試**

Run: `npx tsc -b && npm test`
Expected: 全過

---

### Task 4: Markdown 渲染 `eventsMd` 兩小節

**Files:**
- Modify: `server/reportMarkdown.ts:165-184`（`eventsMd`）
- Test: `server/__tests__/reportMarkdown.test.ts`（追加斷言）

**Interfaces:**
- Consumes: 同 Task 3（`book.events`＋章節 JSON），既有 `eventMarkText`／`fallbackMd`
- Produces: `## 重點應期` 下分 `### 過往對答案`（空則整節不輸出）與 `### 未來引動`，單年標題降為 `####`，過往列用「驗證點」。

- [ ] **Step 1: 寫失敗測試**

`server/__tests__/reportMarkdown.test.ts` 內 renderBookMarkdown 的 describe（153 行 `expect(md).toContain('## 重點應期')` 附近）追加：

```ts
  it('重點應期分過往對答案與未來引動兩小節', () => {
    expect(md).toContain('### 過往對答案');
    expect(md).toContain('### 未來引動');
    expect(md).toContain('- 驗證點：有身體狀況就是此應。');
    expect(md).toContain('- 建議：感情大事可以定。');
    expect(md).not.toContain('- 回看：');
    expect(md).toContain('#### 2023 癸卯 · 30歲（災宮引動）災宮踩在忌星上');
    expect(md.indexOf('### 過往對答案')).toBeLessThan(md.indexOf('### 未來引動'));
  });
```

（`md` 為該 describe 既有的 renderBookMarkdown 輸出變數，沿用；fixture events 含 2023 過往、2026 未來各一筆。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run server/__tests__/reportMarkdown.test.ts`
Expected: FAIL——現行單一清單、`### ${e.year}` 標題、「回看」標籤。

- [ ] **Step 3: 改 `eventsMd`**

`server/reportMarkdown.ts` 把 `eventsMd`（165~184 行）換成：

```ts
/** 重點應期：依 isPast 分「過往對答案／未來引動」兩小節（對照 eventsSection 的兩段時間軸） */
function eventsMd(book: BookData, ch: unknown): string[] {
  const o = asObj(ch);
  const items = o ? arr(o.events).map(asObj).filter((x): x is Dict => !!x && typeof x.year === 'number') : [];
  if (items.length === 0) return fallbackMd(ch);
  const byYear = new Map(items.map((x) => [x.year as number, x]));
  const lines = (e: BookEvent): string[] => {
    const c = byYear.get(e.year);
    const mk = eventMarkText(e);
    const title = c && str(c.title) ? (c.title as string) : `${mk}年`;
    const out: string[] = [`#### ${e.year} ${e.gz} · ${e.age}歲${e.isCurrent ? ' · 今年' : ''}（${mk}）${title}`, ''];
    if (c && str(c.desc)) out.push(c.desc as string, '');
    const why = c && str(c.why) ? (c.why as string) : e.reasons.join('；');
    out.push(`- 為什麼：${why}`);
    if (c && str(c.advice)) out.push(`- ${e.isPast ? '驗證點' : '建議'}：${c.advice as string}`);
    out.push('');
    return out;
  };
  const past = book.events.filter((e) => e.isPast);
  const future = book.events.filter((e) => !e.isPast);
  const out: string[] = [];
  if (past.length > 0) out.push('### 過往對答案', '', ...past.flatMap(lines));
  if (future.length > 0) out.push('### 未來引動', '', ...future.flatMap(lines));
  return out;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run server/__tests__/reportMarkdown.test.ts`
Expected: PASS

- [ ] **Step 5: 型別檢查＋全套測試＋lint**

Run: `npx tsc -b && npm test && npm run lint`
Expected: 全過、lint 乾淨

---

### Task 5: 端到端驗收

**Files:**
- 無程式改動；驗證產物

**Interfaces:**
- Consumes: Task 1~4 全部完成
- Produces: 驗收結論（高齡／年輕命主兩本命書的分段正確）

- [ ] **Step 1: 全套驗證指令**

Run: `npx tsc -b && npm test && npm run lint`
Expected: 全過

- [ ] **Step 2: fixture HTML 人工檢查**

打開 `data/reports/__fixture__.html`（Task 3 測試產出），確認：「肆 重點應期」章內先「過往對答案」（2023、2024，鏈尾「驗證點」）後「未來引動」（2026 高亮今年、2028、2031，鏈尾「建議」），段標題樣式正常。

- [ ] **Step 3: 回報**

彙整：兩池選材規則生效、HTML/MD 分段輸出、全套測試與 lint 結果。不 commit（等 Jared 說「推播上去」）。
