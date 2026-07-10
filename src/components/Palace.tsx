import type { IFunctionalPalace } from 'iztro/lib/astro/FunctionalPalace';
import { starKind } from './starColors';

export interface PalaceOverlay {
  decadalName?: string; // 大命…
  yearlyName?: string; // 年命…
  decadalMutagen?: Record<string, string>; // 星名 → 祿權科忌
  yearlyMutagen?: Record<string, string>;
  horoscopeStars?: string[]; // 運曜＋流曜
  yearlyJiangqian?: string;
  yearlySuiqian?: string;
}

interface Props {
  palace: IFunctionalPalace;
  overlay: PalaceOverlay;
  yearAges: number[]; // 流年虛歲
  isSelectedDecadal: boolean;
  isSelectedYear: boolean;
  simple: boolean;
}

/** 精簡盤保留的雜曜 */
const SIMPLE_ADJ = new Set(['紅鸞', '天喜', '天姚', '咸池', '天刑']);

function StarChip({
  name,
  brightness,
  mutagen,
  kind,
  decadalMutagen,
  yearlyMutagen,
  showBrightness,
}: {
  name: string;
  brightness?: string;
  mutagen?: string;
  kind: string;
  decadalMutagen?: string;
  yearlyMutagen?: string;
  showBrightness: boolean;
}) {
  return (
    <span className={`star star-${kind}`}>
      {name}
      {showBrightness && brightness ? <i className="bri">{brightness}</i> : null}
      {mutagen ? <b className={`mut mut-${mutagen}`}>{mutagen}</b> : null}
      {decadalMutagen ? <b className="mut mut-dec">大{decadalMutagen}</b> : null}
      {yearlyMutagen ? <b className="mut mut-yr">年{yearlyMutagen}</b> : null}
    </span>
  );
}

export default function Palace({ palace: p, overlay, yearAges, isSelectedDecadal, isSelectedYear, simple }: Props) {
  const cls = ['palace'];
  if (simple) cls.push('simple');
  if (isSelectedDecadal) cls.push('sel-decadal');
  if (isSelectedYear) cls.push('sel-year');

  const chip = (s: { name: string; brightness?: string; mutagen?: string }, isMajor: boolean) => (
    <StarChip
      key={s.name}
      name={s.name}
      brightness={s.brightness || undefined}
      mutagen={s.mutagen || undefined}
      kind={isMajor ? 'major' : starKind(s.name, false)}
      decadalMutagen={overlay.decadalMutagen?.[s.name]}
      yearlyMutagen={overlay.yearlyMutagen?.[s.name]}
      showBrightness={!simple}
    />
  );

  const badges = (
    <>
      {p.isBodyPalace && <span className="badge badge-body">身宮</span>}
      {overlay.decadalName && <span className="badge badge-dec">{overlay.decadalName}</span>}
      {overlay.yearlyName && <span className="badge badge-yr">{overlay.yearlyName}</span>}
    </>
  );

  if (simple) {
    return (
      <div className={cls.join(' ')}>
        <div className="gz-vert">
          <span>{p.heavenlyStem}</span>
          <span>{p.earthlyBranch}</span>
        </div>
        <div className="p-stars">
          <div className="col-stars">
            {p.majorStars.map((s) => chip(s, true))}
            {p.minorStars.map((s) => chip(s, false))}
            {p.adjectiveStars.filter((s) => SIMPLE_ADJ.has(s.name)).map((s) => chip(s, false))}
          </div>
        </div>
        <div className="p-foot">
          <span className="p-range">
            {p.decadal.range[0]}-{p.decadal.range[1]}
          </span>
          <span className="foot-right">
            <span className="p-badges">{badges}</span>
            <span className="p-name">{p.name}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cls.join(' ')}>
      <div className="p-stars">
        <div className="row-major">{p.majorStars.map((s) => chip(s, true))}</div>
        <div className="row-minor">{p.minorStars.map((s) => chip(s, false))}</div>
        <div className="row-adj">
          {p.adjectiveStars.map((s) => (
            <span key={s.name} className={`star star-${starKind(s.name, false)}`}>
              {s.name}
            </span>
          ))}
        </div>
        {overlay.horoscopeStars && overlay.horoscopeStars.length > 0 && (
          <div className="row-horo">
            {overlay.horoscopeStars.map((n) => (
              <span key={n} className="star star-horo">
                {n}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-badges">{badges}</div>

      <div className="p-ages">
        <span>流年 {yearAges.join(',')}</span>
        <span>小限 {p.ages.slice(0, 5).join(',')}</span>
      </div>

      <div className="p-gods">
        <span className="god">{p.changsheng12}</span>
        <span className="god">{p.boshi12}</span>
        <span className={overlay.yearlyJiangqian ? 'god god-flow' : 'god'}>
          {overlay.yearlyJiangqian ?? p.jiangqian12}
        </span>
        <span className={overlay.yearlySuiqian ? 'god god-flow' : 'god'}>
          {overlay.yearlySuiqian ?? p.suiqian12}
        </span>
      </div>

      <div className="p-bottom">
        <span className="p-range">
          {p.decadal.range[0]}-{p.decadal.range[1]}
        </span>
        <span className="p-name">{p.name}</span>
        <span className="p-gz">
          {p.heavenlyStem}
          {p.earthlyBranch}
        </span>
      </div>
    </div>
  );
}
