import React from "react";

interface RoadNetworkProps {
  centers: Record<string, { x: number; y: number }>;
}

const ROADS: [string, string][] = [
  ["SUBURBS_N", "OLD_TOWN"],
  ["SUBURBS_N", "OUTSKIRTS"],
  ["OLD_TOWN", "CBD"],
  ["CBD", "MARINA"],
  ["CBD", "TECH_PARK"],
  ["CBD", "MARKET_SQ"],
  ["MARINA", "HARBOR"],
  ["HARBOR", "INDUSTRIAL"],
  ["TECH_PARK", "ENTERTAINMENT"],
  ["TECH_PARK", "INDUSTRIAL"],
  ["MARKET_SQ", "ENTERTAINMENT"],
  ["MARKET_SQ", "UNIVERSITY"],
  ["UNIVERSITY", "OUTSKIRTS"],
  ["UNIVERSITY", "SUBURBS_S"],
  ["OUTSKIRTS", "SUBURBS_S"],
  ["OLD_TOWN", "MARKET_SQ"],
];

/** Count how many roads connect to each district */
function findCrossroads(
  roads: [string, string][],
  centers: Record<string, { x: number; y: number }>
): { x: number; y: number }[] {
  const counts: Record<string, number> = {};
  for (const [a, b] of roads) {
    counts[a] = (counts[a] ?? 0) + 1;
    counts[b] = (counts[b] ?? 0) + 1;
  }
  const result: { x: number; y: number }[] = [];
  for (const [code, count] of Object.entries(counts)) {
    if (count >= 3 && centers[code]) {
      result.push(centers[code]);
    }
  }
  // Return at most 3
  return result.slice(0, 3);
}

/** Compute a quadratic bezier control point offset perpendicular to the midpoint */
function controlPoint(
  ax: number,
  ay: number,
  bx: number,
  by: number
): { cx: number; cy: number } {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // perpendicular offset scaled by segment length
  const offset = len * 0.12;
  return {
    cx: mx + (-dy / len) * offset,
    cy: my + (dx / len) * offset,
  };
}

/** Check if a bezier path segment crosses the river zone (approx x=350-380) */
function crossesRiver(ax: number, bx: number, cx: number): boolean {
  // Check if the bezier passes through x=350..380
  const minX = Math.min(ax, bx, cx);
  const maxX = Math.max(ax, bx, cx);
  return minX < 380 && maxX > 350;
}

/** Find approximate x,y where the bezier crosses x≈365 (river center) */
function riverCrossing(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): { x: number; y: number } | null {
  const targetX = 365;
  // Sample the quadratic bezier B(t) = (1-t)²A + 2(1-t)tC + t²B
  let bestT = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
    const dist = Math.abs(x - targetX);
    if (dist < bestDist) {
      bestDist = dist;
      bestT = t;
    }
  }
  if (bestDist > 30) return null;
  const t = bestT;
  return {
    x: (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx,
    y: (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by,
  };
}

export function RoadNetwork({ centers }: RoadNetworkProps) {
  const roads = ROADS.filter(([a, b]) => centers[a] && centers[b]);
  const crossroads = findCrossroads(ROADS, centers);

  const bridges: { x: number; y: number }[] = [];

  return (
    <g id="road-network">
      {/* Dirt road base layer */}
      {roads.map(([a, b], i) => {
        const pa = centers[a];
        const pb = centers[b];
        const cp = controlPoint(pa.x, pa.y, pb.x, pb.y);
        const d = `M${pa.x},${pa.y} Q${cp.cx},${cp.cy} ${pb.x},${pb.y}`;

        // Check for river crossing
        if (crossesRiver(pa.x, pb.x, cp.cx)) {
          const crossing = riverCrossing(
            pa.x, pa.y, pb.x, pb.y, cp.cx, cp.cy
          );
          if (crossing) bridges.push(crossing);
        }

        return (
          <path
            key={`road-base-${i}`}
            d={d}
            fill="none"
            stroke="#795548"
            strokeWidth={2.5}
            opacity={0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}

      {/* Road center-line layer */}
      {roads.map(([a, b], i) => {
        const pa = centers[a];
        const pb = centers[b];
        const cp = controlPoint(pa.x, pa.y, pb.x, pb.y);
        const d = `M${pa.x},${pa.y} Q${cp.cx},${cp.cy} ${pb.x},${pb.y}`;
        return (
          <path
            key={`road-center-${i}`}
            d={d}
            fill="none"
            stroke="#D7CCC8"
            strokeWidth={1}
            opacity={0.35}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}

      {/* Bridges where roads cross the river */}
      {bridges.map((br, i) => (
        <g key={`bridge-${i}`} transform={`translate(${br.x - 6},${br.y - 2})`}>
          {/* Bridge deck */}
          <rect width={12} height={4} rx={1} fill="#795548" />
          {/* Arch supports underneath */}
          <path
            d="M1,4 Q3,8 5,4"
            fill="none"
            stroke="#5D4037"
            strokeWidth={1.2}
          />
          <path
            d="M7,4 Q9,8 11,4"
            fill="none"
            stroke="#5D4037"
            strokeWidth={1.2}
          />
        </g>
      ))}

      {/* Crossroads markers (districts with 3+ connections) */}
      {crossroads.map((cr, i) => (
        <circle
          key={`crossroad-${i}`}
          cx={cr.x}
          cy={cr.y}
          r={4}
          fill="#795548"
          opacity={0.5}
        />
      ))}
    </g>
  );
}
