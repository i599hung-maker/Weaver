# AI 供應商與模型設定＋測試串接 — 設計文件

日期：2026-07-11

## 目標

設定頁新增「AI 模型」區塊：使用者可選擇 AI 供應商與模型，並提供「測試串接」按鈕，成功亮綠燈、失敗亮紅燈，讓使用者確定 AI 功能可用。

首發只實作 Claude（haiku / sonnet / opus / fable），但架構做成供應商註冊表，之後新增供應商（如 Antigravity / Gemini）只需：

1. 在 `src/ai/providers.ts` 的 `AI_PROVIDERS` 加一筆（id、label、models）。
2. 在 `server/aiCall.ts` 加對應的呼叫函式並掛進 dispatcher。

前端下拉選單、模型清單、測試綠燈都會自動生效，不需改既有元件。

## 架構

- **供應商定義檔** `src/ai/providers.ts`：`AI_PROVIDERS: AiProvider[]`，每筆含 `id`、`label`、`models: { id, label }[]`。提供 `findProvider(id)` 輔助。首發僅 `claude`，模型 `haiku`、`sonnet`、`opus`（預設）、`fable`。
- **設定** `src/store/settings.ts`：`Settings` 加 `aiProvider: string`（預設 `'claude'`）與 `aiModel: string`（預設 `'opus'`，維持現行為）。舊 localStorage 資料由現有 spread 補預設值。
- **後端統一呼叫** `server/aiCall.ts`：`callAi(provider, model, prompt, timeoutMs?)`。
  - `claude`：合併 analyzePlugin / reportPlugin 兩份重複的 `callClaudeCli`，`--model` 改吃參數；設有 `ANTHROPIC_API_KEY` 時走 Anthropic API，模型 id 映射（haiku→claude-haiku-4-5、sonnet→claude-sonnet-5、opus→claude-opus-4-8、fable→claude-fable-5）。
  - 未知供應商 → throw「供應商 X 尚未支援」。
- **API 調整**：
  - `POST /api/analyze` body 加可選 `provider`、`model`，未帶預設 claude/opus。
  - `POST /api/report/:key/generate` 的 `GenerateBody` 加可選 `provider`、`model`，逐章生成沿用。
  - 新端點 `POST /api/ai/test`（新 plugin `server/aiTestPlugin.ts`）：body `{ provider, model }`，以極短 prompt（要求只回覆 OK）呼叫 `callAi`，逾時 60 秒；成功回 `{ ok: true, latencyMs }`，失敗回 `{ ok: false, error }`（HTTP 200，錯誤語意在 payload）。
- **設定頁 UI** `SettingsModal.tsx`：「AI 模型」區塊 — 供應商下拉、模型下拉（隨供應商連動，切供應商時模型自動設為該供應商第一個模型）、「測試串接」按鈕與燈號：
  - 灰＝未測試、轉圈＝測試中、綠＝成功（顯示耗時秒數）、紅＝失敗（顯示錯誤訊息）。
  - 變更供應商或模型時燈號重置為灰。
- **前端呼叫端**：ChatPanel / 分析、報告產生請求 body 帶上設定中的 `provider`、`model`。

## 錯誤處理

- 測試端點逾時 60 秒即回失敗；一般分析/報告維持原 600 秒。
- 未知供應商 / 模型不擋前端（清單來自定義檔，不會選出未知值），後端仍驗證並回明確錯誤。
- localStorage 讀寫失敗照舊 fallback 預設。

## 測試

- `settings`：新欄位預設值、舊資料遷移（缺欄位自動補）。
- `aiCall`：未知供應商 throw；claude API 模型映射。
- `aiTestPlugin`：以注入的 fake caller 測成功/失敗 payload 形狀。
- UI 手動驗證：下拉連動、綠燈/紅燈流程。
