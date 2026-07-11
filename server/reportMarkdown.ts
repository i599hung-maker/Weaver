/**
 * 命書報告 Markdown 輸出（server 端，無外部依賴）：
 * - renderReportMarkdown：單題報告（sections 為 AI 產出 markdown 原文，直接串接）
 * - renderBookMarkdown：視覺化命書 v2（章節 JSON 槽位轉可讀 MD；解析失敗放原始文字）
 * 檔頭統一含命主名、生成時間、模型標記（有才列）、命盤 header 摘要。
 * 欄位對照 reportTemplate.ts 各章 render 函式（heroOf／giftSection／topicOf／limsSection／eventsSection／compassSections）。
 */

import type { BookData, BookEvent, ReportHeader, ReportSection } from './reportTemplate.js';

/* ---------- 章節 JSON 容錯取值（與 reportTemplate.ts 同構的小工具） ---------- */

type Dict = Record<string, unknown>;

function asObj(v: unknown): Dict | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** 章節解析失敗或缺欄位時的 fallback：直接放原始文字（與 HTML fallbackBlock 行為一致） */
function fallbackMd(chapter: unknown): string[] {
  const raw = asObj(chapter)?.__fallbackMd;
  const md = typeof raw === 'string' ? raw : JSON.stringify(chapter ?? null, null, 2);
  return [md.trim(), ''];
}

/* ---------- 檔頭（單題與命書共用） ---------- */

/** 檔頭 metadata 行：命主＋生成時間＋模型標記（有才列）＋命盤基本資訊摘要 */
function headLines(name: string, generatedAt: string, h: ReportHeader, modelLabel?: string): string[] {
  const meta = [`命主：${name}`, `生成時間：${generatedAt}`];
  if (modelLabel) meta.push(`模型：${modelLabel}`);
  return [
    meta.join('｜'),
    '',
    `命盤：${h.yinYang}${h.gender}・年干支 ${h.yearGz}・農曆 ${h.lunarDate}・${h.fiveElementsClass}・命主 ${h.soul}・身主 ${h.body}`,
    `時間：鐘錶 ${h.clockDate} ${h.clockTime}・真太陽 ${h.solarDate} ${h.solarTime}`,
    '',
  ];
}

/* ---------- 單題報告 ---------- */

export function renderReportMarkdown(opts: {
  title: string;
  name: string;
  header: ReportHeader;
  sections: ReportSection[];
  generatedAt: string;
  /** 原始提問：檔頭下方引用行（未帶不顯示） */
  question?: string;
  /** 產生模型的顯示字串（前端組好）：metadata 行加註，未帶不顯示 */
  modelLabel?: string;
}): string {
  const out: string[] = [`# ${opts.title}`, ''];
  out.push(...headLines(opts.name, opts.generatedAt, opts.header, opts.modelLabel));
  if (opts.question) out.push(`> 提問：${opts.question}`, '');
  out.push('---', '');
  for (const s of opts.sections) {
    if (s.title) out.push(`## ${s.title}`, '');
    out.push(s.markdown.trim(), '');
  }
  return out.join('\n');
}

/* ---------- 命書各章（槽位 → 標題＋段落＋條列） ---------- */

/** 開卷：雅號＋tri 三卡＋命格定調（對照 heroOf／triHtml） */
function heroMd(ch: unknown): string[] {
  const o = asObj(ch);
  const epithet = str(o?.epithet);
  const thesis = asObj(o?.thesis);
  const tri = arr(o?.tri)
    .map(asObj)
    .filter((x): x is Dict => !!x && !!str(x.k) && !!str(x.g) && !!str(x.v));
  if (!epithet || tri.length !== 3 || !thesis || !str(thesis.title) || !str(thesis.text)) return fallbackMd(ch);
  const out: string[] = [`雅號：${epithet}${str(o?.seal) ? `｜印：${o!.seal as string}` : ''}`, ''];
  for (const t of tri) out.push(`- ${t.k as string}｜${t.g as string}：${t.v as string}`);
  out.push('', `**${thesis.title as string}**`, '', thesis.text as string, '');
  return out;
}

