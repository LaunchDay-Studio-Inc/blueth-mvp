export interface DistrictMeta {
  code: string;
  name: string;
  description: string;
  modifier: number;
  fill: string;
  stroke: string;
  points: string;
  locations: string[];
  /** Gradient stops [light, dark] for SVG linearGradient fills */
  gradient: [string, string];
  /** Key into DISTRICT_ICONS for the district emblem */
  icon: string;
  /** Terrain type affecting background rendering */
  terrain: 'urban' | 'water' | 'green' | 'industrial' | 'rural';
}

export const DISTRICTS: DistrictMeta[] = [
  {
    code: 'CBD',
    name: 'Central Business District',
    description: 'The financial heart of Blueth City. Premium offices and luxury retail.',
    modifier: 1.5,
    fill: '#3B82F6',
    stroke: '#2563EB',
    points: '351,162 475,128 506,196 475,299 351,299 320,230',
    locations: ['Office', 'Bank', 'Fine Dining'],
    gradient: ['#5B9CF6', '#1E40AF'],
    icon: 'skyscraper',
    terrain: 'urban',
  },
  {
    code: 'OLD_TOWN',
    name: 'Old Town',
    description: 'Historic district with charming streets and artisan shops.',
    modifier: 1.2,
    fill: '#D97706',
    stroke: '#B45309',
    points: '222,134 346,100 377,169 346,237 222,271 191,203',
    locations: ['Market', 'Cafe', 'Workshop'],
    gradient: ['#F4A742', '#92400E'],
    icon: 'clocktower',
    terrain: 'urban',
  },
  {
    code: 'MARINA',
    name: 'Marina',
    description: 'Waterfront district with upscale dining and yacht clubs.',
    modifier: 1.4,
    fill: '#06B6D4',
    stroke: '#0891B2',
    points: '478,76 602,42 664,110 633,213 478,213 447,145',
    locations: ['Restaurant', 'Leisure Club', 'Marina Store'],
    gradient: ['#22D3EE', '#0E7490'],
    icon: 'sailboat',
    terrain: 'water',
  },
  {
    code: 'TECH_PARK',
    name: 'Tech Park',
    description: 'Innovation hub with startups and research labs.',
    modifier: 1.3,
    fill: '#8B5CF6',
    stroke: '#7C3AED',
    points: '478,186 633,186 664,289 602,357 478,323 447,289',
    locations: ['Tech Office', 'Lab', 'Cafe'],
    gradient: ['#A78BFA', '#5B21B6'],
    icon: 'circuit',
    terrain: 'urban',
  },
  {
    code: 'MARKET_SQ',
    name: 'Market Square',
    description: 'Central marketplace for everyday goods and street food.',
    modifier: 1.0,
    fill: '#22C55E',
    stroke: '#16A34A',
    points: '274,243 398,243 429,346 367,414 274,414 243,311',
    locations: ['Market Stall', 'Street Food', 'General Store'],
    gradient: ['#4ADE80', '#15803D'],
    icon: 'market-stall',
    terrain: 'urban',
  },
  {
    code: 'ENTERTAINMENT',
    name: 'Entertainment District',
    description: 'Nightlife, theaters, and recreational activities.',
    modifier: 1.25,
    fill: '#EC4899',
    stroke: '#DB2777',
    points: '378,239 502,273 532,376 471,445 378,410 347,342',
    locations: ['Theater', 'Nightclub', 'Arcade'],
    gradient: ['#F472B6', '#9D174D'],
    icon: 'spotlight',
    terrain: 'urban',
  },
  {
    code: 'UNIVERSITY',
    name: 'University',
    description: 'Academic quarter with libraries and student economy.',
    modifier: 1.1,
    fill: '#F59E0B',
    stroke: '#D97706',
    points: '147,243 240,243 271,346 240,414 147,414 116,311',
    locations: ['Library', 'Campus Cafe', 'Bookstore'],
    gradient: ['#FBBF24', '#92400E'],
    icon: 'book-tower',
    terrain: 'urban',
  },
  {
    code: 'HARBOR',
    name: 'Harbor',
    description: 'Industrial port with warehouses and shipping.',
    modifier: 0.9,
    fill: '#64748B',
    stroke: '#475569',
    points: '635,97 759,97 790,200 759,303 635,303 604,200',
    locations: ['Warehouse', 'Dock Office', 'Canteen'],
    gradient: ['#94A3B8', '#334155'],
    icon: 'crane',
    terrain: 'water',
  },
  {
    code: 'INDUSTRIAL',
    name: 'Industrial Zone',
    description: 'Factories and manufacturing. Cheap but dirty.',
    modifier: 0.8,
    fill: '#78716C',
    stroke: '#57534E',
    points: '636,270 760,270 791,407 729,475 636,441 605,338',
    locations: ['Factory', 'Workshop', 'Power Plant'],
    gradient: ['#A8A29E', '#44403C'],
    icon: 'factory',
    terrain: 'industrial',
  },
  {
    code: 'SUBURBS_N',
    name: 'North Suburbs',
    description: 'Quiet residential area with family homes.',
    modifier: 0.85,
    fill: '#A3E635',
    stroke: '#84CC16',
    points: '141,47 296,12 358,115 296,184 141,184 110,115',
    locations: ['Home', 'Corner Shop', 'Park'],
    gradient: ['#BEF264', '#4D7C0F'],
    icon: 'house-tree',
    terrain: 'green',
  },
  {
    code: 'SUBURBS_S',
    name: 'South Suburbs',
    description: 'Affordable housing and small local businesses.',
    modifier: 0.85,
    fill: '#86EFAC',
    stroke: '#4ADE80',
    points: '143,386 298,386 329,489 267,557 143,557 112,454',
    locations: ['Home', 'Grocery', 'Community Center'],
    gradient: ['#A7F3D0', '#047857'],
    icon: 'community',
    terrain: 'green',
  },
  {
    code: 'OUTSKIRTS',
    name: 'Outskirts',
    description: 'Rural fringe. Cheapest land but limited services.',
    modifier: 0.7,
    fill: '#D1D5DB',
    stroke: '#9CA3AF',
    points: '43,140 167,140 167,414 136,483 43,483 12,311',
    locations: ['Farm', 'Shelter', 'Roadside Stall'],
    gradient: ['#E5E7EB', '#6B7280'],
    icon: 'windmill',
    terrain: 'rural',
  },
];

