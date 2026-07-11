import type { CastResult } from '../engine/cast';
import { ZHANYAN_MUTAGENS } from '../engine/zhanyanConfig';
import type { ChartAnalysis } from './analysis';
import type { Topic } from './facts';
import { groupDesc, headerDesc, type ReportChapterSpec } from './reportPrompts';
import { profileSection } from './chatPrompt';

/**
 * 視覺化命書（book v2）資料組裝（純函式，瀏覽器端用）：
 * - BookData：盤面等確定性資料，程式直接填，server 端 renderBookHtml 有同構型別
 * - buildBookData / selectKeyEvents：由 CastResult + ChartAnalysis 組出 BookData
 * - buildBookChapters：9 章 prompt，每章要求 Claude 只輸出一個 JSON 物件
 */

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
  /** 該大限走到的本命宮名 */
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
  /** 命中方法去重 */
  marks: string[];
  weight: number;
  reasons: string[];
}

export type TopicKey = 'benming' | 'shiye' | 'caiyun' | 'aiqing';

export interface BookData {
  meta: {
    fiveElementsClass: string;
    soul: string;
    body: string;
    ziDou: string;
    /** 例 "生年甲化：廉祿 破權 武科 陽忌" */
    natalMutText: string;
    /** 命宮大限起始歲 */
    startAge: number;
    birthYear: number;
    /** 排盤規則一行（同 RightPanel footer 文案） */
    notes: string;
  };
  cells: BookCell[];
  decadals: BookDecadal[];
  events: BookEvent[];
  /** 主題 loc 行：宮名 · 干支 · 本宮主星清單 */
  topicLocs: Record<TopicKey, string>;
}

const TOPIC_KEY: Record<Topic, TopicKey> = { 本命: 'benming', 事業: 'shiye', 財運: 'caiyun', 愛情: 'aiqing' };

const NOTES = '文墨天機安星碼 S5VoG（占驗派）｜庚干四化 陽武同相｜天馬依月支｜截空旬空占驗排法｜晚子時視為次日｜閏月月中分界';

/** 生年四化一行：星名取首字 */
function natalMutText(yearStem: string): string {
  const stars = ZHANYAN_MUTAGENS[yearStem] ?? ['？', '？', '？', '？'];
  return `生年${yearStem}化：${stars[0][0]}祿 ${stars[1][0]}權 ${stars[2][0]}科 ${stars[3][0]}忌`;
}

/** 重點應期：全大限 hits 攤平依年份 group，權重前 8 名（今年命中必收），年份升冪 */
export function selectKeyEvents(analysis: ChartAnalysis, currentYear: number): BookEvent[] {
  const byYear = new Map<number, BookEvent>();
  for (const d of analysis.decadals) {
    for (const h of d.hits) {
      if (h.weight < 2 && h.method !== '流命引動' && h.method !== '災宮引動') continue;
      if (h.year < currentYear - 6 || h.year > currentYear + 22) continue;
      const e =
        byYear.get(h.year) ??
        ({
          year: h.year,
          gz: h.yearGz,
          age: h.age,
          isCurrent: h.year === currentYear,
          isPast: h.year < currentYear,
          marks: [],
          weight: 0,
          reasons: [],
        } satisfies BookEvent);
      e.weight += h.weight;
      e.reasons.push(h.reason);
      if (!e.marks.includes(h.method)) e.marks.push(h.method);
      byYear.set(h.year, e);
    }
  }
  const all = [...byYear.values()].sort((a, b) => b.weight - a.weight || a.year - b.year);
  let top = all.slice(0, 8);
  const cur = all.find((e) => e.isCurrent);
  if (cur && !top.includes(cur)) top = [...top.slice(0, 7), cur];
  return top.sort((a, b) => a.year - b.year);
}

