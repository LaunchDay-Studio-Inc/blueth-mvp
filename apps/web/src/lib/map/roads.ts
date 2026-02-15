import type { Road } from './types';

/**
 * Road network for Map V3.
 * Paths are SVG `d` attributes in the 1200x900 viewBox.
 */
export const ROADS: Road[] = [
  // ── Ring Road (highway) ──
  {
    id: 'ring-road',
    type: 'highway',
    path: 'M280,140 Q500,90 780,160 Q940,260 940,500 Q900,700 680,720 Q400,760 220,680 Q100,560 100,320 Q120,160 280,140 Z',
    connects: ['OUTSKIRTS', 'OUTSKIRTS'],
  },

  // ── Primary roads ──
  {
    id: 'main-avenue',
    type: 'primary',
    path: 'M570,180 L570,380 Q565,440 550,505 L540,600',
    connects: ['TECH_PARK', 'ENTERTAINMENT'],
  },
  {
    id: 'university-blvd',
    type: 'primary',
    path: 'M295,370 Q360,365 430,370 L570,380',
    connects: ['UNIVERSITY', 'CBD'],
  },
  {
    id: 'marina-drive',
    type: 'primary',
    path: 'M640,360 Q700,330 790,265',
    connects: ['CBD', 'MARINA'],
  },
  {
    id: 'tech-corridor',
    type: 'primary',
    path: 'M580,310 Q610,290 645,275',
    connects: ['CBD', 'TECH_PARK'],
  },
  {
    id: 'harbor-freight',
    type: 'primary',
    path: 'M860,415 Q840,470 790,550 Q760,620 740,680',
    connects: ['HARBOR', 'INDUSTRIAL'],
  },

  // ── Secondary roads ──
  {
    id: 'waterfront-rd',
    type: 'secondary',
    path: 'M790,265 Q830,300 860,340 L860,415',
    connects: ['MARINA', 'HARBOR'],
  },
  {
    id: 'suburb-n-arterial',
    type: 'secondary',
    path: 'M385,220 Q410,280 430,340 L450,370',
    connects: ['SUBURBS_N', 'OLD_TOWN'],
  },
  {
    id: 'suburb-s-arterial',
    type: 'secondary',
    path: 'M355,635 Q380,580 430,500',
    connects: ['SUBURBS_S', 'MARKET_SQ'],
  },
  {
    id: 'outskirts-link-n',
    type: 'secondary',
    path: 'M180,300 Q230,280 295,260',
    connects: ['OUTSKIRTS', 'SUBURBS_N'],
  },
  {
    id: 'outskirts-link-s',
    type: 'secondary',
    path: 'M180,580 Q220,600 280,620',
    connects: ['OUTSKIRTS', 'SUBURBS_S'],
  },

  // ── Tertiary roads ──
  {
    id: 'old-town-lane',
    type: 'tertiary',
    path: 'M380,340 Q410,360 440,380 Q430,410 410,440',
    connects: ['OLD_TOWN', 'OLD_TOWN'],
  },
  {
    id: 'entertainment-strip',
    type: 'tertiary',
    path: 'M480,520 Q500,510 530,500 Q545,510 550,530',
    connects: ['MARKET_SQ', 'ENTERTAINMENT'],
  },
];
