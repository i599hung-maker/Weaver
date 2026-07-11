import { useEffect, useState } from 'react';
import { Info, Settings2, Sparkles, X } from 'lucide-react';
import type { Settings } from '../store/settings';
import { AI_PROVIDERS, findProvider } from '../ai/providers';
import { BRAND_MISSION, BRAND_NAME, BRAND_TAGLINE } from '../brand';

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

type Tab = 'general' | 'ai' | 'about';

const TABS: { key: Tab; label: string; Icon: typeof Settings2 }[] = [
  { key: 'general', label: '通用設定', Icon: Settings2 },
  { key: 'ai', label: 'AI 模型', Icon: Sparkles },
  { key: 'about', label: '關於 Weaver', Icon: Info },
];

export default function SettingsModal({ open, settings, onClose, onChange }: Props) {
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  const [tab, setTab] = useState<Tab>('general');

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
      <div className="modal-card settings-card" onClick={(e) => e.stopPropagation()}>
        <button className="sm-close" title="關閉" onClick={onClose}>
          <X size={18} strokeWidth={1.8} />
        </button>

        <nav className="sm-nav">
          <h2>設定</h2>
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sm-body">
          {tab === 'general' && (
            <>
              <h3 className="sm-title">通用設定</h3>
              <label className="m-row">
                <span className="m-label">介面配色</span>
                <select
                  value={settings.theme}
                  onChange={(e) => onChange({ ...settings, theme: e.target.value as Settings['theme'] })}
                >
                  <option value="mauve">藕紫色</option>
                  <option value="gray">灰黑色</option>
                  <option value="purple">星空紫</option>
                </select>
              </label>
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
              <label className="m-row">
                <span className="m-label">回覆風格</span>
                <select
                  value={settings.reportStyle}
                  onChange={(e) => onChange({ ...settings, reportStyle: e.target.value as Settings['reportStyle'] })}
                >
                  <option value="plain">白話風</option>
                  <option value="classic">命理風</option>
                </select>
              </label>
            </>
          )}

          {tab === 'ai' && (
            <>
              <h3 className="sm-title">AI 模型</h3>
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
                  {test.status === 'ok' && (
                    <small className="ai-msg ok">連線正常（{(test.latencyMs / 1000).toFixed(1)} 秒）</small>
                  )}
                  {test.status === 'fail' && <small className="ai-msg fail">{test.error}</small>}
                </span>
              </div>
            </>
          )}

          {tab === 'about' && (
            <div className="sm-about">
              <h3 className="sm-brand">{BRAND_NAME}</h3>
              <p className="sm-tagline">{BRAND_TAGLINE}</p>
              {BRAND_MISSION.map((p) => (
                <p key={p} className="sm-mission">
                  {p}
                </p>
              ))}
              <p className="sm-fineprint">
                排盤依文墨天機安星碼 S5VoG（占驗派）；解讀由 AI 依盤面事實生成，供自我參考，不是命定的判決。
                所有資料只儲存在這台裝置的瀏覽器裡。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
