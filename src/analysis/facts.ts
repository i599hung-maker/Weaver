import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import { BRANCHES, branchIndex, mod12 } from '../engine/types';

export type Topic = '本命' | '財運' | '事業' | '愛情';

export const TOPICS: Topic[] = ['本命', '財運', '事業', '愛情'];

/** 主題 → 本命盤宮位名 */
export const TOPIC_PALACE: Record<Topic, string> = {
  本命: '命宮',
  財運: '財帛',
  事業: '官祿',
  愛情: '夫妻',
};

/** 宮序偏移（命=0，依安宮逆佈：兄弟=命−1…） */
export const PALACE_OFFSET: Record<string, number> = {
  命宮: 0, 兄弟: 1, 夫妻: 2, 子女: 3, 財帛: 4, 疾厄: 5,
  遷移: 6, 僕役: 7, 官祿: 8, 田宅: 9, 福德: 10, 父母: 11,
};

export interface StarFact {
  name: string;
  brightness?: string;
  /** 生年四化：祿權科忌 */
  natalMutagen?: string;
}

export interface PalaceFact {
  /** 本命宮名 */
  palaceName: string;
  branch: string;
  /** 相對主題宮的角色：本宮｜對宮｜三合 */
  role: '本宮' | '對宮' | '三合';
  stars: StarFact[];
}

export interface TopicFacts {
  topic: Topic;
  palaceName: string;
  branch: string;
  /** 本宮＋對宮＋兩個三合宮 */
  group: PalaceFact[];
}

function palaceFact(a: FunctionalAstrolabe, branchIdx: number, role: PalaceFact['role']): PalaceFact {
  const p = a.palaces.find((pl) => branchIndex(pl.earthlyBranch) === branchIdx)!;
  const stars: StarFact[] = [
    ...p.majorStars.map((s) => ({
      name: s.name,
      brightness: s.brightness || undefined,
      natalMutagen: s.mutagen || undefined,
    })),
    ...p.minorStars.map((s) => ({
      name: s.name,
      brightness: s.brightness || undefined,
      natalMutagen: s.mutagen || undefined,
    })),
  ];
  return { palaceName: p.name, branch: p.earthlyBranch, role, stars };
}

/** 主題宮位的三方四正星曜事實（本宮、對宮、三合兩宮） */
export function buildTopicFacts(a: FunctionalAstrolabe): TopicFacts[] {
  return TOPICS.map((topic) => {
    const center = a.palaces.find((p) => p.name === TOPIC_PALACE[topic])!;
    const b = branchIndex(center.earthlyBranch);
    return {
      topic,
      palaceName: center.name,
      branch: center.earthlyBranch,
      group: [
        palaceFact(a, b, '本宮'),
        palaceFact(a, mod12(b + 6), '對宮'),
        palaceFact(a, mod12(b + 4), '三合'),
        palaceFact(a, mod12(b + 8), '三合'),
      ],
    };
  });
}

/** 主題宮三方四正的地支集合（判定疊星命中歸屬主題用） */
export function topicBranches(f: TopicFacts): Set<string> {
  return new Set(f.group.map((g) => g.branch));
}

/** 星曜（主星＋輔星）→ 所在宮支 */
export function starBranchMap(a: FunctionalAstrolabe): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of a.palaces) {
    for (const s of [...p.majorStars, ...p.minorStars]) map[s.name] = p.earthlyBranch;
  }
  return map;
}

export { BRANCHES };