/** 由排盤結果組出命書的確定性資料 */
export function buildBookData(result: CastResult, analysis: ChartAnalysis, currentYear: number): BookData {
  const { astrolabe: a, meta } = result;
  const birthYear = analysis.header.birthYear;

  const cells: BookCell[] = a.palaces.map((p) => ({
    branch: p.earthlyBranch,
    gz: `${p.heavenlyStem}${p.earthlyBranch}`,
    palaceName: p.name,
    lim: `${p.decadal.range[0]}-${p.decadal.range[1]}`,
    isMing: p.name === '命宮',
    isShen: p.isBodyPalace,
    stars: [
      ...p.majorStars.map((s) => ({ name: s.name, brightness: s.brightness || undefined, mutagen: s.mutagen || undefined, kind: 'major' as const })),
      ...p.minorStars.map((s) => ({ name: s.name, brightness: s.brightness || undefined, mutagen: s.mutagen || undefined, kind: 'minor' as const })),
      ...p.adjectiveStars.map((s) => ({ name: s.name, kind: 'adj' as const })),
    ],
  }));

  // 現行大限＋之後兩限（currentYear 換算虛歲落點）
  const age = currentYear - birthYear + 1;
  const curIdx = analysis.decadals.findIndex((d) => age >= d.range[0] && age <= d.range[1]);
  const from = curIdx >= 0 ? curIdx : 0;
  const labels: BookDecadal['label'][] = ['現行', '將行', '高峰'];
  const decadals: BookDecadal[] = analysis.decadals.slice(from, from + 3).map((d, i) => ({
    range: d.range,
    gz: `${d.stem}${d.branch}`,
    palaceName: a.palaces.find((p) => p.earthlyBranch === d.daMingBranch)!.name,
    label: labels[i] ?? '',
    isCurrent: i === 0 && curIdx >= 0,
  }));

  const topicLocs = {} as Record<TopicKey, string>;
  for (const t of analysis.topics) {
    const p = a.palaces.find((x) => x.earthlyBranch === t.branch)!;
    const stars = t.group[0].stars
      .map((s) => `${s.name}${s.brightness ? `(${s.brightness})` : ''}${s.natalMutagen ? `化${s.natalMutagen}` : ''}`)
      .join(' ');
    topicLocs[TOPIC_KEY[t.topic]] = `${t.palaceName} · ${p.heavenlyStem}${p.earthlyBranch} · ${stars || '無主星（借對宮）'}`;
  }

  const ming = a.palaces.find((p) => p.name === '命宮')!;
  return {
    meta: {
      fiveElementsClass: a.fiveElementsClass,
      soul: a.soul,
      body: a.body,
      ziDou: meta.ziDou,
      natalMutText: natalMutText(meta.yearStem),
      startAge: ming.decadal.range[0],
      birthYear,
      notes: NOTES,
    },
    cells,
    decadals,
    events: selectKeyEvents(analysis, currentYear),
    topicLocs,
  };
}

/* ---------- 9 章 prompt ---------- */

const JSON_RULE = `【輸出要求】
1. 只輸出一個 JSON 物件（第一個字元是 {、最後一個字元是 }），不要 code fence、不要任何其他文字或說明。
2. 繁體中文，占驗派語氣專業但白話；字串值內可用 **粗體** 標重點，禁止其他 markdown 與 HTML。
3. 只能根據上面提供的盤面事實，不得自行安星，不得推算或新增年份。`;

/** 四主題宮位簡表 */
function topicBrief(book: BookData): string {
  const label: Record<TopicKey, string> = { benming: '本命（性格）', shiye: '事業', caiyun: '金錢', aiqing: '感情' };
  return (Object.keys(label) as TopicKey[]).map((k) => `- ${label[k]}：${book.topicLocs[k]}`).join('\n');
}

