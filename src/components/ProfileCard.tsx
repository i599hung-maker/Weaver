import { useState } from 'react';
import { saveMingzhu, type Mingzhu } from '../store/mingzhu';

interface Props {
  mingzhu: Mingzhu;
  onUpdate: (m: Mingzhu) => void;
}

/** 建議字數上限（純建議，超過仍可儲存）：自述會進每次聊天與命書九章 prompt，精煉優於冗長 */
const SUGGESTED_MAX = 500;

/** 中欄標題下的個人背景卡片：常駐顯示內容，按「編輯」才開 textarea＋字數計 */
export default function ProfileCard({ mingzhu, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = mingzhu.profile?.trim() ?? '';

  const startEdit = () => {
    setDraft(mingzhu.profile ?? '');
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const next = { ...mingzhu, profile: draft.trim() };
    try {
      await saveMingzhu(next);
      onUpdate(next);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-card">
      <div className="pc-head">
        <span className="pc-title">個人背景</span>
        {!editing && (
          <button className="pc-edit" onClick={startEdit}>
            編輯
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            autoFocus
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
            <button onClick={() => setEditing(false)}>取消</button>
            <button className="primary" disabled={saving} onClick={() => void save()}>
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </>
      ) : saved ? (
        <p className="pc-text">{saved}</p>
      ) : (
        <p className="pc-empty">尚未填寫。寫下職業、感情狀況、重大事件年份等，讓解讀更貼近你（選填）。</p>
      )}
    </div>
  );
}
