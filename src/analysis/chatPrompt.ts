import type { ChartAnalysis } from './analysis';
import type { TopicFacts } from './facts';
import type { ChatMessage } from '../store/mingzhu';

/** assistant 歷史回答的截斷長度（字元） */
const ASSISTANT_HISTORY_LIMIT = 600;

/** 單一主題三方四正星曜描述（格式沿用 analysis.ts 的 buildPrompt） */
function groupDesc(t: TopicFacts): string {
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

/** 四主題盤面事實 */
function topicsDesc(analysis: ChartAnalysis): string {
  return analysis.topics
    .map((t) => `◆ ${t.topic}主題宮位：${t.palaceName}（${t.branch}宮）三方四正\n${groupDesc(t)}`)
    .join('\n');
}

/**
 * 全部引動年份描述（邏輯沿用 buildPrompt 的 decadalDesc：
 * ≤82 歲大限、權重≥2 或流命／災宮引動），不分主題，逐筆標注所屬主題以控制長度。
 */
function allDecadalDesc(analysis: ChartAnalysis): string {
  return analysis.decadals
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
}

/** 先前對話段：assistant 長回答截到前 600 字 */
function historyDesc(history: ChatMessage[]): string {
  return history
    .map((m) => {
      if (m.role === 'user') return `命主問：${m.text}`;
      const text = m.text.length > ASSISTANT_HISTORY_LIMIT ? `${m.text.slice(0, ASSISTANT_HISTORY_LIMIT)}…（略）` : m.text;
      return `你答：${text}`;
    })
    .join('\n');
}

/** chat 模式回答要求：白話對話式短答 */
const CHAT_REQUIREMENTS = `【回答要求】
1. 只能根據上面提供的盤面事實與引動年份，不得自行安星或推算新的年份。
2. 若問題與命盤無關，禮貌地把話題拉回命盤解讀。
3. 用繁體中文，語氣專業但白話，條理分明用 markdown 條列。
4. 直接回答問題本身，不必重述整張盤。
5. 全文 400~800 字，不要免責聲明。`;

/** report 模式回答要求：結構化單題報告 */
const REPORT_REQUIREMENTS = `【回答要求】
1. 只能根據上面提供的盤面事實與引動年份，不得自行安星或推算新的年份。
2. 產出一份「單題報告」，結構化 markdown，依序包含：
   - \`# 報告標題\`（呼應本次問題）
   - \`## 結論\`：先講答案，開門見山。
   - \`## 盤面依據\`：引用星曜、亮度、四化的原因鏈，說明結論從何而來。
   - \`## 關鍵時間點\`：用 markdown 表格呈現，欄位為「年份｜干支/歲數｜引動方式｜該做什麼」。
   - \`## 行動建議\`：條列具體建議。
3. 若先前對話有相關內容，可延續其脈絡。
4. 全文 800~1500 字，用繁體中文，語氣專業但白話，不要免責聲明。`;

/** 命主自述背景段落：聊天與命書 prompt 共用；未填回空字串 */
export function profileSection(profile?: string): string {
  const p = profile?.trim();
  if (!p) return '';
  return `【命主自述背景】（命主自行填寫，僅供貼近解讀）\n${p}\n（自述中提到的事件年份可與引動年份對照驗盤，命中的引動可作為斷應期信心依據並向命主指出；解讀請貼合命主的實際處境。）`;
}

export type ReportStyle = 'plain' | 'classic';

/** 命書寫作風格段：plain 回白話規則（語感對標使用者認可的舊版報告），classic／未傳回空字串維持現行輸出 */
export function styleSection(style?: ReportStyle): string {
  if (style !== 'plain') return '';
  return `【寫作風格：白話】
1. 像跟朋友喝咖啡聊天那樣講，直接對「你」說話；短句優先，一句一個重點。
2. 每個術語（星曜、宮位、四化、格局）出現後，緊接一句生活白話翻譯它對命主的意思。
3. 多用具體生活場景與比喻，語感範例：「東西交到你手上會變穩、變大」「錢會來，也容易莫名其妙少一塊」「幫忙可以，擔保不行」。
4. 結論先講、依據後講；禁止文言堆疊、對仗排比、連續抽象形容詞。`;
}

/** 組對話用提示詞：整盤事實＋全部引動年份＋自述背景＋對話歷史＋本次問題 */
export function buildChatPrompt(
  analysis: ChartAnalysis,
  history: ChatMessage[],
  question: string,
  currentYear: number,
  mode: 'chat' | 'report' = 'chat',
  profile?: string,
  style?: ReportStyle,
): string {
  const h = analysis.header;

  const sections: string[] = [
    '你是占驗派紫微斗數論命助手，根據盤面事實回答命主的問題。以下是命主的排盤事實（占驗派 S5VoG 安星，含庚干陽武同相四化）。',
    `【命主】${h.yinYang}${h.gender}，${h.yearGz}年生（${h.lunarDate}），${h.fiveElementsClass}，命主${h.soul}、身主${h.body}。今年西元 ${currentYear} 年。`,
    `【盤面事實】\n${topicsDesc(analysis)}`,
    `【斷應期引動年份】（占驗派流命引動法＋疊星引動法，程式計算，勿自行增減；〔〕內為所屬主題）\n${allDecadalDesc(analysis)}`,
  ];

  const ps = profileSection(profile);
  if (ps) sections.push(ps);

  if (history.length > 0) {
    sections.push(`【先前對話】\n${historyDesc(history)}`);
  }

  sections.push(`【本次問題】\n${question}`);
  sections.push(mode === 'report' ? REPORT_REQUIREMENTS : CHAT_REQUIREMENTS);
  if (mode === 'report') {
    const ss = styleSection(style);
    if (ss) sections.push(ss);
  }

  return sections.join('\n\n');
}
