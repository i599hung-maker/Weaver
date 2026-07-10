import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ExternalLink, FileText, MessageSquare, Trash2 } from 'lucide-react';
import type { CastResult } from '../engine/cast';
import { buildAnalysis } from '../analysis/analysis';
import { buildChatPrompt } from '../analysis/chatPrompt';
import { buildReportHeader } from '../analysis/reportPrompts';
import {
  newId,
  saveMingzhu,
  type ChatMessage,
  type Conversation,
  type Mingzhu,
} from '../store/mingzhu';

type Mode = 'chat' | 'report';

interface Props {
  mingzhu: Mingzhu;
  result: CastResult;
  activeConvId: string | null;
  onSelectConv: (id: string | null) => void;
  onUpdate: (m: Mingzhu) => void;
}

function fmtTime(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 覆寫（或新增）一個對話後回傳新的 Mingzhu */
function withConv(m: Mingzhu, conv: Conversation): Mingzhu {
  const exists = m.conversations.some((c) => c.id === conv.id);
  return {
    ...m,
    conversations: exists
      ? m.conversations.map((c) => (c.id === conv.id ? conv : c))
      : [...m.conversations, conv],
  };
}

/** 估算 prompt token 數：CJK 約 1.2 token／字，其餘約 3.5 字元／token */
function estimateTokens(s: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of s) {
    if (/[　-鿿豈-﫿＀-￯]/.test(ch)) cjk++;
    else other++;
  }
  return Math.round(cjk * 1.2 + other / 3.5);
}

/** 對話思考容量上限（claude 單次對話 context window 約 200k token） */
const CONTEXT_LIMIT = 200_000;

