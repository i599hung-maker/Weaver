/** 出生地 → 經度／時區（真太陽時修正用；緯度不影響排盤） */
export interface Place {
  name: string;
  longitude: number;
  tzOffset: number;
}

export const PLACES: Place[] = [
  { name: '台北', longitude: 121.56, tzOffset: 8 },
  { name: '新北', longitude: 121.46, tzOffset: 8 },
  { name: '基隆', longitude: 121.74, tzOffset: 8 },
  { name: '桃園', longitude: 121.3, tzOffset: 8 },
  { name: '新竹', longitude: 120.97, tzOffset: 8 },
  { name: '苗栗', longitude: 120.82, tzOffset: 8 },
  { name: '台中', longitude: 120.68, tzOffset: 8 },
  { name: '彰化', longitude: 120.54, tzOffset: 8 },
  { name: '南投', longitude: 120.69, tzOffset: 8 },
  { name: '雲林', longitude: 120.43, tzOffset: 8 },
  { name: '嘉義', longitude: 120.45, tzOffset: 8 },
  { name: '台南', longitude: 120.21, tzOffset: 8 },
  { name: '高雄', longitude: 120.31, tzOffset: 8 },
  { name: '屏東', longitude: 120.49, tzOffset: 8 },
  { name: '宜蘭', longitude: 121.75, tzOffset: 8 },
  { name: '花蓮', longitude: 121.6, tzOffset: 8 },
  { name: '台東', longitude: 121.15, tzOffset: 8 },
  { name: '澎湖', longitude: 119.57, tzOffset: 8 },
  { name: '金門', longitude: 118.32, tzOffset: 8 },
  { name: '馬祖', longitude: 119.95, tzOffset: 8 },
  { name: '香港', longitude: 114.17, tzOffset: 8 },
  { name: '澳門', longitude: 113.55, tzOffset: 8 },
  { name: '北京', longitude: 116.41, tzOffset: 8 },
  { name: '上海', longitude: 121.47, tzOffset: 8 },
  { name: '廣州', longitude: 113.26, tzOffset: 8 },
  { name: '深圳', longitude: 114.06, tzOffset: 8 },
  { name: '廈門', longitude: 118.09, tzOffset: 8 },
  { name: '成都', longitude: 104.07, tzOffset: 8 },
  { name: '新加坡', longitude: 103.85, tzOffset: 8 },
  { name: '吉隆坡', longitude: 101.69, tzOffset: 8 },
  { name: '東京', longitude: 139.69, tzOffset: 9 },
  { name: '大阪', longitude: 135.5, tzOffset: 9 },
  { name: '首爾', longitude: 126.98, tzOffset: 9 },
];
