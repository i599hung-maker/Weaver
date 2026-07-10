import { describe, expect, it } from 'vitest';
import { cast } from '../../engine/cast';
import { buildAnalysis } from '../analysis';
import { buildChatPrompt } from '../chatPrompt';
import type { ChatMessage } from '../../store/mingzhu';

/**
 * 對話 prompt 組裝測試：命例 1996-05-12 23:40 男（晚子時，丙子年）
 */

const result = cast({ date: '1996-05-12', time: '23:40', gender: '男' });
const analysis = buildAnalysis(result);

function msg(role: ChatMessage['role'], text: string): ChatMessage {
  return { role, text, ts: '2026-07-10T00:00:00.000Z' };
}

describe('buildChatPrompt', () => {
  it('含各段落標題與問題原文', () => {
    const question = '我明年適合換工作嗎？';
    const prompt = buildChatPrompt(analysis, [], question, 2026);
    expect(prompt).toContain('占驗派紫微斗數論命助手');
    expect(prompt).toContain('【命主】');
    expect(prompt).toContain('【盤面事實】');
    expect(prompt).toContain('【斷應期引動年份】');
    expect(prompt).toContain('【本次問題】');
    expect(prompt).toContain('【回答要求】');
    expect(prompt).toContain(question);
    expect(prompt).toContain('今年西元 2026 年');
  });

  it('命主 header 與四主題宮位名都出現', () => {
    const prompt = buildChatPrompt(analysis, [], '問題', 2026);
    const h = analysis.header;
    expect(prompt).toContain(`${h.yinYang}${h.gender}`);
    expect(prompt).toContain(h.yearGz);
    expect(prompt).toContain(h.fiveElementsClass);
    for (const t of analysis.topics) {
      expect(prompt).toContain(`${t.topic}主題宮位：${t.palaceName}（${t.branch}宮）`);
    }
  });

  it('history 為空時不含【先前對話】', () => {
    const prompt = buildChatPrompt(analysis, [], '問題', 2026);
    expect(prompt).not.toContain('【先前對話】');
  });

  it('有兩則歷史時含「命主問」與回答內容', () => {
    const history: ChatMessage[] = [
      msg('user', '我今年財運如何？'),
      msg('assistant', '今年財帛宮受生年化祿引動，整體偏旺。'),
    ];
    const prompt = buildChatPrompt(analysis, history, '那明年呢？', 2026);
    expect(prompt).toContain('【先前對話】');
    expect(prompt).toContain('命主問：我今年財運如何？');
    expect(prompt).toContain('你答：今年財帛宮受生年化祿引動，整體偏旺。');
    expect(prompt).toContain('【本次問題】\n那明年呢？');
  });

  it('超長 assistant 歷史（>600字）被截斷且含「…（略）」', () => {
    const long = '甲'.repeat(700);
    const history: ChatMessage[] = [msg('user', '長問題'), msg('assistant', long)];
    const prompt = buildChatPrompt(analysis, history, '後續問題', 2026);
    expect(prompt).toContain('…（略）');
    expect(prompt).not.toContain('甲'.repeat(601));
    expect(prompt).toContain(`你答：${'甲'.repeat(600)}…（略）`);
  });

  it('剛好 600 字的 assistant 歷史不截斷', () => {
    const exact = '乙'.repeat(600);
    const history: ChatMessage[] = [msg('user', '問'), msg('assistant', exact)];
    const prompt = buildChatPrompt(analysis, history, '再問', 2026);
    expect(prompt).toContain(`你答：${exact}`);
    expect(prompt).not.toContain('…（略）');
  });

  it("mode='report' 時含報告結構要求且不含 chat 字數要求", () => {
    const prompt = buildChatPrompt(analysis, [], '我適合創業嗎？', 2026, 'report');
    expect(prompt).toContain('單題報告');
    expect(prompt).toContain('# 報告標題');
    expect(prompt).toContain('## 結論');
    expect(prompt).toContain('## 盤面依據');
    expect(prompt).toContain('## 關鍵時間點');
    expect(prompt).toContain('## 行動建議');
    expect(prompt).toContain('markdown 表格');
    expect(prompt).toContain('年份｜干支/歲數｜引動方式｜該做什麼');
    expect(prompt).toContain('800~1500 字');
    expect(prompt).not.toContain('400~800');
  });

  it("mode='chat' 與省略 mode 輸出完全相同", () => {
    const history: ChatMessage[] = [
      msg('user', '我今年財運如何？'),
      msg('assistant', '今年財帛宮受生年化祿引動。'),
    ];
    const withDefault = buildChatPrompt(analysis, history, '那明年呢？', 2026);
    const withChat = buildChatPrompt(analysis, history, '那明年呢？', 2026, 'chat');
    expect(withChat).toBe(withDefault);
    expect(withDefault).toContain('400~800');
    expect(withDefault).not.toContain('# 報告標題');
  });

  it('引動年份含大限與主題標注', () => {
    const prompt = buildChatPrompt(analysis, [], '問題', 2026);
    // 至少有一個 ≤82 歲大限被列出（格式：xx~xx歲 干支限）
    expect(prompt).toMatch(/- \d+~\d+歲 .{2}限/);
    // 命中行帶主題標注
    expect(prompt).toMatch(/\[權重\d\]〔[^〕]+〕/);
  });
});
