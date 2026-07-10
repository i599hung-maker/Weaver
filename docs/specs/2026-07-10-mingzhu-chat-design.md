# 命主管理＋對話問答設計

日期：2026-07-10　狀態：已與使用者確認設計

## 目標

網頁上直接完成：新增命主 → 排盤 → 對本機 Claude 問答，所有資料落地成檔案。

## 版面

- **左側欄**：命主列表（姓名＋生辰摘要），頂部「＋ 新增命主」按鈕。
- **新增命主 modal**：稱呼／國曆生日／時間／性別／出生地（城市選單或自訂經度）／真太陽時開關。送出即存檔並排盤。
- **主區**：沿用現有盤面（12宮＋中宮）、大限流年切換、四主題分析。
- **對話區（盤面下方）**：每位命主有對話分頁列，可「＋ 新對話」開新主題、切換舊對話。

## 對話

- 多輪：送出時帶「該命主完整盤面事實＋本分頁先前問答」給 `/api/analyze`（本機 Claude headless，免 API key）。
- 每則問答即時存檔，重開網頁不掉。

## 資料儲存

- `data/` 資料夾（**加入 .gitignore**），每位命主一個 JSON：

```jsonc
{
  "id": "m_...",
  "name": "稱呼",
  "birth": { "date": "1996-05-12", "time": "23:40", "gender": "男", "longitude": 121, "tzOffset": 8, "useTst": true, "place": "台北" },
  "createdAt": "ISO",
  "conversations": [
    { "id": "c_...", "title": "第一句問題截斷", "createdAt": "ISO",
      "messages": [{ "role": "user|assistant", "text": "...", "ts": "ISO" }] }
  ]
}
```

- dev server 新增 storage middleware（與 analyzePlugin 同模式）：
  - `GET /api/mingzhu` → 全部命主
  - `PUT /api/mingzhu/:id` → 寫入整筆（新增／更新皆用此）
  - `DELETE /api/mingzhu/:id` → 刪除
- 首次啟動 `data/` 不存在時，自動種入三筆定盤範例命主。

## 元件切分

- `server/storagePlugin.ts` — 檔案讀寫 API
- `src/store/mingzhu.ts` — 型別＋fetch 封裝
- `src/components/MingzhuModal.tsx` — 新增命主表單（沿用 BirthForm 欄位邏輯）
- `src/components/Sidebar.tsx` — 命主列表
- `src/components/ChatPanel.tsx` — 對話分頁＋訊息列＋輸入框
- `App.tsx` — 版面重組與狀態串接

## 測試

- vitest：對話 prompt 組裝（盤面事實＋歷史）純函式測試。
- 手動：瀏覽器走一遍 新增命主 → 排盤 → 提問 → 重整頁面歷史仍在。
