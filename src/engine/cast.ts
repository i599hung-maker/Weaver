import { astro } from 'iztro';
import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import { ensureZhanyanConfig } from './zhanyanConfig';
import { toTrueSolarTime } from './solarTime';
import { applyZhanyanPatches } from './patch';
import { BRANCHES, branchIndex, mod12, type BirthInput, type CastMeta } from './types';

export interface CastResult {
  astrolabe: FunctionalAstrolabe;
  meta: CastMeta;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 依占驗派（S5VoG）規則排盤 */
export function cast(input: BirthInput): CastResult {
  ensureZhanyanConfig();
  const longitude = input.longitude ?? 121;
  const tzOffset = input.tzOffset ?? 8;
  const useTst = input.useTrueSolarTime ?? true;

  const solar = useTst
    ? toTrueSolarTime(input.date, input.time, longitude, tzOffset)
    : { date: input.date, hm: input.time };

  const hour = Number(solar.hm.split(':')[0]);
  // 晚子時（23:00~00:00）視為次日早子時（紫微＋八字）
  const lateZiShifted = hour === 23;
  const castDate = lateZiShifted ? addDays(solar.date, 1) : solar.date;
  const timeIndex = lateZiShifted ? 0 : Math.floor((hour + 1) / 2);

  const astrolabe = astro.bySolar<FunctionalAstrolabe>(castDate, timeIndex, input.gender, true, 'zh-TW');

  const [yearGZ] = astrolabe.chineseDate.split(' ');
  const yearStem = yearGZ[0];
  const yearBranch = yearGZ[1];

  // 安命宮所用之月：月宮支 = 命宮支 + 時辰數（寅起正月順數）
  const monthBranchIndex = mod12(branchIndex(astrolabe.earthlyBranchOfSoulPalace) + timeIndex);

  applyZhanyanPatches(astrolabe, monthBranchIndex, yearStem, yearBranch);

  // 子斗（子年斗君）：由子宮逆數（生月−1），再順數生時
  const monthNumber = mod12(monthBranchIndex - 2) + 1; // 寅=正月
  const ziDou = BRANCHES[mod12(0 - (monthNumber - 1) + timeIndex)];

  return {
    astrolabe,
    meta: {
      clockDate: input.date,
      clockTime: input.time,
      solarTimeDate: solar.date,
      solarTimeHM: solar.hm,
      castDate,
      timeIndex,
      lateZiShifted,
      monthBranchIndex,
      ziDou,
      yearStem,
      yearBranch,
    },
  };
}
