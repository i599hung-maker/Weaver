import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { renderBookHtml, renderReportHtml, type BookData, type ReportHeader, type ReportSection } from './reportTemplate.js';

/**
 * 命書報告產生（dev middleware，掛 /api/report）：
 * - POST /api/report/:key/generate → 背景逐章呼叫 claude 生成，寫 data/reports/<key>.html
 * - POST /api/report/:key/render   → 同步以現成 markdown 段落渲染寫檔（不呼叫 claude）
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
  /** 視覺化命書 v2：有 book 走 renderBookHtml（章節輸出為 JSON 槽位），無則走舊版逐章文章 */
  book?: BookData;
}

interface RenderBody {
  title: string;
  name: string;
  header: ReportHeader;
  sections: ReportSection[];
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
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/** 同 server/analyzePlugin.ts：呼叫本機已登入的 Claude Code（headless） */
function callClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE; // 允許在 Claude Code 之外以子行程執行
    const child = spawn('claude', ['-p', '--output-format', 'text', '--model', 'opus'], {
      env,
      cwd: tmpdir(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('claude CLI 逾時（600 秒）'));
    }, 600_000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude CLI 失敗（code ${code}）：${err.slice(0, 500)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
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

/** 背景逐章生成 → 全部完成才渲染寫 HTML */
async function runGenerateJob(key: string, body: GenerateBody): Promise<void> {
  const total = body.chapters.length;
  const outputs: { key: string; title: string; text: string }[] = [];
  try {
    writeStatus(key, { status: 'running', done: 0, total });
    for (const chapter of body.chapters) {
      const text = await callClaudeCli(chapter.prompt);
      outputs.push({ key: chapter.key, title: chapter.title, text });
      writeStatus(key, { status: 'running', done: outputs.length, total });
    }
    let html: string;
    if (body.book) {
      // 視覺化命書：每章解析 JSON 槽位，解析失敗帶原始文字給 fallback 區塊
      const chapters: Record<string, unknown> = {};
      for (const c of outputs) chapters[c.key] = parseChapterJson(c.text) ?? { __fallbackMd: c.text };
      html = renderBookHtml({
        title: body.title,
        name: body.name,
        header: body.header,
        book: body.book,
        chapters,
        generatedAt: nowLabel(),
      });
    } else {
      const sections: ReportSection[] = outputs.map((c) => ({ title: c.title, markdown: c.text }));
      html = renderReportHtml({
        title: body.title,
        name: body.name,
        header: body.header,
        sections,
        generatedAt: nowLabel(),
      });
    }
    ensureDir();
    writeFileSync(htmlPath(key), html);
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
  const html = renderReportHtml({
    title: body.title,
    name: body.name,
    header: body.header,
    sections: body.sections,
    generatedAt: nowLabel(),
  });
  ensureDir();
  writeFileSync(htmlPath(key), html);
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
              if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
              return handleGetHtml(key, res);
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
            return sendJson(res, 404, { error: 'not found' });
          } catch (e) {
            sendJson(res, 500, { error: (e as Error).message });
          }
        })();
      });
    },
  };
}
