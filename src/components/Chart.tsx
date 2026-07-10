import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import type { Horoscope } from 'iztro/lib/data/types';
import type { CastMeta } from '../engine/types';
import { branchIndex, mod12 } from '../engine/types';
import Palace, { type PalaceOverlay } from './Palace';
import { PALACE_SHORT } from './starColors';

/** 地支 → 4x4 盤面格位（row, col） */
const GRID_POS: Record<string, [number, number]> = {
  巳: [1, 1], 午: [1, 2], 未: [1, 3], 申: [1, 4],
  辰: [2, 1], 酉: [2, 4],
  卯: [3, 1], 戌: [3, 4],
  寅: [4, 1], 丑: [4, 2], 子: [4, 3], 亥: [4, 4],
};

interface Props {
  astrolabe: FunctionalAstrolabe;
  meta: CastMeta;
  name: string;
  birthYear: number;
  horoscope: Horoscope | null;
  showYearly: boolean;
  selDecadalBranch: string | null;
  simple: boolean;
}

const MUTAGEN_LABELS = ['祿', '權', '科', '忌'];

function mutagenMap(stars: string[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  stars?.forEach((s, i) => {
    map[s] = MUTAGEN_LABELS[i];
  });
  return map;
}

export default function Chart({ astrolabe: a, meta, name, birthYear, horoscope, showYearly, selDecadalBranch, simple }: Props) {
  const yb = branchIndex(meta.yearBranch);
  const decMutagen = horoscope ? mutagenMap(horoscope.decadal.mutagen) : undefined;
  const yrMutagen = horoscope && showYearly ? mutagenMap(horoscope.yearly.mutagen) : undefined;

  const yinYang = '甲丙戊庚壬'.includes(meta.yearStem) ? '陽' : '陰';
  const pillars = a.chineseDate.split(' ');

  return (
    <div className="chart">
      {a.palaces.map((p, i) => {
        const [row, col] = GRID_POS[p.earthlyBranch];
        // 流年虛歲：流年支落此宮的歲數
        const first = mod12(branchIndex(p.earthlyBranch) - yb) + 1;
        const yearAges = Array.from({ length: 5 }, (_, k) => first + 12 * k);

        const overlay: PalaceOverlay = {};
        if (horoscope) {
          overlay.decadalName = `大${PALACE_SHORT[horoscope.decadal.palaceNames[i]] ?? horoscope.decadal.palaceNames[i]}`;
          overlay.decadalMutagen = decMutagen;
          const horoStars: string[] = [];
          if (!simple) horoscope.decadal.stars?.[i]?.forEach((s) => horoStars.push(s.name));
          if (showYearly) {
            overlay.yearlyName = `年${PALACE_SHORT[horoscope.yearly.palaceNames[i]] ?? horoscope.yearly.palaceNames[i]}`;
            overlay.yearlyMutagen = yrMutagen;
            if (!simple) horoscope.yearly.stars?.[i]?.forEach((s) => horoStars.push(s.name));
            overlay.yearlyJiangqian = horoscope.yearly.yearlyDecStar?.jiangqian12?.[i];
            overlay.yearlySuiqian = horoscope.yearly.yearlyDecStar?.suiqian12?.[i];
          }
          overlay.horoscopeStars = horoStars;
        }

        return (
          <div key={p.earthlyBranch} style={{ gridRow: row, gridColumn: col }}>
            <Palace
              palace={p}
              overlay={overlay}
              yearAges={yearAges}
              isSelectedDecadal={p.earthlyBranch === selDecadalBranch}
              isSelectedYear={!!horoscope && showYearly && horoscope.yearly.index === i}
              simple={simple}
            />
          </div>
        );
      })}

      <div className="center" style={{ gridRow: '2 / 4', gridColumn: '2 / 4' }}>
        <div className="center-grid">
          <span className="k">姓名</span>
          <span>{name || '—'}</span>
          <span className="k">性別</span>
          <span>
            {yinYang}
            {a.gender} {a.fiveElementsClass}
          </span>
          <span className="k">鐘錶時間</span>
          <span>
            {meta.clockDate} {meta.clockTime}
          </span>
          <span className="k">真太陽時</span>
          <span>
            {meta.solarTimeDate} {meta.solarTimeHM}
            {meta.lateZiShifted ? '（晚子時→次日）' : ''}
          </span>
          <span className="k">農曆</span>
          <span>
            {a.lunarDate} {a.time}
          </span>
          <span className="k">四柱</span>
          <span className="pillars">{pillars.join('　')}</span>
          <span className="k">命主</span>
          <span>{a.soul}</span>
          <span className="k">身主</span>
          <span>{a.body}</span>
          <span className="k">子斗</span>
          <span>{meta.ziDou}</span>
          {horoscope && (
            <>
              <span className="k">大限</span>
              <span>
                {horoscope.decadal.heavenlyStem}
                {horoscope.decadal.earthlyBranch}限
              </span>
              {showYearly && (
                <>
                  <span className="k">流年</span>
                  <span>
                    {horoscope.yearly.heavenlyStem}
                    {horoscope.yearly.earthlyBranch}年 {birthYear ? '' : ''}
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <p className="legend">
          四化：<b className="mut mut-祿">祿</b>
          <b className="mut mut-權">權</b>
          <b className="mut mut-科">科</b>
          <b className="mut mut-忌">忌</b>
          ｜<span className="badge badge-dec">大限疊宮</span>
          <span className="badge badge-yr">流年疊宮</span>
        </p>
      </div>
    </div>
  );
}
