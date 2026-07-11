import { useEffect, useState } from 'react';
import type { BirthInput, Gender } from '../engine/types';
import { PLACES } from './places';
import WheelPicker, { type WheelOption } from './WheelPicker';
import { clampDay, daysInMonth, pad2 } from './birthWheel';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, birth: BirthInput) => void;
}

const CUSTOM = '自訂';

const THIS_YEAR = new Date().getFullYear();

function range(from: number, to: number, unit: string): WheelOption[] {
  const list: WheelOption[] = [];
  for (let v = from; v <= to; v++) list.push({ value: v, label: `${v}${unit}` });
  return list;
}

const YEARS = range(1920, THIS_YEAR, '年');
const MONTHS = range(1, 12, '月');
const HOURS = range(0, 23, '時');
const MINUTES = range(0, 59, '分');

export default function MingzhuModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('男');
  const [place, setPlace] = useState('台北');
  const [customLng, setCustomLng] = useState(121);
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const valid = name.trim() !== '';
  /** 月底夾回：例如選了 31 日再切到 2 月 → 顯示與送出都用 28/29 */
  const safeDay = clampDay(year, month, day);
  const days = range(1, daysInMonth(year, month), '日');

  const submit = () => {
    if (!valid) return;
    const p = PLACES.find((pl) => pl.name === place);
    const geo = p ? { longitude: p.longitude, tzOffset: p.tzOffset } : { longitude: customLng, tzOffset: 8 };
    onSubmit(name.trim(), {
      name: name.trim(),
      date: `${year}-${pad2(month)}-${pad2(safeDay)}`,
      time: `${pad2(hour)}:${pad2(minute)}`,
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
        <div className="m-row">
          <span className="m-label">出生時間</span>
        </div>
        <div className="wheel-row">
          <WheelPicker options={YEARS} value={year} onChange={setYear} />
          <WheelPicker options={MONTHS} value={month} onChange={setMonth} />
          <WheelPicker options={days} value={safeDay} onChange={setDay} />
          <WheelPicker options={HOURS} value={hour} onChange={setHour} />
          <WheelPicker options={MINUTES} value={minute} onChange={setMinute} />
        </div>
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
