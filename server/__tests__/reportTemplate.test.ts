import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderBookHtml, renderReportHtml, type BookCell, type BookData, type ReportHeader } from '../reportTemplate.js';
import { parseChapterJson } from '../reportPlugin.js';

/**
 * renderBookHtml 測試：fixture BookData＋9 章假 JSON（gift 章故意給爛 JSON 驗 fallback），
 * 產出 HTML 斷言關鍵結構，並寫到 data/reports/__fixture__.html 供人工截圖。
 */

/* ---------- fixture BookData ---------- */

const PALACES: [branch: string, stem: string, name: string, lim: string][] = [
  ['戌', '甲', '命宮', '6-15'],
  ['酉', '癸', '兄弟', '16-25'],
  ['申', '壬', '夫妻', '26-35'],
  ['未', '辛', '子女', '36-45'],
  ['午', '庚', '財帛', '46-55'],
  ['巳', '己', '疾厄', '56-65'],
  ['辰', '戊', '遷移', '66-75'],
  ['卯', '丁', '僕役', '76-85'],
  ['寅', '丙', '官祿', '86-95'],
  ['丑', '丁', '田宅', '96-105'],
  ['子', '丙', '福德', '106-115'],
  ['亥', '乙', '父母', '116-125'],
];

const cells: BookCell[] = PALACES.map(([branch, stem, name, lim]) => ({
  branch,
  gz: `${stem}${branch}`,
  palaceName: name,
  lim,
  isMing: name === '命宮',
  isShen: name === '福德',
  stars:
    name === '命宮'
      ? [
          { name: '廉貞', brightness: '利', mutagen: '祿', kind: 'major' },
          { name: '天府', brightness: '廟', kind: 'major' },
          { name: '地空', kind: 'minor' },
          { name: '天姚', kind: 'adj' },
        ]
      : name === '僕役'
        ? [
            { name: '太陽', brightness: '廟', mutagen: '忌', kind: 'major' },
            { name: '擎羊', brightness: '陷', kind: 'minor' },
          ]
        : [{ name: '天機', brightness: '平', kind: 'major' }],
}));

const book: BookData = {
  meta: {
    fiveElementsClass: '火六局',
    soul: '祿存',
    body: '文昌',
    ziDou: '辰',
    natalMutText: '生年甲化：廉祿 破權 武科 陽忌',
    startAge: 6,
    birthYear: 1994,
    notes: '文墨天機安星碼 S5VoG（占驗派）｜庚干四化 陽武同相｜天馬依月支｜截空旬空占驗排法｜晚子時視為次日｜閏月月中分界',
  },
  cells,
  decadals: [
    { range: [26, 35], gz: '壬申', palaceName: '夫妻', label: '現行', isCurrent: true },
    { range: [36, 45], gz: '辛未', palaceName: '子女', label: '將行', isCurrent: false },
    { range: [46, 55], gz: '庚午', palaceName: '財帛', label: '高峰', isCurrent: false },
  ],
  events: [
    { year: 2023, gz: '癸卯', age: 30, isCurrent: false, isPast: true, marks: ['災宮引動'], weight: 2, reasons: ['癸卯年流年命宮走到大限疾厄（災宮，卯宮）→ 注意健康與災咎'] },
    { year: 2024, gz: '甲辰', age: 31, isCurrent: false, isPast: true, marks: ['同星相疊'], weight: 3, reasons: ['甲辰年流年忌為太陽，與生年忌同星相疊（卯宮）'] },
    { year: 2026, gz: '丙午', age: 33, isCurrent: true, isPast: false, marks: ['流命引動'], weight: 2, reasons: ['丙午年流年命宮走到大限夫妻（午宮）→ 愛情主題引動'] },
    { year: 2028, gz: '戊申', age: 35, isCurrent: false, isPast: false, marks: ['流命引動'], weight: 2, reasons: ['戊申年流年命宮走到大限命宮（申宮）→ 本命主題引動'] },
    { year: 2031, gz: '辛亥', age: 38, isCurrent: false, isPast: false, marks: ['流命引動', '同星相疊'], weight: 5, reasons: ['辛亥年流年命宮走到大限官祿（亥宮）→ 事業主題引動', '辛亥年流年忌為文昌，與大限忌同星相疊（酉宮）'] },
  ],
  topicLocs: {
    benming: '命宮 · 甲戌 · 廉貞(利)化祿 天府(廟) 地空',
    shiye: '官祿 · 丙寅 · 武曲(得)化科 天相(廟) 祿存',
    caiyun: '財帛 · 庚午 · 紫微(廟)',
    aiqing: '夫妻 · 壬申 · 破軍(得)化權',
  },
};

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

