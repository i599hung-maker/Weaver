# 命書版本化＋模型標記 設計

日期：2026-07-11｜狀態：已與使用者確認方向

## 目標

1. 完整命書按「重新產生」不再覆蓋舊版：每次產生新增一筆紀錄，舊版保留在報告清單，可開啟／下載／刪除。
2. 每份報告（命書與單題報告）記錄產生當下的 AI 供應商與模型，並在清單與報告頁顯示。

動機：使用者要比較不同模型（如 Claude Opus vs Gemini 3.1 Pro）產出的命書深度；現行同 key 覆蓋讓舊版遺失、也無從得知既有報告用什麼模型跑的。

## 現況

- 命書 key 固定＝命主 id（`mingzhu.id`），`/api/report/<key>/generate` 寫 `data/reports/<key>.html`，重生成直接覆蓋。
- 單題報告已用唯一 key（`q_<時間36進位><亂數>`），天生多版共存 → 命書比照即可。
- `ReportMeta`（`src/store/mingzhu.ts`）僅有 key/title/kind/createdAt。
- `upsertReport`（`src/store/reportList.ts`）：同 key 覆寫、不同 key 附加。
- RightPanel 輪詢 `/api/report/${mingzhu.id}/status` 決定按鈕狀態（產生／生成中／開啟＋重新產生）。

## 設計

### 資料

- `ReportMeta` 新增選填欄位 `provider?: string`、`model?: string`（存 id，如 `antigravity`/`pro`）。顯示時用 `findProvider` 查 label，查不到就顯示原始 id；兩欄缺省（舊資料）不顯示模型小字。
- 命書 key 改為每次產生新建：`b_<Date.now().toString(36)><亂數4碼>`（比照單題報告 `q_` 命名法）。

### 前端

- **RightPanel**
  - 「最新命書」＝ `mingzhu.reports` 中 `kind==='book'` 且 `createdAt` 最新的一筆；若無紀錄，退回舊 key `mingzhu.id`（相容既有命書）。
  - 狀態輪詢與「開啟完整命書」都改用最新命書 key。
  - `doGenerate`：產生新 `b_` key → POST generate → `upsertReport` 記錄 key/title/kind/createdAt/provider/model（provider/model 取自 `aiRequestParams()`）。生成中按鈕維持 disabled（以最新 key 的 running 狀態判斷）。
- **ChatPanel**：單題報告 `upsertReport` 時順帶記 provider/model（同樣取自 `aiRequestParams()`）。
- **ReportsCard**：每筆時間旁顯示模型小字，如 `2026-07-11 15:20・Antigravity・Gemini 3.1 Pro（深入）`；無記錄則只顯示時間。刪除／匯出沿用現有 per-key 機制，不用改。
- **reportList.mergeReports**：舊命書（key＝命主 id、無紀錄但檔案存在）推導邏輯維持不變。

### 後端

- `GenerateBody`／`RenderBody` 新增選填 `modelLabel?: string`（前端組好的顯示字串，如 `Antigravity・Gemini 3.1 Pro（深入）`）。
- `renderBookHtml`／`renderReportHtml` 頁尾生成時間旁加註 modelLabel（有帶才顯示）。伺服器不認得供應商註冊表，只透傳字串。

### 相容性

- 既有命書（key＝命主 id）：清單照常顯示與開啟；無模型標記。
- 既有單題報告：無模型標記，新產生的才有。
- 同時生成兩版命書：新 key 各自獨立 job，伺服器天然支援；前端生成中按鈕 disabled 已足夠防呆。

## 測試

- `reportList`：不同 key 附加不覆蓋；mergeReports 多版命書排序；模型欄位保留。
- `reportTemplate`：帶 modelLabel 時頁尾出現、不帶時不出現。
- 既有 95 測試不得回歸。

## 驗證

`npm test` 全過後，實際流程驗證：以不同模型連續產生兩版命書 → 清單出現兩筆各標模型 → 兩版皆可開啟，舊版內容未變。
