# 命主個人背景自述 — 設計文件

日期：2026-07-11

## 目標

選到命主後，中欄標題列下方提供一塊可收合的「個人背景」卡片：單一 textarea 讓使用者自由寫自我介紹／背景，並以小字建議可寫哪些面向。內容餵給聊天問答與完整命書的 prompt，讓解讀更貼近個人。

## 資料

- `Mingzhu` 介面（`src/store/mingzhu.ts`）加選填欄位 `profile?: string`。
- 隨現有 `saveMingzhu` 整筆寫回 `data/<id>.json`；舊資料無此欄位視同未填，零遷移。

## UI（`src/components/ChatPanel.tsx` 標題列下方）

- 收合狀態一行：未填顯示「＋ 填寫個人背景，讓解讀更貼近你（選填）」；已填顯示「個人背景：<第一行截斷摘要>」，點擊展開。
- 展開狀態：
  - textarea（4–6 行），placeholder「自我介紹：你在做什麼、目前的生活狀態…」
  - 小字建議：「💡 建議可寫：職業與工作現況、感情／婚姻狀況、最想了解的事、重大事件與年份（如 2018 換工作、2021 結婚）——寫得越具體，解讀越貼近你」
  - 「儲存」「收合」按鈕；儲存呼叫 `saveMingzhu` 並更新畫面，儲存失敗沿用現有錯誤顯示方式。

## AI 串接

- `buildChatPrompt`（`src/analysis/chatPrompt.ts`）加選填參數 `profile?: string`：有值時在【斷應期引動年份】之後插入一節：
  `【命主自述背景】（命主自行填寫，僅供貼近解讀）\n<原文>`
  並加一行指示：「自述中提到的事件年份可與引動年份對照驗盤，命中的引動可作為斷應期信心依據並向命主指出。」
- `buildBookChapters`（`src/analysis/reportBook.ts`）同樣加選填 `profile` 參數，插入同一節到每章共用的盤面事實區。
- 未填（undefined／空白字串）時完全不插入，prompt 與現行為完全相同。

## 後續調整（同日）

- 卡片**預設展開**（進入命主即可見），可手動收合。
- 建議字數 **500 字**（`SUGGESTED_MAX`）：自述會進每次聊天與命書九章 prompt，精煉優於冗長；hint 文案註明。
- 左下角字數計 `n/500`：超過變黃色（`.pc-count.over`）並帶提示 tooltip，**不阻擋儲存**，純建議。

## 測試

- chatPrompt：有 profile 時 prompt 含【命主自述背景】與原文；無／空白時不含。
- reportBook：章節 prompt 同上。
- UI 手動＋Playwright 截圖：收合／展開、儲存後重整仍在。
