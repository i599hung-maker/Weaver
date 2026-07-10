# 完整命書：以 HTML 為主，PDF 走網頁上的下載按鈕

## 問題

完整命書要用什麼格式輸出？決定：先以 HTML 網頁為主，不直接產 PDF；想要 PDF 的使用者在命書網頁上點按鈕自行下載。

## 現在的設計

- 入口：右欄置頂列最右邊的命書按鈕（[`src/components/RightPanel.tsx`](../../src/components/RightPanel.tsx) 的 `rp-tabs-right`）
  - 尚未生成 →「產生完整命書」呼叫 `POST /api/report/:key/generate`
  - 生成中 → 顯示進度（done/total 章），前端每 5 秒輪詢 `GET /api/report/:key/status`
  - 已生成 →「開啟完整命書」`window.open('/api/report/:key')` 開 HTML 網頁
- 伺服端：[`server/reportPlugin.ts`](../../server/reportPlugin.ts) 背景逐章呼叫 claude，寫入 `data/reports/<key>.html`；模板在 [`server/reportTemplate.ts`](../../server/reportTemplate.ts)
- 章節內容由 [`src/analysis/reportPrompts.ts`](../../src/analysis/reportPrompts.ts) 組 prompt

## 之後可優化的點

- **PDF 下載按鈕**（使用者已提出，尚未實作）：在命書 HTML 網頁（`reportTemplate.ts` 渲染的頁面）加一個「下載 PDF」按鈕
  - 方向：最簡單是按鈕觸發 `window.print()`＋print CSS（讓使用者另存 PDF）；或伺服端用 headless chromium 轉檔回傳 PDF 檔
