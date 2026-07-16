# 右上按鈕移入中欄 ＋ 九章輪播生成狀態

日期：2026-07-17
狀態：已定案，待實作

## 目標

1. 把右欄頂列的所有按鈕移出，讓右欄完整顯示命盤格與底下的大限／流年選項列。
2. `命盤／斷應期` 切換鈕移到中欄頂端（chatHead），控制右欄顯示命盤或斷應期分析。
3. 完整命書的生成動作（產生／開啟／重新產生）移到中欄「報告書」區。
4. 沒產生過命書時，報告書區顯示一格大按鈕「產生完整命書」；按下後依生成狀態顯示九章輪播文案。

## A. 版面

### 右欄（`RightPanel.tsx`）
- 移除整條 `.rp-tabs` 頂列（含 `命盤／斷應期` 切換與所有命書鈕）。
- 內容剩：命盤格（`Chart`）／斷應期分析（`AnalysisPanel`，由上提的 `chartTab` 決定）→ 大限流年列（`HoroscopeBar`）→ footer。
- `chartTab`（`'chart' | 'yingqi'`）上提到 `App`。`selDecadalBranch`／`selYear`（命盤選限選年）仍留在 `RightPanel`。
- `AnalysisPanel` 的「跳到年份」仍要把右欄切回命盤——透過上提的 setter 設 `chartTab='chart'`。
- 移出所有生成邏輯（`rs`／`genErr`／`confirm`／`pollTick`／`bookKey`／`generate`／`doGenerate`），連同 `buildBookData`／`buildBookChapters`／`ConfirmModal`／`aiRequestParams` 等 import。`buildAnalysis` 在 `RightPanel` 若不再被用到就一併移除。

### App（`App.tsx`）
- 新增狀態 `const [chartTab, setChartTab] = useState<'chart'|'yingqi'>('chart')`。
- 傳 `chartTab` + `onChartTab={setChartTab}` 給 `ChatPanel`（畫切換鈕）與 `RightPanel`（決定內容 + 跳年份切回）。

### 中欄頂端（`ChatPanel.tsx` 的 `chatHead`）
- 在名字／生辰右側加 `[命盤][斷應期]` 兩顆切換鈕（right-aligned），點擊呼叫 `onChartTab`。
- 兩個視圖（總覽列表、對話串）都有 `chatHead`，切換鈕兩處都在。

### 報告書區（`ReportsCard.tsx`）
成為報告書單一負責處，永遠顯示（不再「空清單就 null」）。依 book 狀態 `rs`：

| `rs.status` | 顯示 |
|---|---|
| `none` | 大按鈕「產生完整命書」（`.book-gen-big`） |
| `running` | 九章輪播（見 C） |
| `done` | 報告清單（同現況）＋小鈕「重新產生」 |
| `error` | 錯誤字＋「生成失敗，重新產生」（沿用原 key 續跑） |

- 生成前確認彈窗（`約需 15~30 分鐘，背景生成，期間可照常聊天。`）保留。
- 單題報告（`kind:'question'`）與已完成命書仍照 `mergeReports` 列在清單。
- `ReportsCard` 需新增 `result: CastResult` prop（由 `ChatPanel` 傳入，用來 `buildBookData`／`buildBookChapters`／`buildBookSteps`／`buildReportHeader`）；`analysis` 於 `ReportsCard` 內 `useMemo(() => buildAnalysis(result))`。
- `bookKey` 推導（最新 `kind==='book'` 的 `ReportMeta`，退回 `mingzhu.id`）與生成 POST 邏輯整段從 `RightPanel` 搬進來，合併掉原本 `RightPanel` + `ReportsCard` 的雙 poll，改成此處一處 poll：掛載查一次、`running` 時每 5 秒。
- `ReportsCard` 只在總覽視圖（`!activeConv`）渲染。使用者進對話後元件卸載、poll 停；回總覽重新掛載即重讀 `status.json`（後端生成不受影響）。此為刻意取捨，不另加常駐指示器。