/** 天賦印象：天賦類型＋關鍵詞＋天賦＋閃光點／弱點（對照 giftSection） */
function giftMd(ch: unknown): string[] {
  const o = asObj(ch);
  const gifts = o ? arr(o.gifts).map(asObj).filter((x): x is Dict => !!x && !!str(x.title) && !!str(x.text)) : [];
  if (!o || !str(o.personaTitle) || !str(o.personaText) || gifts.length === 0) return fallbackMd(ch);
  const tags = arr(o.personaTags).filter((x): x is string => typeof x === 'string');
  const words = (v: unknown): string =>
    arr(v)
      .map(asObj)
      .filter((x): x is Dict => !!x && !!str(x.w))
      .map((x) => x.w as string)
      .join('、');
  const out: string[] = [`### 天賦類型：${o.personaTitle as string}`, ''];
  if (tags.length) out.push(tags.map((t) => `\`${t}\``).join(' '), '');
  out.push(o.personaText as string, '');
  const good = words(o.goodWords);
  const bad = words(o.badWords);
  if (good) out.push(`- 優點關鍵詞：${good}`);
  if (bad) out.push(`- 缺點關鍵詞：${bad}`);
  if (good || bad) out.push('');
  for (const g of gifts) out.push(`### ${g.title as string}`, '', g.text as string, '');
  const numbered = (v: unknown, label: string, tipLabel?: string): void => {
    const items = arr(v).map(asObj).filter((x): x is Dict => !!x && !!str(x.title) && !!str(x.text));
    if (items.length === 0) return;
    out.push(`### ${label}`, '');
    items.forEach((x, i) => {
      const tip = tipLabel && str(x.tip) ? `（${tipLabel}：${x.tip as string}）` : '';
      out.push(`${i + 1}. **${x.title as string}**：${x.text as string}${tip}`);
    });
    out.push('');
  };
  numbered(o.flashes, '閃光點');
  numbered(o.weaks, '弱點 · 與練習方法', '練習');
  return out;
}

/** 四主題（性格／事業／金錢／感情）：宮位行＋desc＋優劣勢條列（對照 topicOf／topicSegment） */
function topicMd(title: string, loc: string, ch: unknown): string[] {
  const out: string[] = [`### ${title}`, '', `宮位：${loc}`, ''];
  const o = asObj(ch);
  const pros = o ? arr(o.pros).filter((x): x is string => typeof x === 'string') : [];
  const cons = o ? arr(o.cons).filter((x): x is string => typeof x === 'string') : [];
  if (!o || !str(o.desc) || pros.length === 0 || cons.length === 0) return [...out, ...fallbackMd(ch)];
  out.push(o.desc as string, '', '優勢：', '');
  for (const p of pros) out.push(`- ${p}`);
  out.push('', '劣勢：', '');
  for (const c of cons) out.push(`- ${c}`);
  out.push('');
  return out;
}

/** 大限走勢：依 book.decadals 配 cards（對照 limsSection 的年份換算與標籤） */
function limsMd(book: BookData, ch: unknown): string[] {
  const o = asObj(ch);
  const cards = o ? arr(o.cards).map(asObj).filter((x): x is Dict => !!x && !!str(x.title) && !!str(x.text)) : [];
  if (cards.length === 0) return fallbackMd(ch);
  const out: string[] = [];
  book.decadals.forEach((d, i) => {
    const c = cards[i];
    const startYear = book.meta.birthYear + d.range[0] - 1;
    const endYear = book.meta.birthYear + d.range[1] - 1;
    const label = d.label ? `（${d.label}）` : '';
    out.push(`### ${d.range[0]} – ${d.range[1]} 歲 · ${startYear} – ${endYear}${label}${c ? (c.title as string) : `${d.palaceName}限`}`, '');
    if (c) out.push(c.text as string, '');
  });
  return out;
}

/** 應期 mk 文案：與 reportTemplate.ts 的 eventMark 同規則（災宮引動→原標、雙忌、其餘取首標） */
function eventMarkText(e: BookEvent): string {
  if (e.marks.includes('災宮引動')) return e.marks[0] ?? '災宮引動';
  if (e.weight >= 3 && e.reasons.some((r) => r.includes('忌'))) return '雙忌';
  return e.marks[0] ?? '引動';
}

/** 重點應期：依 book.events 配章節 events（對照 eventsSection 的為什麼／建議鏈） */
function eventsMd(book: BookData, ch: unknown): string[] {
  const o = asObj(ch);
  const items = o ? arr(o.events).map(asObj).filter((x): x is Dict => !!x && typeof x.year === 'number') : [];
  if (items.length === 0) return fallbackMd(ch);
  const byYear = new Map(items.map((x) => [x.year as number, x]));
  const out: string[] = [];
  for (const e of book.events) {
    const c = byYear.get(e.year);
    const mk = eventMarkText(e);
    const title = c && str(c.title) ? (c.title as string) : `${mk}年`;
    out.push(`### ${e.year} ${e.gz} · ${e.age}歲${e.isCurrent ? ' · 今年' : ''}（${mk}）${title}`, '');
    if (c && str(c.desc)) out.push(c.desc as string, '');
    const why = c && str(c.why) ? (c.why as string) : e.reasons.join('；');
    out.push(`- 為什麼：${why}`);
    if (c && str(c.advice)) out.push(`- ${e.isPast ? '回看' : '建議'}：${c.advice as string}`);
    out.push('');
  }
  return out;
}

