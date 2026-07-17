import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import { ZHANYAN_MUTAGENS } from '../engine/zhanyanConfig';
import { BRANCHES, STEMS, branchIndex, stemIndex, mod12, type CastMeta } from '../engine/types';
import { PALACE_OFFSET, TOPIC_PALACE, TOPICS, starBranchMap, type Topic } from './facts';

const MUT = ['祿', '權', '科', '忌'] as const;

export type Method = '流命引動' | '災宮引動' | '同星相疊' | '四化交會';

export interface TriggerHit {
  year: number;
  age: number; // 虛歲
  yearGz: string;
  method: Method;
  /** 命中的主題；災宮引動與不落主題三方的疊星為「整體」 */
  topics: (Topic | '整體')[];
  /** 權重 1~3，忌疊忌最重 */
  weight: number;
  reason: string;
  palaceBranch?: string;
}

export interface DecadalAnalysis {
  range: [number, number];
  stem: string;
  branch: string;
  /** 大限命宮支 */
  daMingBranch: string;
  /** 主題 → 大限主題宮支（大官、大財、大妻；本命→大命） */
  topicBranch: Record<Topic, string>;
  /** 災宮（大疾）支 */
  zaiBranch: string;
  /** 大限層級備註（生年×大限同星、交會） */
  notes: string[];
  hits: TriggerHit[];
}

interface Mutation {
  layer: '生年' | '大限' | '流年';
  kind: (typeof MUT)[number];
  star: string;
  branch?: string;
}

function mutationsOf(stem: string, layer: Mutation['layer'], starBranch: Record<string, string>): Mutation[] {
  return (ZHANYAN_MUTAGENS[stem] ?? []).map((star, i) => ({
    layer,
    kind: MUT[i],
    star,
    branch: starBranch[star],
  }));
}

function yearGanzhi(year: number, birthYear: number, yearStem: string, yearBranch: string): [string, string] {
  const diff = year - birthYear;
  return [
    STEMS[(((stemIndex(yearStem) + diff) % 10) + 10) % 10],
    BRANCHES[mod12(branchIndex(yearBranch) + diff)],
  ];
}

/** 同星相疊／四化交會的權重（吉凶對稱）：忌疊忌、祿疊祿 3；含忌或含祿 2；純權科互疊 1 */
function weightOf(kinds: string[]): number {
  const ji = kinds.filter((k) => k === '忌').length;
  const lu = kinds.filter((k) => k === '祿').length;
  if (ji >= 2 || lu >= 2) return 3;
  if (ji === 1 || lu === 1) return 2;
  return 1;
}

/**
 * 斷應期規則引擎：逐大限 × 流年跑
 * 1. 流命引動：流年命宮疊主題大限宮／災宮（大疾）
 * 2. 疊星引動：同星相疊（多層四化化同星）、四化交會（多層四化落同宮）
 * 疊星以流年層參與者才計入年命中；生年×大限記在大限備註。
 */
export function buildTriggers(a: FunctionalAstrolabe, meta: CastMeta, birthYear: number): DecadalAnalysis[] {
  const starBranch = starBranchMap(a);
  const natalMut = mutationsOf(meta.yearStem, '生年', starBranch);
  const topicBranchOf = (daMingIdx: number): Record<Topic, string> => {
    const rec = {} as Record<Topic, string>;
    for (const t of TOPICS) rec[t] = BRANCHES[mod12(daMingIdx - PALACE_OFFSET[TOPIC_PALACE[t]])];
    return rec;
  };

  return [...a.palaces]
    .sort((p, q) => p.decadal.range[0] - q.decadal.range[0])
    .map((p) => {
      const daMingIdx = branchIndex(p.earthlyBranch);
      const decadalMut = mutationsOf(p.heavenlyStem, '大限', starBranch);
      const topicBranch = topicBranchOf(daMingIdx);
      const zaiBranch = BRANCHES[mod12(daMingIdx - PALACE_OFFSET['疾厄'])];

      // 大限層級：生年×大限 同星／同宮
      const notes: string[] = [];
      for (const dm of decadalMut) {
        for (const nm of natalMut) {
          if (nm.star === dm.star)
            notes.push(`大限${dm.kind}與生年${nm.kind}同星（${dm.star}，${dm.branch ?? '?'}宮）`);
          else if (nm.branch && dm.branch === nm.branch)
            notes.push(`大限${dm.star}${dm.kind}與生年${nm.star}${nm.kind}交會於${dm.branch}宮`);
        }
      }

      const hits: TriggerHit[] = [];
      for (let age = p.decadal.range[0]; age <= p.decadal.range[1]; age++) {
        const year = birthYear + age - 1;
        const [ys, yb] = yearGanzhi(year, birthYear, meta.yearStem, meta.yearBranch);
        const yearGz = `${ys}${yb}`;

        // 1) 流命引動：主題大限宮
        for (const t of TOPICS) {
          if (yb === topicBranch[t]) {
            hits.push({
              year, age, yearGz, method: '流命引動', topics: [t], weight: 2,
              palaceBranch: yb,
              reason: `${yearGz}年流年命宮走到大限${TOPIC_PALACE[t]}（${yb}宮）→ ${t}主題引動`,
            });
          }
        }
        // 災宮
        if (yb === zaiBranch) {
          hits.push({
            year, age, yearGz, method: '災宮引動', topics: ['整體'], weight: 2,
            palaceBranch: yb,
            reason: `${yearGz}年流年命宮走到大限疾厄（災宮，${yb}宮）→ 注意健康與災咎`,
          });
        }

        // 2) 疊星引動（需流年層參與）
        const yearMut = mutationsOf(ys, '流年', starBranch);
        for (const ym of yearMut) {
          const sameStar = [...natalMut, ...decadalMut].filter((m) => m.star === ym.star);
          if (sameStar.length > 0) {
            const kinds = [ym.kind, ...sameStar.map((m) => m.kind)];
            hits.push({
              year, age, yearGz, method: '同星相疊', topics: [], weight: weightOf(kinds),
              palaceBranch: ym.branch,
              reason: `${yearGz}年流年${ym.kind}為${ym.star}，與${sameStar
                .map((m) => `${m.layer}${m.kind}`)
                .join('、')}同星相疊（${ym.branch ?? '?'}宮）`,
            });
          }
          const samePalace = [...natalMut, ...decadalMut].filter(
            (m) => m.branch && m.branch === ym.branch && m.star !== ym.star,
          );
          if (samePalace.length > 0) {
            const kinds = [ym.kind, ...samePalace.map((m) => m.kind)];
            hits.push({
              year, age, yearGz, method: '四化交會', topics: [], weight: weightOf(kinds),
              palaceBranch: ym.branch,
              reason: `${yearGz}年流年${ym.star}${ym.kind}與${samePalace
                .map((m) => `${m.layer}${m.star}${m.kind}`)
                .join('、')}交會於${ym.branch}宮`,
            });
          }
        }
      }

      return {
        range: p.decadal.range,
        stem: p.heavenlyStem,
        branch: p.earthlyBranch,
        daMingBranch: p.earthlyBranch,
        topicBranch,
        zaiBranch,
        notes: [...new Set(notes)],
        hits,
      };
    });
}
