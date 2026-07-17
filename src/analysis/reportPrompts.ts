import type { CastMeta } from '../engine/types';
import { buildPrompt, type ChartAnalysis } from './analysis';
import type { TopicFacts } from './facts';
import { TONE_RULE } from './tone';

/**
 * 命書報告的 prompt 組裝（純函式，瀏覽器端用）：
 * - buildReportHeader：報告 hero 區的命主資訊
 * - buildFullReportChapters：全書六章（命格總論、四主題、人生羅盤）的章節規格
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

export interface ReportChapterSpec {
  key: string;
  title: string;
  prompt: string;
}

export function buildReportHeader(analysis: ChartAnalysis, meta: CastMeta): ReportHeader {
  const h = analysis.header;
  return {
    gender: h.gender,
    yinYang: h.yinYang,
    yearGz: h.yearGz,
    lunarDate: h.lunarDate,
    fiveElementsClass: h.fiveElementsClass,
    soul: h.soul,
    body: h.body,
    clockDate: meta.clockDate,
    clockTime: meta.clockTime,
    solarDate: meta.solarTimeDate,
    solarTime: meta.solarTimeHM,
  };
}

/** 三方四正星曜清單（格式同 analysis.ts buildPrompt 的 groupDesc） */
export function groupDesc(t: TopicFacts): string {
  return t.group
    .map(
      (g) =>
        `- ${g.role}【${g.palaceName}宮・${g.branch}】：${
          g.stars.length > 0
            ? g.stars
                .map((s) => `${s.name}${s.brightness ? `(${s.brightness})` : ''}${s.natalMutagen ? `［生年化${s.natalMutagen}］` : ''}`)
                .join('、')
            : '無主星（借對宮）'
        }`,
    )
    .join('\n');
}

/** 命主基本資訊行（格式同 buildPrompt） */
export function headerDesc(analysis: ChartAnalysis): string {
  const h = analysis.header;
  return `${h.yinYang}${h.gender}，${h.yearGz}年生（${h.lunarDate}），${h.fiveElementsClass}，命主${h.soul}、身主${h.body}`;
}

/** 命格總論：以命宮三方四正＋命主身主＋五行局定調格局本質 */
function buildZonglunPrompt(analysis: ChartAnalysis): string {
  const t = analysis.topics.find((x) => x.topic === '本命')!;
  return `你是占驗派紫微斗數論命助手。以下是命主的排盤事實（占驗派 S5VoG 安星，含庚干陽武同相四化），請撰寫命書的開卷章節「命格總論」。

【命主】${headerDesc(analysis)}。

【命宮（${t.branch}宮）三方四正】
${groupDesc(t)}

【撰寫要求】
1. 只能根據上面提供的盤面事實，不得自行安星或推算其他宮位、年份。
2. 以命宮三方四正的星曜組合，搭配命主${analysis.header.soul}、身主${analysis.header.body}與${analysis.header.fiveElementsClass}，定調此命的格局本質：先論整體格局，再論天賦強項，最後論性格的光與影（優點與盲點並陳，引用具體星曜、亮度與生年四化）。
3. 為此命格取一個 2~4 字的命格稱號，放在文章開頭並簡述命名由來。
4. 用繁體中文，語氣專業但白話，條理分明用 markdown 標題與清單。全文 800~1200 字，不要免責聲明。

${TONE_RULE}`;
}

/** 人生羅盤：四主題總覽＋未來十年行動建議 */
function buildLuopanPrompt(analysis: ChartAnalysis, currentYear: number): string {
  const topicsDesc = analysis.topics
    .map((t) => `〈${t.topic}〉主題宮位：${t.palaceName}（${t.branch}宮）三方四正\n${groupDesc(t)}`)
    .join('\n\n');

  const decadalDesc = analysis.decadals
    .filter((d) => d.range[0] <= 82) // 高齡大限不送，控制提示詞長度
    .map((d) => {
      const hits = d.hits.filter((x) => x.weight >= 2 || x.method === '流命引動' || x.method === '災宮引動');
      const lines = hits.map(
        (x) => `    - ${x.year}年（${x.yearGz}，${x.age}歲）[權重${x.weight}]〔${x.topics.join('、')}〕${x.reason}`,
      );
      return `- ${d.range[0]}~${d.range[1]}歲 ${d.stem}${d.branch}限${d.notes.length ? `（${d.notes.join('；')}）` : ''}${
        lines.length ? '\n' + lines.join('\n') : ''
      }`;
    })
    .join('\n');

  return `你是占驗派紫微斗數論命助手。以下是命主四大主題（本命、財運、事業、愛情）的排盤事實與斷應期引動年份（占驗派 S5VoG 安星，含庚干陽武同相四化），請撰寫命書的收卷章節「人生羅盤」——通篇總覽與行動指南。

【命主】${headerDesc(analysis)}。今年西元 ${currentYear} 年。

【四主題三方四正】
${topicsDesc}

【斷應期規則引擎結果（占驗派流命引動法＋疊星引動法，程式計算，勿自行增減；雙祿（祿疊祿、雙祿交會）為吉應、雙忌為凶應、祿忌交會吉中藏凶）】
${decadalDesc}

【撰寫要求】
1. 只能根據上面提供的盤面事實與引動年份，不得自行安星或推算新的年份。
2. 綜觀四主題，指出此命最值得發展的 2~3 個方向，逐一說明星曜與四化依據。
3. 指出最需要防守的 2~3 個弱項，逐一說明星曜與四化依據，並給防守策略。
4. 針對未來十年（${currentYear}~${currentYear + 9}）的重點引動年份（權重高、多重引動優先），給出具體行動建議，每一年都寫出完整原因鏈——「看到什麼（星＋宮＋四化）→ 所以推論什麼 → 該年該注意／把握什麼」。
5. 用繁體中文，語氣專業但白話，條理分明用 markdown 標題與清單。全文 800~1200 字，不要免責聲明。

${TONE_RULE}`;
}

/** 全書六章：命格總論、本命、財運、事業、愛情、人生羅盤 */
export function buildFullReportChapters(analysis: ChartAnalysis, currentYear: number): ReportChapterSpec[] {
  return [
    { key: 'zonglun', title: '命格總論', prompt: buildZonglunPrompt(analysis) },
    { key: 'benming', title: '本命', prompt: buildPrompt(analysis, '本命', currentYear) },
    { key: 'caiyun', title: '財運', prompt: buildPrompt(analysis, '財運', currentYear) },
    { key: 'shiye', title: '事業', prompt: buildPrompt(analysis, '事業', currentYear) },
    { key: 'aiqing', title: '愛情', prompt: buildPrompt(analysis, '愛情', currentYear) },
    { key: 'luopan', title: '人生羅盤', prompt: buildLuopanPrompt(analysis, currentYear) },
  ];
}
