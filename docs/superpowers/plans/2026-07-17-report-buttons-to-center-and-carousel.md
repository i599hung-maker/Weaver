# 右上按鈕移入中欄 ＋ 九章輪播 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把右欄頂列按鈕移到中欄（命盤/斷應期切換鈕移中欄頂端、命書生成鈕移中欄報告書區），讓右欄完整顯示命盤；報告書區未產生時顯示大按鈕，生成中顯示九章輪播文案。

**Architecture:** `chartTab` 狀態上提到 `App`；`RightPanel` 拆掉 `.rp-tabs` 頂列只留命盤/斷應期內容；生成邏輯整段從 `RightPanel` 搬進 `ReportsCard`（含大按鈕、九章輪播、單一狀態輪詢）；輪播目前章由 `status.json` 的 `done` 推導（純前端）；伺服器 `status.json` 加 `retrying` 旗標讓逾時重試插播訊息真實。

**Tech Stack:** React 19 + Vite + TypeScript，vitest 測試，dev server middleware（`server/reportPlugin.ts`）。

## Global Constraints

- 程式註解、commit message 一律繁體中文（專有名詞保留英文）。
- 改 TS 後必跑 `npx tsc -b`；推播前 `npm run lint`、`npm test` 全過。
- 排盤引擎（`src/engine/`）不動。
- 章序/章 key 以 `buildBookChapters`（`src/analysis/reportBook.ts`）為準：`hero, gift, topic_benming, topic_shiye, topic_caiyun, topic_aiqing, lims, events, compass`。
- 專案無 React 元件測試框架：UI 任務以 `npx tsc -b` + `npm run lint` + dev server 實際操作驗收；純函式/伺服器邏輯才寫 vitest。

---

### Task 1: 伺服器 `retrying` 旗標（C-1）

**Files:**
- Modify: `server/reportPlugin.ts`（`StatusFile` 型別、`retryOnTimeout`、`runGenerateJob` 呼叫處）
- Test: `server/__tests__/retryOnTimeout.test.ts`（新增 onRetry 案例，既有 3 案例不動）

**Interfaces:**
- Consumes: 既有 `AiTimeoutError`（`server/aiCall.js`）、`writeStatus`
- Produces: `retryOnTimeout(call, label, onRetry?)`；`StatusFile.retrying?: boolean`（前端 poll 可讀到）

- [ ] **Step 1: 寫失敗測試（onRetry 行為）**

在 `server/__tests__/retryOnTimeout.test.ts` 的 `describe` 內、最後補兩個 `it`：

```ts
  it('逾時重試時呼叫 onRetry 一次', async () => {
    const onRetry = vi.fn();
    const call = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new AiTimeoutError('claude CLI 逾時（600 秒）'))
      .mockResolvedValueOnce('章節內容');
    await expect(retryOnTimeout(call, '第8章', onRetry)).resolves.toBe('章節內容');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('未逾時不呼叫 onRetry', async () => {
    const onRetry = vi.fn();
    const call = vi.fn<() => Promise<string>>().mockResolvedValue('章節內容');
    await retryOnTimeout(call, '第8章', onRetry);
    expect(onRetry).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: 跑測試確認新案例失敗**

Run: `cd /Users/jared/LifePath/ziwei-web && npx vitest run server/__tests__/retryOnTimeout.test.ts`
Expected: 新增兩案例 FAIL（`retryOnTimeout` 目前無第三參數，onRetry 不會被呼叫）。

- [ ] **Step 3: 改 `retryOnTimeout` 加 onRetry**

`server/reportPlugin.ts` 把（約 189-198 行）：

```ts
export async function retryOnTimeout(call: () => Promise<string>, label: string): Promise<string> {
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof AiTimeoutError)) throw e;
    console.error(`[report] ${label} ${e.message}，重試一次`);
    return await call();
  }
}
```

改為：

```ts
export async function retryOnTimeout(
  call: () => Promise<string>,
  label: string,
  onRetry?: () => void,
): Promise<string> {
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof AiTimeoutError)) throw e;
    console.error(`[report] ${label} ${e.message}，重試一次`);
    onRetry?.(); // 通知前端：此章逾時重試中（寫進 status.json 的 retrying 旗標）
    return await call();
  }
}
```

- [ ] **Step 4: `StatusFile` 加 `retrying`，`runGenerateJob` 傳 onRetry**

`server/reportPlugin.ts` 的 `StatusFile`（約 51-57 行）加一欄：

```ts
interface StatusFile {
  status: 'running' | 'done' | 'error';
  done: number;
  total: number;
  error?: string;
  /** 目前章逾時自動重試中；章節成功寫下一筆 status 時自然清除 */
  retrying?: boolean;
  updatedAt: string;
}
```

`runGenerateJob` 內的呼叫（約 215 行）：

```ts
        text = await retryOnTimeout(() => callAi(provider, model, chapter.prompt), `${key} ${chapter.title}`);
