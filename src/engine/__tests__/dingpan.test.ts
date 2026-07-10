import { describe, expect, it } from 'vitest';
import { cast } from '../cast';
import type FunctionalAstrolabe from 'iztro/lib/astro/FunctionalAstrolabe';

/**
 * 定盤測試：三個命例逐項比對文墨天機（安星碼 S5VoG）截圖。
 * 來源：定盤截圖（本機保存，不入庫）
 */

function palaceOf(a: FunctionalAstrolabe, branch: string) {
  const p = a.palaces.find((pl) => pl.earthlyBranch === branch);
  if (!p) throw new Error(`no palace at ${branch}`);
  return p;
}

function starNames(a: FunctionalAstrolabe, branch: string): string[] {
  const p = palaceOf(a, branch);
  return [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].map((s) => s.name);
}

function mutagenOf(a: FunctionalAstrolabe, star: string): string | undefined {
  for (const p of a.palaces) {
    const s = [...p.majorStars, ...p.minorStars].find((st) => st.name === star);
    if (s?.mutagen) return s.mutagen;
  }
  return undefined;
}

describe('命例一：1996-05-12 23:40 男（晚子時，丙子年三月廿六子時）', () => {
  const { astrolabe: a, meta } = cast({ date: '1996-05-12', time: '23:40', gender: '男' });

  it('晚子時視為次日，農曆三月廿六子時', () => {
    expect(meta.lateZiShifted).toBe(true);
    expect(meta.castDate).toBe('1996-05-13');
    expect(a.lunarDate).toContain('三月廿六');
  });

  it('水二局、命宮壬辰身宮同、命主廉貞身主火星', () => {
    expect(a.fiveElementsClass).toBe('水二局');
    expect(a.earthlyBranchOfSoulPalace).toBe('辰');
    expect(a.earthlyBranchOfBodyPalace).toBe('辰');
    expect(a.soul).toBe('廉貞');
    expect(a.body).toBe('火星');
  });

  it('子斗在戌', () => {
    expect(meta.ziDou).toBe('戌');
  });

  it('丙年四化：同祿機權昌科廉忌', () => {
    expect(mutagenOf(a, '天同')).toBe('祿');
    expect(mutagenOf(a, '天機')).toBe('權');
    expect(mutagenOf(a, '文昌')).toBe('科');
    expect(mutagenOf(a, '廉貞')).toBe('忌');
  });

  it('天馬依月支（辰月→寅）', () => {
    expect(starNames(a, '寅')).toContain('天馬');
  });

  it('截空在辰（丙陽年取陽支宮）、旬空在酉（取陰支宮）', () => {
    expect(starNames(a, '辰')).toContain('截空');
    expect(starNames(a, '酉')).toContain('旬空');
    for (const b of ['子', '丑', '寅', '卯', '巳', '午', '未', '申', '戌', '亥']) {
      expect(starNames(a, b)).not.toContain('截空');
      expect(starNames(a, b)).not.toContain('旬空');
    }
    for (const b of ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']) {
      expect(starNames(a, b)).not.toContain('截路');
      expect(starNames(a, b)).not.toContain('空亡');
    }
  });

  it('大限：命宮辰 2-11 起，順行', () => {
    expect(palaceOf(a, '辰').decadal.range).toEqual([2, 11]);
    expect(palaceOf(a, '巳').decadal.range).toEqual([12, 21]);
    expect(palaceOf(a, '午').decadal.range).toEqual([22, 31]);
  });

  it('關鍵星曜落宮抽查（對照截圖）', () => {
    expect(starNames(a, '寅')).toEqual(expect.arrayContaining(['紫微', '天府', '火星']));
    expect(starNames(a, '戌')).toEqual(expect.arrayContaining(['武曲', '文昌', '鈴星']));
    expect(starNames(a, '亥')).toEqual(expect.arrayContaining(['太陽', '天魁', '地空', '地劫', '天刑', '天使']));
    expect(starNames(a, '酉')).toEqual(expect.arrayContaining(['天同', '天鉞', '天喜', '天傷']));
    expect(starNames(a, '巳')).toEqual(expect.arrayContaining(['巨門', '祿存']));
    expect(starNames(a, '午')).toEqual(expect.arrayContaining(['廉貞', '天相', '左輔', '擎羊']));
  });
});

