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

/** 一本已生成（或生成中）的報告：完整命書或單題報告 */
export interface ReportMeta {
  key: string;
  title: string;
  kind: 'book' | 'question';
  /** ISO 時間戳（生成當下） */
  createdAt: string;
  /** AI 供應商 id（如 claude／antigravity；舊資料無此欄） */
  provider?: string;
  /** 模型 id（該供應商底下，如 opus／pro；舊資料無此欄） */
  model?: string;
}

/** 命主：出生資料＋全部對話紀錄，對應 data/<id>.json 一個檔案 */
export interface Mingzhu {
  id: string;
  name: string;
  birth: BirthInput;
  /** 個人背景自述（選填）：職業、感情、重大事件年份等，餵給 AI 貼近解讀 */
  profile?: string;
  /** 報告書紀錄（新生成才有；舊報告由 mergeReports 推導） */
  reports?: ReportMeta[];
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