```

改為：

```ts
        text = await retryOnTimeout(
          () => callAi(provider, model, chapter.prompt),
          `${key} ${chapter.title}`,
          () => writeStatus(key, { status: 'running', done: outputs.length, total, retrying: true }),
        );
```

（此時 `outputs.length` 正是目前章的 0-based index；章節成功後迴圈尾端既有的 `writeStatus(key, { status: 'running', done: outputs.length, total })` 不含 `retrying`，會覆蓋清除旗標。）

- [ ] **Step 5: 跑測試確認全過**

Run: `cd /Users/jared/LifePath/ziwei-web && npx vitest run server/__tests__/retryOnTimeout.test.ts && npx tsc -b`
Expected: 5 案例 PASS、tsc 無錯。

- [ ] **Step 6: Commit**

```bash
cd /Users/jared/LifePath/ziwei-web
git add server/reportPlugin.ts server/__tests__/retryOnTimeout.test.ts
git commit -m "feat(report): status.json 加 retrying 旗標，逾時重試時通知前端"
```

---

### Task 2: `buildBookSteps` 九章輪播步驟（純函式）

**Files:**
- Modify: `src/analysis/reportBook.ts`（檔尾新增 `buildBookSteps` 與其私有 helper）
- Test: `src/analysis/__tests__/reportBookSteps.test.ts`（新檔）

**Interfaces:**
- Consumes: `ChartAnalysis`（`analysis.ts`）、`BookData`（本檔）、`headerDesc`（`reportPrompts.ts`）
- Produces: `export interface BookStep { key: string; title: string; steps: string[] }` 與 `export function buildBookSteps(analysis: ChartAnalysis, book: BookData): BookStep[]`（9 筆，key/順序同 `buildBookChapters`，每章末句以 `…` 結尾）

- [ ] **Step 1: 寫失敗測試**

新檔 `src/analysis/__tests__/reportBookSteps.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { cast } from '../../engine/cast';
import { buildAnalysis } from '../analysis';
import { buildBookChapters, buildBookData, buildBookSteps } from '../reportBook';

const result = cast({ date: '1996-05-12', time: '23:40', gender: '男' });
const analysis = buildAnalysis(result);
const book = buildBookData(result, analysis, 2026);
const steps = buildBookSteps(analysis, book);

