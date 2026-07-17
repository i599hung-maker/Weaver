import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { cast } from './engine/cast';
import type { BirthInput } from './engine/types';
import Sidebar from './components/Sidebar';
import HomeIntro from './components/HomeIntro';
import MingzhuModal from './components/MingzhuModal';
import SettingsModal from './components/SettingsModal';
import ConfirmModal, { type ConfirmRequest } from './components/ConfirmModal';
import ChatPanel from './components/ChatPanel';
import RightPanel from './components/RightPanel';
import {
  deleteMingzhu,
  listMingzhu,
  newId,
  saveMingzhu,
  type Mingzhu,
} from './store/mingzhu';
import { applyTheme, loadSettings, saveSettings, type Settings } from './store/settings';
import './App.css';

/** 星空背景：與命書版型同款（位置／大小／延遲用固定公式，維持 render 穩定） */
const SKY_STARS = Array.from({ length: 46 }, (_, i) => ({
  left: (i * 53) % 100,
  top: (i * 29) % 100,
  size: (i % 3) + 1,
  delay: i % 6,
}));

function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      {SKY_STARS.map((s, i) => (
        <i
          key={i}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 右欄寬（px）記憶：拖分隔線調整（側欄固定寬） */
const WIDTHS_KEY = 'zhanyan-col-widths';

function loadRpWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTHS_KEY);
    if (raw) {
      const rp = (JSON.parse(raw) as { rp?: number }).rp;
      if (typeof rp === 'number') return rp;
    }
  } catch {
    /* ignore */
  }
  return 600;
}

export default function App() {
  const [list, setList] = useState<Mingzhu[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [rightOpen, setRightOpen] = useState(false); // <1100px 時右欄開關
  const [rpWidth, setRpWidth] = useState(loadRpWidth);
  const [chartTab, setChartTab] = useState<'chart' | 'yingqi'>('chart');

  useEffect(() => {
    try {
      localStorage.setItem(WIDTHS_KEY, JSON.stringify({ rp: rpWidth }));
    } catch {
      /* ignore */
    }
  }, [rpWidth]);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const changeSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  /** 拖曳直分隔線調整右欄寬 */
  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = rpWidth;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      setRpWidth(Math.min(Math.max(start - dx, 380), 900));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    listMingzhu()
      .then(setList)
      .catch((e) => setBanner((e as Error).message));
  }, []);

  const mingzhu = list.find((m) => m.id === activeId) ?? null;
  const birth = mingzhu?.birth ?? null;

  const result = useMemo(() => {
    if (!birth) return null;
    try {
      return cast(birth);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [birth]);

  const selectMingzhu = (id: string) => {
    setActiveId(id);
    setActiveConvId(null); // 中欄回到歷史列表視圖
  };

  /** 回首頁：取消命主選取，中欄顯示介紹頁 */
  const goHome = () => {
    setActiveId(null);
    setActiveConvId(null);
  };

  const addMingzhu = async (name: string, b: BirthInput) => {
    const m: Mingzhu = {
      id: newId('m'),
      name,
      birth: b,
      createdAt: new Date().toISOString(),
      conversations: [],
    };
    try {
      await saveMingzhu(m);
      setList((l) => [...l, m]);
      selectMingzhu(m.id);
      setModalOpen(false);
    } catch (e) {
      setBanner((e as Error).message);
    }
  };

  const removeMingzhu = async (id: string) => {
    try {
      await deleteMingzhu(id);
      setList((l) => l.filter((m) => m.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setActiveConvId(null);
      }
    } catch (e) {
      setBanner((e as Error).message);
    }
  };

  const updateMingzhu = (m: Mingzhu) => {
    setList((l) => l.map((x) => (x.id === m.id ? m : x)));
  };

  /** 命主改名：只動 name，生辰資料與 conversations（key 是 id）不受影響 */
  const renameMingzhu = async (id: string, name: string) => {
    const m = list.find((x) => x.id === id);
    if (!m || m.name === name) return;
    const next: Mingzhu = { ...m, name };
    updateMingzhu(next);
    try {
      await saveMingzhu(next);
    } catch (e) {
      updateMingzhu(m); // 存檔失敗還原
      setBanner((e as Error).message);
    }
  };

  /** 側欄的對話刪除（中欄卡片刪除由 ChatPanel 自行處理）：先跳自家確認彈窗 */
  const removeConv = (convId: string) => {
    if (!mingzhu) return;
    setConfirmReq({ text: '刪除此對話？', okLabel: '刪除', onOk: () => void doRemoveConv(convId) });
  };

  const doRemoveConv = async (convId: string) => {
    if (!mingzhu) return;
    const next: Mingzhu = {
      ...mingzhu,
      conversations: mingzhu.conversations.filter((c) => c.id !== convId),
    };
    updateMingzhu(next);
    if (activeConvId === convId) setActiveConvId(null);
    try {
      await saveMingzhu(next);
    } catch (e) {
      setBanner((e as Error).message);
    }
  };

  return (
    <>
      <Sky />
      <div className="layout" style={{ '--rp-w': `${rpWidth}px` } as CSSProperties}>
      <Sidebar
        list={list}
        activeId={activeId}
        activeConvId={activeConvId}
        onSelect={selectMingzhu}
        onAdd={() => setModalOpen(true)}
        onDelete={removeMingzhu}
        onRename={(id, name) => void renameMingzhu(id, name)}
        onSelectConv={setActiveConvId}
        onDeleteConv={removeConv}
        onOpenSettings={() => setSettingsOpen(true)}
        onHome={goHome}
      />

      <main className="main">
        {banner && (
          <div className="banner">
            <span>{banner}</span>
            <button onClick={() => setBanner(null)}>×</button>
          </div>
        )}

        {mingzhu && result ? (
          <ChatPanel
            key={mingzhu.id}
            mingzhu={mingzhu}
            result={result}
            activeConvId={activeConvId}
            chartTab={chartTab}
            onChartTab={setChartTab}
            onSelectConv={setActiveConvId}
            onUpdate={updateMingzhu}
          />
        ) : (
          <HomeIntro onAdd={() => setModalOpen(true)} />
        )}
      </main>

      {/* 首頁模式（未選命主）不顯示右欄：中欄介紹頁佔滿全寬 */}
      {mingzhu && result && (
        <>
          <button className="rp-toggle" onClick={() => setRightOpen((o) => !o)}>
            盤面
          </button>
          <div className="col-resizer rp" onMouseDown={startResize} />
          <div className={`right-col ${rightOpen ? 'open' : ''}`}>
            <RightPanel
              key={mingzhu.id}
              mingzhu={mingzhu}
              result={result}
              simple={settings.chartMode === 'simple'}
              chartTab={chartTab}
              onChartTab={setChartTab}
            />
          </div>
        </>
      )}

      <ConfirmModal req={confirmReq} onClose={() => setConfirmReq(null)} />
      <MingzhuModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={addMingzhu} />
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={changeSettings}
      />
      </div>
    </>
  );
}
