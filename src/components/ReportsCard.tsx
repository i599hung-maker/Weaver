import { useEffect, useState } from 'react';
import { BookOpen, Download, LoaderCircle, Trash2 } from 'lucide-react';
import { saveMingzhu, type Mingzhu, type ReportMeta } from '../store/mingzhu';
import { mergeReports, type BookStatusInfo } from '../store/reportList';

interface Props {
  mingzhu: Mingzhu;
  onUpdate: (m: Mingzhu) => void;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 中欄報告書清單：開啟／輸出 JPG／輸出 PDF／刪除 */
export default function ReportsCard({ mingzhu, onUpdate }: Props) {
  const [bookStatus, setBookStatus] = useState<BookStatusInfo>({ done: false });
  const [busy, setBusy] = useState<string | null>(null); // `${key}:${format}` 或 `${key}:del`
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    void (async () => {
      try {
        const res = await fetch(`/api/report/${mingzhu.id}/status`);
        const s = (await res.json()) as { status: string; updatedAt?: string };
        if (!stop) setBookStatus({ done: s.status === 'done', updatedAt: s.updatedAt });
      } catch {
        /* 靜默：沒有命書就不顯示 */
      }
    })();
    return () => {
      stop = true;
    };
  }, [mingzhu.id, mingzhu.reports]);

  const list = mergeReports(mingzhu, bookStatus);
  if (list.length === 0) return null;

  const exportReport = async (r: ReportMeta, format: 'jpg' | 'pdf') => {
    setBusy(`${r.key}:${format}`);
    setError(null);
    try {
      const res = await fetch(`/api/report/${r.key}/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format }),
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
    if (!window.confirm(`刪除「${r.title}」？報告檔會一併移除。`)) return;
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
      if (r.kind === 'book') setBookStatus({ done: false });
      onUpdate(next);
      await saveMingzhu(next);
    } catch (e) {
      setError(`刪除失敗：${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="reports-card">
      <div className="rc-title">報告書</div>
      {error && <div className="pc-error">{error}</div>}
      {list.map((r) => (
        <div key={r.key} className="report-row">
          <button className="rr-open" onClick={() => window.open(`/api/report/${r.key}`)}>
            <BookOpen size={14} strokeWidth={1.8} />
            <span className="rr-name">{r.title}</span>
            <span className="rr-time">{fmtTime(r.createdAt)}</span>
          </button>
          <span className="rr-actions">
            {(['jpg', 'pdf'] as const).map((f) => (
              <button key={f} disabled={busy !== null} onClick={() => void exportReport(r, f)} title={`輸出 ${f.toUpperCase()}`}>
                {busy === `${r.key}:${f}` ? <LoaderCircle size={13} className="spin" /> : <Download size={13} strokeWidth={1.8} />}
                {f.toUpperCase()}
              </button>
            ))}
            <button className="rr-del" disabled={busy !== null} title="刪除" onClick={() => void remove(r)}>
              {busy === `${r.key}:del` ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} strokeWidth={1.8} />}
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
