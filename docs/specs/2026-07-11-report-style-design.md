# 命書風格設定（白話／書面） — 設計文件

日期：2026-07-11

## 目標

使用者反映生成命書偏書面、難讀。提供兩種文風供設定選擇，套用到**完整命書九章**與**聊天報告模式的單題報告**：

- `plain` **白話**（預設）：接地氣、好讀好記，語感對標 `reports/huang-1994-full.html`。
- `classic` **書面**：行文正式、術語密度高＝現行輸出，prompt 完全不變。

聊天模式（白話短答）不受影響。

## 設定

- `Settings`（`src/store/settings.ts`）加 `reportStyle: 'plain' | 'classic'`，預設 `'plain'`。
- `aiRequestParams()` 不動（style 走各自的 prompt 組裝參數，不進 API body——style 是 prompt 內容的一部分，不是後端呼叫參數）。
- 設定頁「AI 模型」區塊下加一列「命書風格」下拉：白話（接地氣，預設）／書面（正式）。

## 風格指令 `styleSection(style)`（`src/analysis/reportBook.ts` 匯出）

- `classic` 或未傳 → 回 `''`（零改動）。
- `plain` → 回一段【寫作風格：白話】規則，內容：
  1. 像跟朋友喝咖啡聊天那樣講，直接對「你」說話；短句優先，一句一重點。
  2. 每個術語（星曜、宮位、四化、格局）出現後，緊接一句生活白話翻譯它對命主的意思。
  3. 多用具體生活場景與比喻；few-shot 範例句（取自使用者認可的舊版報告語感）：「東西交到你手上會變穩、變大」「錢會來，也容易莫名其妙少一塊」「幫忙可以，擔保不行」。
  4. 結論先講、依據後講；禁止文言堆疊、對仗排比、連續抽象形容詞。

## 傳遞

- `buildBookChapters(analysis, book, currentYear, profile?, style?)`：`plain` 時每章 prompt 附加風格段（與 profile 段並列）。
- `buildChatPrompt(..., mode, profile?, style?)`：僅 `mode === 'report'` 且 `style === 'plain'` 時附加同一風格段；chat 模式忽略 style。
- 呼叫端（RightPanel 完整命書、ChatPanel 送出與 usagePct 估算）從 `loadSettings().reportStyle` 讀出帶上。

## 測試

- `styleSection`：plain 回含【寫作風格】段；classic／未傳回空字串。
- `buildBookChapters`：plain 時九章都含風格段；classic 不含且與未傳結果一致。
- `buildChatPrompt`：report＋plain 含；report＋classic 不含；chat＋plain 不含。
- settings 預設值 `'plain'`、舊資料自動補。