/* ---------- 9 章假輸出（原始文字 → parseChapterJson，同 reportPlugin 流程） ---------- */

const CHAPTER_TEXTS: Record<string, string> = {
  hero: '```json\n' + JSON.stringify({
    epithet: '藏鋒',
    seal: '府相朝垣',
    tri: [
      { k: '命 格', g: '府相朝垣', v: '天府坐命 · 廉貞化祿守命' },
      { k: '樞 紐', g: '祿在自身', v: '祿與科落在命宮和事業' },
      { k: '應 期', g: '丙午 · 今', v: '今年流年走到大限夫妻' },
    ],
    thesis: { title: '命格定調 · 一句話總結這張盤', text: '命宮天府、財帛紫微——**粗體**的經營格局，對人設好邊界即是財官雙美。' },
  }) + '\n```',
  // 故意給爛 JSON：驗證 fallback 區塊
  gift: '這一章生成失敗，模型輸出了非 JSON 的文字。\n\n- 但其他章節應照常渲染',
  topic_benming: JSON.stringify({
    desc: '天府坐命自帶穩的氣場，廉貞化祿同宮，人緣資源自己會來。',
    pros: ['穩健可靠', '人緣資源自帶', '外圓內剛', '<script>alert(1)</script>品味審美'],
    cons: ['操心體質', '想法偶爾飄', '悶氣型', '面子重'],
  }),
  topic_shiye: JSON.stringify({
    desc: '武曲化科＋天相＋祿存：以理財管錢的專業立名聲。',
    pros: ['管錢專業帶名聲', '職涯穩定', '格局大', '執行快'],
    cons: ['不適合孤軍', '行業變動', '帶人費心', '求穩過頭'],
  }),
  topic_caiyun: JSON.stringify({
    desc: '帝星紫微獨坐財帛：經手的錢會越來越大。',
    pros: ['紫微守財', '雙祿會照', '理財嗅覺好', '敢花有流動性'],
    cons: ['小錢漏口多', '面子買單', '代墊作保地雷', '存錢靠制度'],
  }),
  topic_aiqing: JSON.stringify({
    desc: '破軍化權坐夫妻宮：會被強勢能幹的人吸引。**現行大限正走夫妻宮**。',
    pros: ['對象能幹', '自身魅力好', '敢愛敢給', '婚姻加乘事業'],
    cons: ['兩強互不讓', '有空窗斷線感', '起伏大', '把對方當對手就輸'],
  }),
  lims: JSON.stringify({
    cards: [
      { title: '定情定業期', text: '大限走進夫妻宮：感情與婚姻是這十年的正題。' },
      { title: '掌權磨合期', text: '權力變大、帶的人變多，人際是非也同步放大。' },
      { title: '掌財高峰期', text: '大限走進財帛宮：一生財富格局的頂峰十年。' },
    ],
  }),
  events: JSON.stringify({
    events: [
      { year: 2023, title: '災宮踩在忌星上', desc: '健康警訊和人際是非同時來。', why: '流年命宮疊大限疾厄（卯），卯宮坐生年忌加擎羊。', advice: '這年若有身體狀況或被人拖累，就是此應。' },
      { year: 2024, title: '人的是非最重的一年', desc: '財務決定被推上檯面。', why: '流年太陽忌與生年太陽忌雙忌疊在僕役宮。', advice: '這年若因人破財受氣，就是此應。' },
      { year: 2026, title: '今年：感情定奪年', desc: '感情議題正面引動，十年僅此一次。', why: '流年命宮走到大限夫妻（午）。', advice: '感情大事可以定；錢和感情分開處理。' },
      { year: 2028, title: '十年總結年', desc: '這十年的感情與職涯在這年做總整理。', why: '流年命宮疊大限命宮（申），換限前一年。', advice: '收尾定調，不開新局。' },
      { year: 2031, title: '事業升級年', desc: '升遷、擴權、轉換舞台的機會最熟。', why: '流年命宮走到大限官祿（亥）；文昌忌疊忌（酉宮）。', advice: '機會全力爭取；文件找第二雙眼睛複核。' },
    ],
  }),
  compass: JSON.stringify({
    go: [
      { title: '往「管理與經營」走', text: '紫府武相全陣：管錢管人管資源是主場。', em: '往大平台的掌局位置走' },
      { title: '往「能累積的賽道」走', text: '天府庫星坐命：會累積的東西到手上都會長大。', em: '時間是你的朋友' },
      { title: '往「財務專業」走', text: '武曲化科坐事業：管錢的專業帶來名聲。', em: '證照與資產管理路線' },
    ],
    no: [
      { title: '人際金錢', text: '唯一的忌＋擎羊在僕役：被朋友拖累是固定劇本。', em: '幫忙不擔保、白紙黑字' },
      { title: '不知不覺的漏財', text: '地空坐命＋地劫守福德：漏口在小錢。', em: '帳戶分艙，享受有額度' },
      { title: '感情硬碰硬', text: '破軍權會七殺鈴星：兩強互不讓是關係殺手。', em: '把對方當隊友' },
      { title: '面子開銷', text: '紫府體面＋貪狼品味：排場先行最不知不覺。', em: '面子預算化' },
    ],
    attack: [
      { year: 2026, text: '感情定奪年——該定的定' },
      { year: 2031, text: '事業升級年——升遷擴權全力爭取' },
      { year: 2028, text: '總結年——把十年收成拍板' },
    ],
    defense: [
      { year: 2024, text: '雙忌疊僕役——防因人破財' },
      { year: 2028, text: '換限前一年——只收尾不開新局' },
      { year: '凡災宮年', text: '健康、合約多檢查一次' },
    ],
    avoid: [
      { title: '路線一別走：替人扛錢', text: '唯一的化忌加擎羊坐僕役宮，被人拖累是固定劇本。', instead: '幫忙可以、擔保不行；合作一律白紙黑字。' },
      { title: '路線二別走：沒有制度的花錢', text: '空劫一頭一尾夾著，錢會被不知不覺磨掉。', instead: '帳戶分艙；大額支出過一夜再決定。' },
      { title: '路線三別走：感情裡硬碰硬', text: '兩強相遇互不讓，是關係最快的毀滅方式。', instead: '把對方當隊友，吵架就事論事。' },
    ],
    final: { title: '一句話記住這張盤', text: '好運長在自己身上，風險都從「人」和「不知不覺」進來——邊界立好，鋒只在該出手時出。' },
  }),
};

