import { useMemo, useState } from 'react';
import type { CastResult } from '../engine/cast';
import { buildAnalysis, buildPrompt, TOPICS, type Topic } from '../analysis/analysis';
import { aiRequestParams } from '../store/settings';

interface Props {
  result: CastResult;
  inputKey: string; // 命例識別（快取用）
  onJumpToYear: (decadalBranch: string, year: number) => void;
}

type AiState = { status: 'idle' | 'loading' | 'done' | 'error'; text?: string; error?: string };

const CACHE_PREFIX = 'zhanyan-ai-';

function cacheGet(key: string): string | null {
  try {
    return localStorage.getItem(CACHE_PREFIX + key);
  } catch {
    return null;
  }
}

function cacheSet(key: string, value: string): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, value);
  } catch {
    /* 快取滿了就算了 */
  }
}

const METHOD_CLASS: Record<string, string> = {
  流命引動: 'hit-liuming',
  災宮引動: 'hit-zai',
  同星相疊: 'hit-star',
  四化交會: 'hit-cross',
};

export default function AnalysisPanel({ result, inputKey, onJumpToYear }: Props) {
  const analysis = useMemo(() => buildAnalysis(result), [result]);
  const [ai, setAi] = useState<Record<Topic, AiState>>(
    () => Object.fromEntries(TOPICS.map((t) => [t, { status: 'idle' }])) as Record<Topic, AiState>,
  );
  const [openTopic, setOpenTopic] = useState<Topic>('本命');
  const [showAll, setShowAll] = useState(false);

  const runAi = async (topic: Topic) => {
    const prompt = buildPrompt(analysis, topic, new Date().getFullYear());
    const cacheKey = `${inputKey}-${topic}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      setAi((s) => ({ ...s, [topic]: { status: 'done', text: cached } }));
      return;
    }
    setAi((s) => ({ ...s, [topic]: { status: 'loading' } }));
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, ...aiRequestParams() }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? `HTTP ${res.status}`);
      cacheSet(cacheKey, data.text);
      setAi((s) => ({ ...s, [topic]: { status: 'done', text: data.text } }));
    } catch (e) {
      setAi((s) => ({ ...s, [topic]: { status: 'error', error: (e as Error).message } }));
    }
  };

  const t = analysis.topics.find((x) => x.topic === openTopic)!;
  const state = ai[openTopic];

  return (
    <div className="analysis">
      <div className="a-card">
        <div className="a-tabs sub">
          {TOPICS.map((topic) => (
            <button key={topic} className={openTopic === topic ? 'active' : ''} onClick={() => setOpenTopic(topic)}>
              {topic}
            </button>
          ))}
        </div>

        <h3>
          {openTopic}（{t.palaceName}宮・{t.branch}）三方四正
        </h3>
        <div className="a-facts">
          {t.group.map((g) => (
            <div key={g.branch} className="a-fact">
              <span className="a-role">
                {g.role} {g.palaceName}［{g.branch}］
              </span>
              <span>
                {g.stars.length > 0
                  ? g.stars.map((s) => (
                      <span key={s.name} className="a-star">
                        {s.name}
                        {s.brightness && <i className="bri">{s.brightness}</i>}
                        {s.natalMutagen && <b className={`mut mut-${s.natalMutagen}`}>{s.natalMutagen}</b>}
                      </span>
                    ))
                  : '（無主星，借對宮）'}
              </span>
            </div>
          ))}
        </div>

        <h3>
          斷應期（流命引動法＋疊星引動法）
          <button className="a-run" onClick={() => setShowAll(!showAll)}>
            {showAll ? '只看重點' : '顯示全部'}
          </button>
          <span className="a-note">重點＝流命／災宮引動＋有忌參與的疊星</span>
        </h3>
        <div className="a-decadals">
          {analysis.decadals.map((d) => {
            const hits = d.hits.filter(
              (h) =>
                (h.topics.includes(openTopic) || h.topics.includes('整體')) &&
                (showAll || h.weight >= 2 || h.method === '流命引動' || h.method === '災宮引動'),
            );
            if (hits.length === 0) return null;
            const byYear = new Map<number, typeof hits>();
            hits.forEach((h) => byYear.set(h.year, [...(byYear.get(h.year) ?? []), h]));
            return (
              <div key={d.range[0]} className="a-decadal">
                <div className="a-dec-title">
                  {d.range[0]}~{d.range[1]}歲 {d.stem}
                  {d.branch}限
                  {d.notes.length > 0 && <span className="a-note">{d.notes.join('；')}</span>}
                </div>
                <div className="a-years">
                  {[...byYear.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([year, yearHits]) => {
                      const weight = yearHits.reduce((s, h) => s + h.weight, 0);
                      return (
                        <div
                          key={year}
                          className={`a-year w${Math.min(weight, 6)}`}
                          title={yearHits.map((h) => h.reason).join('\n')}
                          onClick={() => onJumpToYear(d.branch, year)}
                        >
                          <b>
                            {year}
                            <small>{yearHits[0].yearGz} {yearHits[0].age}歲</small>
                          </b>
                          {yearHits.map((h, i) => (
                            <span key={i} className={`a-hit ${METHOD_CLASS[h.method]}`}>
                              {h.method}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>

        <h3>
          AI 解讀
          {state.status === 'idle' && (
            <button className="a-run" onClick={() => runAi(openTopic)}>
              產生{openTopic}解讀
            </button>
          )}
          {state.status === 'done' && (
            <button
              className="a-run"
              onClick={() => {
                cacheSet(`${inputKey}-${openTopic}`, '');
                localStorage.removeItem(CACHE_PREFIX + `${inputKey}-${openTopic}`);
                runAi(openTopic);
              }}
            >
              重新產生
            </button>
          )}
        </h3>
        {state.status === 'loading' && <p className="a-loading">Claude 解讀中（本地 headless，約 3~6 分鐘，完成會自動顯示）…</p>}
        {state.status === 'error' && <p className="a-error">解讀失敗：{state.error}（斷應期表不受影響）</p>}
        {state.status === 'done' && <pre className="a-text">{state.text}</pre>}
      </div>
    </div>
  );
}
