import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { renderBookMarkdown, renderReportMarkdown } from '../reportMarkdown.js';
import { handleExport } from '../reportPlugin.js';
import type { BookCell, BookData, ReportHeader } from '../reportTemplate.js';

/**
 * MD 輸出測試：
 * - renderBookMarkdown：正常槽位轉出各章標題與內容、__fallbackMd 原文保留、modelLabel 有帶才出現
 * - renderReportMarkdown：單題組字（title／question／sections；空 title 不輸出 ##）
 * - handleExport format=md：檔案存在回 text/markdown、不存在回 404 提示
 */

/* ---------- fixture（精簡版，欄位對照 reportTemplate.test.ts） ---------- */

const header: ReportHeader = {
  gender: '女',
  yinYang: '陽',
  yearGz: '甲戌',
  lunarDate: '甲戌年十月三十',
  fiveElementsClass: '火六局',
  soul: '祿存',
  body: '文昌',
  clockDate: '1994-12-02',
  clockTime: '02:43',
  solarDate: '1994-12-02',
  solarTime: '02:59',
};

const cells: BookCell[] = [
  {
    branch: '戌',
    gz: '甲戌',
    palaceName: '命宮',
    lim: '6-15',
    isMing: true,
    isShen: false,
    stars: [
      { name: '廉貞', brightness: '利', mutagen: '祿', kind: 'major' },
      { name: '天府', brightness: '廟', kind: 'major' },
    ],
  },
  { branch: '子', gz: '丙子', palaceName: '福德', lim: '106-115', isMing: false, isShen: true, stars: [] },
];

const book: BookData = {
  meta: {
    fiveElementsClass: '火六局',
    soul: '祿存',
    body: '文昌',
    ziDou: '辰',
    natalMutText: '生年甲化：廉祿 破權 武科 陽忌',
    startAge: 6,
    birthYear: 1994,
    notes: '文墨天機安星碼 S5VoG（占驗派）',
  },
  cells,
  decadals: [
    { range: [26, 35], gz: '壬申', palaceName: '夫妻', label: '現行', isCurrent: true },
    { range: [36, 45], gz: '辛未', palaceName: '子女', label: '將行', isCurrent: false },
  ],
  events: [
    { year: 2023, gz: '癸卯', age: 30, isCurrent: false, isPast: true, marks: ['災宮引動'], weight: 2, reasons: ['流年命宮走到大限疾厄'] },
    { year: 2026, gz: '丙午', age: 33, isCurrent: true, isPast: false, marks: ['流命引動'], weight: 2, reasons: ['流年命宮走到大限夫妻'] },
  ],
  topicLocs: {
    benming: '命宮 · 甲戌 · 廉貞(利)化祿 天府(廟)',
    shiye: '官祿 · 丙寅 · 武曲(得)化科',
    caiyun: '財帛 · 庚午 · 紫微(廟)',
    aiqing: '夫妻 · 壬申 · 破軍(得)化權',
  },
};

const topic = (desc: string) => ({ desc, pros: ['優勢一', '優勢二'], cons: ['劣勢一', '劣勢二'] });

