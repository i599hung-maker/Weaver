import { useRef, useState } from 'react';
import { Compass, MessageSquare, Pencil, Settings, Trash2, UserRoundPlus, Users } from 'lucide-react';
import type { Mingzhu } from '../store/mingzhu';
import { BRAND_NAME } from '../brand';
import ConfirmModal, { type ConfirmRequest } from './ConfirmModal';

interface Props {
  list: Mingzhu[];
  activeId: string | null;
  activeConvId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSelectConv: (id: string | null) => void;
  onDeleteConv: (id: string) => void;
  onOpenSettings: () => void;
  onHome: () => void;
}

export default function Sidebar({
  list,
  activeId,
  activeConvId,
  onSelect,
  onAdd,
  onDelete,
  onRename,
  onSelectConv,
  onDeleteConv,
  onOpenSettings,
  onHome,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const cancelRef = useRef(false); // Esc 取消時略過 blur 的確認

  const startEdit = (m: Mingzhu) => {
    cancelRef.current = false;
    setDraft(m.name);
    setEditingId(m.id);
  };

  const commitEdit = (m: Mingzhu) => {
    setEditingId(null);
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const name = draft.trim();
    if (!name || name === m.name) return; // 空值不儲存
    onRename(m.id, name);
  };

  return (
    <aside className="sidebar">
      <button className="sb-brand" title="回首頁" onClick={onHome}>
        <Compass size={20} strokeWidth={1.8} />
        <h1>{BRAND_NAME}</h1>
      </button>
      <div className="sb-section">
        <Users size={15} strokeWidth={1.8} />
        <span>命主列表</span>
        <button className="sb-icon-btn" title="新增命主" onClick={onAdd}>
          <UserRoundPlus size={16} strokeWidth={1.8} />
        </button>
      </div>
      <div className="sb-list">
        {list.map((m) => (
          <div key={m.id} className="sb-group">
            <div
              className={`sb-item ${m.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(m.id)}
            >
              {editingId === m.id ? (
                <input
                  className="sb-name-input"
                  value={draft}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitEdit(m)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur(); // 交給 onBlur 確認，避免重複儲存
                    } else if (e.key === 'Escape') {
                      cancelRef.current = true;
                      e.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <div className="sb-name">{m.name}</div>
              )}
              <button
                className="sb-edit"
                title="重新命名"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(m);
                }}
              >
                <Pencil size={13} strokeWidth={1.8} />
              </button>
              <button
                className="sb-del"
                title="刪除命主"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirm({
                    text: `刪除命主「${m.name}」？其對話紀錄將一併刪除。`,
                    okLabel: '刪除',
                    onOk: () => onDelete(m.id),
                  });
                }}
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </div>
            {m.id === activeId && m.conversations.length > 0 && (
              <div className="sb-convs">
                {m.conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`sb-conv ${c.id === activeConvId ? 'active' : ''}`}
                    onClick={() => onSelectConv(c.id)}
                  >
                    <MessageSquare size={13} strokeWidth={1.8} className="sb-conv-icon" />
                    <span>{c.title}</span>
                    <button
                      className="sb-del"
                      title="刪除對話"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConv(c.id);
                      }}
                    >
                      <Trash2 size={12} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="sb-empty">尚無命主</div>}
      </div>
      <button className="sb-settings" onClick={onOpenSettings}>
        <Settings size={15} strokeWidth={1.8} />
        <span>設定</span>
      </button>
      <ConfirmModal req={confirm} onClose={() => setConfirm(null)} />
    </aside>
  );
}
