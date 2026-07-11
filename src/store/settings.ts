/** 使用者介面設定：localStorage 持久化 */

export interface Settings {
  /** 右側盤面顯示模式，預設精簡盤 */
  chartMode: 'simple' | 'full';
  /** AI 供應商 id，對應 src/ai/providers.ts 的 AI_PROVIDERS */
  aiProvider: string;
  /** 模型 id（該供應商底下） */
  aiModel: string;
}

const KEY = 'zhanyan-settings';

export const DEFAULT_SETTINGS: Settings = { chartMode: 'simple', aiProvider: 'claude', aiModel: 'opus' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 存不了就算了 */
  }
}

/** 給 API 呼叫端組 request body 用的 AI 參數 */
export function aiRequestParams(): { provider: string; model: string } {
  const s = loadSettings();
  return { provider: s.aiProvider, model: s.aiModel };
}
