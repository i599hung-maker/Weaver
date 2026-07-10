# 完整命書 v2 — 視覺化命書自動生成規格

目標：讓「產生完整命書」的自動化管道，產出 `reports/huang-1994-full.html` 那種視覺化命書
（hero＋天賦印象＋十二宮命盤方圖＋大限三卡＋應期時間軸＋人生羅盤＋知命改命），
取代目前 `server/reportTemplate.ts` 的逐章文章版型。

核心原則：**盤面等確定性資料由程式直接填，文字內容由 Claude 以 JSON 槽位生成。**

## 架構總覽

```
RightPanel.generate()
  ├─ buildBookData(result, analysis, currentYear)   ← 新（純程式，確定性資料）
  ├─ buildBookChapters(analysis, book, currentYear) ← 新（9 章，每章要求 Claude 輸出 JSON）
  └─ POST /api/report/:key/generate { title, name, header, book, chapters }

server/reportPlugin.ts runGenerateJob
  ├─ 逐章 callClaudeCli(prompt) → 文字
  ├─ parseChapterJson(text) → object | null（容錯：剝 code fence、取第一個 { 到最後一個 }）
  └─ renderBookHtml({ title, name, header, book, chapters, generatedAt }) → data/reports/<key>.html
```

- 舊的 `renderReportHtml`（sections markdown）**保留**：單題報告頁 `POST /:key/render` continues使用。
- generate body 若無 `book` 欄位 → 走舊路徑（向後相容）。

## 新檔案／修改

| 檔案 | 動作 |
|---|---|
| `src/analysis/reportBook.ts` | 新增：`BookData` 型別、`buildBookData()`、`buildBookChapters()`、`selectKeyEvents()` |
| `server/reportTemplate.ts` | 新增 `renderBookHtml()` 與 server 端 `BookData` 同構型別；保留舊函式 |
| `server/reportPlugin.ts` | generate 接受 `book`；JSON 解析；組裝全書 |
| `src/components/RightPanel.tsx` | generate() 改用新模組組 body |
| `server/__tests__/reportTemplate.test.ts` | 新增：fixture book + 假章節 JSON → renderBookHtml，驗證關鍵結構，並把 HTML 寫到 `data/reports/__fixture__.html` 供人工截圖 |

## BookData 型別（client 與 server 同構，各自定義避免跨 tsconfig）

```ts
interface BookStar { name: string; brightness?: string; mutagen?: string; kind: 'major' | 'minor' | 'adj' }
interface BookCell {
  branch: string;            // 地支
  gz: string;                // 天干+地支，如 甲戌
  palaceName: string;        // 命宮/兄弟/...
  lim: string;               // "6-15"
  isMing: boolean;
  isShen: boolean;           // isBodyPalace
  stars: BookStar[];
}
interface BookDecadal {
  range: [number, number];
  gz: string;                // 壬申
  palaceName: string;        // 該大限走到的本命宮名（=大限命宮所在的本命宮）
  label: '現行' | '將行' | '高峰' | '';   // 前兩個固定現行/將行，第三個標高峰
  isCurrent: boolean;
}
interface BookEvent {
  year: number; gz: string; age: number;
  isCurrent: boolean;        // year === currentYear
  isPast: boolean;
  marks: string[];           // 命中方法去重：流命引動/災宮引動/同星相疊/四化交會
  weight: number;            // 該年總權重
  reasons: string[];         // 引擎 reason 原文（給 Claude 用，也放進 chain 區）
}
interface BookData {
  meta: {
    fiveElementsClass: string; soul: string; body: string; ziDou: string;
    natalMutText: string;       // 例 "生年甲化：廉祿 破權 武科 陽忌"（星名取首字）
    startAge: number;           // 命宮大限起始歲
    notes: string;              // 排盤規則一行（同 RightPanel footer 文案）
  };
  cells: BookCell[];            // 12 宮
  decadals: BookDecadal[];      // 3 張卡：現行大限＋之後兩個
  events: BookEvent[];          // selectKeyEvents 結果（≤8，年份升冪）
}
```

### buildBookData 實作要點
- `cells`：迭代 `result.astrolabe.palaces`；stars = majorStars(kind major) + minorStars(minor) + adjectiveStars(adj)；
  mutagen 取 iztro 的 `s.mutagen`（生年四化）。`gz = p.heavenlyStem + p.earthlyBranch`；`lim` 用 `p.decadal.range`；
  `isShen = p.isBodyPalace`。
