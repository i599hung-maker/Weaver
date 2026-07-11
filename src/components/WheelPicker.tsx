import { useEffect, useRef } from 'react';

export interface WheelOption {
  value: number;
  label: string;
}

interface Props {
  options: WheelOption[];
  value: number;
  onChange: (value: number) => void;
}

/** 格高 px：與 App.css 的 .wheel-item 高度、.wheel-col padding（2 格）連動 */
const ITEM_H = 32;

/** 單欄上下滑動滾輪：scroll-snap 置中吸附，捲停回報置中項，點擊任一格置中 */
export default function WheelPicker({ options, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);

  // 外部 value 變更（含初始、日數夾回）→ 同步捲動位置
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTo({ top: target });
  }, [value, options]);

  // 捲動停止（debounce 120ms）→ 以位置反推置中項
  const onScroll = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (options[idx].value !== value) onChange(options[idx].value);
    }, 120);
  };

  return (
    <div className="wheel-col" ref={ref} onScroll={onScroll}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`wheel-item${o.value === value ? ' sel' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