/** 引動事件清單（年份＋權重＋原因鏈） */
function eventLines(events: BookEvent[]): string {
  return events
    .map(
      (e) =>
        `- ${e.year}年（${e.gz}，${e.age}歲${e.isCurrent ? '，今年' : e.isPast ? '，已過去' : ''}）[總權重${e.weight}]〔${e.marks.join('、')}〕\n` +
        e.reasons.map((r) => `    - ${r}`).join('\n'),
    )
    .join('\n');
}

/** 大限卡事實（range／干支／宮名＋大限備註＋重點 hits） */
function decadalCardLines(analysis: ChartAnalysis, book: BookData): string {
  return book.decadals
    .map((d, i) => {
      const da = analysis.decadals.find((x) => x.range[0] === d.range[0])!;
      const startYear = book.meta.birthYear + d.range[0] - 1;
      const endYear = book.meta.birthYear + d.range[1] - 1;
      const hits = da.hits
        .filter((h) => h.weight >= 2 || h.method === '流命引動' || h.method === '災宮引動')
        .sort((a, b) => b.weight - a.weight || a.year - b.year)
        .slice(0, 8)
        .map((h) => `    - ${h.year}年（${h.yearGz}，${h.age}歲）[權重${h.weight}] ${h.reason}`);
      return `卡片 ${i + 1}（${d.label || '之後'}）：${d.range[0]}~${d.range[1]}歲（${startYear}~${endYear}）${d.gz}限，大限命宮走到本命「${d.palaceName}」宮${
        da.notes.length ? `\n  大限備註：${da.notes.join('；')}` : ''
      }${hits.length ? '\n  重點引動：\n' + hits.join('\n') : ''}`;
    })
    .join('\n');
}

function heroPrompt(analysis: ChartAnalysis, book: BookData, currentYear: number): string {
  const t = analysis.topics.find((x) => x.topic === '本命')!;
  const cur = book.decadals[0];
  return `你是占驗派紫微斗數論命助手。以下是命主的排盤事實（占驗派 S5VoG 安星，含庚干陽武同相四化），請為視覺化命書的開卷區塊產生內容。

【命主】${headerDesc(analysis)}。今年西元 ${currentYear} 年。${book.meta.natalMutText}。

【命宮（${t.branch}宮）三方四正】
${groupDesc(t)}

【四主題宮位簡表】
${topicBrief(book)}

【現行大限】${cur ? `${cur.range[0]}~${cur.range[1]}歲 ${cur.gz}限，走到本命「${cur.palaceName}」宮` : '（無）'}

【輸出 JSON 格式（結構範例，值請換成內容）】
{"epithet":"2字雅號（例：藏鋒）","seal":"4字格局（例：府相朝垣）","tri":[{"k":"命 格","g":"≤6字","v":"≤30字"},{"k":"樞 紐","g":"≤6字","v":"≤30字"},{"k":"應 期","g":"≤6字","v":"≤30字"}],"thesis":{"title":"命格定調標題","text":"120~200字，一段話總結這張盤"}}
tri 固定三卡依序為命格／樞紐／應期，k 值固定用「命 格」「樞 紐」「應 期」；應期卡以今年主題切入。

${JSON_RULE}`;
}

function giftPrompt(analysis: ChartAnalysis, book: BookData): string {
  const topicsDesc = analysis.topics
    .map((t) => `〈${t.topic}〉主題宮位：${t.palaceName}（${t.branch}宮）三方四正\n${groupDesc(t)}`)
    .join('\n\n');
  const shen = book.cells.find((c) => c.isShen);
  return `你是占驗派紫微斗數論命助手。以下是命主的排盤事實（占驗派 S5VoG 安星，含庚干陽武同相四化），請為視覺化命書的「天賦印象」區塊產生內容——先認識自己、再看盤。

【命主】${headerDesc(analysis)}。${book.meta.natalMutText}。身宮在${shen ? `${shen.palaceName}（${shen.branch}宮）` : '命宮'}。

【四主題三方四正】
${topicsDesc}

【輸出 JSON 格式（結構範例，值請換成內容）】
{"personaTitle":"天賦類型稱號（≤10字）","personaTags":["標籤1","標籤2","標籤3","標籤4"],"personaText":"≤80字白話描述","goodWords":[{"w":"優點詞2~4字","lv":4}],"badWords":[{"w":"缺點詞2~4字","lv":3}],"gifts":[{"title":"天賦標題（≤12字）","text":"80~140字"}],"flashes":[{"title":"閃光點標題","text":"說明"}],"weaks":[{"title":"弱點標題","text":"說明","tip":"具體練習方法"}]}
數量要求：personaTags 4 個；goodWords 10~12 個、badWords 8~10 個（lv 為 1~4 的字級大小，越重要越大，lv4 限 1~2 個）；gifts 4 個；flashes 3 個；weaks 3 個。

${JSON_RULE}`;
}