## B. 伺服器改動（C-1，最小）

`server/reportPlugin.ts`：
- `StatusFile` 加 `retrying?: boolean`。
- `retryOnTimeout(call, label, onRetry?)`：捕捉 `AiTimeoutError` 重試前呼叫 `onRetry?.()`。
- `runGenerateJob` 呼叫處傳 `() => writeStatus(key, { status:'running', done: outputs.length, total, retrying: true })`；章節成功後迴圈尾端既有的 `writeStatus(... done: outputs.length ...)`（不含 `retrying`）自然把旗標清掉。
- `handleStatus` 原樣透傳整個 `s`，`retrying` 自動流到前端。「生成中斷」分支不帶 `retrying`。

前端 `ReportStatus` 介面加 `retrying?: boolean`。

## C. 九章輪播（純前端）

### 目前章推導
- 生成中目前章 index（0-based）＝ `Math.min(rs.done, chapters.length - 1)`。
  伺服器每完成一章寫 `done = 完成章數`，故 `running` 期間 `done` 正是「正在寫的章」index。
- 章序、章名以 `buildBookChapters` 為準（前端已知，無需伺服器回傳章 key）。

### 步驟字串來源
新增純函式 `buildBookSteps(analysis, book): { key: string; title: string; steps: string[] }[]`（放 `reportBook.ts`，與 `buildBookChapters` 同順序同 key）。每句用 `book`／`analysis` 現成資料組字串，最後一句固定是「撰寫…／收卷…」讓輪播停住。資料對應：

- 標頭：`headerDesc(analysis)`、`book.meta.natalMutText`、`book.meta.soul/body/fiveElementsClass`
- 命宮／各主題宮星曜與三方四正：`analysis.topics[*].group`（`本宮/對宮/三合`，各含 `palaceName/branch/stars`）
- 身宮：`book.cells.find(c => c.isShen)`
- 四主題宮位簡表：`book.topicLocs`
- 現行／各大限：`book.decadals`（`range/gz/palaceName/label`）
- 應期年份：`book.events`（`year/gz/age/isPast/isCurrent/marks/weight`）

九章步驟依使用者「九章輪播文案設計」逐章對應（開卷／天賦印象／性格／事業／金錢／感情／大限走勢／重點應期／人生羅盤），每句前綴 `生成中 N/9・章名・…`。

### 運作
- 每句約 5 秒輪下一句（純前端 `setInterval`／`setTimeout`）。
- 輪到最後一句「撰寫…」就停住並慢慢閃（CSS 呼吸動畫）——實際時間多花在 AI 寫作。
- `rs.done` 變動（換章）→ 計時器歸零，從新章第一句重來。
- `rs.retrying === true` 時，於目前章插播一句「《章名》回應逾時，自動重試中…」。
- 進度數字直接顯示 `N/9`（N = 目前章 index + 1）。

## D. 動到的檔案
- `server/reportPlugin.ts`（retrying 旗標）
- `src/analysis/reportBook.ts`（新增 `buildBookSteps`）
- `src/analysis/__tests__/`（`buildBookSteps` 單元測試）
- `src/App.tsx`（上提 `chartTab`）
- `src/components/RightPanel.tsx`（拆頂列、搬走生成邏輯）
- `src/components/ChatPanel.tsx`（chatHead 加切換鈕）
- `src/components/ReportsCard.tsx`（大鈕＋輪播＋清單＋單一 poll）
- `src/App.css`（切換鈕、大按鈕、輪播樣式）

## 驗收
- `npx tsc -b` 過、`npm run lint` 過、`npm test` 過（含新 `buildBookSteps` 測試與既有定盤／報告測試）。
- dev server 實際操作：右欄無頂列、命盤吃滿；中欄切換鈕可切右欄命盤／斷應期；新命主報告書區顯示大按鈕；按下生成後輪播文案依 `done` 換章、停在「撰寫…」慢閃。
