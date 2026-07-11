# Weaver 織命計畫

依文墨天機安星碼 **S5VoG**（占驗派）規則排盤的紫微斗數網站：排盤、斷應期、AI 問答與完整命書。
從知命到織命 —— 命盤不是判決書，而是人生的原廠設定圖。

## 功能

- **占驗排盤** — 十二宮命盤（精簡／完整盤），大限、流年即點即換；斷應期分頁提供引動法分析
- **AI 問答** — 以盤面事實為據向 AI 提問（聊天／報告兩種模式），多命主、多對話各自保存
- **單題報告** — 報告模式回覆自動產生命書版型的報告頁，可匯出 JPG／PDF
- **完整命書** — 一鍵背景生成九章命書（約 15~30 分鐘）；每次產生保留一版並標記使用的模型，方便比較不同模型的產出
- **回覆風格** — 白話風／命理風；解讀基調遵循「知命改命、提風險必附對策」（`src/analysis/tone.ts`）
- **介面配色** — 藕紫／灰黑／星空紫三主題，報告頁配色跟隨設定

## AI 供應商

設定 → AI 模型可切換供應商與模型，呼叫一律走本機（`server/aiCall.ts` 統一入口）：

| 供應商 | 呼叫方式 | 模型 |
|---|---|---|
| Claude | `claude` CLI headless（已登入 Claude Code）；設 `ANTHROPIC_API_KEY` 則走 API | Haiku／Sonnet／Opus／Fable |
| Antigravity | `agy` CLI headless（已登入 Antigravity CLI） | Gemini 3.5 Flash、Gemini 3.1 Pro、Claude 4.6 等 |

新增供應商：在 `src/ai/providers.ts` 註冊（前端下拉選單自動生效），並在 `server/aiCall.ts` 掛上呼叫函式。

## 使用

```bash
npm install
npm run dev    # 開發（AI 與報告功能掛在 dev server middleware）
npm test       # 定盤測試 + 分析/報告/供應商測試
npm run build  # 產出 dist/ 靜態網站（純排盤，不含 AI 後端）
```

前置：AI 功能需本機已登入 `claude` CLI 或 `agy` CLI（擇一即可）。

## 排盤規則（與通行排法的差異）

- 四化表十干鎖死，庚干用占驗派「陽武同相」（天同化科、天相化忌）
- 天馬依**月支**（非年支）
- 截空、旬空單星制：截空取與年干同陰陽之宮、旬空取異陰陽之宮
- 晚子時（23:00~00:00）視為次日；閏月月中分界；真太陽時定時辰（可關）

規則依三張文墨天機定盤逐宮反推驗證，詳見 `docs/specs/2026-07-08-zhanyan-paipan-design.md`。

## 結構

- `src/engine/` — 排盤引擎（iztro + 占驗派設定與修正層），UI 無關、可獨立測試
- `src/analysis/` — 盤面事實抽取、引動法、聊天／報告／命書提示詞、語氣憲章
- `src/ai/` — AI 供應商註冊表（下拉選單唯一來源）
- `src/components/` — UI（盤面、聊天、報告清單、設定、首頁）
- `src/store/` — 命主／對話／報告紀錄與介面設定（localStorage＋伺服器保存）
- `server/` — dev server middleware：AI 呼叫、`/api/analyze`、`/api/report`（生成／渲染／匯出）、資料保存
- `data/`、`reports/` — 命主資料與生成的報告（本機保存，不上傳 git）
- `docs/` — 設計 spec、功能邏輯筆記、解盤 SOP
