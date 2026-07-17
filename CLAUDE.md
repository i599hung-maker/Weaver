# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概要

Weaver 織命計畫：占驗派紫微斗數網站（React 19 + Vite + TypeScript）。排盤引擎依文墨天機安星碼 S5VoG 規則，AI 功能（聊天、單題報告、完整命書）靠 dev server middleware 呼叫本機 AI CLI。

## 常用指令

```bash
npm run dev      # 開發（AI 與報告 API 掛在 dev server middleware，只有 dev 有）
npm test         # vitest 全套；單檔：npx vitest run src/engine/__tests__/dingpan.test.ts
npx tsc -b       # 型別檢查（改完必跑）
npm run lint     # oxlint
npm run build    # dist/ 靜態網站（純排盤，不含 AI 後端）
```

## 新機器前置設定（AI 功能需要）

- **Claude 供應商**：本機登入 `claude` CLI（Claude Code），或設 `ANTHROPIC_API_KEY`（有 key 走 API、沒有走 CLI）
- **Antigravity 供應商**：`curl -fsSL https://antigravity.google/cli/install.sh | bash` 安裝 `agy`，跑一次 `agy` 完成 Google 登入（裝完要重開終端機讓 PATH 生效再啟 dev server）
- **JPG／PDF 匯出**：`npx playwright install chromium`（MD 下載不需要）
- `data/`（命主資料、報告檔）不入 git——換機要帶資料就整個目錄手動複製過去

## 架構（跨檔才看得懂的部分）

### AI 供應商雙註冊表

新增供應商要改兩處：`src/ai/providers.ts`（前端下拉選單唯一來源，加一筆自動生效）＋ `server/aiCall.ts` 的 `callAi` dispatcher（spawn 本機 CLI headless：claude 走 stdin、agy 走 `-p` 引數與 `--model` 完整顯示名稱）。前端發請求一律帶 `aiRequestParams()`（`src/store/settings.ts`，localStorage）。

### 報告管線

`src/analysis/` 組章節提示詞 → `POST /api/report/:key/generate`（`server/reportPlugin.ts`）背景逐章 `callAi` → 章節輸出為 JSON 槽位（`parseChapterJson`，失敗存 `__fallbackMd`）→ `renderBookHtml`（`reportTemplate.ts`）＋`renderBookMarkdown`（`reportMarkdown.ts`）寫 `data/reports/<key>.html/.md/.status.json`。單題報告走 `/render`（前端已有 markdown，同步渲染）。

- key 規則：命書 `b_`＋時間36進位、單題 `q_`＋同法、舊制命書 key＝命主 id（相容邏輯在 `src/store/reportList.ts` 的 `mergeReports`）
- 每次產生新增一版不覆蓋；`ReportMeta`（`src/store/mingzhu.ts`）記 provider/model，清單與報告頁尾顯示模型標記
- 生成 job 是 dev server in-memory（`jobs` Set）：**重啟 dev server 會讓生成中斷**
- 章節續跑：每章完成即寫 `data/reports/<key>.chapters.json`；中斷（逾時／CLI 錯誤／重啟）後前端沿用原 key 重新產生，provider/model/prompt hash 都相同的章節直接沿用，全書完成即刪 partial 檔。完成後的「重新產生」用新 key，不會誤沿用

### 資料存放

命主／對話存 `data/<id>.json`（`server/storagePlugin.ts`，`/api/mingzhu`）；介面設定存 localStorage（`src/store/settings.ts`）。皆單機使用、無資料庫。

### 排盤引擎（勿動規則）

`src/engine/`（iztro＋占驗派修正層 `patch.ts`/`zhanyanConfig.ts`）。S5VoG 規則已用三張文墨天機定盤逐宮驗證鎖定（`src/engine/__tests__/dingpan.test.ts`），四化表、天馬依月支、截空旬空、晚子時等規則差異詳見 README 與 `docs/specs/2026-07-08-zhanyan-paipan-design.md`——改排盤邏輯前必先確認定盤測試仍過。

## 慣例

- 程式註解、commit message、CHANGELOG 一律繁體中文（專有名詞保留英文）
- 每次推播前更新 `CHANGELOG.md`（格式見檔內；時間 `YYYY-MM-DD HH:mm`）
- 功能設計 spec 放 `docs/superpowers/specs/`，功能邏輯筆記放 `docs/logic/`
- 品牌文案單一出處 `src/brand.ts`；解讀語氣憲章 `src/analysis/tone.ts`（知命改命、提風險必附對策），所有 prompt 都接它
