/** 使用者介面設定：localStorage 持久化 */

import type { ReportStyle } from '../analysis/chatPrompt';

/** 介面配色：藕紫（莫蘭迪紫藕）、灰黑（原黑白極簡）、紫色（命書墨紫） */
export type Theme = 'mauve' | 'gray' | 'purple';

export interface Settings {
  /** 右側盤面顯示模式，預設精簡盤 */
  chartMode: 'simple' | 'full';
  /** 介面配色，預設藕紫 */
  theme: Theme;
  /** AI 供應商 id，對應 src/ai/providers.ts 的 AI_PROVIDERS */
  aiProvider: string;
  /** 模型 id（該供應商底下） */
  aiModel: string;
  /** 回覆風格（聊天／報告／命書共用）：白話（預設）或命理（正式） */
  reportStyle: ReportStyle;
}

const KEY = 'zhanyan-settings';

export const DEFAULT_SETTINGS: Settings = { chartMode: 'simple', theme: 'mauve', aiProvider: 'claude', aiModel: 'opus', reportStyle: 'plain' };

/** 套用配色到 <html data-theme>：CSS token 依此切換 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

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
