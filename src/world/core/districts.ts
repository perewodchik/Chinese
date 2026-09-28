/**
 * Beijing's districts in the game (concept §2), in the order the story
 * opens them, with the stations that serve each (ids from travel.ts). The
 * content folder of a district adds its maps, people and scenes; this table
 * is what the top bar, the map and the /play card need before any of that
 * is loaded.
 */

export interface DistrictInfo {
  id: string;
  /** hanzi, as the top bar shows it */
  name: string;
  en: string;
  chapter: number;
  stations: string[];
  /** on the 🗺 schematic, 0–100 across and down (north up) */
  at: readonly [number, number];
}

export const DISTRICTS: readonly DistrictInfo[] = [
  { id: 'gulou', name: '鼓楼 · 南锣鼓巷', en: 'Drum Tower · Nanluoguxiang', chapter: 1, stations: ['nanluoguxiang', 'guloudajie'], at: [52, 30] },
  { id: 'houhai', name: '什刹海 · 后海', en: 'Shichahai · Houhai', chapter: 2, stations: ['shichahai'], at: [42, 32] },
  { id: 'jingshan', name: '景山 · 北海', en: 'Jingshan · Beihai', chapter: 2, stations: ['beihaibei'], at: [44, 40] },
  { id: 'tiananmen', name: '天安门 · 故宫', en: "Tiananmen · the Forbidden City", chapter: 1, stations: ['tiananmendong', 'tiananmenxi'], at: [47, 52] },
  { id: 'wangfujing', name: '王府井', en: 'Wangfujing', chapter: 3, stations: ['wangfujing', 'dengshikou'], at: [56, 50] },
  { id: 'qianmen', name: '前门 · 大栅栏', en: 'Qianmen · Dashilar', chapter: 3, stations: ['qianmen', 'zhushikou'], at: [47, 62] },
  { id: 'tiantan', name: '天坛', en: 'Temple of Heaven', chapter: 4, stations: ['tiantandongmen'], at: [55, 70] },
  { id: 'yonghegong', name: '雍和宫 · 国子监', en: 'Lama Temple · Imperial Academy', chapter: 4, stations: ['yonghegong', 'andingmen'], at: [58, 26] },
  { id: 'sanlitun', name: '三里屯 · 国贸', en: 'Sanlitun · Guomao', chapter: 5, stations: ['tuanjiehu', 'guomao', 'dongdaqiao'], at: [76, 46] },
  { id: 'aoyun', name: '奥林匹克公园', en: 'Olympic Park', chapter: 5, stations: ['aolinpikegongyuan'], at: [54, 8] },
  { id: 'yiheyuan', name: '颐和园', en: 'Summer Palace', chapter: 6, stations: ['yiheyuan'], at: [10, 14] },
  { id: 'panjiayuan', name: '潘家园', en: 'Panjiayuan', chapter: 6, stations: ['panjiayuan'], at: [74, 72] },
  { id: 'changcheng', name: '长城 · 八达岭', en: 'Great Wall · Badaling', chapter: 8, stations: ['badalingchangcheng'], at: [8, 2] },
];

const byId = new Map(DISTRICTS.map((d) => [d.id, d]));
export const districtInfo = (id: string): DistrictInfo | undefined => byId.get(id);
