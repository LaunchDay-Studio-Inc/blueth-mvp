import type { Road } from './types';

/**
 * Road network for Map V3.
 * Paths are SVG `d` attributes in the 1200x900 viewBox.
 *
 * Hierarchy:
 *   highway   — Ring road (thick, double-line, dashed center)
 *   primary   — Major arterials connecting district centers
 *   secondary — Connector roads between adjacent districts
 *   tertiary  — Local streets, internal district roads
 */
export const ROADS: Road[] = [
  // ── Ring Road (highway) ──
  {
    id: 'ring-road',
    type: 'highway',
    path: 'M280,140 Q500,90 780,160 Q940,260 940,500 Q900,700 680,720 Q400,760 220,680 Q100,560 100,320 Q120,160 280,140 Z',
    connects: ['OUTSKIRTS', 'OUTSKIRTS'],
  },

  // ── Primary roads (arterials) ──
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
  {
    id: 'cbd-south',
    type: 'primary',
    path: 'M570,420 Q560,440 540,460 Q510,480 490,500',
    connects: ['CBD', 'MARKET_SQ'],
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
  {
    id: 'industrial-south',
    type: 'secondary',
    path: 'M790,550 Q720,590 660,610 Q580,640 500,660',
    connects: ['INDUSTRIAL', 'SUBURBS_S'],
  },
  {
    id: 'entertainment-cbd',
    type: 'secondary',
    path: 'M570,420 Q575,440 570,460 Q560,480 550,505',
    connects: ['CBD', 'ENTERTAINMENT'],
  },

  // ── Tertiary (local streets) ──
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
  // CBD grid (local streets)
  {
    id: 'cbd-grid-h1',
    type: 'tertiary',
    path: 'M510,360 L630,360',
    connects: ['CBD', 'CBD'],
  },
  {
    id: 'cbd-grid-h2',
    type: 'tertiary',
    path: 'M510,390 L630,390',
    connects: ['CBD', 'CBD'],
  },
  {
    id: 'cbd-grid-v1',
    type: 'tertiary',
    path: 'M540,320 L540,435',
    connects: ['CBD', 'CBD'],
  },
  {
    id: 'cbd-grid-v2',
    type: 'tertiary',
    path: 'M600,320 L600,435',
    connects: ['CBD', 'CBD'],
  },
  // Suburbs curving streets
  {
    id: 'suburb-n-curve1',
    type: 'tertiary',
    path: 'M320,200 Q350,180 390,190 Q420,200 440,220',
    connects: ['SUBURBS_N', 'SUBURBS_N'],
  },
  {
    id: 'suburb-n-curve2',
    type: 'tertiary',
    path: 'M310,230 Q340,215 380,225 Q410,240 430,260',
    connects: ['SUBURBS_N', 'SUBURBS_N'],
  },
  {
    id: 'suburb-s-curve1',
    type: 'tertiary',
    path: 'M300,610 Q330,595 370,600 Q400,610 420,630',
    connects: ['SUBURBS_S', 'SUBURBS_S'],
  },
  {
    id: 'suburb-s-curve2',
    type: 'tertiary',
    path: 'M310,660 Q340,645 370,655 Q400,670 410,690',
    connects: ['SUBURBS_S', 'SUBURBS_S'],
  },
  // Tech Park campus roads
  {
    id: 'tech-campus-loop',
    type: 'tertiary',
    path: 'M610,240 Q640,230 670,250 Q680,270 670,290 Q650,310 620,300',
    connects: ['TECH_PARK', 'TECH_PARK'],
  },
  // University internal
  {
    id: 'uni-quad',
    type: 'tertiary',
    path: 'M260,340 Q280,330 300,340 Q310,360 300,380 Q280,395 260,380 Q250,360 260,340',
    connects: ['UNIVERSITY', 'UNIVERSITY'],
  },
  // Marina waterfront path
  {
    id: 'marina-promenade',
    type: 'tertiary',
    path: 'M720,230 Q750,220 780,230 Q810,250 830,280',
    connects: ['MARINA', 'MARINA'],
  },
  // Outskirts dirt road
  {
    id: 'outskirts-trail',
    type: 'tertiary',
    path: 'M150,300 Q170,380 160,460 Q155,540 170,620',
    connects: ['OUTSKIRTS', 'OUTSKIRTS'],
  },
];

/** Labels for major roads (rendered at higher zoom levels) */
export const ROAD_LABELS: { roadId: string; label: string; position: [number, number]; angle: number }[] = [
  { roadId: 'ring-road', label: 'RING ROAD', position: [500, 85], angle: 0 },
  { roadId: 'main-avenue', label: 'MAIN AVE', position: [555, 300], angle: -90 },
  { roadId: 'university-blvd', label: 'UNIVERSITY BLVD', position: [430, 360], angle: -2 },
  { roadId: 'marina-drive', label: 'MARINA DR', position: [710, 340], angle: -20 },
  { roadId: 'harbor-freight', label: 'FREIGHT RD', position: [830, 480], angle: -65 },
  { roadId: 'waterfront-rd', label: 'WATERFRONT RD', position: [850, 320], angle: -75 },
];
