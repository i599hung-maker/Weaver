/**
 * AI 供應商註冊表：前端下拉選單與模型清單的唯一來源。
 * 新增供應商：在 AI_PROVIDERS 加一筆，並在 server/aiCall.ts 的 callAi 掛上對應呼叫函式。
 */

export interface AiModel {
  id: string;
  label: string;
}

export interface AiProvider {
  id: string;
  label: string;
  models: AiModel[];
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'claude',
    label: 'Claude',
    models: [
      { id: 'haiku', label: 'Haiku（最快）' },
      { id: 'sonnet', label: 'Sonnet（均衡）' },
      { id: 'opus', label: 'Opus（深入）' },
      { id: 'fable', label: 'Fable（最強）' },
    ],
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    models: [
      { id: 'flash-low', label: 'Gemini 3.5 Flash (Low)' },
      { id: 'flash', label: 'Gemini 3.5 Flash (Medium)' },
      { id: 'flash-high', label: 'Gemini 3.5 Flash (High)' },
      { id: 'pro-low', label: 'Gemini 3.1 Pro (Low)' },
      { id: 'pro', label: 'Gemini 3.1 Pro (High)' },
      { id: 'sonnet-4.6', label: 'Claude Sonnet 4.6 (Thinking)' },
      { id: 'opus-4.6', label: 'Claude Opus 4.6 (Thinking)' },
    ],
  },
];

export function findProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
