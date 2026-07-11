# 報告書區塊（列表・輸出・刪除） — 設計文件

日期：2026-07-11

## 目標

中欄（對話列表視圖）個人背景卡片下方新增「報告書」區塊：列出該命主的完整命書與單題報告，每本顯示自動命名標題＋生成時間，並有「開啟」「輸出 JPG」「輸出 PDF」「刪除」。

## 資料

- `src/store/mingzhu.ts` 加：
  ```ts
  export interface ReportMeta {
    key: string;
    title: string;
    kind: 'book' | 'question';
    createdAt: string; // ISO
  }
  ```
  `Mingzhu.reports?: ReportMeta[]`。
- **自動命名**：完整命書 →「完整命書・白話版」／「完整命書・書面版」（依生成當下 `reportStyle`）；單題報告 → 問題文字前 20 字（空白 fallback「單題報告」）。
- **記錄時機**：完整命書於按下產生（202 接受）時 upsert（key = mingzhu.id，重生成覆寫標題與時間）；單題報告於 render 成功時 push。
- **舊資料推導**（不遷移）：`mergeReports(mingzhu, bookStatus)` 純函式——已記錄的優先；命書若 status=done 但沒紀錄 → 推導一筆（標題「完整命書」、時間用 status.updatedAt）；訊息裡有 reportKey 但沒紀錄 → 推導（標題取前一則 user 訊息前 20 字、時間用訊息 ts）。合併後依 createdAt 新到舊排序。

## 伺服器（`server/reportPlugin.ts` 擴充）

- `DELETE /api/report/:key`：刪除 `<key>.html` 與 `<key>.status.json`（不存在也回 ok）→ `{ ok: true }`。
- `POST /api/report/:key/export`，body `{ format: 'jpg' | 'pdf' }`：以 Playwright chromium（devDependency 現成）動態 import，`file://` 開啟報告 HTML，`reducedMotion: 'reduce'`（模板有對應 CSS 讓進場動畫區塊直接顯示）、viewport 寬 960、networkidle 等字型：
  - `jpg`：`fullPage` 截圖（type jpeg、quality 90、deviceScaleFactor 2）→ `image/jpeg`
  - `pdf`：`page.pdf({ format: 'A4', printBackground: true })` → `application/pdf`
  - 報告不存在回 404；渲染失敗回 500 帶錯誤訊息。

## UI（新元件 `src/components/ReportsCard.tsx`）

- 位置：ChatPanel 對話列表視圖，ProfileCard 下方。無任何報告時整塊不顯示。
- 每列：標題（點擊＝開啟報告頁）＋時間（`YYYY-MM-DD HH:mm`）＋按鈕「JPG」「PDF」「刪除」。
- 輸出：fetch export → blob → `a[download]` 下載，檔名 `<標題> <YYYY-MM-DD>.jpg|pdf`；輸出中按鈕顯示轉圈並停用（命書長圖可能 10~30 秒）。
- 刪除：`window.confirm` → DELETE → 從 `mingzhu.reports` 移除；單題報告同步清除對應訊息的 `reportKey`（避免對話中留 404 連結）→ `onUpdate`＋`saveMingzhu`。
- 命書於生成中（RightPanel 已有進度顯示）就會出現在列表；開啟未完成的報告會看到既有的「找不到報告」頁，屬已知行為。

## 接線

- `RightPanel` 加 `onUpdate: (m: Mingzhu) => void` prop（App 傳 `updateMingzhu`）；generate 202 後 upsert 命書紀錄並儲存。
- `ChatPanel` 單題報告 render 成功後，將紀錄與訊息更新一起存。

## 測試

- `mergeReports`：已記錄優先、命書推導、單題推導、排序、去重。
- 命名：白話／書面標題、問題截斷。
- DELETE 端點：建立假檔 → 刪除 → 檔案消失、回 ok；不存在 key 也回 ok。
- E2E：dev server＋curl 驗證 export JPG/PDF 回傳非空 binary；Playwright 驗證列表顯示與刪除。
