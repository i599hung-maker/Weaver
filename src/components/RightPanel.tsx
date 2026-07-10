import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, LoaderCircle } from 'lucide-react';
import type { CastResult } from '../engine/cast';
import type { Mingzhu } from '../store/mingzhu';
import { buildAnalysis } from '../analysis/analysis';
import { buildReportHeader } from '../analysis/reportPrompts';
import { buildBookChapters, buildBookData } from '../analysis/reportBook';
import Chart from './Chart';
import HoroscopeBar from './HoroscopeBar';
import AnalysisPanel from './AnalysisPanel';

interface Props {
  mingzhu: Mingzhu;
  result: CastResult;
  /** 精簡盤（true）／完整盤（false），由左下角「設定」控制 */
  simple: boolean;
}

interface ReportStatus {
  status: 'none' | 'running' | 'done' | 'error';
  done: number;
  total: number;
  error?: string;
}

export default function RightPanel({ mingzhu, result, simple }: Props) {
  const analysis = useMemo(() => buildAnalysis(result), [result]);
  const [tab, setTab] = useState<'chart' | 'yingqi'>('chart');
  const [selDecadalBranch, setSelDecadalBranch] = useState<string | null>(null);
  const [selYear, setSelYear] = useState<number | null>(null);
  const [rs, setRs] = useState<ReportStatus | null>(null); // null＝尚未取得狀態
  const [genErr, setGenErr] = useState<string | null>(null);
  const [pollTick, setPollTick] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const birthYear = Number(result.meta.castDate.split('-')[0]);

  const horoscope = useMemo(() => {
    if (!selDecadalBranch) return null;
    const palace = result.astrolabe.palaces.find((p) => p.earthlyBranch === selDecadalBranch);
    if (!palace) return null;
    const year = selYear ?? birthYear + palace.decadal.range[0] - 1;
    return result.astrolabe.horoscope(`${year}-7-1 12:00`);
  }, [result, selDecadalBranch, selYear, birthYear]);

  /* ── 完整命書狀態輪詢：掛載時查一次，running 時每 5 秒 ── */
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const res = await fetch(`/api/report/${mingzhu.id}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ReportStatus;
        if (stopped) return;
        setRs(data);
        if (data.status === 'running') timer = window.setTimeout(() => void poll(), 5000);
      } catch {
        if (!stopped) timer = window.setTimeout(() => void poll(), 5000);
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [mingzhu.id, pollTick]);

  const generate = async (regen: boolean) => {
    const hint = '約需 15~30 分鐘，背景生成，期間可照常聊天。';
    if (!window.confirm(regen ? `重新產生完整命書？${hint}` : `開始產生完整命書？${hint}`)) return;
    setGenErr(null);
    try {
      const currentYear = new Date().getFullYear();
      const book = buildBookData(result, analysis, currentYear);
      const chapters = buildBookChapters(analysis, book, currentYear);
      const res = await fetch(`/api/report/${mingzhu.id}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: `${mingzhu.name}・完整命書`,
          name: mingzhu.name,
          header: buildReportHeader(analysis, result.meta),
          book,
          chapters,
        }),
      });
      if (res.status !== 202 && res.status !== 409) throw new Error(`HTTP ${res.status}`);
      setRs({ status: 'running', done: 0, total: chapters.length });
      setPollTick((t) => t + 1); // 重啟輪詢
    } catch (e) {
      setGenErr((e as Error).message);
    }
  };

  return (
    <div className="right-panel" ref={panelRef}>
      <div className="rp-tabs">
        <button className={tab === 'chart' ? 'active' : ''} onClick={() => setTab('chart')}>
          命盤
        </button>
        <button className={tab === 'yingqi' ? 'active' : ''} onClick={() => setTab('yingqi')}>
          斷應期
        </button>
        <div className="rp-tabs-right">
          {rs?.status === 'none' && (
            <button className="primary" onClick={() => void generate(false)}>
              <BookOpen size={14} strokeWidth={1.8} /> 產生完整命書
            </button>
          )}
          {rs?.status === 'running' && (
            <button className="primary" disabled>
              <LoaderCircle size={14} strokeWidth={1.8} className="spin" /> 生成中 {rs.done}/{rs.total}
            </button>
          )}
          {rs?.status === 'done' && (
            <>
              <button className="primary" onClick={() => window.open(`/api/report/${mingzhu.id}`)}>
                <BookOpen size={14} strokeWidth={1.8} /> 開啟完整命書
              </button>
              <button className="rc-sub" onClick={() => void generate(true)}>
                重新產生
              </button>
            </>
          )}
          {rs?.status === 'error' && (
            <button className="primary" onClick={() => void generate(false)}>
              生成失敗，重新產生
            </button>
          )}
        </div>
      </div>
      {genErr && <div className="rc-err">{genErr}</div>}
      {rs?.status === 'error' && rs.error && <div className="rc-err">{rs.error}</div>}

      {tab === 'chart' ? (
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
            setTab('chart'); // 跳年份時切回命盤查看
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
