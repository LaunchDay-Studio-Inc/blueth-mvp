import type { DistrictMeta } from '@/lib/districts';

/** Extended district with geographic polygon data for Map V3 */
export interface DistrictGeo extends DistrictMeta {
  /** Polygon vertices as [x, y][] in the 1200x900 viewBox */
  polygon: [number, number][];
  /** Center point [x, y] for label and landmark placement */
  center: [number, number];
  /** Adjacent district codes */
  neighbors: string[];
}

/** Point of interest within a district */
export interface POI {
  id: string;
  name: string;
  districtCode: string;
  position: [number, number];
  icon: string;
}

/** Road connecting two districts */
export interface Road {
  id: string;
  type: 'highway' | 'primary' | 'secondary' | 'tertiary';
  /** SVG path `d` attribute */
  path: string;
  connects: [string, string];
}

/** Pan/zoom state for the map viewport */
export interface MapViewState {
  x: number;
  y: number;
  scale: number;
}
