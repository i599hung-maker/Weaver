# 三欄標題列分隔線對齊 — 設計文件

日期：2026-07-11

## 目標

左（品牌列 `.sb-brand`）、中（命主標題 `.chat-head`）、右（頁籤列 `.rp-tabs`）三個頂部標題列都有底部分隔線，且三條線在同一高度連成一直線。

## 作法（CSS-only，不動 JSX）

- `:root` 加 `--headbar-h: 54px`（取右欄頁籤列目前實際高度）。
- `.sb-brand`：負 margin 抵銷 `.sidebar` 內距（上 14px、左右 12px）滿版貼頂，`height: var(--headbar-h)` 垂直置中，補 `border-bottom: 1px solid var(--border)`。
- `.chat-head`：`margin-top: -10px` 抵銷 `.chat-col` 上內距貼頂，改 `align-items: center`、`height: var(--headbar-h)`、`padding: 0 20px`，底線位置與其他兩欄同高。
- `.rp-tabs`：`height: var(--headbar-h)`、`padding: 0 14px`（原上下 10px 內距改由固定高度置中取代）。

## 已知取捨

- 中欄暫時性錯誤橫幅（banner)出現時會把標題往下推，橫幅關閉即恢復——既有行為不處理。
- `src/App.css` 有使用者未提交的星空背景 WIP 且與 `.chat-head`/`.rp-tabs` 交疊，本次修改不單獨 commit，隨使用者下次「推播上去」一併進版。

## 驗收

Playwright 截圖：三條分隔線同高（左欄有線），lint/build 通過。
