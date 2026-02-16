import React from "react";

interface DistrictGroundProps {
  points: string;
  terrain: "urban" | "water" | "green" | "industrial" | "rural";
  gradient: [string, string];
  code: string;
  isActive: boolean;
}

function getCenter(points: string): { x: number; y: number } {
  const coords = points.split(" ").map((p) => {
    const [x, y] = p.split(",").map(Number);
    return { x, y };
  });
  const sum = coords.reduce(
    (acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / coords.length, y: sum.y / coords.length };
}

const TERRAIN_FILL: Record<
  DistrictGroundProps["terrain"],
  { color: string; opacity: number }
> = {
  urban: { color: "#E0E0E0", opacity: 0.75 },
  water: { color: "#B3E5FC", opacity: 0.65 },
  green: { color: "#C8E6C9", opacity: 0.75 },
  industrial: { color: "#CFD8DC", opacity: 0.7 },
  rural: { color: "#DCEDC8", opacity: 0.75 },
};

function TerrainTexture({
  terrain,
  cx,
  cy,
}: {
  terrain: DistrictGroundProps["terrain"];
  cx: number;
  cy: number;
}) {
  switch (terrain) {
    case "urban":
      return (
        <g opacity={0.3}>
          <rect x={cx - 18} y={cy - 14} width={36} height={1.5} fill="#9E9E9E" />
          <rect x={cx - 18} y={cy - 4} width={36} height={1.5} fill="#9E9E9E" />
          <rect x={cx - 18} y={cy + 6} width={36} height={1.5} fill="#9E9E9E" />
          <rect x={cx - 18} y={cy + 16} width={36} height={1.5} fill="#9E9E9E" />
          <rect x={cx - 10} y={cy - 18} width={1.5} height={38} fill="#BDBDBD" />
          <rect x={cx + 8} y={cy - 18} width={1.5} height={38} fill="#BDBDBD" />
        </g>
      );
    case "water":
      return (
        <g opacity={0.35}>
          <path
            d={`M${cx - 20},${cy - 8} Q${cx - 10},${cy - 12} ${cx},${cy - 8} Q${cx + 10},${cy - 4} ${cx + 20},${cy - 8}`}
            fill="none"
            stroke="#81D4FA"
            strokeWidth={1.2}
          />
          <path
            d={`M${cx - 18},${cy} Q${cx - 8},${cy - 4} ${cx + 2},${cy} Q${cx + 12},${cy + 4} ${cx + 18},${cy}`}
            fill="none"
            stroke="#4FC3F7"
            strokeWidth={1}
          />
          <path
            d={`M${cx - 16},${cy + 8} Q${cx - 6},${cy + 4} ${cx + 4},${cy + 8} Q${cx + 14},${cy + 12} ${cx + 16},${cy + 8}`}
            fill="none"
            stroke="#81D4FA"
            strokeWidth={1.2}
          />
        </g>
      );
    case "green":
      return (
        <g opacity={0.4}>
          <circle cx={cx - 14} cy={cy - 10} r={3} fill="#43A047" />
          <circle cx={cx + 6} cy={cy - 12} r={4} fill="#2E7D32" />
          <circle cx={cx - 8} cy={cy + 2} r={3.5} fill="#388E3C" />
          <circle cx={cx + 14} cy={cy - 2} r={3} fill="#43A047" />
          <circle cx={cx + 2} cy={cy + 10} r={4} fill="#2E7D32" />
          <circle cx={cx - 16} cy={cy + 12} r={2.5} fill="#388E3C" />
          <circle cx={cx + 12} cy={cy + 14} r={3} fill="#43A047" />
          <circle cx={cx - 4} cy={cy - 6} r={2} fill="#66BB6A" />
        </g>
      );
    case "industrial":
      return (
        <g opacity={0.3}>
          <rect x={cx - 16} y={cy - 10} width={14} height={8} rx={1} fill="#90A4AE" />
          <rect x={cx + 2} y={cy - 6} width={12} height={10} rx={1} fill="#78909C" />
          <rect x={cx - 8} y={cy + 6} width={16} height={6} rx={1} fill="#90A4AE" />
        </g>
      );
    case "rural":
      return (
        <g opacity={0.35}>
          <line x1={cx - 18} y1={cy - 10} x2={cx + 18} y2={cy - 10} stroke="#AED581" strokeWidth={1.5} />
          <line x1={cx - 18} y1={cy - 2} x2={cx + 18} y2={cy - 2} stroke="#AED581" strokeWidth={1.5} />
          <line x1={cx - 18} y1={cy + 6} x2={cx + 18} y2={cy + 6} stroke="#AED581" strokeWidth={1.5} />
          <line x1={cx - 18} y1={cy + 14} x2={cx + 18} y2={cy + 14} stroke="#AED581" strokeWidth={1.5} />
        </g>
      );
  }
}

export function DistrictGround({
  points,
  terrain,
  gradient,
  code,
  isActive,
}: DistrictGroundProps) {
  const { x: cx, y: cy } = getCenter(points);
  const fill = TERRAIN_FILL[terrain];
  const activeOpacity = isActive ? 0.95 : fill.opacity;
  const borderOpacity = isActive ? 1.0 : 0.5;
  const filterId = `glow-${code}`;

  return (
    <g id={`ground-${code}`}>
      {/* Active glow behind */}
      {isActive && (
        <>
          <defs>
            <filter id={filterId}>
              <feGaussianBlur stdDeviation={8} />
            </filter>
          </defs>
          <polygon
            points={points}
            fill={gradient[0]}
            opacity={0.15}
            filter={`url(#${filterId})`}
          />
        </>
      )}

      {/* Terrain fill */}
      <polygon
        points={points}
        fill={fill.color}
        opacity={activeOpacity}
      />

      {/* Terrain texture */}
      <TerrainTexture terrain={terrain} cx={cx} cy={cy} />

      {/* Border */}
      <polygon
        points={points}
        fill="none"
        stroke={gradient[1]}
        strokeWidth={1.5}
        opacity={borderOpacity}
        strokeLinejoin="round"
      />
    </g>
  );
}