export function getDistrict(code: string): DistrictMeta | undefined {
  return DISTRICTS.find((d) => d.code === code);
}

// ── Locked Future Expansion Zones ──────────────────

export interface LockedZoneMeta {
  code: string;
  name: string;
  teaser: string;
  unlockCost: number;
  unlockLevel: number;
  polygon: [number, number][];
  center: [number, number];
  gradient: [string, string];
}

export const LOCKED_ZONES: LockedZoneMeta[] = [
  {
    code: 'CRYSTAL_HEIGHTS',
    name: 'Crystal Heights',
    teaser: 'Gleaming spires rise above the clouds. Only the elite can afford a view from up here.',
    unlockCost: 500_000,
    unlockLevel: 15,
    polygon: [
      [480, 100], [580, 80], [640, 120], [640, 190],
      [580, 220], [480, 190],
    ],
    center: [560, 150],
    gradient: ['#A78BFA', '#7C3AED'],
  },
  {
    code: 'SUNSET_BEACH',
    name: 'Sunset Beach',
    teaser: 'Golden sands and turquoise waters. A resort paradise waiting to be developed.',
    unlockCost: 350_000,
    unlockLevel: 10,
    polygon: [
      [880, 100], [960, 120], [980, 200], [960, 300],
      [880, 280], [860, 180],
    ],
    center: [920, 200],
    gradient: ['#FBBF24', '#F59E0B'],
  },
  {
    code: 'THE_UNDERGROUND',
    name: 'The Underground',
    teaser: 'Abandoned tunnels and forgotten bunkers. Who knows what secrets lie beneath?',
    unlockCost: 250_000,
    unlockLevel: 8,
    polygon: [
      [420, 700], [540, 690], [580, 740], [560, 810],
      [460, 820], [400, 770],
    ],
    center: [490, 755],
    gradient: ['#6B7280', '#374151'],
  },
  {
    code: 'SKYPORT',
    name: 'Skyport',
    teaser: 'A gleaming aerodrome on the horizon. The gateway to cities beyond.',
    unlockCost: 750_000,
    unlockLevel: 20,
    polygon: [
      [100, 100], [220, 80], [260, 140], [240, 200],
      [140, 200], [80, 160],
    ],
    center: [170, 145],
    gradient: ['#38BDF8', '#0284C7'],
  },
  {
    code: 'FOREST_HAVEN',
    name: 'Forest Haven',
    teaser: 'Ancient woods untouched by progress. Rare resources hide in the canopy.',
    unlockCost: 180_000,
    unlockLevel: 5,
    polygon: [
      [60, 680], [160, 700], [180, 780], [140, 840],
      [60, 830], [30, 760],
    ],
    center: [110, 765],
    gradient: ['#22C55E', '#15803D'],
  },
];

// ── District Stats (crime, traffic, rent as 0-100) ──

export const DISTRICT_STATS: Record<string, { crime: number; traffic: number; rent: number }> = {
  CBD:           { crime: 25, traffic: 85, rent: 95 },
  OLD_TOWN:      { crime: 20, traffic: 40, rent: 65 },
  MARINA:        { crime: 10, traffic: 30, rent: 90 },
  TECH_PARK:     { crime: 15, traffic: 60, rent: 75 },
  MARKET_SQ:     { crime: 35, traffic: 70, rent: 50 },
  ENTERTAINMENT: { crime: 55, traffic: 75, rent: 60 },
  UNIVERSITY:    { crime: 12, traffic: 45, rent: 40 },
  HARBOR:        { crime: 40, traffic: 55, rent: 35 },
  INDUSTRIAL:    { crime: 50, traffic: 65, rent: 25 },
  SUBURBS_N:     { crime: 8,  traffic: 20, rent: 55 },
  SUBURBS_S:     { crime: 18, traffic: 25, rent: 30 },
  OUTSKIRTS:     { crime: 30, traffic: 10, rent: 15 },
};
