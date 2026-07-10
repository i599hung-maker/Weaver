import { useEffect, useState } from 'react';
import type { BirthInput, Gender } from '../engine/types';
import { PLACES } from './places';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, birth: BirthInput) => void;
}

const CUSTOM = '自訂';

export default function MingzhuModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('1990-01-01');
  const [time, setTime] = useState('12:00');
  const [gender, setGender] = useState<Gender>('男');
  const [place, setPlace] = useState('台北');
  const [customLng, setCustomLng] = useState(121);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const valid = name.trim() !== '' && date !== '' && time !== '';

  const submit = () => {
    if (!valid) return;
    const p = PLACES.find((pl) => pl.name === place);
    const geo = p ? { longitude: p.longitude, tzOffset: p.tzOffset } : { longitude: customLng, tzOffset: 8 };
    onSubmit(name.trim(), {
      name: name.trim(),
      date,
      time,
      gender,
      useTrueSolarTime: true,
      ...geo,
    });
    setName('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>新增命主</h2>
        <label className="m-row">
          <span className="m-label">稱呼＊</span>
          <input
            autoFocus
            placeholder="必填"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="m-row">
          <span className="m-label">國曆生日</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="m-row">
          <span className="m-label">時間</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="m-row">
          <span className="m-label">性別</span>
          <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </label>
        <label className="m-row">
          <span className="m-label">出生地</span>
          <select value={place} onChange={(e) => setPlace(e.target.value)}>
            {PLACES.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
            <option value={CUSTOM}>{CUSTOM}經度</option>
          </select>
        </label>
        {place === CUSTOM && (
          <label className="m-row">
            <span className="m-label">東經</span>
            <input
              type="number"
              value={customLng}
              step="0.1"
              onChange={(e) => setCustomLng(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
        )}
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" disabled={!valid} onClick={submit}>
            排盤並儲存
          </button>
        </div>
      </div>
    </div>
  );
}
