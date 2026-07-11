import { describe, expect, it } from 'vitest';
import type { Mingzhu } from '../mingzhu';
import { bookTitle, mergeReports, questionTitle, upsertReport } from '../reportList';

function mz(over: Partial<Mingzhu> = {}): Mingzhu {
  return {
    id: 'm_test',
    name: '測試',
    birth: { name: '測試', date: '1990-01-01', time: '12:00', gender: '男', useTrueSolarTime: true, longitude: 121.5, tzOffset: 8 },
    createdAt: '2026-07-01T00:00:00.000Z',
    conversations: [],
    ...over,
  };
}

describe('命名', () => {
  it('bookTitle 依風格', () => {
    expect(bookTitle('plain')).toBe('完整命書・白話風');
    expect(bookTitle('classic')).toBe('完整命書・命理風');
  });
  it('questionTitle 截 20 字、空白 fallback', () => {
    expect(questionTitle('我明年適合換工作嗎？想聽聽事業與財運的整體分析')).toBe('我明年適合換工作嗎？想聽聽事業與財運的整');
    expect(questionTitle('  ')).toBe('單題報告');
  });
});

describe('upsertReport', () => {
  it('同 key 覆寫、不同 key 新增', () => {
    let m = mz();
    m = upsertReport(m, { key: 'm_test', title: 'A', kind: 'book', createdAt: '2026-07-10T00:00:00.000Z' });
    m = upsertReport(m, { key: 'm_test', title: 'B', kind: 'book', createdAt: '2026-07-11T00:00:00.000Z' });
    m = upsertReport(m, { key: 'q_1', title: 'Q', kind: 'question', createdAt: '2026-07-11T01:00:00.000Z' });
    expect(m.reports).toHaveLength(2);
    expect(m.reports!.find((r) => r.key === 'm_test')!.title).toBe('B');
  });
});

describe('mergeReports', () => {
  it('已記錄優先、命書推導補缺、依時間新到舊', () => {
    const m = mz({
      reports: [{ key: 'q_1', title: '已記錄問題', kind: 'question', createdAt: '2026-07-10T00:00:00.000Z' }],
      conversations: [
        {
          id: 'c1', title: 't', createdAt: '2026-07-09T00:00:00.000Z',
          messages: [
            { role: 'user', text: '這是一個舊的問題訊息用來推導標題', ts: '2026-07-09T01:00:00.000Z' },
            { role: 'assistant', text: '回覆', ts: '2026-07-09T01:05:00.000Z', mode: 'report', reportKey: 'q_legacy' },
            { role: 'assistant', text: '回覆2', ts: '2026-07-09T02:00:00.000Z', mode: 'report', reportKey: 'q_1' },
          ],
        },
      ],
    });
    const list = mergeReports(m, { done: true, updatedAt: '2026-07-11T03:00:00.000Z' });
    expect(list.map((r) => r.key)).toEqual(['m_test', 'q_1', 'q_legacy']); // 新到舊
    expect(list.find((r) => r.key === 'm_test')!.title).toBe('完整命書');
    expect(list.find((r) => r.key === 'q_legacy')!.title).toBe('這是一個舊的問題訊息用來推導標題');
    expect(list.find((r) => r.key === 'q_1')!.title).toBe('已記錄問題'); // 記錄優先，不被推導覆蓋
  });

  it('命書未完成且無紀錄時不出現', () => {
    expect(mergeReports(mz(), { done: false })).toHaveLength(0);
  });
});
