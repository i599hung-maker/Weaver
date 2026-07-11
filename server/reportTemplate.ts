/**
 * 命書報告 HTML 版型（server 端，無外部依賴）：
 * - 深色底＋金色點綴，hero 大標＋命主資訊格，逐章排版，印刷友善
 * - 內建小型 markdown → HTML 轉換器（含 HTML escape 防注入）
 * ReportHeader 與 src/analysis/reportPrompts.ts 的同名介面同構（server 端獨立定義，避免跨 tsconfig 引用）。
 */

export interface ReportHeader {
  gender: string;
  yinYang: string;
  yearGz: string;
  lunarDate: string;
  fiveElementsClass: string;
  soul: string;
  body: string;
  clockDate: string;
  clockTime: string;
  solarDate: string;
  solarTime: string;
}

export interface ReportSection {
  title: string;
  markdown: string;
}

/* ---------- markdown → HTML ---------- */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 行內語法：先 escape，再處理 `code` 與 **粗體** */
function inlineMd(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return t;
}

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function isHr(line: string): boolean {
  return /^\s*-{3,}\s*$/.test(line);
}

function isBlockStart(line: string): boolean {
  return (
    /^#{1,4}\s/.test(line) ||
    /^\s*>\s?/.test(line) ||
    line.trimStart().startsWith('|') ||
    isHr(line) ||
    LIST_RE.test(line)
  );
}

function splitRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function renderTable(rows: string[]): string {
  const parsed = rows.map(splitRow);
  let header: string[] | null = null;
  let body = parsed;
  if (parsed.length >= 2 && parsed[1].length > 0 && parsed[1].every((c) => /^:?-+:?$/.test(c))) {
    header = parsed[0];
    body = parsed.slice(2);
  }
  const out: string[] = ['<div class="table-wrap"><table>'];
  if (header) {
    out.push('<thead><tr>' + header.map((c) => `<th>${inlineMd(c)}</th>`).join('') + '</tr></thead>');
  }
  out.push('<tbody>' + body.map((r) => '<tr>' + r.map((c) => `<td>${inlineMd(c)}</td>`).join('') + '</tr>').join('') + '</tbody>');
  out.push('</table></div>');
  return out.join('');
}

/** 清單（- / 1.，支援縮排巢狀一層） */
function renderList(blockLines: string[]): string {
  const items = blockLines.map((l) => {
    const m = LIST_RE.exec(l)!;
    return { indent: m[1].length, ordered: /^\d/.test(m[2]), text: m[3] };
  });
  const topTag = items[0].ordered ? 'ol' : 'ul';
  const out: string[] = [`<${topTag}>`];
  let liOpen = false;
  let subTag: 'ul' | 'ol' | null = null;
  const closeSub = () => {
    if (subTag) {
      out.push(`</${subTag}>`);
      subTag = null;
    }
  };
  const closeLi = () => {
    closeSub();
    if (liOpen) {
      out.push('</li>');
      liOpen = false;
    }
  };
  for (const it of items) {
    if (it.indent >= 2 && liOpen) {
      if (!subTag) {
        subTag = it.ordered ? 'ol' : 'ul';
        out.push(`<${subTag}>`);
      }
      out.push(`<li>${inlineMd(it.text)}</li>`);
    } else {
      closeLi();
      out.push(`<li>${inlineMd(it.text)}`);
      liOpen = true;
    }
  }
  closeLi();
  out.push(`</${topTag}>`);
  return out.join('');
}

