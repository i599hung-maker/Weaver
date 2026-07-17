import { useMemo, useRef, useState } from 'react';
import type { CastResult } from '../engine/cast';
import type { Mingzhu } from '../store/mingzhu';
import Chart from './Chart';
import HoroscopeBar from './HoroscopeBar';
import AnalysisPanel from './AnalysisPanel';

interface Props {
  mingzhu: Mingzhu;
  result: CastResult;
  /** 精簡盤（true）／完整盤（false），由左下角「設定」控制 */
  simple: boolean;
  /** 顯示命盤或斷應期分析，由中欄頂端切換鈕控制（上提到 App） */
  chartTab: 'chart' | 'yingqi';
  onChartTab: (t: 'chart' | 'yingqi') => void;
}

export default function RightPanel({ mingzhu, result, simple, chartTab, onChartTab }: Props) {
  const [selDecadalBranch, setSelDecadalBranch] = useState<string | null>(null);
  const [selYear, setSelYear] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const birthYear = Number(result.meta.castDate.split('-')[0]);

  const horoscope = useMemo(() => {
    if (!selDecadalBranch) return null;
    const palace = result.astrolabe.palaces.find((p) => p.earthlyBranch === selDecadalBranch);
    if (!palace) return null;
    const year = selYear ?? birthYear + palace.decadal.range[0] - 1;
    return result.astrolabe.horoscope(`${year}-7-1 12:00`);
  }, [result, selDecadalBranch, selYear, birthYear]);

  return (
    <div className="right-panel" ref={panelRef}>
      {chartTab === 'chart' ? (
        <>
          <Chart
            astrolabe={result.astrolabe}
            meta={result.meta}
            name={mingzhu.name}
            birthYear={birthYear}
            horoscope={horoscope}
            showYearly={selYear !== null}
            selDecadalBranch={selDecadalBranch}
            simple={simple}
          />
          <HoroscopeBar
            astrolabe={result.astrolabe}
            birthYear={birthYear}
            yearStem={result.meta.yearStem}
            yearBranch={result.meta.yearBranch}
            selDecadalBranch={selDecadalBranch}
            selYear={selYear}
            onSelectDecadal={(b) => {
              setSelDecadalBranch(b);
              setSelYear(null);
            }}
            onSelectYear={setSelYear}
          />
        </>
      ) : (
        <AnalysisPanel
          result={result}
          inputKey={mingzhu.id}
          onJumpToYear={(decadalBranch, year) => {
            setSelDecadalBranch(decadalBranch);
            setSelYear(year);
            onChartTab('chart'); // 跳年份時切回命盤查看
            panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
      <footer>
        排盤規則：文墨天機安星碼 S5VoG（占驗派）｜庚干四化 陽武同相｜天馬依月支｜截空旬空占驗排法｜
        晚子時視為次日｜閏月月中分界
      </footer>
    </div>
  );
}
