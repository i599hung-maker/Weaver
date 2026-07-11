# 報告 Markdown 輸出 設計

日期：2026-07-11｜狀態：已與使用者確認方向（格式僅 MD；舊報告不支援、重產才有）

## 目標

單題報告與完整命書可下載 Markdown 檔：內容為 AI 產出原文重組的乾淨純文字，與現有 JPG／PDF 下載並列。

## 現況

- 報告只存排版後 HTML（`data/reports/<key>.html`），AI 原文未留檔。
- 匯出走 `POST /api/report/:key/export`（Playwright 截圖／PDF），前端 ReportsCard 每筆有 JPG/PDF 鈕，報告頁右上角也有下載鈕列。
- 單題報告 render 請求 body 就有 markdown 原文；命書章節是 JSON 槽位（`parseChapterJson`），解析失敗存 `__fallbackMd` 原始文字。

## 設計

### 產生時同步存 MD 源檔（`data/reports/<key>.md`）

- **單題報告**（`handleRender`）：組 MD 直接寫檔——
  `# <title>`＋metadata 行（命主、生成時間、modelLabel 有帶才列）＋`> 原始提問`（有帶才列）＋各 section（title 為 `##`，空 title 只放內文）。
- **完整命書**（`runGenerateJob` 完成時）：
  - 有 `book`（視覺化命書）：新檔 `server/reportMarkdown.ts` 的 `renderBookMarkdown(opts)`，opts 與 `renderBookHtml` 相同（title/name/header/book/chapters/generatedAt/modelLabel）。每章依槽位結構轉 MD 標題＋段落＋條列（欄位對照 `reportTemplate.ts` 各章 render 函式）；章節為 `__fallbackMd` 時直接放原始文字（與 HTML fallback 行為一致）。
  - 無 `book`（舊版逐章文章）：各章 `## <title>`＋markdown 串接。
- 檔頭統一含：命主名、生成時間、模型標記（有才列）、命盤基本資訊（header 摘要）。

### 下載

- `handleExport` 的 format 加 `'md'`：不走 Playwright，直接回 `<key>.md`（`content-type: text/markdown; charset=utf-8`）。檔案不存在回 404 `{ error: '此報告尚無 MD 檔，重新產生後即可下載' }`。
- ReportsCard：格式陣列 `['jpg','pdf']` 加 `'md'`，下載檔名沿用現有規則（`<title> <日期>.md`）。
- 報告頁右上角下載鈕列（`reportTemplate.ts` 內嵌 script）：加 MD 鈕，同樣打 export 端點；404 時 alert 提示重新產生。

### 刪除

- `handleDeleteReport` 連 `<key>.md` 一起刪。

### 相容性

- 舊報告無 `.md` → 下載回 404 提示；不做 HTML 反轉。
- MD 檔在 `data/reports/` 內，本來就不入 git。

## 測試

- `renderBookMarkdown`：正常槽位轉出含各章標題與內容；`__fallbackMd` 章節原文保留；modelLabel 有帶出現在檔頭、沒帶不出現。
- 單題 MD 組字：title/question/sections 齊全；空 section title 不輸出 `##`。
- export md：檔案存在回 text/markdown；不存在回 404 與提示訊息。
- 既有 103 測試不得回歸。

## 驗證

`npm test`＋`npx tsc -b` 全過後，實際 API 驗證：render 一份單題報告 → export md 下載內容正確 → DELETE 後 md 一併消失；舊報告（無 md）export md 回 404 提示。
