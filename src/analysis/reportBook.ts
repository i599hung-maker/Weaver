import type { CastResult } from '../engine/cast';
import { ZHANYAN_MUTAGENS } from '../engine/zhanyanConfig';
import type { ChartAnalysis } from './analysis';
import type { Topic } from './facts';
import { groupDesc, headerDesc, type ReportChapterSpec } from './reportPrompts';
import { profileSection, styleSection, type ReportStyle } from './chatPrompt';
import { TONE_RULE } from './tone';

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

/** 年齡級距（虛歲）：過往池回看年數與筆數上限 */
function pastQuota(age: number): { lookback: number; max: number } {
  if (age < 35) return { lookback: 8, max: 6 };
  if (age <= 55) return { lookback: 15, max: 9 };
  return { lookback: 25, max: 12 };
}

/** 未來池筆數上限 */
const FUTURE_MAX = 12;

/**
 * 重點應期拆兩池（年份升冪合併輸出）：
 * - 過往對答案：回看範圍與筆數隨虛歲級距，權重優先、同權取較近年，且虛歲不早於 15
 * - 未來引動：今年~+22 年權重前 12，今年命中必收
 */
export function selectKeyEvents(analysis: ChartAnalysis, currentYear: number, birthYear: number): BookEvent[] {
  const quota = pastQuota(currentYear - birthYear + 1);
  const minPastYear = Math.max(currentYear - quota.lookback, birthYear + 14);
  const byYear = new Map<number, BookEvent>();
  for (const d of analysis.decadals) {
    for (const h of d.hits) {
      if (h.weight < 2 && h.method !== '流命引動' && h.method !== '災宮引動') continue;
      if (h.year < currentYear ? h.year < minPastYear : h.year > currentYear + 22) continue;
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
  const all = [...byYear.values()];
  const past = all
    .filter((e) => e.isPast)
    .sort((a, b) => b.weight - a.weight || b.year - a.year)
    .slice(0, quota.max);
  const futureAll = all.filter((e) => !e.isPast).sort((a, b) => b.weight - a.weight || a.year - b.year);
  let future = futureAll.slice(0, FUTURE_MAX);
  const cur = futureAll.find((e) => e.isCurrent);
  if (cur && !future.includes(cur)) future = [...future.slice(0, FUTURE_MAX - 1), cur];
  return [...past, ...future].sort((a, b) => a.year - b.year);
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
    events: selectKeyEvents(analysis, currentYear, birthYear),
    topicLocs,
  };
}

/* ---------- 9 章 prompt ---------- */

const JSON_RULE = `【輸出要求】
1. 只輸出一個 JSON 物件（第一個字元是 {、最後一個字元是 }），不要 code fence、不要任何其他文字或說明。
2. 繁體中文，占驗派語氣專業但白話；字串值內可用 **粗體** 標重點，禁止其他 markdown 與 HTML。
3. 只能根據上面提供的盤面事實，不得自行安星，不得推算或新增年份。

${TONE_RULE}`;

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
  const past = book.events.filter((e) => e.isPast);
  const future = book.events.filter((e) => !e.isPast);
  const allYears = book.events.map((e) => e.year).join('、');
  return `你是占驗派紫微斗數論命助手。以下是規則引擎推算的重點應期年份與原因（占驗派流命引動法＋疊星引動法，程式計算，勿自行增減），請為視覺化命書的「重點應期」時間軸產生每年的解讀。時間軸分兩段：過往年份用來對答案驗盤，未來年份給建議。疊星吉凶：雙祿（祿疊祿、雙祿交會）為吉應（進財、升遷、喜事類），雙忌為凶應（破財、災咎類），祿忌交會吉中藏凶；解讀方向須順著該年引動的吉凶寫，吉年寫把握點、凶年寫防範點。

【命主】${headerDesc(analysis)}。今年西元 ${currentYear} 年。${book.meta.natalMutText}。

【過往年份（對答案）】${past.length > 0 ? past.map((e) => e.year).join('、') : '（無）'}
【未來年份】${future.length > 0 ? future.map((e) => e.year).join('、') : '（無）'}

【各年引動原因】
${eventLines(book.events)}

【輸出 JSON 格式（結構範例，值請換成內容）】
{"events":[{"year":2026,"title":"該年主題（≤16字）","desc":"40~80字，白話講會發生什麼","why":"60~120字，完整原因鏈：看到什麼（星＋宮＋四化）→ 所以推論什麼","advice":"≤60字；未來年份給具體建議；過往年份寫驗證點——一句可回想對照的問句（例：這年是否換了工作？）"}]}
events 必須一一對應全部年份（${allYears}），全部涵蓋、依年份升冪、不得新增或刪除年份。
過往年份若命主自述有提到對應年份的事件，desc 或 advice 要直接指出「此年命中自述的○○」，作為驗盤信心依據。

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
export function buildBookChapters(analysis: ChartAnalysis, book: BookData, currentYear: number, profile?: string, style?: ReportStyle): ReportChapterSpec[] {
  const extra = [styleSection(style), profileSection(profile)].filter(Boolean).join('\n\n');
  const withProfile = (prompt: string): string => (extra ? `${prompt}\n\n${extra}` : prompt);
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

/* ---------- 九章輪播步驟（純前端狀態文案；資料全來自 book/analysis） ---------- */

export interface BookStep {
  key: string;
  title: string;
  /** 逐句輪播；最後一句固定「撰寫…／收卷…」讓輪播停住慢閃 */
  steps: string[];
}

/** 命主標頭：《陽男，丙子年生，水二局，命主廉貞、身主火星》 */
function headerBrief(analysis: ChartAnalysis): string {
  const h = analysis.header;
  return `《${h.yinYang}${h.gender}，${h.yearGz}年生，${h.fiveElementsClass}，命主${h.soul}、身主${h.body}》`;
}

/** 本宮主星清單：《紫微(旺)、貪狼(廟)》，無主星則借對宮 */
function starList(stars: { name: string; brightness?: string }[]): string {
  if (stars.length === 0) return '無主星（借對宮）';
  return `《${stars.map((s) => `${s.name}${s.brightness ? `(${s.brightness})` : ''}`).join('、')}》`;
}

/** 三方四正一句：對宮《遷移(酉)》、三合《財帛(亥)・官祿(未)》 */
function sanfangLine(t: { group: { palaceName: string; branch: string }[] }): string {
  const [, dui, s1, s2] = t.group;
  return `展開三方四正：對宮《${dui.palaceName}(${dui.branch})》、三合《${s1.palaceName}(${s1.branch})・${s2.palaceName}(${s2.branch})》`;
}

function topicOf(analysis: ChartAnalysis, topic: Topic) {
  return analysis.topics.find((x) => x.topic === topic)!;
}

/** 由 book/analysis 現成資料組九章輪播文案（與 buildBookChapters 同順序同 key） */
export function buildBookSteps(analysis: ChartAnalysis, book: BookData): BookStep[] {
  const mut = book.meta.natalMutText;
  const cur = book.decadals[0];
  const shen = book.cells.find((c) => c.isShen);

  const benming = topicOf(analysis, '本命');
  const ming = benming.group[0];
  const shiye = topicOf(analysis, '事業');
  const caiyun = topicOf(analysis, '財運');
  const aiqing = topicOf(analysis, '愛情');

  const fourLocs = analysis.topics.map((t) => `${t.palaceName}(${t.branch})`).join('、');
  const future = book.events.filter((e) => !e.isPast);
  const past = book.events.filter((e) => e.isPast).map((e) => e.year);
  const heavy = [...book.events].sort((a, b) => b.weight - a.weight)[0];

  const hero: string[] = [
    `正在定盤：${headerBrief(analysis)}`,
    `正在讀命宮（《${ming.branch}》）：${starList(ming.stars)}坐守`,
    sanfangLine(benming),
    `檢視生年四化：《${mut}》`,
    cur ? `定位現行大限：《${cur.range[0]}~${cur.range[1]}歲，走本命${cur.palaceName}宮》` : '定位現行大限…',
    '凝鍊命格雅號與格局印…',
  ];

  const gift: string[] = [
    `正在讀四主題宮位：${fourLocs}`,
    shen ? `查身宮落點：《身宮在${shen.palaceName}(${shen.branch})》` : '查身宮落點…',
    '逐宮比對星曜亮度，分揀優勢與弱項…',
    '歸納天賦類型、閃光點與練習方法…',
  ];

  const personality: string[] = [
    `正在讀命宮（《${ming.branch}》）：${starList(ming.stars)}坐守`,
    sanfangLine(benming),
    '檢視生年四化與亮度，判讀性格明暗兩面…',
    '撰寫性格論斷…',
  ];

  const career: string[] = [
    `正在讀官祿宮（《${shiye.group[0].branch}》）：${starList(shiye.group[0].stars)}坐守`,
    sanfangLine(shiye),
    `檢視生年四化：《${mut}》`,
    '綜合格局與亮度，撰寫事業論斷…',
  ];

  const money: string[] = [
    `正在讀財帛宮（《${caiyun.group[0].branch}》）：${starList(caiyun.group[0].stars)}坐守`,
    sanfangLine(caiyun),
    `檢視生年四化：《${mut}》`,
    '判讀財源型態與守財漏財點…',
  ];

  const love: string[] = [
    `正在讀夫妻宮（《${aiqing.group[0].branch}》）：${starList(aiqing.group[0].stars)}坐守`,
    sanfangLine(aiqing),
    cur
      ? `判斷現行大限：《${cur.palaceName === '夫妻' ? '走本命夫妻宮，感情正是這十年主題' : `走本命${cur.palaceName}宮，未親臨夫妻宮`}》`
      : '判斷現行大限…',
    '撰寫感情緣分與相處功課…',
  ];

  const lims: string[] = [
    ...book.decadals.map(
      (d) => `正在推演《${d.range[0]}~${d.range[1]}歲 ${d.gz}》限：大限命宮走本命《${d.palaceName}》宮`,
    ),
    ...(future[0] ? [`流命引動掃描：《${future[0].year} ${future[0].gz}年，${future[0].marks.join('、')}》`] : []),
    ...(heavy ? [`疊星引動：《${heavy.year} ${heavy.gz}年（總權重${heavy.weight}）》`] : []),
    `彙整《${book.decadals.length}》張大限卡主題…`,
  ];

  const events: string[] = [
    past.length ? `核對過往應期（對答案）：《${past.join('、')}》` : '核對過往應期（對答案）…',
    ...(future[0] ? [`流命引動：《${future[0].year} ${future[0].gz}年，${future[0].marks.join('、')}》`] : []),
    ...(heavy ? [`疊星判斷：《${heavy.year} ${heavy.gz}年，${heavy.marks.join('、')}（總權重${heavy.weight}）》`] : []),
    `吉凶定調：共 ${book.events.length} 個應期年份，逐年判吉凶…`,
    '逐年撰寫解讀：吉年寫把握點、凶年寫防範點…',
  ];

  const compass: string[] = [
    '彙整四主題三方四正與大限走勢…',
    future.length ? `標記進攻年與防守年：《${future.slice(0, 3).map((e) => e.year).join('、')}…》` : '標記進攻年與防守年…',
    '整理「路線別走」與改運對策…',
    '收卷：凝鍊一句話記住這張盤…',
  ];

  return [
    { key: 'hero', title: '開卷', steps: hero },
    { key: 'gift', title: '天賦印象', steps: gift },
    { key: 'topic_benming', title: '性格', steps: personality },
    { key: 'topic_shiye', title: '事業', steps: career },
    { key: 'topic_caiyun', title: '金錢', steps: money },
    { key: 'topic_aiqing', title: '感情', steps: love },
    { key: 'lims', title: '大限走勢', steps: lims },
    { key: 'events', title: '重點應期', steps: events },
    { key: 'compass', title: '人生羅盤', steps: compass },
  ];
}
