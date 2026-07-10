# Changelog

## [Unreleased] - 2026-07-11 07:25

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