- `meta.natalMutText`：`ZHANYAN_MUTAGENS[meta.yearStem]` 依序為 [祿,權,科,忌]，取每星首字：`生年${yearStem}化：${star0[0]}祿 ${star1[0]}權 ${star2[0]}科 ${star3[0]}忌`。
- `decadals`：從 `analysis.decadals` 找 currentYear 落在哪個大限（用 birthYear+range 換算年份），取該限與後兩限；
  palaceName：`astrolabe.palaces.find(p => p.earthlyBranch === d.daMingBranch)!.name`。label 依序 現行/將行/高峰。
- `selectKeyEvents(analysis, currentYear)`：把所有大限 hits 攤平、依年份 group（僅收 weight>=2 或 method 為 流命引動/災宮引動 的 hit）；
  年份範圍 [currentYear-6, currentYear+22]；每年 weight 加總、reasons 收集、marks 去重。
  排序取權重前 8 名，再依年份升冪。若 currentYear 有命中，**必收**。

## 章節規格（buildBookChapters，共 9 章，每章 prompt 要求「只輸出一個 JSON 物件，不要 code fence、不要其他文字」）

所有 prompt 開頭沿用現有事實區塊（`headerDesc`、`groupDesc`、引動年份清單——重用 reportPrompts.ts 既有 helper，可把它們 export）。
文字值內允許 `**粗體**`（模板轉 `<b>`），禁止其他 HTML/markdown。

| key | title（進度顯示用） | JSON schema |
|---|---|---|
| `hero` | 開卷 | `{ epithet: string(2字雅號，如 藏鋒), seal: string(4字格局，如 府相朝垣), tri: [{k:'命 格',g:string(≤6字),v:string(≤30字)},{k:'樞 紐',...},{k:'應 期',...}], thesis: { title: string, text: string(120~200字) } }`（事實給命宮三方四正＋四主題簡表＋今年年份） |
| `gift` | 天賦印象 | `{ personaTitle: string(≤10字), personaTags: string[4], personaText: string(≤80字), goodWords: [{w:string(2~4字), lv:1|2|3|4}](10~12個), badWords: 同左(8~10個), gifts: [{title:string(≤12字), text:string(80~140字)}](4個), flashes: [{title, text}](3個), weaks: [{title, text, tip:string}](3個) }` |
| `topic_benming` | 性格 | `{ desc: string(150~220字), pros: string[4], cons: string[4] }`（事實＝本命主題三方四正） |
| `topic_shiye` | 事業 | 同上（官祿） |
| `topic_caiyun` | 金錢 | 同上（財帛） |
| `topic_aiqing` | 感情 | 同上（夫妻；提示現行大限是否走夫妻） |
| `lims` | 大限走勢 | `{ cards: [{title:string(≤6字，如 定情定業期), text:string(100~160字)}] }`——cards 數量＝book.decadals 數量，prompt 逐一列出每張卡的 range/gz/宮名與該限 notes、重點 hits |
| `events` | 重點應期 | `{ events: [{year:number, title:string(≤16字), desc:string(40~80字), why:string(60~120字), advice?:string(≤60字)}] }`——year 必須一一對應 book.events 的年份（prompt 明示年份清單與各年 reasons，требуется全部涵蓋、不得新增年份） |
| `compass` | 人生羅盤 | `{ go: [{title:string(≤14字), text:string, em:string(≤30字)}](3~4), no: [{title, text, em}](4~5), attack: [{year:number, text:string(≤26字)}](3~4，從 events 年份挑), defense: [{year:number|string, text}](3~4，可含「凡災宮年」型字串), avoid: [{title:string(路線N別走：...), text:string, instead:string}](3~4), final: { title: string, text: string } }` |

Prompt 共通要求：繁體中文、占驗派語氣專業白話、只依提供事實、不得自行安星或新增年份、**只輸出 JSON**。

## renderBookHtml 版型

**以 `reports/huang-1994-full.html` 為準**（實作前先完整讀該檔），結構與 CSS 幾乎原樣移植，差異：

1. CSS 原樣複製（含字體 link、星空、動畫、RWD、print 不需另做）。
2. header hero：
   - `.title` = hero.epithet、`.sub` = 性別/國曆/真太陽時（由 header 欄位組）、`.note` = 農曆＋五行局＋命宮支＋安星碼行（由 book.meta 組）
   - `.tri` 三卡 = hero.tri（a 連結錨點 #zw/#topics/#timing 保留）
