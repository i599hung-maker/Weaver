import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import { STEMS, BRANCHES, branchIndex, stemIndex, mod12 } from '../engine/types';

interface Props {
  astrolabe: FunctionalAstrolabe;
  birthYear: number;
  yearStem: string;
  yearBranch: string;
  selDecadalBranch: string | null;
  selYear: number | null;
  onSelectDecadal: (branch: string | null) => void;
  onSelectYear: (year: number | null) => void;
}

function ganzhiOfYear(year: number, birthYear: number, yearStem: string, yearBranch: string): string {
  const diff = year - birthYear;
  const stem = STEMS[(((stemIndex(yearStem) + diff) % 10) + 10) % 10];
  const branch = BRANCHES[mod12(branchIndex(yearBranch) + diff)];
  return `${stem}${branch}`;
}

/** 單行可滑動的選項列：標籤＋左右箭頭＋橫向捲動軌道 */
function ScrollRow({ label, children }: { label: string; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    trackRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <button className="bar-arrow" title="往左" onClick={() => scroll(-1)}>
        <ChevronLeft size={15} strokeWidth={1.8} />
      </button>
      <div className="bar-track" ref={trackRef}>
        {children}
      </div>
      <button className="bar-arrow" title="往右" onClick={() => scroll(1)}>
        <ChevronRight size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export default function HoroscopeBar({
  astrolabe,
  birthYear,
  yearStem,
  yearBranch,
  selDecadalBranch,
  selYear,
  onSelectDecadal,
  onSelectYear,
}: Props) {
  const decadals = [...astrolabe.palaces].sort((a, b) => a.decadal.range[0] - b.decadal.range[0]);
  const selPalace = astrolabe.palaces.find((p) => p.earthlyBranch === selDecadalBranch);

  return (
    <div className="horo-bar">
      <ScrollRow label="大限">
        <button className={selDecadalBranch === null ? 'active' : ''} onClick={() => onSelectDecadal(null)}>
          本命
        </button>
        {decadals.map((p) => (
          <button
            key={p.earthlyBranch}
            className={selDecadalBranch === p.earthlyBranch ? 'active' : ''}
            onClick={() => onSelectDecadal(p.earthlyBranch)}
          >
            {p.decadal.range[0]}~{p.decadal.range[1]}
            <small>
              {p.heavenlyStem}
              {p.earthlyBranch}限
            </small>
          </button>
        ))}
      </ScrollRow>
      {selPalace && (
        <ScrollRow label="流年">
          <button className={selYear === null ? 'active' : ''} onClick={() => onSelectYear(null)}>
            不選
          </button>
          {Array.from({ length: selPalace.decadal.range[1] - selPalace.decadal.range[0] + 1 }, (_, k) => {
            const age = selPalace.decadal.range[0] + k;
            const year = birthYear + age - 1;
            return (
              <button key={year} className={selYear === year ? 'active' : ''} onClick={() => onSelectYear(year)}>
                {year}
                <small>
                  {ganzhiOfYear(year, birthYear, yearStem, yearBranch)}
                  {age}歲
                </small>
              </button>
            );
          })}
        </ScrollRow>
      )}
    </div>
  );
}