describe('命例二：1994-12-02 02:43 女（甲戌年十月三十丑時）', () => {
  const { astrolabe: a, meta } = cast({ date: '1994-12-02', time: '02:43', gender: '女' });

  it('丑時、火六局、命宮戌、身宮子、命主祿存身主文昌', () => {
    expect(meta.timeIndex).toBe(1);
    expect(a.fiveElementsClass).toBe('火六局');
    expect(a.earthlyBranchOfSoulPalace).toBe('戌');
    expect(a.earthlyBranchOfBodyPalace).toBe('子');
    expect(a.soul).toBe('祿存');
    expect(a.body).toBe('文昌');
  });

  it('子斗在辰', () => {
    expect(meta.ziDou).toBe('辰');
  });

  it('甲年四化：廉祿破權武科陽忌', () => {
    expect(mutagenOf(a, '廉貞')).toBe('祿');
    expect(mutagenOf(a, '破軍')).toBe('權');
    expect(mutagenOf(a, '武曲')).toBe('科');
    expect(mutagenOf(a, '太陽')).toBe('忌');
  });

  it('天馬依月支（亥月→巳），依年支的申宮不得有天馬', () => {
    expect(starNames(a, '巳')).toContain('天馬');
    expect(starNames(a, '申')).not.toContain('天馬');
  });

  it('截空在申（甲陽年取陽支宮）、旬空在酉', () => {
    expect(starNames(a, '申')).toContain('截空');
    expect(starNames(a, '酉')).toContain('旬空');
  });

  it('大限：命宮戌 6-15 起，陽女逆行', () => {
    expect(palaceOf(a, '戌').decadal.range).toEqual([6, 15]);
    expect(palaceOf(a, '酉').decadal.range).toEqual([16, 25]);
    expect(palaceOf(a, '申').decadal.range).toEqual([26, 35]);
  });

  it('關鍵星曜落宮抽查（對照截圖）', () => {
    expect(starNames(a, '寅')).toEqual(expect.arrayContaining(['武曲', '天相', '祿存', '火星']));
    expect(starNames(a, '辰')).toEqual(expect.arrayContaining(['七殺', '鈴星']));
    expect(starNames(a, '丑')).toEqual(expect.arrayContaining(['天同', '巨門', '左輔', '右弼', '天魁', '陀羅']));
    expect(starNames(a, '未')).toEqual(expect.arrayContaining(['天鉞']));
    expect(starNames(a, '戌')).toEqual(expect.arrayContaining(['廉貞', '天府', '地空']));
  });
});

describe('命例三：1969-03-11 11:50 女（己酉年正月廿三午時）', () => {
  const { astrolabe: a, meta } = cast({ date: '1969-03-11', time: '11:50', gender: '女' });

  it('午時、金四局、命宮申身宮同、命主廉貞身主天同', () => {
    expect(meta.timeIndex).toBe(6);
    expect(a.fiveElementsClass).toBe('金四局');
    expect(a.earthlyBranchOfSoulPalace).toBe('申');
    expect(a.earthlyBranchOfBodyPalace).toBe('申');
    expect(a.soul).toBe('廉貞');
    expect(a.body).toBe('天同');
  });

  it('子斗在午', () => {
    expect(meta.ziDou).toBe('午');
  });

  it('己年四化：武祿貪權梁科曲忌', () => {
    expect(mutagenOf(a, '武曲')).toBe('祿');
    expect(mutagenOf(a, '貪狼')).toBe('權');
    expect(mutagenOf(a, '天梁')).toBe('科');
    expect(mutagenOf(a, '文曲')).toBe('忌');
  });

  it('天馬依月支（寅月→申），依年支的亥宮不得有天馬', () => {
    expect(starNames(a, '申')).toContain('天馬');
    expect(starNames(a, '亥')).not.toContain('天馬');
  });

  it('截空在酉（己陰年取陰支宮）、旬空在寅（取陽支宮）', () => {
    expect(starNames(a, '酉')).toContain('截空');
    expect(starNames(a, '寅')).toContain('旬空');
  });

  it('大限：命宮申 4-13 起，陰女順行', () => {
    expect(palaceOf(a, '申').decadal.range).toEqual([4, 13]);
    expect(palaceOf(a, '酉').decadal.range).toEqual([14, 23]);
    expect(palaceOf(a, '戌').decadal.range).toEqual([24, 33]);
  });

  it('關鍵星曜落宮抽查（對照截圖）', () => {
    expect(starNames(a, '酉')).toEqual(expect.arrayContaining(['火星', '天刑']));
    expect(starNames(a, '辰')).toEqual(expect.arrayContaining(['七殺', '左輔', '文昌', '鈴星']));
    expect(starNames(a, '午')).toEqual(expect.arrayContaining(['紫微', '祿存', '紅鸞']));
    expect(starNames(a, '子')).toEqual(expect.arrayContaining(['貪狼', '天魁', '天喜']));
    expect(starNames(a, '巳')).toEqual(expect.arrayContaining(['天機', '陀羅', '地空', '地劫']));
  });
});

describe('庚干四化（占驗派陽武同相）', () => {
  // 1990-08-01 為庚午年
  const { astrolabe: a } = cast({ date: '1990-08-01', time: '10:00', gender: '男' });

  it('太陽祿、武曲權、天同科、天相忌', () => {
    expect(mutagenOf(a, '太陽')).toBe('祿');
    expect(mutagenOf(a, '武曲')).toBe('權');
    expect(mutagenOf(a, '天同')).toBe('科');
    expect(mutagenOf(a, '天相')).toBe('忌');
  });
});
