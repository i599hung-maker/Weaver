/**
 * 解盤第一步：倒出一張命盤的完整引擎資料。
 * 用法：npx tsx scripts/dump-chart.ts 1994-12-02 02:43 女 [經度]
 */
import { cast } from '../src/engine/cast';
import { buildAnalysis } from '../src/analysis/analysis';

const [date, time, gender, lng] = process.argv.slice(2);
if (!date || !time || !gender) {
  console.error('用法: npx tsx scripts/dump-chart.ts YYYY-MM-DD HH:MM 男|女 [經度=121.56]');
  process.exit(1);
}

const result = cast({ date, time, gender: gender as '男' | '女', longitude: lng ? Number(lng) : 121.56 });
const { astrolabe: a, meta } = result;

console.log('【基本】', JSON.stringify({
  真太陽時: `${meta.solarTimeDate} ${meta.solarTimeHM}`,
  晚子時換日: meta.lateZiShifted,
  農曆: a.lunarDate, 時辰: a.time, 五行局: a.fiveElementsClass,
  命主: a.soul, 身主: a.body, 子斗: meta.ziDou, 四柱: a.chineseDate,
}));

console.log('【十二宮】干支|宮名|大限|主星輔星|雜曜');
for (const p of a.palaces) {
  console.log(`${p.heavenlyStem}${p.earthlyBranch}|${p.name}${p.isBodyPalace ? '(身)' : ''}|${p.decadal.range}|` +
    [...p.majorStars, ...p.minorStars].map((s) => s.name + (s.brightness || '') + (s.mutagen ? `[${s.mutagen}]` : '')).join(' ') +
    '|' + p.adjectiveStars.map((s) => s.name).join(' '));
}

const an = buildAnalysis(result);
console.log('【大限與重點應期】（權重≥2 或流命/災宮引動）');
for (const d of an.decadals) {
  if (d.range[0] > 70) continue;
  console.log(`== ${d.range[0]}~${d.range[1]} ${d.stem}${d.branch}限 大官=${d.topicBranch['事業']} 大財=${d.topicBranch['財運']} 大妻=${d.topicBranch['愛情']} 災=${d.zaiBranch}${d.notes.length ? ' | ' + d.notes.join('；') : ''}`);
  const byY = new Map<number, string[]>();
  for (const h of d.hits) {
    if (h.weight >= 2 || h.method === '流命引動' || h.method === '災宮引動')
      byY.set(h.year, [...(byY.get(h.year) ?? []), `[${h.method} w${h.weight}] ${h.reason}`]);
  }
  for (const [y, rs] of [...byY.entries()].sort((p, q) => p[0] - q[0])) console.log(`  ${y}: ${rs.join(' ⧸ ')}`);
}