3. 壹 天賦印象 = gift 章：persona（title/tags/text）、cloudwrap（good/bad words，lv→w1..w4 class）、gift 區塊 4 個、fx flash/weak（weak 的 tip 放 `.tip`）。
4. 貳 命盤·十二宮：
   - `.board`：**由 book.cells 程式生成**。grid 位置 mapping（與 src/components/Chart.tsx 的 GRID_POS 同構）：
     row1: 巳 午 未 申｜row2: 辰 [core] 酉｜row3: 卯 [core] 戌｜row4: 寅 丑 子 亥。
     HTML 子元素順序：巳午未申、辰、core、酉、卯、戌、寅丑子亥（core 用 grid-column:2/4 grid-row:2/4，其餘 cell 自動流排即可——與參考檔相同）。
   - cell 內：stars（major→`.star.maj`＋亮度 `.br`＋四化 `.hua .lu/.quan/.ke/.ji`；minor→`.min`；adj→`.adj`）、
     `.lim`＝lim、`.foot`＝宮名＋直書 gz。isMing → cell 加 `ming` class＋`<span class="tag cm">命宮</span>`；isShen → `<span class="tag ly">身宮</span>`。
   - core：`.seal`＝hero.seal、dl＝soul/body/五行局/起運歲/natalMutText/子斗。
   - legend 保留＋book.meta.notes。
   - `.thesis`＝hero.thesis。
   - topics 區（#topics）：性/業/財/情 四段，glyph 字取 性/業/財/情，loc 行由對應 TopicFacts 組（宮名·干支·本宮主星清單——由 client 放進 book？→ 簡化：loc 行在 client 組好放進 BookData：`topicLocs: Record<'benming'|'shiye'|'caiyun'|'aiqing', string>`，加進 BookData.meta 旁），desc/pros/cons 由 topic_* 章 JSON 填。
5. 參 大限走勢：`.lims` 三卡＝book.decadals（rng 行程式組：`${range[0]} – ${range[1]} 歲 · ${起年} – ${迄年}`，起年=birthYear+range[0]-1；badge=label）＋ lims 章 title/text。※BookData.meta 需帶 `birthYear`。
6. 肆 重點應期：`.tl` 事件＝book.events join events 章 JSON（以 year 對應）。
   - `.y`：year、gz2＝`${gz} · ${age}歲${isCurrent?' · 今年':''}`、mk class：災宮引動→m2、含「忌」字樣 reasons 且 weight>=3→m3，其餘→m1；mk 文字用 marks[0]（或「雙忌」當 weight>=3）。
   - 內容：title/desc（Claude）＋`.chain`：`<em>為什麼</em>：{why}`＋（isPast?`<em>回看</em>`:`<em>建議</em>`)：advice 或 desc 尾註。isCurrent → `.ev.hot`。
7. 伍 人生羅盤＝compass.go/no。
8. 陸 知命改命：cal atk/def＝compass.attack/defense；avoid 區塊＝compass.avoid；結尾 `.thesis`＝compass.final。
9. footer：與參考檔同款文案（安星碼行用 book.meta.notes）。
10. `<script>` 星空與 IntersectionObserver 原樣保留。

**容錯**：任何章節 JSON 解析失敗或缺欄位 → 該區塊改渲染 fallback：`<div class="sys"><div class="syshead"><h2>{title}</h2></div><div class="read in">{markdownToHtml(原始文字)}</div></div>`，其他區塊照常。文字插值一律先 escapeHtml 再把 `**x**` 轉 `<b>x</b>`（寫一個 `slot()` helper）。缺 hero.seal 時 core seal 顯示命宮主星前兩顆。

## server/reportPlugin.ts 修改

- `GenerateBody` 加 `book?: BookData` 與 `topicLocs`（含在 book 內）。
- runGenerateJob：全部章節生成完成後：
  - 若有 book → `chaptersParsed[key] = parseChapterJson(text) ?? { __fallbackMd: text }`，呼叫 `renderBookHtml`。
  - 無 book → 舊 renderReportHtml。
- `parseChapterJson`: 剝 ```json fence → 取 `text.indexOf('{')` 到 `text.lastIndexOf('}')` → JSON.parse → 失敗回 null。

## 驗證要求（實作 agent 必做）

1. `npx tsc -b --noEmit` 全綠。
2. `npx vitest run server/__tests__/reportTemplate.test.ts` 通過：fixture BookData（可用假資料 12 宮）＋9 章假 JSON → 產出 HTML 字串包含：`.board`、12 個宮名、`class="tri"`、`.tl` 事件年份、`.avoid`、fallback 測試（其中一章給爛 JSON，斷言 fallback 區塊出現且其他區塊正常）。測試同時把 HTML 寫到 `data/reports/__fixture__.html`。
3. 既有測試 `npm test` 不能壞。
4. 不要動 dev server（由主線程重啟）。

## 注意

- client 端新檔案盡量重用 reportPrompts.ts 既有 helper（groupDesc/headerDesc 可 export 後 import）。
- RightPanel 的 `buildFullReportChapters` 呼叫點改為新模組；`buildReportHeader` 沿用。
- 章節數改變（6→9），進度 total 自動跟著 body.chapters 走，前端無需改。
- 程式碼風格照專案慣例：繁中註解、精簡。