/** 容量指示環：hover 顯示已使用比例 */
function UsageRing({ pct }: { pct: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const capped = Math.min(Math.max(pct, 0), 100);
  return (
    <span className="usage-ring" data-tip={`當前對話思考容量已使用 ${capped}%`}>
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="var(--text-2)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${(capped / 100) * c} ${c}`}
          transform="rotate(-90 10 10)"
        />
      </svg>
    </span>
  );
}

/** 共用輸入框：textarea＋送出鈕＋左下角「聊天／報告」模式切換 */
function AskBox({
  input,
  mode,
  sending,
  big,
  usagePct,
  onInput,
  onMode,
  onSend,
}: {
  input: string;
  mode: Mode;
  sending: boolean;
  big?: boolean;
  /** null＝不在特定對話中，隱藏容量環 */
  usagePct: number | null;
  onInput: (v: string) => void;
  onMode: (m: Mode) => void;
  onSend: () => void;
}) {
  return (
    <div className={`ask-box ${big ? 'big' : ''}`}>
      <div className="ask-row">
        <textarea
          value={input}
          placeholder={
            mode === 'chat'
              ? '輸入問題，Enter 送出、Shift+Enter 換行'
              : '輸入問題，將產生命書版型的單題報告頁'
          }
          disabled={sending}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            // 輸入法選字中的 Enter 只是確認組字，不送出（isComposing／Safari keyCode 229）
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
      </div>
      <div className="ask-modes">
        <button
          className={`pill ${mode === 'chat' ? 'active' : ''}`}
          disabled={sending}
          onClick={() => onMode('chat')}
        >
          聊天
        </button>
        <button
          className={`pill ${mode === 'report' ? 'active' : ''}`}
          disabled={sending}
          onClick={() => onMode('report')}
        >
          報告
        </button>
        {usagePct !== null && <UsageRing pct={usagePct} />}
        <button
          className="send-btn"
          title="送出"
          disabled={sending || !input.trim()}
          onClick={onSend}
        >
          <ArrowUp size={17} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export default function ChatPanel({ mingzhu, result, activeConvId, onSelectConv, onUpdate }: Props) {
  const analysis = useMemo(() => buildAnalysis(result), [result]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('chat');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  const activeConv = mingzhu.conversations.find((c) => c.id === activeConvId) ?? null;
  const msgCount = activeConv?.messages.length ?? 0;

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight });
  }, [activeConvId, msgCount, sending]);

  /** 呼叫 /api/analyze 取得回覆並存檔；conv 的最後一則必須是 user 訊息 */
  const ask = async (base: Mingzhu, conv: Conversation) => {
    setSending(true);
    setError(null);
    try {
      const last = conv.messages[conv.messages.length - 1];
      const question = last.text;
      const qMode: Mode = last.mode ?? 'chat';
      const history = conv.messages.slice(0, -1);
      const prompt = buildChatPrompt(analysis, history, question, new Date().getFullYear(), qMode);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? `HTTP ${res.status}`);

      let reply: ChatMessage = { role: 'assistant', text: data.text, ts: new Date().toISOString() };
      if (qMode === 'report') {
        // 產生單題報告頁；失敗就退回純文字訊息，不擋對話
        const key = `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        try {
          const rr = await fetch(`/api/report/${key}/render`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              title: question.slice(0, 30),
              name: base.name,
              header: buildReportHeader(analysis, result.meta),
              sections: [{ title: question, markdown: data.text }],
            }),
          });
          if (!rr.ok) throw new Error(`HTTP ${rr.status}`);
          reply = { ...reply, mode: 'report', reportKey: key };
        } catch (e) {
          setError(`報告頁產生失敗（${(e as Error).message}），已改存純文字回覆`);
        }
      }

      const next = withConv(base, { ...conv, messages: [...conv.messages, reply] });
      onUpdate(next);
      await saveMingzhu(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const question = input.trim();
    if (!question || sending) return;
    const now = new Date().toISOString();
    const userMsg: ChatMessage = { role: 'user', text: question, ts: now, mode };
    const conv: Conversation = activeConv
      ? { ...activeConv, messages: [...activeConv.messages, userMsg] }
      : { id: newId('c'), title: question.slice(0, 20), createdAt: now, messages: [userMsg] };
    if (!activeConv) onSelectConv(conv.id);
    setInput('');
    const next = withConv(mingzhu, conv);
    onUpdate(next);
    try {
      await saveMingzhu(next);
    } catch (e) {
      setError((e as Error).message); // 存檔失敗仍繼續發問
    }
    await ask(next, conv);
  };

  /** 錯誤後重送：最後一則 user 訊息保留在對話裡，直接重問 */
  const retry = () => {
    if (!activeConv || activeConv.messages[activeConv.messages.length - 1]?.role !== 'user') return;
    void ask(mingzhu, activeConv);
  };

  const removeConv = async (id: string) => {
    if (!window.confirm('刪除此對話？')) return;
    const next: Mingzhu = {
      ...mingzhu,
      conversations: mingzhu.conversations.filter((c) => c.id !== id),
    };
    onUpdate(next);
    if (activeConvId === id) {
      onSelectConv(null);
      setError(null);
    }
    try {
      await saveMingzhu(next);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const canRetry =
    !sending && activeConv !== null &&
    activeConv.messages[activeConv.messages.length - 1]?.role === 'user';

  /* 估算下一次發問的 prompt 大小佔 context 的比例（盤面事實＋對話歷史＋草稿）；
     不在特定對話中回傳 null，輸入框不顯示容量環 */
  const usagePct = useMemo(() => {
    if (!activeConv) return null;
    const prompt = buildChatPrompt(
      analysis,
      activeConv.messages,
      input || '（估算用）',
      new Date().getFullYear(),
      mode,
    );
    return Math.round((estimateTokens(prompt) / CONTEXT_LIMIT) * 100);
  }, [analysis, activeConv, input, mode]);

  const askBox = (big: boolean) => (
    <AskBox
      input={input}
      mode={mode}
      sending={sending}
      big={big}
      usagePct={usagePct}
      onInput={setInput}
      onMode={setMode}
      onSend={() => void send()}
    />
  );

  const chatHead = (
    <div className="chat-head">
      <b>{mingzhu.name}</b>
      <span>
        {mingzhu.birth.date} {mingzhu.birth.time}
      </span>
    </div>
  );

  /* ── 歷史列表視圖 ── */
  if (!activeConv) {
    return (
      <div className="chat-col">
        {chatHead}
        <div className="conv-home">
          <div className="conv-list">
            {mingzhu.conversations.length > 0 ? (
              mingzhu.conversations.map((c) => (
                <div key={c.id} className="conv-row" onClick={() => onSelectConv(c.id)}>
                  <MessageSquare size={15} strokeWidth={1.8} className="cr-icon" />
                  <span className="cr-title">{c.title}</span>
                  <button
                    className="sb-del"
                    title="刪除對話"
                    disabled={sending}
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeConv(c.id);
                    }}
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                </div>
              ))
            ) : (
              <div className="conv-none">
                尚無對話。在下方輸入問題即可開始，例如「今年適合換工作嗎？」
              </div>
            )}
          </div>
          {sending && <div className="chat-wait">Claude 思考中…（本機 headless，可能數分鐘）</div>}
          {error && (
            <div className="chat-error">
              <span>失敗：{error}</span>
            </div>
          )}
          {askBox(true)}
        </div>
      </div>
    );
  }

  /* ── 對話串視圖 ── */
  return (
    <div className="chat-col">
      {chatHead}
      <div className="thread">
        <div className="chat-msgs" ref={msgsRef}>
          {activeConv.messages.map((msg, i) => {
            const isReport = msg.role === 'assistant' && msg.mode === 'report' && msg.reportKey;
            const prev = activeConv.messages[i - 1];
            const reportTitle =
              prev?.role === 'user' ? prev.text.slice(0, 30) : activeConv.title;
            return (
              <div key={i} className={`msg ${msg.role}`}>
                {isReport ? (
                  <div className="msg-bubble report-card">
                    <div className="rc-head">
                      <span className="rc-icon">
                        <FileText size={16} strokeWidth={1.8} />
                      </span>
                      <b className="rc-title">{reportTitle}</b>
                      <button onClick={() => window.open(`/api/report/${msg.reportKey}`)}>
                        <ExternalLink size={13} strokeWidth={1.8} /> 開啟報告頁
                      </button>
                    </div>
                    <details className="rc-preview">
                      <summary>內文預覽</summary>
                      <pre>{msg.text}</pre>
                    </details>
                  </div>
                ) : msg.role === 'assistant' ? (
                  <pre className="msg-bubble">{msg.text}</pre>
                ) : (
                  <div className="msg-bubble">{msg.text}</div>
                )}
                <span className="msg-time">{fmtTime(msg.ts)}</span>
              </div>
            );
          })}
          {sending && <div className="chat-wait">Claude 思考中…（本機 headless，可能數分鐘）</div>}
        </div>

        {error && (
          <div className="chat-error">
            <span>失敗：{error}</span>
            {canRetry && <button onClick={retry}>重送</button>}
          </div>
        )}

        {askBox(false)}
      </div>
    </div>
  );
}
