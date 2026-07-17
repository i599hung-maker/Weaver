import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, LoaderCircle, Trash2 } from 'lucide-react';
import type { CastResult } from '../engine/cast';
import { saveMingzhu, type Mingzhu, type ReportMeta } from '../store/mingzhu';
import { bookTitle, mergeReports, upsertReport, type BookStatusInfo } from '../store/reportList';
import { aiRequestParams, loadSettings } from '../store/settings';
import { aiModelLabel } from '../ai/providers';
import { buildAnalysis } from '../analysis/analysis';
import { buildReportHeader } from '../analysis/reportPrompts';
import { buildBookChapters, buildBookData, buildBookSteps, type BookStep } from '../analysis/reportBook';
import ConfirmModal, { type ConfirmRequest } from './ConfirmModal';

interface Props {
  mingzhu: Mingzhu;
  result: CastResult;
  onUpdate: (m: Mingzhu) => void;
}

interface ReportStatus {
  status: 'none' | 'running' | 'done' | 'error';
  done: number;
  total: number;
  error?: string;
  retrying?: boolean;
  updatedAt?: string;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 生成中九章輪播：目前章＝rs.done（伺服器每完成一章寫 done），每句 5 秒輪，停在末句慢閃 */
function GenCarousel({ chapters, rs }: { chapters: BookStep[]; rs: ReportStatus }) {
  const idx = Math.min(rs.done, chapters.length - 1);
  const ch = chapters[idx];
  const [stepI, setStepI] = useState(0);

  useEffect(() => {
    setStepI(0); // 換章歸零
  }, [idx]);

  useEffect(() => {
    if (stepI >= ch.steps.length - 1) return; // 停在末句慢閃
    const t = window.setTimeout(() => setStepI((i) => i + 1), 5000);
    return () => window.clearTimeout(t);
  }, [stepI, ch.steps.length, idx]);

  const holding = stepI >= ch.steps.length - 1;
  const line = rs.retrying
    ? `《${ch.title}》回應逾時，自動重試中…`
    : ch.steps[Math.min(stepI, ch.steps.length - 1)];

  return (
    <div className="book-gen">
      <div className="bg-prog">
        <LoaderCircle size={13} strokeWidth={1.8} className="spin" /> 生成中 {idx + 1}/{chapters.length}・{ch.title}
      </div>
      <div className={`bg-line ${holding || rs.retrying ? 'blink' : ''}`}>{line}</div>
    </div>
  );
}

/** 中欄報告書：未產生顯示大按鈕、生成中九章輪播、完成列清單，並負責產生／重新產生 */
export default function ReportsCard({ mingzhu, result, onUpdate }: Props) {
  const analysis = useMemo(() => buildAnalysis(result), [result]);
  const [rs, setRs] = useState<ReportStatus | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // `${key}:${format}` 或 `${key}:del`
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [pollTick, setPollTick] = useState(0);

  /** 最新命書 key：reports 中 kind==='book' 最新一筆；無紀錄退回舊 key（命主 id，相容既有命書） */
  const bookKey = useMemo(() => {
    const books = (mingzhu.reports ?? []).filter((r) => r.kind === 'book');
    if (books.length === 0) return mingzhu.id;
    return books.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b)).key;
  }, [mingzhu.reports, mingzhu.id]);

  /* 命書狀態輪詢：掛載查一次，running 時每 5 秒 */
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const res = await fetch(`/api/report/${bookKey}/status`);
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
  }, [bookKey, pollTick]);

  /** 輪播步驟：現成 book 資料組字串（跟著命主/盤面變） */
  const bookSteps = useMemo(
    () => buildBookSteps(analysis, buildBookData(result, analysis, new Date().getFullYear())),
    [analysis, result],
  );

  const generate = (regen: boolean) => {
    const hint = '約需 15~30 分鐘，背景生成，期間可照常聊天。';
    setConfirm({
      text: regen ? `重新產生完整命書？${hint}` : `開始產生完整命書？${hint}`,
      okLabel: '開始產生',
      onOk: () => void doGenerate(),
    });
  };

  const doGenerate = async () => {
    setGenErr(null);
    try {
      const currentYear = new Date().getFullYear();
      const reportStyle = loadSettings().reportStyle;
      const book = buildBookData(result, analysis, currentYear);
      const chapters = buildBookChapters(analysis, book, currentYear, mingzhu.profile, reportStyle);
      // 每次產生用新 key（舊版保留可比較）；例外：上次 error 沿用原 key，伺服器才找得到 chapters.json 續跑
      const key =
        rs?.status === 'error' ? bookKey : `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const ai = aiRequestParams();
      const res = await fetch(`/api/report/${key}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: `${mingzhu.name}・完整命書`,
          name: mingzhu.name,
          header: buildReportHeader(analysis, result.meta),
          book,
          chapters,
          ...ai,
          modelLabel: aiModelLabel(ai.provider, ai.model) ?? undefined,
        }),
      });
      if (res.status !== 202 && res.status !== 409) throw new Error(`HTTP ${res.status}`);
      const next = upsertReport(mingzhu, {
        key,
        title: bookTitle(mingzhu.name, reportStyle),
        kind: 'book',
        createdAt: new Date().toISOString(),
        provider: ai.provider,
        model: ai.model,
      });
      onUpdate(next);
      void saveMingzhu(next);
      setRs({ status: 'running', done: 0, total: chapters.length });
      setPollTick((t) => t + 1); // 重啟輪詢
    } catch (e) {
      setGenErr((e as Error).message);
    }
  };

  // book.done 只用來推導「舊制命書（key＝命主 id）」那一列；bookKey 落回 mingzhu.id 時才成立。
  // 若 bookKey 是新制 b_ key，命書已在 reports 有 ReportMeta，不需推導，否則會生出開不了(404)的幽靈列。
  const bookStatus: BookStatusInfo = { done: rs?.status === 'done' && bookKey === mingzhu.id, updatedAt: rs?.updatedAt };
  // 生成中／失敗的命書尚無報告頁（開啟會 404），清單先不列，避免誤觸；ReportMeta 紀錄保留
  //（輪詢 key 與續跑都靠它），完成後輪詢轉 done 該列自然出現
  const list = mergeReports(mingzhu, bookStatus).filter(
    (r) => !(r.key === bookKey && (rs?.status === 'running' || rs?.status === 'error')),
  );

  const exportReport = async (r: ReportMeta, format: 'jpg' | 'pdf' | 'md') => {
    setBusy(`${r.key}:${format}`);
    setError(null);
    try {
      let theme: string | null = null;
      try {
        theme = localStorage.getItem('zhanyan-report-theme') ?? loadSettings().theme;
      } catch {
        /* ignore */
      }
      const res = await fetch(`/api/report/${r.key}/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format, theme }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${r.title} ${r.createdAt.slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(`輸出失敗：${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: ReportMeta) => {
    setBusy(`${r.key}:del`);
    setError(null);
    try {
      const res = await fetch(`/api/report/${r.key}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let next: Mingzhu = { ...mingzhu, reports: (mingzhu.reports ?? []).filter((x) => x.key !== r.key) };
      if (r.kind === 'question') {
        next = {
          ...next,
          conversations: next.conversations.map((c) => ({
            ...c,
            messages: c.messages.map((msg) =>
              msg.reportKey === r.key ? { ...msg, mode: 'chat' as const, reportKey: undefined } : msg,
            ),
          })),
        };
      }
      onUpdate(next);
      await saveMingzhu(next);
      if (r.kind === 'book') setPollTick((t) => t + 1); // 刪命書後重讀狀態，大按鈕才會回來
    } catch (e) {
      setError(`刪除失敗：${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="reports-card">
      <div className="rc-title">報告書</div>
      {genErr && <div className="rc-err">{genErr}</div>}

      {rs?.status === 'none' && (
        <button className="book-gen-big" onClick={() => generate(false)}>
          <BookOpen size={18} strokeWidth={1.8} />
          <span>產生完整命書</span>
          <small>約需 15~30 分鐘，背景生成</small>
        </button>
      )}
      {rs?.status === 'running' && <GenCarousel chapters={bookSteps} rs={rs} />}
      {rs?.status === 'error' && (
        <>
          {rs.error && <div className="rc-err">{rs.error}</div>}
          <button className="book-gen-big" onClick={() => generate(false)}>
            <BookOpen size={18} strokeWidth={1.8} />
            <span>生成失敗，重新產生</span>
          </button>
        </>
      )}

      {error && <div className="pc-error">{error}</div>}
      {list.map((r) => {
        const model = aiModelLabel(r.provider, r.model);
        return (
          <div key={r.key} className="report-row">
            <button className="rr-open" onClick={() => window.open(`/api/report/${r.key}`)}>
              <BookOpen size={14} strokeWidth={1.8} />
              <span className="rr-name">{r.title}</span>
              <span className="rr-time">
                {fmtTime(r.createdAt)}
                {model ? `・${model}` : ''}
              </span>
            </button>
            <span className="rr-actions">
              {(['jpg', 'pdf', 'md'] as const).map((f) => (
                <button
                  key={f}
                  disabled={busy !== null}
                  onClick={() => void exportReport(r, f)}
                  title={`輸出 ${f.toUpperCase()}`}
                >
                  {busy === `${r.key}:${f}` ? (
                    <LoaderCircle size={13} className="spin" />
                  ) : (
                    <Download size={13} strokeWidth={1.8} />
                  )}
                  {f.toUpperCase()}
                </button>
              ))}
              <button
                className="rr-del"
                disabled={busy !== null}
                title="刪除"
                onClick={() =>
                  setConfirm({
                    text: `刪除「${r.title}」？報告檔會一併移除。`,
                    okLabel: '刪除',
                    onOk: () => void remove(r),
                  })
                }
              >
                {busy === `${r.key}:del` ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} strokeWidth={1.8} />}
              </button>
            </span>
          </div>
        );
      })}

      {rs?.status === 'done' && (
        <button className="rc-sub" onClick={() => generate(true)}>
          重新產生完整命書
        </button>
      )}

      <ConfirmModal req={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
