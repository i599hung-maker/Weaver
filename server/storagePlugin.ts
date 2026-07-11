import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * 命主檔案儲存（dev middleware）：data/<id>.json 一人一檔，本機單人使用。
 * - GET    /api/mingzhu       → 全部命主（createdAt 升冪）
 * - PUT    /api/mingzhu/:id   → 整筆覆寫
 * - DELETE /api/mingzhu/:id   → 刪除（不存在回 404）
 */

const DATA_DIR = join(process.cwd(), 'data');

/** 合法 id（同 src/store/mingzhu.ts 的 newId 產生規則），順便防路徑穿越 */
function isValidId(id: string): boolean {
  return /^[mc]_[a-z0-9]+$/i.test(id) || /^m_[a-z0-9_-]+$/i.test(id);
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function listAll(): unknown[] {
  if (!existsSync(DATA_DIR)) return [];
  const items: { createdAt?: string }[] = [];
  for (const file of readdirSync(DATA_DIR)) {
    if (!file.endsWith('.json')) continue;
    const path = join(DATA_DIR, file);
    try {
      items.push(JSON.parse(readFileSync(path, 'utf8')) as { createdAt?: string });
    } catch {
      console.warn(`[mingzhu-storage] 跳過壞檔：${path}`);
    }
  }
  items.sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
  return items;
}

export default function storagePlugin(): Plugin {
  return {
    name: 'zhanyan-mingzhu-storage',
    configureServer(server) {
      server.middlewares.use('/api/mingzhu', (req, res) => {
        try {
          // connect 會剝掉 '/api/mingzhu' 前綴：清單時 url 為 '/'，單筆時為 '/<id>'
          const sub = (req.url ?? '/').split('?')[0];

          if (sub === '/' || sub === '') {
            if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
            return sendJson(res, 200, listAll());
          }

          const id = decodeURIComponent(sub.replace(/^\//, ''));
          if (!isValidId(id)) return sendJson(res, 400, { error: `invalid id: ${id}` });
          const filePath = join(DATA_DIR, `${id}.json`);

          if (req.method === 'PUT') {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', () => {
              try {
                const body = Buffer.concat(chunks).toString('utf8'); // 一次性 UTF-8 解碼，避免中文跨 chunk 亂碼
                const record = JSON.parse(body) as unknown;
                mkdirSync(DATA_DIR, { recursive: true });
                writeFileSync(filePath, JSON.stringify(record, null, 2));
                sendJson(res, 200, { ok: true });
              } catch (e) {
                sendJson(res, 400, { error: `body 不是合法 JSON：${(e as Error).message}` });
              }
            });
            return;
          }

          if (req.method === 'DELETE') {
            if (!existsSync(filePath)) return sendJson(res, 404, { error: `not found: ${id}` });
            rmSync(filePath);
            return sendJson(res, 200, { ok: true });
          }

          return sendJson(res, 405, { error: 'method not allowed' });
        } catch (e) {
          return sendJson(res, 500, { error: (e as Error).message });
        }
      });
    },
  };
}
