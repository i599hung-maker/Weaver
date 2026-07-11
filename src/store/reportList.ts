import type { Mingzhu, ReportMeta } from './mingzhu';

/** 報告書清單邏輯：命名、記錄 upsert、與舊資料（無紀錄的命書／單題）合併推導 */

export function bookTitle(style: 'plain' | 'classic'): string {
  return style === 'plain' ? '完整命書・白話風' : '完整命書・命理風';
}

export function questionTitle(question: string): string {
  const t = question.trim().slice(0, 20);
  return t || '單題報告';
}

/** 同 key 覆寫（命書重生成更新標題與時間），否則附加 */
export function upsertReport(m: Mingzhu, meta: ReportMeta): Mingzhu {
  const rest = (m.reports ?? []).filter((r) => r.key !== meta.key);
  return { ...m, reports: [...rest, meta] };
}

export interface BookStatusInfo {
  done: boolean;
  updatedAt?: string;
}

/** 已記錄＋舊資料推導合併，createdAt 新到舊 */
export function mergeReports(m: Mingzhu, book: BookStatusInfo): ReportMeta[] {
  const recorded = m.reports ?? [];
  const keys = new Set(recorded.map((r) => r.key));
  const derived: ReportMeta[] = [];

  if (book.done && !keys.has(m.id)) {
    derived.push({ key: m.id, title: '完整命書', kind: 'book', createdAt: book.updatedAt ?? m.createdAt });
  }
  for (const conv of m.conversations) {
    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i];
      if (msg.role !== 'assistant' || !msg.reportKey || keys.has(msg.reportKey)) continue;
      const prev = conv.messages
        .slice(0, i)
        .reverse()
        .find((x) => x.role === 'user');
      derived.push({ key: msg.reportKey, title: questionTitle(prev?.text ?? ''), kind: 'question', createdAt: msg.ts });
    }
  }
  return [...recorded, ...derived].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
