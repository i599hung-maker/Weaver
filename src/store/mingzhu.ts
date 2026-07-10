import type { BirthInput } from '../engine/types';

/** 對話中的一則訊息 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** ISO 時間戳 */
  ts: string;
  /** 提問／回覆模式：聊天（白話短答）或報告（命書版型單題報告頁）。預設 chat */
  mode?: 'chat' | 'report';
  /** 報告模式回覆對應的報告頁 key，開啟網址為 /api/report/<reportKey> */
  reportKey?: string;
}

/** 一個對話分頁（同命主可開多個，各自獨立主題） */
export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

/** 命主：出生資料＋全部對話紀錄，對應 data/<id>.json 一個檔案 */
export interface Mingzhu {
  id: string;
  name: string;
  birth: BirthInput;
  createdAt: string;
  conversations: Conversation[];
}

export function newId(prefix: 'm' | 'c'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function listMingzhu(): Promise<Mingzhu[]> {
  const res = await fetch('/api/mingzhu');
  if (!res.ok) throw new Error(`載入命主清單失敗（HTTP ${res.status}）`);
  return (await res.json()) as Mingzhu[];
}

/** 新增與更新都走這裡：整筆覆寫 data/<id>.json */
export async function saveMingzhu(m: Mingzhu): Promise<void> {
  const res = await fetch(`/api/mingzhu/${m.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(m),
  });
  if (!res.ok) throw new Error(`儲存命主失敗（HTTP ${res.status}）`);
}

export async function deleteMingzhu(id: string): Promise<void> {
  const res = await fetch(`/api/mingzhu/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`刪除命主失敗（HTTP ${res.status}）`);
}
