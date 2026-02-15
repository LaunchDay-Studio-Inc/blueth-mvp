import { DISTRICTS } from '@/lib/districts';
import type { DistrictGeo } from './types';

/**
 * Geographic district data for Map V3.
 *
 * ViewBox: 0 0 1200 900
 * East edge is coastline (x ~850-950).
 * Ring road at roughly x:120-880, y:100-780.
 */

const GEO_DATA: Record<string, Omit<DistrictGeo, keyof import('@/lib/districts').DistrictMeta>> = {
  CBD: {
    polygon: [
      [500, 340], [580, 310], [640, 340], [640, 420],
      [580, 450], [500, 420],
    ],
    center: [570, 380],
    neighbors: ['OLD_TOWN', 'MARINA', 'TECH_PARK', 'MARKET_SQ', 'ENTERTAINMENT'],
  },
  OLD_TOWN: {
    polygon: [
      [360, 320], [440, 290], [500, 340], [500, 420],
      [440, 450], [360, 420],
    ],
    center: [430, 370],
    neighbors: ['CBD', 'UNIVERSITY', 'MARKET_SQ', 'SUBURBS_N'],
  },
  MARINA: {
    polygon: [
      [700, 200], [800, 180], [880, 220], [880, 320],
      [800, 340], [700, 310],
    ],
    center: [790, 265],
    neighbors: ['CBD', 'HARBOR', 'TECH_PARK'],
  },
  TECH_PARK: {
    polygon: [
      [580, 220], [680, 200], [700, 260], [700, 310],
      [640, 340], [580, 310],
    ],
    center: [645, 275],
    neighbors: ['CBD', 'MARINA', 'SUBURBS_N', 'ENTERTAINMENT'],
  },
  MARKET_SQ: {
    polygon: [
      [380, 450], [460, 440], [500, 480], [480, 550],
      [400, 560], [360, 510],
    ],
    center: [430, 500],
    neighbors: ['CBD', 'OLD_TOWN', 'ENTERTAINMENT', 'UNIVERSITY'],
  },
  ENTERTAINMENT: {
    polygon: [
      [500, 450], [580, 440], [620, 490], [600, 570],
      [520, 570], [480, 520],
    ],
    center: [550, 505],
    neighbors: ['CBD', 'MARKET_SQ', 'TECH_PARK', 'INDUSTRIAL'],
  },
  UNIVERSITY: {
    polygon: [
      [220, 320], [320, 290], [360, 340], [360, 420],
      [300, 450], [220, 420],
    ],
    center: [295, 370],
    neighbors: ['OLD_TOWN', 'MARKET_SQ', 'SUBURBS_N', 'SUBURBS_S', 'OUTSKIRTS'],
  },
  HARBOR: {
    polygon: [
      [800, 340], [880, 320], [920, 380], [920, 480],
      [860, 500], [780, 460],
    ],
    center: [860, 415],
    neighbors: ['MARINA', 'INDUSTRIAL'],
  },
  INDUSTRIAL: {
    polygon: [
      [700, 500], [800, 470], [860, 500], [880, 600],
      [800, 640], [700, 590],
    ],
    center: [790, 550],
    neighbors: ['HARBOR', 'ENTERTAINMENT', 'SUBURBS_S'],
  },
  SUBURBS_N: {
    polygon: [
      [300, 160], [420, 140], [480, 190], [460, 270],
      [380, 290], [280, 260],
    ],
    center: [385, 220],
    neighbors: ['OLD_TOWN', 'TECH_PARK', 'UNIVERSITY', 'OUTSKIRTS'],
  },
  SUBURBS_S: {
    polygon: [
      [280, 560], [400, 550], [440, 610], [420, 700],
      [320, 720], [260, 660],
    ],
    center: [355, 635],
    neighbors: ['UNIVERSITY', 'MARKET_SQ', 'INDUSTRIAL', 'OUTSKIRTS'],
  },
  OUTSKIRTS: {
    polygon: [
      [120, 200], [220, 180], [240, 260], [240, 620],
      [200, 700], [120, 680],
    ],
    center: [180, 440],
    neighbors: ['UNIVERSITY', 'SUBURBS_N', 'SUBURBS_S'],
  },
};

/** Merge existing DistrictMeta with V3 geo data */
export const DISTRICTS_GEO: DistrictGeo[] = DISTRICTS.map((d) => {
  const geo = GEO_DATA[d.code];
  if (!geo) throw new Error(`Missing geo data for district: ${d.code}`);
  return { ...d, ...geo };
});

/** Lookup by code */
export function getDistrictGeo(code: string): DistrictGeo | undefined {
  return DISTRICTS_GEO.find((d) => d.code === code);
}

/** Convert polygon to SVG points string */
export function polygonToPoints(poly: [number, number][]): string {
  return poly.map(([x, y]) => `${x},${y}`).join(' ');
}
