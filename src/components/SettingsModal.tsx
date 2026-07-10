import { useEffect } from 'react';
import type { Settings } from '../store/settings';

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onChange: (s: Settings) => void;
}

export default function SettingsModal({ open, settings, onClose, onChange }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>設定</h2>
        <label className="m-row">
          <span className="m-label">盤面顯示</span>
          <select
            value={settings.chartMode}
            onChange={(e) => onChange({ ...settings, chartMode: e.target.value as Settings['chartMode'] })}
          >
            <option value="simple">精簡盤</option>
            <option value="full">完整盤</option>
          </select>
        </label>
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
