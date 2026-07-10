import { useState } from 'react';
import type { BirthInput, Gender } from '../engine/types';
import { PLACES } from './places';

interface Props {
  onSubmit: (input: BirthInput) => void;
}

const SAMPLES: (BirthInput & { label: string })[] = [
  { label: '定盤一', name: '定盤一', date: '1996-05-12', time: '23:40', gender: '男' },
  { label: '定盤二', name: '定盤二', date: '1994-12-02', time: '02:43', gender: '女' },
  { label: '定盤三', name: '定盤三', date: '1969-03-11', time: '11:50', gender: '女' },
];

const CUSTOM = '自訂';

export default function BirthForm({ onSubmit }: Props) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('1996-05-12');
  const [time, setTime] = useState('23:40');
  const [gender, setGender] = useState<Gender>('男');
  const [place, setPlace] = useState('台北');
  const [customLng, setCustomLng] = useState(121);
  const [useTst, setUseTst] = useState(true);

  const resolveGeo = () => {
    const p = PLACES.find((pl) => pl.name === place);
    return p ? { longitude: p.longitude, tzOffset: p.tzOffset } : { longitude: customLng, tzOffset: 8 };
  };

  const submit = () => {
    if (!date || !time) return;
    onSubmit({ name, date, time, gender, useTrueSolarTime: useTst, ...resolveGeo() });
  };

  return (
    <div className="birth-form">
      <input placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 90 }} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
        <option value="男">男</option>
        <option value="女">女</option>
      </select>
      <label className="adv">
        出生地
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
        <label className="adv">
          東經
          <input
            type="number"
            value={customLng}
            step="0.1"
            onChange={(e) => setCustomLng(Number(e.target.value))}
            style={{ width: 70 }}
          />
        </label>
      )}
      <label className="adv">
        <input type="checkbox" checked={useTst} onChange={(e) => setUseTst(e.target.checked)} />
        真太陽時
      </label>
      <button className="primary" onClick={submit}>
        排盤
      </button>
      <span className="samples">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            onClick={() => {
              setName(s.name ?? '');
              setDate(s.date);
              setTime(s.time);
              setGender(s.gender);
              onSubmit({ ...s, useTrueSolarTime: useTst, ...resolveGeo() });
            }}
          >
            {s.label}
          </button>
        ))}
      </span>
    </div>
  );
}
