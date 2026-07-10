export type Gender = '男' | '女';

/** 排盤輸入（鐘錶時間） */
export interface BirthInput {
  name?: string;
  /** 國曆 YYYY-MM-DD */
  date: string;
  /** HH:MM（24 小時制） */
  time: string;
  gender: Gender;
  /** 出生地經度，預設 121（台灣） */
  longitude?: number;
  /** 出生地時區（UTC 偏移小時），預設 +8 */
  tzOffset?: number;
  /** 是否以真太陽時定時辰，預設 true（同文墨天機） */
  useTrueSolarTime?: boolean;
}

/** 排盤過程的中繼資訊，供中宮顯示與測試 */
export interface CastMeta {
  clockDate: string;
  clockTime: string;
  solarTimeDate: string;
  solarTimeHM: string;
  /** 晚子時（23:00~00:00）視為次日後，實際用於排盤的國曆日期 */
  castDate: string;
  /** 0=子 1=丑 … 11=亥（晚子時換日後恆為 0~11） */
  timeIndex: number;
  lateZiShifted: boolean;
  /** 月支 index（子=0），取安命宮所用之月 */
  monthBranchIndex: number;
  /** 子斗（子年斗君）地支 */
  ziDou: string;
  /** 生年天干、地支 */
  yearStem: string;
  yearBranch: string;
}

export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

export const branchIndex = (b: string): number => BRANCHES.indexOf(b as (typeof BRANCHES)[number]);
export const stemIndex = (s: string): number => STEMS.indexOf(s as (typeof STEMS)[number]);
export const mod12 = (n: number): number => ((n % 12) + 12) % 12;
