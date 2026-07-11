import { useEffect } from 'react';

/** 一次確認請求：text 顯示內容、onOk 按下確認後執行 */
export interface ConfirmRequest {
  text: string;
  /** 確認鈕文字，預設「確定」 */
  okLabel?: string;
  onOk: () => void;
}

interface Props {
  req: ConfirmRequest | null;
  onClose: () => void;
}

/** 自家風格確認彈窗：取代瀏覽器原生 window.confirm（Esc 或點背景＝取消） */
export default function ConfirmModal({ req, onClose }: Props) {
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req, onClose]);

  if (!req) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card confirm-card" onClick={(e) => e.stopPropagation()}>
        <p className="cf-text">{req.text}</p>
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button
            className="primary"
            autoFocus
            onClick={() => {
              req.onOk();
              onClose();
            }}
          >
            {req.okLabel ?? '確定'}
          </button>
        </div>
      </div>
    </div>
  );
}
