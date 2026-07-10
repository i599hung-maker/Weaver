const LUCKY = new Set(['左輔', '右弼', '文昌', '文曲', '天魁', '天鉞', '祿存', '天馬']);
const MALEFIC = new Set(['擎羊', '陀羅', '火星', '鈴星', '地空', '地劫']);
const FLOWER = new Set(['紅鸞', '天喜', '天姚', '咸池']);

export type StarKind = 'major' | 'lucky' | 'malefic' | 'flower' | 'adj';

export function starKind(name: string, isMajor: boolean): StarKind {
  if (isMajor) return 'major';
  if (LUCKY.has(name)) return 'lucky';
  if (MALEFIC.has(name)) return 'malefic';
  if (FLOWER.has(name)) return 'flower';
  return 'adj';
}

export const PALACE_SHORT: Record<string, string> = {
  命宮: '命',
  兄弟: '兄',
  夫妻: '妻',
  子女: '子',
  財帛: '財',
  疾厄: '疾',
  遷移: '遷',
  僕役: '友',
  交友: '友',
  官祿: '官',
  事業: '官',
  田宅: '田',
  福德: '福',
  父母: '父',
};