function buildChapters(): Record<string, unknown> {
  return {
    hero: {
      epithet: '藏鋒',
      seal: '府相朝垣',
      tri: [
        { k: '命 格', g: '府相朝垣', v: '天府坐命' },
        { k: '樞 紐', g: '祿在自身', v: '祿科在命與事業' },
        { k: '應 期', g: '丙午 · 今', v: '流年走到大限夫妻' },
      ],
      thesis: { title: '命格定調', text: '對人設好邊界即是財官雙美。' },
    },
    // gift 章故意給 fallback：驗證原始文字保留
    gift: { __fallbackMd: '這一章生成失敗，模型輸出了非 JSON 的文字。\n\n- 但其他章節應照常輸出' },
    topic_benming: topic('天府坐命自帶穩的氣場。'),
    topic_shiye: topic('以理財管錢的專業立名聲。'),
    topic_caiyun: topic('經手的錢會越來越大。'),
    topic_aiqing: topic('會被強勢能幹的人吸引。'),
    lims: {
      cards: [
        { title: '定情定業期', text: '感情與婚姻是這十年的正題。' },
        { title: '掌權磨合期', text: '權力變大、人際是非同步放大。' },
      ],
    },
    events: {
      events: [
        { year: 2023, title: '災宮踩在忌星上', desc: '健康警訊。', why: '流年命宮疊大限疾厄。', advice: '有身體狀況就是此應。' },
        { year: 2026, title: '今年：感情定奪年', desc: '感情議題正面引動。', why: '流年命宮走到大限夫妻。', advice: '感情大事可以定。' },
      ],
    },
    compass: {
      go: [{ title: '往管理走', text: '管錢管人是主場。', em: '往掌局位置走' }],
      no: [{ title: '人際金錢', text: '被朋友拖累是固定劇本。', em: '白紙黑字' }],
      attack: [{ year: 2026, text: '感情定奪年' }],
      defense: [{ year: '凡災宮年', text: '合約多檢查一次' }],
      avoid: [{ title: '路線一別走：替人扛錢', text: '被人拖累是固定劇本。', instead: '擔保不行。' }],
      final: { title: '一句話記住這張盤', text: '邊界立好，鋒只在該出手時出。' },
    },
  };
}

const bookOpts = {
  title: '測試・完整命書',
  name: '測試命主',
  header,
  book,
  chapters: buildChapters(),
  generatedAt: '2026/7/11 12:00:00',
};

/* ---------- renderBookMarkdown ---------- */

describe('renderBookMarkdown', () => {
  const md = renderBookMarkdown(bookOpts);

  it('檔頭：# 標題、命主、生成時間、命盤摘要與盤面摘要', () => {
    expect(md).toContain('# 測試・完整命書');
    expect(md).toContain('命主：測試命主｜生成時間：2026/7/11 12:00:00');
    expect(md).toContain('命盤：陽女・年干支 甲戌・農曆 甲戌年十月三十・火六局・命主 祿存・身主 文昌');
    expect(md).toContain('時間：鐘錶 1994-12-02 02:43・真太陽 1994-12-02 02:59');
    expect(md).toContain('盤面：廉貞天府坐命・身在福德・生年甲化：廉祿 破權 武科 陽忌・大限 6 歲起');
  });

  it('各章標題與槽位內容都轉出', () => {
    expect(md).toContain('## 開卷');
    expect(md).toContain('雅號：藏鋒｜印：府相朝垣');
    expect(md).toContain('- 命 格｜府相朝垣：天府坐命');
    expect(md).toContain('**命格定調**');
    expect(md).toContain('## 命盤 · 十二宮');
    expect(md).toContain('### 性格');
    expect(md).toContain('宮位：命宮 · 甲戌 · 廉貞(利)化祿 天府(廟)');
    expect(md).toContain('- 優勢一');
    expect(md).toContain('- 劣勢二');
    expect(md).toContain('## 大限走勢');
    expect(md).toContain('### 26 – 35 歲 · 2019 – 2028（現行）定情定業期');
    expect(md).toContain('## 重點應期');
    expect(md).toContain('#### 2023 癸卯 · 30歲（災宮引動）災宮踩在忌星上');
    expect(md).toContain('#### 2026 丙午 · 33歲 · 今年（流命引動）今年：感情定奪年');
    expect(md).toContain('- 為什麼：流年命宮疊大限疾厄。');
    expect(md).toContain('- 驗證點：有身體狀況就是此應。'); // 過去年份為驗證點
    expect(md).toContain('- 建議：感情大事可以定。');
    expect(md).toContain('## 人生羅盤');
    expect(md).toContain('- **往管理走**：管錢管人是主場。（往掌局位置走）');
    expect(md).toContain('## 知命改命');
    expect(md).toContain('- **凡災宮年**：合約多檢查一次');
    expect(md).toContain('### 路線一別走：替人扛錢');
    expect(md).toContain('改走這條：擔保不行。');
    expect(md).toContain('**一句話記住這張盤**：邊界立好，鋒只在該出手時出。');
    expect(md).toContain('文墨天機安星碼 S5VoG（占驗派）');
  });

  it('重點應期分過往對答案與未來引動兩小節', () => {
    expect(md).toContain('### 過往對答案');
    expect(md).toContain('### 未來引動');
    expect(md).toContain('- 驗證點：有身體狀況就是此應。');
    expect(md).toContain('- 建議：感情大事可以定。');
    expect(md).not.toContain('- 回看：');
    expect(md).toContain('#### 2023 癸卯 · 30歲（災宮引動）災宮踩在忌星上');
    expect(md.indexOf('### 過往對答案')).toBeLessThan(md.indexOf('### 未來引動'));
  });

  it('__fallbackMd 章節原文保留，其他章節照常', () => {
    expect(md).toContain('## 天賦印象');
    expect(md).toContain('這一章生成失敗，模型輸出了非 JSON 的文字。');
    expect(md).toContain('- 但其他章節應照常輸出');
    expect(md).toContain('## 大限走勢');
  });

  it('modelLabel 有帶出現在檔頭、沒帶不出現', () => {
    const label = 'Antigravity・Gemini 3.1 Pro (High)';
    const withLabel = renderBookMarkdown({ ...bookOpts, modelLabel: label });
    expect(withLabel).toContain(`命主：測試命主｜生成時間：2026/7/11 12:00:00｜模型：${label}`);
    expect(md).not.toContain('模型：');
  });
});