function buildChapters(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, text] of Object.entries(CHAPTER_TEXTS)) {
    out[key] = parseChapterJson(text) ?? { __fallbackMd: text };
  }
  return out;
}

/* ---------- tests ---------- */

describe('parseChapterJson', () => {
  it('剝 code fence 後取 JSON 物件', () => {
    const v = parseChapterJson(CHAPTER_TEXTS.hero);
    expect(v).not.toBeNull();
    expect(v!.epithet).toBe('藏鋒');
  });

  it('前後有雜訊文字仍可取第一個 { 到最後一個 }', () => {
    const v = parseChapterJson('好的，以下是結果：\n{"a":1}\n以上。');
    expect(v).toEqual({ a: 1 });
  });

  it('非 JSON 文字回 null', () => {
    expect(parseChapterJson(CHAPTER_TEXTS.gift)).toBeNull();
    expect(parseChapterJson('{"broken": ')).toBeNull();
    expect(parseChapterJson('[1,2,3]')).toBeNull();
  });
});

describe('renderBookHtml', () => {
  const html = renderBookHtml({
    title: '測試・完整命書',
    name: '測試命主',
    header,
    book,
    chapters: buildChapters(),
    generatedAt: '2026/7/11 12:00:00',
  });

  it('命盤方圖：含 .board 與 12 宮名、命宮／身宮標記、四化與大限標', () => {
    expect(html).toContain('class="board"');
    for (const [, , name] of PALACES) expect(html).toContain(`<span class="gname">${name}</span>`);
    expect(html).toContain('<span class="tag cm">命宮</span>');
    expect(html).toContain('<span class="tag ly">身宮</span>');
    expect(html).toContain('class="hua lu"');
    expect(html).toContain('class="hua ji"');
    expect(html).toContain('<span class="lim">6-15</span>');
    expect(html).toContain('生年甲化：');
  });

  it('hero：大標雅號、tri 三卡與 thesis（**粗體** 轉 <b>）', () => {
    expect(html).toContain('<div class="title">藏鋒</div>');
    expect(html).toContain('class="tri"');
    expect(html).toContain('href="#zw"');
    expect(html).toContain('href="#topics"');
    expect(html).toContain('href="#timing"');
    expect(html).toContain('<div class="seal">府相朝垣</div>');
    expect(html).toContain('<b>粗體</b>');
    expect(html).not.toContain('**粗體**');
  });

  it('gift 章爛 JSON → fallback 區塊出現，其他區塊照常', () => {
    expect(html).toContain('這一章生成失敗，模型輸出了非 JSON 的文字。');
    expect(html).toContain('<div class="read in">');
    expect(html).toContain('<h2>天賦印象</h2>');
    // 其他區塊照常
    expect(html).toContain('class="compass read"');
    expect(html).toContain('class="lims read"');
  });

  it('四主題：loc 行與 desc／pros／cons，插值有 escape', () => {
    expect(html).toContain('命宮 · 甲戌 · 廉貞(利)化祿 天府(廟) 地空');
    expect(html).toContain('夫妻 · 壬申 · 破軍(得)化權');
    expect(html).toContain('class="col pro"');
    expect(html).toContain('class="col con"');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('大限三卡：rng 年份換算、badge、現行卡 now class', () => {
    expect(html).toContain('26 – 35 歲 · 2019 – 2028');
    expect(html).toContain('46 – 55 歲 · 2039 – 2048');
    expect(html).toContain('<span class="badge">現行</span>');
    expect(html).toContain('<span class="badge">高峰</span>');
    expect(html).toContain('class="limcard now"');
    expect(html).toContain('定情定業期');
  });

  it('應期時間軸：全部事件年份、mk 分級、今年 hot、為什麼／建議鏈', () => {
    for (const e of book.events) expect(html).toContain(`<div class="yy">${e.year}</div>`);
    expect(html).toContain('<span class="mk m2">災宮引動</span>'); // 2023
    expect(html).toContain('<span class="mk m3">雙忌</span>'); // 2024 權重3＋忌
    expect(html).toContain('class="ev hot"'); // 2026 今年
    expect(html).toContain('丙午 · 33歲 · 今年');
    expect(html).toContain('<em>為什麼</em>');
    expect(html).toContain('<em>建議</em>');
    expect(html).toContain('<em>驗證點</em>');
  });

  it('重點應期分過往對答案與未來引動兩段', () => {
    // 過往與未來兩段標題
    expect(html).toContain('過往對答案');
    expect(html).toContain('未來引動');
    // 過往年份（2023/2024）的鏈尾標籤是驗證點，未來是建議
    expect(html).toContain('<em>驗證點</em>');
    expect(html).toContain('<em>建議</em>');
    expect(html).not.toContain('<em>回看</em>');
    // 過往段在未來段之前
    expect(html.indexOf('過往對答案')).toBeLessThan(html.indexOf('未來引動'));
  });

  it('人生羅盤與知命改命：go/no、攻守年曆、avoid 與 final', () => {
    expect(html).toContain('class="cside go"');
    expect(html).toContain('class="cside no"');
    expect(html).toContain('class="side atk"');
    expect(html).toContain('class="side def"');
    expect(html).toContain('class="avoid"');
    expect(html).toContain('路線一別走：替人扛錢');
    expect(html).toContain('凡災宮年');
    expect(html).toContain('一句話記住這張盤');
  });

  it('footer 與 script：安星碼行、星空與 IntersectionObserver', () => {
    expect(html).toContain('文墨天機安星碼 S5VoG（占驗派）');
    expect(html).toContain('IntersectionObserver');
    expect(html).toContain('id="sky"');
  });

  it('寫出 data/reports/__fixture__.html 供人工截圖', () => {
    const dir = join(process.cwd(), 'data', 'reports');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '__fixture__.html'), html);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });
});

