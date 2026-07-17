import type { CastResult } from '../engine/cast';
import { buildTopicFacts, topicBranches, TOPICS, type Topic, type TopicFacts } from './facts';
import { buildTriggers, type DecadalAnalysis } from './trigger';
import { TONE_RULE } from './tone';

export interface ChartAnalysis {
  header: {
    gender: string;
    yinYang: string;
    fiveElementsClass: string;
    soul: string;
    body: string;
    lunarDate: string;
    yearGz: string;
    birthYear: number;
  };
  topics: TopicFacts[];
  decadals: DecadalAnalysis[];
}

/** 規則引擎總入口：主題事實＋斷應期，並把疊星命中歸屬主題 */
export function buildAnalysis(result: CastResult): ChartAnalysis {
  const { astrolabe: a, meta } = result;
  const birthYear = Number(meta.castDate.split('-')[0]);
  const topics = buildTopicFacts(a);
  const decadals = buildTriggers(a, meta, birthYear);

  const branchSets = topics.map((t) => ({ topic: t.topic, set: topicBranches(t) }));
  for (const d of decadals) {
    for (const h of d.hits) {
      if (h.topics.length === 0) {
        const matched = branchSets.filter((b) => h.palaceBranch && b.set.has(h.palaceBranch)).map((b) => b.topic);
        h.topics = matched.length > 0 ? matched : ['整體'];
      }
    }
  }

  const yinYang = '甲丙戊庚壬'.includes(meta.yearStem) ? '陽' : '陰';
  return {
    header: {
      gender: a.gender,
      yinYang,
      fiveElementsClass: a.fiveElementsClass,
      soul: a.soul,
      body: a.body,
      lunarDate: a.lunarDate,
      yearGz: `${meta.yearStem}${meta.yearBranch}`,
      birthYear,
    },
    topics,
    decadals,
  };
}

/** 主題的重點年份（權重排序，同年合併） */
export function topYears(analysis: ChartAnalysis, topic: Topic, limit = 8): { year: number; weight: number; reasons: string[] }[] {
  const byYear = new Map<number, { weight: number; reasons: string[] }>();
  for (const d of analysis.decadals) {
    for (const h of d.hits) {
      if (!h.topics.includes(topic) && !(topic === '本命' && h.topics.includes('整體'))) continue;
      const e = byYear.get(h.year) ?? { weight: 0, reasons: [] };
      e.weight += h.weight;
      e.reasons.push(h.reason);
      byYear.set(h.year, e);
    }
  }
  return [...byYear.entries()]
    .map(([year, e]) => ({ year, ...e }))
    .sort((x, y) => y.weight - x.weight || x.year - y.year)
    .slice(0, limit);
}

/** 組給 Claude 的提示詞（單一主題） */
export function buildPrompt(analysis: ChartAnalysis, topic: Topic, currentYear: number): string {
  const t = analysis.topics.find((x) => x.topic === topic)!;
  const h = analysis.header;

  const groupDesc = t.group
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

  const decadalDesc = analysis.decadals
    .filter((d) => d.range[0] <= 82) // 高齡大限不送，控制提示詞長度
    .map((d) => {
      const hits = d.hits.filter(
        (x) =>
          (x.topics.includes(topic) || x.topics.includes('整體')) &&
          (x.weight >= 2 || x.method === '流命引動' || x.method === '災宮引動'),
      );
      const lines = hits.map((x) => `    - ${x.year}年（${x.yearGz}，${x.age}歲）[權重${x.weight}] ${x.reason}`);
      return `- ${d.range[0]}~${d.range[1]}歲 ${d.stem}${d.branch}限${d.notes.length ? `（${d.notes.join('；')}）` : ''}${
        lines.length ? '\n' + lines.join('\n') : ''
      }`;
    })
    .join('\n');

  return `你是占驗派紫微斗數論命助手。以下是命主的排盤事實（占驗派 S5VoG 安星，含庚干陽武同相四化），請針對「${topic}」主題做解讀。

【命主】${h.yinYang}${h.gender}，${h.yearGz}年生（${h.lunarDate}），${h.fiveElementsClass}，命主${h.soul}、身主${h.body}。今年西元 ${currentYear} 年。

【${topic}主題宮位：${t.palaceName}（${t.branch}宮）三方四正】
${groupDesc}

【斷應期規則引擎結果（占驗派流命引動法＋疊星引動法，程式計算，勿自行增減；雙祿（祿疊祿、雙祿交會）為吉應、雙忌為凶應、祿忌交會吉中藏凶）】
${decadalDesc}

【解讀要求】
1. 只能根據上面提供的盤面事實與引動年份，不得自行安星或推算新的年份。
2. 先講本質：以三方四正星曜組合論此主題的格局、優勢、隱憂（引用具體星曜與亮度、生年四化）。
3. 再分大限：挑出對此主題最重要的 2~3 個大限，說明原因。
4. 最後列重點年份：從引動年份中挑最值得注意的（權重高、多重引動優先），每一年都要寫出完整原因鏈——「看到什麼（星＋宮＋四化）→ 所以推論什麼 → 該年該注意／把握什麼」。
5. 用繁體中文，語氣專業但白話，條理分明用 markdown 標題與清單。全文 800~1200 字，不要免責聲明。

${TONE_RULE}`;
}

export { TOPICS };
export type { Topic };
