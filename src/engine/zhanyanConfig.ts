import { astro } from 'iztro';

/**
 * 占驗派（文墨天機安星碼 S5VoG）四化表，十天干全數明寫鎖死。
 * 與 iztro 預設唯一差異：庚干「陽武同相」（天同化科、天相化忌）。
 */
export const ZHANYAN_MUTAGENS: Record<string, [string, string, string, string]> = {
  甲: ['廉貞', '破軍', '武曲', '太陽'],
  乙: ['天機', '天梁', '紫微', '太陰'],
  丙: ['天同', '天機', '文昌', '廉貞'],
  丁: ['太陰', '天同', '天機', '巨門'],
  戊: ['貪狼', '太陰', '右弼', '天機'],
  己: ['武曲', '貪狼', '天梁', '文曲'],
  庚: ['太陽', '武曲', '天同', '天相'],
  辛: ['巨門', '太陽', '文曲', '文昌'],
  壬: ['天梁', '紫微', '左輔', '武曲'],
  癸: ['破軍', '巨門', '太陰', '貪狼'],
};

let configured = false;

/** 套用占驗派全域設定（僅需一次）。年分界與流年分界依文墨採農曆正月初一。 */
export function ensureZhanyanConfig(): void {
  if (configured) return;
  astro.config({
    mutagens: ZHANYAN_MUTAGENS as Parameters<typeof astro.config>[0]['mutagens'],
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    ageDivide: 'normal',
  });
  configured = true;
}
