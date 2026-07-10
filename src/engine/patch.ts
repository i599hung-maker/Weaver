import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';
import { branchIndex, mod12, stemIndex } from './types';

type AnyStar = { name: string; type: string; scope: string; brightness?: string; mutagen?: string };

/** 驛馬三合：月支 → 天馬所在支（寅午戌→申、申子辰→寅、巳酉丑→亥、亥卯未→巳） */
export function tianmaBranchByMonth(monthBranchIdx: number): number {
  return [2, 11, 8, 5][monthBranchIdx % 4];
}

/** 截空：截路空亡兩宮中，取支陰陽與年干陰陽相同之宮（單星） */
export function jiekongBranch(yearStemIdx: number): number {
  const pairStart = [8, 6, 4, 2, 0][yearStemIdx % 5]; // 甲己申、乙庚午、丙辛辰、丁壬寅、戊癸子
  return pairStart + (yearStemIdx % 2); // 陽干取陽支宮、陰干取陰支宮
}

/** 旬空：生年所在旬的空亡兩支中，取支陰陽與年干陰陽相異之宮（單星） */
export function xunkongBranch(yearStemIdx: number, yearBranchIdx: number): number {
  const kong1 = mod12(yearBranchIdx + (9 - yearStemIdx) + 1); // 癸位之後第一支（陽支）
  return yearStemIdx % 2 === 0 ? mod12(kong1 + 1) : kong1; // 陽年取陰支、陰年取陽支
}

function palaceByBranch(astrolabe: FunctionalAstrolabe, branchIdx: number) {
  const p = astrolabe.palaces.find((pl) => branchIndex(pl.earthlyBranch) === branchIdx);
  if (!p) throw new Error(`palace not found for branch ${branchIdx}`);
  return p;
}

function removeStar(astrolabe: FunctionalAstrolabe, list: 'minorStars' | 'adjectiveStars', name: string): AnyStar | null {
  for (const p of astrolabe.palaces) {
    const arr = p[list] as unknown as AnyStar[];
    const i = arr.findIndex((s) => s.name === name);
    if (i >= 0) return arr.splice(i, 1)[0];
  }
  return null;
}

/**
 * 占驗派安星修正（S5VoG 與 iztro 預設的唯二差異）：
 * 1. 天馬改依月支
 * 2. 截空、旬空單星制（截空同陰陽、旬空異陰陽），移除 iztro 的截路／空亡／旬空
 */
export function applyZhanyanPatches(
  astrolabe: FunctionalAstrolabe,
  monthBranchIdx: number,
  yearStem: string,
  yearBranch: string,
): void {
  const tianma = removeStar(astrolabe, 'minorStars', '天馬');
  if (tianma) {
    const target = palaceByBranch(astrolabe, tianmaBranchByMonth(monthBranchIdx));
    (target.minorStars as unknown as AnyStar[]).push(tianma);
  }

  removeStar(astrolabe, 'adjectiveStars', '截路');
  removeStar(astrolabe, 'adjectiveStars', '空亡');
  removeStar(astrolabe, 'adjectiveStars', '旬空');

  const ys = stemIndex(yearStem);
  const yb = branchIndex(yearBranch);
  const jiekong: AnyStar = { name: '截空', type: 'adjective', scope: 'origin' };
  const xunkong: AnyStar = { name: '旬空', type: 'adjective', scope: 'origin' };
  (palaceByBranch(astrolabe, jiekongBranch(ys)).adjectiveStars as unknown as AnyStar[]).push(jiekong as never);
  (palaceByBranch(astrolabe, xunkongBranch(ys, yb)).adjectiveStars as unknown as AnyStar[]).push(xunkong as never);
}