describe('頁尾模型標記 modelLabel', () => {
  const LABEL = 'Antigravity・Gemini 3.1 Pro (High)';
  const bookOpts = {
    title: '測試・完整命書',
    name: '測試命主',
    header,
    book,
    chapters: buildChapters(),
    generatedAt: '2026/7/11 12:00:00',
  };
  const reportOpts = {
    title: '單題測試',
    name: '測試命主',
    header,
    sections: [{ title: '', markdown: '內文' }],
    generatedAt: '2026/7/11 12:00:00',
  };

  it('renderBookHtml：有帶時頁尾生成時間旁出現', () => {
    const html = renderBookHtml({ ...bookOpts, modelLabel: LABEL });
    expect(html).toContain(`本命書於 2026/7/11 12:00:00 生成・${LABEL}`);
  });

  it('renderBookHtml：沒帶時不出現', () => {
    const html = renderBookHtml(bookOpts);
    expect(html).toContain('本命書於 2026/7/11 12:00:00 生成<');
    expect(html).not.toContain(LABEL);
  });

  it('renderReportHtml：有帶時頁尾生成時間旁出現（含 escape）', () => {
    const html = renderReportHtml({ ...reportOpts, modelLabel: 'Claude・Opus <b>（深入）' });
    expect(html).toContain('本報告於 2026/7/11 12:00:00 生成・Claude・Opus &lt;b&gt;（深入）');
    expect(html).not.toContain('Opus <b>'); // 插值有 escape
  });

  it('renderReportHtml：沒帶時不出現', () => {
    const html = renderReportHtml(reportOpts);
    expect(html).toContain('本報告於 2026/7/11 12:00:00 生成 ·');
    expect(html).not.toContain(LABEL);
  });
});
