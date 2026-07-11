import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { saveMingzhu, type Mingzhu } from '../store/mingzhu';

interface Props {
  mingzhu: Mingzhu;
  onUpdate: (m: Mingzhu) => void;
}

/** 建議字數上限（純建議，超過仍可儲存）：自述會進每次聊天與命書九章 prompt，精煉優於冗長 */
const SUGGESTED_MAX = 500;

/** 中欄標題下的個人背景卡片：收合一行摘要，展開為 textarea＋建議小字＋字數計 */
export default function ProfileCard({ mingzhu, onUpdate }: Props) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState(mingzhu.profile ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = mingzhu.profile?.trim() ?? '';
  const summary = saved ? saved.split('\n')[0].slice(0, 40) : '';

  const save = async () => {
    setSaving(true);
    setError(null);
    const next = { ...mingzhu, profile: draft.trim() };
    try {
      await saveMingzhu(next);
      onUpdate(next);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        className="profile-bar"
        onClick={() => {
          setDraft(mingzhu.profile ?? '');
          setOpen(true);
        }}
      >
        <ChevronRight size={14} strokeWidth={1.8} />
        {saved ? (
          <span className="pb-summary">
            個人背景：{summary}
            {saved.length > 40 ? '…' : ''}
          </span>
        ) : (
          <span className="pb-empty">＋ 填寫個人背景，讓解讀更貼近你（選填）</span>
        )}
      </button>
    );
  }

  return (
    <div className="profile-card">
      <button className="profile-bar" onClick={() => setOpen(false)}>
        <ChevronDown size={14} strokeWidth={1.8} />
        <span className="pb-summary">個人背景</span>
      </button>
      <textarea
        rows={5}
        placeholder="自我介紹：你在做什麼、目前的生活狀態…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="pc-hint">
        💡 建議可寫：職業與工作現況、感情／婚姻狀況、最想了解的事、重大事件與年份（如 2018
        換工作、2021 結婚）——寫得越具體，解讀越貼近你。建議 {SUGGESTED_MAX} 字內，精煉比冗長更有效。
      </div>
      {error && <div className="pc-error">儲存失敗：{error}</div>}
      <div className="pc-actions">
        <span
          className={`pc-count${draft.length > SUGGESTED_MAX ? ' over' : ''}`}
          title={draft.length > SUGGESTED_MAX ? '超過建議字數，仍可儲存；精簡有助 AI 抓重點' : '建議字數'}
        >
          {draft.length}/{SUGGESTED_MAX}
        </span>
        <button onClick={() => setOpen(false)}>收合</button>
        <button className="primary" disabled={saving} onClick={() => void save()}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  );
}
