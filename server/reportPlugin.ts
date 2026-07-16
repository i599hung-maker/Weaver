import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { AiTimeoutError, callAi } from './aiCall.js';
import { renderBookHtml, renderReportHtml, type BookData, type ReportHeader, type ReportSection } from './reportTemplate.js';
import { renderBookMarkdown, renderReportMarkdown } from './reportMarkdown.js';

/**
 * 命書報告產生（dev middleware，掛 /api/report）：
 * - POST /api/report/:key/generate → 背景逐章呼叫 claude 生成，寫 data/reports/<key>.html 與 <key>.md
 * - POST /api/report/:key/render   → 同步以現成 markdown 段落渲染寫檔（不呼叫 claude），同步存 <key>.md
 * - GET  /api/report/:key/status   → { status, done, total, error?, updatedAt? }
 * - GET  /api/report/:key          → 回報告 HTML
 */

const REPORT_DIR = join(process.cwd(), 'data', 'reports');

interface ReportChapterSpec {
  key: string;
  title: string;
  prompt: string;
}

interface GenerateBody {
  title: string;
  name: string;
  header: ReportHeader;
  chapters: ReportChapterSpec[];
  /** AI 供應商/模型（未帶預設 claude/opus） */
  provider?: string;
  model?: string;
  /** 頁尾標記用的顯示字串（前端組好，如「Antigravity・Gemini 3.1 Pro (High)」）；伺服器只透傳給模板 */
  modelLabel?: string;
  /** 視覺化命書 v2：有 book 走 renderBookHtml（章節輸出為 JSON 槽位），無則走舊版逐章文章 */
  book?: BookData;
}

interface RenderBody {
  title: string;
  name: string;
  header: ReportHeader;
  sections: ReportSection[];
  /** 原始提問：報告頁標題下方的小字 */
  question?: string;
  /** 頁尾標記用的顯示字串（前端組好）；伺服器只透傳給模板 */
  modelLabel?: string;
}

interface StatusFile {
  status: 'running' | 'done' | 'error';
  done: number;
  total: number;
  error?: string;
  updatedAt: string;
}

/** in-memory 活 job：dev server 重啟後為空，用來偵測「生成中斷」 */
const jobs = new Set<string>();

/** 合法 key（防路徑穿越） */
function isValidKey(key: string): boolean {
  return /^[a-z0-9_-]+$/i.test(key);
}

function htmlPath(key: string): string {
  return join(REPORT_DIR, `${key}.html`);
}

function statusPath(key: string): string {
  return join(REPORT_DIR, `${key}.status.json`);
}

function mdPath(key: string): string {
  return join(REPORT_DIR, `${key}.md`);
}

function partialPath(key: string): string {
  return join(REPORT_DIR, `${key}.chapters.json`);
}

function ensureDir(): void {
  mkdirSync(REPORT_DIR, { recursive: true });
}