/** 小型 markdown 轉換器：#~####、**粗體**、清單（巢狀一層）、表格、引用、`code`、---、段落 */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (isHr(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lv = h[1].length;
      out.push(`<h${lv}>${inlineMd(h[2].trim())}</h${lv}>`);
      i++;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(inlineMd(lines[i].replace(/^\s*>\s?/, '')));
        i++;
      }
      out.push(`<blockquote><p>${quote.join('<br>')}</p></blockquote>`);
      continue;
    }
    if (line.trimStart().startsWith('|')) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        tbl.push(lines[i]);
        i++;
      }
      out.push(renderTable(tbl));
      continue;
    }
    if (LIST_RE.test(line)) {
      const block: string[] = [];
      while (i < lines.length && LIST_RE.test(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      out.push(renderList(block));
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${para.map(inlineMd).join('<br>')}</p>`);
  }
  return out.join('\n');
}

/* ---------- 報告版型 ---------- */

const CSS = `
  .page { position: relative; z-index: 1; max-width: 860px; margin: 0 auto; padding: 24px 28px 64px; }
  /* hero：命書同語彙（宋體 900 金字＋金色細線） */
  .hero { text-align: center; padding: 56px 16px 40px; border-bottom: 1px solid var(--line); }
  .hero .eyebrow { font-family: var(--serif); letter-spacing: .55em; font-size: 14px; color: var(--gold); text-indent: .55em; margin-bottom: 14px; }
  .hero .title {
    font-family: var(--serif);
    font-weight: 900;
    font-size: clamp(28px, 5vw, 44px);
    line-height: 1.4;
    letter-spacing: .08em;
    color: var(--gold-br);
    text-shadow: 0 0 28px rgba(201, 162, 75, .3);
  }
  .hero .question { margin: 14px auto 0; max-width: 620px; font-size: 14px; color: var(--silk-dim); line-height: 1.9; }
  .hero .question b { color: var(--gold); font-weight: 400; font-family: var(--serif); margin-right: 8px; letter-spacing: .2em; }
  .hero .name { margin-top: 16px; font-family: var(--serif); font-size: 19px; letter-spacing: .3em; color: var(--silk); }
  .hero .name::before, .hero .name::after { content: "・"; color: var(--gold); }
  .hero-rule { width: 120px; height: 2px; margin: 24px auto 0; background: linear-gradient(90deg, transparent, var(--gold), transparent); }
  /* header info grid */
  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin: 32px 0 8px;
  }
  .meta .cell { background: var(--card); border: 1px solid var(--line); border-radius: 4px; padding: 10px 14px; }
  .meta .k { font-size: 12px; letter-spacing: 0.2em; color: var(--gold); font-family: var(--serif); }
  .meta .v { margin-top: 2px; font-size: 15px; color: var(--silk); }
  /* sections */
  .section { margin-top: 56px; }
  .section > .chapter {
    font-family: var(--serif);
    font-weight: 900;
    font-size: 26px;
    letter-spacing: 0.1em;
    color: var(--gold-br);
    padding-left: 14px;
    border-left: 3px solid var(--gold);
    margin-bottom: 20px;
  }
  .section .body { font-size: 15.5px; }
  .section .body h1, .section .body h2, .section .body h3, .section .body h4 {
    font-family: var(--serif);
    color: var(--gold-br);
    letter-spacing: 0.06em;
    margin: 26px 0 10px;
    line-height: 1.5;
  }
  .section .body h1 { font-size: 23px; font-weight: 900; }
  .section .body h2 { font-size: 20px; font-weight: 900; }
  .section .body h3 { font-size: 17.5px; font-weight: 700; }
  .section .body h4 { font-size: 16px; font-weight: 700; }
  .section .body p { margin: 12px 0; }
  .section .body ul, .section .body ol { margin: 12px 0 12px 1.6em; }
  .section .body li { margin: 4px 0; }
  .section .body li > ul, .section .body li > ol { margin: 4px 0 4px 1.4em; }
  .section .body strong { color: var(--gold-br); }
  .section .body code {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.9em;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 1px 6px;
    color: var(--gold-br);
  }
  .section .body blockquote {
    border-left: 3px solid var(--gold);
    background: var(--card);
    padding: 10px 16px;
    margin: 14px 0;
    color: var(--silk-dim);
  }
  .section .body blockquote p { margin: 0; }
  .section .body hr { border: 0; height: 1px; background: var(--line); margin: 26px 0; }
  .table-wrap { overflow-x: auto; margin: 14px 0; }
  .section .body table { border-collapse: collapse; width: 100%; font-size: 14.5px; }
  .section .body th, .section .body td { border: 1px solid var(--line); padding: 8px 12px; text-align: left; }
  .section .body th { color: var(--gold); background: var(--card); letter-spacing: 0.08em; white-space: nowrap; font-family: var(--serif); }
  /* footer */
  .footer {
    margin-top: 64px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
    text-align: center;
    font-size: 12px;
    color: var(--silk-dim);
    letter-spacing: 0.1em;
  }
  /* print */
  @media print {
    body { background: #fff !important; color: #1c1710; font-size: 12.5px; }
    .page { max-width: none; padding: 0; }
    .hero .title { color: #7a5c1e; text-shadow: none; }
    .hero .name, .meta .v { color: #1c1710; }
    .hero .question { color: #4a4232; }
    .meta .cell, .section .body code, .section .body blockquote, .section .body th { background: #fff; }
    .meta .cell, .section .body th, .section .body td, .section .body code { border-color: #c9b98f; }
    .meta .k, .section > .chapter, .section .body h1, .section .body h2, .section .body h3, .section .body h4,
    .section .body strong, .section .body th, .section .body code { color: #7a5c1e; }
    .section .body blockquote { color: #4a4232; border-left-color: #7a5c1e; }
    .section { break-inside: auto; }
    .section > .chapter { break-after: avoid; }
    .table-wrap { overflow-x: visible; }
  }
`;

/* ======================================================================
 * 視覺化命書 v2（book）：版型移植自 reports/huang-1994-full.html
 * BookData 與 src/analysis/reportBook.ts 同構（server 端獨立定義，避免跨 tsconfig）。
 * ==================================================================== */

export interface BookStar {
  name: string;
  brightness?: string;
  mutagen?: string;
  kind: 'major' | 'minor' | 'adj';
}

export interface BookCell {
  branch: string;
  gz: string;
  palaceName: string;
  lim: string;
  isMing: boolean;
  isShen: boolean;
  stars: BookStar[];
}

export interface BookDecadal {
  range: [number, number];
  gz: string;
  palaceName: string;
  label: '現行' | '將行' | '高峰' | '';
  isCurrent: boolean;
}

export interface BookEvent {
  year: number;
  gz: string;
  age: number;
  isCurrent: boolean;
  isPast: boolean;
  marks: string[];
  weight: number;
  reasons: string[];
}

export type BookTopicKey = 'benming' | 'shiye' | 'caiyun' | 'aiqing';

export interface BookData {
  meta: {
    fiveElementsClass: string;
    soul: string;
    body: string;
    ziDou: string;
    natalMutText: string;
    startAge: number;
    birthYear: number;
    notes: string;
  };
  cells: BookCell[];
  decadals: BookDecadal[];
  events: BookEvent[];
  topicLocs: Record<BookTopicKey, string>;
}

/* ---------- 章節 JSON 容錯取值 ---------- */

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

/** 文字插值：escape 後把 **x** 轉 <b>x</b>（Claude 章節值唯一允許的行內語法） */
function slot(v: unknown): string {
  return escapeHtml(String(v ?? '')).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

/** 章節解析失敗或缺欄位時的 fallback 區塊 */
function fallbackBlock(title: string, chapter: unknown): string {
  const raw = asObj(chapter)?.__fallbackMd;
  const md = typeof raw === 'string' ? raw : JSON.stringify(chapter ?? null, null, 2);
  return `<div class="sys"><div class="syshead"><h2>${escapeHtml(title)}</h2></div><div class="read in">${markdownToHtml(md)}</div></div>`;
}

/* ---------- 版型 CSS／script（版型源自 huang-1994-full.html；配色 token 命書與單題報告共用） ---------- */

/** 共用主題層：色票 token（星空紫／藕紫／灰黑）＋星空底＋右上角切換器 */
const THEME_CSS = `
  :root{
    --ink:#17101f; --ink-2:#1e1530; --ink-3:#281c3e;
    --gold:#c9a24b; --gold-br:#e7cb84;
    --cinnabar:#d24b3b; --jade:#6fae93; --azure:#6f9fd0;
    --silk:#ece3d2; --silk-dim:#9f937f;
    --line:rgba(201,162,75,.22);
    /* 配色 token：預設紫色（命書墨紫），可切藕紫／灰黑 */
    --veil-a:#2a1c44; --veil-b:#25183a;
    --card:rgba(30,21,48,.5); --card-2:rgba(40,28,62,.4);
    --ming-a:#33244e; --ming-b:#241734; --core-g:#2c1d49;
    --serif:"Noto Serif TC",serif; --sans:"Noto Sans TC",sans-serif; --brush:"Noto Serif TC",serif; /* 手寫體繁中缺字會掉字，改用宋體 */
  }
  :root[data-theme='gray']{
    --ink:#131314; --ink-2:#1c1c1f; --ink-3:#232327;
    --veil-a:#202023; --veil-b:#1b1b1e;
    --card:rgba(28,28,31,.55); --card-2:rgba(35,35,39,.45);
    --ming-a:#2a2a2e; --ming-b:#1c1c1f; --core-g:#232327;
  }
  :root[data-theme='mauve']{
    --ink:#332b36; --ink-2:#3d3441; --ink-3:#463c4a;
    --veil-a:#4a3a50; --veil-b:#413347;
    --card:rgba(61,52,65,.55); --card-2:rgba(70,60,74,.45);
    --ming-a:#4f4454; --ming-b:#3d3441; --core-g:#463c4a;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{
    background:
      radial-gradient(1200px 800px at 50% -10%, var(--veil-a) 0%, transparent 55%),
      radial-gradient(900px 700px at 85% 18%, var(--veil-b) 0%, transparent 60%),
      var(--ink);
    color:var(--silk); font-family:var(--sans); line-height:1.9; letter-spacing:.02em;
    -webkit-font-smoothing:antialiased; overflow-x:hidden;
  }
  .sky{position:fixed; inset:0; z-index:0; pointer-events:none}
  .sky i{position:absolute; border-radius:50%; background:var(--gold-br); opacity:0; animation:tw 6s infinite ease-in-out}
  @keyframes tw{0%,100%{opacity:0}50%{opacity:.7}}
  /* 右上角配色切換＋下載：列印時隱藏 */
  .theme-pick{position:fixed; top:14px; right:14px; z-index:9; display:flex; gap:8px; padding:7px 10px;
    border:1px solid var(--line); border-radius:20px; background:var(--card); backdrop-filter:blur(6px)}
  .theme-pick button{width:18px; height:18px; border-radius:50%; padding:0; cursor:pointer;
    border:1px solid rgba(236,227,210,.35)}
  .theme-pick button.on{box-shadow:0 0 0 2px var(--gold)}
  .theme-pick .t-purple{background:#1e1530}
  .theme-pick .t-mauve{background:#3d3441}
  .theme-pick .t-gray{background:#1c1c1f}
  .theme-pick .tp-sep{width:1px; align-self:stretch; background:var(--line); margin:0 2px}
  .theme-pick .tp-dl{width:auto; height:18px; border-radius:9px; padding:0 8px; font-size:11px; line-height:1;
    font-family:var(--sans); color:var(--silk); background:transparent; border:1px solid var(--line); cursor:pointer}
  .theme-pick .tp-dl:hover{border-color:var(--gold); color:var(--gold-br)}
  .theme-pick .tp-dl:disabled{opacity:.5; cursor:default}
  @media print{ .theme-pick{display:none} .sky{display:none} }
`;

const BOOK_CSS = `
  .wrap{position:relative; z-index:1; max-width:940px; margin:0 auto; padding:0 22px}

  /* ---------- hero ---------- */
  header{padding:72px 0 18px; text-align:center}
  .eyebrow{font-family:var(--serif); letter-spacing:.55em; font-size:15px; color:var(--gold); text-indent:.55em}
  .title{font-family:var(--serif); font-weight:900; font-size:clamp(56px,11vw,104px); line-height:1.15; color:var(--gold-br);
    letter-spacing:.08em; margin:14px 0 8px; text-shadow:0 0 34px rgba(201,162,75,.32)}
  .sub{font-family:var(--serif); color:var(--silk-dim); font-size:17px; letter-spacing:.16em}
  .sub b{color:var(--silk); font-weight:600}
  .note{font-size:12px; color:var(--silk-dim); letter-spacing:.06em; margin-top:8px; opacity:.8}

  .tri{display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin:34px 0 8px}
  .tri a{display:block; text-decoration:none; color:inherit; padding:20px 16px; text-align:center;
    border:1px solid var(--line); background:var(--card); border-radius:4px; transition:.3s}
  .tri a:hover{border-color:var(--gold); transform:translateY(-3px)}
  .tri .k{font-family:var(--serif); font-size:12px; letter-spacing:.3em; color:var(--gold); margin-bottom:10px; display:block}
  .tri .v{font-family:var(--serif); font-weight:600; font-size:clamp(16px,2.6vw,20px); color:var(--silk); line-height:1.6}
  .tri .g{font-size:clamp(23px,4.4vw,30px); color:var(--gold-br); letter-spacing:.1em; display:block; margin-bottom:4px}

  /* ---------- system header ---------- */
  .sys{margin:72px 0 0; padding-top:30px; border-top:1px solid var(--line)}
  .syshead{text-align:center; margin-bottom:8px}
  .syshead .idx{font-family:var(--serif); font-size:12px; letter-spacing:.4em; color:var(--gold)}
  .syshead h2{font-family:var(--serif); font-weight:900; font-size:clamp(30px,5.5vw,44px);
    color:var(--gold-br); letter-spacing:.1em; margin:6px 0 4px}
  .syshead .en{font-size:12px; letter-spacing:.34em; color:var(--silk-dim); text-transform:uppercase}

  /* ---------- 命盤方圖 ---------- */
  .board{display:grid; grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(4,1fr);
    gap:1px; background:var(--line); border:1px solid var(--line); margin:30px 0 8px; aspect-ratio:1/1;
    box-shadow:0 30px 80px -40px rgba(0,0,0,.9), inset 0 0 60px rgba(201,162,75,.04)}
  .cell{background:linear-gradient(180deg,var(--ink-2),var(--ink)); padding:8px 9px 6px; position:relative; overflow:hidden}
  .stars{display:flex; flex-direction:row; gap:5px; align-items:flex-start; max-height:calc(100% - 18px)}
  .star{writing-mode:vertical-rl; text-orientation:upright; font-family:var(--serif); line-height:1.2; white-space:nowrap}
  .star.maj{font-size:clamp(14px,2.5vw,19px); font-weight:600; color:var(--silk); letter-spacing:.04em}
  .star.min{font-size:14px; color:var(--silk-dim)}
  .star.adj{font-size:12px; color:var(--silk-dim); opacity:.72}
  .star .br{font-size:.62em; opacity:.85}
  .foot{position:absolute; right:9px; bottom:7px; display:flex; align-items:flex-end; gap:6px}
  .lim{position:absolute; left:9px; bottom:7px; font-size:11px; color:var(--silk-dim); letter-spacing:.04em}
  .gname{font-family:var(--serif); font-size:15px; color:var(--gold); letter-spacing:.1em}
  .gz{writing-mode:vertical-rl; text-orientation:upright; font-size:14px; color:var(--silk-dim); line-height:1.08}
  .hua{writing-mode:horizontal-tb; display:inline-block; font-size:11px; line-height:1.45; padding:0 4px; border-radius:2px;
    font-family:var(--serif); letter-spacing:.03em; margin-top:2px}
  .lu{color:#0f1a15;background:var(--jade)} .quan{color:#1a1305;background:var(--gold)}
  .ke{color:var(--gold-br);border:1px solid var(--gold)} .ji{color:#1a0606;background:var(--cinnabar)}
  .ming{background:linear-gradient(180deg,var(--ming-a),var(--ming-b));
    box-shadow:inset 0 0 0 1px var(--gold), inset 0 0 28px rgba(201,162,75,.16); animation:glow 5.5s ease-in-out infinite}
  @keyframes glow{0%,100%{box-shadow:inset 0 0 0 1px var(--gold),inset 0 0 22px rgba(201,162,75,.10)}
    50%{box-shadow:inset 0 0 0 1px var(--gold-br),inset 0 0 40px rgba(201,162,75,.26)}}
  .tag{position:absolute; top:0; right:0; font-family:var(--serif); font-size:12px; letter-spacing:.1em; padding:1px 6px}
  .tag.cm{color:#1a1305; background:var(--gold)}
  .tag.ly{color:var(--cinnabar); border-left:1px solid var(--cinnabar); border-bottom:1px solid var(--cinnabar)}
  .core{grid-column:2/4; grid-row:2/4; background:radial-gradient(circle at 50% 38%, var(--core-g) 0%, var(--ink) 72%);
    display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:14px; gap:7px}
  .core .seal{font-family:var(--brush); font-weight:900; font-size:clamp(30px,6.6vw,50px); letter-spacing:.04em; color:var(--gold-br); line-height:1.1; text-shadow:0 0 26px rgba(201,162,75,.3)}
  .core dl{font-size:12px; color:var(--silk-dim); letter-spacing:.08em; line-height:1.9}
  .core dl b{color:var(--silk); font-family:var(--serif); font-weight:600}
  .legend{display:flex; flex-wrap:wrap; justify-content:center; gap:6px 16px; font-size:12px; color:var(--silk-dim); margin:14px 0 0}
  .legend span{display:inline-flex; align-items:center; gap:6px}
  .dot{width:9px;height:9px;border-radius:2px;display:inline-block}

  /* ---------- reading blocks ---------- */
  .read{margin:30px 0 0; opacity:0; transform:translateY(24px); transition:opacity .9s ease, transform .9s ease}
  .read.in{opacity:1; transform:none}
  .desc{font-size:18px; color:var(--silk); margin:0 0 22px}
  .desc b{color:var(--gold-br); font-weight:600; font-family:var(--serif)}
  .desc .warn{color:var(--cinnabar); font-weight:600}
  .subhd{display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; margin:38px 0 16px;
    border-bottom:1px solid var(--line); padding-bottom:12px}
  .glyph{font-family:var(--brush); font-weight:900; font-size:42px; color:var(--gold-br); line-height:1}
  .subhd .topic{font-family:var(--serif); font-weight:900; font-size:27px; color:var(--silk); letter-spacing:.08em}
  .subhd .loc{font-size:12px; color:var(--gold); letter-spacing:.13em}
  .duo{display:grid; grid-template-columns:1fr 1fr; gap:18px}
  .col{padding:18px 20px; border:1px solid var(--line); border-radius:3px; background:var(--card)}
  .col h3{font-family:var(--serif); font-size:18px; letter-spacing:.2em; margin-bottom:12px; display:flex; align-items:center; gap:9px}
  .col.pro h3{color:var(--jade)} .col.con h3{color:var(--cinnabar)}
  .col h3::before{content:""; width:10px; height:10px; transform:rotate(45deg)}
  .col.pro h3::before{background:var(--jade)} .col.con h3::before{background:var(--cinnabar)}
  .col ul{list-style:none; display:flex; flex-direction:column; gap:11px}
  .col li{font-size:16px; padding-left:18px; position:relative; color:var(--silk)}
  .col li::before{position:absolute; left:0; font-family:var(--serif); font-size:12px; top:3px}
  .col.pro li::before{content:"吉"; color:var(--jade)} .col.con li::before{content:"煞"; color:var(--cinnabar)}

  .thesis{margin:28px 0 0; padding:26px 30px; border:1px solid var(--line); border-left:3px solid var(--gold); background:var(--card-2)}
  .thesis h4{font-family:var(--serif); font-weight:900; font-size:22px; color:var(--gold-br); letter-spacing:.06em; margin-bottom:8px}
  .thesis p{color:var(--silk); font-size:18px}
  .thesis b{color:var(--cinnabar); font-weight:600}

  /* ---------- 大限三卡 ---------- */
  .lims{display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin:26px 0 0}
  .limcard{padding:20px 18px; border:1px solid var(--line); border-radius:4px; background:var(--card); position:relative}
  .limcard.now{border-color:var(--gold); box-shadow:inset 0 0 26px rgba(201,162,75,.09)}
  .limcard .rng{font-family:var(--serif); font-size:12px; letter-spacing:.24em; color:var(--gold)}
  .limcard h4{font-family:var(--serif); font-weight:900; font-size:23px; color:var(--silk); margin:4px 0 8px}
  .limcard p{font-size:15px; color:var(--silk-dim)}
  .limcard p b{color:var(--silk); font-weight:600}
  .limcard .badge{position:absolute; top:14px; right:14px; font-size:11px; font-family:var(--serif);
    letter-spacing:.14em; color:var(--gold-br); border:1px solid var(--gold); padding:1px 8px; border-radius:20px}

  /* ---------- 應期 timeline ---------- */
  .tl{margin-top:28px; display:flex; flex-direction:column; gap:0}
  .ev{display:grid; grid-template-columns:118px 1fr; gap:20px; padding:20px 0; border-bottom:1px dashed rgba(201,162,75,.16); opacity:0; transform:translateY(24px); transition:opacity .9s ease, transform .9s ease}
  .ev.in{opacity:1; transform:none}
  .ev .y{text-align:right}
  .ev .y .yy{font-family:var(--serif); font-weight:900; font-size:25px; color:var(--gold-br); line-height:1.25}
  .ev .y .gz2{font-size:12px; color:var(--silk-dim); letter-spacing:.1em}
  .ev .y .mk{display:inline-block; margin-top:6px; font-size:11px; font-family:var(--serif); letter-spacing:.1em; padding:1px 8px; border-radius:20px}
  .mk.m1{color:var(--azure); border:1px solid var(--azure)}
  .mk.m2{color:var(--cinnabar); border:1px solid var(--cinnabar)}
  .mk.m3{color:#b9a5ec; border:1px solid #8b74cf}
  .ev h5{font-family:var(--serif); font-weight:900; font-size:19px; color:var(--silk); margin-bottom:6px; letter-spacing:.04em}
  .ev p{font-size:16px; color:var(--silk)}
  .ev p b{color:var(--gold-br); font-weight:600}
  .ev .chain{margin-top:8px; font-size:14px; color:var(--silk-dim); border-left:2px solid var(--line); padding-left:12px; line-height:1.9}
  .ev .chain em{font-style:normal; color:var(--gold); font-family:var(--serif)}
  .ev.hot .y .yy{color:var(--cinnabar)}
  .ev.hot h5{color:var(--gold-br)}

  /* ---------- 攻守年曆 / 別走路線 ---------- */
  .cal{display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:26px}
  .cal .side{background:var(--card); border:1px solid var(--line); border-radius:4px; padding:18px 22px}
  .cal .side h3{font-family:var(--serif); font-size:17px; letter-spacing:.1em; margin-bottom:12px}
  .cal .side.atk h3{color:var(--jade)} .cal .side.def h3{color:var(--cinnabar)}
  .cal .side ul{list-style:none}
  .cal .side li{font-size:15px; margin-bottom:9px; color:var(--silk-dim)}
  .cal .side li b{color:var(--silk); font-weight:600; margin-right:6px; font-family:var(--serif)}
  .avoid{background:var(--card); border:1px solid rgba(210,75,59,.38); border-radius:4px; padding:20px 24px; margin-top:14px}
  .avoid h3{font-family:var(--serif); color:var(--cinnabar); font-size:18px; letter-spacing:.06em; margin-bottom:8px}
  .avoid p{font-size:15.5px; color:var(--silk); margin-bottom:6px}
  .avoid p .warn{color:var(--cinnabar); font-weight:600}
  .avoid .instead{font-size:14.5px; color:var(--silk-dim); border-top:1px dashed var(--line); padding-top:9px; margin-top:11px}
  .avoid .instead b{color:var(--jade); font-weight:600}

  /* ---------- 天賦印象 ---------- */
  .persona{margin:30px 0 0; padding:34px 28px; text-align:center; border:1px solid var(--line); border-radius:4px;
    background:radial-gradient(circle at 50% 0%, rgba(201,162,75,.12), var(--card) 70%)}
  .persona .plabel{font-family:var(--serif); font-size:12px; letter-spacing:.4em; color:var(--gold)}
  .persona h3{font-family:var(--serif); font-weight:900; font-size:clamp(26px,5vw,38px); color:var(--gold-br); letter-spacing:.06em; margin:10px 0 8px}
  .persona .ptags{display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin:6px 0 12px}
  .persona .ptags span{font-size:12px; font-family:var(--serif); letter-spacing:.12em; color:var(--silk-dim); border:1px solid var(--line); border-radius:20px; padding:2px 12px}
  .persona p{font-size:16.5px; color:var(--silk); max-width:560px; margin:0 auto}
  .cloudwrap{display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px}
  .cloud{border:1px solid var(--line); border-radius:4px; background:var(--card); padding:20px 22px; text-align:center}
  .cloud h3{font-family:var(--serif); font-size:15px; letter-spacing:.3em; margin-bottom:14px}
  .cloud.good h3{color:var(--jade)} .cloud.bad h3{color:var(--cinnabar)}
  .cloud .words{display:flex; flex-wrap:wrap; justify-content:center; align-items:baseline; gap:10px 16px; line-height:1.5}
  .cloud .words i{font-style:normal; font-family:var(--serif)}
  .cloud.good .words i{color:var(--jade)} .cloud.bad .words i{color:var(--cinnabar)}
  .cloud .words i{opacity:.75}
  .cloud .words .w2{font-size:17px; opacity:.85} .cloud .words .w3{font-size:21px; font-weight:600; opacity:.95}
  .cloud .words .w4{font-size:26px; font-weight:900; opacity:1}
  .cloud .words .w1{font-size:14px}
  .gift{margin-top:16px; padding:20px 24px; border:1px solid var(--line); border-radius:4px; background:var(--card)}
  .gift h3{font-family:var(--serif); font-weight:900; font-size:19px; color:var(--gold-br); margin-bottom:6px; letter-spacing:.04em}
  .gift p{font-size:15.5px; color:var(--silk); margin:0}
  .gift p b{color:var(--gold-br)}
  .fw{display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px}
  .fx{border:1px solid var(--line); border-radius:4px; background:var(--card); padding:20px 22px}
  .fx h3{font-family:var(--serif); font-size:17px; letter-spacing:.14em; margin-bottom:12px; display:flex; gap:8px; align-items:center}
  .fx.flash h3{color:var(--jade)} .fx.weak h3{color:var(--cinnabar)}
  .fx ol{list-style:none; display:flex; flex-direction:column; gap:14px}
  .fx li{font-size:15px; color:var(--silk)}
  .fx li b{display:block; font-family:var(--serif); font-size:16px; margin-bottom:2px}
  .fx.flash li b{color:var(--jade)} .fx.weak li b{color:var(--cinnabar)}
  .fx li .tip{display:block; margin-top:6px; font-size:13.5px; color:var(--silk-dim); border-left:2px solid var(--line); padding-left:10px}
  @media(max-width:680px){ .cloudwrap{grid-template-columns:1fr} .fw{grid-template-columns:1fr} }

  /* 人生羅盤 */
  .compass{display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:26px}
  .compass .cside{background:var(--card); border:1px solid var(--line); border-radius:4px; padding:20px 22px}
  .compass .cside.go{border-top:3px solid var(--jade)} .compass .cside.no{border-top:3px solid var(--cinnabar)}
  .compass .cside h3{font-family:var(--serif); font-size:17px; letter-spacing:.12em; margin-bottom:14px}
  .compass .cside.go h3{color:var(--jade)} .compass .cside.no h3{color:var(--cinnabar)}
  .compass ul{list-style:none; display:flex; flex-direction:column; gap:13px}
  .compass li{font-size:14.5px; color:var(--silk-dim); line-height:1.8}
  .compass li b{display:block; font-family:var(--serif); font-size:15.5px; color:var(--silk); margin-bottom:1px}
  .compass .cside.go li b::before{content:"▲ "; color:var(--jade); font-size:12px}
  .compass .cside.no li b::before{content:"▼ "; color:var(--cinnabar); font-size:12px}
  .compass li em{font-style:normal; color:var(--gold-br)}
  @media(max-width:680px){ .compass{grid-template-columns:1fr} }

  footer{margin:60px 0 70px; padding-top:28px; border-top:1px solid var(--line)}
  .disc{font-size:12px; color:var(--silk-dim); letter-spacing:.1em; text-align:center; line-height:2}
  .disc .b{font-family:var(--brush); font-weight:900; color:var(--gold); font-size:18px; letter-spacing:.1em}

  /* fallback 章節（沿用單題報告的 markdown 樣式感） */
  .read h1,.read h2,.read h3,.read h4{color:var(--gold); letter-spacing:.06em; margin:20px 0 8px; line-height:1.5}
  .read blockquote{border-left:3px solid var(--gold); background:var(--card); padding:10px 16px; margin:14px 0; color:var(--silk-dim)}
  .read ul,.read ol{margin:12px 0 12px 1.6em}
  .table-wrap{overflow-x:auto; margin:14px 0}
  .read table{border-collapse:collapse; width:100%; font-size:14.5px}
  .read th,.read td{border:1px solid var(--line); padding:8px 12px; text-align:left}

  @media(max-width:680px){
    .tri{grid-template-columns:1fr} .lims{grid-template-columns:1fr} .cal{grid-template-columns:1fr}
    .core dl{font-size:11px} .cell{padding:6px 6px} .star.min{font-size:12px} .star.maj{font-size:14px} .star.adj{display:none}
    .duo{grid-template-columns:1fr} .thesis{padding:20px}
    .ev{grid-template-columns:78px 1fr; gap:12px}
  }
  @media(prefers-reduced-motion:reduce){ *{animation:none!important; transition:none!important} .read,.ev{opacity:1; transform:none} }
`;

const BOOK_SCRIPT = `
  (function(){
    /* 配色：匯出時由 addInitScript 先設定；否則讀報告自己的記憶，再退回 app 設定，最後紫色 */
    var KEY='zhanyan-report-theme', root=document.documentElement, t=root.dataset.theme;
    try{ if(!t) t=localStorage.getItem(KEY); }catch(e){}
    try{ if(!t) t=JSON.parse(localStorage.getItem('zhanyan-settings')||'{}').theme; }catch(e){}
    if(t!=='gray'&&t!=='mauve') t='purple';
    root.dataset.theme=t;
    var bar=document.createElement('div'); bar.className='theme-pick';
    [['purple','星空紫'],['mauve','藕紫色'],['gray','灰黑色']].forEach(function(p){
      var b=document.createElement('button'); b.type='button';
      b.className='t-'+p[0]+(p[0]===t?' on':''); b.title=p[1]; b.setAttribute('aria-label','配色：'+p[1]);
      b.onclick=function(){ root.dataset.theme=p[0]; try{localStorage.setItem(KEY,p[0]);}catch(e){}
        bar.querySelectorAll('button').forEach(function(x){x.classList.remove('on')}); b.classList.add('on'); };
      bar.appendChild(b);
    });
    /* 下載鈕：以目前配色輸出 JPG／PDF（走 /export API，切換器不入圖） */
    var sep=document.createElement('i'); sep.className='tp-sep'; bar.appendChild(sep);
    ['jpg','pdf'].forEach(function(f){
      var d=document.createElement('button'); d.type='button'; d.className='tp-dl';
      d.textContent=f.toUpperCase(); d.title='下載 '+f.toUpperCase();
      d.onclick=function(){
        if(d.disabled) return;
        d.disabled=true; d.textContent='…';
        fetch(location.pathname+'/export',{method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({format:f,theme:root.dataset.theme})})
          .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); })
          .then(function(bl){ var a=document.createElement('a'); a.href=URL.createObjectURL(bl);
            a.download=document.title+'.'+f; a.click(); URL.revokeObjectURL(a.href); })
          .catch(function(e){ alert('下載失敗：'+e.message); })
          .finally(function(){ d.disabled=false; d.textContent=f.toUpperCase(); });
      };
      bar.appendChild(d);
    });
    document.body.appendChild(bar);
  })();
  (function(){
    var sky=document.getElementById('sky'), n=46, h='';
    if(!sky){ sky=document.createElement('div'); sky.id='sky'; sky.className='sky'; sky.setAttribute('aria-hidden','true'); document.body.prepend(sky); }
    for(var i=0;i<n;i++){ var x=(i*53%100), y=(i*29%100), d=(i%6), s=(i%3)+1;
      h+='<i style="left:'+x+'%;top:'+y+'%;width:'+s+'px;height:'+s+'px;animation-delay:'+d+'s"></i>'; }
    sky.innerHTML=h;
  })();
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
    },{threshold:.12});
    document.querySelectorAll('.read, .ev, .cal').forEach(function(s){io.observe(s)});
  } else { document.querySelectorAll('.read, .ev, .cal').forEach(function(s){s.classList.add('in')}); }
`;

/* ---------- 盤面（確定性資料，程式直填） ---------- */

const HUA_CLASS: Record<string, string> = { 祿: 'lu', 權: 'quan', 科: 'ke', 忌: 'ji' };

function starHtml(s: BookStar): string {
  const cls = s.kind === 'major' ? 'star maj' : s.kind === 'minor' ? 'star min' : 'star adj';
  const br = s.brightness ? `<span class="br">${escapeHtml(s.brightness)}</span>` : '';
  const hua = s.mutagen ? `<span class="hua ${HUA_CLASS[s.mutagen] ?? ''}">${escapeHtml(s.mutagen)}</span>` : '';
  return `<span class="${cls}">${escapeHtml(s.name)}${br}${hua}</span>`;
}

function cellHtml(c: BookCell): string {
  const tags =
    (c.isMing ? '<span class="tag cm">命宮</span>' : '') + (c.isShen && !c.isMing ? '<span class="tag ly">身宮</span>' : '');
  return `<div class="cell${c.isMing ? ' ming' : ''}">
        ${tags}<div class="stars">${c.stars.map(starHtml).join('')}</div>
        <span class="lim">${escapeHtml(c.lim)}</span><div class="foot"><span class="gname">${escapeHtml(c.palaceName)}</span><span class="gz">${escapeHtml(c.gz)}</span></div>
      </div>`;
}

/** 命盤方圖：grid 位置與 src/components/Chart.tsx 的 GRID_POS 同構 */
function boardHtml(book: BookData, seal: string): string {
  const by = new Map(book.cells.map((c) => [c.branch, c]));
  const cell = (b: string): string => {
    const c = by.get(b);
    return c ? cellHtml(c) : '<div class="cell"></div>';
  };
  const m = book.meta;
  const ming = book.cells.find((c) => c.isMing);
  const shen = book.cells.find((c) => c.isShen);
  const mingMajor = ming?.stars.filter((s) => s.kind === 'major').map((s) => s.name) ?? [];
  const [mutHead, mutBody] = m.natalMutText.includes('：') ? m.natalMutText.split('：') : ['生年四化', m.natalMutText];
  const core = `<div class="core">
        <div class="seal">${escapeHtml(seal)}</div>
        <dl><b>${escapeHtml(mingMajor.length ? `${mingMajor.join('')}坐命` : '命無主星')}${shen ? ` · 身在${escapeHtml(shen.palaceName)}` : ''}</b><br>${escapeHtml(m.fiveElementsClass)} · 大限 ${m.startAge} 歲起 · 子斗在${escapeHtml(m.ziDou)}<br>${escapeHtml(mutHead)}：<b>${escapeHtml(mutBody)}</b><br>命主 ${escapeHtml(m.soul)} · 身主 ${escapeHtml(m.body)}</dl>
      </div>`;
  return `<div class="board" role="img" aria-label="十二宮命盤方圖">
      ${['巳', '午', '未', '申', '辰'].map(cell).join('\n      ')}
      ${core}
      ${cell('酉')}
      ${cell('卯')}
      ${cell('戌')}
      ${['寅', '丑', '子', '亥'].map(cell).join('\n      ')}
    </div>
    <div class="legend">
      <span><i class="dot" style="background:var(--jade)"></i>化祿</span>
      <span><i class="dot" style="background:var(--gold)"></i>化權</span>
      <span><i class="dot" style="border:1px solid var(--gold)"></i>化科</span>
      <span><i class="dot" style="background:var(--cinnabar)"></i>化忌</span>
      <span><i class="dot" style="box-shadow:inset 0 0 0 1px var(--gold);background:var(--ming-a)"></i>命宮</span>
      <span>${escapeHtml(m.notes)}</span>
    </div>`;
}

/* ---------- 各章節（Claude JSON 槽位） ---------- */

interface HeroCh {
  epithet: string;
  seal: string | null;
  tri: { k: string; g: string; v: string }[];
  thesis: { title: string; text: string };
}

function heroOf(ch: unknown): HeroCh | null {
  const o = asObj(ch);
  if (!o) return null;
  const epithet = str(o.epithet);
  const thesis = asObj(o.thesis);
  const tri = arr(o.tri)
    .map(asObj)
    .filter((x): x is Dict => !!x && !!str(x.k) && !!str(x.g) && !!str(x.v))
    .map((x) => ({ k: x.k as string, g: x.g as string, v: x.v as string }));
  if (!epithet || tri.length !== 3 || !thesis || !str(thesis.title) || !str(thesis.text)) return null;
  return { epithet, seal: str(o.seal), tri, thesis: { title: thesis.title as string, text: thesis.text as string } };
}

function triHtml(hero: HeroCh): string {
  const anchors = ['#zw', '#topics', '#timing'];
  return `<div class="tri">
      ${hero.tri
        .map((t, i) => `<a href="${anchors[i]}"><span class="k">${slot(t.k)}</span><span class="v"><span class="g">${slot(t.g)}</span>${slot(t.v)}</span></a>`)
        .join('\n      ')}
    </div>`;
}

function giftSection(ch: unknown): string {
  const o = asObj(ch);
  const tags = o ? arr(o.personaTags).filter((x) => typeof x === 'string') : [];
  const gifts = o ? arr(o.gifts).map(asObj).filter((x): x is Dict => !!x && !!str(x.title) && !!str(x.text)) : [];
  const flashes = o ? arr(o.flashes).map(asObj).filter((x): x is Dict => !!x && !!str(x.title) && !!str(x.text)) : [];
  const weaks = o ? arr(o.weaks).map(asObj).filter((x): x is Dict => !!x && !!str(x.title) && !!str(x.text)) : [];
  const words = (v: unknown): string =>
    arr(v)
      .map(asObj)
      .filter((x): x is Dict => !!x && !!str(x.w))
      .map((x) => {
        const lv = typeof x.lv === 'number' && x.lv >= 1 && x.lv <= 4 ? x.lv : 2;
        return `<i class="w${lv}">${slot(x.w)}</i>`;
      })
      .join('');
  if (!o || !str(o.personaTitle) || !str(o.personaText) || gifts.length === 0) return fallbackBlock('天賦印象', ch);
  return `<div class="sys" id="gift">
    <div class="syshead"><div class="idx">壹</div><h2>天賦印象</h2><div class="en">先認識自己 · 再看盤</div></div>

    <div class="persona read">
      <div class="plabel">你 的 天 賦 類 型</div>
      <h3>${slot(o.personaTitle)}</h3>
      <div class="ptags">${tags.map((t) => `<span>${slot(t)}</span>`).join('')}</div>
      <p>${slot(o.personaText)}</p>
    </div>

    <div class="cloudwrap read">
      <div class="cloud good"><h3>優 點 關 鍵 詞</h3><div class="words">${words(o.goodWords)}</div></div>
      <div class="cloud bad"><h3>缺 點 關 鍵 詞</h3><div class="words">${words(o.badWords)}</div></div>
    </div>

    <div class="read">
      ${gifts.map((g) => `<div class="gift"><h3>${slot(g.title)}</h3><p>${slot(g.text)}</p></div>`).join('\n      ')}
    </div>

    <div class="fw read">
      <div class="fx flash"><h3>◆ 閃光點</h3><ol>
        ${flashes.map((f, i) => `<li><b>${i + 1} · ${slot(f.title)}</b>${slot(f.text)}</li>`).join('\n        ')}
      </ol></div>
      <div class="fx weak"><h3>◆ 弱點 · 與練習方法</h3><ol>
        ${weaks
          .map(
            (w, i) =>
              `<li><b>${i + 1} · ${slot(w.title)}</b>${slot(w.text)}${str(w.tip) ? `<span class="tip">練習：${slot(w.tip)}</span>` : ''}</li>`,
          )
          .join('\n        ')}
      </ol></div>
    </div>
  </div>`;
}

interface TopicCh {
  desc: string;
  pros: string[];
  cons: string[];
}

function topicOf(ch: unknown): TopicCh | null {
  const o = asObj(ch);
  if (!o || !str(o.desc)) return null;
  const pros = arr(o.pros).filter((x): x is string => typeof x === 'string');
  const cons = arr(o.cons).filter((x): x is string => typeof x === 'string');
  if (pros.length === 0 || cons.length === 0) return null;
  return { desc: o.desc as string, pros, cons };
}

function topicSegment(glyph: string, title: string, loc: string, ch: unknown, chapterTitle: string): string {
  const subhd = `<div class="subhd"><div class="glyph">${escapeHtml(glyph)}</div><div><div class="topic">${escapeHtml(title)}</div><div class="loc">${escapeHtml(loc)}</div></div></div>`;
  const t = topicOf(ch);
  if (!t) {
    const raw = asObj(ch)?.__fallbackMd;
    const md = typeof raw === 'string' ? raw : JSON.stringify(ch ?? null, null, 2);
    return `${subhd}
      <div class="read in"><h3>${escapeHtml(chapterTitle)}（原始輸出）</h3>${markdownToHtml(md)}</div>`;
  }
  return `${subhd}
      <p class="desc">${slot(t.desc)}</p>
      <div class="duo">
        <div class="col pro"><h3>優　勢</h3><ul>
          ${t.pros.map((x) => `<li>${slot(x)}</li>`).join('\n          ')}
        </ul></div>
        <div class="col con"><h3>劣　勢</h3><ul>
          ${t.cons.map((x) => `<li>${slot(x)}</li>`).join('\n          ')}
        </ul></div>
      </div>`;
}

function limsSection(book: BookData, ch: unknown): string {
  const head = `<div class="syshead"><div class="idx">參</div><h2>大限走勢</h2><div class="en">接下來三十年的大方向</div></div>
    <p class="desc" style="text-align:center; margin:20px auto 4px; max-width:680px; color:var(--silk-dim)">紫微十年換一個大限。關鍵三十年長這樣：</p>`;
  const o = asObj(ch);
  const cards = o ? arr(o.cards).map(asObj).filter((x): x is Dict => !!x && !!str(x.title) && !!str(x.text)) : [];
  if (cards.length === 0) {
    const raw = asObj(ch)?.__fallbackMd;
    const md = typeof raw === 'string' ? raw : JSON.stringify(ch ?? null, null, 2);
    return `<div class="sys" id="timing">${head}<div class="read in">${markdownToHtml(md)}</div></div>`;
  }
  const cardsHtml = book.decadals
    .map((d, i) => {
      const c = cards[i];
      const startYear = book.meta.birthYear + d.range[0] - 1;
      const endYear = book.meta.birthYear + d.range[1] - 1;
      return `<div class="limcard${d.isCurrent ? ' now' : ''}">
        ${d.label ? `<span class="badge">${escapeHtml(d.label)}</span>` : ''}
        <div class="rng">${d.range[0]} – ${d.range[1]} 歲 · ${startYear} – ${endYear}</div>
        <h4>${c ? slot(c.title) : `${escapeHtml(d.palaceName)}限`}</h4>
        <p>${c ? slot(c.text) : ''}</p>
      </div>`;
    })
    .join('\n      ');
  return `<div class="sys" id="timing">
    ${head}
    <div class="lims read">
      ${cardsHtml}
    </div>
  </div>`;
}

/** 應期 mk：災宮引動→m2、reasons 含忌且 weight>=3→m3、其餘→m1 */
function eventMark(e: BookEvent): { cls: string; text: string } {
  if (e.marks.includes('災宮引動')) return { cls: 'm2', text: e.marks[0] ?? '災宮引動' };
  if (e.weight >= 3 && e.reasons.some((r) => r.includes('忌'))) return { cls: 'm3', text: '雙忌' };
  return { cls: 'm1', text: e.marks[0] ?? '引動' };
}

function eventsSection(book: BookData, ch: unknown): string {
  const head = `<div class="syshead"><div class="idx">肆</div><h2>重點應期</h2><div class="en">哪些年要特別注意 · 附為什麼</div></div>
    <p class="desc" style="text-align:center; margin:20px auto 4px; max-width:680px; color:var(--silk-dim)">年份由程式照占驗派規則推算（流命引動法＋疊星引動法）。過去的年份可以先對答案。</p>`;
  const o = asObj(ch);
  const items = o ? arr(o.events).map(asObj).filter((x): x is Dict => !!x && typeof x.year === 'number') : [];
  if (items.length === 0) return `<div class="sys">${head}</div>${fallbackBlock('重點應期', ch)}`;
  const byYear = new Map(items.map((x) => [x.year as number, x]));
  const evs = book.events
    .map((e) => {
      const c = byYear.get(e.year);
      const mk = eventMark(e);
      const title = c && str(c.title) ? slot(c.title) : `${escapeHtml(mk.text)}年`;
      const desc = c && str(c.desc) ? slot(c.desc) : '';
      const why = c && str(c.why) ? slot(c.why) : e.reasons.map((r) => escapeHtml(r)).join('；');
      const advice = c && str(c.advice) ? slot(c.advice) : '';
      const chain = `<div class="chain"><em>為什麼</em>：${why}${advice ? `<br><em>${e.isPast ? '回看' : '建議'}</em>：${advice}` : ''}</div>`;
      return `<div class="ev${e.isCurrent ? ' hot' : ''}">
        <div class="y"><div class="yy">${e.year}</div><div class="gz2">${escapeHtml(e.gz)} · ${e.age}歲${e.isCurrent ? ' · 今年' : ''}</div><span class="mk ${mk.cls}">${escapeHtml(mk.text)}</span></div>
        <div>
          <h5>${title}</h5>
          ${desc ? `<p>${desc}</p>` : ''}
          ${chain}
        </div>
      </div>`;
    })
    .join('\n\n      ');
  return `<div class="sys">
    ${head}
    <div class="tl">
      ${evs}
    </div>
  </div>`;
}

function compassSections(ch: unknown): string {
  const o = asObj(ch);
  const item = (x: unknown): Dict | null => {
    const d = asObj(x);
    return d && str(d.title) && str(d.text) ? d : null;
  };
  const go = o ? arr(o.go).map(item).filter((x): x is Dict => !!x) : [];
  const no = o ? arr(o.no).map(item).filter((x): x is Dict => !!x) : [];
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
  if (go.length === 0 || no.length === 0) return fallbackBlock('人生羅盤', ch);

  const li = (x: Dict): string => `<li><b>${slot(x.title)}</b>${slot(x.text)}${str(x.em) ? `<em>${slot(x.em)}</em>` : ''}</li>`;
  const calLi = (x: Dict): string => `<li><b>${slot(x.year)}</b>${slot(x.text)}</li>`;

  const compass = `<div class="sys" id="compass">
    <div class="syshead"><div class="idx">伍</div><h2>人生羅盤</h2><div class="en">通篇總覽 · 優勢往哪走 · 弱項怎麼避</div></div>
    <p class="desc" style="text-align:center; margin:20px auto 4px; max-width:680px; color:var(--silk-dim)">前面講的是「什麼時候」，這一章講「什麼方向」——把整份命書濃縮成一張羅盤。</p>

    <div class="compass read">
      <div class="cside go"><h3>你的優勢在這裡 —— 多往這個方向走</h3><ul>
        ${go.map(li).join('\n        ')}
      </ul></div>
      <div class="cside no"><h3>這裡容易出問題 —— 提前避開或調整</h3><ul>
        ${no.map(li).join('\n        ')}
      </ul></div>
    </div>
  </div>`;

  const rules = `<div class="sys" id="rules">
    <div class="syshead"><div class="idx">陸</div><h2>知命改命</h2><div class="en">攻守守則 · 藍圖給你，方向盤在你手上</div></div>
    <p class="desc" style="text-align:center; margin:20px auto 4px; max-width:680px; color:var(--silk-dim)">算命不是為了聽天由命。命盤是藍圖不是判決書——<b style="color:var(--gold-br)">好的時候多拼，不好的時候收斂守好，不擅長的路線直接不走</b>。</p>

    <div class="cal read">
      <div class="side atk"><h3>▲ 進攻年 —— 多拼，油門踩下去</h3><ul>
        ${attack.map(calLi).join('\n        ')}
      </ul></div>
      <div class="side def"><h3>▼ 收斂年 —— 守好，別開新局</h3><ul>
        ${defense.map(calLi).join('\n        ')}
      </ul></div>
    </div>

    <div class="read" style="margin-top:16px">
      ${avoid
        .map(
          (a) => `<div class="avoid">
        <h3>${slot(a.title)}</h3>
        <p>${slot(a.text)}</p>
        ${str(a.instead) ? `<p class="instead"><b>改走這條：</b>${slot(a.instead)}</p>` : ''}
      </div>`,
        )
        .join('\n\n      ')}
    </div>

    ${
      final && str(final.title) && str(final.text)
        ? `<div class="thesis" style="margin-top:30px"><h4>${slot(final.title)}</h4><p>${slot(final.text)}</p></div>`
        : ''
    }
  </div>`;
  return `${compass}

  ${rules}`;
}

/* ---------- 全書組裝 ---------- */

export function renderBookHtml(opts: {
  title: string;
  name: string;
  header: ReportHeader;
  book: BookData;
  /** 章節 key → 解析後 JSON 物件；解析失敗為 { __fallbackMd: 原始文字 } */
  chapters: Record<string, unknown>;
  generatedAt: string;
  /** 產生模型的顯示字串（前端組好）：頁尾生成時間旁加註，未帶不顯示 */
  modelLabel?: string;
}): string {
  const { title, name, header: h, book, chapters, generatedAt, modelLabel } = opts;
  const m = book.meta;
  const hero = heroOf(chapters.hero);
  const ming = book.cells.find((c) => c.isMing);
  const shen = book.cells.find((c) => c.isShen);

  const heroTitle = hero ? hero.epithet : name || title;
  const sealFallback = ming?.stars.filter((s) => s.kind === 'major').slice(0, 2).map((s) => s.name).join('') || '命書';
  const seal = hero?.seal ?? sealFallback;

  const sub = `${escapeHtml(h.yinYang)}${escapeHtml(h.gender)} · <b>${escapeHtml(h.clockDate)}　鐘錶 ${escapeHtml(h.clockTime)} / 真太陽 ${escapeHtml(h.solarTime)}</b>`;
  const note = `${escapeHtml(h.lunarDate)}｜${escapeHtml(m.fiveElementsClass)} · 命宮${escapeHtml(ming?.branch ?? '')}${shen ? ` · 身在${escapeHtml(shen.palaceName)}` : ''}｜安星碼 S5VoG（占驗派）`;

  const thesis = hero
    ? `<div class="thesis"><h4>${slot(hero.thesis.title)}</h4><p>${slot(hero.thesis.text)}</p></div>`
    : '';

  const topicsHtml = `<div class="read" id="topics">
      ${topicSegment('性', '性格', book.topicLocs.benming, chapters.topic_benming, '性格')}

      ${topicSegment('業', '事業', book.topicLocs.shiye, chapters.topic_shiye, '事業')}

      ${topicSegment('財', '金錢', book.topicLocs.caiyun, chapters.topic_caiyun, '金錢')}

      ${topicSegment('情', '感情 · 姻緣', book.topicLocs.aiqing, chapters.topic_aiqing, '感情')}
    </div>`;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(heroTitle)} · 占驗紫微命書 · ${escapeHtml(name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;900&family=Noto+Sans+TC:wght@400;500&display=swap" rel="stylesheet">
<style>${THEME_CSS}${BOOK_CSS}</style>
</head>
<body>
<div class="sky" id="sky" aria-hidden="true"></div>
<div class="wrap">

  <header>
    <div class="eyebrow">占 驗 紫 微 · 命 書</div>
    <div class="title">${escapeHtml(heroTitle)}</div>
    <p class="sub">${sub}</p>
    <p class="note">${note}</p>
    ${hero ? triHtml(hero) : ''}
  </header>
  ${hero ? '' : fallbackBlock('開卷', chapters.hero)}

  <!-- ================= 天賦印象 ================= -->
  ${giftSection(chapters.gift)}

  <!-- ================= 命盤 ================= -->
  <div class="sys" id="zw">
    <div class="syshead"><div class="idx">貳</div><h2>命盤 · 十二宮</h2><div class="en">占驗派 · 庚干陽武同相 · 天馬依月支</div></div>

    ${boardHtml(book, seal)}

    ${thesis}

    ${topicsHtml}
  </div>

  <!-- ================= 大限走勢 ================= -->
  ${limsSection(book, chapters.lims)}

  <!-- ================= 重點應期 ================= -->
  ${eventsSection(book, chapters.events)}

  <!-- ================= 人生羅盤 / 知命改命 ================= -->
  ${compassSections(chapters.compass)}

  <footer>
    <p class="disc"><span class="b">占驗紫微 · 命書</span><br>${escapeHtml(m.notes)}<br>盤面與應期由 LifePath 占驗引擎規則推算（流命引動法 · 疊星引動法）· 內容供自我參考，不是命定的判決<br>本命書於 ${escapeHtml(generatedAt)} 生成${modelLabel ? `・${escapeHtml(modelLabel)}` : ''}</p>
  </footer>

</div>
<script>${BOOK_SCRIPT}</script>
</body>
</html>
`;
}

export function renderReportHtml(opts: {
  title: string;
  name: string;
  header: ReportHeader;
  sections: ReportSection[];
  generatedAt: string;
  /** 原始提問：顯示在標題下方的小字（標題用 AI 生成的報告標題） */
  question?: string;
  /** 產生模型的顯示字串（前端組好）：頁尾生成時間旁加註，未帶不顯示 */
  modelLabel?: string;
}): string {
  const { title, name, header: h, sections, generatedAt, question, modelLabel } = opts;
  const metaCells: [string, string][] = [
    ['性別陰陽', `${h.yinYang}${h.gender}`],
    ['年干支', h.yearGz],
    ['農曆', h.lunarDate],
    ['五行局', h.fiveElementsClass],
    ['命主・身主', `${h.soul}・${h.body}`],
    ['鐘錶時間', `${h.clockDate} ${h.clockTime}`],
    ['真太陽時', `${h.solarDate} ${h.solarTime}`],
  ];
  const metaHtml = metaCells
    .map(([k, v]) => `<div class="cell"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`)
    .join('\n        ');
  const sectionsHtml = sections
    .map(
      (s) => `      <section class="section">
        ${s.title ? `<h2 class="chapter">${escapeHtml(s.title)}</h2>` : ''}
        <div class="body">
${markdownToHtml(s.markdown)}
        </div>
      </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}｜${escapeHtml(name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;900&family=Noto+Sans+TC:wght@400;500&display=swap" rel="stylesheet">
  <style>${THEME_CSS}${CSS}</style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <div class="eyebrow">占 驗 紫 微 · 單 題 報 告</div>
      <div class="title">${escapeHtml(title)}</div>
      ${question ? `<p class="question"><b>提 問</b>${escapeHtml(question)}</p>` : ''}
      <div class="name">${escapeHtml(name)}</div>
      <div class="hero-rule"></div>
      <div class="meta">
        ${metaHtml}
      </div>
    </header>
${sectionsHtml}
    <footer class="footer">本報告於 ${escapeHtml(generatedAt)} 生成${modelLabel ? `・${escapeHtml(modelLabel)}` : ''} · 內容供自我參考，不是命定的判決</footer>
  </div>
<script>${BOOK_SCRIPT}</script>
</body>
</html>
`;
}