function topicPrompt(analysis: ChartAnalysis, book: BookData, topic: Topic, blockName: string): string {
  const t = analysis.topics.find((x) => x.topic === topic)!;
  const cur = book.decadals[0];
  const aiqingHint =
    topic === '愛情' && cur ? `\n【提示】現行大限（${cur.range[0]}~${cur.range[1]}歲）${cur.palaceName === '夫妻' ? '正走本命夫妻宮，感情婚姻是這十年的主題' : `走本命${cur.palaceName}宮，並未親臨夫妻宮`}。` : '';
  return `你是占驗派紫微斗數論命助手。以下是命主的排盤事實（占驗派 S5VoG 安星，含庚干陽武同相四化），請為視覺化命書的「${blockName}」主題區塊產生內容。

【命主】${headerDesc(analysis)}。${book.meta.natalMutText}。

【${blockName}主題宮位：${t.palaceName}（${t.branch}宮）三方四正】
${groupDesc(t)}${aiqingHint}

【輸出 JSON 格式（結構範例，值請換成內容）】
{"desc":"150~220字，以三方四正星曜組合論此主題的格局與本質（引用具體星曜、亮度與生年四化）","pros":["優勢4條，每條≤20字"],"cons":["劣勢4條，每條≤20字"]}
pros 與 cons 各恰好 4 條。

${JSON_RULE}`;
}

function limsPrompt(analysis: ChartAnalysis, book: BookData, currentYear: number): string {
  const n = book.decadals.length;
  return `你是占驗派紫微斗數論命助手。以下是命主接下來 ${n} 個大限的排盤事實與引動年份（占驗派流命引動法＋疊星引動法，程式計算），請為視覺化命書的「大限走勢」區塊產生 ${n} 張大限卡的文字。

【命主】${headerDesc(analysis)}。今年西元 ${currentYear} 年。${book.meta.natalMutText}。

【大限卡片事實】
${decadalCardLines(analysis, book)}

【輸出 JSON 格式（結構範例，值請換成內容）】
{"cards":[{"title":"此限主題（≤6字，例：定情定業期）","text":"100~160字，講這十年的正題、機會與功課"}]}
cards 恰好 ${n} 張，依序對應上面的卡片 1~${n}，不得增減。

${JSON_RULE}`;
}

function eventsPrompt(analysis: ChartAnalysis, book: BookData, currentYear: number): string {
  const years = book.events.map((e) => e.year).join('、');
  return `你是占驗派紫微斗數論命助手。以下是規則引擎推算的重點應期年份與原因（占驗派流命引動法＋疊星引動法，程式計算，勿自行增減），請為視覺化命書的「重點應期」時間軸產生每年的解讀。

【命主】${headerDesc(analysis)}。今年西元 ${currentYear} 年。${book.meta.natalMutText}。

【年份清單】${years}

【各年引動原因】
${eventLines(book.events)}

【輸出 JSON 格式（結構範例，值請換成內容）】
{"events":[{"year":2026,"title":"該年主題（≤16字）","desc":"40~80字，白話講會發生什麼","why":"60~120字，完整原因鏈：看到什麼（星＋宮＋四化）→ 所以推論什麼","advice":"≤60字；未來年份給具體建議，過去年份寫回看驗證點"}]}
events 必須一一對應年份清單（${years}），全部涵蓋、依年份升冪、不得新增或刪除年份。

${JSON_RULE}`;
}