/** 人生羅盤＋知命改命：go/no＋攻守年曆＋別走路線＋final（對照 compassSections） */
function compassMd(ch: unknown): { compass: string[]; rules: string[] } | null {
  const o = asObj(ch);
  const item = (x: unknown): Dict | null => {
    const d = asObj(x);
    return d && str(d.title) && str(d.text) ? d : null;
  };
  const go = o ? arr(o.go).map(item).filter((x): x is Dict => !!x) : [];
  const no = o ? arr(o.no).map(item).filter((x): x is Dict => !!x) : [];
  if (go.length === 0 || no.length === 0) return null;
  const cal = (x: unknown): Dict | null => {
    const d = asObj(x);
    return d && (typeof d.year === 'number' || str(d.year)) && str(d.text) ? d : null;
  };
  const attack = o ? arr(o.attack).map(cal).filter((x): x is Dict => !!x) : [];
  const defense = o ? arr(o.defense).map(cal).filter((x): x is Dict => !!x) : [];
  const avoid = o
    ? arr(o.avoid)
        .map(asObj)
        .filter((x): x is Dict => !!x && !!str(x.title) && !!str(x.text))
    : [];
  const final = o ? asObj(o.final) : null;

  const li = (x: Dict): string => `- **${x.title as string}**：${x.text as string}${str(x.em) ? `（${x.em as string}）` : ''}`;
  const compass: string[] = ['### 你的優勢在這裡 —— 多往這個方向走', ''];
  for (const x of go) compass.push(li(x));
  compass.push('', '### 這裡容易出問題 —— 提前避開或調整', '');
  for (const x of no) compass.push(li(x));
  compass.push('');

  const rules: string[] = [];
  if (attack.length) {
    rules.push('### 進攻年 —— 多拼，油門踩下去', '');
    for (const x of attack) rules.push(`- **${String(x.year)}**：${x.text as string}`);
    rules.push('');
  }
  if (defense.length) {
    rules.push('### 收斂年 —— 守好，別開新局', '');
    for (const x of defense) rules.push(`- **${String(x.year)}**：${x.text as string}`);
    rules.push('');
  }
  for (const a of avoid) {
    rules.push(`### ${a.title as string}`, '', a.text as string, '');
    if (str(a.instead)) rules.push(`改走這條：${a.instead as string}`, '');
  }
  if (final && str(final.title) && str(final.text)) rules.push(`**${final.title as string}**：${final.text as string}`, '');
  return { compass, rules };
}

/* ---------- 全書組裝 ---------- */

export function renderBookMarkdown(opts: {
  title: string;
  name: string;
  header: ReportHeader;
  book: BookData;
  /** 章節 key → 解析後 JSON 物件；解析失敗為 { __fallbackMd: 原始文字 } */
  chapters: Record<string, unknown>;
  generatedAt: string;
  /** 產生模型的顯示字串（前端組好）：metadata 行加註，未帶不顯示 */
  modelLabel?: string;
}): string {
  const { title, name, header, book, chapters, generatedAt, modelLabel } = opts;
  const m = book.meta;
  const ming = book.cells.find((c) => c.isMing);
  const shen = book.cells.find((c) => c.isShen);
  const mingMajor = ming?.stars.filter((s) => s.kind === 'major').map((s) => s.name) ?? [];

  const out: string[] = [`# ${title}`, ''];
  out.push(...headLines(name, generatedAt, header, modelLabel));
  // 盤面摘要：命宮主星／身宮／生年四化（盤圖本身為視覺內容，MD 只留文字摘要）
  out.push(
    `盤面：${mingMajor.length ? `${mingMajor.join('')}坐命` : '命無主星'}${shen ? `・身在${shen.palaceName}` : ''}・${m.natalMutText}・大限 ${m.startAge} 歲起`,
    '',
    '---',
    '',
  );

  out.push('## 開卷', '', ...heroMd(chapters.hero));
  out.push('## 天賦印象', '', ...giftMd(chapters.gift));

  out.push('## 命盤 · 十二宮', '');
  out.push(...topicMd('性格', book.topicLocs.benming, chapters.topic_benming));
  out.push(...topicMd('事業', book.topicLocs.shiye, chapters.topic_shiye));
  out.push(...topicMd('金錢', book.topicLocs.caiyun, chapters.topic_caiyun));
  out.push(...topicMd('感情 · 姻緣', book.topicLocs.aiqing, chapters.topic_aiqing));

  out.push('## 大限走勢', '', ...limsMd(book, chapters.lims));
  out.push('## 重點應期', '', ...eventsMd(book, chapters.events));

  const cp = compassMd(chapters.compass);
  if (cp) {
    out.push('## 人生羅盤', '', ...cp.compass);
    out.push('## 知命改命', '', ...cp.rules);
  } else {
    out.push('## 人生羅盤', '', ...fallbackMd(chapters.compass));
  }

  out.push('---', '', `${m.notes}`, '盤面與應期由 LifePath 占驗引擎規則推算（流命引動法 · 疊星引動法）· 內容供自我參考，不是命定的判決', '');
  return out.join('\n');
}
