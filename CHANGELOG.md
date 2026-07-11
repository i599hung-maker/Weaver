# Changelog

## [Unreleased] - 2026-07-11 09:42

### Added（新增）
- 命主「個人背景」卡片（中欄標題下，預設展開）：單一 textarea 自述職業／感情／重大事件年份等，存進命主檔（`Mingzhu.profile`）
- 自述餵給聊天問答與命書九章 prompt（【命主自述背景】段落），並指示 AI 以自述事件年份對照引動年份驗盤，作為斷應期信心依據
- 建議字數 500 字＋即時字數計 `n/500`：超過變黃提醒但不阻擋儲存

## [先前] - 2026-07-11 09:07

### Added（新增）
- 設定頁「AI 模型」區塊：可選供應商與模型（Claude：Haiku／Sonnet／Opus／Fable，預設 Opus），供應商註冊表架構（`src/ai/providers.ts`）預留之後新增 Antigravity 等供應商
- 測試串接按鈕與燈號：`POST /api/ai/test` 實際呼叫選定模型，成功綠燈＋耗時、失敗紅燈＋錯誤訊息
- 新增命主「出生時間」改為 iOS 式五欄滾輪（年／月／日／時／分，上下滑動置中選取），日數隨年月自動調整（閏年、大小月夾回）
- 星空背景：主畫面與命書同款星點動畫

### Changed（變更）
- 統一 AI 呼叫入口 `server/aiCall.ts`：聊天分析與命書生成都吃設定中的供應商／模型（原本寫死 Opus），合併兩份重複的 claude CLI 呼叫
- 新增命主表單欄位順序改為 稱呼→性別→出生地→出生時間
- 左中右三欄頂部標題列統一高度（`--headbar-h: 54px`）對齊，分隔線以透明佔位隱藏
- 測試擴充至 74 tests（新增 providers／settings／aiCall／aiTestPlugin／birthWheel）

## [先前] - 2026-07-11 07:25

### Added（新增）
- 命主管理系統：新增／改名／刪除命主，資料存本機 `data/`（storagePlugin，不上傳）
- 聊天問答系統：對話紀錄、聊天／報告雙模式、單題報告頁生成（chatPrompt＋ChatPanel）
- AI 解讀與完整命書皆改用本機 claude CLI（Opus），設 `ANTHROPIC_API_KEY` 可走 API
- 視覺化完整命書 v2：程式填盤面（十二宮方圖、大限三卡、應期年份）、Claude 以 JSON 槽位填文字，9 章生成（reportBook＋renderBookHtml），含 JSON fallback 容錯
- 設定視窗：右側盤面預設精簡盤／完整盤
- 對話容量指示環：即時估算 prompt 佔 context 比例，hover 顯示用量
- 測試：trigger／chatPrompt／reportPrompts／reportTemplate 共 58 tests

### Changed（變更）
- 版面改為三欄可拖曳分隔線（寬度記憶）；右欄置頂頁籤（命盤｜斷應期）＋命書按鈕
- 大限／流年列改單行橫向滑動＋左右箭頭；中宮資訊一行一項置中
- 輸入框改圓角卡片（文字區＋按鈕列同卡）；歷史紀錄改單行列表（icon＋標題）
- 新增命主表單移除「真太陽時」選項（內部固定自動換算）

### Fixed（修正）
- 注音輸入法選字按 Enter 誤送出（isComposing 判斷），並修正送出後文字殘留