function compassPrompt(analysis: ChartAnalysis, book: BookData, currentYear: number): string {
  const topicsDesc = analysis.topics
    .map((t) => `〈${t.topic}〉主題宮位：${t.palaceName}（${t.branch}宮）三方四正\n${groupDesc(t)}`)
    .join('\n\n');
  const years = book.events.map((e) => `${e.year}（${e.isPast ? '已過去' : e.isCurrent ? '今年' : '未來'}，權重${e.weight}，${e.marks.join('、')}）`).join('、');
  return `你是占驗派紫微斗數論命助手。以下是命主四大主題的排盤事實、大限走勢與重點應期年份（占驗派 S5VoG 安星，程式計算），請為視覺化命書的收卷區塊「人生羅盤」與「知命改命」產生內容。

【命主】${headerDesc(analysis)}。今年西元 ${currentYear} 年。${book.meta.natalMutText}。

【四主題三方四正】
${topicsDesc}

【大限走勢】
${decadalCardLines(analysis, book)}

【重點應期年份】${years}
【各年引動原因】
${eventLines(book.events)}

【輸出 JSON 格式（結構範例，值請換成內容）】
{"go":[{"title":"優勢方向（≤14字）","text":"星曜與四化依據","em":"≤30字行動句"}],"no":[{"title":"易出問題處（≤14字）","text":"依據與情境","em":"≤30字調整方法"}],"attack":[{"year":2026,"text":"≤26字，該年該拼什麼"}],"defense":[{"year":2028,"text":"≤26字，該年該守什麼"}],"avoid":[{"title":"路線一別走：xxx","text":"為什麼這條路對此命最傷","instead":"改走的具體做法"}],"final":{"title":"一句話記住這張盤","text":"全書總結"}}
數量要求：go 3~4 條、no 4~5 條、attack 3~4 條（year 必須從上面的應期年份挑未來年份）、defense 3~4 條（year 可為數字或「凡災宮年」這類字串）、avoid 3~4 條（title 依序用 路線一別走／路線二別走…）。

${JSON_RULE}`;
}

/** 全書 9 章（視覺化命書 v2）：每章要求 Claude 只輸出一個 JSON 物件 */
export function buildBookChapters(analysis: ChartAnalysis, book: BookData, currentYear: number, profile?: string): ReportChapterSpec[] {
  const ps = profileSection(profile);
  const withProfile = (prompt: string): string => (ps ? `${prompt}\n\n${ps}` : prompt);
  return [
    { key: 'hero', title: '開卷', prompt: withProfile(heroPrompt(analysis, book, currentYear)) },
    { key: 'gift', title: '天賦印象', prompt: withProfile(giftPrompt(analysis, book)) },
    { key: 'topic_benming', title: '性格', prompt: withProfile(topicPrompt(analysis, book, '本命', '性格')) },
    { key: 'topic_shiye', title: '事業', prompt: withProfile(topicPrompt(analysis, book, '事業', '事業')) },
    { key: 'topic_caiyun', title: '金錢', prompt: withProfile(topicPrompt(analysis, book, '財運', '金錢')) },
    { key: 'topic_aiqing', title: '感情', prompt: withProfile(topicPrompt(analysis, book, '愛情', '感情')) },
    { key: 'lims', title: '大限走勢', prompt: withProfile(limsPrompt(analysis, book, currentYear)) },
    { key: 'events', title: '重點應期', prompt: withProfile(eventsPrompt(analysis, book, currentYear)) },
    { key: 'compass', title: '人生羅盤', prompt: withProfile(compassPrompt(analysis, book, currentYear)) },
  ];
}
