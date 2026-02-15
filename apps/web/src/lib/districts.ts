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
    points: '300,180 380,160 400,200 380,260 300,260 280,220',
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
    points: '200,160 280,140 300,180 280,220 200,240 180,200',
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
    points: '400,120 480,100 520,140 500,200 400,200 380,160',
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
    points: '400,200 500,200 520,260 480,300 400,280 380,260',
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
    points: '240,240 320,240 340,300 300,340 240,340 220,280',
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
    points: '320,240 400,260 420,320 380,360 320,340 300,300',
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
    points: '140,240 200,240 220,300 200,340 140,340 120,280',
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
    points: '520,140 600,140 620,200 600,260 520,260 500,200',
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
    points: '520,260 600,260 620,340 580,380 520,360 500,300',
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
    points: '140,100 240,80 280,140 240,180 140,180 120,140',
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
    points: '140,340 240,340 260,400 220,440 140,440 120,380',
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
    points: '60,180 140,180 140,340 120,380 60,380 40,280',
    locations: ['Farm', 'Shelter', 'Roadside Stall'],
    gradient: ['#E5E7EB', '#6B7280'],
    icon: 'windmill',
    terrain: 'rural',
  },
];

export function getDistrict(code: string): DistrictMeta | undefined {
  return DISTRICTS.find((d) => d.code === code);
}