function writeStatus(key: string, s: Omit<StatusFile, 'updatedAt'>): void {
  ensureDir();
  const payload: StatusFile = { ...s, updatedAt: new Date().toISOString() };
  writeFileSync(statusPath(key), JSON.stringify(payload, null, 2));
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    // 收集 Buffer 後一次性以 UTF-8 解碼：避免多位元組中文字被切在 chunk 邊界而亂碼
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function nowLabel(): string {
  return new Date().toLocaleString('zh-TW', { hour12: false });
}

/** 章節 JSON 容錯解析：剝 code fence → 取第一個 { 到最後一個 } → JSON.parse，失敗回 null */
export function parseChapterJson(text: string): Record<string, unknown> | null {
  const stripped = text.replace(/```(?:json)?/gi, '');
  const a = stripped.indexOf('{');
  const b = stripped.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const v: unknown = JSON.parse(stripped.slice(a, b + 1));
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ---------- 章節續跑（partial 檔） ----------
 * 逐章生成每完成一章就寫進 <key>.chapters.json；中途失敗（逾時、CLI 掛掉、dev server 重啟）
 * 後用同 key 重新產生時，provider/model/prompt 都沒變的章節直接沿用，只補跑缺的。
 * 全書完成即刪 partial 檔——「重新產生已完成的命書」用新 key，天然不會誤沿用。 */

interface PartialFile {
  provider: string;
  model: string;
  chapters: Record<string, { hash: string; text: string }>;
}

export function promptHash(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
}

/** 毀損或格式不符一律當無檔：續跑只是最佳化，不能因它壞掉擋住生成 */
function readPartialFile(key: string): PartialFile | null {
  try {
    const v = JSON.parse(readFileSync(partialPath(key), 'utf8')) as PartialFile;
    return v && typeof v === 'object' && v.chapters && typeof v.chapters === 'object' ? v : null;
  } catch {
    return null;
  }
}

/** 可沿用章節：provider/model 不同整份作廢；prompt hash 不同該章作廢（防中途改資料或換模型的品質混雜） */
export function readResumable(
  key: string,
  provider: string,
  model: string,
  chapters: { key: string; prompt: string }[],
): Record<string, string> {
  const p = readPartialFile(key);
  if (!p || p.provider !== provider || p.model !== model) return {};
  const out: Record<string, string> = {};
  for (const c of chapters) {
    const e = p.chapters[c.key];
    if (e && e.hash === promptHash(c.prompt)) out[c.key] = e.text;
  }
  return out;
}

export function savePartialChapter(
  key: string,
  provider: string,
  model: string,
  chapterKey: string,
  hash: string,
  text: string,
): void {
  ensureDir();
  const prev = readPartialFile(key);
  const base: PartialFile =
    prev && prev.provider === provider && prev.model === model ? prev : { provider, model, chapters: {} };
  base.chapters[chapterKey] = { hash, text };
  writeFileSync(partialPath(key), JSON.stringify(base));
}

export function deletePartial(key: string): void {
  rmSync(partialPath(key), { force: true });
}

/** 逾時自動重試一次：opus 單章偶爾超過單次上限，重試可救回，免得整本重跑（其他錯誤照舊直接拋） */
export async function retryOnTimeout(call: () => Promise<string>, label: string): Promise<string> {
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof AiTimeoutError)) throw e;
    console.error(`[report] ${label} ${e.message}，重試一次`);
    return await call();
  }
}

/** 背景逐章生成 → 全部完成才渲染寫 HTML；中途失敗留 partial 檔供同 key 續跑 */
async function runGenerateJob(key: string, body: GenerateBody): Promise<void> {
  const total = body.chapters.length;
  const provider = body.provider ?? 'claude';
  const model = body.model ?? 'opus';
  const outputs: { key: string; title: string; text: string }[] = [];
  try {
    const resumable = readResumable(key, provider, model, body.chapters);
    const reused = Object.keys(resumable).length;
    if (reused > 0) console.log(`[report] ${key} 沿用已完成章節 ${reused}/${total}，續跑其餘章節`);
    writeStatus(key, { status: 'running', done: 0, total });
    for (const chapter of body.chapters) {
      let text = resumable[chapter.key];
      if (text === undefined) {
        const started = Date.now();
        text = await retryOnTimeout(() => callAi(provider, model, chapter.prompt), `${key} ${chapter.title}`);
        console.log(`[report] ${key} ${chapter.title} 完成（${Math.round((Date.now() - started) / 1000)} 秒）`);
        savePartialChapter(key, provider, model, chapter.key, promptHash(chapter.prompt), text);
      }
      outputs.push({ key: chapter.key, title: chapter.title, text });
      writeStatus(key, { status: 'running', done: outputs.length, total });
    }
    let html: string;
    let md: string;
    const generatedAt = nowLabel();
    const modelLabel = typeof body.modelLabel === 'string' ? body.modelLabel : undefined;
    if (body.book) {
      // 視覺化命書：每章解析 JSON 槽位，解析失敗帶原始文字給 fallback 區塊
      const chapters: Record<string, unknown> = {};
      for (const c of outputs) chapters[c.key] = parseChapterJson(c.text) ?? { __fallbackMd: c.text };
      const opts = {
        title: body.title,
        name: body.name,
        header: body.header,
        book: body.book,
        chapters,
        generatedAt,
        modelLabel,
      };
      html = renderBookHtml(opts);
      md = renderBookMarkdown(opts);
    } else {
      const sections: ReportSection[] = outputs.map((c) => ({ title: c.title, markdown: c.text }));
      const opts = { title: body.title, name: body.name, header: body.header, sections, generatedAt, modelLabel };
      html = renderReportHtml(opts);
      // 舊版逐章文章：各章 ## 標題＋markdown 原文串接（與單題同一組字器）
      md = renderReportMarkdown(opts);
    }
    ensureDir();
    writeFileSync(htmlPath(key), html);
    writeFileSync(mdPath(key), md); // MD 源檔：供 export format=md 直接下載
    deletePartial(key); // 全書完成，續跑暫存不再需要
    writeStatus(key, { status: 'done', done: total, total });
  } catch (e) {
    writeStatus(key, { status: 'error', done: outputs.length, total, error: (e as Error).message });
  } finally {
    jobs.delete(key);
  }
}

function handleGenerate(key: string, raw: string, res: ServerResponse): void {
  const body = JSON.parse(raw) as GenerateBody;
  if (!body || typeof body.title !== 'string' || typeof body.name !== 'string' || !body.header) {
    return sendJson(res, 400, { error: 'body 需含 title、name、header' });
  }
  if (!Array.isArray(body.chapters) || body.chapters.length === 0) {
    return sendJson(res, 400, { error: 'chapters 不可為空' });
  }
  if (body.chapters.some((c) => typeof c.title !== 'string' || typeof c.prompt !== 'string' || !c.prompt)) {
    return sendJson(res, 400, { error: '每章需含 title 與 prompt' });
  }
  if (jobs.has(key)) {
    return sendJson(res, 409, { error: `報告 ${key} 正在生成中` });
  }
  jobs.add(key);
  void runGenerateJob(key, body); // 背景執行，不等待
  sendJson(res, 202, { ok: true });
}

function handleRender(key: string, raw: string, res: ServerResponse): void {
  const body = JSON.parse(raw) as RenderBody;
  if (!body || typeof body.title !== 'string' || typeof body.name !== 'string' || !body.header) {
    return sendJson(res, 400, { error: 'body 需含 title、name、header' });
  }
  if (!Array.isArray(body.sections) || body.sections.length === 0) {
    return sendJson(res, 400, { error: 'sections 不可為空' });
  }
  if (body.sections.some((s) => typeof s.title !== 'string' || typeof s.markdown !== 'string')) {
    return sendJson(res, 400, { error: '每個 section 需含 title 與 markdown' });
  }
  const opts = {
    title: body.title,
    name: body.name,
    header: body.header,
    sections: body.sections,
    generatedAt: nowLabel(),
    question: typeof body.question === 'string' ? body.question : undefined,
    modelLabel: typeof body.modelLabel === 'string' ? body.modelLabel : undefined,
  };
  ensureDir();
  writeFileSync(htmlPath(key), renderReportHtml(opts));
  writeFileSync(mdPath(key), renderReportMarkdown(opts)); // MD 源檔：供 export format=md 直接下載
  writeStatus(key, { status: 'done', done: body.sections.length, total: body.sections.length });
  sendJson(res, 200, { ok: true });
}

function handleStatus(key: string, res: ServerResponse): void {
  if (!existsSync(statusPath(key))) {
    return sendJson(res, 200, { status: 'none', done: 0, total: 0 });
  }
  const s = JSON.parse(readFileSync(statusPath(key), 'utf8')) as StatusFile;
  if (s.status === 'running' && !jobs.has(key)) {
    // dev server 重啟過，背景 job 已不在
    return sendJson(res, 200, {
      status: 'error',
      done: s.done,
      total: s.total,
      error: '生成中斷，請重新產生',
      updatedAt: s.updatedAt,
    });
  }
  sendJson(res, 200, s);
}

function handleGetHtml(key: string, res: ServerResponse): void {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (!existsSync(htmlPath(key))) {
    res.statusCode = 404;
    res.end('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>找不到報告</title></head><body><p>找不到這份報告，請先產生。</p></body></html>');
    return;
  }
  res.statusCode = 200;
  res.end(readFileSync(htmlPath(key), 'utf8'));
}

/** 刪報告：html、md 與 status 檔都移除（不存在視同成功） */
export function handleDeleteReport(key: string): void {
  rmSync(htmlPath(key), { force: true });
  rmSync(mdPath(key), { force: true });
  rmSync(statusPath(key), { force: true });
  deletePartial(key);
}

/**
 * 輸出：jpg＝整頁長圖、pdf＝A4 含背景（皆走 Playwright）、md＝直接回產生時存的 MD 源檔。
 * reducedMotion 讓模板進場動畫區塊直接顯示。export 供測試直接呼叫。
 */
export async function handleExport(key: string, raw: string, res: ServerResponse): Promise<void> {
  const { format, theme } = JSON.parse(raw || '{}') as { format?: string; theme?: string };
  if (format === 'md') {
    // 舊報告產生時尚無 MD 源檔（不做 HTML 反轉），提示重產
    if (!existsSync(mdPath(key))) return sendJson(res, 404, { error: '此報告尚無 MD 檔，重新產生後即可下載' });
    res.statusCode = 200;
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    res.end(readFileSync(mdPath(key), 'utf8'));
    return;
  }
  if (!existsSync(htmlPath(key))) return sendJson(res, 404, { error: '找不到報告' });
  if (format !== 'jpg' && format !== 'pdf') return sendJson(res, 400, { error: 'format 需為 jpg、pdf 或 md' });
  const { chromium } = await import('playwright');
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    const msg = (e as Error).message;
    if (/Executable doesn't exist|playwright install/i.test(msg)) {
      return sendJson(res, 500, { error: 'JPG／PDF 匯出需要 Playwright 瀏覽器，請在專案目錄執行：npx playwright install chromium（MD 匯出不受影響）' });
    }
    return sendJson(res, 500, { error: `瀏覽器啟動失敗：${msg}` });
  }
  try {
    const page = await browser.newPage({
      reducedMotion: 'reduce',
      viewport: { width: 960, height: 1200 },
      deviceScaleFactor: format === 'jpg' ? 2 : 1,
    });
    // 配色跟著 app 設定走（file:// 讀不到 app 的 localStorage，先注入）
    if (theme === 'gray' || theme === 'mauve' || theme === 'purple') {
      await page.addInitScript(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
    }
    await page.goto(`file://${htmlPath(key)}`, { waitUntil: 'networkidle' });
    await page.evaluate(`document.querySelector('.theme-pick')?.remove()`); // 切換器不入圖
    const buf =
      format === 'jpg'
        ? await page.screenshot({ fullPage: true, type: 'jpeg', quality: 90 })
        : await page.pdf({ format: 'A4', printBackground: true });
    res.statusCode = 200;
    res.setHeader('content-type', format === 'jpg' ? 'image/jpeg' : 'application/pdf');
    res.end(buf);
  } finally {
    await browser.close();
  }
}

export default function reportPlugin(): Plugin {
  return {
    name: 'zhanyan-report',
    configureServer(server) {
      ensureDir();
      server.middlewares.use('/api/report', (req, res) => {
        void (async () => {
          try {
            // connect 已剝掉 '/api/report' 前綴：'/<key>'、'/<key>/generate' 等
            const sub = (req.url ?? '/').split('?')[0];
            const parts = sub.split('/').filter(Boolean).map(decodeURIComponent);
            if (parts.length === 0) return sendJson(res, 404, { error: 'missing report key' });

            const key = parts[0];
            if (!isValidKey(key)) return sendJson(res, 400, { error: `invalid key: ${key}` });
            const action = parts[1];
            if (parts.length > 2) return sendJson(res, 404, { error: 'not found' });

            if (!action) {
              if (req.method === 'GET') return handleGetHtml(key, res);
              if (req.method === 'DELETE') {
                handleDeleteReport(key);
                return sendJson(res, 200, { ok: true });
              }
              return sendJson(res, 405, { error: 'method not allowed' });
            }
            if (action === 'status') {
              if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
              return handleStatus(key, res);
            }
            if (action === 'generate' || action === 'render') {
              if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
              const raw = await readBody(req);
              return action === 'generate' ? handleGenerate(key, raw, res) : handleRender(key, raw, res);
            }
            if (action === 'export') {
              if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
              const raw = await readBody(req);
              // 必須 await：handleExport 是 async，直接 return 會讓其 rejection 逃出這個 try/catch
              // 變成 unhandled rejection 而拖垮整個 dev server（例：Playwright 瀏覽器未安裝）。
              return await handleExport(key, raw, res);
            }
            return sendJson(res, 404, { error: 'not found' });
          } catch (e) {
            sendJson(res, 500, { error: (e as Error).message });
          }
        })();
      });
    },
  };
}
