import { useMemo, useState } from 'react';
import { cast } from './engine/cast';
import type { BirthInput } from './engine/types';
import BirthForm from './components/BirthForm';
import Chart from './components/Chart';
import HoroscopeBar from './components/HoroscopeBar';
import AnalysisPanel from './components/AnalysisPanel';
import './App.css';

export default function App() {
  const [input, setInput] = useState<BirthInput | null>(null);
  const [selDecadalBranch, setSelDecadalBranch] = useState<string | null>(null);
  const [selYear, setSelYear] = useState<number | null>(null);
  const [simple, setSimple] = useState(true);

  const result = useMemo(() => {
    if (!input) return null;
    try {
      return cast(input);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [input]);

  const birthYear = result ? Number(result.meta.castDate.split('-')[0]) : 0;

  const horoscope = useMemo(() => {
    if (!result || !selDecadalBranch) return null;
    const palace = result.astrolabe.palaces.find((p) => p.earthlyBranch === selDecadalBranch);
    if (!palace) return null;
    const year = selYear ?? birthYear + palace.decadal.range[0] - 1;
    return result.astrolabe.horoscope(`${year}-7-1 12:00`);
  }, [result, selDecadalBranch, selYear, birthYear]);

  return (
    <div className="app">
      <header>
        <h1>LifePath 占驗紫微</h1>
        <BirthForm
          onSubmit={(i) => {
            setInput(i);
            setSelDecadalBranch(null);
            setSelYear(null);
          }}
        />
      </header>

      {result ? (
        <>
          <div className="mode-toggle">
            <button className={simple ? 'active' : ''} onClick={() => setSimple(true)}>
              精簡盤
            </button>
            <button className={!simple ? 'active' : ''} onClick={() => setSimple(false)}>
              完整盤
            </button>
          </div>
          <Chart
            astrolabe={result.astrolabe}
            meta={result.meta}
            name={input?.name ?? ''}
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
          <AnalysisPanel
            result={result}
            inputKey={`${input?.date}-${input?.time}-${input?.gender}`}
            onJumpToYear={(decadalBranch, year) => {
              setSelDecadalBranch(decadalBranch);
              setSelYear(year);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
          <footer>
            排盤規則：文墨天機安星碼 S5VoG（占驗派）｜庚干四化 陽武同相｜天馬依月支｜截空旬空占驗排法｜
            晚子時視為次日｜閏月月中分界
          </footer>
        </>
      ) : (
        <div className="empty">輸入出生資料後排盤，或點「定盤一／二／三」載入驗證命例。</div>
      )}
    </div>
  );
}
