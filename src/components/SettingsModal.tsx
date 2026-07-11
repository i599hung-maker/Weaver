import { useEffect, useState } from 'react';
import type { Settings } from '../store/settings';
import { AI_PROVIDERS, findProvider } from '../ai/providers';

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onChange: (s: Settings) => void;
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; latencyMs: number }
  | { status: 'fail'; error: string };

export default function SettingsModal({ open, settings, onClose, onChange }: Props) {
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const provider = findProvider(settings.aiProvider) ?? AI_PROVIDERS[0];

  const changeProvider = (id: string) => {
    const p = findProvider(id) ?? AI_PROVIDERS[0];
    onChange({ ...settings, aiProvider: p.id, aiModel: p.models[0].id });
    setTest({ status: 'idle' });
  };

  const changeModel = (id: string) => {
    onChange({ ...settings, aiModel: id });
    setTest({ status: 'idle' });
  };

  const runTest = async () => {
    setTest({ status: 'testing' });
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: settings.aiProvider, model: settings.aiModel }),
      });
      const data = (await res.json()) as { ok: boolean; latencyMs?: number; error?: string };
      if (data.ok) setTest({ status: 'ok', latencyMs: data.latencyMs ?? 0 });
      else setTest({ status: 'fail', error: data.error ?? '測試失敗' });
    } catch (e) {
      setTest({ status: 'fail', error: (e as Error).message });
    }
  };

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

        <h3 className="m-section">AI 模型</h3>
        <label className="m-row">
          <span className="m-label">供應商</span>
          <select value={provider.id} onChange={(e) => changeProvider(e.target.value)}>
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="m-row">
          <span className="m-label">模型</span>
          <select value={settings.aiModel} onChange={(e) => changeModel(e.target.value)}>
            {provider.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="m-row">
          <span className="m-label">串接狀態</span>
          <span className="ai-test">
            <button onClick={runTest} disabled={test.status === 'testing'}>
              {test.status === 'testing' ? '測試中…' : '測試串接'}
            </button>
            <i className={`ai-dot ${test.status}`} />
            {test.status === 'ok' && <small className="ai-msg ok">連線正常（{(test.latencyMs / 1000).toFixed(1)} 秒）</small>}
            {test.status === 'fail' && <small className="ai-msg fail">{test.error}</small>}
          </span>
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