describe('buildBookSteps', () => {
  it('九章、key 與順序同 buildBookChapters', () => {
    const chapters = buildBookChapters(analysis, book, 2026);
    expect(steps.map((s) => s.key)).toEqual(chapters.map((c) => c.key));
  });

  it('每章都有標題、至少兩句步驟，末句是停留句（…結尾）', () => {
    for (const s of steps) {
      expect(s.title).toBeTruthy();
      expect(s.steps.length).toBeGreaterThanOrEqual(2);
      expect(s.steps[s.steps.length - 1].endsWith('…')).toBe(true);
    }
  });

  it('開卷首句帶命主標頭（含命主、身主）', () => {
    expect(steps[0].steps[0]).toContain('命主');
    expect(steps[0].steps[0]).toContain('身主');
  });

  it('大限走勢末句標出大限卡張數', () => {
    const lims = steps.find((s) => s.key === 'lims')!;
    expect(lims.steps[lims.steps.length - 1]).toContain(String(book.decadals.length));
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd /Users/jared/LifePath/ziwei-web && npx vitest run src/analysis/__tests__/reportBookSteps.test.ts`
Expected: FAIL（`buildBookSteps` 未匯出）。

- [ ] **Step 3: 實作 `buildBookSteps`（加在 `reportBook.ts` 檔尾）**

```ts
/* ---------- 九章輪播步驟（純前端狀態文案；資料全來自 book/analysis） ---------- */

export interface BookStep {
  key: string;
  title: string;
  /** 逐句輪播；最後一句固定「撰寫…／收卷…」讓輪播停住慢閃 */
  steps: string[];
}

/** 命主標頭：《陽男，丙子年生，水二局，命主廉貞、身主火星》 */
function headerBrief(analysis: ChartAnalysis): string {
  const h = analysis.header;
  return `《${h.yinYang}${h.gender}，${h.yearGz}年生，${h.fiveElementsClass}，命主${h.soul}、身主${h.body}》`;
}

/** 本宮主星清單：《紫微(旺)、貪狼(廟)》，無主星則借對宮 */
function starList(stars: { name: string; brightness?: string }[]): string {
  if (stars.length === 0) return '無主星（借對宮）';
  return `《${stars.map((s) => `${s.name}${s.brightness ? `(${s.brightness})` : ''}`).join('、')}》`;
}

/** 三方四正一句：對宮《遷移(酉)》、三合《財帛(亥)・官祿(未)》 */
function sanfangLine(t: { group: { palaceName: string; branch: string }[] }): string {
  const [, dui, s1, s2] = t.group;
  return `展開三方四正：對宮《${dui.palaceName}(${dui.branch})》、三合《${s1.palaceName}(${s1.branch})・${s2.palaceName}(${s2.branch})》`;
}

function topicOf(analysis: ChartAnalysis, topic: Topic) {
  return analysis.topics.find((x) => x.topic === topic)!;
}

/** 由 book/analysis 現成資料組九章輪播文案（與 buildBookChapters 同順序同 key） */
export function buildBookSteps(analysis: ChartAnalysis, book: BookData): BookStep[] {
  const mut = book.meta.natalMutText;
  const cur = book.decadals[0];
  const shen = book.cells.find((c) => c.isShen);

  const benming = topicOf(analysis, '本命');
  const ming = benming.group[0];
  const shiye = topicOf(analysis, '事業');
  const caiyun = topicOf(analysis, '財運');
  const aiqing = topicOf(analysis, '愛情');

  const fourLocs = analysis.topics.map((t) => `${t.palaceName}(${t.branch})`).join('、');
  const future = book.events.filter((e) => !e.isPast);
  const past = book.events.filter((e) => e.isPast).map((e) => e.year);
  const heavy = [...book.events].sort((a, b) => b.weight - a.weight)[0];

  const hero: string[] = [
    `正在定盤：${headerBrief(analysis)}`,
    `正在讀命宮（《${ming.branch}》）：${starList(ming.stars)}坐守`,
    sanfangLine(benming),
    `檢視生年四化：《${mut}》`,
    cur ? `定位現行大限：《${cur.range[0]}~${cur.range[1]}歲，走本命${cur.palaceName}宮》` : '定位現行大限…',
    '凝鍊命格雅號與格局印…',
  ];

  const gift: string[] = [
    `正在讀四主題宮位：${fourLocs}`,
    shen ? `查身宮落點：《身宮在${shen.palaceName}(${shen.branch})》` : '查身宮落點…',
    '逐宮比對星曜亮度，分揀優勢與弱項…',
    '歸納天賦類型、閃光點與練習方法…',
  ];

  const personality: string[] = [
    `正在讀命宮（《${ming.branch}》）：${starList(ming.stars)}坐守`,
    sanfangLine(benming),
    '檢視生年四化與亮度，判讀性格明暗兩面…',
    '撰寫性格論斷…',
  ];

  const career: string[] = [
    `正在讀官祿宮（《${shiye.group[0].branch}》）：${starList(shiye.group[0].stars)}坐守`,
    sanfangLine(shiye),
    `檢視生年四化：《${mut}》`,
    '綜合格局與亮度，撰寫事業論斷…',
  ];

  const money: string[] = [
    `正在讀財帛宮（《${caiyun.group[0].branch}》）：${starList(caiyun.group[0].stars)}坐守`,
    sanfangLine(caiyun),
    `檢視生年四化：《${mut}》`,
    '判讀財源型態與守財漏財點…',
  ];

  const love: string[] = [
    `正在讀夫妻宮（《${aiqing.group[0].branch}》）：${starList(aiqing.group[0].stars)}坐守`,
    sanfangLine(aiqing),
    cur
      ? `判斷現行大限：《${cur.palaceName === '夫妻' ? '走本命夫妻宮，感情正是這十年主題' : `走本命${cur.palaceName}宮，未親臨夫妻宮`}》`
      : '判斷現行大限…',
    '撰寫感情緣分與相處功課…',
  ];

  const lims: string[] = [
    ...book.decadals.map(
      (d) => `正在推演《${d.range[0]}~${d.range[1]}歲 ${d.gz}》限：大限命宮走本命《${d.palaceName}》宮`,
    ),
    ...(future[0] ? [`流命引動掃描：《${future[0].year} ${future[0].gz}年，${future[0].marks.join('、')}》`] : []),
    ...(heavy ? [`疊星引動：《${heavy.year} ${heavy.gz}年（總權重${heavy.weight}）》`] : []),
    `彙整《${book.decadals.length}》張大限卡主題…`,
  ];

  const events: string[] = [
    past.length ? `核對過往應期（對答案）：《${past.join('、')}》` : '核對過往應期（對答案）…',
    ...(future[0] ? [`流命引動：《${future[0].year} ${future[0].gz}年，${future[0].marks.join('、')}》`] : []),
    ...(heavy ? [`疊星判斷：《${heavy.year} ${heavy.gz}年，${heavy.marks.join('、')}（總權重${heavy.weight}）》`] : []),
    `吉凶定調：共 ${book.events.length} 個應期年份，逐年判吉凶…`,
    '逐年撰寫解讀：吉年寫把握點、凶年寫防範點…',
  ];

  const compass: string[] = [
    '彙整四主題三方四正與大限走勢…',
    future.length ? `標記進攻年與防守年：《${future.slice(0, 3).map((e) => e.year).join('、')}…》` : '標記進攻年與防守年…',
    '整理「路線別走」與改運對策…',
    '收卷：凝鍊一句話記住這張盤…',
  ];

  return [
    { key: 'hero', title: '開卷', steps: hero },
    { key: 'gift', title: '天賦印象', steps: gift },
    { key: 'topic_benming', title: '性格', steps: personality },
    { key: 'topic_shiye', title: '事業', steps: career },
    { key: 'topic_caiyun', title: '金錢', steps: money },
    { key: 'topic_aiqing', title: '感情', steps: love },
    { key: 'lims', title: '大限走勢', steps: lims },
    { key: 'events', title: '重點應期', steps: events },
    { key: 'compass', title: '人生羅盤', steps: compass },
  ];
}
```

若 `Topic` 型別未匯入本檔，於檔頭既有 `import type { Topic } from './facts';` 確認存在（已存在，`TOPIC_KEY` 有用到）。

- [ ] **Step 4: 跑測試確認全過**

Run: `cd /Users/jared/LifePath/ziwei-web && npx vitest run src/analysis/__tests__/reportBookSteps.test.ts && npx tsc -b`
Expected: 4 案例 PASS、tsc 無錯。

- [ ] **Step 5: Commit**

```bash
cd /Users/jared/LifePath/ziwei-web
git add src/analysis/reportBook.ts src/analysis/__tests__/reportBookSteps.test.ts
git commit -m "feat(report): 新增 buildBookSteps 九章輪播步驟純函式"
```

---

### Task 3: `ReportsCard` 收下生成邏輯（大按鈕＋九章輪播＋單一輪詢）

**Files:**
- Modify: `src/components/ReportsCard.tsx`（整檔改寫）
- Modify: `src/components/ChatPanel.tsx`（傳 `result` 給 `ReportsCard`）

**Interfaces:**
- Consumes: `buildBookSteps`（Task 2）、`StatusFile.retrying`（Task 1）、既有 `buildBookData/buildBookChapters/buildReportHeader/mergeReports/upsertReport/bookTitle/aiRequestParams/aiModelLabel`
- Produces: `ReportsCard` 新 props `{ mingzhu, result, onUpdate }`；此時右欄仍有舊生成鈕（Task 4 才拆），暫時兩處並存但功能正常

- [ ] **Step 1: 改 `ChatPanel` 傳 `result` 給 `ReportsCard`**

`src/components/ChatPanel.tsx` 找到（歷史列表視圖內）：

```tsx
        <ReportsCard mingzhu={mingzhu} onUpdate={onUpdate} />
```

改為：

```tsx
        <ReportsCard mingzhu={mingzhu} result={result} onUpdate={onUpdate} />
```

- [ ] **Step 2: 整檔改寫 `ReportsCard.tsx`**

以下為完整新檔內容，覆蓋 `src/components/ReportsCard.tsx`：

```tsx
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, LoaderCircle, Trash2 } from 'lucide-react';
import type { CastResult } from '../engine/cast';
import { saveMingzhu, type Mingzhu, type ReportMeta } from '../store/mingzhu';
import { bookTitle, mergeReports, upsertReport, type BookStatusInfo } from '../store/reportList';
import { aiRequestParams, loadSettings } from '../store/settings';
import { aiModelLabel } from '../ai/providers';
import { buildAnalysis } from '../analysis/analysis';
import { buildReportHeader } from '../analysis/reportPrompts';
import { buildBookChapters, buildBookData, buildBookSteps, type BookStep } from '../analysis/reportBook';
import ConfirmModal, { type ConfirmRequest } from './ConfirmModal';

interface Props {
  mingzhu: Mingzhu;
  result: CastResult;
  onUpdate: (m: Mingzhu) => void;
}

interface ReportStatus {
  status: 'none' | 'running' | 'done' | 'error';
  done: number;
  total: number;
  error?: string;
  retrying?: boolean;
  updatedAt?: string;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 生成中九章輪播：目前章＝rs.done（伺服器每完成一章寫 done），每句 5 秒輪，停在末句慢閃 */
function GenCarousel({ chapters, rs }: { chapters: BookStep[]; rs: ReportStatus }) {
  const idx = Math.min(rs.done, chapters.length - 1);
  const ch = chapters[idx];
  const [stepI, setStepI] = useState(0);

  useEffect(() => {
    setStepI(0); // 換章歸零
  }, [idx]);

  useEffect(() => {
    if (stepI >= ch.steps.length - 1) return; // 停在末句慢閃
    const t = window.setTimeout(() => setStepI((i) => i + 1), 5000);
    return () => window.clearTimeout(t);
  }, [stepI, ch.steps.length, idx]);

  const holding = stepI >= ch.steps.length - 1;
  const line = rs.retrying
    ? `《${ch.title}》回應逾時，自動重試中…`
    : ch.steps[Math.min(stepI, ch.steps.length - 1)];

  return (
    <div className="book-gen">
      <div className="bg-prog">
        <LoaderCircle size={13} strokeWidth={1.8} className="spin" /> 生成中 {idx + 1}/{chapters.length}・{ch.title}
      </div>
      <div className={`bg-line ${holding || rs.retrying ? 'blink' : ''}`}>{line}</div>
    </div>
  );
}

/** 中欄報告書：未產生顯示大按鈕、生成中九章輪播、完成列清單，並負責產生／重新產生 */
export default function ReportsCard({ mingzhu, result, onUpdate }: Props) {
  const analysis = useMemo(() => buildAnalysis(result), [result]);
  const [rs, setRs] = useState<ReportStatus | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // `${key}:${format}` 或 `${key}:del`
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [pollTick, setPollTick] = useState(0);

  /** 最新命書 key：reports 中 kind==='book' 最新一筆；無紀錄退回舊 key（命主 id，相容既有命書） */
  const bookKey = useMemo(() => {
    const books = (mingzhu.reports ?? []).filter((r) => r.kind === 'book');
    if (books.length === 0) return mingzhu.id;
    return books.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b)).key;
  }, [mingzhu.reports, mingzhu.id]);

  /* 命書狀態輪詢：掛載查一次，running 時每 5 秒 */
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const res = await fetch(`/api/report/${bookKey}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ReportStatus;
        if (stopped) return;
        setRs(data);
        if (data.status === 'running') timer = window.setTimeout(() => void poll(), 5000);
      } catch {
        if (!stopped) timer = window.setTimeout(() => void poll(), 5000);
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [bookKey, pollTick]);

  /** 輪播步驟：現成 book 資料組字串（跟著命主/盤面變） */
  const bookSteps = useMemo(
    () => buildBookSteps(analysis, buildBookData(result, analysis, new Date().getFullYear())),
    [analysis, result],
  );

  const generate = (regen: boolean) => {
    const hint = '約需 15~30 分鐘，背景生成，期間可照常聊天。';
    setConfirm({
      text: regen ? `重新產生完整命書？${hint}` : `開始產生完整命書？${hint}`,
      okLabel: '開始產生',
      onOk: () => void doGenerate(),
    });
  };

  const doGenerate = async () => {
    setGenErr(null);
    try {
      const currentYear = new Date().getFullYear();
      const reportStyle = loadSettings().reportStyle;
      const book = buildBookData(result, analysis, currentYear);
      const chapters = buildBookChapters(analysis, book, currentYear, mingzhu.profile, reportStyle);
      // 每次產生用新 key（舊版保留可比較）；例外：上次 error 沿用原 key，伺服器才找得到 chapters.json 續跑
      const key =
        rs?.status === 'error' ? bookKey : `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const ai = aiRequestParams();
      const res = await fetch(`/api/report/${key}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: `${mingzhu.name}・完整命書`,
          name: mingzhu.name,
          header: buildReportHeader(analysis, result.meta),
          book,
          chapters,
          ...ai,
          modelLabel: aiModelLabel(ai.provider, ai.model) ?? undefined,
        }),
      });
      if (res.status !== 202 && res.status !== 409) throw new Error(`HTTP ${res.status}`);
      const next = upsertReport(mingzhu, {
        key,
        title: bookTitle(mingzhu.name, reportStyle),
        kind: 'book',
        createdAt: new Date().toISOString(),
        provider: ai.provider,
        model: ai.model,
      });
      onUpdate(next);
      void saveMingzhu(next);
      setRs({ status: 'running', done: 0, total: chapters.length });
      setPollTick((t) => t + 1); // 重啟輪詢
    } catch (e) {
      setGenErr((e as Error).message);
    }
  };

  const bookStatus: BookStatusInfo = { done: rs?.status === 'done', updatedAt: rs?.updatedAt };
  const list = mergeReports(mingzhu, bookStatus);

  const exportReport = async (r: ReportMeta, format: 'jpg' | 'pdf' | 'md') => {
    setBusy(`${r.key}:${format}`);
    setError(null);
    try {
      let theme: string | null = null;
      try {
        theme = localStorage.getItem('zhanyan-report-theme') ?? loadSettings().theme;
      } catch {
        /* ignore */
      }
      const res = await fetch(`/api/report/${r.key}/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format, theme }),
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
            messages: c.messages.map((msg) =>
              msg.reportKey === r.key ? { ...msg, mode: 'chat' as const, reportKey: undefined } : msg,
            ),
          })),
        };
      }
      onUpdate(next);
      await saveMingzhu(next);
      if (r.kind === 'book') setPollTick((t) => t + 1); // 刪命書後重讀狀態，大按鈕才會回來
    } catch (e) {
      setError(`刪除失敗：${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="reports-card">
      <div className="rc-title">報告書</div>
      {genErr && <div className="rc-err">{genErr}</div>}

      {rs?.status === 'none' && (
        <button className="book-gen-big" onClick={() => generate(false)}>
          <BookOpen size={18} strokeWidth={1.8} />
          <span>產生完整命書</span>
          <small>約需 15~30 分鐘，背景生成</small>
        </button>
      )}
      {rs?.status === 'running' && <GenCarousel chapters={bookSteps} rs={rs} />}
      {rs?.status === 'error' && (
        <>
          {rs.error && <div className="rc-err">{rs.error}</div>}
          <button className="book-gen-big" onClick={() => generate(false)}>
            <BookOpen size={18} strokeWidth={1.8} />
            <span>生成失敗，重新產生</span>
          </button>
        </>
      )}

      {error && <div className="pc-error">{error}</div>}
      {list.map((r) => {
        const model = aiModelLabel(r.provider, r.model);
        return (
          <div key={r.key} className="report-row">
            <button className="rr-open" onClick={() => window.open(`/api/report/${r.key}`)}>
              <BookOpen size={14} strokeWidth={1.8} />
              <span className="rr-name">{r.title}</span>
              <span className="rr-time">
                {fmtTime(r.createdAt)}
                {model ? `・${model}` : ''}
              </span>
            </button>
            <span className="rr-actions">
              {(['jpg', 'pdf', 'md'] as const).map((f) => (
                <button
                  key={f}
                  disabled={busy !== null}
                  onClick={() => void exportReport(r, f)}
                  title={`輸出 ${f.toUpperCase()}`}
                >
                  {busy === `${r.key}:${f}` ? (
                    <LoaderCircle size={13} className="spin" />
                  ) : (
                    <Download size={13} strokeWidth={1.8} />
                  )}
                  {f.toUpperCase()}
                </button>
              ))}
              <button
                className="rr-del"
                disabled={busy !== null}
                title="刪除"
                onClick={() =>
                  setConfirm({
                    text: `刪除「${r.title}」？報告檔會一併移除。`,
                    okLabel: '刪除',
                    onOk: () => void remove(r),
                  })
                }
              >
                {busy === `${r.key}:del` ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} strokeWidth={1.8} />}
              </button>
            </span>
          </div>
        );
      })}

      {rs?.status === 'done' && (
        <button className="rc-sub" onClick={() => generate(true)}>
          重新產生完整命書
        </button>
      )}

      <ConfirmModal req={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
```

- [ ] **Step 3: tsc + lint**

Run: `cd /Users/jared/LifePath/ziwei-web && npx tsc -b && npm run lint`
Expected: 無錯（注意 `ReportsCard` 現在多了 `result` prop，`ChatPanel` 已在 Step 1 傳入）。

- [ ] **Step 4: dev server 實際驗收**

dev server 已在跑（背景）。瀏覽器開 http://localhost:5173/：
- 選一個「沒有完整命書」的命主（如 `fffff`）→ 中欄報告書區出現大按鈕「產生完整命書」。
- 選 `Jared`（已有命書）→ 報告書清單照舊、底部有「重新產生完整命書」小鈕。
- （右欄此時仍有舊生成鈕，屬預期的暫時並存，Task 4 拆除。）

Expected: 中欄大按鈕/清單顯示正確，無 console error。

- [ ] **Step 5: Commit**

```bash
cd /Users/jared/LifePath/ziwei-web
git add src/components/ReportsCard.tsx src/components/ChatPanel.tsx
git commit -m "feat(report): 生成邏輯移入中欄報告書區，加大按鈕與九章輪播"
```

---

### Task 4: 上提 `chartTab` ＋ 拆右欄頂列 ＋ 中欄切換鈕 ＋ 樣式

**Files:**
- Modify: `src/App.tsx`（新增 `chartTab` state，傳給 `ChatPanel`/`RightPanel`）
- Modify: `src/components/RightPanel.tsx`（整檔改寫：拆 `.rp-tabs`、移除生成邏輯、用 `chartTab` prop）
- Modify: `src/components/ChatPanel.tsx`（`chatHead` 加切換鈕、props 加 `chartTab/onChartTab`）
- Modify: `src/App.css`（移除 `.rp-tabs*`、新增 `.ch-tabs/.book-gen-big/.book-gen/.bg-*/.blink`）

**Interfaces:**
- Consumes: `ReportsCard`（Task 3，已在中欄負責生成）
- Produces: `App` 擁有 `chartTab: 'chart'|'yingqi'`；`RightPanel` props `{ mingzhu, result, simple, chartTab, onChartTab }`（不再有 `onUpdate`）；`ChatPanel` props 追加 `{ chartTab, onChartTab }`

- [ ] **Step 1: `App.tsx` 上提 chartTab**

`src/App.tsx` 在其他 `useState` 附近新增：

```tsx
  const [chartTab, setChartTab] = useState<'chart' | 'yingqi'>('chart');
```

把 `<ChatPanel ... />`（約 241-248 行）改為傳入切換鈕狀態：

```tsx
          <ChatPanel
            key={mingzhu.id}
            mingzhu={mingzhu}
            result={result}
            activeConvId={activeConvId}
            chartTab={chartTab}
            onChartTab={setChartTab}
            onSelectConv={setActiveConvId}
            onUpdate={updateMingzhu}
          />
```

把 `<RightPanel ... />`（約 262-268 行）改為：

```tsx
            <RightPanel
              key={mingzhu.id}
              mingzhu={mingzhu}
              result={result}
              simple={settings.chartMode === 'simple'}
              chartTab={chartTab}
              onChartTab={setChartTab}
            />
```

- [ ] **Step 2: 整檔改寫 `RightPanel.tsx`**

覆蓋 `src/components/RightPanel.tsx`：

```tsx
import { useMemo, useRef, useState } from 'react';
import type { CastResult } from '../engine/cast';
import type { Mingzhu } from '../store/mingzhu';
import Chart from './Chart';
import HoroscopeBar from './HoroscopeBar';
import AnalysisPanel from './AnalysisPanel';

interface Props {
  mingzhu: Mingzhu;
  result: CastResult;
  /** 精簡盤（true）／完整盤（false），由左下角「設定」控制 */
  simple: boolean;
  /** 顯示命盤或斷應期分析，由中欄頂端切換鈕控制（上提到 App） */
  chartTab: 'chart' | 'yingqi';
  onChartTab: (t: 'chart' | 'yingqi') => void;
}

export default function RightPanel({ mingzhu, result, simple, chartTab, onChartTab }: Props) {
  const [selDecadalBranch, setSelDecadalBranch] = useState<string | null>(null);
  const [selYear, setSelYear] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const birthYear = Number(result.meta.castDate.split('-')[0]);

  const horoscope = useMemo(() => {
    if (!selDecadalBranch) return null;
    const palace = result.astrolabe.palaces.find((p) => p.earthlyBranch === selDecadalBranch);
    if (!palace) return null;
    const year = selYear ?? birthYear + palace.decadal.range[0] - 1;
    return result.astrolabe.horoscope(`${year}-7-1 12:00`);
  }, [result, selDecadalBranch, selYear, birthYear]);

  return (
    <div className="right-panel" ref={panelRef}>
      {chartTab === 'chart' ? (
        <>
          <Chart
            astrolabe={result.astrolabe}
            meta={result.meta}
            name={mingzhu.name}
            birthYear={birthYear}
            horoscope={horoscope}
            showYearly={selYear !== null}
            selDecadalBranch={selDecadalBranch}
            simple={simple}
          />
          <HoroscopeBar
            astrolabe={result.astrolabe}
            birthYear={birthYear}
            yearStem={result.meta.yearStem}
            yearBranch={result.meta.yearBranch}
            selDecadalBranch={selDecadalBranch}
            selYear={selYear}
            onSelectDecadal={(b) => {
              setSelDecadalBranch(b);
              setSelYear(null);
            }}
            onSelectYear={setSelYear}
          />
        </>
      ) : (
        <AnalysisPanel
          result={result}
          inputKey={mingzhu.id}
          onJumpToYear={(decadalBranch, year) => {
            setSelDecadalBranch(decadalBranch);
            setSelYear(year);
            onChartTab('chart'); // 跳年份時切回命盤查看
            panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
      <footer>
        排盤規則：文墨天機安星碼 S5VoG（占驗派）｜庚干四化 陽武同相｜天馬依月支｜截空旬空占驗排法｜
        晚子時視為次日｜閏月月中分界
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: `ChatPanel.tsx` 加切換鈕**

`src/components/ChatPanel.tsx` 的 `Props` 介面加兩欄（在 `onUpdate` 附近）：

```tsx
interface Props {
  mingzhu: Mingzhu;
  result: CastResult;
  activeConvId: string | null;
  chartTab: 'chart' | 'yingqi';
  onChartTab: (t: 'chart' | 'yingqi') => void;
  onSelectConv: (id: string | null) => void;
  onUpdate: (m: Mingzhu) => void;
}
```

函式簽名解構加入 `chartTab, onChartTab`：

```tsx
export default function ChatPanel({ mingzhu, result, activeConvId, chartTab, onChartTab, onSelectConv, onUpdate }: Props) {
```

把 `chatHead`（約 323-330 行）改為：

```tsx
  const chatHead = (
    <div className="chat-head">
      <b>{mingzhu.name}</b>
      <span>
        {mingzhu.birth.date} {mingzhu.birth.time}
      </span>
      <div className="ch-tabs">
        <button className={chartTab === 'chart' ? 'active' : ''} onClick={() => onChartTab('chart')}>
          命盤
        </button>
        <button className={chartTab === 'yingqi' ? 'active' : ''} onClick={() => onChartTab('yingqi')}>
          斷應期
        </button>
      </div>
    </div>
  );
```

- [ ] **Step 4: `App.css` 移除 `.rp-tabs*`、加新樣式**

移除這段（約 1301-1338 行，`.rp-tabs` 起到 `.rp-tabs-right .primary` 止；保留其後的 `.rc-sub`、`.rc-err`）：

```css
/* 右欄置頂頁籤列：命盤｜斷應期＋右側命書鈕 */
.rp-tabs {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--headbar-h);
  margin: 0 -14px 12px;
  padding: 0 14px;
  background: var(--glass-bar); /* 同欄身視覺色；sticky 蓋過捲動內容 */
  backdrop-filter: blur(8px);
  border-bottom: 1px solid transparent; /* 隱藏但保留佔位，高度對齊不變 */
}

.rp-tabs > button {
  padding: 6px 18px;
  font-size: 14px;
}

.rp-tabs > button.active {
  border-color: var(--border);
  color: var(--text);
  background: var(--bg-active);
}

.rp-tabs-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rp-tabs-right .primary {
  padding: 6px 12px;
  font-size: 12.5px;
}
```

改成留一點右欄頂端呼吸空間：

```css
.right-panel > :first-child {
  margin-top: 12px; /* 拆掉頂列後，命盤與欄頂留白 */
}
```

在 `App.css` 檔尾（或 reports-card 樣式附近）新增：

```css
/* 中欄頂端：命盤／斷應期 切換（控制右欄內容） */
.ch-tabs {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.ch-tabs button {
  padding: 5px 14px;
  font-size: 13px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: none;
  color: var(--text-2);
  cursor: pointer;
}
.ch-tabs button.active {
  border-color: var(--border);
  color: var(--text);
  background: var(--bg-active);
}

/* 報告書：產生完整命書大按鈕 */
.book-gen-big {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  padding: 22px 12px;
  margin: 2px 0 4px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--bg-hover);
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.book-gen-big:hover {
  border-color: var(--text-3);
  background: var(--bg-active);
}
.book-gen-big small {
  font-size: 11.5px;
  font-weight: 400;
  color: var(--text-3);
}

/* 報告書：生成中九章輪播 */
.book-gen {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 12px;
  margin: 2px 0 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-hover);
}
.bg-prog {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-2);
}
.bg-line {
  font-size: 13.5px;
  color: var(--text);
  line-height: 1.6;
  min-height: 1.6em;
}
.bg-line.blink {
  animation: bgBreathe 1.8s ease-in-out infinite;
}
@keyframes bgBreathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
```

- [ ] **Step 5: tsc + lint**

Run: `cd /Users/jared/LifePath/ziwei-web && npx tsc -b && npm run lint`
Expected: 無錯（`RightPanel` 不再 import 生成相關符號；若殘留未用 import 會被 lint/tsc 抓出，一併清掉）。

- [ ] **Step 6: dev server 實際驗收（整體流程）**

瀏覽器 http://localhost:5173/：
1. 右欄**沒有頂列了**，命盤格 + 底部大限/流年列吃滿全高。
2. 中欄名字列右側出現 `命盤 / 斷應期` 切換鈕；點「斷應期」右欄換成應期分析，點應期表某年 → 右欄切回命盤且跳到該年。
3. `fffff`（無命書）中欄報告書區顯示大按鈕；按下 → 確認彈窗 → 開始後出現九章輪播「生成中 1/9・開卷・正在定盤：《…》」，每 5 秒換句、停在「撰寫…」慢閃。（可另開命主避免真的等 15 分鐘；或觀察 `data/reports/<key>.status.json` 的 done 遞增讓輪播換章。）
4. 右欄**不再有**生成鈕（已從 RightPanel 移除）。

Expected: 以上皆符合，無 console error。

- [ ] **Step 7: 全套測試 + Commit**

```bash
cd /Users/jared/LifePath/ziwei-web
npx tsc -b && npm run lint && npm test
git add src/App.tsx src/components/RightPanel.tsx src/components/ChatPanel.tsx src/App.css
git commit -m "feat(ui): 命盤/斷應期切換鈕移中欄頂端，右欄拆頂列完整顯示命盤"
```

Expected: `npm test` 全綠（含定盤、報告、新 buildBookSteps、retryOnTimeout 案例）。

---

## Self-Review

**Spec coverage：** A 版面（右欄拆頂列 Task4、中欄切換鈕 Task4、報告書大按鈕/輪播 Task3）✓；B 伺服器 retrying（Task1）✓；C 九章輪播（buildBookSteps Task2、GenCarousel Task3、目前章由 done 推導、末句慢閃、retry 插播）✓；D 檔案清單全部涵蓋 ✓。

**Placeholder scan：** 無 TBD/TODO；每步含實際程式碼與指令。

**Type consistency：** `BookStep`（Task2 匯出）→ Task3 `GenCarousel` 消費 ✓；`ReportStatus.retrying?`（Task3）對應伺服器 `StatusFile.retrying?`（Task1）✓；`RightPanel` props 去掉 `onUpdate`、加 `chartTab/onChartTab`（Task4 App 呼叫端一致）✓；`ReportsCard` props 加 `result`（Task3 ChatPanel 傳入）✓。