/* ---------- renderReportMarkdown（單題） ---------- */

describe('renderReportMarkdown', () => {
  const opts = {
    title: '單題測試',
    name: '測試命主',
    header,
    sections: [
      { title: '結論', markdown: '## 小標\n\n內文一。' },
      { title: '', markdown: '無標題段落。' },
    ],
    generatedAt: '2026/7/11 12:00:00',
    question: '2032 年適合創業嗎？',
  };

  it('title／question／sections 齊全', () => {
    const md = renderReportMarkdown(opts);
    expect(md).toContain('# 單題測試');
    expect(md).toContain('命主：測試命主｜生成時間：2026/7/11 12:00:00');
    expect(md).toContain('命盤：陽女・年干支 甲戌');
    expect(md).toContain('> 提問：2032 年適合創業嗎？');
    expect(md).toContain('## 結論');
    expect(md).toContain('## 小標');
    expect(md).toContain('內文一。');
    expect(md).toContain('無標題段落。');
  });

  it('空 section title 不輸出 ##；question／modelLabel 沒帶不出現', () => {
    const md = renderReportMarkdown({ ...opts, question: undefined });
    expect(md).not.toContain('## \n');
    expect(md).not.toContain('> 提問');
    expect(md).not.toContain('模型：');
    const withLabel = renderReportMarkdown({ ...opts, modelLabel: 'Claude・Opus（深入）' });
    expect(withLabel).toContain('｜模型：Claude・Opus（深入）');
  });
});

/* ---------- handleExport format=md ---------- */

/** 假 ServerResponse：只收 statusCode／header／body 供斷言 */
function fakeRes() {
  const headers: Record<string, string> = {};
  const r = {
    statusCode: 0,
    body: '',
    headers,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    end(chunk?: unknown) {
      r.body = String(chunk ?? '');
    },
  };
  return r;
}

describe('handleExport format=md', () => {
  const DIR = join(process.cwd(), 'data', 'reports');

  it('檔案存在：回 200 text/markdown 與檔案內容', async () => {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, 'q_mdtest.md'), '# 測試報告\n\n內文。\n');
    const res = fakeRes();
    await handleExport('q_mdtest', JSON.stringify({ format: 'md' }), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8');
    expect(res.body).toContain('# 測試報告');
    rmSync(join(DIR, 'q_mdtest.md'), { force: true });
  });

  it('檔案不存在：回 404 與重新產生提示', async () => {
    const res = fakeRes();
    await handleExport('q_md_nonexistent', JSON.stringify({ format: 'md' }), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: '此報告尚無 MD 檔，重新產生後即可下載' });
  });
});
