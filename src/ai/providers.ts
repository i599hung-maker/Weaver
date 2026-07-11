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
];

export function findProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
