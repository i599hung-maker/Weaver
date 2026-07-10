/** 使用者介面設定：localStorage 持久化 */

export interface Settings {
  /** 右側盤面顯示模式，預設精簡盤 */
  chartMode: 'simple' | 'full';
}

const KEY = 'zhanyan-settings';

export const DEFAULT_SETTINGS: Settings = { chartMode: 'simple' };

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
