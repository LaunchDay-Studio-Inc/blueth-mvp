import type { POI } from './types';

/**
 * Points of interest for Map V3.
 * Positions are [x, y] in the 1200x900 viewBox.
 */
export const POIS: POI[] = [
  // CBD
  { id: 'cbd-office', name: 'Office Tower', districtCode: 'CBD', position: [555, 360], icon: 'building' },
  { id: 'cbd-bank', name: 'Bank', districtCode: 'CBD', position: [590, 400], icon: 'bank' },
  { id: 'cbd-dining', name: 'Fine Dining', districtCode: 'CBD', position: [540, 410], icon: 'food' },

  // Old Town
  { id: 'old-market', name: 'Market', districtCode: 'OLD_TOWN', position: [420, 350], icon: 'shop' },
  { id: 'old-cafe', name: 'Cafe', districtCode: 'OLD_TOWN', position: [450, 390], icon: 'food' },
  { id: 'old-workshop', name: 'Workshop', districtCode: 'OLD_TOWN', position: [400, 410], icon: 'tools' },

  // Marina
  { id: 'marina-restaurant', name: 'Restaurant', districtCode: 'MARINA', position: [770, 250], icon: 'food' },
  { id: 'marina-club', name: 'Leisure Club', districtCode: 'MARINA', position: [810, 280], icon: 'leisure' },
  { id: 'marina-store', name: 'Marina Store', districtCode: 'MARINA', position: [790, 310], icon: 'shop' },

  // Tech Park
  { id: 'tech-office', name: 'Tech Office', districtCode: 'TECH_PARK', position: [630, 260], icon: 'building' },
  { id: 'tech-lab', name: 'Lab', districtCode: 'TECH_PARK', position: [660, 290], icon: 'lab' },
  { id: 'tech-cafe', name: 'Cafe', districtCode: 'TECH_PARK', position: [650, 310], icon: 'food' },

  // Market Square
  { id: 'market-stall', name: 'Market Stall', districtCode: 'MARKET_SQ', position: [420, 480], icon: 'shop' },
  { id: 'market-food', name: 'Street Food', districtCode: 'MARKET_SQ', position: [440, 520], icon: 'food' },
  { id: 'market-general', name: 'General Store', districtCode: 'MARKET_SQ', position: [410, 540], icon: 'shop' },

  // Entertainment
  { id: 'ent-theater', name: 'Theater', districtCode: 'ENTERTAINMENT', position: [540, 480], icon: 'star' },
  { id: 'ent-nightclub', name: 'Nightclub', districtCode: 'ENTERTAINMENT', position: [560, 520], icon: 'music' },
  { id: 'ent-arcade', name: 'Arcade', districtCode: 'ENTERTAINMENT', position: [530, 550], icon: 'game' },

  // University
  { id: 'uni-library', name: 'Library', districtCode: 'UNIVERSITY', position: [280, 360], icon: 'book' },
  { id: 'uni-cafe', name: 'Campus Cafe', districtCode: 'UNIVERSITY', position: [310, 390], icon: 'food' },
  { id: 'uni-bookstore', name: 'Bookstore', districtCode: 'UNIVERSITY', position: [290, 420], icon: 'book' },

  // Harbor
  { id: 'harbor-warehouse', name: 'Warehouse', districtCode: 'HARBOR', position: [840, 400], icon: 'warehouse' },
  { id: 'harbor-dock', name: 'Dock Office', districtCode: 'HARBOR', position: [870, 430], icon: 'building' },
  { id: 'harbor-canteen', name: 'Canteen', districtCode: 'HARBOR', position: [850, 460], icon: 'food' },

  // Industrial
  { id: 'ind-factory', name: 'Factory', districtCode: 'INDUSTRIAL', position: [770, 530], icon: 'factory' },
  { id: 'ind-workshop', name: 'Workshop', districtCode: 'INDUSTRIAL', position: [800, 570], icon: 'tools' },
  { id: 'ind-power', name: 'Power Plant', districtCode: 'INDUSTRIAL', position: [760, 580], icon: 'power' },

  // Suburbs N
  { id: 'subn-home', name: 'Home', districtCode: 'SUBURBS_N', position: [370, 210], icon: 'home' },
  { id: 'subn-shop', name: 'Corner Shop', districtCode: 'SUBURBS_N', position: [400, 240], icon: 'shop' },
  { id: 'subn-park', name: 'Park', districtCode: 'SUBURBS_N', position: [350, 250], icon: 'tree' },

  // Suburbs S
  { id: 'subs-home', name: 'Home', districtCode: 'SUBURBS_S', position: [340, 620], icon: 'home' },
  { id: 'subs-grocery', name: 'Grocery', districtCode: 'SUBURBS_S', position: [370, 660], icon: 'shop' },
  { id: 'subs-community', name: 'Community Center', districtCode: 'SUBURBS_S', position: [350, 690], icon: 'building' },

  // Outskirts
  { id: 'out-farm', name: 'Farm', districtCode: 'OUTSKIRTS', position: [170, 350], icon: 'farm' },
  { id: 'out-shelter', name: 'Shelter', districtCode: 'OUTSKIRTS', position: [180, 480], icon: 'home' },
  { id: 'out-stall', name: 'Roadside Stall', districtCode: 'OUTSKIRTS', position: [175, 560], icon: 'shop' },
];
