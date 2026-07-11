# 命主資料輸入改版：出生時間滾輪選擇 — 設計文件

日期：2026-07-11

## 目標

新增命主表單改版：

- 欄位順序（上到下）：**稱呼 → 性別 → 出生地（含自訂經度）→ 出生時間**，最下面維持「取消／排盤並儲存」按鈕。
- 「國曆生日」＋「時間」兩欄合併為「出生時間」：一整行五欄 iOS 式滾輪（上下滑動置中選取），左到右 **年／月／日／時／分**。

## 架構

- **通用元件** `src/components/WheelPicker.tsx`：單一直欄滾輪。
  - Props：`options: { value: number; label: string }[]`、`value: number`、`onChange(value: number)`。
  - 實作：原生捲動容器＋`scroll-snap-type: y mandatory`，每格 `scroll-snap-align: center`；容器上下 padding 讓首尾項可置中；捲動停止（`scrollend`，fallback：scroll 事件 debounce 120ms）時計算最接近中心的項目回報 `onChange`；點擊任一格 `scrollTo` 平滑置中；`value` 由外部變更時（如日數夾回）同步捲動位置。
  - 視覺：置中選取帶上下細線；非選取項淡化（透明度遞減）。手機觸控滑動與桌機滑鼠滾輪皆原生支援。
- **日數計算純函式** `src/components/birthWheel.ts`：`daysInMonth(year, month): number`（閏年 2 月 29 天）；`clampDay(year, month, day): number`。供 modal 與測試使用。
- **MingzhuModal 改版**：
  - state 由 `date: string`／`time: string` 改為 `year/month/day/hour/minute: number`（預設 1990/1/1/12:00，維持現行預設）。
  - 五欄滾輪：年 1920～當年（上到下遞增）、月 1–12、日 1–daysInMonth（隨年月變動，選值超過月底自動夾回）、時 0–23、分 0–59。
  - 各欄 label 帶單位：`1995年`、`2月`、`18日`、`14時`、`30分`。
  - 送出時組回字串：`date = YYYY-MM-DD`、`time = HH:MM`（零填充），`BirthInput` 與排盤引擎、儲存格式零改動。
  - 稱呼／性別／出生地／自訂經度欄照現有 `.m-row` 樣式，只調整順序。
- **CSS**：`App.css` 新增 `.wheel-*` 樣式（滾輪列容器、單欄、格子、選取帶）。

## 錯誤處理

- 日數夾回：2/31 → 2/28（閏年 29）等，任何年月切換後 day 都經 `clampDay`。
- 稱呼必填驗證照舊；滾輪永遠有合法值，無需額外驗證。

## 測試

- `birthWheel`：`daysInMonth`（平年/閏年/世紀年、大小月）、`clampDay` 夾回。
- 送出字串零填充格式（1 月 → `01`）。
- UI 手動＋Playwright 截圖驗證：滑動選取、點擊置中、欄位順序。
